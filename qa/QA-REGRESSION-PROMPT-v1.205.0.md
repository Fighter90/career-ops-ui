# QA REGRESSION PROMPT — career-ops-ui **v1.205.0** (Skills log)

**Added (feature).** A **Skills log** (`#/assessments`, Analytics group) to record a skills self-assessment — company, platform, skill/subject, score %, optional note — appended to the parent's `data/assessments.tsv`, with a newest-first list. Zero-token, deterministic.

- **Under test:** `package.json` **1.205.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                     # 2610, exit 0 (capture $? directly, never | grep)
node --test tests/assessments-route.test.mjs # 8 subtests
node scripts/check-changelog-parity.mjs      # 16 non-EN at v1.205.0
```

## §1 — Real CLI contract (verified empirically)

`assessment-log.mjs`:
- **List:** its **default (bare) output IS the JSON list** — there is NO `--json` flag (`--summary` is the human-text mode). Shape: `{ assessments:[{date,company,reportNum,platform,subject,threshold,score,staleNote}], aggregates:{byPlatform}, quality }` (numeric fields `null` when unset).
- **Append:** `add --company <name> [--report <n>] --platform <vendor> --subject <topic> [--threshold <pct>] [--score <pct>] [--stale "<note>"]`; required company/platform/subject; date auto-stamped; prints `{added:true, row:[...]}` (exit 0) / stderr+exit 1 on bad input.
- **TSV:** 8 tab-separated cols `date · company · report#|- · platform · subject · threshold%|- · score%|- · stale_note`. The CLI resolves its log path relative to its **own `__dirname`** (not `CAREER_OPS_ROOT`).

## §2 — Routes + WRITE-SAFETY (the load-bearing part)

- `GET /api/assessments` — `llmRateLimit` → existsSync guard → `runNodeScript('assessment-log.mjs', [])` → `parseJsonStdout`. Fail-soft `{available:false, reason:'script-not-found'|'timeout'|'script-error'}`.
- `POST /api/assessments` — explicit write; shells `assessment-log.mjs add …` with fields as **array args** (`runNodeScript`, spawn, no shell). **`hasControlChar()` (charCodeAt loop, `code<0x20||code===0x7f`) rejects any text field with a control character → 400 BEFORE any shell-out** — a TAB would break a TSV column, a newline would inject a row past the columns. `threshold`/`score` whitelisted to numeric **0–100**; company/platform/subject/report/note length-bounded. **Verified live:** a TAB in `company` and a crafted newline row-injection each → **400, no write** (`assessments.tsv` untouched); two valid appends → exactly two non-comment rows.

## §3 — Client

`#/assessments` "Skills log" (Analytics nav). A card form (Company, Platform, Skill, Score %, Note) + Save + a newest-first list from `GET /api/assessments` with honest empty/unavailable states. CSP-safe: `UI.el` + `addEventListener` + `textContent`/`createTextNode`, no `innerHTML`, no `UI.md`, no inline handlers. i18n ×17.

## §4 — Sign-off

Suite **2610** green (+8) · CHANGELOG parity ×17 at v1.205.0 · README badge+banner ×17 · site changelog ×17 · one read-only route + one guarded explicit-write route, no new dependency, no parent edits. _CodeQL will raise the standing missing-rate-limiting FP on both routes (they have `llmRateLimit`) — dismiss post-merge._
