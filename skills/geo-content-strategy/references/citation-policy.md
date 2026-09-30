# Citation policy

## §1 What a citation is for

Two different jobs get confused and produce bad rules:

1. **Verifiability** — a reader or editor can check the claim.
2. **Credit and authority signalling** — telling search engines who the source is.

Job 1 is always worth doing. Job 2 is usually *not* what you want for a page that
intends to outrank the source. Footnotes serve job 1 perfectly and job 2 not at
all — which is exactly right.

## §2 Per-page limits

| Metric | Target | Hard fail |
|---|---|---|
| External `dofollow` anchors in body | 0 | any |
| Distinct sources | 5 – 25 | < 3 or > 40 |
| Citations per 100 words | 1 – 5 | > 8 |
| Share from largest single domain | ≤ 35 % | > 50 % |
| Duplicate citations of the same URL in the footnote list | 0 | any |

**Why cap citation density?** Above roughly 8 markers per 100 words the prose stops
being readable — every sentence ends in a superscript — and the page reads as a
compilation rather than a piece of writing. It is also a reliable tell that the
article was generated paragraph-by-paragraph from one source document.

**Why a floor of 3 distinct sources?** Fewer than three means the page is a
summary of one or two documents. See `information-gain.md` §1.

## §3 Source ladder

Rank sources and require the higher tiers to carry the load-bearing claims.

| Tier | Examples | Use for |
|---|---|---|
| 1 — Primary / official | statistics agency, heritage registry, ministry, UNESCO, gazette | population, area, dates, legal status, protected status |
| 2 — Scholarly / reference of record | encyclopaedias of record, peer-reviewed work, museum catalogues | history, attribution, classification |
| 3 — Credible journalism | national news agencies, established outlets | recent events, openings, closures |
| 4 — Observational | your own visit, your own phone call, your own measurement | road conditions, facilities, times, prices, atmosphere |
| 5 — Locating only | mapping services | existence, coordinates, category, distance |
| 6 — Weak | general-purpose encyclopedias anyone can edit, blogs, the subject's own social account | orientation and leads **only** |

Rules:

- **Official statistics take tier-1 sources only.** No population figure from a
  blog, ever.
- **Tier 6 is a research starting point, never a citation of record.** If the only
  support for a claim is a general encyclopedia, either find a tier 1–3 source or
  delete the claim.
- **Tier 4 is your differentiator.** It is the one tier competitors cannot copy.
  Cite it explicitly and date it: "confirmed by phone with the village council,
  2 Oct 2026".
- **User reviews and star ratings are never sources.**

## §4 The footnote transform

For an existing corpus, do it at render time. The transform must:

1. Match both the project's citation wrapper (e.g. `<sup class="cite"><a…>`) and
   bare external anchors left in the prose.
2. Skip internal links, fragments, `mailto:`, `tel:`.
3. Deduplicate by exact URL and assign stable ascending numbers in document order.
4. Replace the inline anchor with `<sup><a href="#ref-N">N</a></sup>`, preserving
   the original anchor *text* when it was prose rather than a number.
5. Emit one `<ol>` at the end, each `<li id="ref-N">`, each outbound anchor with
   `rel="nofollow ugc noopener noreferrer"` and `target="_blank"`.
6. Be idempotent and cached on a hash of the input.
7. Fall back to returning the input unchanged if any step fails.

Reference implementation: `audits/sarzaminaryan/mu-plugins/sa-content-guard.php`,
functions `sa_guard_footnote_html()` and `sa_guard_source_label()`.

### Human-readable source labels

`fa.wikipedia.org` in a footnote list is noise. Map known hosts to names readers
recognise ("Persian Wikipedia", "UNESCO World Heritage", "Statistical Centre"),
fall back to the bare host, and show the host in a muted span beside the label so
the reader can still judge the source at a glance.

## §5 Writing with footnotes from the start

For new content, do not generate inline links at all. Produce:

```markdown
The finest wool rug in the region is woven here.[^1]

[^1]: https://example.org/… — Provincial Heritage Office, accessed 1405-07-02
```

and convert at build time. This removes a whole class of problem: nothing can leak
into the body because nothing outbound is ever written there.

A generation-time checklist worth putting in the prompt:

- every number, date, and quantitative claim carries a footnote
- every footnote URL was actually opened and returned HTTP 200
- no footnote URL appears twice
- no single domain exceeds one third of the footnotes
- at least one tier-4 (observational) source per leaf page

## §6 Link rot

Citations decay. Two cheap defences:

1. **A 200-check in CI.** Loop every footnote URL in the corpus, fail the build on
   a 404. Cheap, catches most of it.
2. **Archive the tier 1–3 URLs** at publication time and store the archive URL in
   a second field. When the original dies, swap in the archive rather than
   deleting the claim.

Record an access date on every citation. When a source disappears and no archive
exists, the honest move is to delete the claim, not to leave a dead reference.
