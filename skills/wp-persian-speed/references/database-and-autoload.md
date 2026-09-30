# دیتابیس و autoload

علت معمول TTFB بد در حالت لاگین و کندی پنل مدیریت.

⚠️ **پیش از هر دستوری:** `wp db export backup-$(date +%F).sql`

---

## 1) autoload — اولین چیزی که باید نگاه کنی

وردپرس در **هر درخواست** همه‌ی ردیف‌های `wp_options` با `autoload='yes'` را می‌خواند و در حافظه می‌گذارد.

```bash
# مجموع حجم autoload
wp db query "SELECT ROUND(SUM(LENGTH(option_value))/1024/1024, 2) AS mb, COUNT(*) AS rows_count
             FROM wp_options WHERE autoload='yes';" --skip-column-names
```

| مقدار | وضعیت |
|---|---|
| < ۵۰۰ KB | سالم |
| ۵۰۰ KB – ۱ MB | قابل قبول |
| ۱ – ۳ MB | مشکل‌دار |
| > ۳ MB | علت اصلی کندی |

### بزرگ‌ترین متهم‌ها

```bash
wp db query "SELECT option_name, ROUND(LENGTH(option_value)/1024, 1) AS kb
             FROM wp_options WHERE autoload='yes'
             ORDER BY LENGTH(option_value) DESC LIMIT 25;"
```

معمولاً:
- تنظیمات افزونه‌های حذف‌شده (که uninstall تمیز نداشتند)
- لاگ‌های افزونه‌های امنیتی و بکاپ
- کش‌های سریالایزشده‌ی افزونه‌های صفحه‌ساز
- `_transient_*` که autoload شده‌اند
- تنظیمات قالب‌های چندمنظوره (گاهی چند صد کیلوبایت)

### اصلاح

```bash
# ۱) ببین آیا افزونه‌ی صاحب گزینه هنوز فعال است
wp plugin list --status=active --field=name

# ۲) گزینه‌ی یتیم را از autoload خارج کن (امن‌تر از حذف)
wp db query "UPDATE wp_options SET autoload='no' WHERE option_name='some_orphan_option';"

# ۳) فقط وقتی مطمئنی، حذف کن
wp option delete some_orphan_option
```

**قاعده:** اول `autoload='no'`، چند روز صبر، بعد حذف. تفاوت سرعتی‌اش صفر است و ریسکش خیلی کمتر.

---

## 2) transient‌ها

```bash
# شمارش
wp db query "SELECT COUNT(*) FROM wp_options WHERE option_name LIKE '\_transient\_%';" --skip-column-names

# منقضی‌شده‌ها
wp transient delete --expired

# همه (فقط اگر می‌دانی چه می‌کنی؛ باعث rebuild موقت می‌شود)
wp transient delete --all
```

transient منقضی‌شده خودکار پاک نمی‌شود مگر درخواست شود. روی سایت قدیمی ده‌ها هزار ردیف جمع می‌شود.

---

## 3) بازبینی‌ها (revisions)

```bash
# شمارش
wp db query "SELECT COUNT(*) FROM wp_posts WHERE post_type='revision';" --skip-column-names

# حذف با نگه‌داشتن ۳ تای آخر هر نوشته
wp post delete $(wp post list --post_type=revision --format=ids) --force
```

محدود کردن برای آینده:

```php
// wp-config.php
define( 'WP_POST_REVISIONS', 5 );      // نه false — تاریخچه مفید است
define( 'AUTOSAVE_INTERVAL', 120 );
define( 'EMPTY_TRASH_DAYS', 14 );
```

---

## 4) جدول‌های یتیم

افزونه‌های حذف‌شده معمولاً جدول‌هایشان را جا می‌گذارند.

```bash
# فهرست جدول‌ها با حجم
wp db query "SELECT table_name, ROUND((data_length+index_length)/1024/1024,2) AS mb, table_rows
             FROM information_schema.TABLES
             WHERE table_schema = DATABASE()
             ORDER BY (data_length+index_length) DESC LIMIT 30;"
```

جدول‌هایی با پیشوند افزونه‌ای که دیگر نصب نیست را شناسایی کن. **قبل از حذف، بکاپ.**

---

## 5) postmeta متورم

