# قفل‌شدن پنل مدیریت و مشکلات ورود

---

## 1) تشخیص نوع مشکل

| نشانه | برو به |
|---|---|
| حلقه‌ی ریدایرکت بین `wp-login.php` و `wp-admin` | §2 |
| «رمز عبور اشتباه است» با رمز درست | §3 |
| ورود موفق ولی بلافاصله خروج | §4 |
| `wp-admin` سفید یا ۵۰۰ | `wsod-and-fatals.md` |
| «You do not have sufficient permissions» | §5 |
| ایمیل بازیابی نمی‌رسد | §6 |
| ۴۰۳ روی `wp-login.php` | `iranian-hosting-issues.md` §3 |
| قفل‌شدن توسط افزونه‌ی امنیتی | §7 |

---

## 2) حلقه‌ی ریدایرکت

### علت ۱ — URL ناسازگار

```bash
wp option get home
wp option get siteurl
```

هر دو باید یکسان و با پروتکل درست باشند. `http` در یکی و `https` در دیگری = حلقه.

```bash
wp option update home 'https://example.ir'
wp option update siteurl 'https://example.ir'
```

بدون WP-CLI، در `wp-config.php`:
```php
define( 'WP_HOME',    'https://example.ir' );
define( 'WP_SITEURL', 'https://example.ir' );
```
(این‌ها مقدار دیتابیس را override می‌کنند — برای تست موقت عالی است.)

### علت ۲ — پروکسی/CDN بدون هدر پروتکل

سایت پشت CDN یا لودبالانسر، وردپرس فکر می‌کند HTTP است و به HTTPS ریدایرکت می‌کند، بی‌نهایت.

```php
// wp-config.php — بالای require_once
if ( isset( $_SERVER['HTTP_X_FORWARDED_PROTO'] ) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https' ) {
    $_SERVER['HTTPS'] = 'on';
}
```

### علت ۳ — کوکی

```php
// wp-config.php — پاک کردن تنظیمات دامنه‌ی کوکی
define( 'COOKIE_DOMAIN', false );
define( 'ADMIN_COOKIE_PATH', '/' );
define( 'COOKIEPATH', '/' );
define( 'SITECOOKIEPATH', '/' );
```

کاربر را بگو کوکی‌های سایت را پاک کند و در پنجره‌ی ناشناس تست کند.

---

## 3) بازنشانی رمز عبور

```bash
# فهرست کاربران
wp user list --role=administrator --fields=ID,user_login,user_email

# تغییر رمز
wp user update 1 --user_pass='NewStrongPassword123!'

# ساخت ادمین جدید
wp user create emergency emergency@example.ir --role=administrator --user_pass='TempPass123!'
```

بدون WP-CLI، از phpMyAdmin:

```sql
UPDATE wp_users
SET user_pass = MD5('NewPassword123!')
WHERE user_login = 'admin';
```

⚠️ وردپرس هنگام ورود موفق، MD5 را خودکار به هش امن تبدیل می‌کند. اما این روش را فقط در اضطرار استفاده کن و بلافاصله بعدش از داخل پنل رمز را عوض کن.

روش امن‌تر با یک فایل موقت:
```php
<?php
// reset.php در ریشه — بعد از استفاده حتماً حذف کن
require_once 'wp-load.php';
wp_set_password( 'NewStrongPassword123!', 1 );  // 1 = user ID
echo 'done';
```
```bash
php reset.php && rm reset.php
```

---

## 4) ورود موفق، خروج فوری

علت‌ها:

| علت | تست | راه‌حل |
|---|---|---|
| ناسازگاری `home`/`siteurl` | §2 | همان |
| `AUTH_KEY` تغییر کرده | `wp-config.php` را نگاه کن | کلیدها را عوض کن (همه‌ی نشست‌ها خارج می‌شوند، اما تمیز) |
| ساعت سرور اشتباه | `date` | زمان سرور را درست کن |
| افزونه‌ی کش، صفحه‌ی لاگین را کش کرده | هدرها را ببین | `wp-login.php` و `wp-admin` را از کش استثنا کن |
| افزونه‌ی امنیتی نشست را باطل می‌کند | لاگ افزونه | §7 |

تولید کلیدهای جدید:
```bash
curl -s https://api.wordpress.org/secret-key/1.1/salt/
```
جایگزین بلوک `AUTH_KEY` تا `NONCE_SALT` در `wp-config.php`.

استثنا کردن لاگین از کش (LiteSpeed نمونه):
```
# در تنظیمات افزونه، Do Not Cache URIs:
/wp-login.php
/wp-admin
```

