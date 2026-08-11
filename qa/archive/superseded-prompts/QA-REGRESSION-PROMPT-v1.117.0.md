# QA REGRESSION PROMPT — career-ops-ui **v1.117.0** (Parent parity pack)

Delta regression for six parent-parity capabilities. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.117.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.
- **Read-only against a live parent** except the two explicit writes below.

## §0 — Gates
```bash
npm test                                       # ≥1750 (sources-parity ×6, parity-routes ×7)
node --test tests/sources-parity-v1117.test.mjs tests/parity-routes-v1117.test.mjs
node --test tests/adapter-registry.test.mjs tests/scan-sources-endpoint.test.mjs   # 45 EN / 50 total
node --test tests/i18n-locale-files.test.mjs tests/i18n-coverage.test.mjs          # 41 new keys ×16
```

## §1 — Verify (en + ru + one CJK + ar)
1. **Cadence board (`#/followup`):** with the parent present, the page opens with urgency chips (🔴🟠🟡🔵) + a table (#, company, role, status, urgency, days-to-next). **Seed follow-up dates** appends pin directives to `data/follow-ups.md` (explicit write — use a disposable parent for testing) and refreshes. Without the parent scripts → an honest "not available" note, Seed disabled.
2. **Rejection patterns (`#/stats` 4th tab):** outcome chips, recommendations list, ATS-vendor table with advance rates (sub-sample vendors starred + the FAccT 2026 citation), archetype bar chart. Without the parent → honest empty state.
3. **Add to CV (`#/cv-studio`):** paste ~80+ chars of project text → grounded bullets (live) or a ready-to-run prompt (no key). A URL is fetched ONLY if it passes the SSRF gate — `http://127.0.0.1/…`, `file://…`, `javascript:` all → 400. **`cv.md` is never modified** by this card.
4. **4 new providers:** the `#/scan` Source dropdown lists **50** entries incl. beesite (GJB), HigherEdJobs, JibeApply (iCIMS), softgarden; `GET /api/scan/sources` returns 45 EN values incl. the four.
5. **Knock-out pre-scan:** `#/apply` checklist step 2 tells you to scan for visa/degree/salary/on-site/clearance disqualifiers and flag `⚠️ KNOCK-OUT WARNING` before drafting.
6. **Reconcile:** `POST /api/run/reconcile` exists (structured result, not 404); with the parent present it runs `reconcile-pipeline.mjs`.
7. **i18n:** the cadence board, patterns tab, and Add-to-CV card re-localize in all 16 locales (41 new keys; no raw `fu.*`/`stats.pat*`/`cvs.add*` leaks). Arabic RTL intact.

## §2 — Invariants
- Shell-out routes are fail-soft (never 500 on a missing parent); parent files are written ONLY by the explicit Seed action; add-entry performs no writes at all; URL fetches go through `isValidJobUrl` + `safeGet`; CSP untouched.

## §3 — Sign-off
All §0 gates green · all six capabilities behave per §1 (live AND degraded modes) · SSRF gate rejects loopback/file/js URLs · cv.md untouched by add-entry · 50 sources in the dropdown · 16-locale re-localization · zero console errors.
