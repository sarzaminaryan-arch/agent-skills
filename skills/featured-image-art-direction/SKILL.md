---
name: featured-image-art-direction
description: "Use when creating featured images, hero images, thumbnails, OG/social cards, or in-article illustrations for articles and WordPress posts — including writing the generation prompt, choosing a visual concept over stock cliché, sizing/cropping for WordPress and social platforms, alt text, and file optimisation. Covers Persian/RTL text-in-image constraints. Route article copy to content-humanizer; route block markup to wp-patterns."
compatibility: "Tool-agnostic art-direction skill. Optional: bash + node for the prompt builder and an image generation tool. WordPress-specific sizing guidance targets WP 6.5+."
---

# Featured Image Art Direction — تصویر شاخص خلاقانه

## Inputs required

- **Article title, promise, and single claim** (from `content-humanizer` §0, if available).
- **Placement** — featured image, in-article illustration, OG/social card, category hero, or homepage banner.
- **Brand constraints** — palette (hex), logo usage, typeface, existing visual language, things to avoid.
- **Text in image?** — yes/no. If yes, exact string and language. Persian text in generated images is unreliable; read `references/text-in-image.md` before agreeing.
- **Aspect ratio and destination sizes** — or let the skill derive them from `references/wordpress-sizing.md`.
- **Realism budget** — photographic, illustrated, abstract/conceptual, diagrammatic, or 3D.
- **Sensitivity** — people depicted? real brands? medical/financial subject matter?

If the brief is only "make an image for this article", do **not** generate immediately. Run §1 and propose three distinct concepts first.

## Guardrails

1. **No stock cliché.** Handshakes, glowing brains, blue circuit boards, robots at laptops, arrows going up, hands holding floating icons, "digital transformation" hexagons. Read `references/anti-cliche.md` — the list there is normative.

2. **The image must carry the article's specific claim**, not its general topic. "Article about caching" → a cliché. "Article arguing cache is useless for logged-in users" → an image with a real idea in it.

3. **Never render Persian/Arabic text inside a generated image** unless the user accepts broken glyphs. Generation models mangle Persian letterforms and ZWNJ. Compose text as a real HTML/CSS or SVG overlay instead. Read `references/text-in-image.md`.

4. **No real logos, trademarks, celebrity likenesses, or copyrighted characters** in generated imagery.

5. **Alt text is part of the deliverable**, not an afterthought. Describes the image, not the keyword.

6. **Declare AI generation** in the caption or media metadata when the publication's policy requires it.

7. **Ship optimised files.** WebP/AVIF, correct dimensions, under the byte budget in `references/wordpress-sizing.md`. An 1.8 MB hero image undoes the work of `wp-persian-speed`.

## Procedure

### 0) Extract the visual claim

Write one sentence: **"This image should make the reader feel/understand ___."**

Not the topic. The claim. Examples:

| Article | ❌ topic-level | ✅ claim-level |
|---|---|---|
| کش برای کاربران لاگین بی‌فایده است | آیکون سرور و فلش | یک دیوار کش که یک در باز کنارش دارد و صف از همان در رد می‌شود |
| ۷۰٪ وزن صفحه تصاویر است | لوگوی وردپرس | ترازویی که یک کفه‌اش پر از عکس و کفه‌ی دیگر تقریباً خالی است |
| سایت فارسی روی موبایل کند است | گوشی با نمودار | صفحه‌ی نیمه‌بارگذاری‌شده‌ی فارسی با فونت جایگزین و پرش چیدمان |

**Done when:** one sentence stating the visual claim exists.

### 1) Generate three distinct concepts

Never propose three variations of one idea. Pull each concept from a different family in `references/concept-engine.md`:

1. **Literal-but-specific** — the real object/screen/scene, shot with intent.
2. **Metaphor** — one concrete visual metaphor for the claim (not a mixed metaphor).
3. **Conceptual/abstract** — composition, scale, negative space, or data-as-form.

