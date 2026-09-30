# قالب و صفحه‌ساز — جایی که یک مگابایت گم می‌شود

---

## 1) تشخیص وزن قالب

```bash
# حجم دارایی‌های قالب فعال
THEME=$(wp theme list --status=active --field=name)
du -sh "wp-content/themes/$THEME"
find "wp-content/themes/$THEME" -name '*.js' -printf '%10s %p\n' | sort -rn | head -10
find "wp-content/themes/$THEME" -name '*.css' -printf '%10s %p\n' | sort -rn | head -10
```

```php
// فهرست همه‌ی اسکریپت/استایل صف‌شده در فرانت — موقت
add_action( 'wp_print_footer_scripts', function () {
    global $wp_scripts, $wp_styles;
    error_log( 'SCRIPTS: ' . implode( ', ', $wp_scripts->done ) );
    error_log( 'STYLES: '  . implode( ', ', $wp_styles->done ) );
}, 9999 );
```

---

## 2) قالب‌های چندمنظوره

قالب‌هایی مثل Avada، Betheme، The7، و قالب‌های تجاری ایرانی معمولاً همه‌ی امکاناتشان را روی همه‌ی صفحات لود می‌کنند.

الگوی اصلاح:

```php
add_action( 'wp_enqueue_scripts', function () {
    // اسلایدر فقط در صفحه‌ی اصلی
    if ( ! is_front_page() ) {
        wp_dequeue_script( 'theme-slider' );
        wp_dequeue_style( 'theme-slider' );
    }
    // نقشه فقط در صفحه‌ی تماس
    if ( ! is_page( 'contact' ) ) {
        wp_dequeue_script( 'google-maps' );
    }
    // ووکامرس فقط در صفحات فروشگاه
    if ( function_exists( 'is_woocommerce' ) && ! is_woocommerce() && ! is_cart() && ! is_checkout() ) {
        wp_dequeue_style( 'woocommerce-general' );
        wp_dequeue_style( 'woocommerce-layout' );
        wp_dequeue_style( 'woocommerce-smallscreen' );
        wp_dequeue_script( 'wc-cart-fragments' );
    }
}, 100 );
```

⚠️ `wc-cart-fragments` روی هر بارگذاری یک درخواست AJAX می‌زند و کش را دور می‌زند. اگر سبد خرید شناور نداری، خاموشش کن.

**اولویت ۱۰۰** مهم است — باید بعد از صف‌شدن اجرا شود.

---

## 3) Elementor

Elementor به‌تنهایی ~۳۰۰–۵۰۰ کیلوبایت CSS/JS اضافه می‌کند.

```php
// فونت‌های گوگل
add_filter( 'elementor/frontend/print_google_fonts', '__return_false' );
```

در تنظیمات Elementor (`Settings → Features / Performance`):
- `Improved CSS Loading` → روشن
- `Inline Font Icons` → روشن
- `Optimized DOM Output` → روشن
- `Element Caching` → روشن (نسخه‌های جدید)
- ویجت‌های استفاده‌نشده را در `Experiments` خاموش کن

Font Awesome و eicons:
```php
add_action( 'wp_enqueue_scripts', function () {
    wp_dequeue_style( 'elementor-icons' );
    wp_dequeue_style( 'font-awesome' );
    wp_dequeue_style( 'elementor-icons-shared-0' );
    wp_dequeue_style( 'elementor-icons-fa-solid' );
}, 100 );
```
(فقط اگر واقعاً از آیکون‌هایشان استفاده نمی‌کنی.)

**نکته‌ی مهم:** اگر سایت را از صفر می‌سازی، ویرایشگر بلوک + قالب بلوکی سبک‌تر از Elementor است. برای بازسازی سایت موجود، مهاجرت پرهزینه است — با dequeue کار کن. راهنمای ساخت با بلوک در `wp-persian-homepage`.

---

## 4) jQuery و افزونه‌هایش

سایت‌های فارسی معمولاً هنوز به jQuery وابسته‌اند.

```bash
# چه کسی jQuery را وابسته دارد
grep -rn "jquery" wp-content/themes/*/functions.php wp-content/plugins/*/*.php --include='*.php' \
  | grep -i "wp_enqueue_script" | head -20
```

- jQuery را حذف نکن مگر مطمئن باشی هیچ‌کس استفاده نمی‌کند — نیمی از سایت خاموش می‌شود.
- `jquery-migrate` معمولاً قابل حذف است:

```php
add_action( 'wp_default_scripts', function ( $scripts ) {
    if ( ! is_admin() && isset( $scripts->registered['jquery'] ) ) {
        $scripts->registered['jquery']->deps = array_diff(
            $scripts->registered['jquery']->deps,
            array( 'jquery-migrate' )
        );
    }
} );
```

بعد از این، کنسول مرورگر را برای خطای jQuery بررسی کن.

---

## 5) امکانات هسته که معمولاً لازم نیستند

