# متن فارسی خراب — تشخیص و درمان

خاص‌ترین و پرتکرارترین مشکل سایت‌های فارسی. **درمان اشتباه، غیرقابل برگشت است.**

---

## 1) تشخیص نوع خرابی

| ظاهر | نام | علت |
|---|---|---|
| `Ø¢Ù…ÙˆØ²Ø´` | **mojibake** | UTF-8 با latin1 تفسیر شده |
| `????` یا `?????` | از دست رفته | ستون latin1 بوده، داده هنگام ذخیره نابود شده — **غیرقابل بازیابی** |
| `Ø¢Ù…ÙˆØ²Ø´` ولی در دیتابیس سالم | خرابی نمایش | charset اتصال یا هدر HTTP |
| `آموزش` ولی حروف جدا: `آ م و ز ش` | مشکل فونت | فونت subset‌شده بدون GSUB/GPOS |
| `می شود` به‌جای `می‌شود` | ZWNJ حذف شده | ویرایشگر، یا فیلتر sanitize |
| `آموزش` شد `ﺁﻣﻮﺯﺵ` | شکل presentation | نویسه‌های FB50–FDFF به‌جای 0600–06FF |

**قدم اول همیشه:** بفهم داده در دیتابیس سالم است یا نه.

```bash
# داده‌ی خام را با hex ببین
wp db query "SELECT HEX(LEFT(post_title, 10)), post_title FROM wp_posts WHERE ID = 123;"
```

UTF-8 فارسی: هر حرف دو بایت، شروع با `D8` یا `D9`. مثلاً `آ` = `D8A2`.
اگر `C398C2A2` دیدی، داده **دوبار انکود** شده (mojibake ذخیره‌شده).

---

## 2) درخت تصمیم — قبل از هر تغییر

```
داده در دیتابیس با HEX سالم است؟
├── بله → مشکل نمایش است
│   ├── charset اتصال دیتابیس → §3
│   ├── هدر HTTP / meta charset → §4
│   └── فایل PHP با BOM یا انکودینگ غلط → §5
└── نه → داده خراب ذخیره شده
    ├── ????  → از دست رفته، از بکاپ برگردان (§6)
    └── mojibake → قابل اصلاح با تبدیل دقیق (§7)
```

⚠️ **هرگز محتوای mojibake را در ویرایشگر باز و ذخیره نکن.** هر ذخیره یک لایه انکودینگ اضافه می‌کند و بازیابی را سخت‌تر.

---

## 3) charset دیتابیس و اتصال

```bash
# collation جدول‌ها
wp db query "SELECT table_name, table_collation FROM information_schema.TABLES
             WHERE table_schema = DATABASE();"

# charset ستون‌های مهم
wp db query "SELECT column_name, character_set_name, collation_name
             FROM information_schema.COLUMNS
             WHERE table_schema = DATABASE() AND table_name = 'wp_posts';"

# charset اتصال
wp db query "SHOW VARIABLES LIKE 'character_set%';"
```

باید ببینی:
```
character_set_client     utf8mb4
character_set_connection utf8mb4
character_set_database   utf8mb4
character_set_results    utf8mb4
```

`wp-config.php`:
```php
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );          // خالی بگذار، وردپرس خودش انتخاب می‌کند
```

⚠️ اگر `DB_CHARSET` را روی سایت موجود تغییر دهی و داده با charset دیگری ذخیره شده باشد، نمایش خراب می‌شود. اول بکاپ.

---

## 4) هدر HTTP و meta

```bash
curl -sI https://example.ir/ | grep -i content-type
# انتظار: text/html; charset=UTF-8
```

```bash
curl -s https://example.ir/ | grep -io '<meta[^>]*charset[^>]*>'
# انتظار: <meta charset="UTF-8">
```

اگر هدر غلط است:
```php
// functions.php — آخرین راه‌حل، بهتر است در سطح سرور درست شود
add_action( 'send_headers', function () {
    header( 'Content-Type: text/html; charset=UTF-8' );
} );
```

```apache
# .htaccess
AddDefaultCharset UTF-8
```

```bash
# بررسی تنظیم وردپرس
wp option get blog_charset    # باید UTF-8 باشد
```

---

## 5) فایل PHP با BOM یا انکودینگ غلط

BOM (سه بایت `EF BB BF` ابتدای فایل) باعث خروجی زودرس و گاهی خرابی نمایش می‌شود.

```bash
# پیدا کردن فایل‌های دارای BOM
grep -rlI $'\xEF\xBB\xBF' wp-content/themes wp-content/plugins --include='*.php' 2>/dev/null

# حذف BOM
find wp-content/themes/mytheme -name '*.php' -exec sed -i '1s/^\xEF\xBB\xBF//' {} \;
```

انکودینگ فایل:
```bash
file -i wp-content/themes/mytheme/functions.php
# انتظار: charset=utf-8
```

اگر `charset=iso-8859-1` بود و متن فارسی دارد، فایل غلط ذخیره شده:
```bash
iconv -f WINDOWS-1256 -t UTF-8 broken.php -o fixed.php
```

---

## 6) بازیابی از بکاپ (حالت `????`)

اگر داده `????` شده، **از بین رفته است**. بایت‌ها دیگر وجود ندارند.

