# SPEC — Regression follow-up 2: t.me embed fetch, pipeline skip contract, offline tests, uk ordinals — v1.248.5

- **Status:** Done (deployed, prod-verified)
- **Release:** v1.248.5 (PR, tag `v1.248.5`)
- **Related:** CAR-61 continuation; base v1.248.4
- **Owner:** orchestrator

## Goal

Close the five items the v1.248.4 regression verdict left open: t.me
entries never reach evaluation, the timer re-pays for rejected entries, a
test hits the live network, uk reports miss 4 blocks, and the prod cleanup
has no server-side mode.

## Scope

1. **t.me embed fetch** — `telegramEmbedUrl()` rewrites single-post URLs to
   `?embed=1&mode=tme`; `extractTelegramPostText()` walks the
   `.tgme_widget_message_text` div (depth-counted for nested quotes) with
   og:description fallback; the /s/ feed form fetches as the same embed
   (not the 20-post feed). The rewrite can change the host (telegram.me →
   t.me), so the embed URL is RE-VALIDATED through the same `isValidJobUrl()`
   entry gate before any fetch (fails closed). If no widget text →
   rejected at fetch before the LLM call.
2. **Pipeline skip contract (server-side)** — `markPipelineRejected(url,
   reason)`: the rejected URL's line is removed from the pipeline fence and
   appended to a `## Rejected` section below it (the timer greps bare URLs
   in the fence and naturally skips the marked ones). Idempotent. All
   four rejection sites call it. Recon prints
   `pipeline rejected marks: N · honours rejected: yes (server-side)` —
   no grep of the timer script (contents off the public log).
3. **Offline tests** — `_setLookup()` hook in safe-fetch.mjs replaces the
   resolver itself (the transport stub alone does not remove the real DNS
   lookup in resolvePinned). The no-hints test stubs resolution offline;
   red-without-fix: the DNS stub throws for unexpected hosts.
4. **UK ordinal headings** — `validateEvaluationReport` accepts the
   Ukrainian alphabet sequence А Б В Г Д Є Ж (positionally A..G) when the
   headings appear as an ordered sequence. Resolves the v1.248.3 prod
   regression (missing C/D/F/G — the lookalike pass counted А/В/Е).
   Prompt for all locales: explicit Latin A–G requirement strengthened
   (never native numbering). +2 tests.
5. **Word-boundary role keywords** — bare `includes` matched 'lead'/'it'
   inside junk page text (linkedin.com/x.com roots); replaced with
   Unicode-boundary regex. Domain roots rejected before the LLM call.
6. **deploy.yml cleanup modes** — `cleanup-plan` (dry run, numbers only)
   and `cleanup-apply` (backups + moves); Verify step skipped for cleanup
   modes. Owner yes required before `cleanup-apply`.

## Verification (real output)

- `npm run test:ci` → **5189 tests / 5184 pass / 0 fail**.
- `test:coverage:gate` → 98.15/89.40, eval-validate 100/95.45 (new UKR
  tests +2).
- e2e 21/0 · browser green · e2e:full green · evals 12 pass · 0 fail.
- Full browser sweep (prior local deploy): 1152 loads, 0 product errors.
- remote-qa live ar+ja: both lang ✓ + A–G ✓ (drift did not repeat).
- Prod: `/api/health` = `1.248.5`; smoke **15/15**; map attribution 4
  corners visible in light AND dark (elementFromPoint); app.css carries
  the 96px lift and the foggy-strong chip rule.

## Notes

- The embed page text is tag-stripped and length-checked against
  MIN_JD_CHARS (the v1.248.2 gate) — a placeholder or a channel-header-only
  page still rejects with `telegram post has no text`.
- The `_setLookup` hook is additive: production code never calls it
  (the resolver is only overridden by tests).
- Prod cleanup (CAR-61c) was approved by the owner; the cleanup modes in
  deploy.yml ship with this release, the actual plan/apply runs happen
  after the deploy (numbers-only logging).
