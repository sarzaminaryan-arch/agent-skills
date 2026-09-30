#!/usr/bin/env node
/**
 * debug_triage.mjs — read-only diagnostic snapshot of a WordPress install.
 *
 * Usage:
 *   node debug_triage.mjs [--root .] [--log-lines 20] [--json]
 *
 * Never writes, never mutates. Reports debug constants, log locations and the
 * last fatal errors, must-use plugins and drop-ins, leftover .maintenance,
 * recently modified files, encoding hazards (BOM, Arabic chars), .htaccess
 * anomalies, and permission red flags.
 *
 * Exit codes: 0 = no errors, 1 = errors found, 2 = usage/IO problem.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const argv = process.argv.slice(2);
const flag = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
const root = flag('root') || '.';
const logLines = Number(flag('log-lines') || 20);
const asJson = argv.includes('--json');

if (!existsSync(root)) {
  console.error(`root not found: ${root}`);
  process.exit(2);
}

const findings = [];
const add = (level, rule, message, hint) => findings.push({ level, rule, message, hint });
const info = {};
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
const readBytes = (p, n) => { try { return readFileSync(p).subarray(0, n); } catch { return Buffer.alloc(0); } };

function walk(dir, { maxDepth = 5, skip = /node_modules|\.git|\.cache|uploads/ } = {}, depth = 0, out = []) {
  if (depth > maxDepth || !existsSync(dir)) return out;
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    if (skip.test(p)) continue;
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, { maxDepth, skip }, depth + 1, out);
    else out.push({ path: p, size: st.size, mtime: st.mtimeMs, mode: st.mode });
  }
  return out;
}

// ------------------------------------------------------- 1. is this WP?

const isWpRoot = existsSync(join(root, 'wp-includes')) || existsSync(join(root, 'wp-config.php'));
info.wordpressRoot = isWpRoot;
if (!isWpRoot) {
  add('warn', 'not-wp-root', `${root} does not look like a WordPress root (no wp-includes / wp-config.php)`, 'run from the site root');
}

// version
const versionFile = join(root, 'wp-includes/version.php');
if (existsSync(versionFile)) {
  const v = read(versionFile);
  info.wpVersion = (v.match(/\$wp_version\s*=\s*'([^']+)'/) || [])[1] || null;
  info.requiredPhp = (v.match(/\$required_php_version\s*=\s*'([^']+)'/) || [])[1] || null;
}

// ------------------------------------------------ 2. wp-config constants

const cfgPath = join(root, 'wp-config.php');
if (existsSync(cfgPath)) {
  const cfg = read(cfgPath);
  const con = (name) => {
    const m = cfg.match(new RegExp(`define\\(\\s*['"]${name}['"]\\s*,\\s*([^)]+)\\)`));
    return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null;
  };
  info.constants = {
    WP_DEBUG: con('WP_DEBUG'),
    WP_DEBUG_LOG: con('WP_DEBUG_LOG'),
    WP_DEBUG_DISPLAY: con('WP_DEBUG_DISPLAY'),
    SCRIPT_DEBUG: con('SCRIPT_DEBUG'),
    DB_CHARSET: con('DB_CHARSET'),
    DB_COLLATE: con('DB_COLLATE'),
    WP_MEMORY_LIMIT: con('WP_MEMORY_LIMIT'),
    DISABLE_WP_CRON: con('DISABLE_WP_CRON'),
    WP_HOME: con('WP_HOME'),
    WP_SITEURL: con('WP_SITEURL'),
    DISALLOW_FILE_EDIT: con('DISALLOW_FILE_EDIT'),
  };

  if (info.constants.WP_DEBUG === 'true' && info.constants.WP_DEBUG_DISPLAY !== 'false') {
    add('error', 'debug-display', 'WP_DEBUG is true and WP_DEBUG_DISPLAY is not false — errors print into the page, breaking layout and JSON', 'SKILL.md guardrail 3');
  }
  if (info.constants.DB_CHARSET && info.constants.DB_CHARSET !== 'utf8mb4') {
    add('warn', 'db-charset', `DB_CHARSET is "${info.constants.DB_CHARSET}" (expect utf8mb4 for Persian)`, 'references/encoding-and-mojibake.md §3');
  }
  if (info.constants.DB_COLLATE && info.constants.DB_COLLATE !== '') {
    add('warn', 'db-collate', `DB_COLLATE is set to "${info.constants.DB_COLLATE}" — usually should be empty`, 'references/encoding-and-mojibake.md §3');
  }
  // constants defined after the "stop editing" marker never apply
  const stopIdx = cfg.search(/That's all, stop editing|stop editing! Happy/i);
  if (stopIdx > -1) {
    const after = cfg.slice(stopIdx);
    const late = [...after.matchAll(/define\(\s*['"](WP_DEBUG[A-Z_]*|SCRIPT_DEBUG|WP_MEMORY_LIMIT)['"]/g)].map((m) => m[1]);
    if (late.length) {
      add('error', 'late-constant', `constants defined after the "stop editing" marker will not apply: ${[...new Set(late)].join(', ')}`, 'references/error-log-reading.md §1');
    }
  }
  // BOM in wp-config
  const bom = readBytes(cfgPath, 3);
  if (bom.length === 3 && bom[0] === 0xef && bom[1] === 0xbb && bom[2] === 0xbf) {
    add('error', 'bom-wp-config', 'wp-config.php starts with a UTF-8 BOM — causes "headers already sent"', 'references/wsod-and-fatals.md §7');
  }
} else if (isWpRoot) {
  add('warn', 'no-wp-config', 'wp-config.php not found in the root', '');
}

// ------------------------------------------------------- 3. maintenance

if (existsSync(join(root, '.maintenance'))) {
  add('error', 'maintenance-file', '.maintenance exists — the site shows "briefly unavailable for scheduled maintenance"', 'references/wsod-and-fatals.md §4');
}

// ------------------------------------------------------------- 4. logs

const logCandidates = [
  'wp-content/debug.log',
  'error_log',
  'php_errorlog',
  '../error_log',
  '../logs/error_log',
  'wp-content/uploads/debug.log',
];
info.logs = [];
for (const rel of logCandidates) {
  const p = join(root, rel);
  if (!existsSync(p)) continue;
  let st;
  try { st = statSync(p); } catch { continue; }
  const content = read(p);
  const lines = content.split('\n').filter(Boolean);
  const fatals = lines.filter((l) => /fatal|uncaught|parse error/i.test(l));
  const deprecations = lines.filter((l) => /deprecated/i.test(l)).length;
  const dbErrors = lines.filter((l) => /database error/i.test(l)).length;
  const curlErrors = lines.filter((l) => /curl error|http_request_failed/i.test(l)).length;
  info.logs.push({
    path: rel,
    sizeKB: Math.round(st.size / 1024),
    lines: lines.length,
    fatals: fatals.length,
    deprecations,
    dbErrors,
    curlErrors,
    lastFatals: fatals.slice(-Math.min(logLines, 5)).map((l) => l.slice(0, 220)),
    tail: lines.slice(-logLines).map((l) => l.slice(0, 220)),
  });
  if (fatals.length) {
    add('error', 'fatal-in-log', `${fatals.length} fatal/parse errors in ${rel}; latest: ${fatals[fatals.length - 1].slice(0, 160)}`, 'references/wsod-and-fatals.md §3');
  }
  if (st.size > 50 * 1024 * 1024) {
    add('warn', 'huge-log', `${rel} is ${Math.round(st.size / 1048576)} MB — rotate or truncate it`, 'references/error-log-reading.md §7');
  }
  if (deprecations > 500) {
    add('warn', 'deprecation-flood', `${deprecations} deprecation notices in ${rel} — likely a PHP 8 upgrade with old theme/plugin code`, 'references/error-log-reading.md §4');
  }
  if (dbErrors > 0) {
    add('warn', 'db-errors', `${dbErrors} "WordPress database error" lines in ${rel}`, 'references/error-log-reading.md §4');
  }
  if (curlErrors > 0) {
    add('warn', 'curl-errors', `${curlErrors} outbound HTTP failures in ${rel} — a plugin is hanging on an unreachable service`, 'references/iranian-hosting-issues.md §7');
  }
  if (rel === 'wp-content/debug.log') {
    add('warn', 'public-debug-log', 'wp-content/debug.log is inside the web root and may be publicly readable', 'references/error-log-reading.md §7');
  }
}
if (info.logs.length === 0) {
  add('warn', 'no-log', 'no log file found — enable WP_DEBUG_LOG and reproduce the problem', 'references/error-log-reading.md §1');
}

// ------------------------------------------------ 5. mu-plugins, dropins

const muDir = join(root, 'wp-content/mu-plugins');
info.muPlugins = existsSync(muDir)
  ? readdirSync(muDir).filter((f) => f.endsWith('.php'))
  : [];
if (info.muPlugins.length) {
  add('warn', 'mu-plugins', `must-use plugins present (cannot be disabled from wp-admin): ${info.muPlugins.join(', ')}`, 'references/conflict-isolation.md §6');
}

const DROPINS = ['object-cache.php', 'advanced-cache.php', 'db.php', 'maintenance.php', 'sunrise.php', 'install.php'];
info.dropIns = DROPINS.filter((d) => existsSync(join(root, 'wp-content', d)));
if (info.dropIns.length) {
  add('warn', 'drop-ins', `drop-ins active: ${info.dropIns.join(', ')} — they load before plugins`, 'references/conflict-isolation.md §6');
}

// ------------------------------------------------------- 6. .htaccess

const htPath = join(root, '.htaccess');
if (existsSync(htPath)) {
  const ht = read(htPath);
  info.htaccessBytes = ht.length;
  const wpBlocks = (ht.match(/# BEGIN WordPress/g) || []).length;
  if (wpBlocks > 1) {
    add('error', 'htaccess-duplicate', `${wpBlocks} "# BEGIN WordPress" blocks in .htaccess — rewrite rules conflict`, 'references/wsod-and-fatals.md §6');
  }
  if (ht.length > 20000) {
    add('warn', 'htaccess-large', `.htaccess is ${ht.length} bytes — often accumulated plugin rules`, 'references/wsod-and-fatals.md §6');
  }
  if (!/AddDefaultCharset\s+UTF-8/i.test(ht) && /AddDefaultCharset/i.test(ht)) {
    add('warn', 'htaccess-charset', '.htaccess sets a non-UTF-8 default charset', 'references/encoding-and-mojibake.md §4');
  }
  if (/php_value\s+display_errors\s+1/i.test(ht)) {
    add('error', 'htaccess-display-errors', '.htaccess forces display_errors on', 'SKILL.md guardrail 3');
  }
}

// -------------------------------------------- 7. recently modified files

const now = Date.now();
const contentDir = join(root, 'wp-content');
const files = existsSync(contentDir) ? walk(contentDir, { maxDepth: 5 }) : [];
const recent = files
  .filter((f) => f.path.endsWith('.php') && now - f.mtime < 14 * 24 * 3600 * 1000)
  .sort((a, b) => b.mtime - a.mtime)
  .slice(0, 12)
  .map((f) => `${relative(root, f.path)} (${new Date(f.mtime).toISOString().slice(0, 10)})`);
info.recentlyModifiedPhp = recent;
if (recent.length) {
  add('warn', 'recent-changes', `${recent.length} PHP files modified in the last 14 days — check these first: ${recent.slice(0, 4).join(', ')}`, 'SKILL.md §0');
}

// --------------------------------------------- 8. encoding hazards (BOM)

let bomFiles = [];
let arabicFiles = 0;
for (const f of files.filter((x) => x.path.endsWith('.php')).slice(0, 3000)) {
  const head = readBytes(f.path, 3);
  if (head.length === 3 && head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) {
    if (bomFiles.length < 8) bomFiles.push(relative(root, f.path));
  }
  if (f.size < 800_000) {
    const c = read(f.path);
    if (/[يك]/.test(c) && /[\u0600-\u06FF]/.test(c)) arabicFiles += 1;
  }
}
info.bomFiles = bomFiles;
info.filesWithArabicChars = arabicFiles;
if (bomFiles.length) {
  add('error', 'bom-files', `${bomFiles.length} PHP files start with a BOM: ${bomFiles.slice(0, 4).join(', ')}`, 'references/encoding-and-mojibake.md §5');
}
if (arabicFiles > 0) {
  add('warn', 'arabic-chars', `${arabicFiles} PHP files mix Arabic ي/ك into Persian strings`, 'wp-persian-seo/references/permalinks-and-slugs.md §3');
}

// ------------------------------------------------------ 9. permissions

const checkMode = (rel, maxOctal) => {
  const p = join(root, rel);
  if (!existsSync(p)) return;
  let st;
  try { st = statSync(p); } catch { return; }
  const octal = (st.mode & 0o777).toString(8);
  if ((st.mode & 0o777) > maxOctal) {
    add('warn', 'permissions', `${rel} is ${octal} (recommended ${maxOctal.toString(8)} or stricter)`, '');
  }
};
checkMode('wp-config.php', 0o640);
checkMode('.htaccess', 0o644);

// --------------------------------------------- 10. theme / plugin counts

const themesDir = join(root, 'wp-content/themes');
const pluginsDir = join(root, 'wp-content/plugins');
info.themeCount = existsSync(themesDir) ? readdirSync(themesDir).filter((d) => { try { return statSync(join(themesDir, d)).isDirectory(); } catch { return false; } }).length : 0;
info.pluginCount = existsSync(pluginsDir) ? readdirSync(pluginsDir).filter((d) => { try { return statSync(join(pluginsDir, d)).isDirectory(); } catch { return false; } }).length : 0;
if (info.pluginCount > 30) {
  add('warn', 'plugin-count', `${info.pluginCount} plugin directories — use binary search, not one-by-one, for conflict isolation`, 'references/conflict-isolation.md §3');
}

// --------------------------------------------------------- report out

const errors = findings.filter((f) => f.level === 'error');
const warnings = findings.filter((f) => f.level === 'warn');

if (asJson) {
  console.log(JSON.stringify({ root, info, findings, errors: errors.length, warnings: warnings.length }, null, 2));
} else {
  console.log(`\nWordPress debug triage — root: ${root}\n`);
  console.log(`  WordPress: ${info.wpVersion || 'unknown'}   themes: ${info.themeCount}   plugins: ${info.pluginCount}`);
  if (info.constants) {
    const c = info.constants;
    console.log(`  debug:     WP_DEBUG=${c.WP_DEBUG ?? '—'}  LOG=${c.WP_DEBUG_LOG ?? '—'}  DISPLAY=${c.WP_DEBUG_DISPLAY ?? '—'}`);
    console.log(`  db:        charset=${c.DB_CHARSET ?? '—'}  collate=${c.DB_COLLATE === '' ? '(empty)' : c.DB_COLLATE ?? '—'}`);
  }
  console.log(`  mu-plugins: ${info.muPlugins.length ? info.muPlugins.join(', ') : '—'}`);
  console.log(`  drop-ins:   ${info.dropIns.length ? info.dropIns.join(', ') : '—'}`);
  for (const l of info.logs) {
    console.log(`  log ${l.path}: ${l.sizeKB} KB, ${l.lines} lines, ${l.fatals} fatal, ${l.deprecations} deprecated, ${l.curlErrors} curl`);
    for (const f of l.lastFatals) console.log(`       ! ${f}`);
  }
  console.log('');
  if (findings.length === 0) {
    console.log('  ✓ no findings\n');
  } else {
    for (const f of findings) {
      console.log(`  ${f.level === 'error' ? 'ERROR' : 'warn '}  [${f.rule}] ${f.message}`);
      if (f.hint) console.log(`         → ${f.hint}`);
    }
    console.log(`\n  ${errors.length} error(s) · ${warnings.length} warning(s)\n`);
  }
}

process.exit(errors.length > 0 ? 1 : 0);
