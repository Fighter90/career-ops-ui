# QA regression — v1.242.0

Patch-to-minor on v1.241.1: sources correctness (Phase 2). Counts changed: **4812** unit
(was 4419) / **118** browser / coverage mean **98.15 % line / 89.36 % branch** (floor 96/86).
Sources/adapters count unchanged: **109** sources / **104** EN adapters + 5 RU.

## §0 — Gates

```bash
npm run test:ci                      # 4812 pass, exit 0
npm run test:e2e:browser             # 118 pass
node evals/workflow/run.mjs          # 14 pass
npm run test:coverage:gate           # exit 0 (node 22 — the gate needs node ≥21 for --test globs)
```

## §1 — What changed (verify each)

1. **Live scan on a justjoin / nofluffjobs board returns postings** (both were dead:
   envelope change / 400 without `salaryCurrency`). himalayas / jobicy return more than
   20 rows per board.
2. **Scan of a board whose API answers a Cloudflare challenge** marks the board
   **broken/error**, not "0 postings" — check the scan view error text and the quarantine
   record wording.
3. **A portals entry with a garbage `api:`/`careers_url:`** (e.g. `provider: collage` with
   a non-collage URL) no longer aborts the EN scan — the scan completes, the entry is
   reported as failed/skipped.
4. **Lever board scans still work** (`api.lever.co` pin) and `clever.com`-style look-alikes
   are refused; greenhouse legacy `boards.greenhouse.io/<slug>` careers_urls resolve again.
5. **Telegram channel source returns the newest posts** (not the oldest) for a busy channel.
6. **`#/tracker` → scan results → sources column** still shows source names for
   mycareersfuture rows (12-field shape now emitted).
7. **No remote-tag regressions:** a title like "Verpleegkundige (100%)" or
   "Distributed Systems Engineer" does NOT appear in the Remote filter on `#/scan`
   results (arbeitsagentur/vdab/rippling/teamtailor RE tightening).

## §2 — Manual browser pass

`#/scan` (run one EN scan + one RU scan), `#/portals` (add/remove a tracked company),
`#/tracker`, `#/dashboard` (AVG SCORE unaffected by scanner changes). Same passes at
390 px. Locale spot-check: scan error messages render in the UI locale (en/ru).

## §3 — Contract / security invariants

- `redirect:'error'` on every source fetch; job URLs `https:` on the pinned host only.
- Adapter `matches()`/`buildEndpoint()` never throw on garbage input (registry + scanner
  both wrap, but the adapters now guard themselves).
- No new routes; no CSP changes; parent files untouched.

## §4 — Deploy

`/api/health` on the server: `version: 1.242.0`. Public check answers **401** (basic auth).
Deploy holds the scan/eval timers and resumes them (v1.241.1 behaviour, still in place).

## §5 — Sign-off

- [ ] §0 green (coverage gate under **node 22**) · [ ] §1 1–7 · [ ] §2 in a real browser · [ ] §4 prod verify passed
