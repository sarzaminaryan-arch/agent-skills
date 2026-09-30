# Core Web Vitals — علت‌های خاص سایت فارسی

---

## LCP — بزرگ‌ترین عنصر محتوایی

**هدف: زیر ۲.۵ ثانیه روی موبایل.**

### پیدا کردن عنصر LCP

```js
// در کنسول مرورگر
new PerformanceObserver((l) => {
  const e = l.getEntries().at(-1);
  console.log('LCP', e.startTime.toFixed(0) + 'ms', e.element);
}).observe({ type: 'largest-contentful-paint', buffered: true });
```

### علت‌های رایج در سایت فارسی

| علت | نشانه | راه‌حل |
|---|---|---|
| اسلایدر بالای صفحه | LCP یک تصویر اسلایدر است | اسلایدر را با تصویر ثابت جایگزین کن |
| تصویر hero بهینه‌نشده | تصویر چند صد کیلوبایتی JPEG | WebP/AVIF + ابعاد درست |
| `loading="lazy"` روی تصویر hero | وردپرس خودکار می‌گذارد | `fetchpriority="high"` و `loading="eager"` |
| فونت مسدودکننده | LCP یک تیتر متنی است | `font-display: swap` + preload |
| TTFB بالا | همه‌چیز دیر شروع می‌شود | `caching-layers.md` و `hosting-and-cdn.md` |
| CSS مسدودکننده | صفحه دیر رنگ می‌گیرد | Critical CSS، حذف CSS اضافی |

```php
// تصویر شاخص بالای فولد
the_post_thumbnail( 'full', array(
    'loading'       => 'eager',
    'fetchpriority' => 'high',
    'decoding'      => 'async',
) );
```

```php
// جلوگیری از lazy روی اولین تصویر محتوا
add_filter( 'wp_get_attachment_image_attributes', function ( $attr, $attachment, $size ) {
    static $first = true;
    if ( $first && ! is_admin() ) {
        $attr['loading']       = 'eager';
        $attr['fetchpriority'] = 'high';
        $first = false;
    }
    return $attr;
}, 10, 3 );
```

⚠️ فقط **یک** عنصر `fetchpriority="high"` در صفحه.

---

## CLS — جابه‌جایی چیدمان

**هدف: زیر ۰.۱.** در سایت‌های فارسی معمولاً بدترین متریک است.

### متهم اول: فونت فارسی

وقتی فونت فارسی لود می‌شود و جای Tahoma را می‌گیرد، ابعاد متن عوض می‌شود و همه‌چیز می‌پرد.

راه‌حل کامل در `persian-fonts.md` §6: `size-adjust`, `ascent-override`, `descent-override` روی یک `@font-face` fallback.

### بقیه‌ی متهم‌ها

| علت | راه‌حل |
|---|---|
| تصویر بدون `width`/`height` | همیشه ابعاد بگذار؛ `aspect-ratio` در CSS |
| تبلیغات با ارتفاع متغیر | جای رزرو با `min-height` |
| iframe (نقشه، ویدیو، آپارات) | ظرف با `aspect-ratio` |
| بنر کوکی/تخفیف که بعداً ظاهر می‌شود | `position: fixed` یا جای رزرو |
| محتوای تزریقی با JS | جای رزرو قبل از تزریق |
| اسلایدر که بعد از init ارتفاع می‌گیرد | `min-height` روی ظرف |

```css
/* جای رزرو برای تصویر */
.post-thumb {
  aspect-ratio: 16 / 9;
  width: 100%;
  height: auto;
}

/* iframe */
.video-wrap {
  aspect-ratio: 16 / 9;
}
.video-wrap iframe {
  width: 100%;
  height: 100%;
  border: 0;
}
```

### دیدن جابه‌جایی‌ها

