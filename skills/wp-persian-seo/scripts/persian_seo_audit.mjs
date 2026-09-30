#!/usr/bin/env node
/**
 * persian_seo_audit.mjs — deterministic Persian/RTL WordPress SEO audit.
 *
 * Usage:
 *   node persian_seo_audit.mjs [--root .] [--url https://example.ir] [--json]
 *
 * Static checks run against the filesystem (theme, wp-config, robots.txt).
 * Live checks run only when --url is supplied and network is reachable;
 * they degrade to "skipped" without failing the run.
 *
 * Exit codes: 0 = no errors, 1 = errors found, 2 = usage/IO problem.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ZWNJ = '\u200c';

const argv = process.argv.slice(2);
const flag = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
const root = flag('root') || '.';
const url = flag('url');
const asJson = argv.includes('--json');

if (!existsSync(root)) {
  console.error(`root not found: ${root}`);
  process.exit(2);
}

const findings = [];
const add = (level, rule, message, hint) => findings.push({ level, rule, message, hint });
const info = {};

// ------------------------------------------------------------ fs helpers

function walk(dir, { maxDepth = 6, exts = null, skip = /node_modules|\.git|vendor|uploads|\.cache/ } = {}, depth = 0, out = []) {
  if (depth > maxDepth || !existsSync(dir)) return out;
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    if (skip.test(p)) continue;
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, { maxDepth, exts, skip }, depth + 1, out);
    else if (!exts || exts.some((x) => e.endsWith(x))) out.push(p);
  }
  return out;
}

const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

// ------------------------------------------------- 1. locale / wp-config

const wpConfig = ['wp-config.php', 'wp-config-sample.php']
  .map((f) => join(root, f)).find(existsSync);

if (wpConfig) {
  const cfg = read(wpConfig);
  const lang = cfg.match(/define\(\s*['"]WPLANG['"]\s*,\s*['"]([^'"]*)['"]/);
  info.wplang = lang ? lang[1] : null;
  if (lang && lang[1] && lang[1] !== 'fa_IR') {
    add('warn', 'locale', `WPLANG is "${lang[1]}" (expected fa_IR for a Persian site)`, 'references/rtl-technical-seo.md §2');
  }
  if (/define\(\s*['"]WP_DEBUG['"]\s*,\s*true/.test(cfg) && !/WP_DEBUG_DISPLAY['"]\s*,\s*false/.test(cfg)) {
    add('warn', 'debug-display', 'WP_DEBUG is on without WP_DEBUG_DISPLAY=false — notices can leak into HTML and break markup', 'wp-persian-debug');
  }
} else {
  info.wpConfig = 'not found (running outside a WP root?)';
}

// --------------------------------------------- 2. theme: lang/dir + RTL

const themeDirs = existsSync(join(root, 'wp-content/themes'))
  ? readdirSync(join(root, 'wp-content/themes')).map((d) => join(root, 'wp-content/themes', d)).filter((d) => statSync(d).isDirectory())
  : existsSync(join(root, 'style.css')) ? [root] : [];

info.themes = themeDirs.map((d) => relative(root, d) || '.');

for (const theme of themeDirs) {
  const header = join(theme, 'header.php');
  const themeName = relative(root, theme) || '.';
  if (existsSync(header)) {
    const h = read(header);
    if (!/language_attributes\s*\(/.test(h) && !/\blang=/.test(h)) {
      add('error', 'html-lang', `${themeName}/header.php has no language_attributes() and no lang attribute`, 'references/rtl-technical-seo.md §1');
    }
    if (/<html[^>]*lang=["']fa["']/.test(h)) {
      add('warn', 'html-lang', `${themeName}: hardcoded lang="fa" — prefer language_attributes() so dir="rtl" is emitted`, 'references/rtl-technical-seo.md §1');
    }
  }
  // block themes
  const themeJson = join(theme, 'theme.json');
  if (existsSync(themeJson)) info.blockTheme = themeName;

  // RTL stylesheet present for classic themes
  if (existsSync(join(theme, 'style.css')) && !existsSync(join(theme, 'rtl.css')) && !existsSync(join(theme, 'style-rtl.css'))) {
    const css = read(join(theme, 'style.css'));
    if (/margin-left|margin-right|padding-left|padding-right|float\s*:\s*(left|right)/.test(css)
        && !/margin-inline|padding-inline|inset-inline/.test(css)) {
      add('warn', 'rtl-css', `${themeName}: physical CSS properties without an RTL stylesheet or logical properties`, 'references/rtl-technical-seo.md §1');
    }
  }

  // duplicate canonical emitted by the theme
  const phpFiles = walk(theme, { exts: ['.php'], maxDepth: 4 });
  for (const f of phpFiles) {
    const c = read(f);
    if (/rel=["']canonical["']/.test(c)) {
      add('warn', 'theme-canonical', `${relative(root, f)} prints a canonical tag — check for duplicates with the SEO plugin`, 'references/indexing-troubleshooting.md §5');
      break;
    }
  }
}

// ------------------------------------- 3. Arabic chars + ZWNJ in sources

const textFiles = walk(root, { exts: ['.php', '.html', '.md', '.json', '.po'], maxDepth: 6 });
let arabicHits = 0;
const arabicFiles = [];
for (const f of textFiles.slice(0, 4000)) {
  const c = read(f);
  if (!/[\u0600-\u06FF]/.test(c)) continue;
  const m = c.match(/[يك]/g);
  if (m) { arabicHits += m.length; if (arabicFiles.length < 8) arabicFiles.push(`${relative(root, f)} (${m.length})`); }
}
info.arabicCharOccurrences = arabicHits;
if (arabicHits > 0) {
  add('error', 'arabic-chars', `${arabicHits} Arabic ي/ك occurrences in source files: ${arabicFiles.join(', ')}`, 'references/permalinks-and-slugs.md §3');
}

// ------------------------------------------------------- 4. robots.txt

const robotsPath = join(root, 'robots.txt');
if (existsSync(robotsPath)) {
  const r = read(robotsPath);
  info.robotsTxt = 'static file present';
  if (/^\s*Disallow:\s*\/\s*$/mi.test(r)) {
    add('error', 'robots-blocks-all', 'robots.txt contains "Disallow: /" — the whole site is blocked from crawling', 'references/rtl-technical-seo.md §4');
  }
  if (/Disallow:\s*\/wp-content\/?\s*$/mi.test(r)) {
    add('error', 'robots-blocks-assets', 'robots.txt blocks /wp-content/ — CSS/JS become unreachable and rendering breaks', 'references/rtl-technical-seo.md §4');
  }
  if (!/Sitemap:/i.test(r)) {
    add('warn', 'robots-no-sitemap', 'robots.txt declares no Sitemap', 'references/rtl-technical-seo.md §4');
  }
} else {
  info.robotsTxt = 'none (WordPress serves a virtual robots.txt)';
}

// ------------------------------------------- 5. SEO plugin / duplicates

const pluginsDir = join(root, 'wp-content/plugins');
let plugins = [];
if (existsSync(pluginsDir)) {
  try { plugins = readdirSync(pluginsDir); } catch { plugins = []; }
}
const seoPlugins = plugins.filter((p) => /wordpress-seo|seo-by-rank-math|all-in-one-seo|wp-seopress|the-seo-framework/.test(p));
info.seoPlugins = seoPlugins;
if (seoPlugins.length > 1) {
  add('error', 'multiple-seo-plugins', `more than one SEO plugin installed: ${seoPlugins.join(', ')} — duplicate meta and schema`, 'SKILL.md §1');
}
const sitemapPlugins = plugins.filter((p) => /google-sitemap|xml-sitemap/.test(p));
if (sitemapPlugins.length && seoPlugins.length) {
  add('warn', 'duplicate-sitemaps', `sitemap plugin (${sitemapPlugins.join(', ')}) alongside an SEO plugin`, 'references/rtl-technical-seo.md §3');
}
const maintenance = plugins.filter((p) => /coming-soon|maintenance|under-construction/.test(p));
if (maintenance.length) {
  add('warn', 'maintenance-plugin', `maintenance/coming-soon plugin present: ${maintenance.join(', ')} — verify it is disabled`, 'references/indexing-troubleshooting.md §4');
}
const jalali = plugins.filter((p) => /jalali|shamsi|persian-date|wp-parsidate/.test(p));
info.jalaliPlugins = jalali;
if (jalali.length) {
  add('warn', 'jalali-dates', `Jalali date plugin present (${jalali.join(', ')}) — verify schema/sitemap dates stay Gregorian ISO 8601`, 'references/schema-persian.md §5');
}

// -------------------------------------------------------- 6. live checks

async function liveChecks(base) {
  const out = {};
  const get = async (u, headers = {}) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(u, { signal: ctrl.signal, redirect: 'follow', headers });
      const body = await res.text();
      return { status: res.status, headers: res.headers, body };
    } catch (e) {
      return { error: e.message };
    } finally { clearTimeout(t); }
  };

  const home = await get(base);
  if (home.error) {
    add('warn', 'live-skipped', `could not reach ${base}: ${home.error}`, '');
    return { reachable: false };
  }
  out.status = home.status;

  const htmlTag = home.body.match(/<html[^>]*>/i);
  out.htmlTag = htmlTag ? htmlTag[0].slice(0, 120) : null;
  if (htmlTag) {
    if (!/lang\s*=\s*["']fa/i.test(htmlTag[0])) {
      add('error', 'live-lang', `<html> lang is not fa-*: ${htmlTag[0].slice(0, 80)}`, 'references/rtl-technical-seo.md §1');
    }
    if (!/dir\s*=\s*["']rtl["']/i.test(htmlTag[0])) {
      add('error', 'live-dir', '<html> has no dir="rtl"', 'references/rtl-technical-seo.md §1');
    }
  }

  const xrt = home.headers.get('x-robots-tag');
  if (xrt && /noindex/i.test(xrt)) {
    add('error', 'live-noindex-header', `X-Robots-Tag: ${xrt}`, 'references/indexing-troubleshooting.md §1');
  }
  const metaRobots = home.body.match(/<meta[^>]+name=["']robots["'][^>]*>/i);
  out.metaRobots = metaRobots ? metaRobots[0] : null;
  if (metaRobots && /noindex/i.test(metaRobots[0])) {
    add('error', 'live-noindex-meta', `meta robots noindex on the home page: ${metaRobots[0]}`, 'references/indexing-troubleshooting.md §4');
  }

  const canonicals = home.body.match(/rel=["']canonical["']/gi) || [];
  out.canonicalCount = canonicals.length;
  if (canonicals.length === 0) add('warn', 'live-canonical', 'no canonical link on the home page', 'references/rtl-technical-seo.md §5');
  if (canonicals.length > 1) add('error', 'live-canonical-dup', `${canonicals.length} canonical tags on one page`, 'references/indexing-troubleshooting.md §5');

  const title = home.body.match(/<title[^>]*>([^<]*)<\/title>/i);
  out.title = title ? title[1].trim() : null;
  if (out.title && out.title.length > 65) {
    add('warn', 'live-title-length', `home title is ${out.title.length} characters (target 50–60)`, 'references/onpage-persian.md §1');
  }
  const desc = home.body.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  out.metaDescription = desc ? desc[1].trim() : null;
  if (!out.metaDescription) {
    add('warn', 'live-no-description', 'no meta description on the home page', 'references/onpage-persian.md §2');
  } else if (out.metaDescription.length > 170 || out.metaDescription.length < 100) {
    add('warn', 'live-description-length', `meta description is ${out.metaDescription.length} characters (target 140–160)`, 'references/onpage-persian.md §2');
  }

  const h1s = home.body.match(/<h1[\s>]/gi) || [];
  out.h1Count = h1s.length;
  if (h1s.length > 1) add('warn', 'live-multiple-h1', `${h1s.length} H1 tags`, 'references/onpage-persian.md §3');

  const ld = home.body.match(/application\/ld\+json/gi) || [];
  out.jsonLdBlocks = ld.length;

  const ogImage = /property=["']og:image["']/i.test(home.body);
  if (!ogImage) add('warn', 'live-no-og-image', 'no og:image on the home page', 'featured-image-art-direction/references/wordpress-sizing.md §6');

  const charset = home.headers.get('content-type') || '';
  if (charset && !/utf-8/i.test(charset)) {
    add('error', 'live-charset', `Content-Type is "${charset}" — Persian text needs UTF-8`, 'references/rtl-technical-seo.md');
  }

  // Jalali leaking into schema
  const jalaliDate = home.body.match(/"date(?:Published|Modified)":"(1[34]\d{2}-\d{2}-\d{2}[^"]*)"/);
  if (jalaliDate) {
    add('error', 'jalali-in-schema', `schema date looks Jalali: ${jalaliDate[1]}`, 'references/schema-persian.md §5');
  }

  // robots.txt
  const rob = await get(new URL('/robots.txt', base).href);
  if (!rob.error && rob.status === 200) {
    out.robotsTxt = rob.body.slice(0, 400);
    if (/^\s*Disallow:\s*\/\s*$/mi.test(rob.body)) {
      add('error', 'live-robots-all', 'live robots.txt contains "Disallow: /"', 'references/rtl-technical-seo.md §4');
    }
    if (!/Sitemap:/i.test(rob.body)) {
      add('warn', 'live-robots-sitemap', 'live robots.txt declares no Sitemap', 'references/rtl-technical-seo.md §4');
    }
  }

  // sitemap
  for (const sp of ['/wp-sitemap.xml', '/sitemap_index.xml', '/sitemap.xml']) {
    const s = await get(new URL(sp, base).href);
    if (!s.error && s.status === 200 && /<(sitemap|url)/i.test(s.body)) {
      out.sitemap = sp;
      break;
    }
  }
  if (!out.sitemap) add('warn', 'live-no-sitemap', 'no sitemap found at the usual paths', 'references/rtl-technical-seo.md §3');

  // Googlebot access
  const gb = await get(base, { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' });
  if (!gb.error) {
    out.googlebotStatus = gb.status;
    if (gb.status !== 200 && home.status === 200) {
      add('error', 'googlebot-blocked', `Googlebot UA gets ${gb.status} while a normal UA gets ${home.status}`, 'references/indexing-troubleshooting.md §8');
    }
  }

  return { reachable: true, ...out };
}

// ------------------------------------------------------------- run + out

const liveInfo = url ? await liveChecks(url.replace(/\/+$/, '') + '/') : { skipped: 'no --url supplied' };
info.live = liveInfo;

const errors = findings.filter((f) => f.level === 'error');
const warnings = findings.filter((f) => f.level === 'warn');

if (asJson) {
  console.log(JSON.stringify({ root, url: url || null, info, findings, errors: errors.length, warnings: warnings.length }, null, 2));
} else {
  console.log(`\nPersian WordPress SEO audit — root: ${root}${url ? `  url: ${url}` : ''}\n`);
  console.log('  themes:', (info.themes || []).join(', ') || '—');
  console.log('  SEO plugins:', (info.seoPlugins || []).join(', ') || '—');
  console.log('  Arabic ي/ك occurrences:', info.arabicCharOccurrences ?? '—');
  if (liveInfo.reachable) {
    console.log('  live:', `status ${liveInfo.status}`, '|', liveInfo.htmlTag || 'no <html> tag');
    console.log('  title:', liveInfo.title ? `${liveInfo.title.slice(0, 70)} (${liveInfo.title.length} chars)` : '—');
    console.log('  sitemap:', liveInfo.sitemap || '—', '| canonical tags:', liveInfo.canonicalCount, '| JSON-LD blocks:', liveInfo.jsonLdBlocks);
  } else if (liveInfo.skipped) {
    console.log('  live: skipped (pass --url to enable)');
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
