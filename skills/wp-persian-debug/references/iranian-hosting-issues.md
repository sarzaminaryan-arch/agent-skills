# مشکلات خاص هاست‌های ایرانی

---

## 1) خطای ۵۰۸ — Resource Limit Is Reached

پرتکرارترین خطای هاست اشتراکی ایرانی.

**معنی:** حساب شما از سهمیه‌ی CPU، حافظه، یا تعداد پردازش هم‌زمان (Entry Process) عبور کرده و سرور موقتاً درخواست‌ها را رد می‌کند.

### تشخیص

در cPanel → `Resource Usage` یا `CPU and Concurrent Connection Usage`. نمودار را نگاه کن: کدام منبع به سقف می‌خورد؟

| منبع | معنی | علت رایج |
|---|---|---|
| **Entry Processes** | تعداد اسکریپت PHP هم‌زمان | معمولاً سقف ۲۰ است؛ درخواست‌های کند صف می‌سازند |
| **CPU** | زمان پردازنده | کوئری سنگین، افزونه‌ی بدنوشته |
| **Physical Memory** | RAM | افزونه‌ی حافظه‌خوار |
| **I/O** | خواندن/نوشتن دیسک | لاگ‌نویسی زیاد، بکاپ |
| **IOPS** | تعداد عملیات دیسک | همان |

### علت‌های واقعی (به‌ترتیب احتمال)

1. **بدون کش صفحه** — هر بازدید یک پردازش PHP کامل. کش را روشن کن.
2. **wp-cron روی هر بازدید** — به کرون سرور منتقلش کن.
3. **ربات‌ها و خزنده‌ها** — گاهی نصف ترافیک. در `access_log` بررسی کن.
4. **`admin-ajax.php` پرتکرار** — معمولاً از `wc-cart-fragments` یا افزونه‌ی آمار.
5. **کوئری بی‌حد** — `posts_per_page => -1`.
6. **بکاپ در ساعت اوج** — زمان‌بندی را عوض کن.

```bash
# پرتکرارترین URLها در لاگ
awk '{print $7}' access_log | sort | uniq -c | sort -rn | head -20

# پرتکرارترین User-Agentها
awk -F'"' '{print $6}' access_log | sort | uniq -c | sort -rn | head -15

# نسبت admin-ajax
grep -c 'admin-ajax.php' access_log
```

### اقدام

```php
// wp-config.php
define( 'DISABLE_WP_CRON', true );
```
```bash
# کرون سرور
*/10 * * * * cd /home/user/public_html && /usr/bin/php wp-cron.php >/dev/null 2>&1
```
```php
// خاموش‌کردن cart fragments اگر سبد شناور نداری
add_action( 'wp_enqueue_scripts', function () {
    if ( ! is_cart() && ! is_checkout() ) {
        wp_dequeue_script( 'wc-cart-fragments' );
    }
}, 100 );
```

اگر بعد از همه‌ی این‌ها باز ۵۰۸ می‌گیری، پلن هاست کوچک است. `wp-persian-speed/references/hosting-and-cdn.md` §8.

---

## 2) LiteSpeed

اکثر هاست‌های اشتراکی ایرانی LiteSpeed دارند.

```bash
curl -sI https://example.ir/ | grep -i 'server\|x-litespeed'
```

### نکات

- **افزونه‌ی LiteSpeed Cache تنها انتخاب منطقی است** روی این سرورها. کش در سطح سرور انجام می‌شود، نه PHP.
- روی سرور غیر-LiteSpeed، این افزونه نصف امکاناتش خاموش است و بی‌فایده.
- `.htaccess` قواعد LiteSpeed را می‌گیرد؛ اگر افزونه‌ی دیگری آن را بازنویسی کند، کش می‌شکند.

### پاک‌سازی کش

```bash
wp litespeed-purge all
# یا
wp cache flush
```

### مشکل رایج: کش کهنه بعد از تغییر

```bash
# بررسی وضعیت کش
curl -sI https://example.ir/ | grep -i 'x-litespeed-cache'
# HIT = از کش، MISS = تازه ساخته شد
```

