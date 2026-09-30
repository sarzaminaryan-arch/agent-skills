<?php
/**
 * پاک‌سازی محتوای منتشرشده (v2.6.0)
 *
 * روی ۱۱۳ مقاله‌ی موجود اندازه‌گیری شد. این‌ها باقی‌مانده‌های کارگاهی‌اند که
 * قرار بود پیش از انتشار پاک شوند (قاعده‌ی v1.3 بند الف خود پروژه) ولی نشدند:
 *
 *   «(به‌زودی)»            ۴۸۳ مورد در ۹ مقاله — کرمانشاه ۱۴۲، گیلان ۱۳۴،
 *                          گلستان ۱۲۱، کهگیلویه ۷۳
 *   گیومه‌ی خالی «»          ۱۱ مورد در ۵ مقاله
 *   برچسب [نقشه]/[غیررسمی]  ۴۳ مورد در ۵ مقاله
 *   بند روش‌شناسی            ۵ مورد در ۴ مقاله
 *
 * خواننده‌ی صفحه‌ی گیلان الان این را می‌بیند:
 *   «شاهکار معماری … کاروانسرای تی‌تی (به‌زودی) در سیاهکل…»
 * ۱۳۴ بار. متن مثل پیش‌نویس نیمه‌کاره خوانده می‌شود.
 *
 * هیچ چیزی در دیتابیس تغییر نمی‌کند؛ همه در لحظه‌ی نمایش و با کش.
 * خاموش‌کردن: define( 'SA_POLISH', false );
 *
 * @package Sarzaminaryan_Child
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * آیا پاک‌سازی فعال است؟
 *
 * @return bool
 */
function sa_polish_enabled() {
	$on = defined( 'SA_POLISH' ) ? (bool) SA_POLISH : true;

	/**
	 * فعال/غیرفعال کردن پاک‌سازی محتوا.
	 *
	 * @param bool $on وضعیت.
	 */
	return (bool) apply_filters( 'sa_polish_enabled', $on );
}

/**
 * نگاشت «عنوان موجودیت منتشرشده» → نشانی. برای تبدیل «(به‌زودی)» به لینک واقعی
 * به‌محض اینکه آن صفحه ساخته شود.
 *
 * @return array<string,string>
 */
function sa_polish_entity_index() {
	$map = get_transient( 'sa_polish_index' );
	if ( is_array( $map ) ) {
		return $map;
	}
	$map  = array();
	$types = function_exists( 'sa_entity_types' ) ? (array) sa_entity_types() : array( 'city', 'attraction' );
	$ids  = get_posts(
		array(
			'post_type'              => $types,
			'post_status'            => 'publish',
			'posts_per_page'         => 2000,
			'fields'                 => 'ids',
			'no_found_rows'          => true,
			'update_post_meta_cache' => false,
			'update_post_term_cache' => false,
		)
	);
	foreach ( $ids as $id ) {
		$t = trim( wp_strip_all_tags( (string) get_the_title( $id ) ) );
		if ( '' === $t ) {
			continue;
		}
		$map[ $t ] = get_permalink( $id );
		// «شهرستان کاشان» → «کاشان» هم ایندکس شود.
		$short = trim( preg_replace( '/^(شهرستان|استان|شهر)\s+/u', '', $t ) );
		if ( $short && ! isset( $map[ $short ] ) ) {
			$map[ $short ] = $map[ $t ];
		}
	}
	set_transient( 'sa_polish_index', $map, 12 * HOUR_IN_SECONDS );
	return $map;
}

/**
 * پاک‌کردن کش.
 */
function sa_polish_flush() {
	delete_transient( 'sa_polish_index' );
}
add_action( 'transition_post_status', 'sa_polish_flush' );
add_action( 'deleted_post', 'sa_polish_flush' );

/**
 * فیلتر پاک‌سازی.
 *
 * @param string $content محتوا.
 * @return string
 */
