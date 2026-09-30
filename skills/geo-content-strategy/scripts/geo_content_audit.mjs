#!/usr/bin/env node
/**
 * geo_content_audit.mjs — ممیزی مجموعه‌ی محتوای جغرافیایی (استان/شهرستان/جاذبه) پیش از انتشار.
 *
 * چیزی که می‌سنجد، همان چیزی است که سایت‌های «پوشش کامل» را زمین می‌زند:
 * نشت لینک بیرونی، تک‌منبعی بودن، چگالی ارجاع، H1 دوتایی، بویلرپلیت مشترک،
 * لینک داخلی مرده، و نسبت واژه‌های یکتا.
 *
 * ورودی‌های پشتیبانی‌شده (خودکار تشخیص داده می‌شوند):
 *   --dir <path>     پوشه‌ای که در آن JSON بسته‌های درون‌ریز یا فایل‌های .md یا .html هست
 *   --json           خروجی ماشین‌خوان
 *   --site <host>    دامنه‌ی خودی (برای تفکیک لینک داخلی/بیرونی). پیش‌فرض: از داده حدس می‌زند
 *   --top <n>        چند مورد بدترین را چاپ کند (پیش‌فرض ۱۰)
 *
 * خروج: 0 اگر هیچ ERROR نباشد، 1 اگر باشد.
 *
 * بدون وابستگی. فقط خواندنی.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

/* ---------------------------------------------------------------- آستانه‌ها */
const T = {
  extLinksPerArticle: 5,      // بیش از این = ERROR
  extToIntRatio: 1.0,         // بیرونی/داخلی بیش از این = ERROR
  domainConcentration: 0.40,  // سهم یک دامنه از کل ارجاع‌ها
  citesPer100Words: 8,        // چگالی ارجاع
  minWords: 700,
  minInternalLinks: 6,
  maxBoilerplateShare: 0.12,  // سهم ۸-گرم‌های مشترک
  minWindowTTR: 0.45,        // تنوع واژگان در پنجره‌ی ۵۰۰ واژه‌ای (مستقل از طول متن)
};

/* ------------------------------------------------------------------ ابزارها */
const args = process.argv.slice(2);
const opt = (name, def = null) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true);
};
const has = (name) => args.includes(`--${name}`);

const stripTags = (s) => s.replace(/<[^>]*>/g, ' ');
const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, ' ');
const words = (s) =>
  stripTags(stripComments(s))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/[\u06F0-\u06F9\u0660-\u06690-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      if (/^(node_modules|\.git|vendor|assets|images?)$/i.test(e)) continue;
      walk(p, out);
    } else out.push(p);
  }
  return out;
}

/* -------------------------------------------------------------- جمع‌آوری داده */
/** @typedef {{id:string, title:string, html:string, source:string}} Doc */

function docsFromImporterJson(file) {
  /** @type {Doc[]} */
  const out = [];
  let data;
  try { data = JSON.parse(readFileSync(file, 'utf8')); } catch { return out; }
  const buckets = [];
  const collect = (v) => {
    if (Array.isArray(v)) { if (v.some((x) => x && typeof x === 'object' && x.post)) buckets.push(v); return; }
    if (v && typeof v === 'object') { if (v.post && (v.post.content_html || v.post.content)) buckets.push([v]); else Object.values(v).forEach(collect); }
  };
  collect(data);
  for (const b of buckets) {
    for (const it of b) {
      const html = (it.post && (it.post.content_html || it.post.content)) || '';
      if (!html) continue;
      out.push({
        id: it.slug || (it.post && it.post.title) || 'unknown',
        title: (it.post && it.post.title) || it.title || '',
        html,
        source: file,
      });
    }
  }
  return out;
}

function docsFromMarkdown(file) {
  const raw = readFileSync(file, 'utf8');
  // بلوک ARTICLE اگر بود، وگرنه کل فایل
  const m = raw.match(/===\s*BLOCK 3: ARTICLE[^\n]*\n([\s\S]*?)(?:\n===\s*BLOCK 4|$)/);
  const body = m ? m[1] : raw;
  const html = body
    .replace(/<sup[^>]*>\s*\[([^\]]+)\]\(([^)]+)\)\s*<\/sup>/g, '<sup class="cite"><a href="$2">$1</a></sup>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  return [{ id: basename(file, extname(file)), title: '', html, source: file }];
}

