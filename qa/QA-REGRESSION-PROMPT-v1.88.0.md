# QA REGRESSION PROMPT — career-ops-ui **v1.88.0** (issue #29 polish: Scan i18n + API hygiene)

Delta-focused regression for the two remaining web-appropriate items from the issue-#29 roadmap (v1.69.4 i18n gaps + v1.69.5 API hygiene). Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.88.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite (≥1598 cases)
node --test tests/scan-i18n-gaps.test.mjs   # source guard + all-locale key presence
node --test tests/security-headers.test.mjs # incl. X-Powered-By absence
node tools/i18n-audit.mjs                    # clean (4 new scan.* keys ×16)
node scripts/check-changelog-parity.mjs      # all 15 locales at v1.88.0
```

## §1 — What changed

1. **Scan i18n gaps closed** — 4 new keys in all 16 locales: `scan.pillNew` ("new"), `scan.pillMatching` ("matching"), `scan.newOffers` ("new offers"), `scan.relocBadge` ("reloc"). Manually: run a scan in a non-English locale — the source-summary pills (`N new / M matching`), the `N new offers` toast, and the row **reloc** badge must all read in-language, not English. Source guard: `public/js/views/scan.js` calls `t('scan.…')` for each; no hardcoded literals remain.
2. **X-Powered-By disabled** — `app.disable('x-powered-by')` in `createApp()`. Manually: `curl -sI http://127.0.0.1:4317/api/health | grep -i x-powered-by` → **no output**.

## §2 — Already-shipped (verified, NOT part of this release)

The rest of issue-#29's v1.69.x polish was already implemented before v1.88.0 and must stay green: `parentVersion` strips its release-please comment (`/api/health` → clean semver), the **light-mode theme toggle** (`public/js/lib/theme-bootstrap.js` + `tests/playwright-theme-toggle-i18n.mjs`), **modal-dismiss-on-route-change** (`app.js`), and the Reports **"Score"** localization (`rep.score`). `#/portals` intentionally remains an alias to `#/config` (P2).

## §3 — Sign-off

All §0 gates green · scan pills/toasts/badge render in-language across locales · `X-Powered-By` absent · no regression in the already-shipped #29 items.
