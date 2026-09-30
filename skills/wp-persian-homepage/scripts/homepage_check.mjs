#!/usr/bin/env node
/**
 * homepage_check.mjs — audit a Persian WordPress homepage.
 *
 * Usage:
 *   node homepage_check.mjs [--root .] [--url https://example.ir] [--file front-page.html] [--json]
 *
 * Static: front-page/home templates, Query Loop config (inherit, no-results),
 * inline styles in block markup, unescaped strings, banned Persian copy.
 * Live (--url): heading hierarchy, CTA wording and count, section count,
 * RTL attributes, image dimensions, LCP hints, homepage SEO fields.
 *
 * Exit codes: 0 = no errors, 1 = errors found, 2 = usage/IO problem.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ZWNJ = '\u200c';

const BANNED_COPY = [
  'به وبسایت ما خوش آمدید', 'به سایت ما خوش آمدید', 'خوش آمدید',
  'با سال' + ZWNJ + 'ها تجربه', 'با سالها تجربه',
  'راهکار جامع', 'تیم متخصص و مجرب', 'رضایت مشتری اولویت',
  'بهترین خدمات', 'حرفه' + ZWNJ + 'ای' + ZWNJ + 'ترین', 'برترین',
  'جهت کسب اطلاعات بیشتر', 'با ما در ارتباط باشید',
  'کیفیت، سرعت، قیمت مناسب', 'می' + ZWNJ + 'باشد', 'می باشد',
];

const WEAK_CTA = [
  'بیشتر بدانید', 'اطلاعات بیشتر', 'کلیک کنید', 'اینجا کلیک کنید',
  'مشاهده', 'ادامه', 'ارسال', 'بیشتر', 'جزئیات', 'ثبت',
];

const argv = process.argv.slice(2);
const flag = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
const root = flag('root') || '.';
const url = flag('url');
const file = flag('file');
const asJson = argv.includes('--json');

if (!existsSync(root)) {
  console.error(`root not found: ${root}`);
  process.exit(2);
}

const findings = [];
const add = (level, rule, message, hint) => findings.push({ level, rule, message, hint });
const info = {};
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

function walk(dir, { maxDepth = 5, skip = /node_modules|\.git|uploads/ } = {}, depth = 0, out = []) {
  if (depth > maxDepth || !existsSync(dir)) return out;
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    if (skip.test(p)) continue;
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, { maxDepth, skip }, depth + 1, out);
    else out.push(p);
  }
  return out;
}

// ------------------------------------------------- 1. locate templates

const candidates = [];
if (file) {
  candidates.push(join(root, file));
} else {
  const themesDir = join(root, 'wp-content/themes');
  const themeRoots = existsSync(themesDir)
    ? readdirSync(themesDir).map((d) => join(themesDir, d)).filter((d) => { try { return statSync(d).isDirectory(); } catch { return false; } })
    : existsSync(join(root, 'style.css')) || existsSync(join(root, 'theme.json')) ? [root] : [];
  for (const t of themeRoots) {
    for (const rel of ['templates/front-page.html', 'templates/home.html', 'front-page.php', 'home.php']) {
      const p = join(t, rel);
      if (existsSync(p)) candidates.push(p);
    }
    const patternsDir = join(t, 'patterns');
    if (existsSync(patternsDir)) {
      for (const p of walk(patternsDir, { maxDepth: 2 })) {
        if (/\.(php|html)$/.test(p) && /home|front|hero/i.test(p)) candidates.push(p);
      }
    }
  }
}
info.templates = candidates.map((c) => relative(root, c));

if (candidates.length === 0) {
  add('warn', 'no-template', 'no front-page/home template found — pass --file or run from the site root', 'references/homepage-strategy.md §2');
}

// both front-page.html and home.html in the same theme
const byTheme = {};
for (const c of candidates) {
  const m = c.match(/themes\/([^/]+)\//);
  const key = m ? m[1] : 'theme';
  byTheme[key] = byTheme[key] || [];
  byTheme[key].push(relative(root, c));
}
for (const [t, list] of Object.entries(byTheme)) {
  const hasFront = list.some((f) => /front-page\.(html|php)$/.test(f));
  const hasHome = list.some((f) => /home\.(html|php)$/.test(f));
  if (hasFront && hasHome) {
    add('warn', 'template-precedence', `${t}: both front-page and home templates exist — front-page always wins and Settings → Reading is ignored`, 'references/homepage-strategy.md §2');
  }
}

// ----------------------------------------------- 2. static template QA

let markup = '';
for (const c of candidates) markup += '\n' + read(c);
info.templateBytes = markup.length;

if (markup.trim()) {
  // Query Loop checks
  const queries = [...markup.matchAll(/<!--\s*wp:query\s+({[\s\S]*?})\s*-->/g)];
  info.queryLoops = queries.length;
  for (const q of queries) {
    let cfg = null;
    try { cfg = JSON.parse(q[1]); } catch { /* attribute JSON may be truncated by the regex */ }
    if (cfg && cfg.query && cfg.query.inherit !== false) {
      add('error', 'query-inherit', 'a wp:query on the homepage does not set "inherit":false — it will inherit the main query', 'references/content-sections.md §1');
    }
    if (cfg && cfg.query && typeof cfg.query.perPage === 'number' && cfg.query.perPage > 12) {
      add('warn', 'query-perpage', `wp:query perPage is ${cfg.query.perPage} — keep homepage loops small`, 'references/content-sections.md §10');
    }
  }
  const noResults = (markup.match(/wp:query-no-results/g) || []).length;
  if (queries.length > 0 && noResults < queries.length) {
    add('error', 'no-empty-state', `${queries.length} Query Loop(s) but only ${noResults} query-no-results block(s) — the section breaks on an empty site`, 'references/content-sections.md §5');
  }
  if (queries.length > 2) {
    add('warn', 'many-queries', `${queries.length} Query Loops on the homepage — each is an extra database query`, 'references/content-sections.md §10');
  }

  // inline styles / custom classes in block markup
  const inlineStyleTags = (markup.match(/<style[\s>]/gi) || []).length;
  if (inlineStyleTags > 0) {
    add('error', 'inline-style-tag', `${inlineStyleTags} <style> tag(s) in block markup — use theme.json presets`, 'wp-patterns/SKILL.md guardrail 1');
  }

  // unescaped output in PHP templates/patterns
  const phpEcho = [...markup.matchAll(/<\?php\s+(?:echo|print)\s+(?!esc_)/g)].length;
  if (phpEcho > 0) {
    add('warn', 'unescaped-output', `${phpEcho} echo/print without an esc_* function`, 'references/persian-copywriting.md §11');
  }
  // hardcoded absolute URLs
  const hardcoded = [...markup.matchAll(/(?:src|href)=["']https?:\/\/(?!schema\.org)[^"']+["']/g)].length;
  if (hardcoded > 3) {
    add('warn', 'hardcoded-urls', `${hardcoded} absolute URLs in the template — use get_theme_file_uri()`, 'wp-patterns/SKILL.md guardrail 6');
  }

  // banned Persian copy — report only the longest match, not its substrings
  const hitsStatic = BANNED_COPY.filter((p) => markup.includes(p))
    .sort((a, b) => b.length - a.length)
    .filter((p, i, arr) => !arr.slice(0, i).some((longer) => longer.includes(p)));
  for (const phrase of hitsStatic) {
    add('error', 'banned-copy', `banned homepage phrase: «${phrase}»`, 'references/persian-copywriting.md §8');
  }

  // Arabic characters
  const arabic = (markup.match(/[يك]/g) || []).length;
  if (arabic > 0) {
    add('error', 'arabic-chars', `${arabic} Arabic ي/ك characters in the template`, 'references/typography-and-spacing.md');
  }

  // letter-spacing on Persian
  if (/letter-spacing\s*:\s*(?!0)/.test(markup)) {
    add('error', 'letter-spacing', 'letter-spacing is set — it breaks Persian letter joining', 'references/typography-and-spacing.md §3');
  }

  // h1 count in the template (html tag or block attribute, not both for one heading)
  const h1 = (markup.match(/<h1[\s>]/g) || []).length
    || (markup.match(/"level":\s*1\b/g) || []).length;
  info.templateH1 = h1;
  if (h1 > 1) {
    add('warn', 'multiple-h1-template', `${h1} level-1 headings in the template`, 'references/homepage-checklist.md');
  }
}