function docsFromHtml(file) {
  return [{ id: basename(file, extname(file)), title: '', html: readFileSync(file, 'utf8'), source: file }];
}

/* ------------------------------------------------------------------ تحلیل سند */
function analyse(doc, selfHosts) {
  const html = doc.html;
  const anchors = [...html.matchAll(/<a\s([^>]*?)>/gi)].map((m) => m[1]);
  const hrefs = anchors.map((a) => (a.match(/href=["']([^"']+)["']/i) || [, ''])[1]).filter(Boolean);
  const isExternal = (h) => /^https?:\/\//i.test(h) && !selfHosts.some((d) => h.includes(d));
  const ext = hrefs.filter(isExternal);
  const int = hrefs.filter((h) => !isExternal(h));
  const nofollow = anchors.filter((a) => /rel=["'][^"']*nofollow/i.test(a)).length;
  const domains = {};
  for (const h of ext) {
    const d = (h.match(/^https?:\/\/([^/]+)/i) || [, '?'])[1].replace(/^www\./, '');
    domains[d] = (domains[d] || 0) + 1;
  }
  const w = words(html);
  const h1 = (html.match(/<h1[\s>]/gi) || []).length;
  return {
    id: doc.id,
    title: doc.title,
    source: doc.source,
    words: w.length,
    tokens: w,
    ext: ext.length,
    int: int.length,
    nofollow,
    h1,
    domains,
    intTargets: int.filter((h) => h.startsWith('/')),
  };
}

/* ------------------------------------------------------------------- اجرا */
const dir = opt('dir', '.');
const topN = Number(opt('top', 10)) || 10;
const files = walk(dir);

/** @type {Doc[]} */
let docs = [];
for (const f of files) {
  const e = extname(f).toLowerCase();
  if (e === '.json' && /(data|packages?)\//.test(f.replace(/\\/g, '/'))) docs = docs.concat(docsFromImporterJson(f));
  else if (e === '.json' && /importer|package|content/i.test(f)) docs = docs.concat(docsFromImporterJson(f));
  else if (e === '.md' && !/readme|status|changelog/i.test(basename(f))) docs = docs.concat(docsFromMarkdown(f));
  else if (e === '.html' || e === '.htm') docs = docs.concat(docsFromHtml(f));
}
// یکتاسازی بر اساس شناسه — بسته‌های درون‌ریز نسخه‌های تکراری دارند؛ بلندترین را نگه می‌داریم
const seen = new Map();
for (const d of docs) {
  const prev = seen.get(d.id);
  if (!prev || d.html.length > prev.html.length) seen.set(d.id, d);
}
docs = [...seen.values()];

if (!docs.length) {
  console.error(`هیچ سندی در «${dir}» پیدا نشد. مسیر بسته‌های درون‌ریز، .md یا .html را بدهید.`);
  process.exit(2);
}

// دامنه‌ی خودی
let selfHosts = [];
const siteOpt = opt('site');
if (typeof siteOpt === 'string') selfHosts = [siteOpt.replace(/^https?:\/\//, '').replace(/\/$/, '')];

const A = docs.map((d) => analyse(d, selfHosts));

/* --- بویلرپلیت: ۸-گرم‌های مشترک --- */
const gramCount = new Map();
const perDocGrams = new Map();
for (const a of A) {
  const s = new Set();
  for (let i = 0; i + 8 <= a.tokens.length; i++) s.add(a.tokens.slice(i, i + 8).join(' '));
  perDocGrams.set(a.id, s);
  for (const g of s) gramCount.set(g, (gramCount.get(g) || 0) + 1);
}
const shareThreshold = Math.max(3, Math.ceil(A.length * 0.05));
for (const a of A) {
  const s = perDocGrams.get(a.id);
  let shared = 0;
  for (const g of s) if ((gramCount.get(g) || 0) >= shareThreshold) shared++;
  a.boilerplate = s.size ? shared / s.size : 0;
  // TTR پنجره‌ای: میانگین نسبت واژه‌ی یکتا در پنجره‌های ۵۰۰تایی — برخلاف TTR ساده به طول متن حساس نیست
  const W = 500;
  if (a.tokens.length < W) {
    a.windowTTR = a.tokens.length ? new Set(a.tokens).size / a.tokens.length : 1;
  } else {
    let acc = 0, n = 0;
    for (let i = 0; i + W <= a.tokens.length; i += W) { acc += new Set(a.tokens.slice(i, i + W)).size / W; n++; }
    a.windowTTR = n ? acc / n : 1;
  }
}

/* --- لینک داخلی مرده --- */
const knownSlugs = new Set(A.map((a) => a.id));
for (const a of A) {
  a.deadInternal = a.intTargets.filter((h) => {
    const m = h.match(/^\/[a-z_-]+\/([^/?#]+)\/?$/i);
    return m && !knownSlugs.has(m[1]);
  }).length;
}

/* --------------------------------------------------------------- جمع‌بندی کل */
const sum = (f) => A.reduce((n, a) => n + f(a), 0);
const totalExt = sum((a) => a.ext);
const totalInt = sum((a) => a.int);
const allDomains = {};
for (const a of A) for (const [d, c] of Object.entries(a.domains)) allDomains[d] = (allDomains[d] || 0) + c;
const domainsSorted = Object.entries(allDomains).sort((x, y) => y[1] - x[1]);
const topDomainShare = totalExt ? (domainsSorted[0] ? domainsSorted[0][1] / totalExt : 0) : 0;

/* ------------------------------------------------------------------ یافته‌ها */
const findings = [];
const add = (level, code, msg, hint) => findings.push({ level, code, msg, hint });

if (totalInt === 0 || totalExt / Math.max(1, totalInt) > T.extToIntRatio) {
  add('ERROR', 'link-economy',
    `نسبت لینک بیرونی به داخلی ${(totalExt / Math.max(1, totalInt)).toFixed(1)}:۱ است (${totalExt} بیرونی در برابر ${totalInt} داخلی). هر صفحه بیشتر از آن‌که به خودش وزن بدهد، به بیرون می‌دهد.`,
    'references/link-economy.md §۱');
}
const badExt = A.filter((a) => a.ext > T.extLinksPerArticle);
if (badExt.length) {
  add('ERROR', 'outbound-flood',
    `${badExt.length} مقاله بیش از ${T.extLinksPerArticle} لینک بیرونی در متن دارند (میانگین ${(sum((a) => a.ext) / A.length).toFixed(0)}، بیشینه ${Math.max(...A.map((a) => a.ext))}).`,
    'references/citation-policy.md §۲');
}
if (sum((a) => a.nofollow) === 0 && totalExt > 0) {
  add('ERROR', 'no-nofollow',
    `هیچ‌کدام از ${totalExt} لینک بیرونی rel="nofollow" ندارند. همه dofollow هستند.`,
    'references/link-economy.md §۲');
}
if (topDomainShare > T.domainConcentration) {
  add('ERROR', 'single-source',
    `${(topDomainShare * 100).toFixed(0)}٪ از ارجاع‌ها به یک دامنه (${domainsSorted[0][0]}) است. این یعنی محتوا مشتق‌شده است، نه تولیدشده.`,
    'references/information-gain.md §۱');
}
const dense = A.filter((a) => a.words && (a.ext / a.words) * 100 > T.citesPer100Words);
if (dense.length) {
  add('warn', 'cite-density',
    `${dense.length} مقاله بیش از ${T.citesPer100Words} ارجاع در هر ۱۰۰ واژه دارند؛ متن زیر بار پانویس گم می‌شود.`,
    'references/citation-policy.md §۳');
}
const dupH1 = A.filter((a) => a.h1 >= 1);
if (dupH1.length) {
  add('ERROR', 'h1-in-content',
    `${dupH1.length} مقاله داخل بدنه H1 دارند. اگر قالب هم عنوان را H1 می‌زند، هر صفحه دو H1 متفاوت دارد.`,
    'references/entity-vs-page.md §۳');
}
const thin = A.filter((a) => a.words < T.minWords);
if (thin.length) add('warn', 'thin', `${thin.length} مقاله زیر ${T.minWords} واژه‌اند.`, 'references/information-gain.md §۳');
const lowInt = A.filter((a) => a.int < T.minInternalLinks);
if (lowInt.length) add('warn', 'low-internal', `${lowInt.length} مقاله کمتر از ${T.minInternalLinks} لینک داخلی دارند.`, 'references/link-economy.md §۳');
const boiler = A.filter((a) => a.boilerplate > T.maxBoilerplateShare);
if (boiler.length) add('warn', 'boilerplate', `${boiler.length} مقاله بیش از ${(T.maxBoilerplateShare * 100).toFixed(0)}٪ متن مشترک با بقیه دارند.`, 'references/information-gain.md §۲');
const dead = A.filter((a) => a.deadInternal > 0);
if (dead.length) add('ERROR', 'dead-internal', `${dead.length} مقاله مجموعاً ${sum((a) => a.deadInternal)} لینک داخلی به نامکی می‌دهند که در این مجموعه وجود ندارد.`, 'references/publish-gate-that-ships.md §۲');
const lowUnique = A.filter((a) => a.windowTTR < T.minWindowTTR);
if (lowUnique.length) add('warn', 'repetitive', `${lowUnique.length} مقاله تنوع واژگان زیر ${(T.minWindowTTR * 100).toFixed(0)}٪ دارند (تکرار زیاد در پنجره‌ی ۵۰۰ واژه‌ای).`, 'references/information-gain.md §۲');

/* -------------------------------------------------------------------- خروجی */
const report = {
  dir,
  articles: A.length,
  totals: {
    words: sum((a) => a.words),
    avgWords: Math.round(sum((a) => a.words) / A.length),
    externalLinks: totalExt,
    internalLinks: totalInt,
    nofollow: sum((a) => a.nofollow),
    extPerArticle: +(totalExt / A.length).toFixed(1),
    intPerArticle: +(totalInt / A.length).toFixed(1),
    topDomainShare: +(topDomainShare * 100).toFixed(1),
    avgBoilerplate: +((sum((a) => a.boilerplate) / A.length) * 100).toFixed(1),
    articlesWithContentH1: dupH1.length,
  },
  domains: domainsSorted.slice(0, 10),
  findings,
  worst: {
    byExternal: [...A].sort((x, y) => y.ext - x.ext).slice(0, topN).map((a) => ({ id: a.id, ext: a.ext, int: a.int, words: a.words })),
    byBoilerplate: [...A].sort((x, y) => y.boilerplate - x.boilerplate).slice(0, topN).map((a) => ({ id: a.id, boilerplate: +(a.boilerplate * 100).toFixed(1) })),
  },
};

if (has('json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const t = report.totals;
  console.log(`\nممیزی محتوای جغرافیایی — ${report.articles} مقاله در «${dir}»\n`);
  console.log(`  واژه: ${t.words.toLocaleString('fa-IR')} (میانگین ${t.avgWords.toLocaleString('fa-IR')})`);
  console.log(`  لینک بیرونی: ${t.externalLinks.toLocaleString('fa-IR')}  (میانگین ${t.extPerArticle} در هر مقاله، ${t.nofollow} تای آن nofollow)`);
  console.log(`  لینک داخلی : ${t.internalLinks.toLocaleString('fa-IR')}  (میانگین ${t.intPerArticle} در هر مقاله)`);
  console.log(`  تمرکز منبع : ${t.topDomainShare}٪ روی ${domainsSorted[0] ? domainsSorted[0][0] : '—'}`);
  console.log(`  متن مشترک  : ${t.avgBoilerplate}٪ میانگین`);
  console.log(`  H1 در بدنه : ${t.articlesWithContentH1} مقاله\n`);

  console.log('  دامنه‌های ارجاع‌شده:');
  for (const [d, c] of domainsSorted.slice(0, 6)) console.log(`    ${String(c).padStart(6)}×  ${d}`);
  console.log('');

  for (const f of findings) {
    const tag = f.level === 'ERROR' ? 'ERROR ' : 'warn  ';
    console.log(`  ${tag} [${f.code}] ${f.msg}`);
    console.log(`         → ${f.hint}`);
  }
  if (!findings.length) console.log('  ✓ هیچ ایرادی پیدا نشد.');

  console.log('\n  بدترین‌ها از نظر لینک بیرونی:');
  for (const w of report.worst.byExternal.slice(0, 6)) {
    console.log(`    ${w.id.padEnd(24)} بیرونی=${String(w.ext).padStart(3)}  داخلی=${String(w.int).padStart(3)}  واژه=${w.words}`);
  }
  const errs = findings.filter((f) => f.level === 'ERROR').length;
  console.log(`\n  ${errs} خطا · ${findings.length - errs} هشدار\n`);
}

process.exit(findings.some((f) => f.level === 'ERROR') ? 1 : 0);
