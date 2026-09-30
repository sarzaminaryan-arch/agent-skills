# فونت فارسی — بزرگ‌ترین برد سرعتی

در سایت‌های فارسی، فونت معمولاً بین ۴۰۰ کیلوبایت تا ۲ مگابایت از وزن صفحه را می‌گیرد و بیشترِ CLS را می‌سازد. اول اینجا را درست کن.

---

## 1) چرا فونت فارسی سنگین است

- گلیف‌های فارسی چهار شکل دارند (ابتدا، میانه، انتها، منفرد) → تعداد گلیف بالا
- بیشتر فونت‌های فارسی گلیف‌های عربی، اردو و لاتین را هم دارند
- سایت‌ها معمولاً ۴ تا ۷ وزن لود می‌کنند در حالی که ۲ تا کافی است
- قالب‌های ایرانی اغلب فونت را با `@font-face` در `ttf` یا `eot` لود می‌کنند (۳ تا ۵ برابر `woff2`)
- گاهی هم‌زمان دو خانواده فونت لود می‌شود (یکی از قالب، یکی از افزونه)

---

## 2) ممیزی فعلی

```bash
# فایل‌های فونت و حجمشان
find wp-content -type f \( -name '*.woff2' -o -name '*.woff' -o -name '*.ttf' -o -name '*.eot' -o -name '*.otf' \) \
  -printf '%10s  %p\n' | sort -rn | head -30

# مجموع حجم
find wp-content -type f \( -name '*.woff2' -o -name '*.ttf' -o -name '*.woff' \) -printf '%s\n' | awk '{s+=$1} END {printf "%.0f KB\n", s/1024}'

# کجا @font-face تعریف شده
grep -rn '@font-face' wp-content/themes wp-content/plugins --include='*.css' -l | head

# فونت از CDN خارجی لود می‌شود؟
grep -rn 'fonts.googleapis.com\|fonts.gstatic.com\|cdn.fontcdn\|fontiran' wp-content/themes --include='*.php' --include='*.css' | head
```

**هدف: مجموع payload فونت زیر ۱۵۰ کیلوبایت.**

---

## 3) انتخاب فونت

| فونت | مجوز | حجم subset‌شده (تقریبی، هر وزن woff2) | نکته |
|---|---|---|---|
| **Vazirmatn** | SIL OFL | ~۳۵ KB | پیش‌فرض امن، متغیر (variable) هم دارد |
| **Estedad** | SIL OFL | ~۴۰ KB | تیتر، مدرن |
| **Sahel** | SIL OFL | ~۳۵ KB | متن |
| **Shabnam** | SIL OFL | ~۳۵ KB | متن نرم |
| IRANSans / IRANYekan | تجاری | — | فقط با لایسنس؛ توزیع غیرمجازش رایج و غیرقانونی است |

**نسخه‌ی متغیر (variable):** Vazirmatn یک فایل متغیر دارد که همه‌ی وزن‌ها را در یک فایل ~۸۰ KB می‌دهد. اگر بیش از دو وزن لازم داری، variable برنده است. اگر دو وزن، دو فایل استاتیک سبک‌تر است.

---

## 4) subset کردن

بزرگ‌ترین صرفه‌جویی. گلیف‌های عربی/اردو/لاتین اضافی را حذف کن.

```bash
pip install fonttools brotli

# فقط فارسی + لاتین پایه + ارقام + نشانه‌ها
pyftsubset Vazirmatn-Regular.ttf \
  --output-file=vazirmatn-regular.woff2 \
  --flavor=woff2 \
  --layout-features='*' \
  --unicodes='U+0020-007E,U+00A0,U+060C,U+061B,U+061F,U+0621-063A,U+0640-0655,U+0660-0669,U+066A-066C,U+0670,U+0679,U+067E,U+0686,U+0688,U+0691,U+0698,U+06A9,U+06AF,U+06BA,U+06BE,U+06C1,U+06C3,U+06CC,U+06D2,U+06F0-06F9,U+200C-200F,U+2010-2011,U+2026,U+FB8A,U+FBFC-FBFF'
```

⚠️ **`--layout-features='*'` را حذف نکن.** جدول‌های GSUB/GPOS همان چیزی هستند که حروف فارسی را به هم می‌چسبانند. اگر حذفشان کنی، متن به حروف جدا تبدیل می‌شود.

بررسی نتیجه:
```bash
ls -l vazirmatn-regular.woff2
# و حتماً در مرورگر با متنی که «می‌شود»، «نمی‌خواهم»، «۱۲۳۴» دارد تست کن
```

---

## 5) بارگذاری درست

```css
@font-face {
  font-family: 'Vazirmatn';
  src: url('/wp-content/themes/mytheme/fonts/vazirmatn-regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;          /* نه block، نه auto */
  unicode-range: U+0600-06FF, U+200C-200F, U+FB50-FDFF, U+0020-007E;
}

@font-face {
  font-family: 'Vazirmatn';
  src: url('/wp-content/themes/mytheme/fonts/vazirmatn-bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

body {
  font-family: 'Vazirmatn', 'Segoe UI', Tahoma, system-ui, sans-serif;
}
```

