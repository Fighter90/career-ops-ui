# UX Roadmap — readability, clarity, insight, polish

Consolidated from user feedback (2026-08-11). Executed as a sequence of focused releases; each ships fully (code + tests + docs ×17 + site + wiki) before the next starts.

## Phase 1 — v1.137.0 "Readability" ✅ (shipping)

Fix what's outright unreadable/broken.

- [x] **Dark-mode contrast** — white-on-white / black-on-black across `#/pipeline`, `#/stats` tabs, `#/config`, `#/two-pager`, `#/mock-interview`, `✓ set` / error text. Root cause: 15 CSS tokens (`--fg`, `--panel`, `--panel-2`, `--line`, `--surface-elev1`, `--ok`, `--err`, `--danger`, `--warn`, `--muted`, `--ink`, `--card`, `--border`, `--go`, `--error`) were never declared → fell back to hardcoded light/black. Now aliased to theme-aware tokens. **0 WCAG-AA failures** verified across 29 views by an automated contrast auditor. Regression guard added.
- [x] **Chart labels** hard-cut mid-word → ellipsis + full-text tooltip, wider column.
- [x] **Career plan** rendered raw Markdown → auto-renders formatted, readable text.
- [x] **Config active tab** low-contrast pink pill → readable tinted-badge pattern.

## Phase 2 — v1.138.0 "Understandable"

Make every page self-explanatory, in every language.

- [ ] Reusable **`?` help-hint** component (CSP-safe popover, accessible, RTL) on every view header + the 5 `#/stats` tabs — click `?` → localized description (the "Rejection patterns (?)" pattern).
- [ ] **Page descriptions** — one-line "what this does / how to use it / what result to expect" on every view, prominent in empty states.
- [ ] **Clearer empty states** — `#/career-plan`, weekly digest, `#/stats`, `#/funded` explain how to populate them instead of looking broken.
- [ ] **Generation language** — every AI generation (career-plan, market report, orientation, networking, two-pager draft, cv-studio, memory suggest, mock-interview) outputs in the selected UI language; thread `lang` into each endpoint + a `# Output language` system-prompt directive.
- [ ] i18n fan-out ×17 for all new strings.

## Phase 3 — v1.139.0 "Insightful stats"

Make the numbers correct, detailed, and visual.

- [ ] **Richer salary stats** — min / max / **average** (not just median), **monthly + yearly**, per country/role.
- [ ] **Interactive, rebuildable charts** on `#/stats` (choose metric/dimension/period, re-render).
- [ ] **Correctness** — fix the "Unknown" archetype bucketing so recommendations aren't nonsensical ("double down on Unknown").
- [ ] **Funded companies** enrichment — company description, logo, salary range, open vacancies, visualization.

## Phase 4 — v1.140.0 "Settings & filters"

Consolidate configuration; make filters beautiful.

- [ ] **Portals → Settings** — move `#/portals` into the settings area; enable/disable each portal; sync the enabled set with the source list, the `#/scan` filter selects, and what actually gets scanned.
- [ ] **Scan filters redesign** — cleaner, more readable, more attractive filter panel.
- [ ] **Overall visual polish** — senior-designer pass on spacing, hierarchy, and consistency across all pages.

---

*Each phase updates docs (help ×17, README ×17, CHANGELOG ×17, CONVENTIONS, architecture), the cvstart.org site, and the wiki, and is browser-verified across all 17 locales before ship.*
