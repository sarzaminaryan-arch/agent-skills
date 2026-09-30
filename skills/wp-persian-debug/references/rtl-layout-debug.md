# عیب‌یابی چیدمان راست‌به‌چپ

---

## 1) اول: آیا سایت اصلاً RTL است؟

```bash
curl -s https://example.ir/ | grep -o '<html[^>]*>'
# انتظار: <html lang="fa-IR" dir="rtl">
```

```bash
wp option get WPLANG          # fa_IR
wp eval 'var_dump( is_rtl() );'   # bool(true)
```

اگر `is_rtl()` برمی‌گرداند `false` در حالی که زبان فارسی است، فایل ترجمه‌ی `fa_IR` نصب نیست:

```bash
wp language core install fa_IR
wp language core activate fa_IR
```

`is_rtl()` مقدارش را از رشته‌ی `ltr`/`rtl` در فایل ترجمه می‌گیرد — بدون فایل ترجمه، وردپرس نمی‌داند سایت RTL است.

---

## 2) استایل RTL لود می‌شود؟

### قالب کلاسیک
وردپرس دنبال `rtl.css` در ریشه‌ی قالب می‌گردد و اگر `is_rtl()` درست باشد، خودکار لودش می‌کند.

```bash
ls -la wp-content/themes/$(wp theme list --status=active --field=name)/rtl.css
curl -s https://example.ir/ | grep -o 'rtl\.css[^"]*'
```

برای استایل‌های enqueue‌شده:
```php
wp_enqueue_style( 'theme-style', get_stylesheet_uri(), array(), '1.0' );
wp_style_add_data( 'theme-style', 'rtl', 'replace' );
// حالا وردپرس style-rtl.css را به‌جای style.css لود می‌کند
```

### قالب بلوکی
`theme.json` و استایل‌های هسته معمولاً خودشان logical properties دارند. مشکل معمولاً از CSS سفارشی است.

---

## 3) متهم‌های اصلی شکست چیدمان

| مشکل | علت | اصلاح |
|---|---|---|
| المان در سمت غلط | `margin-left` / `float: left` ثابت | `margin-inline-start` / `float: inline-start` |
| آیکون فلش برعکس | آیکون جهت‌دار بدون flip | `transform: scaleX(-1)` در `[dir="rtl"]` |
| اسکرول افقی | `width` ثابت یا margin منفی | §4 |
| padding نامتقارن | `padding-left/right` ثابت | `padding-inline` |
| متن چپ‌چین | `text-align: left` ثابت | `text-align: start` |
| border در سمت غلط | `border-left` | `border-inline-start` |
| position ثابت | `left: 0` | `inset-inline-start: 0` |
| ترتیب flex برعکس | `flex-direction: row` با `order` ثابت | معمولاً خودکار درست است؛ `order` را بررسی کن |
| اعداد و متن لاتین وسط جمله | جهت مخلوط | `<bdi>` یا `unicode-bidi: isolate` |

### جدول تبدیل کامل

| فیزیکی | منطقی |
|---|---|
| `margin-left` | `margin-inline-start` |
| `margin-right` | `margin-inline-end` |
| `padding-left` | `padding-inline-start` |
| `padding-right` | `padding-inline-end` |
| `border-left` | `border-inline-start` |
| `text-align: left` | `text-align: start` |
| `float: left` | `float: inline-start` |
| `left: 0` | `inset-inline-start: 0` |
| `border-radius: 4px 0 0 4px` | `border-start-start-radius` و … |

**قاعده:** اگر از ابتدا با logical properties بنویسی، هیچ فایل RTL جدا لازم نداری.

---

## 4) پیدا کردن عامل اسکرول افقی

مشکل شماره‌یک موبایل در سایت‌های فارسی.

```js
// در کنسول مرورگر
const w = document.documentElement.clientWidth;
[...document.querySelectorAll('*')]
  .filter(el => {
    const r = el.getBoundingClientRect();
    return r.right > w + 1 || r.left < -1;
  })
  .slice(0, 15)
  .forEach(el => console.log(el.tagName, el.className, el.getBoundingClientRect().right.toFixed(0)));
```

راه‌حل موقت برای تشخیص بصری:
```css
* { outline: 1px solid rgba(255,0,0,.2); }
```

