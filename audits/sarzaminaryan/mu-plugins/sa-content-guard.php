<?php
/**
 * Plugin Name:  SA Content Guard
 * Plugin URI:   https://github.com/sarzaminaryan-arch/agent-skills
 * Description:  اصلاح خودکار رفتارهای غلط قالب و محتوا در «سرزمین آریان» — بدون دست‌زدن به ۱۱۳ مقاله‌ی موجود. پانویس‌سازی ارجاع‌های بیرونی، حذف H1 دوم، خنثی‌کردن لینک‌های ۴۰۴، حذف فونت گوگل، جدا کردن بلوک تکراری پایانی، و دروازه‌ی انتشار قابل‌تنظیم.
 * Version:      1.0.0
 * Requires PHP: 7.4
 * License:      GPL-2.0-or-later
 *
 * ── نصب ───────────────────────────────────────────────────────────────────
 * فایل را در «wp-content/mu-plugins/sa-content-guard.php» بگذارید.
 * اگر پوشه‌ی mu-plugins وجود ندارد، بسازید. mu-plugin خودکار فعال است.
 * برای خاموش‌کردن کامل: فایل را حذف کنید، یا در wp-config.php بنویسید:
 *     define( 'SA_GUARD_DISABLE', true );
 * برای خاموش‌کردن یک ماژول (مثلاً دروازه‌ی انتشار):
 *     define( 'SA_GUARD_RELAX_GATE', false );
 *
 * ── فلسفه ─────────────────────────────────────────────────────────────────
 * هیچ ماژولی محتوای ذخیره‌شده در دیتابیس را تغییر نمی‌دهد. همه‌چیز در لحظه‌ی
 * رندر اصلاح و در ترنزینت کش می‌شود. با حذف این فایل، سایت دقیقاً به وضعیت
 * قبل برمی‌گردد. هیچ تغییر برگشت‌ناپذیری رخ نمی‌دهد.
 *
 * @package SA_Content_Guard
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
if ( defined( 'SA_GUARD_DISABLE' ) && SA_GUARD_DISABLE ) {
	return;
}

define( 'SA_GUARD_VERSION', '1.0.0' );

/**
 * ماژول‌ها. هرکدام با ثابت SA_GUARD_<NAME> یا فیلتر sa_guard_modules قابل تغییر است.
 *
 * @return array<string,bool>
 */
function sa_guard_modules() {
	static $cache = null;
	if ( null !== $cache ) {
		return $cache;
	}
	$defaults = array(
		'citations'     => true, // ارجاع بیرونی درون متن → پانویس + فهرست nofollow.
		'single_h1'     => true, // H1 داخل بدنه → H2.
		'dead_links'    => true, // لینک به موجودیت منتشرنشده → غیرقابل‌کلیک.
		'remote_fonts'  => true, // حذف درخواست فونت گوگل.
		'community_box' => true, // بلوک تکراری پایانی → aside.
		'relax_gate'    => true, // دروازه‌ی انتشار قابل تنظیم.
		'health_page'   => true, // ابزارها → سلامت محتوا.
	);
	foreach ( $defaults as $key => $unused ) {
		$const = 'SA_GUARD_' . strtoupper( $key );
		if ( defined( $const ) ) {
			$defaults[ $key ] = (bool) constant( $const );
		}
	}
	/**
	 * فعال/غیرفعال کردن ماژول‌ها.
	 *
	 * @param array<string,bool> $defaults ماژول‌ها.
	 */
	$cache = (array) apply_filters( 'sa_guard_modules', $defaults );
	return $cache;
}

/**
 * آیا ماژول فعال است؟
 *
 * @param string $name نام ماژول.
 * @return bool
 */
function sa_guard_on( $name ) {
	$m = sa_guard_modules();
	return ! empty( $m[ $name ] );
}

/**
 * میزبان‌های «خودی».
 *
 * @return string[]
 */
function sa_guard_self_hosts() {
	static $hosts = null;
	if ( null !== $hosts ) {
		return $hosts;
	}
	$host  = (string) wp_parse_url( home_url(), PHP_URL_HOST );
	$bare  = preg_replace( '/^www\./', '', $host );
	$hosts = array_values( array_unique( array_filter( array( $host, 'www.' . $bare, $bare ) ) ) );
	/**
	 * میزبان‌هایی که لینک به آن‌ها «داخلی» شمرده می‌شود.
	 *
	 * @param string[] $hosts میزبان‌ها.
	 */
	$hosts = (array) apply_filters( 'sa_guard_self_hosts', $hosts );
	return $hosts;
}

/**
 * آیا نشانی بیرونی است؟
 *
 * @param string $href نشانی.
 * @return bool
 */
