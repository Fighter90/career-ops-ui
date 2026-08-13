# QA REGRESSION PROMPT — career-ops-ui **v1.179.0** (HTML-entity decoder consolidation)

**Parent-sync follow-up (LOW, scanner) — closes the `qa/PARENT-SYNC-WORKLIST-v1.26.0.md` worklist.** 20 scraping scan sources each carried their own `decodeEntities`/`decodeXmlEntities` (+ a `fromCodePoint` helper). Behaviour-preserving refactor routing them all onto the single `server/lib/html-entities.mjs` introduced in v1.172.0.

- **Under test:** `package.json` **1.179.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2458, exit 0 (capture $? directly, never | grep)
node --test tests/decoder-consolidation.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.179.0
```

## §1 — Change

- **12 sources** (`agenticjobs, avature, deutschebahn, hecklerkoch, icims, radancy, remotli, rheinmetall, softgarden, successfactors, rss, jobvite`) dropped their local `function decodeEntities` (+ named-entity const, + jobvite's `fromCodePoint`) and now `import { decodeEntities } from '../html-entities.mjs'`. Call sites unchanged.
- **8 RSS-style sources** (`personio, cryptocurrencyjobs, higheredjobs, jobspresso, larajobs, nodesk, teamtailor, weworkremotely`) dropped their `fromCodePoint` + `decodeXmlEntities` and keep the name via `const decodeXmlEntities = decodeEntities;` — so call sites and **cryptocurrencyjobs's deliberate double-decode** (`decodeFeedText = s => decodeXmlEntities(decodeXmlEntities(s))`) still work.
- Net **−237 lines** of duplication. New `tests/decoder-consolidation.test.mjs` fails if any source re-grows a local decoder or the bare `Number.isFinite→fromCodePoint` crash pattern.

## §2 — Behaviour deltas (all safe, verified by the source-adapter tests)

- The **8 RSS-style sources gained `&nbsp;` → space** (they handled only 5 named entities before; the shared module has 6). Improvement.
- A malformed/out-of-range numeric entity now **passes through as literal** (shared behaviour) instead of being dropped to '' (old RSS behaviour) or throwing (old crash-3). Non-crashing, near-nonexistent in real feeds.
- **`hh.mjs` is intentionally NOT migrated** — it handles `&mdash;`/`&ndash;`, which the shared 6-entity module (a mirror of the parent's decoder) does not; migrating would lose those.

## §3 — Invariants

- **Behaviour-preserving** — every source-adapter test (`tests/sources-*.mjs`) passes unchanged; no fixture output changed. EN reports/scan output unaffected.
- Scanner in-process only — no route / CSP / SSRF / parent-write change; no new dependency.

## §4 — Sign-off

Suite **2458** green · `decoder-consolidation` guard 2/2 · all source-adapter tests pass · 23 sources import the shared decoder, 0 local definitions (bar `hh`) · parity ×17. **Closes the PARENT-SYNC worklist (GAP #1–#5 + decoder consolidation) — backlog empty.**