علت‌های رایج:
- `width: 100vw` (نوار اسکرول را حساب نمی‌کند) → `width: 100%`
- جدول بدون `overflow-x: auto`
- تصویر بدون `max-width: 100%`
- `margin` منفی که در RTL معکوس نشده
- کد embed شبکه‌های اجتماعی با عرض ثابت

---

## 5) جهت مخلوط (BiDi)

عدد، URL، یا کلمه‌ی انگلیسی وسط جمله‌ی فارسی، ترتیبش به هم می‌ریزد.

```html
<!-- ❌ نقطه سر جای غلط می‌رود -->
<p>برای اطلاعات بیشتر به example.com مراجعه کنید.</p>

<!-- ✅ -->
<p>برای اطلاعات بیشتر به <bdi>example.com</bdi> مراجعه کنید.</p>
```

```css
code, kbd, samp, .ltr {
  unicode-bidi: isolate;
  direction: ltr;
  display: inline-block;
}
```

نویسه‌های کنترلی وقتی CSS در دسترس نیست:
- `&rlm;` (U+200F) — علامت راست‌به‌چپ
- `&lrm;` (U+200E) — علامت چپ‌به‌راست

مثال: شماره تلفن یا نسخه در انتهای جمله‌ی فارسی که نقطه‌اش جابه‌جا می‌شود → `&rlm;` بعد از عدد.

---

## 6) فرم‌ها و ورودی‌ها

```css
input, textarea, select {
  direction: rtl;
  text-align: right;
}

/* ورودی‌هایی که همیشه LTR هستند */
input[type="email"],
input[type="url"],
input[type="tel"],
input[dir="ltr"],
.field-latin {
  direction: ltr;
  text-align: left;
}
```

- فیلد رمز عبور: `direction: ltr` بگذار، وگرنه کاربر گیج می‌شود.
- placeholder فارسی باید راست‌چین باشد.
- فیلد شماره‌ی کارت/موبایل: LTR با ارقام لاتین.

---

## 7) ادمین RTL

اگر پنل مدیریت به‌هم‌ریخته است:

```bash
wp language core install fa_IR --activate
wp core update-db
```

افزونه‌هایی که CSS ادمین می‌زنند و RTL ندارند:
```php
add_action( 'admin_enqueue_scripts', function () {
    if ( is_rtl() ) {
        wp_enqueue_style( 'my-admin-rtl', plugins_url( 'admin-rtl.css', __FILE__ ), array( 'my-admin' ) );
    }
}, 999 );
```

---

## 8) وقتی افزونه‌ی بهینه‌سازی چیدمان را می‌شکند

«Remove unused CSS» معمولاً استایل RTL را حذف می‌کند چون در تحلیل اولیه استفاده‌نشده به‌نظر می‌رسد.

نشانه: بعد از فعال‌کردن بهینه‌سازی، سایت چپ‌چین می‌شود.

راه‌حل:
- `rtl.css` و `style-rtl.css` را در لیست استثنا (exclude) قرار بده.
- سلکتورهای `[dir="rtl"]` را در safelist بگذار.
- یا گزینه را خاموش کن. `wp-persian-speed/references/caching-layers.md` §6.

---

## 9) تست سریع

```bash
# چک‌لیست خودکار ساده
URL="https://example.ir/"
echo "html tag:"; curl -s "$URL" | grep -o '<html[^>]*>'
echo "rtl css:";  curl -s "$URL" | grep -oE '[a-z-]*rtl[a-z-]*\.css' | sort -u
echo "dir attrs:"; curl -s "$URL" | grep -c 'dir="rtl"'
```

```
[ ] <html dir="rtl" lang="fa-IR">
[ ] is_rtl() برمی‌گرداند true
[ ] فایل ترجمه‌ی fa_IR نصب است
[ ] استایل RTL لود می‌شود
[ ] هیچ اسکرول افقی روی 360px عرض نیست
[ ] فلش‌ها و آیکون‌های جهت‌دار برگردانده شده‌اند
[ ] متن لاتین وسط جمله با bdi ایزوله شده
[ ] فیلدهای فرم جهت درست دارند
[ ] پنل مدیریت RTL سالم است
[ ] بعد از بهینه‌سازی CSS، چیدمان دوباره تست شد
```