Describe each in two sentences plus its risk. Let the user pick, or pick the one that best serves the claim and say why.

**Done when:** three concepts from three different families are on the table.

### 2) Write the prompt

Build the prompt from the six required slots in `references/prompt-anatomy.md`:

`SUBJECT + ACTION/STATE + COMPOSITION + LIGHT + STYLE/MEDIUM + TECHNICAL`

plus an explicit **negative** clause and an **aspect ratio**.

Use the builder for a consistent, complete prompt:

```bash
node skills/featured-image-art-direction/scripts/build_prompt.mjs \
  --subject "an old brass scale" \
  --action "one pan overflowing with stacked photographs, the other holding a single small text file" \
  --composition "centred, low camera angle, generous negative space above" \
  --light "single hard window light from the left, deep shadows" \
  --style "editorial photograph, muted palette, slight film grain" \
  --ratio 16:9 \
  --avoid "text, logos, hands, glowing effects"
```

The script prints the assembled prompt, flags cliché tokens against `references/anti-cliche.md`, and warns about text/logo requests.

**Done when:** the prompt has all six slots filled, no cliché tokens, an explicit ratio, and a negative clause.

### 3) Generate and judge

Generate, then judge against `references/visual-qa.md` before showing the user. Reject and regenerate when:

- The claim is not legible in the image.
- Any text appears (unless deliberately requested in a supported script).
- Anatomy, hands, or object logic is broken.
- It reads as generic stock.
- Contrast at thumbnail size is too low — check by mentally scaling to 150 px wide.

**Done when:** the image passes every gate in `references/visual-qa.md`.

### 4) Add text overlay (if required)

Persian and any critical text goes on **as a real layer, not into the model**. Read `references/text-in-image.md` for the HTML/CSS card approach, the safe-area rules, and the RTL font stack (Vazirmatn / IRANSans / Estedad).

**Done when:** text is crisp, has ≥ 4.5:1 contrast, and sits inside the safe area on every target crop.

### 5) Produce the size set and ship

Read `references/wordpress-sizing.md` and produce:

| Use | Size | Notes |
|---|---|---|
| Featured (16:9) | 1600×900 | source of truth |
| OG / Twitter card | 1200×630 | separate crop, text-safe centre |
| Thumbnail | 600×400 | check legibility |
| In-article | 1200×675 | |

Then:

- Convert to WebP (quality 80–85) and keep a JPEG fallback only if the theme needs it.
- Name the file descriptively and in Latin: `cache-logged-in-users-scale.webp` — never `image1.png`, never Persian filenames (they break on some hosts and in URLs).
- Write alt text: describes what is visible and why it matters, ≤ 125 characters, no keyword stuffing.
- Write a caption if the image needs context or an AI-generation disclosure.

**Done when:** all crops exist, each is under budget, alt text and filename are written.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Image looks like every other blog header | Generated from the topic, not the claim | §0 then §1 |
| Persian text in image is garbled | Text sent to the generation model | `references/text-in-image.md` — overlay instead |
| Unreadable as a thumbnail | Too much detail, low contrast | `references/visual-qa.md` §3 — one focal object |
| Hero image kills LCP | Unoptimised, wrong dimensions, no `fetchpriority` | §5 + `wp-persian-speed` |
| Social preview crops the subject | Reused the 16:9 crop for OG | Produce a separate 1200×630 crop |
| Client says "too weird" | Only abstract concepts offered | §1 — always include a literal-but-specific option |

## Verification

1. `node skills/featured-image-art-direction/scripts/build_prompt.mjs --check "<prompt>"` reports no cliché tokens.
2. Shrink the image to 150 px wide — the subject is still identifiable.
3. Show it to someone who has not read the article; ask what it is about. If they say the topic, good. If they say "business stuff", regenerate.
4. Alt text read aloud describes the image to someone who cannot see it.
5. File size within budget and format is WebP/AVIF.
