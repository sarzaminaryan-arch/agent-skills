# اندازه‌گیری — قبل از هر تغییر

عددی که شرایطش نوشته نشده، عدد نیست.

---

## 1) TTFB با curl

```bash
# تابع کمکی
ttfb() {
  curl -s -o /dev/null -w '%{time_namelookup} %{time_connect} %{time_appconnect} %{time_starttransfer} %{time_total} %{size_download} %{http_code}\n' "$1"
}

# ۵ نمونه، میانه بگیر
for i in 1 2 3 4 5; do ttfb "https://example.ir/"; sleep 1; done
```

ستون‌ها: DNS، TCP، TLS، **TTFB**، کل، حجم، کد وضعیت.

### سه سناریوی الزامی

```bash
# ۱) خارج از کش (پارامتر تصادفی کش را دور می‌زند)
for i in 1 2 3 4 5; do ttfb "https://example.ir/?nocache=$RANDOM"; done

# ۲) داخل کش (بعد از گرم شدن)
curl -s -o /dev/null https://example.ir/
for i in 1 2 3 4 5; do ttfb "https://example.ir/"; done

# ۳) کاربر لاگین‌شده — معمولاً بدترین عدد
curl -s -c cookies.txt -d "log=USER&pwd=PASS&wp-submit=Login&redirect_to=/&testcookie=1" \
  https://example.ir/wp-login.php -o /dev/null
for i in 1 2 3; do
  curl -s -b cookies.txt -o /dev/null -w '%{time_starttransfer}\n' https://example.ir/
done
rm -f cookies.txt
```

| سناریو | هدف |
|---|---|
| خارج از کش | < ۸۰۰ ms |
| داخل کش | < ۲۰۰ ms |
| لاگین‌شده | < ۱.۵ s |

اگر «داخل کش» و «خارج از کش» یکسان‌اند، کش کار نمی‌کند. برو به `caching-layers.md` §3.

---

## 2) شرایطی که باید ثبت شوند

هر عدد بدون این‌ها بی‌معناست:

```
[ ] تاریخ و ساعت
[ ] URL دقیق
[ ] کش گرم یا سرد
[ ] لاگین یا مهمان
[ ] موبایل یا دسکتاپ
[ ] شبکه (4G شبیه‌سازی‌شده / فیبر)
[ ] از کجا اندازه‌گیری شد (ایران / خارج)
[ ] چند نمونه و کدام آماره (میانه، نه میانگین)
```

**مهم‌ترین نکته برای سایت ایرانی:** اگر از خارج اندازه می‌گیری، عدد به کاربر واقعی‌ات ربطی ندارد. و برعکس.

---

## 3) بررسی هدرهای کش و فشرده‌سازی

```bash
curl -sI -H 'Accept-Encoding: gzip, br' https://example.ir/ | tr -d '\r'
```

چه چیزی می‌خواهی ببینی:

| هدر | انتظار |
|---|---|
| `content-encoding` | `br` یا `gzip` — اگر نبود، فشرده‌سازی خاموش است |
| `cache-control` | برای HTML: `max-age=0` یا کوتاه؛ برای استاتیک: `max-age=31536000, immutable` |
| `x-cache` / `x-litespeed-cache` / `x-fastcgi-cache` | `HIT` بعد از گرم‌کردن |
| `vary` | `Accept-Encoding` |
| `content-type` | `text/html; charset=UTF-8` |

فشرده‌سازی استاتیک:
```bash
curl -sI -H 'Accept-Encoding: br' https://example.ir/wp-content/themes/mytheme/style.css | grep -i 'content-encoding\|cache-control'
```

---

## 4) تجزیه‌ی وزن صفحه

```bash
# استخراج منابع صفحه و اندازه‌شان
BASE="https://example.ir"
curl -s "$BASE" \
  | grep -oE '(src|href)="[^"]+\.(js|css|woff2?|ttf|jpe?g|png|webp|avif|svg)[^"]*"' \
  | sed -E 's/^(src|href)="//; s/"$//' \
  | sort -u \
  | while read -r r; do
      case "$r" in http*) u="$r" ;; //*) u="https:$r" ;; /*) u="$BASE$r" ;; *) u="$BASE/$r" ;; esac
      sz=$(curl -s -o /dev/null -w '%{size_download}' -H 'Accept-Encoding: gzip, br' "$u")
      printf '%8s KB  %s\n' "$((sz/1024))" "$u"
    done | sort -rn | head -25
```

