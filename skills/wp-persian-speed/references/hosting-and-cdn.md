# میزبانی و CDN برای مخاطب ایرانی

مهم‌ترین تصمیم سرعتی، و تنها تصمیمی که هیچ افزونه‌ای جایش را نمی‌گیرد.

---

## 1) مخاطب کجاست؟

همه‌چیز به این بستگی دارد.

| مخاطب | میزبانی | CDN |
|---|---|---|
| فقط ایران | **هاست/سرور داخل ایران** | CDN ایرانی (ابرآروان، پارس‌پک و مشابه) یا بدون CDN |
| فقط خارج از ایران | سرور اروپا/آمریکا | Cloudflare / Bunny / Fastly |
| هر دو | سرور داخل + CDN با PoP داخلی، یا دو نسخه | CDN ایرانی با مسیر بین‌الملل |
| افغانستان/تاجیکستان | سرور اروپا (معمولاً مسیر بهتری دارد) | CDN جهانی |

**اشتباه رایج:** سایت فارسی با مخاطب داخلی روی سرور آلمان + Cloudflare. نتیجه: TTFB بالا، گاهی دسترسی ناپایدار.

**اشتباه رایج دوم:** سرور داخلی برای مخاطب خارج از ایران بدون CDN. نتیجه: کندی شدید و گاهی عدم دسترسی به‌خاطر محدودیت‌های شبکه‌ای.

---

## 2) اندازه‌گیری واقعی از مبدأ مخاطب

عدد PageSpeed از سرور گوگل به تو نمی‌گوید کاربر تهرانی چه می‌بیند.

```bash
# اندازه‌گیری TTFB از همان‌جا که مخاطب هست
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w '%{time_namelookup}  %{time_connect}  %{time_starttransfer}\n' https://example.ir/
  sleep 1
done
```

اگر خودت در ایران نیستی:
- از یک VPS ایرانی یا از یک آشنا در ایران اندازه بگیر.
- داده‌ی میدانی Search Console را ببین (کاربران واقعی).
- ابزارهای تست سرعت ایرانی برای مقایسه‌ی نسبی خوب‌اند.

ستون `time_namelookup` بالا = مشکل DNS. `time_connect` بالا = مسیریابی/فاصله. `time_starttransfer` منهای `time_connect` = زمان پردازش سرور.

---

## 3) انتخاب میزبانی

| نوع | کِی | نکته |
|---|---|---|
| **هاست اشتراکی ایرانی** | سایت کوچک، بودجه‌ی محدود | معمولاً LiteSpeed دارد؛ محدودیت CPU/entry process مشکل اصلی است |
| **VPS ایرانی** | ترافیک متوسط به بالا | نیاز به مدیریت؛ کنترل کامل روی nginx/Redis/PHP |
| **سرور اختصاصی ایرانی** | فروشگاه پرترافیک | |
| **VPS خارجی** | مخاطب بین‌المللی | برای مخاطب داخلی معمولاً انتخاب بدی است |
| **هاست مدیریت‌شده‌ی خارجی** | مخاطب بین‌المللی + نیاز به سادگی | گران، و برای مخاطب ایرانی مناسب نیست |

سؤال‌هایی که باید از هاست بپرسی:
```
[ ] وب‌سرور چیست؟ (LiteSpeed / Apache / nginx)
[ ] نسخه‌ی PHP؟ (حداقل 8.1، ترجیحاً 8.2+)
[ ] OPcache فعال است؟
[ ] Redis یا Memcached در دسترس است؟
[ ] محدودیت entry process و CPU چقدر است؟
[ ] HTTP/2 یا HTTP/3 فعال است؟
[ ] Brotli فعال است؟
[ ] پشتیبان‌گیری خودکار دارد؟
```

بررسی از داخل سایت:
```bash
php -v
php -i | grep -i 'opcache.enable\|memory_limit\|max_execution'
wp cli info
curl -sI https://example.ir/ | grep -i 'server\|alt-svc'   # alt-svc = HTTP/3
```

---

## 4) تنظیمات PHP

```ini
; حداقل‌های منطقی
memory_limit = 256M
max_execution_time = 120
upload_max_filesize = 64M
post_max_size = 64M

; OPcache
opcache.enable = 1
opcache.memory_consumption = 256
opcache.max_accelerated_files = 20000
opcache.validate_timestamps = 1      ; در توسعه 1، در تولید 0 با deploy hook
opcache.revalidate_freq = 60
```

