---
name: wp-persian-speed
description: "Use when speeding up a Persian/RTL WordPress site: Persian web font strategy (Vazirmatn/IRANSans subsetting, FOIT/CLS), Core Web Vitals on Iranian mobile networks, caching layers and why they miss, bloated multipurpose themes and page builders, image/LCP work, database and autoload cleanup, hosting/CDN choices for Iranian audiences, and measurement that is not guesswork. Route generic profiling internals to wp-performance; route content to content-humanizer."
compatibility: "Targets WordPress 6.5+ (PHP 8.0+). Filesystem agent with bash + node. Several workflows require WP-CLI; measurement steps need curl."
---

# سرعت وردپرس فارسی

## Inputs required

- Site URL and whether a staging copy exists (never tune caching directly on a busy production site without a rollback).
- Hosting type: Iranian shared host, Iranian VPS, foreign VPS, or managed WordPress. Web server: Apache / LiteSpeed / nginx.
- Active theme (and whether it is a multipurpose theme like Astra/Betheme/Avada or an Iranian commercial theme) and page builder (Elementor / WPBakery / block editor).
- Active caching stack: plugin, object cache, CDN, server-level cache.
- Font setup: which Persian fonts, loaded from where, which weights.
- Primary audience location — this decides the CDN/hosting answer more than anything else.
- Current measurements, if any. If none exist, §1 produces them before any change.

## Guardrails

1. **Measure before you change anything.** A change without a before-number is a guess. §1 is not optional.

2. **One change at a time on a live site.** Bundled "optimisation" makes regressions untraceable.

3. **Never enable minify/combine/defer-all blindly.** On Persian sites with jQuery-dependent commercial themes this reliably breaks sliders, forms, and RTL layout. Read `references/caching-layers.md` §6.

4. **Back up the database before any cleanup.** `wp db export` before autoload/revision/transient surgery.

5. **Do not recommend a foreign CDN without asking about the audience.** For an Iran-only audience, a foreign CDN often makes TTFB worse, and some are unreachable. Read `references/hosting-and-cdn.md`.

6. **Never ship a full Persian font family.** Unsubsetted Persian webfonts are the single largest avoidable payload on Iranian sites. Read `references/persian-fonts.md`.

7. **Report numbers with the conditions attached** — device, network, cached/uncached, logged in/out. A number without conditions is noise.

## Procedure

### 0) Triage

```bash
node skills/wp-project-triage/scripts/detect_wp_project.mjs
node skills/wp-persian-speed/scripts/speed_audit.mjs --root . --url https://example.ir
```

The script inventories: theme weight, page-builder presence, font files and their sizes, caching/optimisation plugins (including conflicting pairs), image formats in uploads, and — with `--url` — TTFB samples, payload breakdown, compression, cache headers, and render-blocking resources.

**Done when:** the report exists and the hosting/caching/font stack is known.

### 1) Establish the baseline

Read `references/measurement.md`. Minimum baseline, all recorded:

| Metric | How |
|---|---|
| TTFB (uncached, logged out) | `curl -w` loop, 5 samples, median |
| TTFB (cached) | same, after warming |
| TTFB (logged in) | with auth cookie — usually the ugly number |
| Total transferred bytes | browser devtools or the audit script |
| LCP element and time | Lighthouse mobile / field data |
| CLS | Lighthouse mobile — Persian fonts are the usual cause |
| Server-side query count and time | Query Monitor or `SAVEQUERIES` |

**Done when:** every row has a number and the conditions are written next to it.

### 2) Fix in order of payoff

The order is deliberate — Persian sites almost always fail in this sequence.

1. **Fonts** — read `references/persian-fonts.md`. Subset, `woff2`, `font-display: swap`, preload one weight, self-host. Typical saving: 400–900 KB and most of the CLS.
2. **Images** — read `featured-image-art-direction/references/wordpress-sizing.md` for formats and budgets, then fix LCP hints (`fetchpriority`, no lazy on the hero).
3. **Theme and builder bloat** — read `references/theme-and-builder-bloat.md`. Dequeue what is not used; this is where multipurpose themes lose 1 MB.
4. **Caching** — read `references/caching-layers.md`. Page cache, object cache, browser cache, and where each one silently does nothing.
5. **Database and autoload** — read `references/database-and-autoload.md`. This is the usual cause of a slow logged-in TTFB.
6. **Hosting/CDN** — read `references/hosting-and-cdn.md`. If TTFB is still bad after 1–5, the problem is the host, and no plugin fixes that.

**Done when:** each applied change has a before/after number.

### 3) Verify Core Web Vitals

Read `references/core-web-vitals-fa.md` for the Persian-specific causes of each metric.

| Metric | Target | Usual Persian culprit |
|---|---|---|
| LCP | < 2.5 s | hero image unoptimised, or webfont blocking the heading |
| CLS | < 0.1 | Persian font swap without metric matching; sliders; ads |
| INP | < 200 ms | page-builder JS, jQuery plugins stacked |
| TTFB | < 0.8 s | host, autoload bloat, no page cache |

**Done when:** all four are in range on a mobile profile, or the remaining gap is attributed to a named cause.

### 4) Guard against regressions

- Record the final numbers in a file in the repo.
- Re-run `speed_audit.mjs` after any theme/plugin update.
- Set a payload budget (e.g. 900 KB total, 150 KB fonts) and treat overruns as bugs.

**Done when:** the baseline file exists and a budget is written down.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Score is green, users say it is slow | Measured cached + desktop only | `references/measurement.md` §2 — measure uncached mobile and logged-in |
| Text flashes then jumps | Persian webfont swap, metrics mismatch | `references/persian-fonts.md` §4 |
| Cache plugin installed, TTFB unchanged | Cache bypassed (cookie, logged in, query string) | `references/caching-layers.md` §3 |
| Site broke after enabling optimisation | Combine/defer broke jQuery order | `references/caching-layers.md` §6 — revert, enable one flag at a time |
| Admin is unusably slow | autoload bloat, cron on every request, heavy plugin | `references/database-and-autoload.md` |
| Fast abroad, slow in Iran | Foreign host/CDN, filtering, routing | `references/hosting-and-cdn.md` §1 |
| Fast in Iran, slow abroad | Iranian host without CDN | `references/hosting-and-cdn.md` §3 |
| LCP is a slider | The slider is the LCP element | Replace with a static hero image; sliders rarely earn their cost |

## Verification

1. `node skills/wp-persian-speed/scripts/speed_audit.mjs --root . --url <URL>` exits 0.
2. Median uncached TTFB from 5 samples is under target.
3. Total font payload ≤ 150 KB; total page weight within budget.
4. Lighthouse mobile: LCP, CLS, INP in range.
5. A logged-out and a logged-in request are both measured and reported.
6. Every claim of improvement has a before and an after number.