function sa_guard_is_external( $href ) {
	$href = trim( (string) $href );
	if ( '' === $href || '#' === $href[0] || '/' === $href[0] ) {
		return false;
	}
	if ( ! preg_match( '#^https?://#i', $href ) ) {
		return false; // mailto:, tel:, نسبی…
	}
	$h = (string) wp_parse_url( $href, PHP_URL_HOST );
	foreach ( sa_guard_self_hosts() as $self ) {
		if ( 0 === strcasecmp( $h, (string) $self ) ) {
			return false;
		}
	}
	return true;
}

/**
 * ارقام فارسی.
 *
 * @param string $s رشته.
 * @return string
 */
function sa_guard_fa_digits( $s ) {
	return str_replace(
		array( '0', '1', '2', '3', '4', '5', '6', '7', '8', '9' ),
		array( '۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹' ),
		(string) $s
	);
}

/*
|==============================================================================
| ۱ — ارجاع‌های بیرونی → پانویس شماره‌دار + فهرست nofollow
|==============================================================================
| اندازه‌گیری‌شده روی بسته‌های درون‌ریز این پروژه (۱۱۳ مقاله):
|   ۷٬۰۵۹ لینک بیرونی dofollow  /  ۱٬۲۲۲ لینک داخلی  →  نسبت ۵٫۸ به ۱
|   ۴٬۲۷۹ تای آن‌ها (۶۱٪) به fa.wikipedia.org
| هر مقاله‌ی شهرستان به‌طور میانگین ۵۳ لینک dofollow بیرونی دارد؛ یعنی حدود
| یک لینک خروجی به‌ازای هر ۱۹ واژه. این هم وزن صفحه را بیرون می‌فرستد و هم
| به‌صورت ماشین‌خوان اعلام می‌کند «منبع اصلی این متن، همان صفحه‌ای است که
| همین الان بالاتر از ما رتبه دارد».
|
| بعد از این ماژول: لینک dofollow بیرونی = صفر. هر منبع یکتا فقط یک‌بار در
| «پانویس‌ها» می‌آید با rel="nofollow ugc noopener noreferrer".
*/

/**
 * نام خوانا برای دامنه‌ی منبع.
 *
 * @param string $host دامنه بدون www.
 * @return string
 */
function sa_guard_source_label( $host ) {
	$map = array(
		'fa.wikipedia.org'  => 'ویکی‌پدیای فارسی',
		'en.wikipedia.org'  => 'ویکی‌پدیای انگلیسی',
		'wikidata.org'      => 'ویکی‌داده',
		'maps.google.com'   => 'گوگل مپ',
		'whc.unesco.org'    => 'یونسکو — میراث جهانی',
		'ich.unesco.org'    => 'یونسکو — میراث ناملموس',
		'unesco.org'        => 'یونسکو',
		'amar.org.ir'       => 'مرکز آمار ایران',
		'irna.ir'           => 'خبرگزاری ایرنا',
		'mehrnews.com'      => 'خبرگزاری مهر',
		'isna.ir'           => 'خبرگزاری ایسنا',
		'tasnimnews.com'    => 'خبرگزاری تسنیم',
		'yjc.ir'            => 'باشگاه خبرنگاران جوان',
		'iranicaonline.org' => 'دانشنامه‌ی ایرانیکا',
		'britannica.com'    => 'بریتانیکا',
		'citypopulation.de' => 'CityPopulation',
		'visitiran.ir'      => 'وزارت میراث‌فرهنگی، گردشگری و صنایع‌دستی',
		'doe.ir'            => 'سازمان حفاظت محیط زیست',
		'gsi.ir'            => 'سازمان زمین‌شناسی کشور',
		'web.archive.org'   => 'آرشیو اینترنت',
	);
	if ( isset( $map[ $host ] ) ) {
		return $map[ $host ];
	}
	foreach ( $map as $key => $label ) {
		if ( strlen( $host ) > strlen( $key ) && substr( $host, -strlen( $key ) - 1 ) === '.' . $key ) {
			return $label;
		}
	}
	return $host;
}

/**
 * تبدیل ارجاع‌های بیرونی متن به پانویس.
 *
 * @param string $html محتوای مقاله (پس از do_blocks و wpautop).
 * @return string
 */
