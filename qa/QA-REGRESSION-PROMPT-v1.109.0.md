# QA REGRESSION PROMPT — career-ops-ui **v1.109.0** (scan Exclude + pipeline overview)

Delta regression for the scan filter pair + pipeline overview. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.109.0**.

## §0 — Gates

```bash
npm test                                       # full suite (scan-pipeline-ui-v1109 ×2)
node --test tests/scan-pipeline-ui-v1109.test.mjs tests/scan-prefs.test.mjs
node --test tests/i18n-coverage.test.mjs       # 4 new keys ×16
node scripts/check-changelog-parity.mjs         # all 15 locales at v1.109.0
```

## §1 — What changed (additive, client-only)

- **`#/scan` Search** treats commas as **OR** ("roles to find") — `backend, platform` shows rows matching either.
- **`#/scan` Exclude** (new field) hides any row whose company/role/location contains a comma-separated term — `senior, staff`.
- Both persist in **saved searches** (Save → apply restores them) and clear on **Reset**.
- **`#/pipeline`** shows an overview strip: **N in inbox · N tracked · Applied N · Responded N · Interview N · Offer N** — each chip links to `#/tracker`.

## §2 — Sanity

- On scan results: `Exclude: senior` hides senior roles; a comma list ORs the search. Save the search, reload, apply → both fields restore.
- On the pipeline page with some tracker rows: the strip shows correct counts; clicking a status chip opens `#/tracker`. With an empty tracker it shows `0 in inbox · 0 tracked` and doesn't error.
- Switch locale → the Exclude label/placeholder and the `in inbox` / `tracked` chips read in-language (Arabic RTL).

## §3 — Sign-off

All §0 gates green · Exclude + comma-OR filter correctly and survive saved searches · pipeline overview shows correct counts and links · 4 keys ×16 · client-only, no writes.