```bash
# پیدا کردن بکاپ سالم
ls -lt *.sql* wp-content/backups/ 2>/dev/null | head

# بررسی سلامت بکاپ قبل از بازگردانی
grep -a -m1 'آموزش\|وردپرس' backup.sql | head -c 200

# بازگردانی
wp db export before-restore-$(date +%F-%H%M).sql
wp db import backup.sql
```

اگر بکاپ نداری: محتوا رفته. تنها راه، کش گوگل، Wayback Machine، یا بازنویسی است.

---

## 7) اصلاح mojibake (داده دوبار انکودشده)

⚠️ **حتماً روی کپی استیجینگ تست کن. بکاپ الزامی است.**

```bash
wp db export backup-before-mojibake-fix.sql
```

روش استاندارد: داده به‌صورت utf8 ذخیره شده ولی در واقع بایت‌های latin1 هستند.

```sql
-- روی یک ردیف تست کن، نه روی کل جدول
SELECT post_title,
       CONVERT(CAST(CONVERT(post_title USING latin1) AS BINARY) USING utf8mb4) AS fixed
FROM wp_posts WHERE ID = 123;
```

اگر ستون `fixed` درست نمایش داده شد، تبدیل جواب می‌دهد:

```sql
-- فقط بعد از تأیید روی نمونه
UPDATE wp_posts
SET post_title   = CONVERT(CAST(CONVERT(post_title   USING latin1) AS BINARY) USING utf8mb4),
    post_content = CONVERT(CAST(CONVERT(post_content USING latin1) AS BINARY) USING utf8mb4),
    post_excerpt = CONVERT(CAST(CONVERT(post_excerpt USING latin1) AS BINARY) USING utf8mb4)
WHERE ID = 123;
```

روش امن‌تر برای کل سایت: dump بگیر، با ابزار متنی تبدیل کن، دوباره import کن.

```bash
wp db export dump.sql --default-character-set=latin1
# فایل را با یک ویرایشگر UTF-8 باز کن و درستی متن را چشمی بررسی کن
wp db import dump.sql --default-character-set=utf8mb4
```

---

## 8) نیم‌فاصله‌ی گم‌شده

```bash
# شمارش ZWNJ در محتوا
wp db query "SELECT SUM(LENGTH(post_content) - LENGTH(REPLACE(post_content, CHAR(0xE2,0x80,0x8C USING utf8mb4), ''))) / 3
             FROM wp_posts WHERE post_status='publish';" --skip-column-names
```

علت‌های حذف ZWNJ:
- ویرایشگر بصری (TinyMCE) در بعضی پیکربندی‌ها آن را trim می‌کند
- افزونه‌های «بهینه‌سازی محتوا» یا minify HTML
- `sanitize_text_field()` روی فیلدهای سفارشی — ZWNJ را نگه می‌دارد، اما `wp_strip_all_tags` با تنظیم خاص ممکن است نه
- کپی/پیست از منابعی که ZWNJ ندارند

جلوگیری:
```php
// نیم‌فاصله را در خروجی حفظ کن — از افزونه‌های minify استثنا کن
// و برای ورودی‌های سفارشی:
$clean = sanitize_text_field( $input );   // ZWNJ سالم می‌ماند
// نه:
$clean = preg_replace( '/\s+/u', ' ', $input );  // ❌ ZWNJ را حذف نمی‌کند ولی الگوهای مشابه می‌کنند
```

بررسی در خروجی نهایی:
```bash
curl -s https://example.ir/some-post/ | grep -c $'\u200c'
```

---

## 9) حروف جدا (فونت)

اگر متن به‌شکل `م ی ش و د` نمایش داده می‌شود، مشکل از داده نیست — از فونت است.

علت: فونت subset‌شده بدون جدول‌های GSUB/GPOS.
راه‌حل: `wp-persian-speed/references/persian-fonts.md` §4 — با `--layout-features='*'` دوباره subset کن.

تست سریع: در DevTools فونت را موقتاً به `Tahoma` تغییر بده. اگر درست شد، فونت مقصر است.

---

## 10) نویسه‌های presentation form

اگر متن با نویسه‌های `FB50–FDFF` ذخیره شده (شکل‌های آماده‌ی عربی)، جستجو کار نمی‌کند و کپی/پیست خراب است.

```bash
wp db query "SELECT ID, post_title FROM wp_posts
             WHERE post_title REGEXP CONCAT('[', CHAR(0xEF,0xAD,0x90 USING utf8mb4), '-', CHAR(0xEF,0xB7,0xBF USING utf8mb4), ']')
             LIMIT 10;"
```

نرمال‌سازی با PHP:
```php
// اسکریپت یک‌بارمصرف، با بکاپ
$normalized = Normalizer::normalize( $text, Normalizer::FORM_KC );
```

نیازمند اکستنشن `intl`.

---

## 11) چک‌لیست

```
[ ] نوع خرابی از جدول §1 مشخص شد
[ ] HEX داده بررسی شد — سالم یا خراب
[ ] بکاپ گرفته شد قبل از هر تغییر
[ ] charset دیتابیس و اتصال utf8mb4 است
[ ] DB_CHARSET = utf8mb4 و DB_COLLATE خالی
[ ] هدر HTTP و meta charset درست‌اند
[ ] هیچ فایل PHP با BOM نیست
[ ] تبدیل mojibake اول روی یک ردیف تست شد
[ ] نیم‌فاصله در خروجی نهایی سالم است
[ ] حروف به هم چسبیده‌اند (تست فونت)
```