function sa_guard_footnote_html( $html ) {
	$input = $html;
	if ( false === stripos( $html, '<a' ) ) {
		return $html;
	}

	$refs  = array(); // url => n.
	$order = array(); // n   => url.
	$n     = 0;

	$register = static function ( $url ) use ( &$refs, &$order, &$n ) {
		if ( ! isset( $refs[ $url ] ) ) {
			++$n;
			$refs[ $url ] = $n;
			$order[ $n ]  = $url;
		}
		return $refs[ $url ];
	};

	// گام ۱ — الگوی خود پروژه: <sup class="sa-cite"><a href="URL">۱</a></sup>.
	$html = preg_replace_callback(
		'#<sup\b[^>]*class=(["\'])[^"\']*\bsa-cite\b[^"\']*\1[^>]*>\s*<a\b[^>]*href=(["\'])([^"\']+)\2[^>]*>(.*?)</a>\s*</sup>#isu',
		static function ( $m ) use ( $register ) {
			$url = html_entity_decode( $m[3], ENT_QUOTES, 'UTF-8' );
			if ( ! sa_guard_is_external( $url ) ) {
				return $m[0];
			}
			$i = $register( $url );
			return '<sup class="sa-ref"><a href="#sa-ref-' . $i . '" aria-label="پانویس ' . $i . '">'
				. esc_html( sa_guard_fa_digits( (string) $i ) ) . '</a></sup>';
		},
		$html
	);

	// گام ۲ — هر لینک بیرونی آزاد باقی‌مانده در متن: متن لنگر می‌ماند، لینک نمی‌ماند.
	$html = preg_replace_callback(
		'#<a\b([^>]*)href=(["\'])([^"\']+)\2([^>]*)>(.*?)</a>#isu',
		static function ( $m ) use ( $register ) {
			$url = html_entity_decode( $m[3], ENT_QUOTES, 'UTF-8' );
			if ( ! sa_guard_is_external( $url ) ) {
				return $m[0];
			}
			$i = $register( $url );
			return $m[5] . '<sup class="sa-ref"><a href="#sa-ref-' . $i . '" aria-label="پانویس ' . $i . '">'
				. esc_html( sa_guard_fa_digits( (string) $i ) ) . '</a></sup>';
		},
		$html
	);

	// preg_* روی UTF-8 نامعتبر null برمی‌گرداند — در آن حالت چیزی را خراب نکن.
	if ( ! is_string( $html ) || '' === $html ) {
		return $input;
	}
	if ( ! $order ) {
		return $html;
	}

	$items = '';
	foreach ( $order as $i => $url ) {
		$host   = preg_replace( '/^www\./', '', (string) wp_parse_url( $url, PHP_URL_HOST ) );
		$label  = sa_guard_source_label( $host );
		$items .= '<li id="sa-ref-' . $i . '" class="sa-ref__item">'
			. '<span class="sa-ref__n">' . esc_html( sa_guard_fa_digits( (string) $i ) ) . '</span> '
			. '<a href="' . esc_url( $url ) . '" rel="nofollow ugc noopener noreferrer external" target="_blank">'
			. esc_html( $label ) . '</a> '
			. '<span class="sa-ref__host">' . esc_html( $host ) . '</span></li>';
	}

	// عنوان عمداً «پانویس‌ها» است، نه «منابع» — قالب خودش یک بخش «منابع» از
	// فیلد متا می‌سازد و دو <h2>منابع</h2> در یک صفحه اشتباه است.
	return $html . '<section class="sa-footnotes" aria-labelledby="sa-footnotes-title">'
		. '<h2 id="sa-footnotes-title" class="sa-footnotes__title">پانویس‌ها و ارجاع‌های متن</h2>'
		. '<ol class="sa-footnotes__list">' . $items . '</ol></section>';
}

/*
|==============================================================================
| ۲ — H1 دوم
|==============================================================================
| هر ۸۲ مقاله‌ی شهرستان یک <h1> داخل بدنه دارند، در حالی که
| template-parts/entity/hero.php هم <h1 class="entry-title"> می‌زند.
| نتیجه: هر صفحه دو H1 با دو متن متفاوت.
*/

/**
 * تنزل H1 بدنه به H2.
 *
 * @param string $html محتوا.
 * @return string
 */
function sa_guard_demote_h1( $html ) {
	if ( false === stripos( $html, '<h1' ) ) {
		return $html;
	}
	$input = $html;
	$html  = preg_replace( '#<!--\s*wp:heading\s*\{\s*"level"\s*:\s*1[^}]*\}\s*-->#i', '<!-- wp:heading -->', $html );
	$html  = preg_replace( '#<h1\b([^>]*)>(.*?)</h1>#isu', '<h2$1 data-sa-was="h1">$2</h2>', (string) $html );
	return ( is_string( $html ) && '' !== $html ) ? $html : $input;
}

