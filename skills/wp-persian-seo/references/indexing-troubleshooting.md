# عیب‌یابی ایندکس نشدن

مسیر تشخیص را به‌ترتیب برو. هر مرحله، مرحله‌ی بعد را باز می‌کند.

---

## مرحله ۱ — آیا اصلاً قابل دسترسی است؟

```bash
curl -sI https://example.ir/some-post/ | head -20
```

بررسی کن:

| چیز | انتظار | اگر غلط بود |
|---|---|---|
| کد وضعیت | `200` | ۳۰۱/۳۰۲ → مقصد را بررسی کن؛ ۴۰۴/۵۰۰ → مشکل سایت |
| `X-Robots-Tag` | نباید `noindex` باشد | از سرور یا افزونه می‌آید |
| `Content-Type` | `text/html; charset=UTF-8` | charset غلط = فارسی خراب |

---

## مرحله ۲ — تنظیم سراسری «عدم نمایش در موتورها»

شایع‌ترین علت. یک تیک در `Settings → Reading`.

```bash
wp option get blog_public     # باید 1 باشد
wp option update blog_public 1
```

اگر `0` باشد، وردپرس `noindex` سراسری می‌زند و همه‌چیز از ایندکس خارج می‌شود. معمولاً از محیط استیجینگ باقی مانده.

---

## مرحله ۳ — robots.txt

```bash
curl -s https://example.ir/robots.txt
```

نشانه‌های خطر:
```
Disallow: /            ← همه‌چیز بسته
Disallow: /wp-content/ ← CSS/JS بسته، رندر خراب
```

توجه: `Disallow` مانع **خزش** می‌شود نه ایندکس. صفحه‌ی مسدودشده می‌تواند بدون توضیحات ایندکس شود. برای حذف از ایندکس باید `noindex` بگذاری و اجازه‌ی خزش بدهی.

---

## مرحله ۴ — متا روباتز در صفحه

```bash
curl -s https://example.ir/some-post/ | grep -i '<meta name="robots"'
```

منابع احتمالی `noindex`:
- افزونه‌ی سئو (تنظیم نوع محتوا یا تک‌صفحه)
- تنظیم «Search engine visibility»
- قالب که خودش متا می‌زند
- افزونه‌ی عضویت/حریم خصوصی
- افزونه‌ی حالت تعمیر (Coming Soon)

**افزونه‌ی حالت تعمیر را فراموش نکن** — بسیار رایج است که بعد از راه‌اندازی خاموش نشده باشد.

```bash
wp plugin list --status=active --field=name | grep -iE 'coming|maintenance|under-construction'
```

---

## مرحله ۵ — canonical متناقض

```bash
curl -s https://example.ir/some-post/ | grep -o 'rel="canonical" href="[^"]*"'
```

اگر canonical به صفحه‌ی دیگری اشاره می‌کند، گوگل این صفحه را ایندکس نمی‌کند. علت‌های رایج:
- قالب ایرانی + افزونه‌ی سئو، هر دو canonical می‌زنند
- canonical سراسری به صفحه‌ی خانه (اشتباه پیکربندی)
- نسخه‌ی www و non-www به هم canonical می‌دهند

```bash
curl -s https://example.ir/some-post/ | grep -c 'rel="canonical"'   # باید 1
```

---

## مرحله ۶ — سایت‌مپ

```bash
curl -s https://example.ir/wp-sitemap.xml | head -30
```

- آیا صفحه در سایت‌مپ هست؟
- آیا دو افزونه هم‌زمان سایت‌مپ می‌سازند؟
- آیا سایت‌مپ در Search Console ثبت و بدون خطا خوانده شده؟
- آیا `<lastmod>` میلادی و معتبر است؟ (تاریخ شمسی اینجا سایت‌مپ را نامعتبر می‌کند)

---

## مرحله ۷ — کیفیت و محتوای تکراری

اگر همه‌ی موارد فنی درست است و گوگل در Search Console می‌گوید **«Crawled – currently not indexed»** یا **«Discovered – currently not indexed»**، مشکل فنی نیست:

