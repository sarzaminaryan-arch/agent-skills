# لایه‌های کش و جایی که بی‌صدا کار نمی‌کنند

---

## 1) پنج لایه

```
مرورگر  →  CDN  →  کش سرور (LiteSpeed/nginx/Varnish)  →  کش صفحه (افزونه)  →  کش شیء (Redis/Memcached)  →  PHP+MySQL
```

هر لایه که HIT بدهد، لایه‌های بعدی اصلاً اجرا نمی‌شوند. اگر TTFB بالا است، بفهم کدام لایه MISS می‌دهد — نه اینکه افزونه‌ی دیگری نصب کنی.

---

## 2) انتخاب افزونه بر اساس سرور

| سرور | انتخاب |
|---|---|
| **LiteSpeed / OpenLiteSpeed** | **LiteSpeed Cache** — رایگان، کش در سطح سرور، بهترین گزینه. روی سرور غیر-LiteSpeed نصف قابلیت‌هایش خاموش است. |
| Apache | WP Super Cache (رایگان) یا WP Rocket (تجاری) |
| nginx | FastCGI cache در سطح سرور + Nginx Helper برای پاک‌سازی |
| مدیریت‌شده (Kinsta/WP Engine و مشابه) | کش خودِ میزبان؛ افزونه‌ی کش نصب نکن |

**نکته برای هاست‌های ایرانی:** اکثر هاست‌های اشتراکی ایرانی LiteSpeed دارند. `wp-config.php` یا پنل را نگاه کن؛ اگر LiteSpeed است، LiteSpeed Cache تنها انتخاب منطقی است.

```bash
curl -sI https://example.ir/ | grep -i 'server\|x-litespeed\|x-powered-by'
```

---

## 3) چرا کش HIT نمی‌دهد

مهم‌ترین بخش این فایل.

| علت | تشخیص | راه‌حل |
|---|---|---|
| **کاربر لاگین است** | با کوکی لاگین تست کن | طبیعی است؛ برای کاربر لاگین کش صفحه کار نمی‌کند |
| **کوکی مزاحم** | هر افزونه‌ای که برای مهمان کوکی می‌گذارد (آمار، A/B، نظرسنجی) | کوکی را در تنظیم کش استثنا کن یا افزونه را حذف کن |
| **پارامتر کوئری** | `?utm_source=...` کش را دور می‌زند | پارامترهای بازاریابی را در تنظیم کش نادیده بگیر |
| **سبد خرید ووکامرس** | صفحه‌های cart/checkout/account همیشه MISS | درست است؛ آن‌ها را استثنا نگه دار |
| **AJAX/REST** | `admin-ajax.php` کش نمی‌شود | کوئری‌های سنگین را به REST با کش انتقال بده |
| **هدر `Cache-Control: no-cache` از افزونه** | `curl -sI` | افزونه‌ی مقصر را پیدا کن |
| **کش پاک شده در هر انتشار** | سایت خبری پرانتشار | TTL و قواعد purge را تنظیم کن |
| **صفحه ۴۰۴ یا ریدایرکت** | کد وضعیت | اصلاح مسیر |

تست HIT/MISS:
```bash
URL="https://example.ir/some-post/"
curl -s -o /dev/null "$URL"                       # گرم کردن
curl -sI "$URL" | grep -iE 'x-cache|x-litespeed-cache|cf-cache-status|x-fastcgi-cache|age'
```

اگر هیچ هدر کشی برنمی‌گردد، کش یا نصب نیست یا اصلاً اجرا نمی‌شود.

---

## 4) کش شیء (Object Cache)

کش صفحه فقط به مهمان کمک می‌کند. کش شیء به **ادمین و کاربر لاگین** کمک می‌کند — یعنی همان جایی که سایت‌های فارسی معمولاً فاجعه‌اند.

```bash
# آیا Redis در دسترس است؟
redis-cli ping                  # PONG
wp redis status                 # با افزونه‌ی Redis Object Cache

# بررسی فعال بودن
wp cache type
ls -l wp-content/object-cache.php
```

نصب:
```bash
wp plugin install redis-cache --activate
wp redis enable
```

```php
// wp-config.php
define( 'WP_REDIS_HOST', '127.0.0.1' );
define( 'WP_REDIS_PORT', 6379 );
define( 'WP_REDIS_PREFIX', 'site1_' );   // الزامی اگر چند سایت روی یک Redis
define( 'WP_REDIS_MAXTTL', 86400 );
```

