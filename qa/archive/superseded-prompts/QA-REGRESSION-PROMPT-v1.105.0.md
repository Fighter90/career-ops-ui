# QA REGRESSION PROMPT — career-ops-ui **v1.105.0** (AI usage & cost page)

Delta regression for the LLM usage recorder + `#/usage` page. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.105.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # full suite (usage-routes ×5)
node --test tests/usage-routes.test.mjs        # normalize/price/record-round-trip/aggregate/endpoint
node --test tests/i18n-coverage.test.mjs       # 17 new usage.*/nav.usage keys ×16, zero missing
node --test tests/help-ui.test.mjs             # 28 H2 per bundle (unchanged)
node scripts/check-changelog-parity.mjs         # all 15 locales at v1.105.0
```

## §1 — What changed

New **AI usage** page (nav: next to **Health** 💳, `#/usage`).

1. Run any **live** AI generation (evaluate / report / chat with a provider key set). Each call appends `{ts, provider, in, out}` to `data/llm-usage.jsonl`.
2. Open `#/usage` → per-provider **calls / input tokens / output tokens / est. cost** over **24h / 7d / 30d / all-time** tabs, with a total row. Empty state before anything is recorded.
3. Manual-mode runs (no key) cost nothing and are **not** recorded.

## §2 — Contract & security invariants

- **Local only.** The usage log lives in the parent user layer (`data/llm-usage.jsonl`); nothing is sent anywhere. `GET /api/usage` is read-only.
- **Best-effort telemetry.** A failed usage write NEVER breaks the LLM response (wrapped in try/catch). Zero-token calls aren't recorded.
- **Estimated USD.** Dollars come from the editable `server/lib/llm-pricing.mjs` table — approximate, not billed. Token counts are exact.
- **CSP-safe.** `UI.el` + `addEventListener`; no innerHTML with response data.

## §3 — i18n

17 new keys (`usage.*` + `nav.usage`) present + translated in all **16** locales. Switch locale: nav item, title/subtitle, window tabs, table headers, total, and the estimate note read in-language. Arabic RTL.

## §4 — Sign-off

All §0 gates green · a live generation adds to the log · `#/usage` shows correct per-provider tokens + est. USD across the four windows · manual-mode runs aren't recorded · nothing leaves the machine · 17 keys ×16 · local-only / best-effort / read-only / CSP invariants intact.
