---
name: content-humanizer
description: "Use when writing, rewriting, or reviewing long-form articles, blog posts, landing copy, or documentation that must read as clean, human-written prose rather than generic AI output. Covers Persian (fa-IR) and English. Handles structure, voice, rhythm, AI-tell removal, sourcing, and editorial QA. Route WordPress publishing/SEO mechanics to wp-persian-seo; route block markup to wp-patterns."
compatibility: "Language-agnostic authoring skill. No WordPress runtime required. Optional: bash + node for the lint script."
---

# Content Humanizer — مقاله‌نویسی تمیز و انسانی

## Inputs required

- **Target language and locale** — `fa-IR` (فارسی) or `en`. Persian output defaults to informal-formal hybrid ("نوشتاری معیار") unless the user says otherwise.
- **Article type** — how-to, listicle, comparison, opinion/editorial, news, pillar page, product page, case study.
- **Primary reader** — expertise level and what they are trying to accomplish.
- **Desired length** — in words; if unspecified, propose one and confirm.
- **Voice constraints** — brand tone, first person vs. third person, formality, humour allowance.
- **Source material** — links, notes, transcripts, prior articles, or "no sources, write from general knowledge" (must be stated explicitly).
- **Placement** — standalone, WordPress post, or part of a topic cluster.

If the user has not supplied reader, length, and sources, ask **once**, with defaults proposed, and proceed on the defaults if they do not answer.

## Guardrails

1. **No invented facts, numbers, names, dates, or quotes.** If a claim needs a source and none exists, either cut the claim or mark it `[نیازمند منبع]` / `[needs source]`. Never fabricate a statistic to make a paragraph feel authoritative.

2. **No AI-tell vocabulary.** Read `references/ai-tells.md` before drafting and run the lint script before delivering. The banned-phrase list is normative, not advisory.

3. **Varied sentence rhythm is mandatory.** Uniform sentence length is the single strongest machine signal. Target a mix: some 4-word sentences, some 30-word sentences, in the same paragraph.

4. **No em-dash carpet-bombing, no triadic lists everywhere.** Both are hallmarks. Read `references/ai-tells.md` §3.

5. **Persian must be typographically correct.** ZWNJ (نیم‌فاصله, U+200C), Persian digits where appropriate, `ی`/`ک` (U+06CC/U+06A9) never Arabic `ي`/`ك`, and correct Persian quotation marks «». Read `references/persian-style.md`.

6. **Structure serves the reader, not the word count.** Never pad. If the honest answer is 600 words, deliver 600 words and say so.

7. **Every H2 must earn its place.** No "Introduction", "Conclusion", "Final Thoughts" as literal headings unless the user asks.

8. **Disclose AI assistance** when the deliverable is published content and the user's policy requires it (see `docs/ai-authorship.md` in this repo for the project's own convention).

## Procedure

### 0) Scope the piece

1. Confirm language, type, reader, length, sources.
2. Write a one-sentence **promise**: "After reading this, the reader will be able to ___."
3. Write the **single claim** the article defends. If you cannot state it in one sentence, the scope is wrong.

**Done when:** promise + claim are written down before any prose exists.

### 1) Build the outline against the promise

1. Draft H2/H3 skeleton. Each H2 maps to one step toward the promise.
2. Delete any heading that does not move the reader forward.
3. Decide per section: prose, list, table, code block, or callout. Do not default everything to bullet lists — this is a top AI-tell.
4. Allocate a word budget per section so the piece does not balloon.

Read `references/structure-patterns.md` for per-article-type skeletons (how-to, comparison, listicle, pillar).

**Done when:** outline exists, each section has a format and a word budget.

### 2) Write the opening

The first 60 words decide whether the piece reads human.

- **Never** open with "In today's fast-paced digital world", "در دنیای امروز", "با پیشرفت روزافزون فناوری".
- Open with one of: a concrete scenario, a specific number with a source, a counter-intuitive claim, a direct question the reader already has, or a blunt statement of the problem.
- State the promise by sentence three at the latest.

Read `references/openings.md` for worked Persian and English examples of each opening type.

**Done when:** the opening contains a concrete noun in the first sentence and no throat-clearing.

### 3) Draft the body

Apply while writing, not after:

- **Rhythm** — alternate long and short. Read a paragraph aloud mentally; if every sentence lands the same way, break one.
- **Concreteness** — replace abstractions with examples, numbers, names, screenshots-in-words.
- **Transitions** — use meaning-bearing transitions ("و همین باعث می‌شود…"), not connective filler ("علاوه بر این", "Moreover", "Furthermore" stacked at every paragraph head).
- **Voice** — active by default. Persian: prefer فعل معلوم and avoid the heavy "می‌گردد / می‌باشد" register.
- **Opinions** — a human writer takes positions. Say "این روش را توصیه نمی‌کنم چون…" where honest.
- **Admit limits** — "این روش روی سایت‌های چندزبانه جواب نمی‌دهد" builds more trust than fake completeness.

Read `references/persian-style.md` when the target is Persian. Read `references/rhythm-and-voice.md` for the rewrite drills.

**Done when:** every section delivers on its outline entry within its word budget.

### 4) De-AI pass (mandatory)

Run the linter:

```bash
node skills/content-humanizer/scripts/humanize_lint.mjs <path-to-draft.md> --lang fa
```

The script reports: banned phrases, sentence-length variance, em-dash density, list-to-prose ratio, triadic-list count, paragraph-opening repetition, and (for `--lang fa`) missing ZWNJ and Arabic-character contamination.

Fix every **error**. Justify or fix every **warning**. Read `references/ai-tells.md` for the rewrite for each rule.

**Done when:** the script exits 0, or remaining warnings are individually justified in your response.

### 5) Editorial QA

Walk `references/editorial-checklist.md`. Minimum gates:

- Every factual claim is either sourced, self-evident, or marked `[نیازمند منبع]`.
- No heading duplicates another heading's intent.
- No paragraph over ~5 lines on mobile width.
- Internal links proposed where a topic cluster exists.
- Alt text drafted for every image slot (hand off to `featured-image-art-direction` for the visuals themselves).
- Reading level matches the stated reader.

**Done when:** every checklist line is ticked or explicitly waived.

### 6) Deliver

Deliver as Markdown with YAML front matter:

```yaml
---
title: ""
slug: ""
excerpt: ""      # 140–160 chars, Persian counts characters not words
lang: fa-IR
reading_time: ""
image_brief: ""  # one-line brief, handed to featured-image-art-direction
needs_source: [] # list of claims still unsourced
---
```

If the destination is WordPress, hand off: `wp-persian-seo` for metadata/schema, `wp-patterns` for block markup, `featured-image-art-direction` for the hero image.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Reads "correct but lifeless" | Uniform sentence length, zero opinions | §3 rhythm drills; add one first-person judgement per section |
| Every section is a bullet list | Defaulted format | §1 — assign a format per section before writing |
| Persian looks "translated" | Calque syntax, English word order, می‌باشد register | `references/persian-style.md` §2 |
| Confident but wrong numbers | Filled a gap instead of flagging it | Guardrail 1; use `[نیازمند منبع]` |
| Editor says "too many dashes" | Em-dash used as universal connector | `references/ai-tells.md` §3 |
| Broken نیم‌فاصله on the site | ZWNJ stripped by editor/paste | `references/persian-style.md` §4 |

## Verification

1. `node skills/content-humanizer/scripts/humanize_lint.mjs draft.md --lang fa` exits 0.
2. Read the first and last paragraph aloud — neither is generic.
3. Remove all headings and check the prose still flows.
4. Confirm no claim in the piece would embarrass the author if fact-checked.