---

## 5) «دسترسی کافی ندارید»

نقش کاربر خراب شده یا پیشوند جدول عوض شده.

```bash
# بررسی نقش
wp user get 1 --field=roles

# بازگرداندن نقش
wp user set-role 1 administrator

# اگر جدول capabilities با پیشوند غلط است
wp db query "SELECT * FROM wp_usermeta WHERE user_id = 1 AND meta_key LIKE '%capabilities%';"
```

اگر پیشوند جدول‌ها `wp_` نیست (مثلاً `wpx_`)، کلید متا باید `wpx_capabilities` باشد:

```sql
UPDATE wp_usermeta SET meta_key = 'wpx_capabilities' WHERE meta_key = 'wp_capabilities' AND user_id = 1;
UPDATE wp_usermeta SET meta_key = 'wpx_user_level'   WHERE meta_key = 'wp_user_level'   AND user_id = 1;
```

بازسازی نقش‌های پیش‌فرض:
```php
<?php
// mu-plugins/reset-roles.php — یک‌بار اجرا، بعد حذف
require_once ABSPATH . 'wp-admin/includes/schema.php';
populate_roles();
```

---

## 6) ایمیل بازیابی نمی‌رسد

بسیار رایج روی هاست‌های ایرانی — `wp_mail()` با تابع `mail()` کار می‌کند و اغلب یا خاموش است یا ایمیل به اسپم می‌رود.

```bash
# تست ارسال
wp eval 'var_dump( wp_mail( "test@gmail.com", "تست", "متن تست" ) );'

# ایمیل مدیر
wp option get admin_email
```

اگر `true` برمی‌گرداند ولی ایمیل نمی‌رسد، مشکل تحویل است نه ارسال.

راه‌حل پایدار: SMTP.
```php
// mu-plugins/smtp.php
add_action( 'phpmailer_init', function ( $phpmailer ) {
    $phpmailer->isSMTP();
    $phpmailer->Host       = 'smtp.example.com';
    $phpmailer->SMTPAuth   = true;
    $phpmailer->Port       = 587;
    $phpmailer->Username   = 'user@example.ir';
    $phpmailer->Password   = defined( 'SMTP_PASS' ) ? SMTP_PASS : '';
    $phpmailer->SMTPSecure = 'tls';
    $phpmailer->From       = 'no-reply@example.ir';
    $phpmailer->FromName   = 'نام سایت';
} );
```
رمز را در `wp-config.php` بگذار، نه در کد افزونه:
```php
define( 'SMTP_PASS', '...' );
```

برای بازیابی فوری، به ایمیل نیازی نیست — از §3 استفاده کن.

---

## 7) افزونه‌ی امنیتی IP را بلاک کرده

```bash
# پیدا کردن افزونه‌ی امنیتی
wp plugin list --status=active --field=name | grep -iE 'wordfence|ithemes|sucuri|all-in-one-wp-security|limit-login|loginizer'

# غیرفعال‌سازی اضطراری
wp plugin deactivate wordfence
```

بدون WP-CLI: پوشه‌ی افزونه را در `wp-content/plugins` rename کن.

بعد از بازگشت دسترسی، IP خودت را در whitelist بگذار.

**نکته:** افزونه‌های «محدودکننده‌ی تلاش ورود» با IP اشتراکی (که در ایران رایج است) کاربران بی‌گناه را قفل می‌کنند. آستانه را منطقی تنظیم کن.

---

## 8) تغییر آدرس صفحه‌ی ورود

اگر افزونه‌ای آدرس لاگین را عوض کرده و یادت رفته:

```bash
wp option list --search='*login*' --format=table
wp option get whl_page          # WPS Hide Login
```

یا افزونه را غیرفعال کن تا `wp-login.php` برگردد.

---

## 9) چک‌لیست اضطراری

```
[ ] home و siteurl یکسان و درست‌اند
[ ] HTTPS پشت پروکسی تشخیص داده می‌شود
[ ] wp-login.php و wp-admin از کش استثنا شده‌اند
[ ] کوکی مرورگر پاک و در پنجره‌ی ناشناس تست شد
[ ] نقش کاربر administrator است
[ ] پیشوند کلید capabilities با پیشوند جدول می‌خواند
[ ] افزونه‌ی امنیتی بررسی شد
[ ] کاربر اضطراری ساخته شد (و بعداً حذف شود)
[ ] فایل‌های موقت (reset.php و مشابه) حذف شدند
[ ] بعد از رفع، رمزها و کلیدها عوض شدند
```
