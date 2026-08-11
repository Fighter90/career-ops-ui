# QA REGRESSION PROMPT — career-ops-ui **v1.139.0** (Understandable: `?` help hints)

User-reported UX pass (no parent-sync). A reusable `?` affordance that explains "what this does / how it works / what to expect" on demand, in the UI language. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.139.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # full suite — 2360, exit 0 (capture $? directly, never | grep)
node --test tests/help-hint.test.mjs           # HelpHint is CSP-safe, wired, EN-present
node tools/i18n-audit.mjs                       # dictionary clean (no missing/empty/dup/latin-leak)
node --test tests/i18n-coverage.test.mjs tests/i18n-locale-files.test.mjs   # 17-locale parity + snapshot
node scripts/check-changelog-parity.mjs        # all 16 locales at v1.139.0
```

## §1 — What changed

- **New client primitive** `public/js/lib/help-hint.js` (`window.HelpHint`): `HelpHint.icon(key)` → a round `?` button; `HelpHint.title(text, key)` → an `<h1 class="page-title">` with a trailing `?`. Clicking opens a popover rendering `I18n.t(key)` via `UI.md()`. CSS in `public/css/components.css` (`.help-hint`, `.help-pop`). Loaded from `index.html` before the views.
- **Wired:** the 5 `#/stats` tabs (active-tab caption) + 8 view titles (career-plan, orientation, two-pager, networking, mock-interview, memory, funded, interview-digest).
- **14 new i18n keys × 17 locales** (`help.hint.*` + `stats.hint.*`); assembled-dict snapshot regenerated (1161→1175).

## §2 — Manual browser pass (do it in at least EN + one RTL/non-Latin locale, e.g. العربية or Русский)

1. **`#/stats`** — under the tab strip a caption shows the active tab name + a `?`. Click `?` → a popover explains that tab; switch tabs → caption + hint update. Press **Escape** → closes, focus returns to the `?`. Click outside → closes.
2. **`#/career-plan`** (and orientation / two-pager / networking / mock-interview / memory / funded / interview-digest) — the page `<h1>` has an inline `?`; clicking it explains the page. Works even when the page is empty (no plan generated / no sessions).
3. **Localization** — switch UI language to Русский: the popover body is in Russian (not English). Switch to العربية: the chrome mirrors RTL and the popover reads right-to-left; the `?` sits on the correct side.
4. **Theme** — toggle dark mode: the popover uses `--paper`/`--line`/`--ink` (readable, not white-on-white); the `?` hover/active fills with the accent.
5. **No console errors** across the above.

## §3 — Invariants

- **CSP intact** — no inline handlers; the popover body is `UI.md()`-escaped (feed a `key` whose value contains `<script>` mentally — it renders inert). `?` glyph is a static text child.
- **A11y** — `?` is a real `<button>` with `aria-label` + `aria-expanded`; popover is `role="tooltip"`; Escape/outside-click close; focus restored.
- **i18n parity** — 17 locales, no missing/empty/dup keys; non-Latin locales carry native script (loanwords like `career-ops`/`ATS`/`STAR+R`/code-spans are allowed, and none of the new keys are `*.title` so the latin-leak gate is not in scope).
- **No source-count / help-guide change** — `#/scan` still 79 sources; help ×17 untouched.

## §4 — Not in this release (see `docs/UX-ROADMAP.md`)

`?` on the remaining view headers (config, scan, tracker, cv-studio, apply, …) is the **next wave**. Richer salary stats + interactive charts + Unknown-archetype fix + funded enrichment → **Phase 3 / v1.140.0**. Portals→settings + filter redesign → **Phase 4 / v1.141.0**. Nous Research / Hermes provider + cloud/Telegram guide + Hermes skill → **Phase 5 / 5b**.

## §5 — Sign-off

Suite **2360** green · `?` opens/closes/toggles on stats tabs + 8 view titles · localized body in non-EN locale · RTL mirrored · dark-mode readable · 0 console errors · i18n 17/17 parity · CHANGELOG parity ×17.
