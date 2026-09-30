# Publish gates that ship

## §1 The deadlock pattern

A quality gate becomes a project killer when a condition depends on content that
does not exist yet. The canonical example:

```php
'province' => array( 'faq' => 10, 'sources' => 5, 'internal_links' => 20 ),
…
if ( 'hard' === gate_mode() ) { $data['post_status'] = 'draft'; }
```

A region page reaches 20 internal links only once its child pages exist. Child
pages are gated too. So the region sits in `draft`, the children get written to
unlock it, and the project spends a year producing content that nobody has ever
seen a ranking signal for.

Observed outcome in one real corpus: **27 finished region articles — 151,000
words — locked in draft**, while the home page linked to all 31 regions and served
27 × 404.

Two independent harms:

1. **Zero feedback.** Nothing is measured, so nothing is learned. Every subsequent
   decision is a guess.
2. **Compounding waste.** Work continues in the direction the gate implies, which
   may be the wrong direction — and the gate guarantees you will not find out.

### How to spot it before it bites

For every gate condition, ask: *can a single author satisfy this today, working
only on this page?* If the answer is no, it is not a gate condition. It is a
roadmap item.

| Condition | Satisfiable alone? | Verdict |
|---|---|---|
| Featured image | yes | blocking |
| Title, meta description, focus keyword | yes | blocking |
| Parent relation set | yes | blocking |
| Primary taxonomy term | yes | blocking |
| Three information-gain facts | yes | blocking |
| Zero external dofollow, zero dead internal links | yes | blocking |
| 20 internal links to sibling pages | **no** | advisory |
| 10 FAQ pairs | technically yes, but produces fake questions | advisory |
| Coordinates | sometimes | advisory |
| Word-count floor | yes, but rewards padding | advisory |

## §2 Blocking versus advisory

**Blocking** = the page is genuinely broken or unindexable without it. Six items,
no more. Each must be fixable in under five minutes by the person hitting publish.

**Advisory** = the page is publishable but improvable. Surface it as a persistent
notice on the edit screen and in a health report. Never change `post_status`.

Implementation shape (WordPress):

```php
add_filter( 'wp_insert_post_data', function ( $data, $postarr ) {
    if ( 'publish' !== $data['post_status'] ) { return $data; }

    $blocking = [];
    $advisory = [];
    foreach ( evaluate_all( $postarr['ID'] ) as $issue ) {
        ( is_advisory( $issue ) ? $advisory : $blocking )[] = $issue;
    }
    // advisory issues are recorded and shown, never enforced
    stash_notice( $blocking, $advisory );

    if ( $blocking ) { $data['post_status'] = 'draft'; }
    return $data;
}, 20, 2 );
```

Two things this must always have:

- **A filter on the blocking list** (`apply_filters( 'gate_blocking', … )`) so the
  rule can be adjusted without editing theme code.
- **A kill switch.** A constant that disables the gate entirely. The day you need
  to ship and cannot, you will be glad it exists.

## §3 Replacing a gate you cannot edit

If the gate lives in theme code you would rather not fork, swap it from an
mu-plugin:

```php
add_action( 'init', function () {
    if ( ! function_exists( 'theme_gate_filter' ) ) { return; }
    remove_filter( 'wp_insert_post_data', 'theme_gate_filter', 20 );
    add_filter( 'wp_insert_post_data', 'my_gate_filter', 20, 2 );
}, 20 );
```

Reuse the theme's own evaluation functions inside your replacement, then partition
their output into blocking and advisory with a pattern match on the message. You
inherit every check the theme author wrote and change only the enforcement.

Worked example: `audits/sarzaminaryan/mu-plugins/sa-content-guard.php`,
`sa_guard_swap_gate()` / `sa_guard_gate_filter()`.

## §4 Ship-then-improve

The gate is one of three quality mechanisms, and the weakest of them.

| Mechanism | When | What it catches |
|---|---|---|
| Automated audit in CI | before merge | link economy, dead links, H1s, thin pages, banned phrases |
| Publish gate | at publish | missing image, missing meta, missing relation |
| Post-publish review | day 28 / day 60 | what real users and real queries revealed |

The third is the only one that can tell you whether the page was worth writing.
Gates cannot; they only test for the absence of known defects. So optimise for
getting to the third mechanism quickly.

**Hard rule:** nothing sits in `draft` for more than 48 hours after it is
otherwise finished. If it is not good enough to publish in 48 hours, it was not
ready to be written.

### Retiring rather than gating

The counterpart to shipping fast is pruning honestly. At day 60:

| Search Console state | Action |
|---|---|
| impressions + clicks | keep, deepen |
| impressions, no clicks | rewrite title and meta, re-check in 28 days |
| indexed, zero impressions after 4 weeks | shorten to hub role, merge, or `noindex` |
| not indexed after 6 weeks | check for a crawl/quality problem before assuming demand |

Pruning is what lets you ship fast without accumulating a corpus of dead weight.
A gate that never lets anything out is not quality control — it is a refusal to
be measured.
