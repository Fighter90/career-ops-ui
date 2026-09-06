# QA REGRESSION PROMPT — career-ops-ui **v1.200.0** ("Still live?" ATS liveness check)

**Added (feature).** A zero-token, zero-browser liveness check for ATS-hosted postings, surfaced as a lazy **"Still live?"** button on `#/tracker`. One click asks the ATS's own public JSON (Greenhouse / Lever / Ashby / Workday / SmartRecruiters) and reports **Live / Expired / Unknown** — so a user can spot dead postings without opening each one.

- **Under test:** `package.json` **1.200.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # 2557, exit 0 (capture $? directly, never | grep)
node --test tests/liveness-core.test.mjs       # 9 subtests
node --test tests/liveness-route.test.mjs      # 8 subtests
node scripts/check-changelog-parity.mjs        # 16 non-EN at v1.200.0
```

## §1 — Change

- New `server/lib/liveness-core.mjs` — pure `classifyLiveness()` (ported, zero-dep, no I/O).
- New `server/lib/liveness-api.mjs` — `resolveAtsApi`, `isAtsPosting`, `checkLivenessViaApi`, `classifyAshbyBoard`. Per-provider host+path recognizers + fixed API URLs. Uses `safeGet` (not raw `fetch`); `_setSafeGet` test seam.
- New `server/lib/routes/liveness.mjs` — `registerLivenessRoutes(app)`, `GET /api/liveness?url=` → `{result:'live'|'expired'|'uncertain', code, reason, provider}`. Registered in `server/index.mjs`.
- `public/js/views/tracker.js` — `isAtsPostingUrl()` + `livenessAffordance()`; a "Still live?" button in the Status cell for ATS rows only.
- i18n ×17 (`track.liveCheck/liveChecking/liveLive/liveExpired/liveUncertain/liveCheckAria`) + snapshot regen.

## §2 — Security envelope (the load-bearing part)

- **Gate 1:** the `url` param is rejected by `isValidJobUrl()` (loopback / file / private / template chars) → HTTP 400 before any fetch.
- **Gate 2:** the ATS API URL is built from a **fixed host** + path segments validated by `isSafeValue` (strict `[A-Za-z0-9._-]`, no `..`, per-segment even for Workday's multi-segment jobPath), then fetched via **`safeGet`** (DNS-pinned, per-hop `isValidJobUrl`, size/time capped). A redirect landing on a **different origin** than the fixed API host → inconclusive. Global `fetch` is never called on a user URL.
- **`safeGet` contract:** returns `{status, text, finalUrl}` and accepts `{timeoutMs, maxBytes, userAgent, headers}` — the checker reads/passes exactly these (verified against `server/lib/safe-fetch.mjs`, so tests aren't green on a mismatched stub).

## §3 — Behaviour

| ATS response | Result |
|---|---|
| 404 / 410 (per-job API) | **expired** (`*_api_gone`) — except **Lever** (`api404Authoritative:false`) → uncertain |
| 200 per-job (GH / Lever / Workday / SR) | **live** |
| 200 org board (Ashby), posting listed | **live**; absent / `isListed:false` → **expired** |
| 429 / 5xx / redirect off-origin / unparseable / non-ATS URL | **uncertain** (never a false expired) |

- **Client:** the "Still live?" button renders ONLY for rows whose URL matches `isAtsPostingUrl` (https-only, the 5 providers). Click → lazy `GET /api/liveness` → swaps in a `badge-ok`/`badge-bad`/`badge-warn` pill with the reason as tooltip. CSP-safe: `c()` + `addEventListener` + `textContent`, no `innerHTML`/inline handlers.

## §4 — Sign-off

Suite **2557** green (+17) · CHANGELOG parity ×17 at v1.200.0 · README badge+banner ×17 · site changelog ×17 · one new read-only route, no new dependency, no parent edits.
