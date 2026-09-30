# داده‌ی ساختاریافته برای سایت فارسی

---

## 1) قواعد کلی

```
[ ] JSON-LD (نه microdata، نه RDFa)
[ ] inLanguage: "fa-IR"
[ ] تاریخ‌ها میلادی ISO 8601 با آفست: 2026-09-30T14:20:00+03:30
[ ] فقط چیزی را علامت بزن که روی صفحه دیده می‌شود
[ ] هر نوع اسکیما فقط یک بار (بلوک تکراری = خطا)
[ ] URLها مطلق و https
```

⚠️ اگر افزونه‌ی سئو فعال است، اسکیما را از **API همان افزونه** ثبت کن، نه با `wp_head` جداگانه — وگرنه دو بلوک تکراری می‌شود.

---

## 2) Article / BlogPosting

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "چرا کش وردپرس برای کاربران لاگین‌شده کار نمی‌کند",
  "description": "توضیح مکانیزم دور زدن کش برای کاربران لاگین و راه‌های واقعی بهبود.",
  "inLanguage": "fa-IR",
  "datePublished": "2026-09-30T09:00:00+03:30",
  "dateModified": "2026-09-30T09:00:00+03:30",
  "author": {
    "@type": "Person",
    "name": "نام نویسنده",
    "url": "https://example.ir/author/name/"
  },
  "publisher": {
    "@type": "Organization",
    "name": "نام سایت",
    "logo": {
      "@type": "ImageObject",
      "url": "https://example.ir/logo.png",
      "width": 600,
      "height": 60
    }
  },
  "image": {
    "@type": "ImageObject",
    "url": "https://example.ir/wp-content/uploads/2026/09/cache-barrier-1600x900.webp",
    "width": 1600,
    "height": 900
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://example.ir/wordpress-cache-logged-in/"
  }
}
```

نکات:
- `headline` حداکثر ۱۱۰ نویسه.
- `dateModified` را واقعاً به‌روز کن؛ تغییر ساختگی تاریخ اثر معکوس دارد.
- `author` باید یک شخص واقعی با صفحه‌ی نویسنده باشد، نه «مدیر سایت».

---

## 3) BreadcrumbList

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "خانه", "item": "https://example.ir/" },
    { "@type": "ListItem", "position": 2, "name": "آموزش وردپرس", "item": "https://example.ir/wordpress/" },
    { "@type": "ListItem", "position": 3, "name": "کش و کارایی" }
  ]
}
```

آخرین آیتم `item` ندارد. مسیر باید با breadcrumb قابل مشاهده روی صفحه یکی باشد.

---

## 4) FAQPage

⚠️ فقط وقتی سؤال و جواب **روی صفحه دیده می‌شوند**. FAQ مخفی = نقض دستورالعمل.

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "inLanguage": "fa-IR",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "آیا افزونه‌ی کش برای کاربران لاگین‌شده کار می‌کند؟",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "در حالت پیش‌فرض خیر. بیشتر افزونه‌های کش صفحه را برای کاربر لاگین‌شده سرو نمی‌کنند تا محتوای شخصی‌سازی‌شده اشتباه نمایش داده نشود."
      }
    },
    {
      "@type": "Question",
      "name": "چطور بفهمم کش واقعاً فعال است؟",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "هدر پاسخ را بررسی کنید. اغلب افزونه‌ها هدری مثل x-cache یا x-litespeed-cache برمی‌گردانند."
      }
    }
  ]
}
```

- پاسخ‌ها را کوتاه نگه دار (زیر ۳۰۰ نویسه).
- HTML داخل `text` محدود است؛ متن ساده امن‌تر است.
- در متن، نیم‌فاصله‌ها را سالم نگه دار.

---

## 5) تاریخ شمسی و اسکیما

**مهم‌ترین اشتباه رایج در سایت‌های فارسی.**

| جا | فرمت |
|---|---|
| نمایش به کاربر | شمسی: ۸ مهر ۱۴۰۵ |
| `<time datetime="">` | میلادی ISO: `2026-09-30` |
| `datePublished` / `dateModified` در اسکیما | میلادی ISO با آفست: `2026-09-30T09:00:00+03:30` |
| سایت‌مپ `<lastmod>` | میلادی ISO |
| RSS | RFC 822 میلادی |

```php
// نمایش شمسی ولی datetime میلادی
printf(
    '<time datetime="%s">%s</time>',
    esc_attr( get_the_date( 'c' ) ),          // میلادی ISO 8601
    esc_html( get_the_date() )                 // شمسی، اگر افزونه فعال است
);
```

بعضی افزونه‌های تاریخ شمسی، `get_the_date()` را سراسری فیلتر می‌کنند و ناخواسته تاریخ شمسی را داخل اسکیما و سایت‌مپ هم می‌فرستند. بررسی:

```bash
curl -s https://example.ir/some-post/ | grep -o '"datePublished":"[^"]*"'
# باید چیزی مثل 2026-09-30T09:00:00+03:30 باشد، نه 1405-07-08
```

---

## 6) LocalBusiness ایرانی

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "نام کسب‌وکار",
  "inLanguage": "fa-IR",
  "url": "https://example.ir/",
  "telephone": "+982112345678",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "خیابان ولیعصر، پلاک ۱۲",
    "addressLocality": "تهران",
    "addressRegion": "تهران",
    "postalCode": "1234567890",
    "addressCountry": "IR"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": 35.7219, "longitude": 51.3347 },
  "openingHoursSpecification": [{
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Saturday","Sunday","Monday","Tuesday","Wednesday"],
    "opens": "09:00",
    "closes": "18:00"
  }],
  "priceRange": "$$"
}
```

