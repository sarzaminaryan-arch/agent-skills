#!/usr/bin/env node
/**
 * humanize_lint.mjs — detect machine-written prose signals in Markdown drafts.
 *
 * Usage:
 *   node humanize_lint.mjs <file.md> [--lang fa|en] [--json] [--quiet]
 *
 * Exit codes: 0 = no errors, 1 = errors found, 2 = usage/IO problem.
 *
 * Deterministic, dependency-free, read-only.
 */

import { readFileSync } from 'node:fs';

const ZWNJ = '\u200c';

const BANNED = {
  fa: {
    error: [
      'در دنیای امروز', 'در عصر حاضر', 'در دنیای پرشتاب', 'با پیشرفت روزافزون',
      'شایان ذکر است', 'لازم به ذکر است', 'در نهایت می' + ZWNJ + 'توان نتیجه گرفت',
      'در نهایت می توان نتیجه گرفت',
      'این مقاله به بررسی', 'امیدواریم این مطلب', 'امیدوارم این مطلب',
      'امیدواریم این مقاله', 'دنیای شگفت' + ZWNJ + 'انگیز', 'سفری هیجان' + ZWNJ + 'انگیز',
      'می' + ZWNJ + 'باشد', 'می باشد', 'میباشد',
      'می' + ZWNJ + 'گردد', 'می گردد', 'میگردد',
      'نمی' + ZWNJ + 'باشد', 'نمی باشد',
      'نقش بسزایی', 'از اهمیت بالایی برخوردار', 'بی' + ZWNJ + 'شک', 'بدون شک',
      'در ادامه به بررسی', 'همان' + ZWNJ + 'طور که می' + ZWNJ + 'دانید',
      'همانطور که میدانید', 'مورد بررسی قرار گرفت', 'مورد استفاده قرار می',
      'اقدام به', 'فوق' + ZWNJ + 'الذکر', 'بدین وسیله', 'در خصوص',
    ],
    warn: [
      'علاوه بر این', 'به علاوه', 'از سوی دیگر', 'به طور کلی', 'به' + ZWNJ + 'طور کلی',
      'در واقع', 'اساسا', 'اساساً', 'عملا', 'عملاً', 'به نوعی', 'تا حد زیادی',
      'چشمگیر', 'کلیدی', 'حیاتی', 'راهکار جامع', 'بی' + ZWNJ + 'نظیر',
      'منحصربه' + ZWNJ + 'فرد', 'قابل توجه', 'بسیار مهم', 'می' + ZWNJ + 'توان گفت',
      'جهت انجام', 'دارای',
    ],
  },
  en: {
    error: [
      'delve', 'tapestry', "in today's fast-paced", 'in todays fast-paced',
      "it's important to note", 'it is important to note', "it's worth noting",
      'it is worth noting', 'navigate the landscape', 'unlock the potential',
      'game-changer', 'game changer', 'robust solution', 'seamless experience',
      'cutting-edge', 'elevate your', 'dive deep', 'in conclusion',
      'i hope this helps', "let's explore", 'embark on a journey',
      'testament to', 'when it comes to', 'the world of',
    ],
    warn: [
      'moreover', 'furthermore', 'additionally', 'comprehensive', 'crucial',
      'vital', 'pivotal', 'significantly', 'foster', 'realm', 'landscape',
      'utilize', 'leverage', 'ensure', 'plethora', 'myriad', 'holistic',
    ],
  },
};

const CONNECTIVE_OPENERS = {
  fa: ['علاوه', 'همچنین', 'از سوی', 'به علاوه', 'در واقع', 'بنابراین', 'به طور', 'از طرف', 'با این'],
  en: ['moreover', 'furthermore', 'additionally', 'however', 'therefore', 'in addition', 'also', 'thus'],
};

const BANNED_HEADINGS = {
  fa: ['مقدمه', 'نتیجه گیری', 'نتیجه' + ZWNJ + 'گیری', 'جمع بندی', 'جمع' + ZWNJ + 'بندی', 'سخن پایانی', 'کلام آخر'],
  en: ['introduction', 'conclusion', 'final thoughts', 'wrapping up', 'summary', 'closing thoughts'],
};

// ---------------------------------------------------------------- parse args

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
const asJson = argv.includes('--json');
const quiet = argv.includes('--quiet');
const langFlagIdx = argv.indexOf('--lang');
let lang = langFlagIdx !== -1 ? argv[langFlagIdx + 1] : null;

