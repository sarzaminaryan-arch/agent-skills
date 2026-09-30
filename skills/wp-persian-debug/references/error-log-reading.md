# خواندن لاگ خطا

لاگ وردپرس معمولاً ۹۵٪ نویز است. این فایل می‌گوید چطور ۵٪ مفید را پیدا کنی.

---

## 1) کجا لاگ می‌نویسد

```php
// wp-config.php
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );          // → wp-content/debug.log
define( 'WP_DEBUG_DISPLAY', false );
@ini_set( 'display_errors', 0 );
```

اگر ساخته نشد، به‌ترتیب بررسی کن:

```bash
# 1) مجوز نوشتن wp-content
ls -ld wp-content
touch wp-content/debug.log && echo writable

# 2) مسیر error_log خود PHP
php -i 2>/dev/null | grep '^error_log'
wp eval 'echo ini_get("error_log");'

# 3) مسیرهای رایج هاست‌ها
ls -la error_log ../error_log ../logs/error_log /var/log/php*.log 2>/dev/null

# 4) آیا ثابت قبل از استفاده تعریف شده؟ باید بالای «That's all» باشد
grep -n "WP_DEBUG\|stop editing" wp-config.php
```

مسیر سفارشی (خارج از web root، امن‌تر):
```php
define( 'WP_DEBUG_LOG', '/home/user/private/wp-errors.log' );
```

---

## 2) فیلتر کردن نویز

```bash
# فقط خطاهای مرگبار
grep -i 'fatal' wp-content/debug.log | tail -20

# مرگبار + استثنا + هشدار جدی، بدون deprecation
grep -iE 'fatal|uncaught|parse error' wp-content/debug.log | tail -30

# حذف نویز deprecation و notice
grep -viE 'deprecated|notice:' wp-content/debug.log | tail -40

# فقط خطاهای امروز
grep "$(date '+%d-%b-%Y')" wp-content/debug.log | grep -i fatal

# شمارش انواع خطا
grep -oE 'PHP [A-Za-z ]+:' wp-content/debug.log | sort | uniq -c | sort -rn
```

پاک‌کردن لاگ برای شروع تمیز قبل از بازتولید:
```bash
> wp-content/debug.log
# حالا مشکل را بازتولید کن
tail -f wp-content/debug.log
```

`tail -f` در کنار بازتولید زنده، سریع‌ترین راه است.

---

## 3) اولویت خطاها

| سطح | اقدام |
|---|---|
| `PHP Fatal error` | ❗ همین حالا. سایت خراب است. |
| `PHP Parse error` | ❗ خطای نحوی، فایل اجرا نمی‌شود |
| `Uncaught Error` / `Uncaught Exception` | ❗ همین |
| `PHP Warning` | ⚠️ ممکن است علامت مشکل بزرگ‌تر باشد |
| `PHP Notice` | نویز، مگر تکرار زیاد |
| `PHP Deprecated` | نویز فعلاً، بدهی فنی برای ارتقای PHP بعدی |
| `WordPress database error` | ⚠️ مهم — جدول گم‌شده یا کوئری خراب |

---

## 4) الگوهای رایج در سایت‌های فارسی

### `Deprecated` انبوه بعد از ارتقای PHP

```
PHP Deprecated: Creation of dynamic property X::$y is deprecated in ...
PHP Deprecated: Passing null to parameter #1 ($string) of type string is deprecated
```

قالب‌ها و افزونه‌های قدیمی ایرانی روی PHP 8.1+ هزاران خط از این تولید می‌کنند. لاگ را پر می‌کند و دیسک را می‌خورد.

موقتاً خاموش کردن نویز، بدون خاموش‌کردن خطاهای واقعی:
```php
// wp-config.php
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );
@ini_set( 'error_reporting', E_ALL & ~E_DEPRECATED & ~E_NOTICE & ~E_STRICT );
```

⚠️ این راه‌حل دائمی نیست. `wp-phpstan` را برای رفع ریشه‌ای ببین.

### `WordPress database error`

```
WordPress database error Table 'db.wp_xyz' doesn't exist for query SELECT ...
```

معمولاً افزونه‌ای حذف شده اما کدش (یا mu-plugin یا کرون) هنوز جدولش را می‌خواهد.

```bash
wp cron event list | grep -i xyz
ls wp-content/mu-plugins/
```

### `Allowed memory size exhausted`

خط بعدی لاگ می‌گوید کجا. اگر همیشه در یک افزونه است، آن افزونه مقصر است نه حافظه.