```js
new PerformanceObserver((l) => {
  for (const e of l.getEntries()) {
    if (!e.hadRecentInput && e.value > 0.01) {
      console.log('shift', e.value.toFixed(3), e.sources?.map(s => s.node));
    }
  }
}).observe({ type: 'layout-shift', buffered: true });
```

یا در DevTools: `Rendering → Layout Shift Regions`.

---

## INP — پاسخ‌گویی به تعامل

**هدف: زیر ۲۰۰ میلی‌ثانیه.**

### علت‌های رایج

| علت | راه‌حل |
|---|---|
| JS صفحه‌ساز روی هر تعامل | گزینه‌های عملکردی Elementor؛ `theme-and-builder-bloat.md` §3 |
| چند افزونه‌ی jQuery که همه به `scroll`/`resize` وصل‌اند | throttle/debounce، یا حذف افزونه |
| اسکریپت طرف سوم (چت، آمار) | بارگذاری با تأخیر یا فقط در صفحات لازم |
| منوی مگا با محاسبات سنگین | CSS به‌جای JS |
| جستجوی زنده بدون debounce | debounce حداقل ۳۰۰ms |

```js
// الگوی debounce برای جستجوی زنده
let t;
input.addEventListener('input', () => {
  clearTimeout(t);
  t = setTimeout(() => runSearch(input.value), 300);
});
```

اندازه‌گیری:
```js
new PerformanceObserver((l) => {
  for (const e of l.getEntries()) {
    if (e.duration > 100) console.log('slow interaction', e.name, e.duration.toFixed(0) + 'ms', e.target);
  }
}).observe({ type: 'event', durationThreshold: 100, buffered: true });
```

---

## TTFB — زمان تا اولین بایت

**هدف: زیر ۸۰۰ میلی‌ثانیه.** جزو CWV رسمی نیست اما همه‌ی بقیه را عقب می‌اندازد.

ترتیب تشخیص:

1. آیا کش HIT می‌دهد؟ → `caching-layers.md` §3
2. autoload چقدر است؟ → `database-and-autoload.md` §1
3. تعداد و زمان کوئری‌ها؟ → `measurement.md` §5
4. فایل خالی PHP چقدر طول می‌کشد؟ → `hosting-and-cdn.md` §8
5. اگر فایل خالی هم کند است → مشکل از هاست است

---

## RTL و متریک‌ها — نکات خاص

- **اسکرول افقی** روی موبایل معمولاً از یک عنصر با `width` ثابت یا `margin-left` منفی در چیدمان RTL می‌آید. روی CLS و تجربه‌ی کاربری اثر مستقیم دارد.

```js
// پیدا کردن عنصر مقصر
[...document.querySelectorAll('*')].filter(
  el => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1
).slice(0, 10)
```

- **`line-height` کم** روی فارسی باعث می‌شود متن فشرده به‌نظر برسد و کاربر زودتر خارج شود. حداقل ۱.۸ برای متن بدنه.
- **اندازه‌ی فونت زیر ۱۶ پیکسل** روی فارسی خواناتر نیست؛ برعکس. حداقل ۱۶ پیکسل.

---

## چک‌لیست CWV

```
[ ] عنصر LCP شناسایی شده و بهینه است
[ ] تصویر LCP: eager + fetchpriority=high + فرمت مدرن
[ ] فقط یک fetchpriority=high در صفحه
[ ] فونت fallback با size-adjust تنظیم شده
[ ] همه‌ی تصاویر width/height دارند
[ ] iframeها aspect-ratio دارند
[ ] هیچ محتوایی بدون جای رزرو تزریق نمی‌شود
[ ] بدون اسکرول افقی روی موبایل
[ ] جستجوی زنده و رویدادهای scroll مهار شده‌اند
[ ] TTFB زیر ۸۰۰ms خارج از کش
[ ] هر چهار متریک روی پروفایل موبایل اندازه‌گیری شده‌اند
[ ] داده‌ی میدانی Search Console هم بررسی شده
```
