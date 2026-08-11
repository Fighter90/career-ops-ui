# QA REGRESSION PROMPT — career-ops-ui **v1.138.0** (generation in your language)

User-reported UX pass (no parent-sync). Every AI generation answers in the selected UI language, plus review-driven test hardening. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.138.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # full suite — 2356, exit 0 (capture $? directly, never | grep)
node --test tests/css-role-tokens.test.mjs     # text-role tokens never a background; surface-role never a text color
node --test tests/ui-md-xss.test.mjs           # UI.md escape-first boundary + loader self-probe
node --test tests/memory-routes.test.mjs tests/two-pager-routes.test.mjs   # locale directive threaded
node scripts/check-changelog-parity.mjs        # all 16 locales at v1.138.0
```

## §1 — What changed

- **Generation now follows the UI language.** The output-language directive (`resolveLocale(req)` + `buildLocaleDirective(lang)`) is threaded through **all 8** AI-generation endpoints — career-plan, orientation, market, mock-interview, networking, docs-assistant, **memory/suggest** (newly added), **two-pager/draft** (newly added) — and the client sends the active `lang` on **all 8** generate POSTs (mock-interview, docs-assistant, networking, two-pager, memory were the five that previously didn't). Code + identifiers (e.g. two-pager YAML **keys**) stay English; only prose is localized.
- **Review hardening (test-only + 1-line guard):** `tests/css-role-tokens.test.mjs` (colour-role inversion canary), a `UI.md()` XSS-loader self-probe in `tests/helpers/ui-md.mjs`, and a `#/career-plan` `scrollIntoView` `isConnected` guard.

## §2 — Manual browser pass (switch UI language to **Русский** or **日本語** first)

1. **`#/career-plan`** → Generate — with a provider key, the plan comes back **in the selected language** (headings/prose), not English. No raw Markdown (still renders formatted). Without a key, the copy-paste prompt carries a `# Output language` block.
2. **`#/orientation`**, **`#/stats` → Market report** — generated report is in the UI language.
3. **`#/mock-interview`** → Start — the interviewer's question/feedback is in the UI language.
4. **`#/networking`** → Build plan — the dossier/outreach drafts are in the UI language.
5. **`#/two-pager`** → ✨ AI fill — drafted prose (loves/must-haves/…) is localized; the form still auto-fills (YAML keys unchanged, so the parse works).
6. **`#/memory`** → Suggest — the copy-paste prompt opens with the `# Output language` directive for the selected locale.
7. **`#/docs-assistant`** (and the floating "Ask the docs" robot) — answers come in the UI language (still grounded only in the help guide).
8. **Switch back to English** — every generation returns to English; no stray `# Output language` block in the en prompts.

## §3 — Invariants

- **No new i18n keys** — help ×17 untouched; `#/scan` Source filter unchanged (still 79 sources). Only CHANGELOG/README/doc prose changed ×17.
- **XSS boundary intact** — all LLM markdown still renders via `UI.md()` (escape-first); the loader self-probe throws if a future `api.js` edit mis-slices the extraction.
- **Colour roles intact** — no text-role token used as a `background`, no surface-role token used as a text `color` (dark-mode contrast from v1.137.0 preserved; the canary makes it machine-checkable).
- **Parent boundary / CSP / SSRF / secrets** — nothing outside `web-ui/`; no inline handlers; no user-URL fetch; no secrets. `lang` is a bounded locale code, not free text into the prompt.

## §4 — Not in this release (see `docs/UX-ROADMAP.md`)

`?`-help hints + page descriptions ×17 + clearer empty states (**Phase 2 → v1.139.0**); richer salary stats + interactive charts + Unknown-archetype fix + funded enrichment (Phase 3 → v1.140.0); portals→settings + filter redesign (Phase 4 → v1.141.0); Nous Research / Hermes provider + cloud/Telegram deploy guide + Hermes skill (**Phase 5 / 5b**).

## §5 — Sign-off

Suite **2356** green · generation output follows the UI locale across all 8 endpoints · two-pager YAML keys stay English (auto-fill works) · en unchanged (no stray directive) · colour-role canary green · `UI.md()` self-probe green · CHANGELOG parity ×17.
