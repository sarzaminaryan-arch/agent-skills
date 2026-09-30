# جداسازی تداخل — روش دودویی

---

## 1) قبل از غیرفعال کردن هر چیزی

```bash
# وضعیت فعلی را ثبت کن تا بتوانی دقیقاً برگردانی
wp plugin list --format=csv > plugins-before.csv
wp theme list --format=csv > themes-before.csv
wp db export backup-before-isolation.sql
```

بدون این فایل، بعد از ده مرحله نمی‌دانی وضعیت اولیه چه بود.

---

## 2) بررسی بدون تغییر وضعیت سایت

WP-CLI می‌تواند بدون غیرفعال کردن چیزی، اجرا را شبیه‌سازی کند:

```bash
# بدون هیچ افزونه‌ای
wp --skip-plugins --skip-themes eval 'echo "core ok\n";'

# بدون یک افزونه‌ی خاص
wp --skip-plugins=woocommerce eval 'echo "ok\n";'

# با فقط یک افزونه
wp --skip-plugins=$(wp plugin list --status=active --field=name | grep -v '^woocommerce$' | paste -sd,) eval 'echo "ok\n";'
```

این‌ها وضعیت دیتابیس را تغییر نمی‌دهند — فقط همان اجرای CLI را تحت تأثیر می‌گذارند. برای مشکلات فرانت‌اند کافی نیست، اما برای خطاهای PHP عالی است.

---

## 3) جستجوی دودویی — log₂(n) به‌جای n

با ۳۲ افزونه: روش یکی‌یکی = ۳۲ مرحله. روش دودویی = ۵ مرحله.

```bash
# فهرست افزونه‌های فعال
wp plugin list --status=active --field=name > active.txt
wc -l active.txt      # مثلاً 32
```

**مرحله ۱:** نیمه‌ی اول را غیرفعال کن.

```bash
HALF=$(head -16 active.txt | paste -sd' ')
wp plugin deactivate $HALF
```

تست کن:
- مشکل رفع شد؟ → مقصر در همین ۱۶ تا است. دوباره فعالشان کن و نیمه‌ی این ۱۶ را غیرفعال کن.
- مشکل باقی است؟ → مقصر در ۱۶ تای دوم است.

**مرحله ۲–۵:** همین کار را روی نیمه‌ی مشکوک تکرار کن.

بازگرداندن:
```bash
wp plugin activate $(cat active.txt | paste -sd' ')
```

### اسکریپت کمکی

```bash
#!/bin/bash
# bisect.sh — یک مرحله از جستجوی دودویی
# usage: ./bisect.sh active.txt 1 16
FILE=$1; FROM=$2; TO=$3
GROUP=$(sed -n "${FROM},${TO}p" "$FILE" | paste -sd' ')
echo "deactivating: $GROUP"
wp plugin deactivate $GROUP
echo "--- test the site now, then run: wp plugin activate $GROUP"
```

---

## 4) تداخل دونفره

اگر «همه را خاموش کردم، درست شد؛ همه را روشن کردم، خراب شد» اما هیچ افزونه‌ی تنهایی مقصر نیست، دو افزونه با هم تداخل دارند.

روش:
1. مقصر احتمالی A را پیدا کن (با غیرفعال‌کردنش مشکل حل می‌شود).
2. A را فعال نگه دار و بقیه را دودویی کن تا B پیدا شود.
3. با A+B تنها، مشکل باید بازتولید شود.

الگوهای رایج تداخل دونفره در سایت‌های فارسی:

| جفت | مشکل |
|---|---|
| دو افزونه‌ی کش | صفحات کهنه، هدرهای متناقض |
| دو افزونه‌ی سئو | متا و اسکیمای تکراری |
| افزونه‌ی کش + افزونه‌ی چندزبانه | نسخه‌ی زبان اشتباه سرو می‌شود |
| افزونه‌ی minify + صفحه‌ساز | جاوااسکریپت شکسته |
| افزونه‌ی تاریخ شمسی + افزونه‌ی سئو | تاریخ شمسی در اسکیما و سایت‌مپ |
| افزونه‌ی امنیتی + REST API | درخواست‌های ادمین بلاک می‌شوند |
| دو افزونه‌ی بهینه‌سازی تصویر | فایل‌های تکراری، متادیتای خراب |

