# QA REGRESSION PROMPT — career-ops-ui **v1.95.0** (Epic 26: Career plan)

Delta regression for the `#/career-plan` page. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.95.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                     # full suite (≥1647 cases; new: career-plan-routes ×4)
node --test tests/career-plan-routes.test.mjs # bounding + GET/PUT round-trip + horizon-aware CV/profile-seeded prompt
node --test tests/i18n-coverage.test.mjs     # 20 new keys ×16 locales, zero missing
node tools/i18n-audit.mjs                     # clean
node scripts/check-changelog-parity.mjs       # all 15 locales at v1.95.0
```

## §1 — What changed

New **`#/career-plan`** page (nav: **Growth → Career plan** 🧭).

1. **Generate.** Pick a **Horizon** (6/12/24 months), optional **Focus**, click **Generate plan** → `POST /api/career-plan/generate`. Live (with a key) returns a Markdown plan; no key → a copy-paste prompt (mode `manual`). The plan is built from the user's own CV + profile + two-pager + memory (`bundleProjectContext`) and covers: starting point, SWOT, SMART/OKR/WOOP goals, alternative trajectories, hard/soft skill plan, a **month-by-month roadmap** for the chosen horizon, tracking, pitfalls, support. It plans forward and never fabricates the user's history.
2. **Edit + Save.** The plan lands in an editable textarea; **Save plan** → `PUT /api/career-plan` writes `config/career-plan.md` (user layer). **Preview** renders the Markdown.
3. **Export.** Download .md / Save as PDF / Copy (shared `report-export.js`).

## §2 — Contract & security invariants

- **Grounded, forward-looking.** Recommendations come from the user's materials; the prompt forbids inventing employers/titles/achievements. It's a plan (guidance), not a claim about history.
- **One write.** Only `PUT /api/career-plan` writes (`config/career-plan.md`); `GET`/`generate` never write.
- **Bounded.** `normalizePlan` caps at 128 KB; `normalizeHorizon` whitelists 6/12/24 (default 12); focus capped at 400 chars + newline-stripped.
- **Rate-limited.** `POST /api/career-plan/generate` carries `llmRateLimit`. `PUT` is a plain user-layer write (the recurring CodeQL `js/missing-rate-limiting` + `js/http-to-file-access` FPs may flag the PUT — dismiss post-merge per the documented pattern).
- **CSP-safe.** `UI.el` + `addEventListener`; `UI.md()` render boundary; Blob download.

## §3 — i18n

20 new keys (`plan.*` + `nav.careerPlan` + `nav.group.growth`) present + translated in all **16** locales. Switch locale: nav group + item, horizon options, buttons, privacy note read in-language. Arabic RTL.

## §4 — Sign-off

All §0 gates green · plan generates (or manual prompt with no key) seeded from your CV/profile with the chosen horizon in the roadmap · Save round-trips to `config/career-plan.md` · Preview renders · Download .md / Save as PDF / Copy work · 20 keys ×16 · grounded-not-fabricated / one-write / CSP invariants intact.
