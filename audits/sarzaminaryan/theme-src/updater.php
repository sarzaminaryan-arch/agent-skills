<?php
/**
 * به‌روزرسانی خودکار قالب از گیت‌هاب (v2.7.0)
 *
 * چرا این فایل وجود دارد: تا امروز هر تغییر کوچک یعنی دانلود یک بسته‌ی ۴۲۰
 * کیلوبایتی روی اتصال ناپایدار، بعد جنگیدن با بارگذارِ وردپرس. چند بار هم
 * شکست خورد. مشکل، خودِ روش تحویل بود.
 *
 * از این پس قالب مثل هر قالب دیگری به‌روز می‌شود:
 *
 *   پیشخوان → داشبورد → به‌روزرسانی‌ها  →  «به‌روزرسانی سرزمین آریان»  →  یک کلیک
 *
 * تفاوت مهم: فایل را **سرور** دانلود می‌کند، نه مرورگر شما. یعنی VPN، فیلترینگ
 * و حجم بسته دیگر موضوعیت ندارند.
 *
 * چطور کار می‌کند: یک فایل کوچک JSON روی گیت‌هاب شماره‌ی آخرین نسخه و نشانی
 * بسته را نگه می‌دارد. این ماژول روزی یک‌بار آن را می‌خواند و اگر نسخه‌ی تازه‌تری
 * بود، به وردپرس اطلاع می‌دهد. بقیه‌ی کار با خود وردپرس است.
 *
 * خاموش‌کردن: define( 'SA_UPDATER', false );  در wp-config.php
 *
 * @package Sarzaminaryan_Child
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** نشانی فایل نسخه‌ها. شاخه ثابت است، پس این نشانی هیچ‌وقت عوض نمی‌شود. */
if ( ! defined( 'SA_UPDATE_MANIFEST' ) ) {
	define(
		'SA_UPDATE_MANIFEST',
		'https://raw.githubusercontent.com/sarzaminaryan-arch/agent-skills/refs/heads/arena/01a0ef63-agent-skills/audits/sarzaminaryan/theme-update.json'
	);
}

/** نامک پوشه‌ی قالب — باید با نام پوشه روی سرور یکی باشد. */
if ( ! defined( 'SA_UPDATE_SLUG' ) ) {
	define( 'SA_UPDATE_SLUG', 'sarzaminaryan-child' );
}

/**
 * آیا به‌روزرسانی خودکار فعال است؟
 *
 * @return bool
 */
function sa_updater_enabled() {
	$on = defined( 'SA_UPDATER' ) ? (bool) SA_UPDATER : true;

	/**
	 * فعال/غیرفعال کردن به‌روزرسانی خودکار.
	 *
	 * @param bool $on وضعیت.
	 */
	return (bool) apply_filters( 'sa_updater_enabled', $on );
}

/**
 * خواندن فایل نسخه‌ها (با کش ۱۲ ساعته).
 *
 * @param bool $force نادیده‌گرفتن کش.
 * @return array|null
 */
function sa_updater_remote( $force = false ) {
	if ( ! sa_updater_enabled() ) {
		return null;
	}
	if ( ! $force ) {
		$cached = get_site_transient( 'sa_update_manifest' );
		if ( is_array( $cached ) ) {
			return $cached;
		}
		if ( 'none' === $cached ) {
			return null; // تلاش قبلی ناموفق بود؛ تا انقضا دوباره امتحان نکن.
		}
	}

	$res = wp_remote_get(
		SA_UPDATE_MANIFEST,
		array(
			'timeout'    => 12,
			'headers'    => array( 'Accept' => 'application/json' ),
			'user-agent' => 'SarzaminAryanChild/' . SA_CHILD_VERSION . '; ' . home_url( '/' ),
		)
	);

	if ( is_wp_error( $res ) || 200 !== (int) wp_remote_retrieve_response_code( $res ) ) {
		// شبکه در دسترس نیست — بی‌سروصدا رد شو، هیچ چیزی خراب نمی‌شود.
		set_site_transient( 'sa_update_manifest', 'none', 2 * HOUR_IN_SECONDS );
		return null;
	}

	$data = json_decode( wp_remote_retrieve_body( $res ), true );
	if ( ! is_array( $data ) || empty( $data['version'] ) || empty( $data['download_url'] ) ) {
		set_site_transient( 'sa_update_manifest', 'none', 2 * HOUR_IN_SECONDS );
		return null;
	}

	set_site_transient( 'sa_update_manifest', $data, 12 * HOUR_IN_SECONDS );
	return $data;
}

/**
 * اعلام نسخه‌ی تازه به وردپرس.
 *
 * @param mixed $transient ترنزینت به‌روزرسانی پوسته‌ها.
 * @return mixed
 */
function sa_updater_check( $transient ) {
	if ( ! is_object( $transient ) || ! sa_updater_enabled() ) {
		return $transient;
	}
	$remote = sa_updater_remote();
	if ( ! $remote ) {
		return $transient;
	}

	$new = (string) $remote['version'];
	if ( version_compare( $new, SA_CHILD_VERSION, '<=' ) ) {
		if ( isset( $transient->response[ SA_UPDATE_SLUG ] ) ) {
			unset( $transient->response[ SA_UPDATE_SLUG ] );
		}
		return $transient;
	}

	$transient->response[ SA_UPDATE_SLUG ] = array(
		'theme'        => SA_UPDATE_SLUG,
		'new_version'  => $new,
		'url'          => isset( $remote['changelog_url'] ) ? $remote['changelog_url'] : '',
		'package'      => (string) $remote['download_url'],
		'requires'     => isset( $remote['requires'] ) ? $remote['requires'] : '6.4',
		'requires_php' => isset( $remote['requires_php'] ) ? $remote['requires_php'] : '7.4',
	);
	return $transient;
}
add_filter( 'pre_set_site_transient_update_themes', 'sa_updater_check' );

