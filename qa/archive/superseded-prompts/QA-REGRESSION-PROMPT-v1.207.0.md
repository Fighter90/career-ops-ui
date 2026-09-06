# QA REGRESSION PROMPT — career-ops-ui **v1.207.0** (Record an application outcome from the tracker)

**Added (feature).** Every `#/tracker` row gets an **Outcome** action — a preview-then-record modal that logs an application's final outcome (rejected / offer received / hired / offer declined / no response / advanced to interview), archives the submitted CV & cover-letter artifacts, and syncs the tracker to the canonical state via the parent `outcome.mjs`. Zero-token, deterministic.

- **Under test:** `package.json` **1.207.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                     # 2618, exit 0 (capture $? directly, never | grep)
node --test tests/outcome-route.test.mjs     # 8 subtests
node --test tests/i18n-locale-files.test.mjs # snapshot + parity (1376 keys, 13 new track.outcome.*)
node scripts/check-changelog-parity.mjs      # 16 non-EN at v1.207.0
```

## §1 — Real CLI contract (verified against outcome.mjs)

`outcome.mjs <selector> <type> [--stage --feedback --note --role --cv --cover] [--dry-run] [--json]`:
- **Types (OUTCOME_MAP, 14 keys):** `interview_progress · stage_reached · interview · offer_received · offer · hired · accepted · offer_declined · declined · rejected · rejection · no_response · ghosted · interview_only` → canonical states (Interview / Offer / Hired / Discarded / Rejected).
- **`--dry-run --json`** → `{dryRun:true, num, company, role, outcomeType, canonicalState, stage, feedback, note, outcomeDir}` — matches the tracker row, **writes nothing**.
- **`--json`** (real) → adds `success:true, postingArchived, setStatusResult`; mkdir the outcome dir, append the journal, sync the tracker.
- **`failExit`** prints `{error, code}` to **stdout** under `--json` (codes: `invalid-outcome`, `row-not-found`, `company-not-found`, `ambiguous-match`, `tracker-not-found`, …) and exits nonzero.

## §2 — Route + WRITE-SAFETY (the load-bearing part)

`POST /api/outcome { selector, type, stage?, feedback?, note?, role?, dryRun? }` — `llmRateLimit` guarded.
- **`dryRun:true`** → runs `--dry-run --json` (read-only preview). Script absent → **200** `{available:false, reason:'script-not-found'}` so the UI hides the feature.
- **dryRun falsy** → the explicit WRITE (`--json`). Script absent → **422**.
- **Guards (all BEFORE the spawn):** `type` normalized (`lowercase`, `-`→`_`) and **whitelisted to the 14 keys** → a bad type is **400**, never a spawn. Every text field (`selector/type/stage/feedback/note/role`) is **control-char-rejected** (`charCodeAt < 0x20 || === 0x7f`) → **400** (a newline could smuggle a CLI token or corrupt the journal); lengths bounded (selector ≤120, stage ≤120, role ≤160, feedback/note ≤1000). Fields passed as **array args** (spawn, no shell). A **handled** CLI failure (`{error,code}` on stdout) → **400**; unexpected/timeout → **422**.
- **Verify (tests):** control-char field → 400 no write; missing selector/type → 400; unknown type → 400 (no spawn); preview by report # and by company (hyphenated type normalized) → 200 no write; no-match preview → 400 `code:row-not-found`; real write appends the journal + returns `canonicalState`; script-absent → preview `{available:false}` / write 422.

## §3 — Client (`#/tracker`)

Every row's Actions cell gains an **Outcome** button → `openOutcomeModal`: 6 curated outcome options, an optional note, a **Preview** button that shows `Will set #N Company → State` (dry-run), then a **Record** button that appears only after a successful preview and does the write → toast + `UI.closeModal()` + `Router.render()`. The Record button is hidden via **inline `style.display`**, NOT the `[hidden]` attribute (dodges the `.btn{display:inline-flex}` author-display trap). CSP-safe: `UI.el` + `addEventListener` + `textContent`, no `innerHTML`, no inline handlers. **i18n:** 13 new `track.outcome.*` keys ×17 locales + snapshot regenerated.

## §4 — Sign-off

Suite **2618** green (+8) · CHANGELOG parity ×17 at v1.207.0 · README badge+banner ×17 · i18n 1376 keys (13 new ×17) + snapshot · one guarded preview+write route, no new dependency, no parent edits. _CodeQL will raise the standing missing-rate-limiting FP on the route (it has `llmRateLimit`) — dismiss post-merge._
