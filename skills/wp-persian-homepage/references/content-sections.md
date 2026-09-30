# بخش‌های محتوایی پویا

---

## 1) Query Loop — آخرین نوشته‌ها

```html
<!-- wp:query {"queryId":1,"query":{"perPage":6,"pages":0,"offset":0,"postType":"post","order":"desc","orderBy":"date","inherit":false},"layout":{"type":"default"}} -->
<div class="wp-block-query">
  <!-- wp:post-template {"layout":{"type":"grid","columnCount":3}} -->
    <!-- wp:post-featured-image {"isLink":true,"aspectRatio":"16/9","style":{"border":{"radius":"8px"}}} /-->
    <!-- wp:post-title {"isLink":true,"level":3,"fontSize":"large"} /-->
    <!-- wp:post-excerpt {"excerptLength":22} /-->
    <!-- wp:post-date {"fontSize":"small"} /-->
  <!-- /wp:post-template -->

  <!-- wp:query-no-results -->
    <!-- wp:paragraph -->
    <p>هنوز مطلبی منتشر نشده است.</p>
    <!-- /wp:paragraph -->
  <!-- /wp:query-no-results -->
</div>
<!-- /wp:query -->
```

نکات:
- `"inherit":false` روی صفحه‌ی اول الزامی است، وگرنه کوئری اصلی را ارث می‌برد.
- `aspectRatio` روی تصویر شاخص از CLS جلوگیری می‌کند.
- `excerptLength` را کوتاه بگذار؛ چکیده‌ی فارسی طولانی گرید را به هم می‌ریزد.
- `query-no-results` را **هرگز حذف نکن** — §5.

---

## 2) مطالب دسته‌ی خاص

```html
<!-- wp:query {"queryId":2,"query":{"perPage":3,"postType":"post","taxQuery":{"category":[12]},"inherit":false}} -->
```

پیدا کردن شناسه‌ی دسته:
```bash
wp term list category --fields=term_id,name,slug,count
```

---

## 3) مطلب شاخص (یک آیتم بزرگ)

```html
<!-- wp:query {"queryId":3,"query":{"perPage":1,"postType":"post","sticky":"only","inherit":false}} -->
<div class="wp-block-query">
  <!-- wp:post-template -->
    <!-- wp:columns {"verticalAlignment":"center"} -->
    <div class="wp-block-columns are-vertically-aligned-center">
      <!-- wp:column {"width":"55%"} -->
      <div class="wp-block-column" style="flex-basis:55%">
        <!-- wp:post-featured-image {"isLink":true,"aspectRatio":"16/9"} /-->
      </div>
      <!-- /wp:column -->
      <!-- wp:column -->
      <div class="wp-block-column">
        <!-- wp:post-terms {"term":"category","fontSize":"small"} /-->
        <!-- wp:post-title {"isLink":true,"level":2,"fontSize":"x-large"} /-->
        <!-- wp:post-excerpt {"excerptLength":36} /-->
      </div>
      <!-- /wp:column -->
    </div>
    <!-- /wp:columns -->
  <!-- /wp:post-template -->
</div>
<!-- /wp:query -->
```

«مطلب چسبان» (sticky) را در ویرایشگر نوشته تنظیم کن. اگر هیچ نوشته‌ی چسبانی نباشد، این بخش خالی می‌ماند — حالت خالی را هندل کن.

---

## 4) محصولات ووکامرس

```html
<!-- wp:woocommerce/product-collection {"queryId":4,"query":{"perPage":8,"orderBy":"popularity","inherit":false}} /-->
```

یا با شورت‌کد در قالب کلاسیک:
```php
echo do_shortcode( '[products limit="8" columns="4" orderby="popularity"]' );
```

قواعد فروشگاه فارسی:
```
[ ] قیمت با واحد یکدست (تومان یا ریال — یکی)
[ ] جداکننده‌ی هزارگان: ۲٬۵۰۰٬۰۰۰
[ ] وضعیت موجودی واضح
[ ] تصویر محصول با نسبت ثابت
[ ] دکمه‌ی «افزودن به سبد» یا «مشاهده» — نه هر دو
[ ] بدون «قیمت: تماس بگیرید» مگر واقعاً ضروری
```

---

## 5) حالت خالی — مهم‌ترین بخش

سایت تازه‌ساخته با سه نوشته، یا دسته‌ای بدون محصول. اکثر طراحی‌ها اینجا می‌شکنند.

**هر بخش پویا را با ۰، ۱، و تعداد زیاد تست کن.**

```html
<!-- wp:query-no-results -->
  <!-- wp:group {"style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}}} -->
  <div class="wp-block-group">
    <!-- wp:paragraph {"align":"center"} -->
    <p class="has-text-align-center">به‌زودی اولین مطلب اینجا منتشر می‌شود.</p>
    <!-- /wp:paragraph -->
  </div>
  <!-- /wp:group -->
<!-- /wp:query-no-results -->
```

برای حالت «فقط ۱ آیتم» در گرید سه‌ستونی:
```css
/* یک آیتم تنها، تمام عرض را نگیرد */
.wp-block-post-template.is-layout-grid:has(> :only-child) {
  grid-template-columns: minmax(0, 480px);
  justify-content: center;
}
```