function sa_polish_filter( $content ) {
	$content = (string) $content;
	if ( is_admin() || is_feed() || ! is_singular() || ! sa_polish_enabled() ) {
		return $content;
	}
	if ( '' === trim( $content ) ) {
		return $content;
	}

	$key    = 'sa_polish_' . md5( SA_CHILD_VERSION . '|' . $content );
	$cached = get_transient( $key );
	if ( is_string( $cached ) && '' !== $cached ) {
		return $cached;
	}

	$input = $content;
	$index = sa_polish_entity_index();

	/* ── ۱) «(به‌زودی)» ─────────────────────────────────────────────
	   الگو: <strong>نام</strong> (به‌زودی)
	   اگر آن موجودیت حالا منتشر شده باشد → لینک واقعی.
	   وگرنه فقط نامِ پررنگ می‌ماند و نشان کارگاهی می‌رود. */
	$content = preg_replace_callback(
		'#<strong>([^<]{2,80})</strong>\s*\(\s*به‌زودی\s*\)#u',
		function ( $m ) use ( $index ) {
			$name = trim( $m[1] );
			$try  = array( $name, preg_replace( '/^(شهرستان|استان|شهر)\s+/u', '', $name ) );
			foreach ( $try as $t ) {
				$t = trim( (string) $t );
				if ( '' !== $t && isset( $index[ $t ] ) ) {
					return '<a href="' . esc_url( $index[ $t ] ) . '"><strong>' . esc_html( $name ) . '</strong></a>';
				}
			}
			return '<strong>' . esc_html( $name ) . '</strong>';
		},
		$content
	);
	/* هر پرانتز «به‌زودی» با هر شکلی:
	   (به‌زودی) · (همه به‌زودی) · (به‌زودی: مسیر ارومیه در یک روز) */
	$content = preg_replace( '#\s*\(\s*(?:همه\s+)?به‌زودی[^)]{0,60}\)#u', '', (string) $content );

	/* جمله‌هایی که خودِ قرارداد «به‌زودی» را به خواننده توضیح می‌دادند.
	   با حذف نشان‌ها، این جمله‌ها بی‌معنی می‌شوند. فقط شکل داخل گیومه را
	   هدف می‌گیریم تا چیز دیگری قربانی نشود. */
	$content = preg_replace( '#[^.؛><]{0,140}«\s*به‌زودی\s*»[^.؛><]{0,140}[.؛]#u', '', (string) $content );

	/* ── ۲) نشان‌های کارگاهی و گیومه/پرانتز خالی ───────────────────── */
	$content = str_replace(
		array( '[نقشه]', '[غیررسمی]', '[محلی]', '[میراث]', '[URL لازم]' ),
		'',
		(string) $content
	);
	$content = preg_replace( '/«\s*»/u', '', (string) $content );   // گیومه‌ی خالی
	$content = preg_replace( '/\(\s*\)/u', '', (string) $content ); // پرانتز خالی
	$content = preg_replace( '/[ \t]{2,}/u', ' ', (string) $content );
	$content = preg_replace( '/\s+([،؛.!؟])/u', '$1', (string) $content ); // فاصله پیش از نقطه‌گذاری

	/* ── ۳) بندهای روش‌شناسی ────────────────────────────────────────
	   متنی درباره‌ی «چطور این مقاله نوشته شد» مخاطب بیرونی ندارد و
	   خودِ قاعده‌ی v1.3 بند ب گفته بود نباید در مقاله بماند. */
	$content = preg_replace(
		'#<p[^>]*>(?:(?!</p>).)*?(?:این مقاله بر منابع|هر جا داده قطعی یافت نشد)(?:(?!</p>).)*?</p>#su',
		'',
		(string) $content
	);

	/* ── ۴) بازمانده‌ی <sup> خراب: <sup>۳۱<a …>۴۹</a>)</sup> ──────── */
	$content = preg_replace( '#<sup([^>]*)>\s*[۰-۹\d]+\s*(<a\b)#u', '<sup$1>$2', (string) $content );
	$content = preg_replace( '#(</a>)\s*\)\s*</sup>#u', '$1</sup>', (string) $content );

	if ( ! is_string( $content ) || '' === trim( wp_strip_all_tags( $content ) ) ) {
		return $input; // هر خطای preg → محتوای اصلی.
	}

	set_transient( $key, $content, WEEK_IN_SECONDS );
	return $content;
}
add_filter( 'the_content', 'sa_polish_filter', 10 );

/*
|==============================================================================
| فهرست شهرستان‌های استان — مهم‌ترین شکاف پیوند داخلی
|==============================================================================
| نقشه‌ی SVG فقط شهرستان‌هایی را نشان می‌دهد که مرزشان در داده‌ی مبدأ بود؛
| ۱۲ شهرستان (از جمله ارومیه) در آن داده نبودند و روی نقشه غایب‌اند. یعنی اگر
| صفحه‌شان منتشر شود، از صفحه‌ی استان هیچ راهی به آن‌ها نیست.
|
| این فهرست، همه‌ی شهرستان‌های استان را می‌آورد — چه روی نقشه باشند چه نه.
| منتشرشده = لینک، منتشرنشده = متن خاکستری بدون href.
*/

/**
 * فهرست شهرستان‌های یک استان.
 *
 * @param string $province نامک استان.
 * @return string
 */
function sa_county_list( $province ) {
	if ( ! function_exists( 'sa_region_facts' ) ) {
		return '';
	}
	$facts = sa_region_facts();
	$rows  = isset( $facts['counties'][ $province ] ) ? (array) $facts['counties'][ $province ] : array();
	if ( ! $rows ) {
		return '';
	}
	$cities = function_exists( 'sa_region_published_cities' ) ? sa_region_published_cities() : array();

	$items = '';
	$done  = 0;
	foreach ( $rows as $slug => $row ) {
		$name = isset( $row['name'] ) ? $row['name'] : $slug;
		if ( isset( $cities[ $slug ] ) ) {
			++$done;
			$items .= '<li><a class="sa-clist__on" href="' . esc_url( $cities[ $slug ][0] ) . '">'
				. esc_html( $cities[ $slug ][1] ) . '</a></li>';
		} else {
			$items .= '<li><span class="sa-clist__off">' . esc_html( $name ) . '</span></li>';
		}
	}

	$total = count( $rows );
	return '<section class="sa-clist" aria-labelledby="sa-clist-title">'
		. '<h2 id="sa-clist-title">شهرستان‌های این استان</h2>'
		. '<ul class="sa-clist__grid">' . $items . '</ul>'
		. '<p class="sa-clist__cap">'
		. esc_html( sa_fa_digits( (string) $done ) ) . ' از '
		. esc_html( sa_fa_digits( (string) $total ) ) . ' شهرستان صفحه‌ی اختصاصی دارد.'
		. '</p></section>';
}

/**
 * نمایش خودکار زیر نقشه‌ی استان.
 *
 * @param string $content محتوا.
 * @return string
 */
function sa_county_list_auto( $content ) {
	if ( is_admin() || is_feed() || ! is_singular( 'province' ) || ! in_the_loop() || ! is_main_query() ) {
		return $content;
	}
	if ( false !== strpos( $content, 'sa-clist' ) ) {
		return $content;
	}
	$list = sa_county_list( (string) get_post_field( 'post_name', get_queried_object_id() ) );
	return $list ? $content . $list : $content;
}
add_filter( 'the_content', 'sa_county_list_auto', 15 );
