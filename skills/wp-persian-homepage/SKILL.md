---
name: wp-persian-homepage
description: "Use when designing or building the front page of a Persian/RTL WordPress site: choosing the homepage strategy (static page, blog index, or front-page template), RTL section composition and visual hierarchy, Persian typography and spacing, hero/CTA copy in Persian, Query Loop and content sections, navigation and mobile layout, conversion structure, and homepage-specific SEO and speed. Route generic block markup rules to wp-patterns; route theme.json to wp-block-themes."
compatibility: "Targets WordPress 6.5+ (PHP 7.4+). Block themes and the Site Editor are the default path; classic-theme fallbacks are noted. Filesystem agent with bash + node."
---

# صفحه‌ی اول وردپرس فارسی

## Inputs required

- **Site purpose in one sentence** — what the visitor should do, not what the company does.
- **Primary audience and their state of mind** — first-time visitor, returning reader, ready-to-buy customer.
- **The single primary action** — one. If the answer is "read the blog, buy, and contact us", §0 forces a choice.
- **Site type** — blog/magazine, service business, shop, portfolio, SaaS/product, news.
- **Theme situation** — block theme, classic theme, page builder, or building from scratch.
- **Brand assets** — logo, palette (hex), fonts (licensed?), photography or illustration available.
- **Content that actually exists** — do not design sections for content the client cannot supply.
- **Constraints** — must-keep sections, legal requirements (نماد اعتماد / اینماد for shops), existing analytics.

If the user says "make me a nice homepage" with no answers, run §0 and propose defaults rather than inventing sections.

## Guardrails

1. **One primary action per homepage.** Everything else is secondary. A page with five equal CTAs converts on none of them.

2. **Design for RTL from the first decision**, not by mirroring an LTR layout at the end. Read `references/rtl-composition.md`.

3. **Never invent content.** Placeholder Persian text must be marked as placeholder, and testimonials, numbers, logos, and client names are never fabricated.

4. **No sliders as the hero** unless the user insists after being told the cost. It is almost always the LCP element, adds 300–700 KB, and visitors interact with slide one only.

5. **Block markup only** when working in a block theme — presets, no inline `<style>`, no custom CSS classes for things `theme.json` can express. Read `wp-patterns/SKILL.md` for the markup rules.

6. **Mobile is the primary layout.** Persian traffic is overwhelmingly mobile. Design the 360 px view first and treat desktop as the enhancement.

7. **Every string escaped and translatable**, ZWNJ intact, Persian digits in display text and Latin digits in code/versions.

8. **The homepage must meet the speed budget** — read `wp-persian-speed`. A beautiful homepage that takes 5 seconds is a broken homepage.

## Procedure

### 0) Decide the job of the page

Answer these in writing before any layout:

1. **Primary action** — one verb. «شروع کن», «مشاوره بگیر», «محصولات را ببین», «عضو شو».
2. **Five-second test** — what must a visitor understand in five seconds? Write the sentence; it becomes the hero headline.
3. **Objection** — the top reason a visitor leaves. A section must answer it.
4. **Proof** — what real evidence exists (numbers, clients, samples, reviews)? If none, the design must not pretend otherwise.
5. **Homepage strategy** — read `references/homepage-strategy.md` to choose between static page, latest posts, and a `front-page.html` template.

**Done when:** those five answers are written down.

### 1) Choose the section skeleton

Read `references/section-patterns.md` and pick the skeleton for the site type. Each entry gives the ordered sections, what each must contain, and what to cut.

Rules:
- 5–8 sections. More than 8 means the page is a sitemap.
- Every section has one job and one heading that states it.
- Section order follows the visitor's questions, not the org chart.

**Done when:** an ordered section list exists, each with a one-line purpose.

### 2) Write the Persian copy

Read `references/persian-copywriting.md`. Hero headline, subhead, CTA labels, section headings, and microcopy.

Hard rules:
- Hero headline ≤ 9 words, concrete, no «بهترین» / «حرفه‌ای‌ترین».
- CTA labels are specific verbs: «مشاوره رایگان بگیر» not «بیشتر بدانید».
- No «خوش آمدید» as a headline.
- Send long-form body copy through `content-humanizer` and its linter.

**Done when:** every text slot has real Persian copy, not lorem ipsum, and no banned phrase survives.

### 3) Build the layout

Read `references/rtl-composition.md` for the RTL-specific grid, reading order, alignment, and asymmetry rules, and `references/typography-and-spacing.md` for the Persian type scale, line height, and spacing tokens.

Block theme path:
```bash
node skills/wp-block-themes/scripts/detect_block_themes.mjs
```
Then build `templates/front-page.html` plus reusable patterns in `patterns/`. Follow `wp-patterns` for markup and registration.

Classic theme path: `front-page.php` with template parts; keep presentation in CSS with logical properties.

**Done when:** the page renders at 360 px, 768 px, and 1440 px with no horizontal scroll and correct RTL alignment.

### 4) Wire content sections

Read `references/content-sections.md` for Query Loop configuration (latest posts, category highlights, featured content), product grids, and the empty-state problem — what the section looks like on a brand-new site with three posts.

**Done when:** every dynamic section is tested with 0, 1, and many items.

### 5) Verify

```bash
node skills/wp-persian-homepage/scripts/homepage_check.mjs --root . --url https://example.ir
```

Checks: heading hierarchy, CTA count and wording, hero image hints, section count, RTL attributes, Persian typography hazards, image dimensions, and homepage-specific SEO fields.

Then read `references/homepage-checklist.md` and walk it manually.

**Done when:** the script exits 0 and the manual checklist is complete.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Page looks generic | Sections chosen from a template, not from §0 | Redo §0 and §1 |
| Visitor does not know what to do | Multiple equal CTAs | One primary action; demote the rest |
| Looks mirrored, not designed | LTR layout flipped at the end | `references/rtl-composition.md` |
| Text feels cramped | Latin line-height applied to Persian | `references/typography-and-spacing.md` §2 |
| Homepage is slow | Slider hero, unoptimised images, font payload | `wp-persian-speed` |
| Section is empty on a new site | No empty-state handling | `references/content-sections.md` §5 |
| Client keeps adding sections | No agreed primary action | Return to §0 with the client |
| Mobile menu unusable | Desktop-first navigation | `references/rtl-composition.md` §6 |

## Verification

1. `node skills/wp-persian-homepage/scripts/homepage_check.mjs --root . --url <URL>` exits 0.
2. Five-second test on someone unfamiliar: they can state what the site does and what to do next.
3. No horizontal scroll at 360 px.
4. LCP < 2.5 s, CLS < 0.1 on a mobile profile.
5. One `<h1>`, sensible heading order, one primary CTA.
6. All strings escaped, translatable, ZWNJ intact.
7. Every dynamic section renders correctly with zero items.