| علت | نشانه | راه‌حل |
|---|---|---|
| محتوای نازک | زیر ۳۰۰ کلمه، بدون ارزش افزوده | گسترش یا ادغام |
| محتوای تکراری | چند صفحه با محتوای مشابه | ادغام + ۳۰۱ |
| محتوای کپی‌شده | ترجمه‌ی ماشینی یا کپی از سایت دیگر | بازنویسی واقعی |
| کیفیت پایین کل سایت | صدها صفحه‌ی بی‌ارزش | پاک‌سازی، `noindex` انبوه |
| بودجه‌ی خزش | سایت خیلی بزرگ و کند | سرعت + کاهش URLهای بی‌فایده |
| سایت خیلی جدید | چند هفته است منتشر شده | صبر + لینک داخلی + لینک خارجی |

**نکته‌ی مهم برای سایت‌های فارسی:** صفحه‌های تولیدشده‌ی انبوه (هزار صفحه‌ی «قیمت X در شهر Y») تقریباً همیشه در این دسته می‌افتند.

---

## مرحله ۸ — دسترسی خزنده از ایران/CDN

مسئله‌ی خاص سایت‌های ایرانی:

- بعضی هاست‌ها و فایروال‌ها IPهای گوگل‌بات را محدود می‌کنند.
- بعضی افزونه‌های امنیتی ایرانی، ربات‌ها را بر اساس User-Agent بلاک می‌کنند.
- CDN با تنظیم سخت‌گیرانه‌ی bot protection، گوگل‌بات را challenge می‌کند.

تست:

```bash
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  -o /dev/null -w '%{http_code}\n' https://example.ir/some-post/
```

اگر با User-Agent عادی ۲۰۰ می‌دهد اما با گوگل‌بات ۴۰۳/۵۰۳، مشکل همین است.

همچنین در Search Console از `URL Inspection → Test Live URL` استفاده کن و اسکرین‌شات رندرشده را ببین. اگر صفحه خالی یا بدون استایل بود، منابع مسدود شده‌اند.

---

## مرحله ۹ — جاوااسکریپت

اگر محتوا فقط با JS رندر می‌شود:

```bash
# محتوای HTML خام بدون اجرای JS
curl -s https://example.ir/some-post/ | sed 's/<[^>]*>//g' | tr -s '[:space:]' ' ' | head -c 500
```

اگر متن اصلی اینجا نیست، گوگل باید رندر کند — که کندتر و کم‌اعتمادتر است. برای محتوای مهم، SSR یا HTML استاتیک بهتر است.

---

## مرحله ۱۰ — درخواست ایندکس

بعد از رفع مشکل:

1. Search Console → URL Inspection → `Request Indexing`
2. سایت‌مپ را دوباره ارسال کن
3. از صفحات ایندکس‌شده به آن لینک داخلی بده
4. صبر: چند روز تا چند هفته

⚠️ ابزارهای «ایندکس فوری» و سرویس‌های خرید ایندکس در بازار ایران معمولاً بی‌اثر یا مضرند.

---

## چک‌لیست سریع

```bash
# اسکریپت تشخیص یک‌جا
URL="https://example.ir/some-post/"
echo "== status/headers"; curl -sI "$URL" | grep -iE 'HTTP/|x-robots-tag|content-type'
echo "== blog_public";    wp option get blog_public
echo "== robots.txt";     curl -s https://example.ir/robots.txt | grep -i disallow
echo "== meta robots";    curl -s "$URL" | grep -io '<meta name="robots"[^>]*>'
echo "== canonical";      curl -s "$URL" | grep -o 'rel="canonical" href="[^"]*"'
echo "== canonical count";curl -s "$URL" | grep -c 'rel="canonical"'
echo "== googlebot";      curl -s -A "Googlebot/2.1" -o /dev/null -w '%{http_code}\n' "$URL"
echo "== maintenance";    wp plugin list --status=active --field=name | grep -iE 'coming|maintenance'
```
