# ممیزی سرزمین آریان — ۱۴۰۵/۰۷/۰۸

بسته‌ی عیب‌یابی، قانون جایگزین، مسیر پیشنهادی و کد اصلاح خودکار برای
`sarzaminaryan.ir` (مخزن محتوا: [`sarzaminaryan-arch/Cc`](https://github.com/sarzaminaryan-arch/Cc)).

## فایل‌ها

| فایل | چیست | برای چه کسی |
|---|---|---|
| [`01-AUDIT.md`](01-AUDIT.md) | عیب‌یابی با عدد اندازه‌گیری‌شده + جواب سؤال «آیا این مسیر بی‌سرانجام است؟» | بخوانید، کامل |
| [`02-RULEBOOK.md`](02-RULEBOOK.md) | **قانون ثابت v2.0** — جایگزین v1.0 تا v1.3 | چسبانده شود به دیوار |
| [`03-ROADMAP.md`](03-ROADMAP.md) | برنامه‌ی ۹۰ روزه‌ی مسیر جایگزین | اجرا |
| [`mu-plugins/sa-content-guard.php`](mu-plugins/sa-content-guard.php) | کدی که رفتار غلط قالب را **خودکار** اصلاح می‌کند | نصب |
| [`patches/template-home.md`](patches/template-home.md) | اصلاح دائمی قالب (اختیاری) | بعداً |

## شروع سریع — ۱۰ دقیقه

```bash
# ۱) دانلود
curl -LO https://raw.githubusercontent.com/sarzaminaryan-arch/agent-skills/arena/01a0ef63-agent-skills/audits/sarzaminaryan/mu-plugins/sa-content-guard.php

# ۲) آپلود با cPanel یا FTP به:
#    public_html/wp-content/mu-plugins/sa-content-guard.php
#    (اگر پوشه‌ی mu-plugins نیست، بسازید)
```

همین. mu-plugin خودکار فعال می‌شود؛ نیازی به رفتن به صفحه‌ی افزونه‌ها نیست.

**بررسی اینکه کار می‌کند:**
پیشخوان → ابزارها → **سلامت محتوا** باید ظاهر شده باشد.
یک صفحه‌ی شهرستان را باز کنید: پایین مقاله باید بخش «پانویس‌ها و ارجاع‌های متن» آمده باشد
و لینک‌های ویکی‌پدیا از داخل متن رفته باشند.

**برای برگرداندن همه‌چیز:** فایل را پاک کنید. هیچ چیزی در دیتابیس تغییر نکرده است.

## بعد از نصب، دو کار

```
۱) پیشخوان → استان‌ها → انتخاب همه → ویرایش گروهی → وضعیت: منتشرشده
   (۲۷ استان از قفل درمی‌آیند — دروازه‌ی سخت دیگر جلویشان را نمی‌گیرد)

۲) Google Search Console را راه بیندازید و sitemap_index.xml را ثبت کنید
```

جزئیات در `03-ROADMAP.md` هفته‌ی ۰.

## اثر اندازه‌گیری‌شده‌ی افزونه

روی ۱۱۳ مقاله‌ی موجود، بدون تغییر یک کاراکتر در دیتابیس:

```
لینک dofollow بیرونی در بدنه :  ۷٬۰۵۹  →  ۰
لینک بیرونی در هر مقاله      :  ۶۲٫۵   →  ۷٫۸   (همه nofollow)
صفحه‌های با دو <h1>           :  ۸۲     →  ۰
لینک ۴۰۴ روی صفحه‌ی اصلی      :  ۵۴     →  ۰
بلوک تکراری داخل <article>   :  ۱۰۹    →  ۰
استان‌های قفل‌شده در draft     :  ۲۷     →  ۰
```

## ماژول‌ها و خاموش‌کردنشان

در `wp-config.php`:

```php
define( 'SA_GUARD_DISABLE',      true );  // خاموشی کامل
define( 'SA_GUARD_CITATIONS',    false ); // پانویس‌سازی
define( 'SA_GUARD_SINGLE_H1',    false ); // تنزل H1 بدنه
define( 'SA_GUARD_DEAD_LINKS',   false ); // خنثی‌کردن لینک ۴۰۴
define( 'SA_GUARD_REMOTE_FONTS', false ); // حذف فونت گوگل
define( 'SA_GUARD_COMMUNITY_BOX',false ); // جداکردن بلوک پایانی
define( 'SA_GUARD_RELAX_GATE',   false ); // بازگشت به دروازه‌ی سخت قالب
define( 'SA_GUARD_HEALTH_PAGE',  false ); // صفحه‌ی گزارش
```

یا با فیلتر: `add_filter( 'sa_guard_modules', fn( $m ) => $m + array( 'citations' => false ) );`

## ابزار ممیزی

```bash
node skills/geo-content-strategy/scripts/geo_content_audit.mjs \
     --dir <مسیر بسته‌های درون‌ریز یا فایل‌های md> \
     --site sarzaminaryan.ir [--json]
```

مهارت کامل: [`skills/geo-content-strategy/`](../../skills/geo-content-strategy/)

## دو فایل XML

آن دو فایل روی گیت‌هاب نیستند — هیچ‌کدام از ۱۱ مخزن حساب `sarzaminaryan-arch` فایل
`*.xml` خروجی وردپرس ندارد و `Cc` هم فقط یک کامیت دارد. برای این ممیزی چیزی از دست
نرفت، چون `wp-content/plugins/sa-*-importer-*/data/*.json` دقیقاً همان HTML واردشده
به وردپرس است و سایت زنده هم بررسی شد. اگر باز هم خواستید بفرستید، پوش کنید و بگویید.
