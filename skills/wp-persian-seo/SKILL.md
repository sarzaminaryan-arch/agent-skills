---
name: wp-persian-seo
description: "Use when optimising a Persian/RTL WordPress site for search: Persian permalinks and slugs, hreflang and lang/dir setup, title/meta/OG for Persian, schema.org (Article/FAQ/Breadcrumb/LocalBusiness), Persian keyword research and search intent, internal linking and topic clusters, indexing problems, Jalali dates, and Persian-specific gotchas (ZWNJ in URLs, Arabic vs Persian characters, Yoast/Rank Math config). Route copywriting to content-humanizer; route speed work to wp-persian-speed."
compatibility: "Targets WordPress 6.5+ (PHP 7.4+). Filesystem agent with bash. Some checks require WP-CLI. Schema examples use JSON-LD."
---

# سئوی وردپرس فارسی

## Inputs required

- Site URL, WordPress version, active theme, and SEO plugin (Yoast / Rank Math / SEOPress / none).
- Locale setup: single-language `fa_IR`, or multilingual (Polylang / WPML / TranslatePress) and its URL structure.
- Target audience geography (Iran, Afghanistan, diaspora) — affects hreflang and hosting/CDN choices.
- Current permalink structure and whether URLs may change (redirect budget).
- Access to Google Search Console and, if available, Bing Webmaster Tools.
- Whether the site uses Jalali dates and which plugin provides them.
- Existing content inventory: number of posts, known duplicate/thin pages.

## Guardrails

1. **Never change permalink structure on a live indexed site without a 301 map.** Persian slugs that already rank are assets. Read `references/permalinks-and-slugs.md` §4 before touching them.

2. **Never put ZWNJ (U+200C) in a slug.** It survives in the database, breaks in some browsers and CDNs, and produces unstable percent-encoding.

3. **Never mix Arabic `ي`/`ك` into Persian content.** They create two different index entries for the same word. Run the audit script.

4. **Do not claim ranking guarantees.** Recommend changes with expected mechanism, not promised positions.

5. **No cloaking, no doorway pages, no auto-generated mass content**, and no keyword stuffing in alt text or footers — common in Persian SEO plugins/themes and actively penalised.

6. **`lang` and `dir` must be correct at the `<html>` level.** Everything else in RTL SEO depends on it.

7. **Schema must reflect what is actually on the page.** FAQ schema without visible FAQs is a violation.

## Procedure

### 0) Triage

```bash
node skills/wp-project-triage/scripts/detect_wp_project.mjs
node skills/wp-persian-seo/scripts/persian_seo_audit.mjs --root . --url https://example.ir
```

The audit script checks: locale setup, `lang`/`dir` output, permalink structure, Arabic character contamination, ZWNJ in slugs, robots.txt, sitemap presence, duplicate title patterns, and missing meta description templates. It writes a JSON report.

**Done when:** the report exists and the SEO plugin, locale, and permalink structure are confirmed.

### 1) Fix the technical foundation

Order matters — each item unblocks the next.

1. **Locale and direction** — `WPLANG`/site language `fa_IR`, `<html lang="fa-IR" dir="rtl">`, RTL stylesheet loaded. Read `references/rtl-technical-seo.md` §1.
2. **Permalinks and slugs** — read `references/permalinks-and-slugs.md`. Decide Persian slugs vs. transliterated Latin slugs, then apply consistently.
3. **Indexing controls** — `robots.txt`, XML sitemap, canonical tags, `noindex` on tag/author/date archives if thin.
4. **Duplicate and thin pages** — attachment pages, paginated comment URLs, search result pages.
5. **hreflang** if multilingual — read `references/hreflang-and-multilingual.md`.

**Done when:** the audit script reports no `error`-level technical findings.

### 2) Keyword and intent work in Persian

Persian search behaviour differs from English in ways that break naive keyword workflows. Read `references/persian-keywords.md` for:

- Spelling variants (`ی` vs `ي`, spaced vs ZWNJ-joined forms, `ها` attached vs detached) and how to target all of them without stuffing.
- Loanword vs. Persian-equivalent choice (`کش` vs `حافظه پنهان`, `پلاگین` vs `افزونه`) — pick by search volume, not purity.
- Latin/Persian mixed queries (`آموزش wordpress`) which are extremely common.
- Question-shaped queries and the `چگونه`/`چطور`/`آموزش` prefixes.
- Tools that actually have Persian data and their limits.

**Done when:** a primary keyword, 3–5 secondary keywords, and the search intent type are recorded per target page.

### 3) On-page optimisation

Read `references/onpage-persian.md`. Key gates:

| Element | Persian rule |
|---|---|
| Title | ≤ 60 characters — Persian glyphs are narrower than Latin, so count pixels not just characters; keyword near the start (RTL start = right) |
| Meta description | 140–160 characters, must contain a reason to click, not a summary |
| H1 | exactly one, matches search intent, not identical to the title tag |
| Slug | 3–5 words, Latin or Persian per §1 decision, no stop words |
| First 100 words | contain the primary keyword naturally — see `content-humanizer` for how to do this without sounding robotic |
| Images | descriptive Persian alt, Latin filename |
| Internal links | ≥ 3 contextual links with meaningful Persian anchor text |

**Done when:** every gate in `references/onpage-persian.md` is ticked for the target page.

### 4) Structured data

Read `references/schema-persian.md` for copy-paste JSON-LD with Persian specifics: `inLanguage: "fa-IR"`, Gregorian ISO dates in schema even when Jalali is displayed, Article/BlogPosting, BreadcrumbList, FAQPage, HowTo, LocalBusiness with Iranian address fields, and Organization.

Register schema through the SEO plugin's API when one is active, rather than printing duplicate JSON-LD blocks.

**Done when:** Rich Results Test passes with no errors and no duplicate schema blocks in the page source.

### 5) Internal linking and topic clusters

Read `references/internal-linking.md`. Build pillar + cluster structure, fix orphan pages, use descriptive Persian anchors (never «اینجا کلیک کنید»), and cap outbound internal links per page.

**Done when:** every target page has ≥ 3 inbound internal links and no orphan pages remain in the cluster.

### 6) Verify and monitor

```bash
node skills/wp-persian-seo/scripts/persian_seo_audit.mjs --root . --url https://example.ir --json > seo-report.json
```

Then manually:
- URL Inspection in Search Console for a sample of 5 URLs.
- Rich Results Test for one page per schema type.
- Mobile preview — most Persian search traffic is mobile.
- Confirm the Persian title renders without truncation mid-word in SERP preview.

**Done when:** report is clean, sample URLs are indexable, and schema validates.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| URL shows `%D8%A2%D9%85...` everywhere | Persian slug + client that does not decode | `references/permalinks-and-slugs.md` §2 — decide policy, apply consistently |
| Same word indexed twice | Arabic `ي`/`ك` mixed in | Run audit; bulk-fix with the WP-CLI snippet in §3 of `permalinks-and-slugs.md` |
| Pages not indexed | `noindex` from a caching/SEO plugin, or robots.txt blocking | `references/indexing-troubleshooting.md` |
| Title cut off in SERP | Counted characters, not width | `references/onpage-persian.md` §1 |
| Schema errors on date | Jalali date pushed into schema | `references/schema-persian.md` §5 — schema takes Gregorian ISO 8601 |
| hreflang ignored | Wrong codes (`fa-FA`) or missing self-reference | `references/hreflang-and-multilingual.md` |
| Search Console shows fa pages under wrong country | Hosting/CDN geo signals | Fine to ignore; hreflang + content language dominate |

## Verification

1. `persian_seo_audit.mjs` exits 0.
2. `curl -sI https://example.ir/<sample-post>` returns 200 with no `X-Robots-Tag: noindex`.
3. Page source contains exactly one canonical, one H1, one JSON-LD block per type.
4. `<html lang="fa-IR" dir="rtl">` present.
5. Rich Results Test: 0 errors.
6. Sample 5 slugs: no ZWNJ, no Arabic characters, no stop words.