// ------------------------------------------------- 3. theme.json hints

const themesDir = join(root, 'wp-content/themes');
const themeJsons = existsSync(themesDir)
  ? readdirSync(themesDir).map((d) => join(themesDir, d, 'theme.json')).filter(existsSync)
  : existsSync(join(root, 'theme.json')) ? [join(root, 'theme.json')] : [];
for (const tj of themeJsons) {
  let json;
  try { json = JSON.parse(read(tj)); } catch { continue; }
  const typo = json?.styles?.typography;
  if (typo && typo.lineHeight && Number(typo.lineHeight) < 1.7) {
    add('warn', 'line-height', `${relative(root, tj)}: body lineHeight is ${typo.lineHeight} — Persian needs 1.8–2.0`, 'references/typography-and-spacing.md §2');
  }
  if (typo && typo.letterSpacing && typo.letterSpacing !== '0' && typo.letterSpacing !== '0px') {
    add('error', 'theme-letter-spacing', `${relative(root, tj)}: letterSpacing "${typo.letterSpacing}" breaks Persian`, 'references/typography-and-spacing.md §3');
  }
  const fs = json?.settings?.typography?.fontSizes || [];
  const body = fs.find((f) => /medium|body|normal/i.test(f.slug || ''));
  if (body && /^(\d+(?:\.\d+)?)px$/.test(body.size) && Number(RegExp.$1) < 17) {
    add('warn', 'body-font-size', `${relative(root, tj)}: body font size ${body.size} — Persian needs 17px+`, 'references/typography-and-spacing.md §1');
  }
}

