---
name: geo-content-strategy
description: "Use when planning, auditing, or rescuing content that covers many places at scale — city/province/region guides, directory sites, travel encyclopedias, or any programmatic SEO set where pages differ mainly by a place name. Covers information gain versus derivative content, the outbound-link economy (citation footnotes, nofollow, Wikipedia dependency), choosing the content unit (administrative area versus user decision), publish gates that ship instead of deadlock, and entity-graph internal linking. Includes an auditor that measures external/internal link ratio, source concentration, boilerplate share, duplicate H1s and dead internal links across a whole corpus. Route prose quality to content-humanizer; route Persian on-page work to wp-persian-seo."
compatibility: "Content-agnostic. Auditor is dependency-free Node 18+ ESM and reads WordPress importer JSON, Markdown, or HTML. WordPress examples target 6.5+ / PHP 7.4+."
---

# راهبرد محتوای مکان‌محور

Scaled place content — «هر شهر یک صفحه» — is the most common way a serious content
project burns a year and gets nothing. This skill is about the four decisions that
determine whether that corpus ranks or rots, and how to measure each one.

## Inputs required

- The corpus: a directory of Markdown, HTML, or WordPress importer JSON.
- Live site URL, if published, plus whether Search Console data exists.
- Which content unit is currently used (administrative area? attraction? decision?).
- Source list: where facts come from today, and in what proportion.
- The publish gate: what conditions currently block a page from going live.
- Competitor set for the top 10 target queries.

## Guardrails

1. **Never ship a page that cannot name three checkable facts absent from the
   obvious incumbent** (usually Wikipedia or the market-leading portal). If you
   cannot name them, the page should not exist. See `references/information-gain.md`.

2. **Zero `dofollow` external links in article bodies.** Inline citations belong in
   a numbered footnote list with `rel="nofollow ugc noopener noreferrer"`. A page
   that links out 50 times and in 12 times is voting against itself.
   See `references/link-economy.md`.

3. **No single source may exceed ~35% of a page's citations.** Above that the page
   is a derivative work and both ranking systems and quality raters treat it as one.

4. **Never let a publish gate depend on content that does not exist yet.** A rule
   like "province needs 20 internal links" cannot be satisfied before the child
   pages exist, so it silently freezes the whole project.
   See `references/publish-gate-that-ships.md`.

5. **Measure before scaling.** No second batch until the first batch has 28 days of
   Search Console data and that data has been read. Volume without feedback is
   guessing at scale.

6. **Do not claim ranking outcomes.** Recommend mechanisms, thresholds, and tests.

7. **Do not delete the existing corpus.** Re-role it (hub pages), prune it, or
   `noindex` it — but architecture, images, and research are sunk assets worth keeping.

## Procedure

### 0) Measure the corpus

```bash
node skills/geo-content-strategy/scripts/geo_content_audit.mjs \
     --dir <corpus-dir> --site example.com [--json] [--top 15]
```

Reports, across the whole corpus:

| Check | Fires when |
|---|---|
| `link-economy` | external/internal link ratio > 1:1 |
| `outbound-flood` | any article with more than 5 body-level external links |
| `no-nofollow` | external links exist but none carry `rel=nofollow` |
| `single-source` | one domain supplies > 40% of all citations |
| `cite-density` | more than 8 citations per 100 words |
| `h1-in-content` | `<h1>` inside the body (usually a second H1 next to the theme's) |
| `dead-internal` | internal links to slugs absent from the corpus |
| `thin` / `low-internal` / `boilerplate` / `repetitive` | below floor thresholds |

Exit code 1 on any ERROR. Thresholds sit in the `T` object at the top of the script.

### 1) Diagnose the content unit

Before fixing anything, answer: **is the unit of content a unit of demand?**

Read `references/entity-vs-page.md`. Administrative units (county, district,
municipality) almost never are. Decision units — "what to do in X", "X in one day",
"best time to visit X", a named attraction — almost always are.

If the unit is wrong, no amount of link hygiene rescues the corpus. Change the unit
first, then apply everything else to the new pages and re-role the old ones as hubs.

### 2) Fix the link economy

For an existing corpus you usually cannot re-edit every page. Convert at render
time instead: inline external anchors become numbered footnote anchors pointing to
an in-page reference list, and only the reference list links out, `nofollow`.

A working WordPress implementation is in
`audits/sarzaminaryan/mu-plugins/sa-content-guard.php` (adaptable — it is a single
mu-plugin with independent modules). Read `references/citation-policy.md` for the
rules the transform must satisfy.

### 3) Unblock the publish gate

Split gate conditions into **blocking** (page is genuinely incomplete: featured
image, title/meta, parent relation, primary taxonomy) and **advisory** (FAQ count,
internal link count, word count, coordinates). Advisory conditions warn; they never
force `draft`. See `references/publish-gate-that-ships.md`.

### 4) Build the differentiator

Pick the one data dimension the incumbents do not have and make it structured,
comparable, and filterable. For travel: drive time, road surface, accessibility,
opening months as integers, facilities. For local services: price bands, hours,
languages spoken. Read `references/information-gain.md` §2 for how to choose it.

Collect it in a way that does not scale cheaply — phone calls, site visits,
measurements. That is precisely why it is defensible.

### 5) Wire the entity graph

Parent ↔ child ↔ sibling links, generated from relations rather than written by
hand, with a hard rule that no link points at an unpublished slug.
See `references/link-economy.md` §3.

### 6) Measure, prune, repeat

Day 28: read Search Console. Day 60: pages with zero impressions get merged,
shortened to hub role, or `noindex`ed. Day 90: scale only what produced clicks.

## Output contract

When auditing a corpus, report in this order:

1. **Numbers first** — article count, word count, external/internal ratio, source
   concentration, worst five pages. Never lead with opinion.
2. **The one structural problem** — usually the content unit or the link economy.
3. **What can be auto-fixed at render time** versus what needs re-authoring.
4. **The replacement rule** — short, testable, each line checkable by a script.
5. **A dated plan** with numeric success criteria, and an explicit "do not do" list.

## Reference files

| File | Read when |
|---|---|
| `references/information-gain.md` | Deciding whether a page should exist at all; choosing the differentiator |
| `references/entity-vs-page.md` | Choosing the content unit; hub versus leaf; heading structure |
| `references/link-economy.md` | External/internal ratio, nofollow policy, entity graph, dead links |
| `references/citation-policy.md` | Footnote transform rules, source diversity, per-page citation caps |
| `references/publish-gate-that-ships.md` | Gate design, blocking versus advisory, deadlock patterns |
| `references/measurement.md` | Baseline, demand discovery, day-28/60/90 reviews, pruning rules |

## Related skills

- `content-humanizer` — prose quality once the strategy is right.
- `featured-image-art-direction` — images for place pages without the stock clichés.
- `wp-persian-seo` — Persian on-page, slugs, schema, hreflang.
- `wp-persian-homepage` — hub/front-page composition for this kind of site.
- `wordpress-router` — routing when the task is broader than content strategy.