نکات:
- `telephone` با کد کشور `+98` و **بدون** صفر ابتدایی.
- کد پستی ایران ۱۰ رقمی، با ارقام لاتین.
- هفته‌ی کاری ایران شنبه تا چهارشنبه/پنجشنبه است — `dayOfWeek` را واقعی بنویس.
- ارقام آدرس می‌توانند فارسی باشند (نمایشی)، اما `postalCode` لاتین.

---

## 7) Product / Offer برای فروشگاه

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "نام محصول",
  "image": ["https://example.ir/p1.webp"],
  "description": "توضیح کوتاه محصول.",
  "sku": "SKU-1234",
  "brand": { "@type": "Brand", "name": "نام برند" },
  "offers": {
    "@type": "Offer",
    "url": "https://example.ir/product/slug/",
    "priceCurrency": "IRR",
    "price": "12500000",
    "availability": "https://schema.org/InStock",
    "priceValidUntil": "2026-12-31"
  }
}
```

- `priceCurrency`: `IRR` استاندارد است. «تومان» واحد استاندارد ISO نیست — قیمت را به ریال بده و نمایش را تومانی نگه دار، یا `IRT` را استفاده نکن چون در همه‌جا پشتیبانی نمی‌شود.
- `price` بدون جداکننده و با ارقام لاتین.
- `aggregateRating` فقط با نظرات واقعی.

---

## 8) HowTo

برای مقاله‌های «چگونه». هر گام باید روی صفحه هم دیده شود.

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "چطور کش وردپرس را تست کنیم",
  "inLanguage": "fa-IR",
  "totalTime": "PT5M",
  "step": [
    { "@type": "HowToStep", "name": "بررسی هدر پاسخ", "text": "با دستور curl هدرها را بگیرید.", "url": "https://example.ir/post/#step1" },
    { "@type": "HowToStep", "name": "تست با کاربر لاگین", "text": "در حالت ناشناس و لاگین مقایسه کنید.", "url": "https://example.ir/post/#step2" }
  ]
}
```

---

## 9) اعتبارسنجی

```bash
# استخراج همه‌ی بلوک‌های JSON-LD
curl -s https://example.ir/some-post/ \
  | grep -o '<script type="application/ld+json">[^<]*' \
  | sed 's|<script type="application/ld+json">||' \
  | while read -r l; do echo "$l" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.stringify(JSON.parse(s),null,1).slice(0,200))}catch(e){console.log("INVALID JSON")}})'; done
```

سپس:
- Rich Results Test گوگل
- Schema Markup Validator
- بررسی تکراری‌نبودن: `curl -s URL | grep -c 'application/ld+json'`

```
[ ] JSON معتبر است
[ ] inLanguage: fa-IR
[ ] تاریخ‌ها میلادی ISO با آفست +03:30
[ ] هیچ نوعی تکراری ثبت نشده
[ ] FAQ روی صفحه دیده می‌شود
[ ] Rich Results Test بدون خطا
```