/*
|==============================================================================
| ۳ — بلوک تکراری پایانی
|==============================================================================
| «از مردم عزیز شهرستان …، یک درخواست داریم» در هر ۸۲ مقاله عیناً تکرار شده
| (~۶۰ واژه). داخل <article> بودن یعنی بخشی از متن یکتا شمرده می‌شود؛
| داخل <aside> یعنی «مبلمان سایت».
*/

/**
 * جدا کردن بلوک انجمنی از بدنه.
 *
 * @param string $html محتوا.
 * @return string
 */
function sa_guard_extract_community_box( $html ) {
	// strpos روی بایت کار می‌کند و برای یافتن یک زیررشته‌ی UTF-8 درست است؛
	// مهم این است که offset بایتی با substr بایتی جفت بماند (mb_strpos اینجا باگ می‌سازد).
	if ( false === strpos( $html, 'از مردم عزیز' ) ) {
		return $html;
	}
	$patterns = array(
		'#<!--\s*wp:heading\s*-->\s*<h2\b[^>]*>\s*از\s+مردم\s+عزیز.*?</h2>\s*<!--\s*/wp:heading\s*-->(.*)$#isu',
		'#<h2\b[^>]*>\s*از\s+مردم\s+عزیز.*?</h2>(.*)$#isu',
	);
	foreach ( $patterns as $p ) {
		if ( preg_match( $p, $html, $m, PREG_OFFSET_CAPTURE ) ) {
			$offset = (int) $m[0][1]; // آفست بایتی، هم‌جنس با substr.
			$head   = trim( substr( $html, 0, $offset ) );
			$body   = trim( (string) $m[1][0] );
			if ( '' === $head ) {
				return $html; // چیزی برای نگه‌داشتن نماند — دست نزن.
			}
			return $head
				. '<aside class="sa-community" role="complementary" aria-labelledby="sa-community-title">'
				. '<h2 id="sa-community-title" class="sa-community__title">از مردم این دیار، یک درخواست داریم</h2>'
				. $body . '</aside>';
		}
	}
	return $html;
}

/**
 * فیلتر اصلی محتوا (با کش ترنزینت).
 *
 * @param string $content محتوا.
 * @return string
 */
function sa_guard_the_content( $content ) {
	$content = (string) $content;
	if ( is_admin() || is_feed() || ! is_singular() || ! in_the_loop() || ! is_main_query() ) {
		return $content;
	}
	if ( '' === trim( $content ) ) {
		return $content;
	}

	$flags = ( sa_guard_on( 'citations' ) ? 'c' : '' )
		. ( sa_guard_on( 'single_h1' ) ? 'h' : '' )
		. ( sa_guard_on( 'community_box' ) ? 'b' : '' );
	if ( '' === $flags ) {
		return $content;
	}

	$key    = 'sa_guard_' . md5( SA_GUARD_VERSION . '|' . $flags . '|' . $content );
	$cached = get_transient( $key );
	if ( is_string( $cached ) && '' !== $cached ) {
		return $cached;
	}

	$out = $content;
	if ( sa_guard_on( 'single_h1' ) ) {
		$out = sa_guard_demote_h1( $out );
	}
	if ( sa_guard_on( 'community_box' ) ) {
		$out = sa_guard_extract_community_box( $out );
	}
	if ( sa_guard_on( 'citations' ) ) {
		$out = sa_guard_footnote_html( $out );
	}

	if ( ! is_string( $out ) || '' === $out ) {
		return $content; // هر خطای preg → محتوای اصلی.
	}

	set_transient( $key, $out, WEEK_IN_SECONDS );
	return $out;
}
add_filter( 'the_content', 'sa_guard_the_content', 12 );

/*
|==============================================================================
| ۴ — لینک‌های ۴۰۴  و  ۵ — فونت گوگل   (بافر خروجی)
|==============================================================================
| ۴: صفحه‌ی اصلی فهرست ۳۱ استان را از آرایه‌ی ثابت data/provinces.php می‌سازد،
|    نه از پست‌های منتشرشده. چون ۴ استان منتشر است، ۲۷ لینک صفحه‌ی اصلی
|    (هم روی نقشه‌ی SVG و هم روی نوارهای رنگی) به ۴۰۴ می‌رود.
| ۵: template-home.php یک @import به fonts.googleapis.com دارد، در حالی که
|    همان Vazirmatn به‌صورت محلی در قالب مادر بارگذاری می‌شود. از داخل ایران
|    این درخواست معمولاً برنمی‌گردد و چون @import داخل <style> است، رندر را
|    بلوک می‌کند.
*/

/**
 * نامک‌های منتشرشده‌ی هر CPT.
 *
 * @return array<string,array<string,true>>
 */
