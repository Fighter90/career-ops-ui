# QA REGRESSION PROMPT — career-ops-ui **v1.204.0** ("Setup doctor" panel)

**Added (feature).** A read-only **Setup doctor** tab on `#/config` that runs the parent's `cv-sync-check.mjs` and lists **blocking issues** (missing `cv.md`/`profile.yml` or fields) and **warnings** (leftover example/placeholder data, hardcoded metrics). Zero-token, no writes.

- **Under test:** `package.json` **1.204.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # 2602, exit 0 (capture $? directly, never | grep)
node --test tests/cv-sync-check-route.test.mjs # route + parseCvSyncOutput
node scripts/check-changelog-parity.mjs        # 16 non-EN at v1.204.0
```

## §1 — Real CLI contract (the load-bearing detail)

`cv-sync-check.mjs` has **NO `--json`** (argv is ignored; it checks its own `__dirname` parent). It prints stable human text + an exit code:
- Banner (always): `=== career-ops sync check ===`
- Clean: `All checks passed.` (exit 0)
- `ERRORS (N):` then `  ERROR: <msg>` lines (**exit 1** — a normal RESULT, not a script failure)
- `WARNINGS (N):` then `  WARN: <msg>` lines (exit 0)

`server/lib/routes/cv-sync.mjs::parseCvSyncOutput()` parses the `ERROR: `/`WARN: ` prefixes into `{ ok, errors[], warnings[] }`. **The banner's presence (not the exit code) decides a valid run** — this is the correctness crux; a non-zero exit with a banner is a successful check that found errors, NOT an unavailable script.

## §2 — Behaviour

- `GET /api/cv-sync-check` → `{ available:true, ok, errors:[...], warnings:[...] }` (errors/warnings capped at 100). Verified in-process against the REAL parent script → `{available:true, ok:true, errors:0, warnings:0}` on a clean setup.
- **Fail-soft:** `{ available:false, reason:'script-not-found' }` when the parent `cv-sync-check.mjs` is absent (CI/standalone) → the panel shows a muted "unavailable" line, never an error toast.
- **Client:** `#/config` → **Setup doctor** tab (lazy GET on open; "↻ Re-run" button). CSP-safe (`c()` + `addEventListener` + `textContent`, no `innerHTML`/inline handlers). Green all-passed line, or red **Blocking issues (N)** + amber **Warnings (N)** lists.

## §3 — Note

`cv-sync-check.mjs` was already reachable via `POST /api/run/sync-check` (buffered runner) + a raw-`<pre>` modal on `#/cv` (keys `cv.syncCheck*`). This release adds a **distinct, complementary** structured GET + config panel under a fresh `cvsync.*` namespace; the existing surface is untouched.

## §4 — Sign-off

Suite **2602** green (+8) · CHANGELOG parity ×17 at v1.204.0 · README badge+banner ×17 · site changelog ×17 · one read-only relay route, no new dependency, no parent edits.