// ------------------------------------------------------- 4. live checks

async function liveChecks(base) {
  const out = {};
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let res, body;
  try {
    res = await fetch(base, { signal: ctrl.signal, redirect: 'follow' });
    body = await res.text();
  } catch (e) {
    add('warn', 'live-skipped', `could not reach ${base}: ${e.message}`, '');
    return { reachable: false };
  } finally { clearTimeout(timer); }

  out.status = res.status;
  out.bytesKB = Math.round(new TextEncoder().encode(body).length / 1024);

  // RTL
  const htmlTag = (body.match(/<html[^>]*>/i) || [])[0] || '';
  out.htmlTag = htmlTag.slice(0, 120);
  if (!/dir\s*=\s*["']rtl["']/i.test(htmlTag)) {
    add('error', 'no-rtl', '<html> has no dir="rtl"', 'references/rtl-composition.md');
  }
  if (!/lang\s*=\s*["']fa/i.test(htmlTag)) {
    add('error', 'no-lang-fa', '<html> lang is not fa-*', 'wp-persian-seo/references/rtl-technical-seo.md §1');
  }

  // headings
  const headings = [...body.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => ({ level: Number(m[1][1]), text: m[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() }))
    .filter((h) => h.text.length > 0);
  out.headings = headings.map((h) => `h${h.level}: ${h.text.slice(0, 60)}`);
  const h1s = headings.filter((h) => h.level === 1);
  out.h1Count = h1s.length;
  if (h1s.length === 0) add('error', 'no-h1', 'no <h1> on the homepage', 'references/homepage-checklist.md');
  if (h1s.length > 1) add('error', 'multiple-h1', `${h1s.length} <h1> tags: ${h1s.map((h) => h.text.slice(0, 30)).join(' | ')}`, 'references/homepage-checklist.md');
  if (h1s.length === 1) {
    const words = h1s[0].text.split(/\s+/).filter(Boolean).length;
    out.h1Words = words;
    if (words > 12) add('warn', 'h1-long', `<h1> is ${words} words (target ≤ 9)`, 'references/persian-copywriting.md §1');
  }
  // heading level jumps
  let prev = 0;
  for (const h of headings) {
    if (prev && h.level > prev + 1) {
      add('warn', 'heading-jump', `heading level jumps h${prev} → h${h.level} at "${h.text.slice(0, 40)}"`, 'references/homepage-checklist.md');
      break;
    }
    prev = h.level;
  }

  // sections
  const sections = (body.match(/<section[\s>]/gi) || []).length
    || headings.filter((h) => h.level === 2).length;
  out.sectionCount = sections;
  if (sections > 9) add('warn', 'too-many-sections', `${sections} sections — the homepage is becoming a sitemap`, 'references/homepage-strategy.md §6');
  if (sections < 2) add('warn', 'too-few-sections', `only ${sections} section(s) detected`, 'references/section-patterns.md');

  // CTAs
  const buttons = [...body.matchAll(/<a[^>]*class=["'][^"']*(?:wp-block-button__link|btn|button)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  out.ctas = [...new Set(buttons)].slice(0, 12);
  if (buttons.length === 0) {
    add('warn', 'no-cta', 'no button-styled CTA found on the homepage', 'references/section-patterns.md §6');
  }
  if (new Set(buttons).size > 6) {
    add('warn', 'too-many-ctas', `${new Set(buttons).size} distinct CTA labels — pick one primary action`, 'references/homepage-strategy.md §5');
  }
  for (const b of new Set(buttons)) {
    if (WEAK_CTA.includes(b)) {
      add('warn', 'weak-cta', `vague CTA label: «${b}»`, 'references/persian-copywriting.md §3');
    }
  }

  // banned copy live — longest match only
  const hitsLive = BANNED_COPY.filter((p) => body.includes(p))
    .sort((a, b) => b.length - a.length)
    .filter((p, i, arr) => !arr.slice(0, i).some((longer) => longer.includes(p)));
  for (const phrase of hitsLive) {
    add('error', 'banned-copy-live', `banned phrase on the page: «${phrase}»`, 'references/persian-copywriting.md §8');
  }

  // Persian typography hazards
  const arabic = (body.match(/[يك]/g) || []).length;
  if (arabic > 0) add('warn', 'arabic-chars-live', `${arabic} Arabic ي/ك characters rendered on the page`, 'references/typography-and-spacing.md');
  const zwnj = (body.match(new RegExp(ZWNJ, 'g')) || []).length;
  out.zwnjCount = zwnj;
  if (zwnj === 0) add('warn', 'no-zwnj', 'no ZWNJ anywhere on the page — Persian half-spaces are probably missing or stripped', 'content-humanizer/references/persian-style.md §2');

  // images
  const imgs = body.match(/<img[^>]*>/gi) || [];
  const noDims = imgs.filter((t) => !/\bwidth=/i.test(t) || !/\bheight=/i.test(t));
  out.images = imgs.length;
  out.imagesWithoutDimensions = noDims.length;
  if (noDims.length) add('warn', 'img-no-dimensions', `${noDims.length}/${imgs.length} <img> without width/height — CLS risk`, 'references/homepage-checklist.md');
  const noAlt = imgs.filter((t) => !/\balt=/i.test(t));
  if (noAlt.length) add('error', 'img-no-alt', `${noAlt.length} <img> without an alt attribute`, 'references/homepage-checklist.md');

  const fp = (body.match(/fetchpriority=["']high["']/gi) || []).length;
  out.fetchPriorityHigh = fp;
  if (fp === 0) add('warn', 'no-fetchpriority', 'no fetchpriority="high" — the LCP image is not prioritised', 'wp-persian-speed/references/core-web-vitals-fa.md');
  if (fp > 1) add('warn', 'multiple-fetchpriority', `${fp} elements with fetchpriority="high" — only one should have it`, 'wp-persian-speed/references/core-web-vitals-fa.md');

  // first image lazy = LCP hazard
  const firstImg = imgs[0] || '';
  if (/loading=["']lazy["']/i.test(firstImg)) {
    add('warn', 'lazy-hero', 'the first <img> is lazy-loaded — if it is the LCP element, set loading="eager"', 'wp-persian-speed/references/core-web-vitals-fa.md');
  }

  // SEO essentials
  const title = (body.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1];
  out.title = title ? title.trim() : null;
  if (!out.title) add('error', 'no-title', 'no <title>', 'wp-persian-seo/references/onpage-persian.md §1');
  else if (out.title.length > 65) add('warn', 'title-long', `title is ${out.title.length} characters (target 50–60)`, 'wp-persian-seo/references/onpage-persian.md §1');

  const desc = (body.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || [])[1];
  out.metaDescription = desc || null;
  if (!desc) add('warn', 'no-description', 'no meta description', 'wp-persian-seo/references/onpage-persian.md §2');

  if (!/property=["']og:image["']/i.test(body)) add('warn', 'no-og-image', 'no og:image', 'featured-image-art-direction/references/wordpress-sizing.md §6');
  if (!/application\/ld\+json/i.test(body)) add('warn', 'no-schema', 'no JSON-LD structured data', 'wp-persian-seo/references/schema-persian.md');
  if (/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(body)) add('error', 'noindex', 'the homepage is noindex', 'wp-persian-seo/references/indexing-troubleshooting.md');

  if (out.bytesKB > 150) add('warn', 'large-html', `HTML is ${out.bytesKB} KB (budget 50 KB)`, 'wp-persian-speed/references/measurement.md §4');

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
  console.log(`\nPersian homepage check — root: ${root}${url ? `  url: ${url}` : ''}\n`);
  console.log(`  templates: ${info.templates.length ? info.templates.join(', ') : '—'}`);
  if (info.queryLoops !== undefined) console.log(`  query loops: ${info.queryLoops}`);
  if (live.reachable) {
    console.log(`  live: status ${live.status} | ${live.bytesKB} KB | h1 ${live.h1Count} | sections ${live.sectionCount} | images ${live.images}`);
    console.log(`  title: ${live.title ? `${live.title.slice(0, 70)} (${live.title.length})` : '—'}`);
    if (live.ctas?.length) console.log(`  CTAs: ${live.ctas.slice(0, 6).map((c) => `«${c}»`).join(' ')}`);
  } else if (live.skipped) {
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
