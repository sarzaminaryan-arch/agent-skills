#!/usr/bin/env node
/**
 * verify_theme_zip.mjs — بررسی نصب‌پذیری بسته‌ی قالب وردپرس، پیش از تحویل.
 *
 * چرا نوشته شد: نسخه‌ی ۲.۶.۰ با `style.css` صفر بایتی منتشر شد. وردپرس چنین
 * بسته‌ای را نصب نمی‌کند («پوسته فاقد شیوه‌نامه style.css است») و کاربر دو نوبت
 * وقت گذاشت تا بفهمیم. علتش یک تک‌خطی پایتون بود:
 *
 *     open(p,'w').write(open(p).read().replace(a,b))     ← فایل را قبل از خواندن خالی می‌کند
 *
 * آرشیو سالم بود، ساختار درست بود، حجم منطقی بود — و باز هم نصب نمی‌شد.
 * هیچ‌کدام از بررسی‌های قبلی این را نمی‌گرفتند چون هیچ‌کدام *محتوا* را نگاه نمی‌کرد.
 *
 * اجرا:  node verify_theme_zip.mjs <theme.zip> [--slug sarzaminaryan-child]
 * خروج:  0 اگر قابل نصب باشد، 1 اگر نباشد.
 *
 * بدون وابستگی. فقط `unzip` لازم دارد.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { basename } from 'node:path';

const args = process.argv.slice(2);
const zip = args.find((a) => !a.startsWith('--'));
const slugArg = args.indexOf('--slug');
const wantSlug = slugArg !== -1 ? args[slugArg + 1] : null;

if (!zip || !existsSync(zip)) {
  console.error('کاربرد: node verify_theme_zip.mjs <theme.zip> [--slug <folder>]');
  process.exit(2);
}

const errors = [];
const warns = [];
const ok = [];

const sh = (cmd, a) => execFileSync(cmd, a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const shBuf = (cmd, a) => execFileSync(cmd, a, { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });

/* ---- ۱) آرشیو سالم است؟ ---- */
try {
  sh('unzip', ['-t', zip]);
  ok.push('آرشیو سالم است');
} catch {
  errors.push('آرشیو خراب است — unzip -t شکست خورد');
  report();
}

/* ---- ۲) فهرست ورودی‌ها ---- */
const list = sh('unzip', ['-Z1', zip]).split('\n').map((s) => s.trim()).filter(Boolean);
if (!list.length) errors.push('آرشیو خالی است');

/* ---- ۳) دقیقاً یک پوشه‌ی ریشه ---- */
const roots = [...new Set(list.map((p) => p.split('/')[0]))];
if (roots.length !== 1) {
  errors.push(`باید دقیقاً یک پوشه در ریشه باشد؛ ${roots.length} تا هست: ${roots.slice(0, 5).join(', ')}`);
} else {
  ok.push(`یک پوشه‌ی ریشه: ${roots[0]}`);
  if (wantSlug && roots[0] !== wantSlug) {
    errors.push(`نام پوشه‌ی ریشه «${roots[0]}» است، انتظار «${wantSlug}» می‌رفت`);
  }
}
const root = roots[0];

/* ---- ۴) فایل‌های ناخواسته ---- */
const junk = list.filter((p) => /__MACOSX|\/\._|\.DS_Store|Thumbs\.db/i.test(p));
if (junk.length) warns.push(`${junk.length} فایل ناخواسته (__MACOSX/.DS_Store)`);

/* ---- ۵) نام غیر-ASCII (PHP ZipArchive روی بعضی سرورها می‌شکند) ---- */
// eslint-disable-next-line no-control-regex
const nonAscii = list.filter((p) => /[^\x00-\x7F]/.test(p));
if (nonAscii.length) errors.push(`${nonAscii.length} فایل با نام غیر-ASCII: ${nonAscii[0]}`);
else ok.push('همه‌ی نام‌ها ASCII');

/* ---- ۶) هیچ فایل صفر بایتی ---- */
const sizes = sh('unzip', ['-l', zip])
  .split('\n')
  .map((l) => l.match(/^\s*(\d+)\s+\S+\s+\S+\s+(.+)$/))
  .filter(Boolean)
  .map((m) => ({ size: Number(m[1]), path: m[2].trim() }))
  .filter((e) => !e.path.endsWith('/'));

