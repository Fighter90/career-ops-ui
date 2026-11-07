# QA Regression Prompt — v1.270.0 (parent-sync features wave)

> Release: **v1.270.0** (2026-11-07) — six new sources (ALDI Nord, HiBob, HireHive, Factorial, Polymer, Remote), Consider whole-board walk, worldwide country labels, per-entry `timeout_ms`, per-request `CAREER_OPS_HTTP_TIMEOUT_MS`, configurable scan concurrency, telegram strict Habr links + positional employers + DISCLOSED_HIDDEN, description passthrough ×6 boards + nodesk/jobicy decode, avature/arbeitsagentur/getro fixes, contributors list fix
> Prod target: resumecraft.ru = **1.270.0**, parent **1.38.0** (fork synced `31a29b30` → `b859214b`, 148 commits, divergences defended)
> Basis: v1.269.2 shipped & deployed (review-fix patch). Nothing from the v1.269.2 contract changes; this release is the parent-sync features wave on top of it.

## §0 Local gates (HEAD — real numbers, no re-derivation by hand)

| Gate | Expected |
|---|---|
| npm run test:ci | **7874 tests · 7871 pass · 0 fail · 3 skip** |
| npm run test:e2e:browser | **201 pass · 0 fail · 1 opt-in skip** |
| npm run test:coverage:gate | **98.59 line / 90.55 branch** (ratchet raised, +6 exempt new files) |
| node evals/workflow/run.mjs | **0 ✗** except the known `site-build-after-fanout` (site rebuild follows the fan-out) |
| changelog parity | **✓ ×19 at 1.270.0, 491 releases each** |
| /api/health | **1.270.0 / parent 1.38.0** |

A red §0 gate is a finding, not a sweep item: triage before touching the manual checklist.

## §1 What shipped (verify these first)

1. **Registry 135 = 130 EN + 5 RU · 130 adapters.** Six new sources — ALDI Nord, HiBob, HireHive, Factorial, Polymer, Remote — appear in the live `GET /api/scan/sources` registry AND as fetchable adapters; count gates regenerated from the live registry.
2. **Consider whole-board walk.** A Consider board scans past the first ~10 postings — pagination walks the whole catalog, not a single page.
3. **Worldwide country labels.** A location like «worldwide» is accepted by the country-only filter (matches the allow-list, not dropped).
4. **Scan controls:** per-entry `timeout_ms` in `portals.yml`, per-request `CAREER_OPS_HTTP_TIMEOUT_MS`, configurable scan concurrency — defaults kept at **32 companies / 10 per host** when unset.
5. **Telegram strict source:** parses a Habr vacancy link (strict `telegram-channel` path), positional employer lists, and `DISCLOSED_HIDDEN` postings handled.
6. **Description passthrough ×6 boards** + nodesk/jobicy decode: descriptions arrive decoded and populated so the content filter reads them.
7. **Fixes:** avature, arbeitsagentur, getro; README contributors card list fixed.
8. **Fork sync:** parent `31a29b30` → `b859214b` (148 upstream commits), fork divergences defended post-merge (ADR-0002 greps).

## §2 Manual spot checks

- [ ] **New sources in the `#/scan` Source dropdown ×19 labels.** Switch the UI through all 19 locales → ALDI Nord, HiBob, HireHive, Factorial, Polymer, Remote each appear with a correct localized label in every locale; the dropdown count matches the registry (135 = 130 EN + 5 RU).
- [ ] **A Consider board scans past 10 postings.** Pick a tracked Consider company → the scan returns more than one page of results (well past 10 postings), rows deduped by URL.
- [ ] **Country-only filter accepts «worldwide».** A posting located only «worldwide» (no city/country) is accepted by the location filter rather than silently dropped.
- [ ] **Telegram strict parses a Habr vacancy.** A strict-channel post that links to a Habr vacancy produces a proper job row (employer + vacancy link, not discarded).
- [ ] **README contributors show 6 cards incl. goldbillka.** The README contributors block renders 6 contributor cards, goldbillka among them, on GitHub (rendered view).

## Locale sweep

All 19 UI locales render unchanged except the new-source labels (§2 first item) — one sanity render per locale group (en, ru, ja, ar on `#/scan`) plus the ×19 dropdown-label pass above.

## remote-QA (standard)

remote-QA on prod (routes ×19, site ×19, links, live scan + LLM `save:false`) green; findings → Linear immediately.
