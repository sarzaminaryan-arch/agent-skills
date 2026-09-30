# صفحه‌ی سفید و خطاهای مرگبار

---

## 1) اول: کد وضعیت واقعی چیست؟

صفحه‌ی سفید چند چیز کاملاً متفاوت است.

```bash
curl -sI https://example.ir/ | head -5
curl -s https://example.ir/ | wc -c
```

| کد | معنی | برو به |
|---|---|---|
| `200` + بدنه‌ی خالی | PHP بی‌صدا مرد یا خروجی سرکوب شد | §2 |
| `500` | خطای PHP یا `.htaccess` | §2, §6 |
| `502` / `504` | PHP-FPM پاسخ نداد یا timeout | §5 |
| `503` | حالت تعمیر یا سرور اشباع | §4 |
| `508` | محدودیت منابع هاست | `iranian-hosting-issues.md` |
| `403` | ModSecurity یا مجوز فایل | `iranian-hosting-issues.md` §3 |

---

## 2) گرفتن خطای واقعی

```php
// wp-config.php
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );
@ini_set( 'display_errors', 0 );
@ini_set( 'log_errors', 1 );
```

بارگذاری مجدد صفحه، سپس:

```bash
tail -100 wp-content/debug.log
```

اگر `debug.log` ساخته نشد:

```bash
# مسیرهای دیگر لاگ
ls -la error_log ../error_log ../logs/ 2>/dev/null
tail -50 $(php -i 2>/dev/null | grep '^error_log' | awk '{print $3}') 2>/dev/null

# مجوز نوشتن
ls -ld wp-content
touch wp-content/debug.log && chmod 664 wp-content/debug.log
```

مسیر لاگ سفارشی:
```php
define( 'WP_DEBUG_LOG', '/home/user/private/wp-errors.log' );
```

---

## 3) خواندن Fatal Error

```
PHP Fatal error:  Uncaught Error: Call to undefined function wc_get_product()
in /home/user/public_html/wp-content/themes/shop-theme/functions.php:142
Stack trace:
#0 /home/user/public_html/wp-includes/class-wp-hook.php(310): shop_theme_setup('')
#1 ...
```

سه چیز را بردار:
1. **نوع خطا** — `Uncaught Error`, `Allowed memory size`, `Maximum execution time`
2. **فایل و خط** — `themes/shop-theme/functions.php:142`
3. **علت واقعی** — `wc_get_product` یعنی ووکامرس فعال نیست ولی قالب انتظارش را دارد

جدول خطاهای رایج:

| خطا | علت | راه‌حل |
|---|---|---|
| `Call to undefined function X()` | افزونه‌ی وابسته غیرفعال یا حذف شده | افزونه را فعال کن، یا در کد `function_exists()` بگذار |
| `Allowed memory size exhausted` | حافظه‌ی PHP کم | §5 |
| `Maximum execution time exceeded` | حلقه‌ی طولانی یا درخواست خارجی معلق | §5 |
| `Cannot redeclare X()` | تابع دوبار تعریف شده (معمولاً کپی کد در functions.php) | یکی را حذف کن |
| `syntax error, unexpected` | خطای تایپی در کد اخیراً ویرایش‌شده | همان خط را نگاه کن |
| `Class "X" not found` | autoloader خراب یا وابستگی composer نصب‌نشده | `composer install` |
| `Cannot modify header information` | خروجی زودرس (BOM، فاصله بعد از `?>`) | §7 |
| `Uncaught TypeError: ... must be of type string, null given` | ناسازگاری PHP 8 با کد قدیمی | نسخه‌ی PHP یا کد را اصلاح کن |

**نکته‌ی مهم:** بعد از ارتقا به PHP 8، قالب‌ها و افزونه‌های قدیمی ایرانی معمولاً با `TypeError` و `ValueError` می‌شکنند. `wp-phpstan` را برای بررسی ایستا ببین.

---

## 4) خطای `.maintenance` جامانده

اگر به‌روزرسانی نیمه‌کاره مانده:

```bash
ls -la .maintenance
rm -f .maintenance
```

سایت بلافاصله برمی‌گردد. بعد از آن، به‌روزرسانی را دوباره و یکی‌یکی انجام بده.

---

## 5) محدودیت‌های منابع

```php
// wp-config.php
define( 'WP_MEMORY_LIMIT', '256M' );
define( 'WP_MAX_MEMORY_LIMIT', '512M' );
```

```ini
; php.ini یا .user.ini
memory_limit = 256M
max_execution_time = 300
max_input_vars = 3000
```

