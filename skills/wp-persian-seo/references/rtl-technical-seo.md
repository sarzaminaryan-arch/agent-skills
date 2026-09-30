# سئوی فنی RTL

---

## 1) زبان و جهت

پایه‌ی همه‌چیز. اگر این غلط باشد، بقیه بی‌اثر است.

```html
<html lang="fa-IR" dir="rtl">
```

بررسی:

```bash
curl -s https://example.ir | head -5 | grep -o '<html[^>]*>'
```

اگر `dir` نبود، در قالب:

```php
// functions.php — فقط اگر قالب language_attributes را درست صدا نمی‌زند
add_filter( 'language_attributes', function ( $output ) {
    if ( is_rtl() && false === strpos( $output, 'dir=' ) ) {
        $output .= ' dir="rtl"';
    }
    return $output;
} );
```

در قالب درست، `<html <?php language_attributes(); ?>>` کافی است و وردپرس با locale فارسی خودش `dir="rtl"` می‌گذارد.

### استایل RTL

- قالب‌های بلوکی: وردپرس خودش `style-rtl.css` را لود می‌کند اگر وجود داشته باشد.
- قالب‌های کلاسیک: `wp_style_add_data( 'theme-style', 'rtl', 'replace' );`
- در CSS مدرن از `margin-inline-start` به‌جای `margin-left` استفاده کن تا نیازی به فایل RTL جدا نباشد.

---

## 2) لوکال و تاریخ

```bash
wp option get WPLANG          # باید fa_IR باشد
wp language core list --status=installed
wp option get timezone_string # باید Asia/Tehran باشد
```

اگر `timezone_string` خالی و `gmt_offset` عددی است، به `Asia/Tehran` تغییرش بده — وگرنه تغییر ساعت و زمان انتشار مشکل‌ساز می‌شود.

---

## 3) سایت‌مپ

وردپرس ۵.۵+ سایت‌مپ داخلی دارد: `/wp-sitemap.xml`

اگر افزونه‌ی سئو داری، یکی را انتخاب کن و دیگری را خاموش:

```php
// خاموش کردن سایت‌مپ هسته وقتی Yoast/Rank Math فعال است
add_filter( 'wp_sitemaps_enabled', '__return_false' );
```

قواعد:
- فقط URLهای canonical و index-able در سایت‌مپ
- صفحات `noindex` نباید در سایت‌مپ باشند
- سایت‌مپ را در `robots.txt` اعلام کن
- بعد از تغییرات ساختاری دوباره در Search Console ارسال کن

---

## 4) robots.txt

```
User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php
Disallow: /?s=
Disallow: /search/
Disallow: /*?replytocom=
Disallow: /*?add-to-cart=

Sitemap: https://example.ir/wp-sitemap.xml
```

❌ هرگز `Disallow: /wp-content/` یا `/wp-includes/` — CSS و JS را می‌بندد و رندر گوگل خراب می‌شود.

بررسی:
```bash
curl -s https://example.ir/robots.txt
```

---

## 5) canonical

```
[ ] هر صفحه دقیقاً یک <link rel="canonical"> دارد
[ ] canonical مطلق است (با https و دامنه)
[ ] صفحه‌ی اول بایگانی به خودش canonical می‌دهد، نه به صفحه‌ی خانه
[ ] صفحات صفحه‌بندی‌شده به خودشان canonical می‌دهند
[ ] نسخه‌ی AMP (اگر هست) به نسخه‌ی اصلی canonical می‌دهد
```

مشکل رایج فارسی: بعضی قالب‌های ایرانی خودشان canonical می‌زنند و با افزونه‌ی سئو دوتایی می‌شود.

```bash
curl -s https://example.ir/some-post/ | grep -c 'rel="canonical"'   # باید 1 باشد
```

---

## 6) www و https و دامنه‌ی فارسی

- یکی از `www` یا بدون `www` را انتخاب و بقیه را ۳۰۱ کن.
- `home` و `siteurl` باید با https باشند:
```bash
wp option get home
wp option get siteurl
```
- **دامنه‌ی IDN فارسی** (`مثال.ایران`): در پس‌زمینه به punycode (`xn--...`) تبدیل می‌شود. اگر از آن استفاده می‌کنی، در `siteurl` شکل punycode را بگذار و canonical را همان نگه دار، وگرنه دو نسخه ایندکس می‌شود.

---

## 7) صفحات نازک و تکراری

معمول‌ترین منابع در سایت‌های فارسی:

| منبع | راه‌حل |
|---|---|
| صفحات پیوست (attachment) | ریدایرکت به نوشته‌ی والد یا `noindex` |
| بایگانی نویسنده در سایت تک‌نویسنده | `noindex` |
| بایگانی تاریخ | `noindex` |
| برچسب‌های تک‌نوشته | `noindex` یا حذف |
| صفحات نتیجه‌ی جستجو | `noindex` + `Disallow` |
| `?replytocom=` | `noindex` (افزونه‌های سئو خودکار می‌کنند) |
| نسخه‌ی چاپ | حذف یا canonical |

```php
// ریدایرکت صفحات پیوست
add_action( 'template_redirect', function () {
    if ( is_attachment() ) {
        $parent = wp_get_post_parent_id( get_queried_object_id() );
        wp_safe_redirect( $parent ? get_permalink( $parent ) : home_url(), 301 );
        exit;
    }
} );
```

---

## 8) Core Web Vitals و سئو

سرعت فاکتور رتبه است و در سایت‌های فارسی معمولاً بدترین بخش است (فونت‌های سنگین، اسلایدر، قالب‌های چندمنظوره).

این بخش کامل در اسکیل `wp-persian-speed` است. حداقل‌های سئویی:

```
[ ] LCP زیر ۲.۵ ثانیه روی موبایل ۴G
[ ] CLS زیر ۰.۱ (فونت فارسی مقصر اصلی است)
[ ] INP زیر ۲۰۰ میلی‌ثانیه
[ ] صفحه بدون جاوااسکریپت هم محتوای اصلی را نشان می‌دهد
```

---

## 9) موبایل

بیش از ۸۰٪ جستجوی فارسی موبایلی است.

```
[ ] viewport meta درست است
[ ] اندازه‌ی فونت پایه ≥ 16px (فارسی در سایز کوچک خواناتر نیست، برعکس)
[ ] line-height ≥ 1.8 برای متن فارسی روی موبایل
[ ] هدف‌های لمسی ≥ 44×44 پیکسل
[ ] بدون اسکرول افقی (مشکل رایج RTL)
[ ] پاپ‌آپ تمام‌صفحه‌ی مزاحم ندارد (جریمه‌ی گوگل)
```

تست اسکرول افقی:
```js
// در کنسول مرورگر
document.documentElement.scrollWidth > document.documentElement.clientWidth
```

---

## 10) چک‌لیست فنی

```
[ ] <html lang="fa-IR" dir="rtl">
[ ] WPLANG = fa_IR و timezone = Asia/Tehran
[ ] یک سایت‌مپ فعال، بدون صفحات noindex
[ ] robots.txt، بدون بستن wp-content
[ ] دقیقاً یک canonical در هر صفحه
[ ] www/non-www و http/https یکدست و ۳۰۱
[ ] صفحات پیوست و بایگانی‌های نازک noindex
[ ] بدون اسکرول افقی روی موبایل
[ ] CWV در محدوده‌ی سبز
```