تست:
```bash
# موقتاً همه‌ی نوشته‌ها را پیش‌نویس کن و صفحه را ببین
wp post list --post_type=post --field=ID --post_status=publish > /tmp/ids.txt
# بعد از تست برگردان
```
بهتر: روی Playground یا استیجینگ تست کن، نه روی سایت زنده.

---

## 6) گرید و کارت

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-4);
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: 10px;
  background: var(--surface);
}

.card img {
  aspect-ratio: 16 / 9;
  object-fit: cover;
  width: 100%;
  border-radius: 6px;
}

/* عنوان‌های با طول متفاوت، کارت‌ها را نامساوی نکنند */
.card-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

`auto-fit` با `minmax` روی RTL هم درست کار می‌کند و به media query نیاز ندارد.

---

## 7) اسلایدر — اگر مجبوری

قبلش بگو چرا نه: LCP خراب، ۳۰۰–۷۰۰ کیلوبایت، و کاربر فقط اسلاید اول را می‌بیند.

اگر مشتری اصرار دارد:
- حداکثر ۳ اسلاید
- بدون پخش خودکار، یا حداقل ۷ ثانیه توقف
- کنترل قابل دسترس با کیبورد
- `direction: rtl` روی کانتینر
- اسلاید اول به‌صورت استاتیک در HTML رندر شود تا LCP سالم بماند
- `loading="eager"` روی تصویر اسلاید اول

جایگزین سبک: یک تصویر ثابت + یک CTA. تقریباً همیشه بهتر عمل می‌کند.

---

## 8) خبرنامه

```html
<!-- wp:group {"layout":{"type":"constrained","contentSize":"560px"}} -->
<div class="wp-block-group">
  <!-- wp:heading {"level":2,"textAlign":"center"} -->
  <h2 class="has-text-align-center">هفته‌ای یک ایمیل، فقط نکته‌ی کاربردی</h2>
  <!-- /wp:heading -->
  <!-- wp:paragraph {"align":"center","fontSize":"small"} -->
  <p class="has-text-align-center has-small-font-size">بدون تبلیغات. لغو عضویت با یک کلیک.</p>
  <!-- /wp:paragraph -->
  <!-- فرم: یک فیلد + یک دکمه -->
</div>
<!-- /wp:group -->
```

قواعد:
- یک فیلد (ایمیل). نام و نام خانوادگی نرخ ثبت‌نام را نصف می‌کند.
- بگو چه می‌فرستی و چند وقت یک‌بار.
- ریزمتن حریم خصوصی زیر فرم.
- **بدون پاپ‌آپ فوری.** گوگل روی موبایل جریمه می‌کند و کاربر می‌رود.

---

## 9) نظرات و اثبات

```html
<!-- wp:group {"className":"testimonial"} -->
<div class="wp-block-group testimonial">
  <!-- wp:quote -->
  <blockquote class="wp-block-quote">
    <!-- wp:paragraph -->
    <p>سه هفته بعد از راه‌اندازی، سفارش آنلاین‌مان از ۴ تا در روز به ۲۳ تا رسید.</p>
    <!-- /wp:paragraph -->
    <cite>مریم رضایی · مدیر فروشگاه نارنج</cite>
  </blockquote>
  <!-- /wp:quote -->
</div>
<!-- /wp:group -->
```

```
[ ] نام کامل واقعی
[ ] سمت و نام کسب‌وکار
[ ] عکس واقعی (نه آواتار استوک)
[ ] نتیجه‌ی مشخص، نه «خیلی راضی بودم»
[ ] اجازه‌ی کتبی برای انتشار نام و عکس
```

⚠️ نظر جعلی هم ریسک اعتباری دارد هم حقوقی. اگر نداری، این بخش را حذف کن.

---

## 10) عملکرد بخش‌های پویا

```
[ ] Query Loop روی صفحه‌ی اول حداکثر ۲ تا (هرکدام یک کوئری اضافه است)
[ ] perPage معقول (۶ تا ۹، نه ۵۰)
[ ] تصاویر شاخص با aspect-ratio ثابت
[ ] تصویر اول eager، بقیه lazy
[ ] بدون کوئری با posts_per_page = -1
[ ] نتیجه‌ی بخش‌های سنگین در transient کش شود
```

```php
// کش کردن یک بخش سنگین
function my_featured_section() {
    $html = get_transient( 'home_featured_html' );
    if ( false === $html ) {
        ob_start();
        // ... رندر بخش
        $html = ob_get_clean();
        set_transient( 'home_featured_html', $html, HOUR_IN_SECONDS );
    }
    return $html;
}
add_action( 'save_post', function () { delete_transient( 'home_featured_html' ); } );
```

---

## 11) چک‌لیست

```
[ ] هر بخش پویا با ۰، ۱ و چند آیتم تست شده
[ ] query-no-results برای هر Query Loop تعریف شده
[ ] inherit:false روی صفحه‌ی اول
[ ] تصاویر aspect-ratio دارند
[ ] گرید با auto-fit کار می‌کند و RTL سالم است
[ ] عنوان‌های بلند با line-clamp مهار شده‌اند
[ ] اسلایدر یا حذف شده یا محدود و بهینه است
[ ] فرم خبرنامه تک‌فیلدی و بدون پاپ‌آپ است
[ ] نظرات واقعی و با اجازه‌اند
[ ] بخش‌های سنگین کش شده‌اند
```