بودجه‌ی پیشنهادی برای سایت فارسی:

| دسته | بودجه |
|---|---|
| HTML | ≤ ۵۰ KB |
| CSS | ≤ ۱۰۰ KB |
| JS | ≤ ۲۰۰ KB |
| فونت | ≤ ۱۵۰ KB |
| تصاویر (بالای فولد) | ≤ ۳۰۰ KB |
| **کل صفحه‌ی اول** | **≤ ۹۰۰ KB** |

---

## 5) کوئری‌های دیتابیس

```php
// wp-config.php — فقط در استیجینگ
define( 'SAVEQUERIES', true );
```

```php
// در فوتر قالب، فقط برای ادمین
add_action( 'wp_footer', function () {
    if ( ! current_user_can( 'manage_options' ) || ! defined( 'SAVEQUERIES' ) ) return;
    global $wpdb;
    $time = array_sum( array_column( $wpdb->queries, 1 ) );
    printf(
        '<!-- queries: %d | db time: %.3fs | php peak: %.1fMB -->',
        count( $wpdb->queries ), $time, memory_get_peak_usage( true ) / 1048576
    );
} );
```

با WP-CLI:
```bash
wp profile stage --all --allow-root
wp profile hook --all --spotlight --allow-root
wp profile eval 'get_posts(["posts_per_page"=>10]);' --allow-root
```

(نیازمند پکیج `wp-cli/profile-command`. جزئیات در `wp-performance`.)

| سنجه | هدف |
|---|---|
| تعداد کوئری صفحه‌ی اصلی | < ۵۰ |
| زمان کوئری‌ها | < ۱۰۰ ms |
| اوج حافظه‌ی PHP | < ۶۴ MB |

---

## 6) Core Web Vitals

آزمایشگاهی (lab):
```bash
npx lighthouse https://example.ir/ \
  --preset=desktop --output=json --output-path=./lh-desktop.json --quiet

npx lighthouse https://example.ir/ \
  --form-factor=mobile --throttling-method=simulate \
  --output=json --output-path=./lh-mobile.json --quiet

node -e '
const r=require("./lh-mobile.json").audits;
for (const k of ["largest-contentful-paint","cumulative-layout-shift","total-blocking-time","server-response-time","speed-index"])
  console.log(k.padEnd(32), r[k].displayValue);
'
```

میدانی (field) — مهم‌تر است:
- Search Console → Core Web Vitals
- CrUX (اگر سایت ترافیک کافی دارد)
- افزونه‌ی سبک web-vitals روی سایت خودت

**قاعده:** داده‌ی میدانی بر آزمایشگاهی اولویت دارد. Lighthouse فقط برای پیدا کردن علت است، نه برای قضاوت.

---

## 7) فرم ثبت نتیجه

یک فایل `perf-baseline.md` کنار پروژه نگه دار:

```markdown
## 1405-07-08 — پایه

شرایط: موبایل شبیه‌سازی‌شده 4G، اندازه‌گیری از تهران، ۵ نمونه، میانه

| سنجه | مهمان/سرد | مهمان/گرم | لاگین |
|---|---|---|---|
| TTFB | 1.84s | 1.79s | 3.2s |
| LCP | 4.1s | 4.0s | — |
| CLS | 0.28 | 0.28 | — |
| وزن کل | 2.4MB | 2.4MB | — |
| فونت | 780KB | | |
| کوئری | 118 | | 340 |

تشخیص: کش اصلاً HIT نمی‌دهد (سرد و گرم یکی است) · فونت subset نشده · autoload احتمالاً متورم

## 1405-07-09 — بعد از subset فونت
| فونت | 780KB → 128KB |
| LCP | 4.1s → 3.2s |
| CLS | 0.28 → 0.06 |
```

بدون این فایل، بعد از سه تغییر دیگر نمی‌دانی چه چیزی چه کرد.
