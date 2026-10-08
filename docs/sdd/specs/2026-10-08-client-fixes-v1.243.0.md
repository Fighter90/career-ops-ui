# SPEC — v1.243.0 client fixes (Phase 3)

- **Status:** In progress
- **Release:** v1.243.0
- **Related:** PLAN.md release 4 · Linear CAR-18…CAR-24, CAR-36…CAR-43 · 2026-10-06 review (SPA views ×3, client libs ×2, CSS/a11y, i18n) · v1.242.1 QA regression findings
- **Owner:** maintainer

## Goal

The browser layer keeps the user's work safe and speaks the user's language: no
unsaved-edit losses, no silent failures, no English leftovers in non-English UIs,
AA contrast everywhere, and every regression finding from the two-stand QA round
closed.

## Context

The 2026-10-06 review verified client defects (views ×3, libs ×2, CSS/a11y, i18n
slices), and the v1.242.1 two-stand regression added real-world ones: the
"Record outcome" modal survives hash navigation and blocks the next view (HIGH);
`cv-diagnostics.js` renders 16 hard-coded English strings in every locale; the
SPA fallback answers 200 with the index shell for missing assets; the docs FAB
overlaps content on narrow viewports; help TOC anchors push no history.

## Scope

8 disjoint file-group agents (same pattern as Phase 2), red → green:

1. router + client-libs-1 (skip-link [H], API.stream double-error, bug-report
   privacy, countries longest-match, cv-privacy, fit-score OR-semantics, listener leaks)
2. client-libs-2 (skills `\b`→Unicode boundaries [H], one shared salary parser,
   pdf-generate terminal states, scan-results in-place updates, score-tone, modes-form,
   report-export)
3. views-1 (cv.js unsaved-edit preservation [H], dashboard refresh, config listener
   leak, load-failure guards that stop Save-overwrites, auto.js paid-run confirm)
4. views-2 (memory/evaluate-warnings/mock-interview/pipeline/health/funded/portals a11y)
5. views-3 + CAR-36 modal teardown on navigation [H] + CAR-41 map stats + CAR-42 help TOC history
6. css-a11y (toast contrast [H] + contrast contract tests, sticky-banner stack, RTL
   breakpoints, drawer focus/Escape, scroll-padding, index.html landmarks, --rausch AA,
   CAR-43 docs-FAB overlap)
7. i18n (detect `da`, zh-TW mapping, cv-diagnostics i18n ×17 [CAR-37], field-specs 26
   keys, dead keys, facts fixes in hermesHint/needKey lists, LOCALIZATION.md)
8. server-lite (CAR-39 SPA fallback 404 for missing assets, CAR-40 /api/runners index)

## Out of scope

- `#/scan` full redesign (Phase 4 / v1.244.0) — only the finding-level scan fixes here.
- Tamil locale (v1.245.0), upstream ports (v1.246.0).
- Hermes upstream credits (CAR-44 — operator action, not code).

## Acceptance criteria

1. All findings above closed with red → green tests; no new user-visible strings
   outside the i18n agent; dict keys ×17 with real translations (i18n audit green).
2. `npm run test:ci` (unit ≥ 4812 + new), `npm run test:e2e:browser` (≥ 118 + new
   modal/navigation tests), `node evals/workflow/run.mjs`, coverage gate — all green.
3. High-severity browser checks pass on the built app: modal gone after navigation;
   `GET /app.js` → 404; toast contrast ≥ 4.5:1 in dark; `da-DK` browser → Danish UI.
4. Docs train: CHANGELOG ×17, README lead ×17, QA prompt v1.243.0, PROJECT-CONTEXT,
   PROGRESS, spec Verification filled with real output, wiki refresh.

## Verification

_(filled with real output at integration)_
