#!/usr/bin/env node
/**
 * speed_audit.mjs — deterministic performance inventory for Persian WordPress sites.
 *
 * Usage:
 *   node speed_audit.mjs [--root .] [--url https://example.ir] [--samples 5] [--json]
 *
 * Static: font payload, theme/plugin weight, page builders, conflicting caching
 * plugins, image formats in uploads, risky query patterns.
 * Live (--url): TTFB samples, compression, cache headers, render-blocking assets,
 * resource weight breakdown, missing LCP hints.
 *
 * Exit codes: 0 = no errors, 1 = errors found, 2 = usage/IO problem.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const argv = process.argv.slice(2);
const flag = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
const root = flag('root') || '.';
const url = flag('url');
const samples = Number(flag('samples') || 5);
const asJson = argv.includes('--json');

if (!existsSync(root)) {
  console.error(`root not found: ${root}`);
  process.exit(2);
}

const findings = [];
const add = (level, rule, message, hint) => findings.push({ level, rule, message, hint });
const info = {};
const KB = (b) => Math.round(b / 1024);

function walk(dir, { maxDepth = 6, skip = /node_modules|\.git|\.cache/ } = {}, depth = 0, out = []) {
  if (depth > maxDepth || !existsSync(dir)) return out;
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    if (skip.test(p)) continue;
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, { maxDepth, skip }, depth + 1, out);
    else out.push({ path: p, size: st.size });
  }
  return out;
}
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

// ------------------------------------------------------------ 1. fonts

const FONT_EXT = new Set(['.woff2', '.woff', '.ttf', '.otf', '.eot']);
const contentDir = existsSync(join(root, 'wp-content')) ? join(root, 'wp-content') : root;
const allFiles = walk(contentDir, { maxDepth: 7, skip: /node_modules|\.git|\.cache|uploads\/20/ });

const fonts = allFiles.filter((f) => FONT_EXT.has(extname(f.path).toLowerCase()));
const fontBytes = fonts.reduce((a, f) => a + f.size, 0);
const legacyFonts = fonts.filter((f) => ['.ttf', '.otf', '.eot', '.woff'].includes(extname(f.path).toLowerCase()));
const biggestFonts = [...fonts].sort((a, b) => b.size - a.size).slice(0, 8)
  .map((f) => `${relative(root, f.path)} (${KB(f.size)}KB)`);

info.fonts = { count: fonts.length, totalKB: KB(fontBytes), biggest: biggestFonts };

if (fontBytes > 400 * 1024) {
  add('error', 'font-payload', `${KB(fontBytes)} KB of font files on disk (budget 150 KB shipped)`, 'references/persian-fonts.md §2');
} else if (fontBytes > 150 * 1024) {
  add('warn', 'font-payload', `${KB(fontBytes)} KB of font files on disk (budget 150 KB)`, 'references/persian-fonts.md §2');
}
if (legacyFonts.length > 0) {
  add('warn', 'legacy-font-format', `${legacyFonts.length} non-woff2 font files (ttf/otf/eot/woff) — convert and subset to woff2`, 'references/persian-fonts.md §4');
}

// font-face config
const cssFiles = allFiles.filter((f) => f.path.endsWith('.css') && f.size < 3_000_000);
let fontFaceCount = 0;
let missingSwap = 0;
for (const f of cssFiles.slice(0, 600)) {
  const c = read(f.path);
  const blocks = c.match(/@font-face\s*\{[^}]*\}/g) || [];
  fontFaceCount += blocks.length;
  for (const b of blocks) if (!/font-display\s*:\s*(swap|optional)/i.test(b)) missingSwap += 1;
}
info.fontFaces = fontFaceCount;
if (missingSwap > 0) {
  add('warn', 'font-display', `${missingSwap} @font-face blocks without font-display: swap — causes FOIT and CLS`, 'references/persian-fonts.md §5');
}

// external font CDNs
const phpAndCss = allFiles.filter((f) => /\.(php|css|html)$/.test(f.path) && f.size < 2_000_000);
const externalFontHosts = new Set();
for (const f of phpAndCss.slice(0, 1500)) {
  const c = read(f.path);
  for (const m of c.matchAll(/https?:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net\/npm\/[a-z-]*font|use\.fontawesome\.com|cdnjs\.cloudflare\.com\/ajax\/libs\/font)/g)) {
    externalFontHosts.add(m[1]);
  }
}
if (externalFontHosts.size) {
  add('warn', 'external-fonts', `fonts loaded from external hosts: ${[...externalFontHosts].join(', ')} — self-host for Iranian visitors`, 'references/persian-fonts.md §5');
}

// -------------------------------------------------- 2. theme / builder

const themesDir = join(root, 'wp-content/themes');
if (existsSync(themesDir)) {
  const themes = readdirSync(themesDir).filter((d) => { try { return statSync(join(themesDir, d)).isDirectory(); } catch { return false; } });
  info.themes = themes.map((t) => {
    const files = walk(join(themesDir, t), { maxDepth: 6 });
    const total = files.reduce((a, f) => a + f.size, 0);
    const js = files.filter((f) => f.path.endsWith('.js')).reduce((a, f) => a + f.size, 0);
    const css = files.filter((f) => f.path.endsWith('.css')).reduce((a, f) => a + f.size, 0);
    return { name: t, totalKB: KB(total), jsKB: KB(js), cssKB: KB(css) };
  });
  for (const t of info.themes) {
    if (t.jsKB + t.cssKB > 2000) {
      add('warn', 'theme-weight', `theme "${t.name}" ships ${t.jsKB + t.cssKB} KB of JS+CSS — dequeue what the page does not use`, 'references/theme-and-builder-bloat.md §2');
    }
  }
}

const pluginsDir = join(root, 'wp-content/plugins');
let plugins = [];
if (existsSync(pluginsDir)) {
  try { plugins = readdirSync(pluginsDir).filter((d) => statSync(join(pluginsDir, d)).isDirectory()); } catch { plugins = []; }
}
info.pluginCount = plugins.length;

const builders = plugins.filter((p) => /elementor|js_composer|wpbakery|divi|beaver-builder|brizy|oxygen/.test(p));
info.pageBuilders = builders;
if (builders.length) {
  add('warn', 'page-builder', `page builder(s): ${builders.join(', ')} — enable their performance flags and dequeue unused assets`, 'references/theme-and-builder-bloat.md §3');
}
if (builders.length > 1) {
  add('error', 'multiple-builders', `more than one page builder installed: ${builders.join(', ')}`, 'references/theme-and-builder-bloat.md §3');
}

const cachePlugins = plugins.filter((p) => /litespeed-cache|w3-total-cache|wp-super-cache|wp-rocket|wp-fastest-cache|autoptimize|hummingbird|swift-performance|comet-cache|breeze|nitropack/.test(p));
info.cachePlugins = cachePlugins;
const pageCachers = cachePlugins.filter((p) => !/autoptimize/.test(p));
if (pageCachers.length > 1) {
  add('error', 'multiple-cache-plugins', `multiple page-caching plugins: ${pageCachers.join(', ')} — they fight each other`, 'references/caching-layers.md §2');
}
if (cachePlugins.length === 0) {
  add('warn', 'no-cache-plugin', 'no caching plugin detected (fine only if the server or host caches)', 'references/caching-layers.md §2');
}

const heavy = plugins.filter((p) => /revslider|LayerSlider|slider-revolution|master-slider/.test(p));
if (heavy.length) {
  add('warn', 'heavy-slider', `heavy slider plugin: ${heavy.join(', ')} — usually the LCP element and 300–700 KB`, 'references/theme-and-builder-bloat.md §6');
}

const objectCache = existsSync(join(root, 'wp-content/object-cache.php'));
info.persistentObjectCache = objectCache;
if (!objectCache) {
  add('warn', 'no-object-cache', 'no wp-content/object-cache.php — no persistent object cache (hurts logged-in TTFB)', 'references/caching-layers.md §4');
}

// ------------------------------------------------------ 3. wp-config

const cfgPath = join(root, 'wp-config.php');
if (existsSync(cfgPath)) {
  const cfg = read(cfgPath);
  if (!/DISABLE_WP_CRON['"]\s*,\s*true/.test(cfg)) {
    add('warn', 'wp-cron', 'DISABLE_WP_CRON is not set — wp-cron runs on visitor requests', 'references/caching-layers.md §7');
  }
  const mem = cfg.match(/WP_MEMORY_LIMIT['"]\s*,\s*['"](\d+)M/);
  if (mem && Number(mem[1]) < 256) {
    add('warn', 'memory-limit', `WP_MEMORY_LIMIT is ${mem[1]}M (recommend 256M)`, 'references/hosting-and-cdn.md §4');
  }
  const rev = cfg.match(/WP_POST_REVISIONS['"]\s*,\s*(\w+)/);
  if (!rev) {
    add('warn', 'revisions', 'WP_POST_REVISIONS is not limited — revisions accumulate', 'references/database-and-autoload.md §3');
  }
}

// --------------------------------------------- 4. risky query patterns

let unboundedQueries = 0;
const unboundedFiles = [];
const phpFiles = allFiles.filter((f) => f.path.endsWith('.php') && f.size < 1_500_000);
for (const f of phpFiles.slice(0, 2500)) {
  const c = read(f.path);
  const m = c.match(/(?:posts_per_page|numberposts)['"]?\s*(?:=>|:)\s*-\s*1/g);
  if (m) { unboundedQueries += m.length; if (unboundedFiles.length < 6) unboundedFiles.push(`${relative(root, f.path)} (${m.length})`); }
}
info.unboundedQueries = unboundedQueries;
if (unboundedQueries > 0) {
  add('warn', 'unbounded-query', `${unboundedQueries} queries with posts_per_page/numberposts = -1: ${unboundedFiles.join(', ')}`, 'references/database-and-autoload.md §9');
}

// --------------------------------------------------- 5. upload formats

const uploads = join(root, 'wp-content/uploads');
if (existsSync(uploads)) {
  const imgs = walk(uploads, { maxDepth: 4 }).filter((f) => /\.(jpe?g|png|webp|avif|gif)$/i.test(f.path));
  const modern = imgs.filter((f) => /\.(webp|avif)$/i.test(f.path)).length;
  const legacy = imgs.length - modern;
  const oversized = imgs.filter((f) => f.size > 300 * 1024);
  info.uploads = { total: imgs.length, modern, legacy, oversizedOver300KB: oversized.length };
  if (imgs.length > 20 && modern / imgs.length < 0.3) {
    add('warn', 'image-formats', `only ${Math.round((modern / imgs.length) * 100)}% of images are WebP/AVIF`, 'featured-image-art-direction/references/wordpress-sizing.md §2');
  }
  if (oversized.length > 0) {
    const worst = [...oversized].sort((a, b) => b.size - a.size).slice(0, 3)
      .map((f) => `${relative(root, f.path)} (${KB(f.size)}KB)`);
    add('warn', 'oversized-images', `${oversized.length} images over 300 KB, worst: ${worst.join(', ')}`, 'featured-image-art-direction/references/wordpress-sizing.md §1');
  }
}

// ------------------------------------------------------- 6. live checks

async function liveChecks(base) {
  const out = {};
  const fetchOnce = async (u, headers = {}) => {
    const t0 = performance.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(u, { signal: ctrl.signal, headers, redirect: 'follow' });
      const body = await res.text();
      return { ms: performance.now() - t0, status: res.status, headers: res.headers, body, bytes: new TextEncoder().encode(body).length };
    } catch (e) {
      return { error: e.message };
    } finally { clearTimeout(timer); }
  };

  const first = await fetchOnce(base);
  if (first.error) {
    add('warn', 'live-skipped', `could not reach ${base}: ${first.error}`, '');
    return { reachable: false };
  }

  // TTFB-ish samples (total response time; no separate TTFB in fetch)
  const times = [];
  for (let i = 0; i < Math.max(1, Math.min(samples, 10)); i += 1) {
    const r = await fetchOnce(`${base}?cachebust=${Math.random().toString(36).slice(2)}`);
    if (!r.error) times.push(r.ms);
  }
  times.sort((a, b) => a - b);
  const median = times.length ? times[Math.floor(times.length / 2)] : null;
  out.uncachedMedianMs = median ? Math.round(median) : null;
  out.samples = times.map((t) => Math.round(t));

  const warm1 = await fetchOnce(base);
  const warm2 = await fetchOnce(base);
  out.warmMs = warm2.error ? null : Math.round(warm2.ms);

  if (median && median > 1500) {
    add('error', 'slow-response', `median uncached response ${Math.round(median)} ms (target < 800 ms)`, 'references/measurement.md §1');
  } else if (median && median > 800) {
    add('warn', 'slow-response', `median uncached response ${Math.round(median)} ms (target < 800 ms)`, 'references/measurement.md §1');
  }

  const h = first.headers;
  out.server = h.get('server');
  out.contentEncoding = h.get('content-encoding');
  out.cacheControl = h.get('cache-control');
  const cacheHeader = ['x-cache', 'x-litespeed-cache', 'cf-cache-status', 'x-fastcgi-cache', 'x-proxy-cache', 'age']
    .map((k) => (h.get(k) ? `${k}: ${h.get(k)}` : null)).filter(Boolean);
  out.cacheHeaders = cacheHeader;

  if (!out.contentEncoding) {
    add('error', 'no-compression', 'no content-encoding on the HTML response — gzip/brotli is off', 'references/measurement.md §3');
  } else if (out.contentEncoding === 'gzip') {
    add('warn', 'no-brotli', 'gzip only — brotli gives ~15–20% more on text', 'references/measurement.md §3');
  }
  if (cacheHeader.length === 0) {
    add('warn', 'no-cache-header', 'no cache HIT/MISS header returned — page cache may not be running', 'references/caching-layers.md §3');
  }
  if (out.warmMs && median && out.warmMs > median * 0.9) {
    add('warn', 'cache-ineffective', `warm response (${out.warmMs} ms) is not faster than uncached median (${Math.round(median)} ms) — cache is likely bypassed`, 'references/caching-layers.md §3');
  }

  out.htmlKB = KB(first.bytes);
  if (first.bytes > 150 * 1024) {
    add('warn', 'large-html', `HTML document is ${KB(first.bytes)} KB (budget 50 KB)`, 'references/measurement.md §4');
  }

  // render-blocking + LCP hints
  const head = first.body.slice(0, first.body.search(/<\/head>/i) + 7);
  const blockingCss = (head.match(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi) || [])
    .filter((t) => !/media=["'](print|speech)["']/i.test(t) && !/rel=["']preload["']/i.test(t));
  const blockingJs = (head.match(/<script[^>]+src=[^>]*>/gi) || [])
    .filter((t) => !/\b(async|defer|type=["']module["'])/i.test(t));
  out.renderBlockingCss = blockingCss.length;
  out.renderBlockingJs = blockingJs.length;
  if (blockingCss.length > 6) {
    add('warn', 'render-blocking-css', `${blockingCss.length} render-blocking stylesheets in <head>`, 'references/theme-and-builder-bloat.md');
  }
  if (blockingJs.length > 0) {
    add('warn', 'render-blocking-js', `${blockingJs.length} synchronous scripts in <head>`, 'references/caching-layers.md §6');
  }

  if (!/fetchpriority=["']high["']/i.test(first.body)) {
    add('warn', 'no-fetchpriority', 'no fetchpriority="high" anywhere — the LCP image is probably not prioritised', 'references/core-web-vitals-fa.md');
  }
  const preloadFonts = (first.body.match(/<link[^>]+rel=["']preload["'][^>]+as=["']font["'][^>]*>/gi) || []);
  out.fontPreloads = preloadFonts.length;
  if (preloadFonts.length > 2) {
    add('warn', 'too-many-font-preloads', `${preloadFonts.length} font preloads — preload only the one critical weight`, 'references/persian-fonts.md §5');
  }
  for (const p of preloadFonts) {
    if (!/crossorigin/i.test(p)) {
      add('warn', 'preload-crossorigin', 'font preload without crossorigin — the browser downloads the font twice', 'references/persian-fonts.md §5');
      break;
    }
  }

  // images without dimensions (CLS)
  const imgTags = first.body.match(/<img[^>]*>/gi) || [];
  const noDims = imgTags.filter((t) => !/\bwidth=/i.test(t) || !/\bheight=/i.test(t));
  out.imgTags = imgTags.length;
  out.imgWithoutDimensions = noDims.length;
  if (noDims.length > 0) {
    add('warn', 'img-no-dimensions', `${noDims.length}/${imgTags.length} <img> tags lack width/height — CLS risk`, 'references/core-web-vitals-fa.md');
  }

  // third-party origins
  const origins = new Set();
  for (const m of first.body.matchAll(/(?:src|href)=["']https?:\/\/([a-z0-9.-]+)/gi)) origins.add(m[1].toLowerCase());
  const own = new URL(base).hostname.toLowerCase().replace(/^www\./, '');
  out.thirdPartyOrigins = [...origins].filter((o) => !o.endsWith(own)).slice(0, 15);
  if (out.thirdPartyOrigins.length > 5) {
    add('warn', 'third-party', `${out.thirdPartyOrigins.length} third-party origins: ${out.thirdPartyOrigins.slice(0, 6).join(', ')}…`, 'references/theme-and-builder-bloat.md §7');
  }

  // http version hint
  out.altSvc = h.get('alt-svc');

  return { reachable: true, ...out };
}

const live = url ? await liveChecks(url.replace(/\/+$/, '') + '/') : { skipped: 'no --url supplied' };
info.live = live;

// ------------------------------------------------------------- output

const errors = findings.filter((f) => f.level === 'error');
const warnings = findings.filter((f) => f.level === 'warn');

if (asJson) {
  console.log(JSON.stringify({ root, url: url || null, info, findings, errors: errors.length, warnings: warnings.length }, null, 2));
} else {
  console.log(`\nPersian WordPress speed audit — root: ${root}${url ? `  url: ${url}` : ''}\n`);
  console.log(`  fonts:        ${info.fonts.count} files, ${info.fonts.totalKB} KB total`);
  if (info.fonts.biggest.length) console.log(`                biggest: ${info.fonts.biggest.slice(0, 3).join(', ')}`);
  console.log(`  plugins:      ${info.pluginCount ?? '—'}  builders: ${(info.pageBuilders || []).join(', ') || '—'}`);
  console.log(`  cache:        ${(info.cachePlugins || []).join(', ') || '—'}  object-cache: ${info.persistentObjectCache ? 'yes' : 'no'}`);
  if (info.themes) for (const t of info.themes) console.log(`  theme ${t.name}: ${t.totalKB} KB (js ${t.jsKB} KB, css ${t.cssKB} KB)`);
  if (info.uploads) console.log(`  uploads:      ${info.uploads.total} images, ${info.uploads.modern} modern, ${info.uploads.oversizedOver300KB} over 300 KB`);
  if (live.reachable) {
    console.log(`  live:         uncached median ${live.uncachedMedianMs} ms | warm ${live.warmMs} ms | html ${live.htmlKB} KB`);
    console.log(`                encoding: ${live.contentEncoding || 'none'} | cache headers: ${live.cacheHeaders.join(', ') || 'none'}`);
    console.log(`                blocking css ${live.renderBlockingCss}, blocking js ${live.renderBlockingJs}, imgs w/o dims ${live.imgWithoutDimensions}/${live.imgTags}`);
  } else if (live.skipped) {
    console.log('  live:         skipped (pass --url to enable)');
  }
  console.log('');
  if (findings.length === 0) {
    console.log('  ✓ no findings\n');
  } else {
    for (const f of findings) {
      console.log(`  ${f.level === 'error' ? 'ERROR' : 'warn '}  [${f.rule}] ${f.message}`);
      if (f.hint) console.log(`         → ${f.hint}`);
    }
    console.log(`\n  ${errors.length} error(s) · ${warnings.length} warning(s)\n`);
  }
}

process.exit(errors.length > 0 ? 1 : 0);