function sa_guard_published_map() {
	$map = get_transient( 'sa_guard_pubmap' );
	if ( is_array( $map ) ) {
		return $map;
	}

	$types = function_exists( 'sa_entity_types' )
		? array_values( array_filter( array_map( 'strval', (array) sa_entity_types() ) ) )
		: array( 'province', 'city', 'attraction', 'travel_route', 'local_food', 'souvenir', 'accommodation' );

	$map = array();
	foreach ( $types as $t ) {
		$map[ $t ] = array();
	}
	if ( ! $types ) {
		return $map;
	}

	global $wpdb;
	$placeholders = implode( ',', array_fill( 0, count( $types ), '%s' ) );
	// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	$sql  = "SELECT post_type, post_name FROM {$wpdb->posts} WHERE post_status = 'publish' AND post_name <> '' AND post_type IN ({$placeholders})";
	$rows = $wpdb->get_results( $wpdb->prepare( $sql, $types ) );
	// phpcs:enable
	foreach ( (array) $rows as $r ) {
		if ( isset( $map[ $r->post_type ] ) ) {
			$map[ $r->post_type ][ $r->post_name ] = true;
		}
	}

	set_transient( 'sa_guard_pubmap', $map, 12 * HOUR_IN_SECONDS );
	return $map;
}

/**
 * پاک‌کردن کش نقشه.
 */
function sa_guard_flush_pubmap() {
	delete_transient( 'sa_guard_pubmap' );
}
add_action( 'transition_post_status', 'sa_guard_flush_pubmap' );
add_action( 'deleted_post', 'sa_guard_flush_pubmap' );

/**
 * پیشوند نشانی → CPT.
 *
 * @return array<string,string>
 */
function sa_guard_slug_base_map() {
	$defaults = array(
		'province'   => 'province',
		'city'       => 'city',
		'attraction' => 'attraction',
		'route'      => 'travel_route',
		'food'       => 'local_food',
		'souvenir'   => 'souvenir',
		'stay'       => 'accommodation',
	);
	/**
	 * نگاشت پیشوند URL به نوع پست.
	 *
	 * @param array<string,string> $defaults نگاشت.
	 */
	return (array) apply_filters( 'sa_guard_slug_base_map', $defaults );
}

/**
 * خنثی‌کردن لینک به موجودیت منتشرنشده.
 *
 * تگ <a> حذف نمی‌شود، فقط href/target/rel برداشته می‌شود. دلیل: بعضی از این
 * لینک‌ها داخل <svg> هستند (نقشه‌ی صفحه‌ی اصلی) و تبدیل‌شان به <span> ساختار
 * SVG را می‌شکند. <a> بدون href در HTML و SVG معتبر و غیرقابل‌پیمایش است.
 *
 * @param string $html HTML کامل صفحه.
 * @return string
 */
function sa_guard_neutralise_dead_links( $html ) {
	$bases = sa_guard_slug_base_map();
	if ( ! $bases ) {
		return $html;
	}
	$map     = sa_guard_published_map();
	$home    = rtrim( (string) home_url(), '/' );
	$base_re = implode( '|', array_map( 'preg_quote', array_keys( $bases ) ) );

	$pattern = '#<a\b([^>]*?)href=(["\'])(?:' . preg_quote( $home, '#' ) . ')?/('
		. $base_re . ')/([^/"\'?\#]+)/?\2([^>]*)>#isu';

	$out = preg_replace_callback(
		$pattern,
		static function ( $m ) use ( $bases, $map ) {
			$cpt  = isset( $bases[ $m[3] ] ) ? $bases[ $m[3] ] : '';
			$slug = rawurldecode( $m[4] );
			if ( '' === $cpt || ! isset( $map[ $cpt ] ) || isset( $map[ $cpt ][ $slug ] ) ) {
				return $m[0]; // منتشر شده یا ناشناخته — دست نزن.
			}
			$attrs = ' ' . trim( $m[1] . ' ' . $m[5] );
			$attrs = preg_replace( '#\s(?:target|rel|href)=(["\']).*?\1#i', '', $attrs );
			if ( preg_match( '#class=(["\'])([^"\']*)\1#i', $attrs, $cm ) ) {
				$attrs = str_replace( $cm[0], 'class="' . $cm[2] . ' sa-soon"', $attrs );
			} else {
				$attrs .= ' class="sa-soon"';
			}
			return '<a' . rtrim( $attrs ) . ' data-sa-soon="1" aria-disabled="true" title="این صفحه هنوز منتشر نشده است">';
		},
		$html
	);

	return is_string( $out ) ? $out : $html;
}

