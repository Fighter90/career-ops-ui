# QA REGRESSION PROMPT — career-ops-ui **v1.142.0** (no more "Unknown" archetype)

User-reported correctness fix (no parent-sync). `#/orientation` now always ranks from the eight named career vectors instead of occasionally answering "Unknown". Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.142.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # full suite — 2364, exit 0 (capture $? directly, never | grep)
node --test tests/orientation-routes.test.mjs  # prompt names the 8 vectors + forbids "Unknown"
node scripts/check-changelog-parity.mjs        # all 16 locales at v1.142.0
```

## §1 — What changed (server prompt only; no i18n/schema change)

- `server/lib/routes/orientation.mjs::buildOrientationPrompt` (the `INSTRUCTIONS` block) now tells the model it MUST rank the top-3 from **exactly** the eight named vectors (Functionalist / Administrator / Communicator / Specialist / Analyst / Innovator / Manager / Entrepreneur) and may **never** answer "Unknown" / "N/A" / "insufficient data" or invent a label. A thin CV still gets the three closest at lower confidence with the missing evidence named.
- No client, i18n, or schema change. The generated profile stays localized via the existing output-language directive.

## §2 — Manual browser pass (needs a provider key for a live run)

1. **`#/orientation` → Generate** — with CV/profile present, the "Best-fit career vectors" section names three of the eight vectors with evidence — **never "Unknown"** and never advice to "double down" on a non-vector.
2. **Thin-CV case** — with a minimal CV, it should still pick the three closest vectors (lower confidence + "evidence missing" notes), not decline.
3. **No-key case** — the copy-paste prompt shown contains the eight vectors + the "never answer Unknown / do not decline to choose" constraint.
4. **Localization unchanged** — in a non-EN locale the profile is still generated in that language.

## §3 — Invariants

- **Reflection framing intact** — still "NOT a psychometric test", no fabricated measured scores.
- **English-by-policy prompt** — the constraint is in the server prompt (English); only the OUTPUT localizes. No new i18n keys, snapshot unchanged.
- **No new route / no writes** — `POST /api/orientation/generate` unchanged besides the prompt text.

## §4 — Not in this release (see `docs/UX-ROADMAP.md`)

Interactive/rebuildable charts on `#/stats` (Phase 3). `?`-hint next wave (remaining view headers). Portals→settings + filter redesign → **Phase 4 / v1.144.0**. Nous Research / Hermes → Phase 5 / 5b.

## §5 — Sign-off

Suite **2364** green · orientation prompt names the 8 vectors + forbids "Unknown"/"N/A" · reflection framing intact · output still localized · no i18n/schema change · CHANGELOG parity ×17.