قواعد:
- فقط `woff2`. هیچ fallback به `ttf`/`eot` لازم نیست؛ همه‌ی مرورگرهای امروزی woff2 را می‌فهمند.
- حداکثر **دو وزن** (۴۰۰ و ۷۰۰). وزن‌های ۳۰۰/۵۰۰/۶۰۰ را حذف کن.
- `font-display: swap` — متن فوراً با فونت جایگزین نمایش داده می‌شود.
- **self-host کن.** فونت از CDN خارجی برای کاربر ایرانی یعنی یک اتصال اضافه با تأخیر بالا و گاهی شکست.

### preload فقط برای فونت مسیر بحرانی

```php
add_action( 'wp_head', function () {
    $font = get_theme_file_uri( 'fonts/vazirmatn-regular.woff2' );
    printf(
        '<link rel="preload" href="%s" as="font" type="font/woff2" crossorigin>' . "\n",
        esc_url( $font )
    );
}, 1 );
```

⚠️ فقط **یک** فونت را preload کن (وزن ۴۰۰). preload کردن همه‌ی وزن‌ها، مسیر بحرانی را شلوغ می‌کند و نتیجه‌ی عکس می‌دهد.

`crossorigin` الزامی است حتی برای فونت هم‌دامنه، وگرنه مرورگر دوبار دانلود می‌کند.

---

## 6) CLS و تطبیق متریک

فونت جایگزین (Tahoma یا system) ابعاد متفاوتی دارد، پس هنگام swap چیدمان می‌پرد.

```css
@font-face {
  font-family: 'Vazirmatn-fallback';
  src: local('Tahoma'), local('Segoe UI');
  size-adjust: 96%;          /* تنظیم تجربی */
  ascent-override: 90%;
  descent-override: 25%;
  line-gap-override: 0%;
}

body {
  font-family: 'Vazirmatn', 'Vazirmatn-fallback', Tahoma, sans-serif;
}
```

روش تنظیم: اعداد را کم‌کم تغییر بده تا هنگام swap چیزی نپرد. در DevTools با `Rendering → Layout Shift Regions` قابل مشاهده است.

---

## 7) حذف فونت‌های اضافی قالب

قالب‌های چندمنظوره معمولاً Google Fonts را هم لود می‌کنند حتی اگر استفاده نشود.

```php
// خاموش کردن Google Fonts در قالب‌های رایج
add_action( 'wp_enqueue_scripts', function () {
    wp_dequeue_style( 'google-fonts' );
    wp_dequeue_style( 'astra-google-fonts' );
    wp_dequeue_style( 'elementor-gf-default-roboto' );
    wp_dequeue_style( 'elementor-gf-default-robotoslab' );
    wp_deregister_style( 'google-fonts' );
}, 100 );

// Elementor: غیرفعال کردن کامل فونت‌های گوگل
add_filter( 'elementor/frontend/print_google_fonts', '__return_false' );
```

پیدا کردن اینکه چه چیزی لود می‌شود:

```php
// موقتاً در functions.php — فهرست همه‌ی استایل‌های صف‌شده
add_action( 'wp_print_styles', function () {
    global $wp_styles;
    error_log( print_r( $wp_styles->queue, true ) );
}, 9999 );
```

---

## 8) آیکون‌فونت

Font Awesome و مشابهش معمولاً ۷۵–۲۰۰ کیلوبایت برای ۵ آیکون لود می‌شوند.

- اگر زیر ۱۵ آیکون داری → SVG inline
- اگر قالب اجبار می‌کند → subset کن یا با SVG sprite جایگزین کن
- `dashicons` را در فرانت‌اند خاموش کن:

```php
add_action( 'wp_enqueue_scripts', function () {
    if ( ! is_user_logged_in() ) {
        wp_dequeue_style( 'dashicons' );
        wp_deregister_style( 'dashicons' );
    }
}, 100 );
```

---

## 9) چک‌لیست فونت

```
[ ] مجموع فونت زیر ۱۵۰ کیلوبایت
[ ] فقط فرمت woff2
[ ] حداکثر دو وزن
[ ] subset‌شده با layout-features حفظ‌شده
[ ] چسبندگی حروف و نیم‌فاصله در مرورگر تست شد
[ ] ارقام فارسی ۰-۹ در subset هستند
[ ] font-display: swap
[ ] فقط یک preload، با crossorigin
[ ] self-host، بدون CDN خارجی
[ ] Google Fonts و فونت‌های تکراری قالب خاموش شده
[ ] fallback با size-adjust تنظیم شده و CLS زیر ۰.۱ است
[ ] آیکون‌فونت حذف یا subset شده
```