/**
 * حذف هر درخواست فونت از دامنه‌های گوگل.
 *
 * @param string $html HTML کامل صفحه.
 * @return string
 */
function sa_guard_strip_remote_fonts( $html ) {
	$out = preg_replace( '#@import\s+url\(\s*[\'"]?https?://fonts\.(?:googleapis|gstatic)\.com[^)]*\)\s*;?#i', '', $html );
	$out = preg_replace( '#<link\b[^>]*href=(["\'])https?://fonts\.(?:googleapis|gstatic)\.com[^"\']*\1[^>]*/?>#i', '', $out );
	return is_string( $out ) ? $out : $html;
}

/**
 * بافر خروجی جبهه‌ی سایت.
 */
function sa_guard_start_buffer() {
	if ( is_admin() || is_feed() || is_embed() || wp_doing_ajax() ) {
		return;
	}
	if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
		return;
	}
	if ( ! sa_guard_on( 'dead_links' ) && ! sa_guard_on( 'remote_fonts' ) ) {
		return;
	}

	ob_start(
		static function ( $html ) {
			$html = (string) $html;
			// فقط صفحه‌ی HTML کامل؛ تکه‌های AJAX/stream دست‌نخورده می‌مانند.
			if ( strlen( $html ) < 200 || false === stripos( $html, '</body>' ) ) {
				return $html;
			}
			if ( strlen( $html ) > 4000000 ) {
				return $html; // بیش از حد بزرگ — ریسک نکن.
			}
			$original = $html;
			try {
				if ( sa_guard_on( 'remote_fonts' ) ) {
					$html = sa_guard_strip_remote_fonts( $html );
				}
				if ( sa_guard_on( 'dead_links' ) ) {
					$html = sa_guard_neutralise_dead_links( $html );
				}
			} catch ( Exception $e ) {
				return $original;
			}
			return ( is_string( $html ) && '' !== $html ) ? $html : $original;
		}
	);
}
add_action( 'template_redirect', 'sa_guard_start_buffer', 1 );

/**
 * استایل کم‌حجم برای عناصر تازه.
 */
function sa_guard_inline_css() {
	$css = '.sa-ref{font-size:.72em;line-height:0;vertical-align:super}'
		. '.sa-ref a{text-decoration:none;color:#2f6bff;padding:0 .15em}'
		. '.sa-footnotes{margin-block-start:2.5rem;padding-block-start:1rem;border-top:1px solid rgba(11,20,36,.12);font-size:.92em}'
		. '.sa-footnotes__title{font-size:1.15rem;margin-block-end:.75rem}'
		. '.sa-footnotes__list{list-style:none;padding:0;margin:0;display:grid;gap:.4rem}'
		. '.sa-ref__n{display:inline-block;min-width:1.7em;color:#5b6b80}'
		. '.sa-ref__host{color:#8b97a8;font-size:.85em;direction:ltr;unicode-bidi:isolate}'
		. '.sa-community{margin-block-start:2rem;padding:1.25rem 1.4rem;border-radius:1rem;background:#f2f6fc;border:1px solid rgba(47,107,255,.14)}'
		. '.sa-community__title{font-size:1.1rem;margin:0 0 .6rem}'
		. '.sa-soon{opacity:.55;cursor:default;pointer-events:none}';
	echo '<style id="sa-guard-css">' . $css . '</style>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
}
add_action( 'wp_head', 'sa_guard_inline_css', 20 );

/*
|==============================================================================
| ۶ — دروازه‌ی انتشار بدون بن‌بست
|==============================================================================
| sa_content_minimums() برای «استان» ۲۰ لینک داخلی می‌خواهد و sa_gate_filter()
| در حالت hard پست را به draft برمی‌گرداند. یک استان تا وقتی همه‌ی شهرستان‌هایش
| ساخته نشوند به ۲۰ لینک نمی‌رسد → ۲۷ استانِ نوشته‌شده قفل می‌مانند و سایت
| هیچ بازخوردی از گوگل نمی‌گیرد.
|
| اینجا همان بررسی‌ها اجرا می‌شود، اما فقط مواردی جلوی انتشار را می‌گیرند که
| واقعاً صفحه را ناقص می‌کنند. بقیه هشدار می‌شوند.
*/

/**
 * جایگزینی دروازه‌ی سخت قالب.
 */
function sa_guard_swap_gate() {
	if ( ! sa_guard_on( 'relax_gate' ) || ! function_exists( 'sa_gate_filter' ) ) {
		return;
	}
	remove_filter( 'wp_insert_post_data', 'sa_gate_filter', 20 );
	add_filter( 'wp_insert_post_data', 'sa_guard_gate_filter', 20, 2 );
}
add_action( 'init', 'sa_guard_swap_gate', 20 );

