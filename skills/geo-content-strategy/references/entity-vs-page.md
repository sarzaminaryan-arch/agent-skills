# Entity versus page — choosing the content unit

## §1 Administrative units are not demand units

The most expensive mistake in place content is letting the government's map decide
the site map. Counties, districts, municipalities, and prefectures exist for
taxation and administration. Almost nobody searches for them with intent to act.

| Unit | Who searches it | Intent |
|---|---|---|
| County / district | students, form-fillers, postal lookups | informational, zero commercial value, Wikipedia already wins |
| Named attraction | people deciding whether to go | high — this is the query that converts |
| "What to do in X" | people who already chose the city | high |
| "X in one day / two days" | people planning | very high, long dwell time |
| "Best time to visit X" | people picking dates | high, seasonal repeat traffic |
| "Distance from X to Y" | people mid-plan | high, trivially answerable, almost always underserved |
| Local dish / souvenir | people already there, or buying | transactional |

A corpus of 450 county pages and zero attraction pages has covered the map and
missed the market. The administrative page is not worthless — but its job is
**distribution**, not ranking.

## §2 Hub and leaf

Give every page one of two jobs and never both.

**Hub** (region, district, category):
- 400–2,500 words depending on level
- A data table, a map, and the list of children
- Job: collect authority from the outside, pass it to leaves, help a user
  disambiguate and choose
- Should *not* try to rank for a high-intent query

**Leaf** (attraction, dish, souvenir, route, decision page):
- 600–1,600 words
- The structured fact table is the centre of the page, not an appendix
- Job: rank for one specific query and satisfy it completely
- Links up to its hub and sideways to 3–6 genuinely related leaves

The common failure is a 7,000-word hub trying to be every leaf at once. It ranks
for nothing, because it is optimised for nothing, and it cannibalises the leaves
you will eventually write.

**Ratio to aim for while producing:** for every 1 administrative page, 5 decision
pages. If you are producing in the other direction, stop.

## §3 Heading structure

### One `<h1>` per page, and know where it comes from

The classic bug in imported content: the theme prints `<h1>` from the post title
*and* the imported body starts with its own `<h1>`. Two H1s with different text on
every page in the corpus.

Detect: `geo_content_audit.mjs` → `h1-in-content`.

Fix, in order of preference:

1. Strip the H1 from the body at import time; let the template own it.
2. If the body H1 carries the richer, keyword-bearing phrasing and the template H1
   is the bare entity name, keep the template H1 and demote the body one to `<h2>`.
   The phrase still counts as a heading, and the title tag carries it anyway.
3. Never "fix" it by removing the template H1 — archives, cards, and breadcrumbs
   depend on the title.

### A fixed heading contract, actually enforced

Declaring "these 13 H2s, in this order" and then producing 82 articles with 82
different heading sets is worse than having no contract: you lose the uniform
rendering *and* you lose the ability to build schema, tables of contents, or
summary extraction from structure.

Either enforce it with a script in CI, or drop it and write a shorter contract you
will actually keep. A workable minimum for a leaf page:

```
H1   <entity name> — <the differentiator in five words>
H2   The fact table          (required, first)
H2   Getting there           (required)
H2   What you actually see   (required)
H2   When to go              (required)
H2   Nearby                  (required, generated from relations)
H2   FAQ                     (optional, only real questions)
```

Five required H2s is enforceable. Thirteen is not.

### Boilerplate belongs to the template

A closing call-to-action repeated verbatim in 109 articles, sitting inside
`<article>`, is counted as part of each page's unique text. Move it to the theme
(or, at render time, into an `<aside role="complementary">` after the article body).
Identical site furniture is fine; identical *article text* is not.

## §4 Slug and URL design

- Flat, entity-typed paths: `/attraction/{slug}/`, `/city/{slug}/`. Deep nesting
  (`/province/x/city/y/attraction/z/`) buys nothing and makes every re-parenting a
  redirect exercise.
- Slugs are ASCII, lowercase, hyphenated. No zero-width non-joiner, no Arabic
  characters in a Persian corpus, no transliteration drift between batches.
- Slugs are **append-only**. Once published and indexed, a slug is an asset; change
  it only with a 301 map.
- Disambiguate in the slug, not the title: `isfahan-city` versus `isfahan`
  (province) is correct; two pages both called `isfahan` is not.

## §5 Schema follows the unit

Match the schema type to what the page actually is, and only emit what is visible:

| Page | Type |
|---|---|
| Region hub | `AdministrativeArea` + `TouristDestination`, with `containsPlace` |
| City hub | `City` + `TouristDestination` |
| Attraction leaf | `TouristAttraction` with `geo`, `address`, `openingHours` when real |
| Route | `TouristTrip` with an `itinerary` `ItemList` |
| Dish | `Recipe` only if there is an actual recipe; otherwise `Thing`/`Product` |
| FAQ | `FAQPage` only when the questions are visible on the page |

If an SEO plugin is active, let it own `Organization`, `WebSite`, `WebPage`, and
`BreadcrumbList`, and emit only the entity node and `FAQPage` yourself, reusing the
plugin's `@id` conventions so the references resolve. Two competing `Organization`
nodes on one page is a common and avoidable mess.