```bash
wp db query "SELECT meta_key, COUNT(*) AS c, ROUND(SUM(LENGTH(meta_value))/1024/1024,2) AS mb
             FROM wp_postmeta GROUP BY meta_key
             ORDER BY SUM(LENGTH(meta_value)) DESC LIMIT 25;"
```

متهم‌های رایج در سایت فارسی:
- `_elementor_data` — داده‌ی JSON صفحه‌ساز، می‌تواند صدها کیلوبایت باشد
- `_wp_attachment_metadata` با اندازه‌های تصویر زیاد
- متای افزونه‌های بازدید/آمار روی هر نوشته
- متای SEO تکراری از افزونه‌ی سئوی قبلی

```bash
# پاک‌سازی متای افزونه‌ی سئوی حذف‌شده (نمونه — نام کلید را تأیید کن)
wp db query "DELETE FROM wp_postmeta WHERE meta_key LIKE '_yoast_wpseo_%';"
```

---

## 6) ایندکس‌ها

```bash
# کوئری‌های کند
wp db query "SHOW VARIABLES LIKE 'slow_query_log%';"
wp db query "SHOW VARIABLES LIKE 'long_query_time';"
```

ایندکس‌های مفید برای سایت‌های محتوایی بزرگ:

```sql
-- فقط بعد از تأیید با EXPLAIN و روی استیجینگ
ALTER TABLE wp_postmeta ADD INDEX meta_key_value (meta_key(191), meta_value(100));
ALTER TABLE wp_options ADD INDEX autoload_idx (autoload);
```

⚠️ روی جدول بزرگ، `ALTER TABLE` قفل می‌کند. روی استیجینگ زمان‌سنجی کن.

---

## 7) موتور و کدگذاری

```bash
wp db query "SELECT table_name, engine, table_collation
             FROM information_schema.TABLES WHERE table_schema = DATABASE();"
```

- همه باید `InnoDB` باشند. `MyISAM` روی جدول‌های وردپرس یعنی قفل سطح جدول.
- Collation باید `utf8mb4_unicode_520_ci` یا `utf8mb4_general_ci` باشد.
- اگر `utf8` (نه `utf8mb4`) است، ایموجی و بعضی نویسه‌ها خراب می‌شوند:

```bash
wp db query "ALTER TABLE wp_posts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci;"
```

⚠️ تبدیل charset روی دیتابیس فارسی حساس است. حتماً بکاپ و تست روی استیجینگ. اگر داده با کدگذاری غلط ذخیره شده (mojibake)، تبدیل ساده درستش نمی‌کند.

---

## 8) بهینه‌سازی جدول

```bash
wp db optimize
```

روی InnoDB اثر محدودی دارد اما فضای حذف‌شده را آزاد می‌کند. ماهی یک‌بار کافی است.

---

## 9) کوئری‌های سنگین در کد

الگوهای خطرناک که در قالب‌ها و افزونه‌های ایرانی رایج‌اند:

```php
// ❌ همه‌ی نوشته‌ها را می‌خواند
$posts = get_posts( array( 'numberposts' => -1 ) );

// ✅
$posts = get_posts( array(
    'numberposts'            => 10,
    'no_found_rows'          => true,
    'update_post_meta_cache' => false,
    'update_post_term_cache' => false,
) );

// ❌ کوئری متا بدون ایندکس روی هر بارگذاری
new WP_Query( array( 'meta_key' => 'views', 'orderby' => 'meta_value_num' ) );

// ✅ شمارنده را در جدول/گزینه‌ی جدا نگه دار یا نتیجه را transient کن
```

پیدا کردن:
```bash
grep -rn "numberposts.*=>.*-1\|posts_per_page.*=>.*-1" wp-content/themes wp-content/plugins --include='*.php' | head -20
```

---

## 10) چک‌لیست

```
[ ] بکاپ دیتابیس گرفته شده
[ ] autoload زیر ۱ مگابایت
[ ] گزینه‌های یتیم به autoload=no تغییر کرده‌اند
[ ] transientهای منقضی پاک شده‌اند
[ ] revisionها محدود شده‌اند (WP_POST_REVISIONS)
[ ] جدول‌های یتیم شناسایی شده‌اند
[ ] postmeta متورم بررسی شده
[ ] همه‌ی جدول‌ها InnoDB و utf8mb4 هستند
[ ] کوئری‌های posts_per_page => -1 بررسی شده‌اند
[ ] TTFB لاگین‌شده قبل و بعد اندازه‌گیری شده
```