/**
 * دروازه‌ی تازه.
 *
 * مانع انتشار: تصویر شاخص · عنوان سئو · توضیحات متا · کلیدواژه‌ی کانونی ·
 *              رابطه‌ی والد · طبقه‌بندی اصلی.
 * فقط هشدار:  تعداد FAQ · تعداد لینک داخلی · مختصات · برچسب‌های «نیازمند بررسی».
 *
 * @param array $data    داده‌ی پست.
 * @param array $postarr آرایه‌ی پست.
 * @return array
 */
function sa_guard_gate_filter( $data, $postarr ) {
	if ( ! is_array( $data ) || ! isset( $data['post_status'], $data['post_type'] ) ) {
		return $data;
	}
	if ( 'publish' !== $data['post_status'] ) {
		return $data;
	}
	if ( ! function_exists( 'sa_is_entity' ) || ! sa_is_entity( $data['post_type'] ) ) {
		return $data;
	}
	$post_id = isset( $postarr['ID'] ) ? (int) $postarr['ID'] : 0;
	if ( ! $post_id || ! function_exists( 'sa_gate_missing' ) ) {
		return $data;
	}

	$missing  = (array) sa_gate_missing( $post_id, $data['post_type'], null );
	$warnings = function_exists( 'sa_gate_warnings' )
		? (array) sa_gate_warnings( $post_id, $data['post_type'], null )
		: array();

	$blocking = array();
	foreach ( $missing as $row ) {
		$row = (string) $row;
		// «سوالات متداول: …» / «لینک داخلی: …» / «مختصات …» → هشدار، نه مانع.
		if ( preg_match( '/^(سوالات متداول|لینک داخلی|مختصات)/u', $row ) ) {
			$warnings[] = $row . ' — مانع انتشار نیست';
			continue;
		}
		$blocking[] = $row;
	}

	/**
	 * فهرست نهایی مانع‌های انتشار.
	 *
	 * @param string[] $blocking مانع‌ها.
	 * @param int      $post_id  شناسه.
	 * @param string   $type     CPT.
	 */
	$blocking = (array) apply_filters( 'sa_guard_blocking', $blocking, $post_id, $data['post_type'] );

	if ( $blocking || $warnings ) {
		set_transient(
			'sa_gate_' . get_current_user_id(),
			array(
				'post'     => $post_id,
				'missing'  => $blocking,
				'warnings' => $warnings,
				'mode'     => $blocking ? 'hard' : 'info',
			),
			120
		);
	}

	if ( $blocking ) {
		$data['post_status'] = 'draft';
	}
	return $data;
}

/*
|==============================================================================
| ۷ — ابزارها → سلامت محتوا
|==============================================================================
*/

/**
 * ثبت صفحه‌ی گزارش.
 */
function sa_guard_admin_menu() {
	if ( ! sa_guard_on( 'health_page' ) ) {
		return;
	}
	add_management_page( 'سلامت محتوا', 'سلامت محتوا', 'edit_posts', 'sa-content-health', 'sa_guard_health_page' );
}
add_action( 'admin_menu', 'sa_guard_admin_menu' );

/**
 * صفحه‌ی گزارش سلامت.
 */
