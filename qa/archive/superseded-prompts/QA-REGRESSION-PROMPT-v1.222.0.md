# QA REGRESSION PROMPT — career-ops-ui **v1.222.0** (localized extended-provider field hints)

**i18n / client-facing release, no server or route change.** Localizes the 26
`config.<slug>Hint` field hints for the 11 OpenAI-compatible providers added in
v1.216.0–v1.217.0 (DeepSeek … Volcengine Ark) across all 17 locales — previously
they fell back to English regardless of the UI language. No behaviour change; the
English `hintFallback` in `field-specs.js` still guards a missing key.

- **Under test:** `package.json` **1.222.0**. Sources **83** (unchanged). +26 dict keys ×17.

## §0 — Gates

```bash
npm test                                                   # 2779 (±2 flaky live scan-stream), exit 0
node --test tests/i18n-provider-hints.test.mjs             # 4 (roster present · localized ×17 · ⚡ marker kept · URL tokens kept)
node --test tests/i18n-locale-files.test.mjs tests/i18n-coverage.test.mjs   # 11 (parity + snapshot)
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.222.0
node tools/i18n-audit.mjs                                  # "✓ dictionary is clean"
```

## §1 — What changed (i18n data + one comment)

- `public/js/lib/locales/i18n-dict.<lang>.js` ×17 — each gains the **same 26 keys**
  (`config.deepseekHint`/`ModelHint`, `zaiHint`/`ModelHint`/`BaseUrlHint`, kimi…,
  minimax, mistral, grok, together, fireworks, ollama, ark…, arkcn…), inserted
  immediately before `config.portHint`. English values are byte-for-byte the
  `field-specs.js` `hintFallback` strings (a fidelity gate in the applier enforced
  this before writing). Non-English values translate the connective prose only;
  signup URLs, api hosts, model ids, brand names, `ep-…`/`ollama serve`, and the
  ⚡ marker stay literal.
- `public/js/views/config/field-specs.js` — comment updated (hints are now
  localized; the `hintFallback` strings remain the English source + missing-key net).
- `tests/fixtures/i18n-dict.snapshot.json` — regenerated (1402 keys).
- `tests/i18n-provider-hints.test.mjs` — **new** contract test.

## §2 — Manual browser pass

Open `#/config` → **API keys** tab in several UI languages (⚙ language picker):
- ru / de / ja / ar / zh-CN / hi — the DeepSeek, GLM, Kimi, MiniMax, Mistral, Grok,
  Together, Fireworks, Ollama, BytePlus Ark, and Volcengine Ark key/model/base-URL
  field hints read in the chosen language (not English).
- The signup URLs (`platform.deepseek.com`, `z.ai`, `console.x.ai`, …), model ids,
  and the ⚡ symbol appear intact inside the translated text.
- Arabic renders RTL; CJK/Hindi use their own sentence punctuation (。/।).

## §3 — Contract / invariants

- Locale parity holds (en canonical; all 17 share the same key set) — no missing/extra.
- No duplicate keys; no leading/trailing whitespace in any of the 26 values.
- `i18n-no-latin-leaks` still green — the intentional Latin tokens (URLs/model ids/
  brand names) are not flagged.
- No CSP / route / server change; no new dependency.

## §4 — Not in scope

- Per-provider live eval with a real key (would burn credits) — each provider stays
  covered by its fake-fetch unit test + `/api/status/providers`.
- No new scan source (registry **83** unchanged → help §17 untouched).

## §5 — Sign-off

Suite **2779** green · 26 hints ×17 localized, English == field-specs fallback,
⚡ + URL tokens preserved · parity + snapshot + audit green · changelog parity ×17
at v1.222.0 · README banner+badges ×17 · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed.
Deploy: Pages (facts/version), local + resumecraft restart (static assets change).