اگر بعد از ویرایش محتوا، تغییر دیده نمی‌شود، قواعد purge درست تنظیم نشده‌اند.

---

## 3) ModSecurity — خطای ۴۰۳ مرموز

ModSecurity یک فایروال سطح وب‌سرور است که روی اکثر هاست‌های اشتراکی ایرانی فعال است و **درخواست‌های کاملاً عادی وردپرس را بلاک می‌کند**.

### نشانه‌ها

- ۴۰۳ هنگام ذخیره‌ی نوشته‌ای که کد یا HTML دارد
- ۴۰۳ روی `wp-login.php` یا `admin-ajax.php`
- ۴۰۳ هنگام آپلود فایل
- خطا در ویرایشگر بلوک: "Updating failed. The response is not a valid JSON response."
- همه‌چیز در لوکال کار می‌کند، روی هاست نه

### تشخیص

```bash
# آیا ۴۰۳ از سرور است یا وردپرس؟
curl -sI -X POST https://example.ir/wp-admin/admin-ajax.php | head -3
```

اگر پاسخ خیلی سریع و بدون هدرهای وردپرس است، از ModSecurity است.

لاگ ModSecurity معمولاً در cPanel → `Errors` یا نزد پشتیبانی هاست است. شناسه‌ی قانون (rule ID) را بگیر.

### راه‌حل

1. **از پشتیبانی هاست بخواه قانون خاص را برای دامنه‌ات غیرفعال کند** — با rule ID دقیق. این بهترین راه است.
2. در cPanel اگر گزینه‌ی `ModSecurity` هست، موقتاً برای تست خاموشش کن (نه دائمی).
3. استثنا در `.htaccess` اگر هاست اجازه بدهد:

```apache
<IfModule mod_security.c>
  <Files "admin-ajax.php">
    SecRuleRemoveById 300015 300016
  </Files>
</IfModule>
```

⚠️ ModSecurity را کامل خاموش نکن — لایه‌ی امنیتی واقعی است. فقط قانون مشکل‌ساز را استثنا کن.

---

## 4) محدودیت آپلود

```bash
php -i | grep -E 'upload_max_filesize|post_max_size|max_file_uploads'
wp eval 'echo wp_max_upload_size() / 1048576 . " MB";'
```

```ini
; .user.ini در ریشه (روی اکثر هاست‌های ایرانی کار می‌کند)
upload_max_filesize = 64M
post_max_size = 64M
max_execution_time = 300
memory_limit = 256M
```

بعد از ساخت `.user.ini`، تا ۵ دقیقه طول می‌کشد تا اعمال شود (PHP آن را کش می‌کند).

اگر هاست اجازه نمی‌دهد، از پشتیبانی بخواه.

---

## 5) OPcache کهنه — «تغییراتم اعمال نمی‌شود»

روی سرورهایی که `opcache.validate_timestamps = 0` است، ویرایش فایل PHP هیچ اثری ندارد تا کش پاک شود.

```bash
php -i | grep -E 'opcache.enable|validate_timestamps|revalidate_freq'
```

پاک‌سازی:
```php
<?php
// clear-opcache.php در ریشه — بعد از استفاده حذف کن
if ( function_exists( 'opcache_reset' ) ) {
    var_dump( opcache_reset() );
} else {
    echo 'opcache not available';
}
```

یا در cPanel اگر گزینه‌اش هست، یا ری‌استارت PHP.

**علامت تشخیص:** فایل را با `echo "test";` عوض می‌کنی و هیچ اتفاقی نمی‌افتد.

---

## 6) نسخه‌ی PHP

```bash
php -v
wp cli info | grep 'PHP binary\|PHP version'
```

مسئله‌ی رایج: نسخه‌ی PHP در CLI با نسخه‌ای که وب‌سرور استفاده می‌کند فرق دارد.

```bash
# نسخه‌ای که وب‌سرور واقعاً استفاده می‌کند
echo '<?php echo PHP_VERSION;' > ver.php && curl -s https://example.ir/ver.php && rm ver.php
```