const empty = sizes.filter((e) => e.size === 0);
if (empty.length) {
  errors.push(`${empty.length} فایل صفر بایتی: ${empty.map((e) => e.path).slice(0, 6).join(', ')}`);
} else {
  ok.push(`${sizes.length} فایل، هیچ‌کدام صفر بایتی نیست`);
}

/* ---- ۷) style.css و هدرهای اجباری وردپرس ---- */
const cssPath = `${root}/style.css`;
if (!list.includes(cssPath)) {
  errors.push('style.css در ریشه‌ی پوشه نیست — وردپرس این را پوسته نمی‌شناسد');
} else {
  let css = '';
  try { css = shBuf('unzip', ['-p', zip, cssPath]).toString('utf8'); } catch { /* noop */ }
  if (!css.trim()) {
    errors.push('style.css خالی است — «پوسته فاقد شیوه‌نامه style.css است»');
  } else {
    const head = css.slice(0, 8192);
    const get = (k) => (head.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')) || [, ''])[1].trim();
    const name = get('Theme Name');
    const tmpl = get('Template');
    const ver = get('Version');

    if (!name) errors.push('هدر «Theme Name» در style.css نیست — بدون آن نصب نمی‌شود');
    else ok.push(`Theme Name: ${name}`);

    if (tmpl) ok.push(`Template (قالب مادر): ${tmpl}`);
    else warns.push('هدر Template نیست — یعنی این یک قالب مستقل است، نه فرزند');

    if (!ver) errors.push('هدر «Version» در style.css نیست');
    else {
      ok.push(`Version: ${ver}`);
      const fn = list.includes(`${root}/functions.php`)
        ? shBuf('unzip', ['-p', zip, `${root}/functions.php`]).toString('utf8')
        : '';
      const m = fn.match(/SA_CHILD_VERSION'?\s*,\s*'([^']+)'/);
      if (m && m[1] !== ver) {
        errors.push(`ناهماهنگی نسخه: style.css = ${ver} ولی functions.php = ${m[1]}`);
      } else if (m) {
        ok.push('نسخه‌ی style.css و functions.php یکی است');
      }
    }
  }
}

/* ---- ۸) فایل‌های PHP اعلام‌شده در functions.php واقعاً هستند؟ ---- */
if (list.includes(`${root}/functions.php`)) {
  const fn = shBuf('unzip', ['-p', zip, `${root}/functions.php`]).toString('utf8');
  const incs = [...fn.matchAll(/'(inc\/[a-z0-9_-]+\.php)'/gi)].map((m) => m[1]);
  const missing = incs.filter((p) => !list.includes(`${root}/${p}`));
  if (missing.length) errors.push(`functions.php این فایل‌ها را می‌خواند ولی در بسته نیستند: ${missing.join(', ')}`);
  else if (incs.length) ok.push(`${incs.length} فایل inc/ اعلام‌شده، همه موجودند`);
}

/* ---- ۹) هر PHP با <?php شروع می‌شود و BOM ندارد ---- */
const phps = list.filter((p) => p.endsWith('.php'));
const badStart = [];
for (const p of phps) {
  const buf = shBuf('unzip', ['-p', zip, p]);
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) badStart.push(`${p} (BOM)`);
  else if (buf.slice(0, 5).toString() !== '<?php') badStart.push(`${p} (با <?php شروع نمی‌شود)`);
}
if (badStart.length) errors.push(`${badStart.length} فایل PHP مشکل‌دار: ${badStart.slice(0, 4).join(', ')}`);
else ok.push(`${phps.length} فایل PHP، همه بدون BOM و با <?php`);

/* ---- گزارش ---- */
function report() {
  const kb = Math.round(statSync(zip).size / 1024);
  console.log(`\nبررسی بسته: ${basename(zip)}  (${kb} کیلوبایت)\n`);
  for (const o of ok) console.log(`  ✓ ${o}`);
  for (const w of warns) console.log(`  ! ${w}`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  console.log(
    errors.length
      ? `\n  ${errors.length} ایراد — این بسته نصب نمی‌شود. تحویل ندهید.\n`
      : `\n  قابل نصب ✓\n`
  );
  process.exit(errors.length ? 1 : 0);
}
report();