```apache
# .htaccess — اگر هاست اجازه بدهد
php_value memory_limit 256M
php_value max_execution_time 300
php_value max_input_vars 3000
```

بررسی مقادیر واقعی:
```bash
php -i | grep -E '^(memory_limit|max_execution_time|max_input_vars)'
wp eval 'echo ini_get("memory_limit") . " | " . WP_MEMORY_LIMIT;'
```

`max_input_vars` کم، علت رایج ذخیره‌نشدن منوهای بزرگ و تنظیمات قالب است — بدون هیچ پیام خطایی.

---

## 6) `.htaccess` خراب

```bash
cp .htaccess .htaccess.bak
cat > .htaccess <<'EOF'
# BEGIN WordPress
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteRule ^index\.php$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.php [L]
</IfModule>
# END WordPress
EOF
```

تست. اگر درست شد، محتوای `.htaccess.bak` را بخش‌بخش برگردان تا مقصر پیدا شود.

روی nginx معادلی ندارد — قواعد در کانفیگ سرور هستند.

---

## 7) خروجی زودرس (`headers already sent`)

```
Warning: Cannot modify header information - headers already sent by
(output started at /path/wp-content/themes/x/functions.php:1)
```

علت‌ها:
- BOM ابتدای فایل → `encoding-and-mojibake.md` §5
- فاصله یا خط خالی **بعد از** `?>` پایانی
- `echo`/`print` در فایلی که زود لود می‌شود

راه‌حل: تگ `?>` پایانی را از فایل‌های PHP **حذف کن**. استاندارد وردپرس همین است.

```bash
# پیدا کردن فایل‌های با محتوا بعد از ?> پایانی
for f in $(find wp-content/themes wp-content/plugins -name '*.php'); do
  tail -c 20 "$f" | grep -q '?>[[:space:]]*$' && tail -c 3 "$f" | grep -qP '\S' || true
done
```

---

## 8) دسترسی اضطراری بدون wp-admin

### غیرفعال‌سازی همه‌ی افزونه‌ها از طریق دیتابیس

```bash
wp db export emergency-backup.sql
wp db query "UPDATE wp_options SET option_value = 'a:0:{}' WHERE option_name = 'active_plugins';"
```

از phpMyAdmin: جدول `wp_options` → ردیف `active_plugins` → مقدار را `a:0:{}` کن.

### غیرفعال‌سازی از طریق FTP

پوشه‌ی `wp-content/plugins` را به `plugins-off` تغییر نام بده. وردپرس همه را غیرفعال می‌کند. بعد دوباره به `plugins` برگردان و یکی‌یکی فعال کن.

### بازگشت به قالب پیش‌فرض

```bash
wp theme activate twentytwentyfour
# یا اگر WP-CLI نیست: پوشه‌ی قالب فعال را rename کن
```

---

## 9) بازیابی فایل‌های هسته

```bash
wp core verify-checksums
wp core download --force --skip-content
```

`--skip-content` یعنی `wp-content` دست‌نخورده می‌ماند. فقط فایل‌های هسته بازنویسی می‌شوند.

---

## 10) گارد mu-plugin برای جلوگیری از تکرار

اگر یک افزونه مرتب سایت را می‌خواباند، یک گارد بگذار:

```php
<?php
// wp-content/mu-plugins/fatal-guard.php
// خطاهای مرگبار را لاگ می‌کند و یک صفحه‌ی مؤدبانه نشان می‌دهد به‌جای سفیدی
register_shutdown_function( function () {
    $e = error_get_last();
    if ( $e && in_array( $e['type'], array( E_ERROR, E_PARSE, E_COMPILE_ERROR ), true ) ) {
        error_log( sprintf(
            '[FATAL-GUARD] %s in %s:%d',
            $e['message'], $e['file'], $e['line']
        ) );
    }
} );
```

وردپرس ۵.۲+ خودش «حالت بازیابی» (Recovery Mode) دارد و ایمیل بازیابی می‌فرستد. مطمئن شو ایمیل مدیر معتبر است:

```bash
wp option get admin_email
```

---

## 11) چک‌لیست

```
[ ] کد وضعیت HTTP واقعی ثبت شد
[ ] WP_DEBUG_LOG روشن و WP_DEBUG_DISPLAY خاموش
[ ] متن دقیق خطا از لاگ استخراج شد
[ ] فایل و خط مقصر مشخص شد
[ ] .maintenance بررسی شد
[ ] محدودیت‌های PHP بررسی شدند
[ ] .htaccess تست شد
[ ] هیچ خروجی زودرسی نیست
[ ] wp core verify-checksums پاس شد
[ ] بعد از رفع، debug constants حذف و debug.log پاک شد
```
