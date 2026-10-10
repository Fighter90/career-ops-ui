# SPEC — Post-regression polish: Telegram line structure, header role, Rejected dedup, recon honesty — v1.248.6

- **Status:** Done (deployed, prod-verified)
- **Release:** v1.248.6 (PR, tag `v1.248.6`)
- **Related:** continuation of v1.248.5; five low-severity findings from its regression
- **Owner:** orchestrator

## Goal

Close the five low-severity items the v1.248.5 regression verdict left
open. All five are behaviour-visible but none touches the v1.248.5
contract surfaces (embed fetch, skip contract, offline tests, uk
ordinals, word boundaries, cleanup modes — verified untouched).

## Scope

1. **t.me line structure** — `extractTelegramPostText` converts `<br>`
   (and `</blockquote>`) to newlines BEFORE tag-stripping and decodes
   numeric HTML entities; the company self-label pattern widened to
   `^Компания\s*[:—–-]\s*(.+)` («Компания : X» with a space — the live
   shape that fell back to the channel name).
2. **Tracker role from the report header** — the merged role (H1 →
   cleaned post line) now reaches the slug, the tracker row, the dedup
   comparison and the done event; the H1 `# <Role> — <Company>` keeps
   only the role side; the fallback line is stripped of hashtags and
   emoji and capped at 80 chars (`cleanRoleLine`).
3. **`## Rejected` dedup** — the section heading is created once; each
   rejection appends its line into the existing section. Two
   rejections in a row → one heading, two lines.
4. **Domain root before the request** — the pathname check moved in
   front of `fetchJobDescription`: a junk root costs no fetch (no
   `fetch: done` event for it).
5. **Operational honesty** — recon computes `honours rejected:` from
   the deployed source (grep for `markPipelineRejected`) and prints the
   marks count once; cleanup-plan reports per-category numbers (t-role
   to move / dirty-URL lines / test-row lines) read from the cleanup
   script's own output labels; link-check treats github.com 5xx as
   unverified (Actions-runner-only flakiness, 3/3 observed).

## Verification (real output)

- `npm run test:ci` → **5191 tests / 5188 pass / 0 fail** (3 new tests:
  real-post shape with `<br>`+«Компания : X»+hashtags, Rejected dedup,
  root-before-fetch).
- coverage gate 98.18/89.42 · e2e 21/0 · browser · full · evals 12/0 ·
  link-check «No broken links».