/**
 * نام پوشه‌ی استخراج‌شده باید دقیقاً `sarzaminaryan-child` باشد، وگرنه وردپرس
 * قالب دومی می‌سازد. بسته‌های ما درست‌اند، ولی این محافظ ارزان است.
 *
 * @param string $source        مسیر استخراج.
 * @param string $remote_source مسیر موقت.
 * @param object $upgrader      ارتقادهنده.
 * @param array  $args          آرگومان‌ها.
 * @return string
 */
function sa_updater_fix_folder( $source, $remote_source, $upgrader = null, $args = array() ) {
	if ( ! is_array( $args ) || ! isset( $args['theme'] ) || SA_UPDATE_SLUG !== $args['theme'] ) {
		return $source;
	}
	$want = trailingslashit( $remote_source ) . SA_UPDATE_SLUG;
	if ( untrailingslashit( $source ) === $want ) {
		return $source;
	}
	global $wp_filesystem;
	if ( $wp_filesystem && $wp_filesystem->move( $source, $want ) ) {
		return trailingslashit( $want );
	}
	return $source;
}
add_filter( 'upgrader_source_selection', 'sa_updater_fix_folder', 10, 4 );

/**
 * پاک‌کردن کش پس از هر به‌روزرسانی موفق.
 */
function sa_updater_after() {
	delete_site_transient( 'sa_update_manifest' );
	delete_site_transient( 'update_themes' );
}
add_action( 'upgrader_process_complete', 'sa_updater_after' );

/*
|------------------------------------------------------------------------------
| نمایش وضعیت در پیشخوان
|------------------------------------------------------------------------------
*/

/**
 * زیرمنوی «به‌روزرسانی قالب».
 */
function sa_updater_menu() {
	add_submenu_page(
		'sarzaminaryan',
		'به‌روزرسانی قالب',
		'— به‌روزرسانی قالب',
		'update_themes',
		'sa-theme-update',
		'sa_updater_page'
	);
}
add_action( 'admin_menu', 'sa_updater_menu', 21 );

/**
 * صفحه‌ی وضعیت.
 */
function sa_updater_page() {
	if ( ! current_user_can( 'update_themes' ) ) {
		wp_die( 'شما اجازه‌ی دسترسی به این صفحه را ندارید.' );
	}

	$force = isset( $_GET['sa_check'] ) && check_admin_referer( 'sa_update_check' ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	if ( $force ) {
		delete_site_transient( 'sa_update_manifest' );
		delete_site_transient( 'update_themes' );
	}
	$remote = sa_updater_remote( $force );

	echo '<div class="wrap" dir="rtl"><h1>به‌روزرسانی قالب</h1>';
	echo '<table class="widefat striped" style="max-width:660px"><tbody>';
	echo '<tr><td style="width:190px"><strong>نسخه‌ی نصب‌شده</strong></td><td>' . esc_html( SA_CHILD_VERSION ) . '</td></tr>';

	if ( ! sa_updater_enabled() ) {
		echo '<tr><td><strong>وضعیت</strong></td><td>به‌روزرسانی خودکار خاموش است (<code>SA_UPDATER</code>).</td></tr>';
	} elseif ( ! $remote ) {
		echo '<tr><td><strong>وضعیت</strong></td><td>سرور نتوانست فایل نسخه‌ها را بخواند — یعنی هاست شما به گیت‌هاب دسترسی ندارد. '
			. 'به‌روزرسانی دستی لازم است، ولی هیچ مشکلی برای سایت ایجاد نمی‌شود.</td></tr>';
	} else {
		$new = (string) $remote['version'];
		echo '<tr><td><strong>آخرین نسخه</strong></td><td>' . esc_html( $new ) . '</td></tr>';
		if ( version_compare( $new, SA_CHILD_VERSION, '>' ) ) {
			echo '<tr><td><strong>وضعیت</strong></td><td style="color:#b26a00"><strong>نسخه‌ی تازه موجود است.</strong> '
				. 'برای نصب: <a href="' . esc_url( admin_url( 'update-core.php' ) ) . '">داشبورد ← به‌روزرسانی‌ها</a></td></tr>';
		} else {
			echo '<tr><td><strong>وضعیت</strong></td><td style="color:#1c6b3c">به‌روز است ✓</td></tr>';
		}
		if ( ! empty( $remote['notes'] ) ) {
			echo '<tr><td><strong>تغییرات</strong></td><td>' . esc_html( (string) $remote['notes'] ) . '</td></tr>';
		}
	}
	echo '</tbody></table>';

	echo '<p style="margin-top:16px"><a class="button button-primary" href="'
		. esc_url( wp_nonce_url( admin_url( 'admin.php?page=sa-theme-update&sa_check=1' ), 'sa_update_check' ) )
		. '">بررسی دوباره</a></p>';

	echo '<p class="description" style="max-width:660px">فایل را <strong>سرور</strong> دانلود می‌کند، نه مرورگر شما؛ '
		. 'پس VPN، فیلترینگ و حجم بسته اثری ندارند. اگر روزی این روش کار نکرد، '
		. 'همیشه می‌توانید بسته را دستی از «نمایش ← پوسته‌ها ← افزودن ← بارگذاری» نصب کنید.</p>';

	echo '</div>';
}