تغییر نسخه در cPanel → `MultiPHP Manager` یا `Select PHP Version`.

⚠️ قبل از ارتقا به PHP 8، سازگاری قالب و افزونه‌ها را روی استیجینگ تست کن. قالب‌های تجاری ایرانی قدیمی معمولاً با `TypeError` می‌شکنند.

---

## 7) مسائل شبکه‌ای

### درخواست به API خارجی معلق می‌ماند

```
cURL error 28: Operation timed out
cURL error 6: Could not resolve host
```

روی سرورهای ایرانی رایج است. افزونه‌ای که به سرویس خارجی وصل می‌شود، صفحه را تا timeout معطل می‌کند.

```php
// کاهش timeout سراسری
add_filter( 'http_request_timeout', function () { return 5; } );

// یا بلاک کردن یک میزبان خاص
add_filter( 'pre_http_request', function ( $pre, $args, $url ) {
    if ( str_contains( $url, 'unreachable-service.com' ) ) {
        return new WP_Error( 'blocked', 'blocked locally' );
    }
    return $pre;
}, 10, 3 );
```

پیدا کردن مقصر:
```bash
grep -iE 'curl error|http_request_failed' wp-content/debug.log | sort | uniq -c | sort -rn | head
```

### به‌روزرسانی وردپرس/افزونه شکست می‌خورد

معمولاً چون `api.wordpress.org` یا `downloads.wordpress.org` در دسترس نیست.

```bash
curl -sI https://api.wordpress.org/core/version-check/1.7/ | head -1
curl -sI https://downloads.wordpress.org/ | head -1
```

اگر در دسترس نیست:
- به‌روزرسانی را دستی انجام بده (دانلود فایل و آپلود با FTP)
- یا از میرور استفاده کن
- `wp core update --version=6.8 --force` با فایل محلی

### گوگل‌بات بلاک می‌شود

```bash
curl -s -A "Googlebot/2.1" -o /dev/null -w '%{http_code}\n' https://example.ir/
```

اگر ۴۰۳ داد، فایروال یا افزونه‌ی امنیتی مقصر است. `wp-persian-seo/references/indexing-troubleshooting.md` §8.

---

## 8) بکاپ و انتقال

### مشکل رایج: بکاپ ناقص

```bash
# بررسی سلامت بکاپ SQL قبل از اعتماد به آن
tail -5 backup.sql          # باید با یک دستور کامل تمام شود
grep -c 'INSERT INTO' backup.sql
grep -a -m1 'وردپرس\|آموزش' backup.sql | head -c 200   # فارسی سالم است؟
```

### انتقال بین هاست‌ها

```bash
# مبدأ
wp db export migration.sql
tar czf content.tar.gz wp-content/

# مقصد
wp db import migration.sql
tar xzf content.tar.gz
wp search-replace 'https://old-domain.ir' 'https://new-domain.ir' --all-tables --precise --report-changed-only
wp rewrite flush --hard
wp cache flush
```

⚠️ `--precise` الزامی است تا داده‌ی سریالایزشده خراب نشود. بدون آن، تنظیمات قالب و افزونه‌ها از بین می‌روند.

---

## 9) چک‌لیست هاست

```
[ ] نوع وب‌سرور مشخص است (LiteSpeed/Apache/nginx)
[ ] نسخه‌ی PHP وب‌سرور (نه CLI) بررسی شد
[ ] محدودیت Entry Process و CPU بررسی شد
[ ] کش صفحه فعال و HIT می‌دهد
[ ] wp-cron به کرون سرور منتقل شده
[ ] ModSecurity به‌عنوان علت ۴۰۳ بررسی شد
[ ] OPcache به‌عنوان علت «تغییر اعمال نمی‌شود» بررسی شد
[ ] درخواست‌های خارجی معلق شناسایی شدند
[ ] گوگل‌بات ۲۰۰ می‌گیرد
[ ] بکاپ سالم و با فارسی درست تست شد
```