⚠️ اگر چند سایت روی یک Redis بدون `WP_REDIS_PREFIX` باشند، داده‌هایشان قاطی می‌شود. این باگ سخت‌یابی است.

اگر Redis نیست (رایج در هاست اشتراکی ایرانی): کش شیء پایدار نداری. آن‌وقت اولویت با کاهش کوئری و autoload است — `database-and-autoload.md`.

---

## 5) کش مرورگر

```apache
# .htaccess — Apache
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css                 "access plus 1 year"
  ExpiresByType application/javascript   "access plus 1 year"
  ExpiresByType font/woff2               "access plus 1 year"
  ExpiresByType image/webp               "access plus 1 year"
  ExpiresByType image/avif               "access plus 1 year"
  ExpiresByType text/html                "access plus 0 seconds"
</IfModule>

<IfModule mod_headers.c>
  <FilesMatch "\.(css|js|woff2|webp|avif|svg)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
</IfModule>
```

```nginx
location ~* \.(css|js|woff2|webp|avif|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;
}
```

`max-age` طولانی فقط وقتی امن است که نام فایل نسخه‌دار باشد (`style.css?ver=1.2.3` یا `style.a1b2c3.css`). وردپرس با `wp_enqueue_style( ..., $ver )` این را می‌دهد.

---

## 6) بهینه‌سازی JS/CSS — جایی که سایت می‌شکند

روی قالب‌های تجاری ایرانی و Elementor، این گزینه‌ها اغلب سایت را خراب می‌کنند.

| گزینه | ریسک | توصیه |
|---|---|---|
| Minify CSS | کم | ✅ روشن |
| Minify JS | کم‌متوسط | ✅ روشن، بعد تست |
| Combine CSS | متوسط | ⚠️ با HTTP/2 سود کمی دارد؛ ارزش ریسک ندارد |
| Combine JS | **بالا** | ❌ ترتیب وابستگی jQuery را می‌شکند |
| Defer JS | **بالا** | ⚠️ فقط با استثنای jQuery |
| Delay JS | بالا | ⚠️ اسلایدر و فرم را می‌شکند |
| Remove unused CSS | **بالا** | ⚠️ استایل RTL و کلاس‌های داینامیک را حذف می‌کند |
| Lazy load تصاویر | کم | ✅ اما نه روی تصویر LCP |
| Critical CSS | متوسط | ✅ اگر ابزار درست تولیدش کند |

**روش ایمن:** یک گزینه را روشن کن → صفحه‌ی اصلی، یک نوشته، یک صفحه‌ی فرم، و سبد خرید را تست کن → بعدی.

**مخصوص RTL:** «Remove unused CSS» معمولاً `style-rtl.css` یا قواعد `[dir="rtl"]` را حذف می‌کند چون در تحلیل اولیه دیده نمی‌شوند. اگر بعد از فعال‌سازی، چیدمان چپ‌چین شد، همین است.

---

## 7) کرون

`wp-cron` پیش‌فرض روی هر بازدید اجرا می‌شود — روی سایت پرترافیک هدررفت است، روی سایت کم‌ترافیک کارها اجرا نمی‌شوند.

```php
// wp-config.php
define( 'DISABLE_WP_CRON', true );
```

```bash
# کرون واقعی سرور، هر ۵ دقیقه
*/5 * * * * cd /home/user/public_html && /usr/bin/php wp-cron.php > /dev/null 2>&1
```

بررسی کارهای معلق:
```bash
wp cron event list --format=table
wp cron event list --fields=hook,next_run_relative --status=due
```

رویدادهای زیاد و تکراری معمولاً از افزونه‌های حذف‌نشده مانده‌اند.

---

## 8) چک‌لیست

```
[ ] نوع سرور مشخص و افزونه‌ی کش متناسب انتخاب شده
[ ] فقط یک افزونه‌ی کش فعال است
[ ] هدر HIT بعد از گرم‌کردن برمی‌گردد
[ ] TTFB سرد و گرم تفاوت معنادار دارند
[ ] کش شیء (Redis) فعال است یا عدم دسترسی ثبت شده
[ ] WP_REDIS_PREFIX روی سرور چندسایتی ست شده
[ ] کش مرورگر برای استاتیک یک‌ساله است
[ ] gzip/brotli روشن است
[ ] گزینه‌های پرریسک یکی‌یکی و با تست فعال شده‌اند
[ ] چیدمان RTL بعد از بهینه‌سازی سالم است
[ ] wp-cron به کرون سرور منتقل شده
```
