# 0004 — Liveness: hard vs soft expiry tiers

**Status:** Accepted · 2026-09-21 (v1.237.0)

## Context

`server/lib/liveness-core.mjs` classifies a fetched posting page for the `#/tracker`
"Still live?" action. Its guards run in a fixed precedence:

`http_gone → bot_challenge → access_blocked → server_error → expired_url → expired_body (HARD)
→ redirected_off_posting → apply_control_visible → expired_body_soft (SOFT) → listing_page
→ insufficient_content → no_apply_control`

`HARD_EXPIRED_PATTERNS` is tested **before** the apply-control check, so anything
placed there overrides a visible Apply button on a live page. The classifier receives
the whole page's text plus same-origin iframe text, so page chrome is in scope:
`/\bjob expired\b/i` was measured false-firing on a "Similar jobs" carousel entry, a
"Hide job expired" filter chip, and a footer FAQ — all on live postings.

The two directions of error are **not** symmetric. A false `expired` is written to scan
history as `skipped_expired` and then dedup-filters that real job out of *every later
scan*, indefinitely, unless `scan_history.recheck_after_days` is set. A false "still
live" costs one wasted re-check.

## Decision

Two tiers, separated by the apply-control check.

- **HARD** (`expired_body`) — only copy that cannot appear as chrome on a live posting.
  Beats a visible Apply button.
- **SOFT** (`expired_body_soft`) — checked after `apply_control_visible` and before the
  listing-page heuristic. A live page with an Apply button wins; a dead page with the
  same phrase and no apply control still expires.

A pattern goes in HARD only when it cannot occur as page furniture. When unsure, SOFT.

Pattern authors must also guard compound adjectives: `/this (?:job|role|position)(?: listing)? is closed\b(?!-)/i`
— `\b` alone rejects `closedown` but still matches real prose like *"This role is
closed-loop control of the platform"*; the `(?!-)` lookahead is what stops it.

## Consequences

- Adding a phrase to HARD needs evidence it never appears as chrome; the default is SOFT.
- The precedence order is part of the contract, covered by
  `tests/liveness-core-soft-expiry.test.mjs`, and documented in the wiki's
  Features page so it is discoverable outside the code.

## Revisit when

Scan history gains a cheap "re-check an expired row" path. If a false expiry stops
being permanent, the asymmetry driving this design weakens.
