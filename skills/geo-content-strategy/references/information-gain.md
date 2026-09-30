# Information gain — should this page exist?

## §1 The test

A page earns its place in the index only if it contains information a reader cannot
get from the documents already ranking. Google filed a patent on exactly this idea
("Contextual Estimation of Link Information Gain", filed 2018, granted June 2024):
a score "indicative of additional information that is included in the document
beyond information contained in documents that were previously viewed by the user".

Whether or not that specific patent is live in the ranking stack is beside the
point. The same principle shows up in three independent places:

- **Spam policy.** Scaled content abuse (March 2024) is defined by outcome, not
  method: many pages that add "little or no value for users". Explicitly listed
  patterns include "scraping and lightly rewriting content from other sources at
  scale" and "stitching together content from different pages without adding
  anything new."
- **Quality rater guidelines.** Raters are told to give the *Lowest* rating when
  main content is copied or paraphrased "with little to no effort, originality,
  or added value."
- **LLM citation behaviour.** Answer engines cite the source that carries the
  fact, not the page that repeats it. Being the third paraphrase of a Wikipedia
  article makes you invisible to both.

### The operational version

> Before writing, name **three checkable facts** the page will contain that are
> absent from the top incumbent for the query. Write them down. If you cannot
> produce three, the page should not be written.

A checkable fact is falsifiable and specific:

| ✓ counts | ✗ does not count |
|---|---|
| "42 km, ~55 min from the provincial capital; asphalt to the village, last 3 km graded dirt" | "easily accessible" |
| "closed December–March, road not cleared" | "best visited in the warm months" |
| "entry free; parking unpaved, ~30 cars" | "a peaceful natural setting" |
| "we called the village council on 1405‑07‑02; the caretaker confirmed…" | "according to some sources" |

### The citation-share corollary

If one domain supplies most of a page's citations, the page *is* that domain's
content rearranged. A measured threshold that works well in practice:

```
share of citations from the single largest domain  ≤ 35 %
distinct sources per page                          5 – 25
```

Above 35% the page reads — to a rater and to a classifier — as derivative. This is
measurable: `geo_content_audit.mjs` reports it as `single-source`.

Wikipedia is a fine *starting point* for research and a terrible *source of record*
for a page that wants to outrank Wikipedia.

## §2 Choosing the differentiator

Pick one dimension where you can produce data the incumbents structurally cannot,
then make it consistent across every page in the corpus. The test for a good
dimension is: **does collecting it resist automation?**

| Vertical | Cheap to copy (worthless) | Expensive to collect (defensible) |
|---|---|---|
| Travel / places | history, etymology, "famous people from X" | drive time, road surface, months open, facilities, whether a city car makes it |
| Local services | opening hours from the website | verified price bands, languages spoken, wait times observed |
| Products | manufacturer spec sheet | measured results, failure modes, long-term notes |
| Education | curriculum copied from the prospectus | real admission rates, graduate destinations, class sizes |

Three properties make a differentiator work:

1. **Structured.** Same fields, same units, every page. Unstructured prose about
   road conditions is not a dataset; a `road_surface` field is.
2. **Comparable.** If it is comparable, you can build a filter/sort page — which
   becomes the highest-value URL on the site, because it *does* something.
3. **Sourced from a non-scalable act.** A phone call, a visit, a measurement.
   The cost is the moat.

### Minimum viable data block

Define the fields once, enforce them in the gate, and drop the field when the
value is unknown — never write "unknown" or "not reported". An empty field is
honest; a row full of "not reported" is an admission that the page has nothing.

## §3 Length is not depth

Word count correlates with nothing useful. A 7,000-word regional overview that
cites one encyclopedia 426 times has less information gain than an 800-word
attraction page with sixteen measured fields.

Practical ceilings for place content:

| Page type | Words | Job |
|---|---|---|
| Region / province hub | 1,500 – 2,500 | orient, link to children, carry the data table |
| County / district hub | 400 – 600 | disambiguate, link to children |
| Attraction / leaf | 600 – 1,200 | answer the visit question, carry the fact table |
| Decision page ("X in one day") | 900 – 1,600 | sequence, times, distances |

When an audit says a page is too long, the fix is almost never cutting prose — it
is **splitting** the page into the leaf pages the length was hiding.

## §4 Rescuing a derivative corpus

You rarely have to delete. In order:

1. **Fix the link economy first** (see `link-economy.md`). It is mechanical, it is
   render-time, and it removes the machine-readable confession of derivation.
2. **Re-role, don't delete.** Long derivative pages become short hubs; the research
   inside them becomes the seed for leaf pages that carry new data.
3. **Add the data layer** to the highest-traffic 10% before touching the rest.
4. **Prune on evidence, not taste.** Zero impressions after four weeks with the
   page indexed is evidence. "I don't like it" is not.
5. **`noindex` beats delete** for pages with any internal link value; delete only
   when nothing links in and nothing ever will.
