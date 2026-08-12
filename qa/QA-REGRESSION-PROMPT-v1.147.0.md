# QA REGRESSION PROMPT — career-ops-ui **v1.147.0** (Hermes help §30 + site surface)

Docs-only, no runtime code (no parent-sync). Phase 5b, **part 2 (final)**: the Hermes cloud-deploy + Telegram-bridge how-to becomes an in-app help section (§30) in all 17 languages, the docs assistant auto-grounds on it, and cvstart.org gets a footer deep-link. The Hermes **LLM-provider** path stays **planned / not-yet-wired**. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.147.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                         # full suite — 2378, exit 0 (capture $? directly, never | grep)
node --test tests/help-hermes-section.test.mjs   # §30 present + anchors, every locale (2 tests)
node --test tests/canonical-docs-coverage.test.mjs tests/help-ui.test.mjs tests/help-ru-config-section.test.mjs  # 30 H2 / 108 H3 gate
node scripts/check-changelog-parity.mjs          # all 16 non-EN locales at v1.147.0
node tools/i18n-audit.mjs                         # app dict clean (no NEW app i18n keys; snapshot unchanged 1208)
```

## §1 — What changed (docs + site only; ZERO server/route/app-i18n-dict change)

- **In-app help §30 "Hermes & Telegram" × 17** — appended to `docs/help/<lang>.md` for all 17 locales: an H2 intro + **3 H3s** (what Hermes is + the two integration shapes; running on a cloud server; Telegram via Hermes + "what NOT to expose"). Honest: it says a **plan, not a shipped feature**, provider not yet wired.
- **Help-bundle gate lifted 29 → 30 H2 / 105 → 108 H3** in `canonical-docs-coverage.test.mjs`, `help-ui.test.mjs`, `help-ru-config-section.test.mjs`.
- **`docs-assistant` / `DocsFab` auto-grounding** — both read `docs/help/<lang>.md`, so the floating "Ask the docs" assistant now answers Hermes/Telegram/cloud-deploy questions from §30. No code change.
- **cvstart.org footer deep-link** — `footer.hermes` (×17 site i18n) → a Resources link to `…/blob/main/docs/integrations/HERMES.md`. The `/help` pages auto-render §30 ×17 at build.
- README badge + banner ×17 → v1.147.0 / 2378. CHANGELOG ×17. New canary `tests/help-hermes-section.test.mjs` (+2).

## §2 — Manual pass

1. **`#/help`** (EN + a non-EN, e.g. RU/AR) — scroll to **§30 "Hermes & Telegram"**; it renders with 3 subsections, names `docs/integrations/HERMES.md` + `hermes-bridge` + `#/help`, and clearly says planned / not-yet-wired.
2. **"Ask the docs" (DocsFab)** — open the floating assistant on any page; ask "How do I connect career-ops to Telegram?" → it answers from §30 (grounded), not a hallucination, in the UI language.
3. **cvstart.org** (after Pages build) — the Resources footer shows the Hermes guide link → opens the GitHub `HERMES.md`; the `/help` page carries §30 in each locale.
4. **Honesty** — `grep -ri 'hermes\|nous' server/` still returns **nothing**; no help text implies Hermes is a live provider.

## §3 — Invariants

- **No runtime code changed** — no route, no `server/lib/**`, no `public/js/**` edit; `llm-dispatch.mjs` still has no Hermes/Nous branch.
- **No new app i18n keys** — the app dict snapshot stays 1208 (help is markdown; the only new key is the site's `footer.hermes`).
- **Help parity** — every locale bundle is 30 H2 / 108 H3; §30 present in each (canary).
- **CHANGELOG parity** — 17 locales, newest `## [1.147.0]`.

## §4 — Not in this release

- **Phase 5 (blocked):** the actual Hermes/Nous **LLM-provider** integration — needs the API-contract spike (base URL, auth, OpenAI-compatibility, model ids, streaming, tool-calling) confirmed first. This release does not touch it.

## §5 — Sign-off

Suite **2378** green · help canary 2/2 · 30 H2 / 108 H3 in all 17 bundles · §30 renders on `#/help` + DocsFab answers from it · cvstart.org footer link + /help §30 ×17 · no server Hermes branch · CHANGELOG parity ×17 · app i18n snapshot 1208. **Closes Phase 5b (docs + skill).**
