# QA REGRESSION PROMPT — career-ops-ui **v1.203.0** ("reuse a past CV?" hint)

**Added (feature).** When a saved job description is opened in **CV Studio**, the app compares it against every OTHER saved JD (deterministic Jaccard word-overlap, zero tokens) and shows whether the closest match is similar enough to **reuse** a tailored CV, reuse it **with edits**, or **tailor a fresh one**.

- **Under test:** `package.json` **1.203.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                          # 2594, exit 0 (capture $? directly, never | grep)
node --test tests/jd-similarity-reuse-route.test.mjs   # 6 subtests
node scripts/check-changelog-parity.mjs           # 16 non-EN at v1.203.0
```

## §1 — Change

- New read-only `GET /api/jds/:name/reuse` in `server/lib/routes/jds.mjs` (gated by `llmRateLimit`; `:name` path-sanitized; 404 if the JD is absent). Relays the parent `jd-similarity.mjs` once per OTHER saved JD, newest-first, capped at `MAX_REUSE_CANDIDATES=25`, and returns the best verdict by `REUSE_RANK` ({reuse:3, 'reuse-with-edits':2, regenerate:1}).
- `public/js/views/cv-studio.js` — a muted CSP-safe hint (`c()` + `textContent`), keys `cvs.reuseHigh` / `cvs.reuseEdits` / `cvs.reuseRegen` ×17.

## §2 — Relay contract (verified against the REAL CLI, not a guessed fixture)

- `node jd-similarity.mjs <new> <prior>` emits JSON **by default** — there is NO `--json` flag (passing `--json` errors "unrecognized flag"). The relay passes exactly `['jds/<name>', 'jds/<prior>']` as array args (never shell-interpolated).
- Real output shape (confirmed live): `{ "decision": "reuse" | "reuse-with-edits" | "regenerate", "score": <0..1>, "reason": "<...>-similarity" }`. Identical-ish JDs → `reuse-with-edits`@~0.54; unrelated → `regenerate`@0. `REUSE_RANK` keys match `decision` exactly.

## §3 — Behaviour

- `GET /api/jds/:name/reuse` → `{ available:true, best:{ jd, decision, score, reason } }` (or the route's actual success shape) when ≥1 prior JD resolves.
- **Fail-soft (the CI reality):** `{ available:false, reason:'script-not-found' }` when the parent `jd-similarity.mjs` is absent (standalone/CI install), and `{ available:false, reason:'no-prior-jds' }` when there are no other saved JDs. The client shows nothing / a muted line — never an error toast, never a fabricated verdict.
- Zero tokens, no LLM, no writes. Deterministic.

## §4 — Sign-off

Suite **2594** green (+6) · CHANGELOG parity ×17 at v1.203.0 · README badge+banner ×17 · site changelog ×17 · one read-only relay route, no new dependency, no parent edits.
