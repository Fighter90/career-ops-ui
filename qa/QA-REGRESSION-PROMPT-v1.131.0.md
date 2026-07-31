# QA Regression Prompt — v1.131.0 (#/tracker CRM stage-tab board)

> Minor release. Ports the parent web app's `/pipeline` view to `#/tracker`.
> Baseline: v1.130.0 (all green, 2123).

## What changed

- **Stage-tab strip** on `#/tracker` — replaces the v1.55.8 funnel-chip bar +
  the status `<select>`. An **All** tab plus one tab per canonical status
  (Evaluated · Applied · Responded · Interview · Offer · Rejected · Discarded ·
  SKIP · Hired), each with a live whole-history count **including zero-count
  stages** (full-funnel CRM look). Active tab drives the filter; clicking the
  active tab returns to All. Score filter + search + sortable columns + report /
  PDF / legitimacy + Hired banner + Normalize/Dedup/Merge are all unchanged.
- **`GET /api/tracker/stages`** (new, read-only) — `{ stages: [labels…],
  aliases: { key: label } }` from `server/lib/states.mjs` (`templates/states.yml`
  + fallback). Client never hardcodes the whitelist. The legacy no-param
  `GET /api/tracker` response is unchanged (`{ rows }` only).
- **`public/js/lib/tracker-stages.js`** (`window.TrackerStages`) — pure
  `foldStatus` / `stageCounts`, unit-tested; folds localized/legacy aliases and
  stray markdown bold.
- Rows show a **brand logo** when logos are enabled (off by default → zero extra
  requests). Tabs are accessible (role=tablist/tab, aria-selected, ≥44 px, counts
  in the accessible name, focus restored on switch). **No new i18n keys.**
- +10 tests → **2133**.

## Sign-off checklist

- [ ] `npm test` — **2133** green (capture `$?` directly, never `| grep`).
- [ ] `node --test tests/tracker-stages.test.mjs tests/tracker-stages-endpoint.test.mjs` — 6 + 4.
- [ ] `node --test tests/tracker-server-paged.test.mjs` — the stage-tab static-source test passes (`.tracker-tabs`, role=tablist, `TrackerStages.stageCounts`, CSS `.tracker-tab.is-active`).
- [ ] Manual: `GET /api/tracker/stages` → `{ stages, aliases }`, stages in canonical order, `aliases.aplicado === 'Applied'`.
- [ ] Manual: `GET /api/tracker` (no params) → exactly `{ rows }` (no `stages`, no `funnel`).
- [ ] Manual on `#/tracker`: the stage-tab strip shows **All** + every canonical stage with counts (incl. zero-count stages); clicking a stage filters the table; clicking it again returns to All; keyboard focus stays on the active tab.
- [ ] Manual: enable logos in settings → tracker company cells show a brand mark; disabled → plain name, no `/api/logo` requests.
- [ ] A11y: each tab's accessible name includes its count (e.g. "Applied — 5"); tablist labelled; ≥44 px hit area.
- [ ] Help H2/H3 unchanged (29/105); §11 Tracker describes the stage-tab board (prose, no new heading).
- [ ] CHANGELOG parity ×17 at 1.131.0; README banner ×17; tests badge 2133 ×17.
- [ ] `/api/health` → `version 1.131.0`, `parentVersion 1.24.0`.