```php
// ایموجی — ~15KB JS + یک درخواست
add_action( 'init', function () {
    remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
    remove_action( 'wp_print_styles', 'print_emoji_styles' );
    remove_action( 'admin_print_scripts', 'print_emoji_detection_script' );
    remove_action( 'admin_print_styles', 'print_emoji_styles' );
    add_filter( 'tiny_mce_plugins', function ( $p ) {
        return is_array( $p ) ? array_diff( $p, array( 'wpemoji' ) ) : array();
    } );
} );

// CSS ویرایشگر بلوک در فرانت — فقط اگر از بلوک‌ها استفاده نمی‌کنی
add_action( 'wp_enqueue_scripts', function () {
    wp_dequeue_style( 'wp-block-library' );
    wp_dequeue_style( 'wp-block-library-theme' );
    wp_dequeue_style( 'global-styles' );
    wp_dequeue_style( 'classic-theme-styles' );
}, 100 );

// oEmbed
add_action( 'init', function () {
    remove_action( 'wp_head', 'wp_oembed_add_discovery_links' );
    remove_action( 'wp_head', 'wp_oembed_add_host_js' );
} );

// XML-RPC اگر استفاده نمی‌شود
add_filter( 'xmlrpc_enabled', '__return_false' );

// حذف اطلاعات نسخه
remove_action( 'wp_head', 'wp_generator' );
remove_action( 'wp_head', 'rsd_link' );
remove_action( 'wp_head', 'wlwmanifest_link' );
```

⚠️ `wp-block-library` را فقط وقتی حذف کن که از ویرایشگر بلوک استفاده نمی‌کنی. در قالب بلوکی، حذفش صفحه را خراب می‌کند.

---

## 6) افزونه‌های سنگین رایج

| افزونه | هزینه | جایگزین |
|---|---|---|
| اسلایدرهای بزرگ (Revolution/LayerSlider) | ۳۰۰–۷۰۰ KB | تصویر ثابت hero؛ اسلایدر تقریباً هیچ‌وقت ارزشش را ندارد |
| افزونه‌های آمار بازدید داخلی | کوئری روی هر بازدید | آمار سمت سرور یا سرویس خارجی سبک |
| افزونه‌های چت آنلاین | ۲۰۰–۵۰۰ KB JS طرف سوم | بارگذاری با تأخیر یا فقط در صفحات خاص |
| Contact Form 7 (سراسری) | CSS/JS در همه‌ی صفحات | فقط در صفحه‌ی فرم لود کن |
| افزونه‌های اشتراک‌گذاری اجتماعی | JS + آیکون‌فونت | لینک ساده با SVG |
| افزونه‌های امنیتی سنگین | کوئری و لاگ روی هر درخواست | فایروال سطح سرور |
| افزونه‌های مرتبط‌سازی نوشته | کوئری سنگین | کش نتیجه در transient |

Contact Form 7 فقط در صفحه‌ی فرم:
```php
add_action( 'wp_enqueue_scripts', function () {
    if ( ! is_page( array( 'contact', 'تماس-با-ما' ) ) ) {
        wp_dequeue_script( 'contact-form-7' );
        wp_dequeue_style( 'contact-form-7' );
    }
}, 100 );
```

---

## 7) اسکریپت‌های طرف سوم

هر اسکریپت خارجی = یک DNS + TLS + دانلود. برای کاربر ایرانی، بعضی از این‌ها کلاً در دسترس نیستند و **صفحه را تا timeout معطل می‌کنند**.

```bash
# پیدا کردن دامنه‌های خارجی در خروجی
curl -s https://example.ir/ | grep -oE 'https?://[a-zA-Z0-9.-]+' | sort -u | grep -v example.ir
```

قواعد:
- هر دامنه‌ی خارجی را توجیه کن یا حذف.
- گوگل آنالیتیکس/تگ‌منیجر: `async`، و بهتر است با تأخیر.
- فونت گوگل: self-host.
- ویدیو: به‌جای embed سنگین، تصویر پیش‌نمایش با کلیک برای بارگذاری (facade).
- هیچ اسکریپت خارجی در `<head>` به‌صورت blocking نباشد.

---

## 8) چک‌لیست

```
[ ] فهرست کامل اسکریپت/استایل‌های صف‌شده گرفته شده
[ ] دارایی‌های غیرضروری بر اساس صفحه dequeue شده‌اند
[ ] wc-cart-fragments بررسی شده
[ ] گزینه‌های عملکردی Elementor فعال شده‌اند
[ ] jquery-migrate حذف شده و کنسول تمیز است
[ ] ایموجی، oEmbed، XML-RPC بررسی شده‌اند
[ ] اسلایدر سنگین با تصویر ثابت جایگزین شده
[ ] فرم و چت فقط در صفحات لازم لود می‌شوند
[ ] هیچ اسکریپت خارجی blocking در head نیست
[ ] بعد از هر dequeue، صفحه‌ی مربوطه بصری تست شده
```
