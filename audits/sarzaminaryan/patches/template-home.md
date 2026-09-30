# اصلاح دائمی `template-home.php`

> افزونه‌ی `sa-content-guard.php` هر دو مشکل زیر را در لحظه‌ی نمایش می‌پوشاند و
> **کافی است**. این سند برای وقتی است که می‌خواهید ریشه را هم اصلاح کنید تا بار
> بافر خروجی از دوش سرور برداشته شود.
>
> مسیر فایل: `wp-content/themes/sarzaminaryan-child/template-home.php`

---

## ۱) حذف فونت گوگل (خط ۸۰)

**پیدا کنید:**

```css
<style>
@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700;800&display=swap');
.sa-home{--ink:#0b1424;…
```

**جایگزین کنید با:**

```css
<style>
.sa-home{--ink:#0b1424;…
```

یعنی فقط خط `@import` را پاک کنید. همین.

**چرا بی‌خطر است:** قالب مادر `sarzaminaryan` سه وزن Vazirmatn را به‌صورت محلی
`woff2` بارگذاری می‌کند (`assets/css/fonts.css`) و وزن ۴۰۰ را هم در `wp_head`
با `preload … crossorigin` می‌آورد (`functions.php` خط ۱۳۰–۱۴۱).

**دو نکته:**

- طرح صفحه‌ی اصلی وزن `800` را می‌خواهد ولی قالب مادر فقط `400/500/700` دارد.
  دو راه: یا در CSS خانگی `font-weight:800` را به `700` تغییر دهید، یا
  `Vazirmatn-ExtraBold.woff2` را کنار سه فایل دیگر بگذارید و یک `@font-face`
  به `assets/css/fonts.css` اضافه کنید. گزینه‌ی اول ساده‌تر است و از نظر بصری
  تفاوت محسوسی ندارد.
- `AGENTS.md` بند ۴ خودتان می‌گوید «No external CDNs». این خط ناقض همان بند بود.

---

## ۲) فهرست استان‌ها فقط از پست‌های منتشرشده

**پیدا کنید** (حدود خط ۱۸ تا ۵۰) — آرایه‌ی ثابت `$sa_map_points`. آن را **نگه دارید**
(مختصات نقشه لازم است) و بلافاصله بعد از تعریفش این را اضافه کنید:

```php
/* ---- فقط استان‌هایی که واقعاً منتشر شده‌اند لینک می‌شوند ---- */
$sa_published = array();
$sa_rows      = get_posts(
	array(
		'post_type'      => 'province',
		'post_status'    => 'publish',
		'posts_per_page' => 40,
		'fields'         => 'ids',
		'no_found_rows'  => true,
	)
);
foreach ( $sa_rows as $sa_pid ) {
	$sa_published[ get_post_field( 'post_name', $sa_pid ) ] = get_permalink( $sa_pid );
}
unset( $sa_rows, $sa_pid );
```

**سپس در نقشه‌ی SVG** (حدود خط ۱۹۳) این خط:

```php
<a href="<?php echo esc_url( home_url( '/province/' . $sa_p[1] . '/' ) ); ?>" aria-label="…
```

را به این تغییر دهید:

```php
<?php $sa_url = isset( $sa_published[ $sa_p[1] ] ) ? $sa_published[ $sa_p[1] ] : ''; ?>
<a <?php if ( $sa_url ) : ?>href="<?php echo esc_url( $sa_url ); ?>"<?php else : ?>class="sa-soon" aria-disabled="true"<?php endif; ?> aria-label="…
```

**و در نوارهای رنگی** (حدود خط ۲۱۴) کل حلقه را به این تغییر دهید:

```php
<?php foreach ( $sa_map_points as $sa_i => $sa_p ) : ?>
	<?php $sa_url = isset( $sa_published[ $sa_p[1] ] ) ? $sa_published[ $sa_p[1] ] : ''; ?>
	<?php if ( $sa_url ) : ?>
		<a class="sa-bar" href="<?php echo esc_url( $sa_url ); ?>" style="--c:<?php echo esc_attr( $sa_colors[ $sa_i % 8 ] ); ?>">
			<b><?php echo esc_html( $sa_p[0] ); ?></b>
			<em><?php echo esc_html( ucwords( str_replace( '-', ' ', $sa_p[1] ) ) ); ?></em>
		</a>
	<?php else : ?>
		<span class="sa-bar sa-bar--soon" style="--c:<?php echo esc_attr( $sa_colors[ $sa_i % 8 ] ); ?>">
			<b><?php echo esc_html( $sa_p[0] ); ?></b>
			<em>به‌زودی</em>
		</span>
	<?php endif; ?>
<?php endforeach; ?>
```

**و این CSS را به بلوک `<style>` اضافه کنید:**

```css
.sa-bar--soon{opacity:.45;cursor:default}
.sa-map a.sa-soon{cursor:default}
```

---

## ۳) شمارنده‌های صفحه‌ی اصلی

خط ۶۹–۷۲ عددهای «۳۱ استان» و «۴۱۹+ شهرستان» را از `theme_mod` می‌خوانند، یعنی
دستی‌اند. تابع `sa_entity_counts()` در `inc/performance.php` از قبل تعداد واقعی
منتشرشده‌ها را با کش یک‌ساعته می‌دهد. جایگزینی:

```php
$sa_counts    = function_exists( 'sa_entity_counts' ) ? sa_entity_counts() : array();
$sa_stat1_num = isset( $sa_counts['province'] ) ? (int) $sa_counts['province'] : 31;
$sa_stat2_num = isset( $sa_counts['city'] ) ? (int) $sa_counts['city'] : 0;
```

ادعای «۴۴۸+ شهرستان» روی صفحه‌ای که ۸۲ شهرستان دارد، تناقض قابل‌تشخیص است —
هم برای کاربر، هم برای ارزیاب کیفیت گوگل.

---

## ترتیب پیشنهادی

۱. اول `sa-content-guard.php` را نصب کنید (۱۰ دقیقه، همه‌چیز فوراً درست می‌شود).
۲. بعد ۲۷ استان را منتشر کنید — با همین کار، ۵۴ لینک از ۵۴ لینک دوباره سالم می‌شوند
   و مشکل ۲ عملاً موضوعیتش را از دست می‌دهد.
۳. اصلاح‌های این سند را هر وقت فرصت شد اعمال کنید تا بافر خروجی هم لازم نباشد
   (`define( 'SA_GUARD_DEAD_LINKS', false );` و `define( 'SA_GUARD_REMOTE_FONTS', false );`).