```php
// wp-config.php
define( 'WP_MEMORY_LIMIT', '256M' );
define( 'WP_MAX_MEMORY_LIMIT', '512M' );
```

**PHP 8.2 نسبت به 7.4 معمولاً ۲۰–۴۰٪ سریع‌تر است.** اگر هنوز روی 7.4 هستی، ارتقا بزرگ‌ترین برد بدون تغییر کد است — اما اول سازگاری قالب و افزونه‌ها را روی استیجینگ تست کن. `wp-phpstan` برای بررسی ایستا کمک می‌کند.

---

## 5) CDN

### CDN ایرانی
- PoP داخل کشور → TTFB پایین برای کاربر داخلی
- معمولاً کش استاتیک + گاهی کش HTML
- سازگاری با وردپرس را بررسی کن (purge خودکار)

### Cloudflare
برای مخاطب داخلی معمولاً مفید نیست (PoP نزدیک ندارد و گاهی دسترسی ناپایدار است). اگر استفاده می‌کنی:

```
[ ] Auto Minify: خاموش (کارش را افزونه بهتر می‌کند)
[ ] Rocket Loader: خاموش (سایت‌های jQuery-محور را می‌شکند)
[ ] Brotli: روشن
[ ] Cache Level: Standard
[ ] Bot Fight Mode: احتیاط — گوگل‌بات را challenge می‌کند
[ ] Always Online: اختیاری
[ ] Page Rules برای /wp-admin/* → Bypass Cache
```

⚠️ `Bot Fight Mode` و تنظیمات سخت‌گیرانه‌ی امنیتی، علت رایج ایندکس نشدن است. `wp-persian-seo/references/indexing-troubleshooting.md` §8.

### بدون CDN
برای سایت کوچک با مخاطب داخلی و هاست داخلی خوب، CDN لازم نیست. یک لایه‌ی پیچیدگی کمتر.

---

## 6) DNS

```bash
dig +short example.ir
dig example.ir | grep "Query time"
```

- DNS کند، به همه‌ی درخواست‌ها تأخیر اضافه می‌کند.
- برای مخاطب داخلی، DNS با سرور داخلی بهتر جواب می‌دهد.
- TTL منطقی: ۳۶۰۰ ثانیه برای رکوردهای پایدار.

---

## 7) HTTP/2 و HTTP/3

```bash
curl -sI --http2 https://example.ir/ | head -1     # باید HTTP/2 بدهد
curl -sI https://example.ir/ | grep -i alt-svc      # h3 یعنی HTTP/3 فعال است
```

با HTTP/2، ترکیب کردن فایل‌ها (combine) دیگر مزیت ندارد و فقط ریسک است — `caching-layers.md` §6.

---

## 8) وقتی مشکل از هاست است

نشانه‌ها:
- TTFB خارج از کش بالای ۱.۵ ثانیه حتی بعد از پاک‌سازی autoload و بهینه‌سازی کوئری
- کندی در ساعات اوج، سرعت عادی در ساعات خلوت (همسایه‌ی پرمصرف روی هاست اشتراکی)
- خطای ۵۰۸ / `Resource Limit Is Reached` — محدودیت entry process
- زمان اجرای PHP ثابت و بالا در حالی که تعداد کوئری کم است

تست تفکیکی:
```bash
# فایل خالی PHP — فقط سربار سرور را می‌سنجد
echo '<?php echo "ok";' > /path/to/public_html/ping.php
for i in 1 2 3 4 5; do curl -s -o /dev/null -w '%{time_starttransfer}\n' https://example.ir/ping.php; done
rm /path/to/public_html/ping.php
```

اگر همین فایل خالی هم بالای ۳۰۰ میلی‌ثانیه طول می‌کشد، مشکل از وردپرس نیست. هاست را عوض کن — هیچ افزونه‌ای این را حل نمی‌کند.

---

## 9) چک‌لیست

```
[ ] موقعیت مخاطب مشخص و با میزبانی هم‌راستا است
[ ] TTFB از مبدأ واقعی مخاطب اندازه‌گیری شده
[ ] PHP 8.1+ با OPcache فعال
[ ] memory_limit حداقل 256M
[ ] HTTP/2 یا HTTP/3 فعال
[ ] Brotli یا gzip فعال
[ ] تصمیم CDN بر اساس مخاطب گرفته شده، نه پیش‌فرض
[ ] تنظیمات پرریسک CDN (Rocket Loader, Bot Fight) بررسی شده
[ ] تست ping.php انجام شده تا سربار سرور از وردپرس تفکیک شود
```
