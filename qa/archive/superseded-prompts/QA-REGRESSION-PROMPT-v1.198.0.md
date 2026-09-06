# QA REGRESSION PROMPT — career-ops-ui **v1.198.0** (HTTP retry: backoff + jitter + Retry-After)

**Added (scanner resilience).** `fetchJsonWithRetry` (`server/lib/http-json.mjs` — the retry wrapper every JSON scan source uses) waited a **flat** `retryDelayMs=500` on a transient 429/5xx, re-hammering a rate-limited board at a fixed cadence. It now uses **exponential backoff + jitter** and **honours a (clamped) `Retry-After`**.

- **Under test:** `package.json` **1.198.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # 2536, exit 0 (capture $? directly, never | grep)
node --test tests/http-json.test.mjs        # 26 subtests
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.198.0
```

## §1 — Change (`server/lib/http-json.mjs`)

- New pure `computeRetryDelayMs({ attempt, baseDelayMs, maxDelayMs, retryAfter }, rand=Math.random)`:
  - exponential backoff `baseDelayMs * 2**attempt`, capped at `maxDelayMs` (default 8000) **minus** a `JITTER_MS=250` jitter;
  - `+ rand()*jitter` **only when backoff > 0** — so a `0` base (instant-retry / test mode) stays exactly `0`;
  - a `Retry-After` **wins but is clamped** to `maxDelayMs * 4` (a hostile `Retry-After: 86400` → 32000, not 86.4 M ms).
- New `parseRetryAfterMs(value)` — delta-seconds | HTTP-date → ms, else null.
- `fetchJson` now attaches `.retryAfter` on a non-ok response (was `fetchText`-only).
- `fetchJsonWithRetry` takes an optional `maxDelayMs` (default 8000).

## §2 — Behaviour

| input | `computeRetryDelayMs` (rand→0) |
|---|---|
| attempt 0, base 500, max 8000 | 500 |
| attempt 1 | 1000 |
| attempt 3 | 4000 |
| attempt 6 (past cap) | 7750 (cap 8000 − 250 jitter); rand→1 → 8000 |
| base 0 | **0** (no jitter — instant-retry preserved) |
| retryAfter `'2'` | 2000 |
| retryAfter `'86400'` (hostile) | **32000** (clamped to max*4) |

- **Regression:** permanent 4xx (404) and refused-redirect (`unexpected redirect`) are still **not** retried (fail-fast); the `retryDelayMs: 0` instant-retry contract the source tests rely on is preserved (base 0 → 0).

## §3 — Sign-off

Suite **2536** green (+9) · CHANGELOG parity ×17 at v1.198.0 · README badge+banner ×17 · every JSON scan source (Glints/Jobstreet/IBM/Getro/Workday/…) inherits the new backoff via the shared wrapper — no per-source change.