if (!file) {
  console.error('usage: node humanize_lint.mjs <file.md> [--lang fa|en] [--json] [--quiet]');
  process.exit(2);
}

let raw;
try {
  raw = readFileSync(file, 'utf8');
} catch (err) {
  console.error(`cannot read ${file}: ${err.message}`);
  process.exit(2);
}

// ------------------------------------------------------------- prepare text

// Strip YAML front matter, fenced code, inline code, and link targets so that
// technical strings never trigger prose rules.
let body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
const headings = [...body.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((m) => ({
  level: m[1].length,
  text: m[2].trim(),
}));
const codeBlocks = (body.match(/```[\s\S]*?```/g) || []).length;
body = body
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/`[^`\n]*`/g, ' ')
  .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/^\s*\|.*\|\s*$/gm, ' '); // tables

if (!lang) {
  const persianChars = (body.match(/[\u0600-\u06FF]/g) || []).length;
  lang = persianChars > body.length * 0.15 ? 'fa' : 'en';
}
if (!BANNED[lang]) {
  console.error(`unsupported --lang "${lang}" (use fa or en)`);
  process.exit(2);
}

const prose = body
  .replace(/^#{1,6}\s+.*$/gm, ' ')
  .replace(/^\s*>\s?/gm, '');

const listLines = (body.match(/^\s*(?:[-*+]|\d+[.)])\s+\S/gm) || []).length;
const paragraphs = prose
  .split(/\n\s*\n/)
  .map((p) => p.replace(/\s+/g, ' ').trim())
  .filter((p) => p.length > 0 && !/^\s*(?:[-*+]|\d+[.)])\s/.test(p));

const sentences = prose
  .replace(/\n+/g, ' ')
  .split(/(?<=[.!?؟۔])\s+|(?<=\.)\s*$/u)
  .map((s) => s.trim())
  .filter((s) => s.split(/\s+/).filter(Boolean).length >= 2);

const words = prose.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
const wordCount = words.length;

// -------------------------------------------------------------- run checks

const findings = [];
const add = (level, rule, message, hint) =>
  findings.push({ level, rule, message, hint });

const lineOf = (index) => raw.slice(0, index).split('\n').length;

// 1. banned phrases
const haystack = lang === 'fa' ? prose : prose.toLowerCase();
for (const [level, list] of [['error', BANNED[lang].error], ['warn', BANNED[lang].warn]]) {
  for (const phrase of list) {
    const needle = lang === 'fa' ? phrase : phrase.toLowerCase();
    let count = 0;
    let from = 0;
    const hits = [];
    while (true) {
      const at = haystack.indexOf(needle, from);
      if (at === -1) break;
      count += 1;
      if (hits.length < 3) hits.push(lineOf(at));
      from = at + needle.length;
    }
    if (count === 0) continue;
    // warn-level phrases are allowed at low density (1 per 1000 words)
    const budget = level === 'warn' ? Math.max(1, Math.floor(wordCount / 1000)) : 0;
    if (count > budget) {
      add(
        level,
        'banned-phrase',
        `«${phrase}» ${count}× (حدود خط ${hits.join(', ')})`,
        'references/ai-tells.md §1',
      );
    }
  }
}

// 2. sentence rhythm
const lengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
let stdev = 0;
let mean = 0;
if (lengths.length >= 5) {
  mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  stdev = Math.sqrt(lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length);
  if (stdev < 4) {
    add('error', 'rhythm', `انحراف معیار طول جمله ${stdev.toFixed(1)} (حداقل ۶)`, 'references/rhythm-and-voice.md §2');
  } else if (stdev < 6) {
    add('warn', 'rhythm', `انحراف معیار طول جمله ${stdev.toFixed(1)} (هدف ≥ ۶)`, 'references/rhythm-and-voice.md §2');
  }
  const shortRatio = lengths.filter((l) => l <= 8).length / lengths.length;
  if (shortRatio < 0.1) {
    add('warn', 'rhythm', `فقط ${(shortRatio * 100).toFixed(0)}٪ جمله‌ها کوتاه‌اند (هدف ≥ ۱۵٪)`, 'references/rhythm-and-voice.md §2');
  }
  const longest = Math.max(...lengths);
  if (longest > 45) {
    add('warn', 'rhythm', `بلندترین جمله ${longest} کلمه است (حداکثر ۳۵)`, 'references/rhythm-and-voice.md §1');
  }
}

// 3. em-dash density
const emDashes = (prose.match(/—/g) || []).length;
const emBudget = Math.max(1, Math.round(wordCount / 500));
if (emDashes > emBudget) {
  add('warn', 'em-dash', `${emDashes} خط تیره‌ی بلند در ${wordCount} کلمه (حداکثر ${emBudget})`, 'references/ai-tells.md §3');
}

// 4. list-to-prose ratio
const proseLines = prose.split('\n').filter((l) => l.trim().length > 0).length;
if (proseLines > 0) {
  const ratio = listLines / (listLines + proseLines);
  if (ratio > 0.45) {
    add('error', 'list-ratio', `نسبت فهرست ${(ratio * 100).toFixed(0)}٪ (حداکثر ۳۰٪)`, 'references/structure-patterns.md');
  } else if (ratio > 0.3) {
    add('warn', 'list-ratio', `نسبت فهرست ${(ratio * 100).toFixed(0)}٪ (هدف < ۳۰٪)`, 'references/structure-patterns.md');
  }
}

// 5. triadic lists: "a, b and c" / "الف، ب و ج"
const triadRe = lang === 'fa'
  ? /[\p{L}\u200c]+\s*،\s*[\p{L}\u200c]+\s+و\s+[\p{L}\u200c]+/gu
  : /\b\w+,\s+\w+,?\s+and\s+\w+\b/gi;
const triads = (prose.match(triadRe) || []).length;
const triadBudget = Math.max(1, Math.round(wordCount / 500));
if (triads > triadBudget) {
  add('warn', 'triadic', `${triads} فهرست سه‌تایی (حداکثر ${triadBudget})`, 'references/ai-tells.md §2');
}

// 6. paragraph openers
if (paragraphs.length >= 4) {
  const openers = CONNECTIVE_OPENERS[lang];
  const hits = paragraphs.filter((p) => {
    const head = (lang === 'fa' ? p : p.toLowerCase()).slice(0, 24);
    return openers.some((o) => head.startsWith(lang === 'fa' ? o : o.toLowerCase()));
  }).length;
  const ratio = hits / paragraphs.length;
  if (ratio > 0.2) {
    add('warn', 'paragraph-openers', `${(ratio * 100).toFixed(0)}٪ بندها با رابط شروع می‌شوند (حداکثر ۲۰٪)`, 'references/ai-tells.md §4');
  }
  // uniform paragraph length
  const plens = paragraphs.map((p) => p.split(/\s+/).length);
  const pmean = plens.reduce((a, b) => a + b, 0) / plens.length;
  const pstd = Math.sqrt(plens.reduce((a, b) => a + (b - pmean) ** 2, 0) / plens.length);
  if (pmean > 0 && pstd / pmean < 0.25) {
    add('warn', 'uniform-paragraphs', `طول بندها یکنواخت است (CV ${(pstd / pmean).toFixed(2)}، هدف > ۰.۳)`, 'references/rhythm-and-voice.md §6');
  }
}

// 7. banned headings + heading depth + colon pattern
let colonHeadings = 0;
for (const h of headings) {
  const norm = (lang === 'fa' ? h.text : h.text.toLowerCase()).replace(/[:：].*$/, '').trim();
  if (BANNED_HEADINGS[lang].some((b) => norm === b || norm === b.replace(ZWNJ, ' '))) {
    add('error', 'generic-heading', `تیتر عمومی «${h.text}»`, 'references/structure-patterns.md');
  }
  if (h.level >= 4) {
    add('warn', 'heading-depth', `تیتر سطح ${h.level}: «${h.text}» (حداکثر H3)`, 'references/structure-patterns.md');
  }
  if (/[:：]/.test(h.text)) colonHeadings += 1;
  if (/\p{Extended_Pictographic}/u.test(h.text)) {
    add('warn', 'emoji-heading', `ایموجی در تیتر «${h.text}»`, 'references/ai-tells.md §3');
  }
}
if (colonHeadings > 2) {
  add('warn', 'colon-headings', `${colonHeadings} تیتر با الگوی «عنوان: زیرعنوان»`, 'references/ai-tells.md §3');
}

// 8. bold density
const bolds = (prose.match(/\*\*[^*\n]+\*\*/g) || []).length;
if (paragraphs.length > 0 && bolds > paragraphs.length * 0.8 && bolds > 5) {
  add('warn', 'bold-density', `${bolds} عبارت بولد در ${paragraphs.length} بند`, 'references/ai-tells.md §3');
}

// 9. Persian typography
if (lang === 'fa') {
  const arabicYK = (body.match(/[يك]/g) || []).length;
  if (arabicYK > 0) {
    add('error', 'arabic-chars', `${arabicYK} نویسه‌ی عربی ي/ك`, 'references/persian-style.md §1');
  }
  const arabicDigits = (body.match(/[\u0660-\u0669]/g) || []).length;
  if (arabicDigits > 0) {
    add('error', 'arabic-digits', `${arabicDigits} رقم عربی (٠-٩)`, 'references/persian-style.md §1');
  }
  const zwnjCount = (body.match(new RegExp(ZWNJ, 'g')) || []).length;
  const needZwnj = (prose.match(/(?:^|\s)(?:می|نمی)\s/g) || []).length
    + (prose.match(/(?:^|\s)(?:می|نمی)[\u0600-\u06FF]/g) || []).length;
  if (wordCount > 150 && zwnjCount < wordCount * 0.01) {
    add('error', 'zwnj-missing', `فقط ${zwnjCount} نیم‌فاصله در ${wordCount} کلمه`, 'references/persian-style.md §2');
  }
  const miSpace = (prose.match(/(?:^|[\s(«])(?:می|نمی)\s+[\u0600-\u06FF]/g) || []).length;
  if (miSpace > 0) {
    add('error', 'mi-space', `${miSpace} مورد «می» یا «نمی» با فاصله‌ی کامل`, 'references/persian-style.md §2');
  }
  const latinQuotes = (prose.match(/"[^"\n]{3,}"/g) || []).length;
  if (latinQuotes > 0) {
    add('warn', 'quotes', `${latinQuotes} گیومه‌ی لاتین به‌جای «»`, 'references/persian-style.md §1');
  }
  const latinComma = (prose.match(/[\u0600-\u06FF]\s*,\s*[\u0600-\u06FF]/g) || []).length;
  if (latinComma > 0) {
    add('warn', 'comma', `${latinComma} ویرگول لاتین بین کلمات فارسی`, 'references/persian-style.md §1');
  }
}

// 10. human-voice signals (heuristic, warn only)
const voiceRe = lang === 'fa'
  ? /(توصیه نمی|توصیه می|به نظر من|تجربه‌ی من|تجربه من|من این|کار نمی‌کند|جواب نمی|اشتباه است|پیشنهاد نمی)/u
  : /(i recommend|i would not|in my experience|i think|does not work|i disagree|honestly)/i;
if (wordCount > 500 && !voiceRe.test(prose)) {
  add('warn', 'no-stance', 'هیچ موضع‌گیری یا قضاوت اول‌شخصی پیدا نشد', 'references/ai-tells.md §6');
}

// -------------------------------------------------------------- report out

const errors = findings.filter((f) => f.level === 'error');
const warnings = findings.filter((f) => f.level === 'warn');

const stats = {
  file,
  lang,
  words: wordCount,
  sentences: sentences.length,
  paragraphs: paragraphs.length,
  headings: headings.length,
  codeBlocks,
  meanSentenceLength: Number(mean.toFixed(1)),
  sentenceStdev: Number(stdev.toFixed(1)),
  emDashes,
  errors: errors.length,
  warnings: warnings.length,
};

if (asJson) {
  console.log(JSON.stringify({ stats, findings }, null, 2));
} else if (!quiet) {
  console.log(`\n${file}  [${lang}]  ${wordCount} کلمه · ${sentences.length} جمله · SD ${stats.sentenceStdev}\n`);
  if (findings.length === 0) {
    console.log('  ✓ هیچ نشانه‌ی متن ماشینی پیدا نشد.\n');
  } else {
    for (const f of findings) {
      const tag = f.level === 'error' ? 'ERROR' : 'warn ';
      console.log(`  ${tag}  [${f.rule}] ${f.message}`);
      console.log(`         → ${f.hint}`);
    }
    console.log(`\n  ${errors.length} خطا · ${warnings.length} هشدار\n`);
  }
}

process.exit(errors.length > 0 ? 1 : 0);
