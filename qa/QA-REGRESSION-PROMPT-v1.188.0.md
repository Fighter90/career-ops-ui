# QA REGRESSION PROMPT — career-ops-ui **v1.188.0** (lead-button top margin)

**Fixed (UI).** The primary action button no longer sits flush against the page subtitle. Five views render a lead control row directly under the subtitle; `.page-subtitle` carries only a **top** margin, so those rows had a zero top gap and the button butted against the subtitle text (user-reported on `#/interview-digest`). Each lead row now has `margin: '16px 0'`.

- **Under test:** `package.json` **1.188.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # 2497, exit 0 (capture $? directly, never | grep)
node --test tests/lead-row-top-margin.test.mjs
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.188.0
```

## §1 — Change

- **Views touched (5):** `interview-digest.js`, `funded.js`, `portals.js`, `career-plan.js`, `orientation.js` — the lead control row appended right after the `page-subtitle` changed `margin: '0 0 16px'` → `margin: '16px 0'` (adds a 16px top margin; keeps the 16px bottom). No behavioural / logic change — spacing only.
- **Not touched (verified not the same pattern):** internal card / paragraph `margin: '0 0 …'` rules (e.g. funded.js:99 stacked result cards) are correct top-0 stacking; `#/stats` market controls (separated from the subtitle by the `.tabs` bar); `#/docs-assistant` (lead element is a chat-log, control row lives at the bottom).

## §2 — Manual check

- Open **`#/interview-digest`**, **`#/funded`**, **`#/portals`**, **`#/career-plan`**, **`#/orientation`** — the primary button / control row has clear breathing room below the page subtitle (≈16px), not glued to it.
- Nothing below shifts unexpectedly: the results area under each lead row keeps its spacing.
- Dark mode + RTL (Arabic) render identically — the change is a symmetric top/bottom margin, no directional properties.

## §3 — Sign-off

Suite **2497** green (+5: lead-row top-margin guard over the 5 views) · CHANGELOG parity ×17 at v1.188.0 · README badge+banner ×17 · **fix verified via headless screenshot of `#/interview-digest`** (button now spaced below the subtitle).
