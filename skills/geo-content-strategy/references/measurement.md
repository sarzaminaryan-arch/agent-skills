# Measurement — baseline, demand, review

## §1 Baseline before anything else

You cannot claim an improvement without a before. Record these on day 0 and keep
the file in the repo:

```
measure/baseline.csv
  date
  indexed_pages           (Search Console → Pages → Indexed)
  queries_with_impressions
  clicks_28d
  impressions_28d
  pages_with_clicks_28d
  avg_position_top20
```

Plus a one-off corpus snapshot:

```bash
node skills/geo-content-strategy/scripts/geo_content_audit.mjs \
     --dir <corpus> --site example.com --json > measure/corpus-day0.json
```

Two numbers, the same day. Everything later is measured against them.

If Search Console is not set up, that is the first task of the project — before
writing another word. A content project without Search Console is a content
project without a feedback loop.

## §2 Finding real demand

Rank sources of demand signal by how much they cost you to be wrong about.

**1. Your own Search Console (best).** Once 14 days of data exist: every query with
impressions and zero clicks is a page you should have written, or a title you
should rewrite. This is the only source that reflects *your* site's actual
opportunity.

**2. Autocomplete and People Also Ask.** For each hub entity, harvest the
completions of these patterns and record them verbatim:

```
<entity>
<entity> attractions
what to do in <entity>
<entity> in one day
best time to visit <entity>
distance from <entity> to
<entity> what to buy
near <entity>
is <entity> worth visiting
```

Do this in the target language, in the target country, and record the exact
phrasing users use — not your cleaned-up version of it.

**3. Competitor gap.** `site:competitor.com <entity>` shows what they built. The
interesting result is what they *did not* build, or built badly.

**4. Community.** Messaging groups, comment replies, local forums. The highest
information-gain page you will ever write is usually the answer to a question that
gets asked there weekly and is answered nowhere.

### The selection rule

A query enters the production queue only when you can complete this sentence in
one line:

> "We have ____, and the current top ten results do not."

If the completion is "better writing", strike the query. Better writing is not a
differentiator; it is table stakes.

Store the queue as `measure/demand.csv`:

```
query, monthly_estimate, current_top3, our_differentiator, page_type, status
```

## §3 The review cadence

**Day 7 — indexation only.**
Are the new URLs indexed? If not, check robots, canonicals, internal links from a
crawled hub, and the sitemap. Do not judge quality yet; nothing has been ranked.

**Day 28 — first signal.**
Impressions, not clicks. Impressions mean Google has an opinion about what the page
is for. Zero impressions on an indexed page after four weeks means either the
query has no volume or the page does not match it.

**Day 60 — the real review.** For every page:

| State | Action |
|---|---|
| impressions + clicks | keep; add depth, add internal links from siblings |
| impressions, no clicks | rewrite `<title>` and meta description; re-check day 88 |
| impressions but position > 30 | the page is not competitive — add the data layer or merge |
| indexed, zero impressions | shorten to hub role, merge into parent, or `noindex` |
| not indexed | technical problem or quality problem; diagnose, do not rewrite blindly |

**Day 90 — the scale decision.**
Scale only the page *type* that produced clicks. If attraction pages worked and
district pages did not, the next batch is 100 attractions and zero districts.
If nothing worked, the hypothesis was wrong: change the content type, not the
volume.

## §4 Success criteria worth committing to

Write these down before you start. Vague goals produce vague post-mortems.

| Day | Metric | Sensible target for a young domain |
|---|---|---|
| 7 | indexed pages | ≥ baseline + the batch size |
| 30 | queries with impressions | ≥ 300 |
| 60 | clicks / 28 days | ≥ 500 |
| 60 | pages with ≥ 1 click | ≥ 40 |
| 90 | clicks / 28 days | ≥ 2,000 |
| 90 | cited by at least one answer engine for a target query | ≥ 1 |

The last row matters more every quarter. Answer engines cite the page that *holds*
a fact — a structured table of drive times and opening months is far more
citeable than 2,000 words of prose that restates an encyclopedia.

## §5 What not to measure

- **Word count produced.** It measures effort, not value, and rewards the exact
  behaviour that caused the problem.
- **Pages published.** Same.
- **Third-party "SEO score" out of 100.** Optimising it optimises for the tool.
- **Rank for a single vanity keyword.** Noisy, personalised, and usually the
  hardest query in the set.
- **Anything before day 28.** New pages on a young domain fluctuate. Reading
  day-9 data produces panic-driven rewrites that destroy the experiment.

## §6 Keeping the audit honest

Run the corpus audit on every batch and commit the JSON:

```bash
node skills/geo-content-strategy/scripts/geo_content_audit.mjs \
     --dir <corpus> --site example.com --json > measure/corpus-$(date +%F).json
```

Then diff against the previous snapshot. The metrics that must only move one way:

```
totals.externalLinks       ↓ or flat
totals.topDomainShare      ↓ or flat
totals.articlesWithContentH1  → 0
findings[level=ERROR]      → empty
totals.internalLinks       ↑
```

Wire it into CI with a non-zero exit on ERROR, and the corpus cannot silently
regress to the state that needed rescuing in the first place.