---

## 5) تست قالب

```bash
# قالب فعلی را ثبت کن
CURRENT=$(wp theme list --status=active --field=name)
echo "$CURRENT"

# به قالب پیش‌فرض برو
wp theme activate twentytwentyfour

# تست، سپس برگرد
wp theme activate "$CURRENT"
```

اگر با قالب پیش‌فرض مشکل رفع شد، مقصر قالب است. بعد داخل قالب دنبال بگرد:

```bash
# آیا قالب فرزند است؟ مشکل ممکن است در والد باشد
wp theme list --format=csv | grep -i child

# فایل‌های اخیراً تغییریافته‌ی قالب
find wp-content/themes/$CURRENT -name '*.php' -mtime -14 -printf '%T+ %p\n' | sort -r | head
```

---

## 6) must-use plugins و drop-ins

این‌ها در فهرست عادی افزونه‌ها دیده نمی‌شوند و از پنل قابل غیرفعال‌سازی نیستند. علت رایج «مشکلی که با غیرفعال‌کردن همه‌ی افزونه‌ها هم می‌ماند».

```bash
ls -la wp-content/mu-plugins/ 2>/dev/null
wp plugin list --status=must-use

# drop-ins
ls -la wp-content/*.php 2>/dev/null
# object-cache.php, advanced-cache.php, db.php, maintenance.php, sunrise.php
```

برای تست، فایل را موقتاً rename کن:
```bash
mv wp-content/mu-plugins/something.php wp-content/mu-plugins/something.php.off
```

⚠️ `advanced-cache.php` و `object-cache.php` را افزونه‌ی کش می‌سازد. حذف دستی‌شان بدون غیرفعال‌کردن افزونه می‌تواند خطا بدهد.

---

## 7) وقتی نمی‌توانی سایت را پایین بیاوری

سایت تولیدی پرترافیک را نمی‌شود وسط روز دودویی کرد.

گزینه‌ها:

1. **استیجینگ** — بهترین. کپی بگیر و آنجا دودویی کن.
   ```bash
   wp db export prod.sql
   # روی استیجینگ:
   wp db import prod.sql
   wp search-replace 'https://example.ir' 'https://staging.example.ir' --all-tables --precise
   ```

2. **Playground** — برای بازتولید مشکل قالب/افزونه بدون سرور. اسکیل `wp-playground` و `blueprint`.

3. **پارامتر تست فقط برای خودت** — بعضی افزونه‌ها با query string قابل bypass‌اند (مثلاً `?nocache=1`).

4. **ساعت کم‌ترافیک** — با اعلام قبلی و بکاپ.

---

## 8) بازتولید در محیط تمیز

قبل از متهم‌کردن یک افزونه، مطمئن شو مشکل در نصب تمیز هم هست:

```bash
# با Playground
npx @wp-playground/cli server --blueprint=blueprint.json
```

```json
{
  "$schema": "https://playground.wordpress.net/blueprint-schema.json",
  "landingPage": "/",
  "preferredVersions": { "php": "8.2", "wp": "latest" },
  "steps": [
    { "step": "installPlugin", "pluginData": { "resource": "wordpress.org/plugins", "slug": "suspect-plugin" } },
    { "step": "setSiteLanguage", "language": "fa_IR" }
  ]
}
```

اگر در نصب تمیز هم مشکل هست → باگ افزونه، به توسعه‌دهنده گزارش بده.
اگر نیست → تداخل با محیط توست.

---

## 9) چک‌لیست

```
[ ] وضعیت اولیه در فایل ثبت شد
[ ] بکاپ دیتابیس گرفته شد
[ ] mu-plugins و drop-ins بررسی شدند
[ ] جستجوی دودویی به‌جای یکی‌یکی استفاده شد
[ ] قالب با قالب پیش‌فرض تست شد
[ ] احتمال تداخل دونفره بررسی شد
[ ] در نصب تمیز بازتولید شد
[ ] همه‌ی افزونه‌ها به وضعیت اولیه برگشتند
[ ] علت با نام مشخص شد، نه «یکی از افزونه‌ها»
```
