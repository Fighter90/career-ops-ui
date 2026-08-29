# QA REGRESSION PROMPT — career-ops-ui **v1.227.5** (regional-scan OOM · Playwright teardown flake)

**Patch release, no parent delta.** One production crash and one CI flake, both found from real failures rather than review. Registry unchanged: **85 sources** (80 EN + 5 RU), `ALL_ADAPTERS` **80**.

## §0 — Gates
```bash
npm test                                          # 2865 (was 2858), exit 0
node --test tests/ru-scanner.test.mjs             # 20
node --test tests/ru-scanner-dedup-order.test.mjs # 5 — includes a 200-trial equivalence check
node --test tests/console-noise.test.mjs          # 6 (was 4)
npm run test:ci                                   # exit 0
npm run test:e2e                                  # 21/21
npm run test:e2e:browser                          # 101/101
node scripts/check-changelog-parity.mjs           # 16 non-EN at v1.227.5
```

## §1 — The regional scan crashed the server
**Symptom:** `✗ Regional error: unknown error` then `✗ Regional error: connection lost`, partway through the RU phase — reproducibly around query 16 of 21.

**Actual cause (from the server journal, not from theory):**
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
career-ops-ui.service: … 548M memory peak      ← four such crashes in one day
```
`ru-scanner` accumulated **every raw hit from every query** and only deduped/filtered at the end. The query list is deliberately near-synonyms (`Golang`, `Go разработчик`, `Golang разработчик`, `Senior Go`…), so the same vacancy returns once per query and the array held a multiple of the unique count — with descriptions attached, which are the bulk of a job object and which the filters discard almost entirely.

| | |
|---|---|
| Heap on a real 21-query run, before | **742 MB** |
| Node heap cap on the server | **490 MB** (V8 sizes it from 956 MB RAM) |
| Heap after the fix | **177 MB** (−76%) |

**Why it only started now:** the query list grew 14 → 21 with the product-manager searches. Memory scaled with total hits, so +50% queries crossed the ceiling. The new queries are fine — they exposed an allocation pattern that had long been one config change from failing.

**`unknown error`** came from `driveOne`'s `send('error', { message: err && err.message })` — the crash left no usable message. The client's `connection lost` followed as the service restarted.

## §2 — Two hypotheses tested and discarded (do not re-chase them)
- **Caddy timeout** — `/etc/caddy/Caddyfile` is clean and `flush_interval -1` is correct for SSE.
- **Node's 5-minute default `requestTimeout`** — it matched the failure timing suspiciously well, but a scaled-down reproduction (3 s timeout, 6 s stream) showed it does **not** terminate a long streaming response. Discarded on evidence.

## §3 — Behaviour preservation (the risky part of the fix)
Dedup and filtering moved inside the query loop. Counts are unchanged because the unique total is now carried by a `Set` of URL strings rather than by retaining the objects.

`tests/ru-scanner-dedup-order.test.mjs` pins the awkward direction: **a later duplicate that FAILS the filters must evict an earlier one that passed** — the old end-of-run pass kept only the last copy and then filtered it. Plus a 200-trial randomised equivalence check against a reimplementation of the legacy accumulate-then-filter path.

## §4 — Playwright teardown flake
Three suites call `window.stop()` before asserting no console errors. Chromium reports that one deliberate act as `ERR_ABORTED` (cancelled), `ERR_EMPTY_RESPONSE` (mid-flight) or `ERR_SOCKET_NOT_CONNECTED` (socket already gone). The shared filter listed only the first two, so the same teardown failed a run at random — it hit the locale sweep on `tr` while `playwright-forms` and `playwright-smoke` were one unlucky run away. Fixed once in `tests/helpers/console-noise.mjs`.

**The filter stays narrow** — refused connection, DNS failure, connection reset, any 5xx and every uncaught JS exception still fail the assertion, pinned by a new test.

## §5 — Manual pass
1. Run a **full `source=both` scan on resumecraft** and let it finish. It must complete without `connection lost`; `journalctl -u career-ops-ui | grep "Reached heap limit"` must show no new entries.
2. Compare the RU summary block against a pre-fix run: `Total found`, `Filtered by negative`, `Already-seen dedup`, `New offers added` must all read the same for the same inputs.
3. `npm run test:e2e:browser` a few times — the locale sweep must not flake.

## §6 — Carried forward
- **SURF-1 · cvstart.ru** — domain now **account-verified** (takeover window closed); certificate still `new` after a correct file-level reset. GitHub-side wait, or their support.
- **resumecraft.ru** — Basic-auth gated; needs an unauthenticated `/api/health` + HSTS to be verifiable from a clean machine.
- **280 px** viewport overflow — documented, not gated.
- **Worth considering:** the box has 956 MB RAM and Node caps at 490 MB. The scan now fits with room to spare, but a larger `portals.yml` will approach it again. Either raise the cap (`NODE_OPTIONS=--max-old-space-size=`) or keep an eye on peak heap as the query list grows.

## §7 — Sign-off
Unit **2858 → 2865** · Playwright 101/101 · E2E 21/21 + 23/23 · parity ×17 at v1.227.5 · README ×17 · CONVENTIONS/PROJECT-CONTEXT/CLAUDE · site mirrors ×17 (facts 1.227.5 / 2865).
