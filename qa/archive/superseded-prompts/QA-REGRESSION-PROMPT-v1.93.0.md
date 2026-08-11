# QA REGRESSION PROMPT — career-ops-ui **v1.93.0** (Epic 24: Memory layer)

Delta-focused regression for the memory layer. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.93.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                     # full suite (≥1639 cases; new: memory-routes)
node --test tests/memory-routes.test.mjs     # normalizeMemory + GET/PUT round-trip + suggest + bundleProjectContext inlining
node --test tests/i18n-coverage.test.mjs     # 11 new keys ×16 locales, zero missing
node tools/i18n-audit.mjs                     # clean
node scripts/check-changelog-parity.mjs       # all 15 locales at v1.93.0
```

## §1 — What changed

1. **New `#/memory` page** (nav: Setup → Memory 🧠). A textarea holds a short "remember about me" note. **Save memory** → `PUT /api/memory` → writes `config/memory.md` in the **parent** user layer (new `PATHS.memory`). Reload: the note round-trips.
2. **Reaches every AI request.** `config/memory.md` is inlined into `bundleProjectContext` — so after saving, the note appears in **every** prompt that uses that bundle: `/api/evaluate`, `/api/deep`, `/api/mode/*`, `/api/two-pager/draft`, `/api/mock-interview/turn`, `/api/networking/plan`. Verified by `tests/memory-routes.test.mjs::"the saved memory is inlined into bundleProjectContext"`. Manually: save a distinctive line, then hit any live-prompt endpoint in manual mode and confirm the line is in the returned `prompt`.
3. **Suggest from data.** `POST /api/memory/suggest` reads `data/applications.md`, and returns a draft prompt instructing the model to propose **behavioural/preference** bullets (never facts). 400 if the tracker is empty. No live call is made here.

## §2 — Contract & security invariants

- **Steering, not content.** Per DATA_CONTRACT the memory note is behavioural steering only — the bundle label explicitly says "NOT new factual claims". Facts for CV/cover output still come only from `cv.md` / profile / two-pager. The suggest prompt forbids inventing skills/employers/achievements.
- **One write.** `PUT /api/memory` is the only writer (into the user layer). `GET`/`suggest` never write.
- **Bounded.** `normalizeMemory` caps the note at 8 KB and coerces non-strings to `''`. The suggest miner caps the tracker slice at 24 KB.
- **CSP-safe view.** `memory.js` uses `addEventListener` + `UI.el`; the suggest prompt renders into a `readonly` textarea.
- **CodeQL** `js/missing-rate-limiting` on `PUT`/`suggest` (suggest has `llmRateLimit`) is the known false positive if flagged — dismiss post-merge.

## §3 — i18n

11 new keys (`nav.memory`, `mem.*`) present + translated in all **16** locales. Switch locale: nav item, page copy, buttons, privacy note read in-language. The `mem.ph` placeholder keeps its literal `\n` newlines in every locale. Arabic RTL.

## §4 — Sign-off

All §0 gates green · note saves + round-trips to `config/memory.md` · the saved note shows up in downstream AI prompts across providers · suggest drafts behavioural bullets from the tracker (no fabrication) · 11 keys ×16 locales · steering-not-facts / one-write / CSP invariants intact.
