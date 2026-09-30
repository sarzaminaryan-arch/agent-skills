---
name: wp-persian-debug
description: "Use when diagnosing a broken or misbehaving Persian/RTL WordPress site: white screen of death, 500/502/508 errors, garbled Persian text (mojibake), broken ZWNJ, RTL layout breakage, plugin/theme conflicts, admin lockout, login redirect loops, failed updates, and Iranian-host-specific issues (LiteSpeed limits, entry process caps, ModSecurity false positives). Produces a reproducible diagnosis, not guesses. Route speed work to wp-persian-speed; route indexing problems to wp-persian-seo."
compatibility: "Targets WordPress 5.9+ (PHP 7.4+). Filesystem agent with bash. Many workflows require WP-CLI or FTP/SSH access. Read-only diagnosis first; all mutations are gated behind a backup."
---

# دیباگ وردپرس فارسی

## Inputs required

- **Exact symptom** — the literal error text or a description of what the user sees, and on which URL.
- **Scope** — frontend only, admin only, both, one page, or the whole site.
- **What changed last** — update, new plugin, host migration, PHP version change, theme edit. This answers most cases on its own.
- **Access available** — WP-CLI / SSH / FTP / cPanel file manager / only wp-admin / nothing.
- **Environment** — host type, web server, PHP version, WordPress version.
- **Backup status** — does a restorable backup exist, and from when.

If the user cannot state the exact error text, §1 produces it before anything else. Never guess at a fix from a vague description.

## Guardrails

1. **Diagnose before you change.** Every mutation must be preceded by a recorded symptom and a hypothesis. "Try disabling plugins" without reading the error log is not diagnosis.

2. **Back up before any mutation.** `wp db export` plus a file snapshot of anything you edit. On a host with no SSH, at minimum export the database from phpMyAdmin.

3. **Never enable `WP_DEBUG_DISPLAY` on a production site.** Log to file. Displayed notices leak paths and break the RTL layout and JSON responses.

4. **One change at a time, with re-test in between.** Bundled changes destroy the trail.

5. **Never edit core files.** If a core file looks wrong, reinstall core with `wp core download --force`.

6. **Do not "fix" mojibake by re-saving content** until you know whether the data is broken on disk or only broken on display. The wrong fix is irreversible. Read `references/encoding-and-mojibake.md` §2.

7. **Prefer read-only reproduction on staging.** If no staging exists, say so explicitly and get consent before touching production.

## Procedure

### 0) Capture the symptom

```bash
node skills/wp-persian-debug/scripts/debug_triage.mjs --root .
```

The script reports: debug constants, log file locations and their last errors, PHP/WP versions, must-use plugins, recently modified files, `.maintenance` leftovers, encoding declarations, `.htaccess` anomalies, and disk/permission red flags. It never writes.

Then capture the actual error, in this order:

```bash
# 1) HTTP status and headers — tells you 500 vs 502 vs 508 vs a plain 200 with a blank body
curl -sI https://example.ir/ | head -20

# 2) The raw body — a WSOD with a 200 status means PHP died silently or output was suppressed
curl -s https://example.ir/ | head -c 800

# 3) Logs, newest last
tail -50 wp-content/debug.log 2>/dev/null
tail -50 error_log 2>/dev/null
tail -50 ../logs/error_log 2>/dev/null
```

**Done when:** the exact status code and the exact error text (or confirmed silence) are recorded.

### 1) Turn on logging correctly

```php
// wp-config.php — above "That's all, stop editing!"
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );      // writes wp-content/debug.log
define( 'WP_DEBUG_DISPLAY', false ); // never true on production
@ini_set( 'display_errors', 0 );
define( 'SCRIPT_DEBUG', true );      // unminified core assets, helps JS errors
```

Reproduce the problem, then read the log. Read `references/error-log-reading.md` for how to find the real line among the noise — WordPress logs are mostly deprecation spam from Iranian commercial themes.

**Done when:** a stack trace or a specific fatal error line exists, or the log is confirmed empty while the symptom reproduces.

### 2) Route by symptom

| Symptom | Reference |
|---|---|
| White screen, 500, fatal error | `references/wsod-and-fatals.md` |
| Persian text shows as `Ø¢Ù…ÙˆØ²Ø´` or `????` | `references/encoding-and-mojibake.md` |
| Layout broken, elements on the wrong side | `references/rtl-layout-debug.md` |
| Suspected plugin or theme conflict | `references/conflict-isolation.md` |
| Cannot log in, redirect loop, locked out | `references/admin-lockout.md` |
| 508, resource limit, ModSecurity, LiteSpeed error | `references/iranian-hosting-issues.md` |
| Slow but not broken | → skill `wp-persian-speed` |
| Not indexed but working | → skill `wp-persian-seo` |

**Done when:** the symptom maps to a named cause with evidence, not a guess.

### 3) Isolate

Read `references/conflict-isolation.md` for the binary-search method that finds the culprit plugin in log₂(n) steps instead of n, plus how to do it without taking the site down (using a second user session, or `wp --skip-plugins`).

```bash
# read-only probes — these do not change site state
wp --skip-plugins --skip-themes option get home
wp plugin list --status=active --format=csv
wp theme list --status=active
```

**Done when:** the specific plugin, theme, or code path is named.

### 4) Fix and verify

- Apply the smallest change that addresses the named cause.
- Re-test the original symptom, with the original reproduction steps.
- Re-test one adjacent area (admin if you fixed frontend, and vice versa).
- Remove debug constants from `wp-config.php` and delete `debug.log` when finished.

```bash
rm -f wp-content/debug.log
```

**Done when:** the symptom is gone, the adjacent area still works, and debug logging is off.

### 5) Prevent recurrence

- Record the cause and fix in a `TROUBLESHOOTING.md` in the project.
- If the cause was an update, pin or stage updates.
- If the cause was a host limit, document the limit and the threshold.
- Consider a `mu-plugin` guard if the problem class can recur (example in `references/wsod-and-fatals.md` §7).

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| debug.log never appears | `WP_DEBUG_LOG` set after the constant is used, or `wp-content` not writable | `references/error-log-reading.md` §1 |
| "Fixed" it but it came back | Treated a symptom, not the cause | Go back to §1 and get the real trace |
| Disabling all plugins fixed it, re-enabling all broke it again | Interaction between two plugins, not one | `references/conflict-isolation.md` §4 |
| Persian text broke worse after a fix | Re-saved mojibake content, double-encoding it | `references/encoding-and-mojibake.md` §2 — restore from backup |
| Site works for you, broken for the client | Cache, cookie, or logged-in-only path | Test in a private window and while logged in |
| Changes have no effect at all | An aggressive server cache or an OPcache holding stale code | `references/iranian-hosting-issues.md` §5 |

## Verification

1. `node skills/wp-persian-debug/scripts/debug_triage.mjs --root .` reports no `error`-level findings.
2. The original reproduction steps no longer produce the symptom.
3. `curl -sI` returns 200 on the affected URL.
4. `wp core verify-checksums` passes.
5. Persian text renders correctly, including ZWNJ, on a fresh page load.
6. Debug constants are removed and `debug.log` is deleted.