function sa_guard_health_page() {
	if ( ! current_user_can( 'edit_posts' ) ) {
		wp_die( esc_html__( 'Sorry, you are not allowed to access this page.' ) );
	}
	$types = function_exists( 'sa_entity_types' ) ? (array) sa_entity_types() : array( 'province', 'city' );
	$map   = sa_guard_published_map();

	echo '<div class="wrap" dir="rtl"><h1>سلامت محتوا</h1>';
	echo '<p>گزارش زنده از مشکلاتی که «SA Content Guard» هنگام نمایش اصلاح می‌کند. برای رفع دائمی، محتوای مبدأ را در مخزن اصلاح و دوباره درون‌ریزی کنید.</p>';

	echo '<h2>وضعیت انتشار</h2><table class="widefat striped"><thead><tr><th>موجودیت</th><th>منتشرشده</th><th>پیش‌نویس</th></tr></thead><tbody>';
	foreach ( $types as $t ) {
		$c = wp_count_posts( $t );
		echo '<tr><td>' . esc_html( (string) $t ) . '</td>'
			. '<td>' . esc_html( sa_guard_fa_digits( isset( $c->publish ) ? (string) (int) $c->publish : '0' ) ) . '</td>'
			. '<td>' . esc_html( sa_guard_fa_digits( isset( $c->draft ) ? (string) (int) $c->draft : '0' ) ) . '</td></tr>';
	}
	echo '</tbody></table>';

	$q = new WP_Query(
		array(
			'post_type'      => $types,
			'post_status'    => array( 'publish', 'draft' ),
			'posts_per_page' => 300,
			'no_found_rows'  => true,
			'fields'         => 'ids',
			'orderby'        => 'ID',
			'order'          => 'ASC',
		)
	);

	$rows  = array();
	$dead  = array();
	$bases = sa_guard_slug_base_map();
	$brx   = implode( '|', array_map( 'preg_quote', array_keys( $bases ) ) );

	foreach ( $q->posts as $pid ) {
		$content = (string) get_post_field( 'post_content', $pid );
		$ext     = 0;
		$int     = 0;
		if ( preg_match_all( '/href=["\']([^"\']+)["\']/i', $content, $m ) ) {
			foreach ( $m[1] as $href ) {
				if ( sa_guard_is_external( $href ) ) {
					++$ext;
				} elseif ( '' !== $href && '#' !== $href[0] ) {
					++$int;
				}
			}
		}
		$rows[] = array( $pid, $ext, $int );

		if ( $brx && preg_match_all( '#href=["\'](?:https?://[^/"\']+)?/(' . $brx . ')/([^/"\'?\#]+)/?["\']#i', $content, $mm, PREG_SET_ORDER ) ) {
			foreach ( $mm as $hit ) {
				$cpt  = isset( $bases[ $hit[1] ] ) ? $bases[ $hit[1] ] : '';
				$slug = rawurldecode( $hit[2] );
				if ( $cpt && empty( $map[ $cpt ][ $slug ] ) ) {
					$k          = $cpt . '/' . $slug;
					$dead[ $k ] = isset( $dead[ $k ] ) ? $dead[ $k ] + 1 : 1;
				}
			}
		}
	}

	usort(
		$rows,
		static function ( $a, $b ) {
			return $b[1] - $a[1];
		}
	);

	echo '<h2>بیشترین لینک بیرونی در متن ذخیره‌شده</h2>';
	echo '<p><em>این‌ها در جبهه‌ی سایت خودکار به پانویس تبدیل می‌شوند؛ عدد زیر وضعیت دیتابیس است، نه وضعیت چیزی که گوگل می‌بیند.</em></p>';
	echo '<table class="widefat striped"><thead><tr><th>نوشته</th><th>بیرونی</th><th>داخلی</th></tr></thead><tbody>';
	foreach ( array_slice( $rows, 0, 25 ) as $r ) {
		echo '<tr><td><a href="' . esc_url( (string) get_edit_post_link( $r[0] ) ) . '">' . esc_html( (string) get_the_title( $r[0] ) ) . '</a></td>'
			. '<td>' . esc_html( sa_guard_fa_digits( (string) $r[1] ) ) . '</td>'
			. '<td>' . esc_html( sa_guard_fa_digits( (string) $r[2] ) ) . '</td></tr>';
	}
	echo '</tbody></table>';

	arsort( $dead );
	echo '<h2>لینک داخلی به صفحه‌ی منتشرنشده</h2>';
	if ( ! $dead ) {
		echo '<p>موردی نیست.</p>';
	} else {
		echo '<table class="widefat striped"><thead><tr><th>مقصد</th><th>چند بار لینک شده</th></tr></thead><tbody>';
		$i = 0;
		foreach ( $dead as $target => $count ) {
			if ( ++$i > 60 ) {
				break;
			}
			echo '<tr><td><code>' . esc_html( (string) $target ) . '</code></td>'
				. '<td>' . esc_html( sa_guard_fa_digits( (string) $count ) ) . '</td></tr>';
		}
		echo '</tbody></table>';
		echo '<p><em>این لینک‌ها در جبهه‌ی سایت غیرفعال می‌شوند، پس ۴۰۴ تولید نمی‌کنند. با انتشار صفحه‌ی مقصد، خودبه‌خود دوباره فعال می‌شوند.</em></p>';
	}

	echo '</div>';
}

/*
|==============================================================================
| پاک‌سازی کش
|==============================================================================
*/

/**
 * حذف ترنزینت‌های محتوای این افزونه.
 */
function sa_guard_flush_content_cache() {
	global $wpdb;
	// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	$wpdb->query(
		"DELETE FROM {$wpdb->options}
		 WHERE option_name LIKE '\_transient\_sa\_guard\_%'
		    OR option_name LIKE '\_transient\_timeout\_sa\_guard\_%'"
	);
	// phpcs:enable
	wp_cache_flush();
}
add_action( 'save_post', 'sa_guard_flush_content_cache' );
add_action( 'switch_theme', 'sa_guard_flush_content_cache' );