### درخواست خارجی معلق

```
cURL error 28: Operation timed out after 30000 milliseconds
```

روی سرورهای ایرانی رایج است: افزونه‌ای که به یک API خارجی وصل می‌شود که در دسترس نیست. صفحه را تا timeout معطل می‌کند.

```bash
grep -i 'curl error\|http_request_failed' wp-content/debug.log | sort | uniq -c | sort -rn | head
```

راه‌حل: timeout را کوتاه کن یا درخواست را حذف/کش کن.
```php
add_filter( 'http_request_timeout', function () { return 5; } );
add_filter( 'http_request_args', function ( $args, $url ) {
    if ( str_contains( $url, 'slow-external-api.com' ) ) {
        $args['timeout'] = 3;
    }
    return $args;
}, 10, 2 );
```

---

## 5) لاگ سرور در برابر لاگ وردپرس

| لاگ | چه چیزی دارد |
|---|---|
| `wp-content/debug.log` | خطاهای PHP در سطح وردپرس |
| `error_log` (Apache/cPanel) | خطاهای PHP + وب‌سرور، شامل ۵۰۰ و segfault |
| `access_log` | همه‌ی درخواست‌ها با کد وضعیت — برای الگوی ۵۰۰ و ۴۰۴ |
| لاگ ModSecurity | درخواست‌های بلاک‌شده — علت ۴۰۳ مرموز |
| لاگ MySQL slow query | کوئری‌های کند |
| لاگ PHP-FPM | ۵۰۲، worker exhaustion |

اگر `debug.log` خالی است اما سایت ۵۰۰ می‌دهد، خطا قبل از بارگذاری وردپرس رخ داده — لاگ سرور را ببین.

```bash
# الگوی کدهای وضعیت در access log
awk '{print $9}' access_log | sort | uniq -c | sort -rn | head

# آخرین ۵۰۰ها با URL
grep ' 500 ' access_log | tail -20 | awk '{print $7}'
```

---

## 6) لاگ‌گیری هدفمند

به‌جای روشن‌کردن همه‌چیز، فقط مسیر مشکوک را لاگ کن:

```php
// mu-plugins/debug-probe.php
add_action( 'shutdown', function () {
    if ( ! isset( $_GET['probe'] ) ) return;
    global $wpdb;
    error_log( sprintf(
        '[PROBE] %s | queries: %d | mem: %.1fMB | time: %.3fs',
        $_SERVER['REQUEST_URI'] ?? '-',
        $wpdb->num_queries,
        memory_get_peak_usage( true ) / 1048576,
        timer_stop( 0 )
    ) );
} );
```

سپس `https://example.ir/?probe=1` را بزن و لاگ را ببین. روی سایت زنده بی‌خطر است چون فقط با پارامتر فعال می‌شود.

ردیابی یک هوک خاص:
```php
add_action( 'template_redirect', function () {
    error_log( '[PROBE] template_redirect on ' . ( $_SERVER['REQUEST_URI'] ?? '-' ) );
}, 1 );
```

---

## 7) چرخش و پاک‌سازی لاگ

`debug.log` روی سایت شلوغ با deprecation انبوه، می‌تواند در یک هفته چند گیگابایت شود و دیسک را پر کند.

```bash
# حجم فعلی
du -h wp-content/debug.log

# خالی کردن بدون حذف فایل
> wp-content/debug.log

# چرخش ساده با cron
0 3 * * * cd /home/user/public_html && mv wp-content/debug.log wp-content/debug.log.1 && > wp-content/debug.log
```

**بعد از اتمام دیباگ، حتماً:**
```bash
rm -f wp-content/debug.log
# و ثابت‌ها را از wp-config.php بردار
```

`debug.log` در web root قابل دسترسی عمومی است و مسیرهای سرور را لو می‌دهد. اگر مجبوری نگهش داری:
```apache
# .htaccess در wp-content
<Files "debug.log">
  Require all denied
</Files>
```

---

## 8) چک‌لیست

```
[ ] مسیر لاگ پیدا و نوشتنی است
[ ] لاگ قبل از بازتولید خالی شد
[ ] مشکل بازتولید و لاگ زنده دیده شد
[ ] خطاهای مرگبار از نویز deprecation جدا شدند
[ ] فایل و خط دقیق استخراج شد
[ ] لاگ سرور هم بررسی شد (نه فقط debug.log)
[ ] cURL timeout و درخواست‌های خارجی بررسی شدند
[ ] بعد از اتمام، لاگ حذف و ثابت‌ها برداشته شدند
```
