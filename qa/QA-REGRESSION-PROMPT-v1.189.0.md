# QA REGRESSION PROMPT — career-ops-ui **v1.189.0** (classify-tier i18n numerals)

**Fixed (scanner).** The seniority-tier classifier behind `skip_tiers` now recognises a roman-numeral level suffix (I / II / III / IV / V) after a role word in **any script**, not only after ASCII words. Before, a level numeral following a non-Latin word ("Инженер III", "エンジニア I", "Ingénieur IV") was ignored and the posting fell back to **mid**, so `skip_tiers: [senior]` / `[entry]` silently missed those listings.

- **Under test:** `package.json` **1.189.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # 2498, exit 0 (capture $? directly, never | grep)
node --test tests/classify-tier.test.mjs
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.189.0
```

## §1 — Change (`server/lib/classify-tier.mjs`)

- The three numeral matchers changed from `\b[a-z]{2,}[\s-](iii|iv|v)\b` (and `(ii)`, `(i)`) to a **script-agnostic lookbehind** `(?<=[\s-])(iii|iv|v)\b`. The lookbehind requires a preceding space or hyphen (any script) rather than an ASCII word, and positions the match at the numeral itself — so leftmost-marker classification stays honest.
- Removed a dead duplicate `\bsr\./i` matcher — `\bsr\b/i` already matches `Sr.` (the `\b` fires before the dot).
- No other logic changed; the associate-guard and program-bridge guard are untouched.

## §2 — Behaviour to verify

| Title | Before | After |
|---|---|---|
| `Инженер III` (ru) | mid (fallback) | **senior** |
| `エンジニア I` (ja) | mid (fallback) | **entry** |
| `Ingénieur IV` (fr) | mid (fallback) | **senior** |
| `Engineer II` (ascii) | mid | mid (unchanged) |
| `Grade-IV Specialist` | senior | senior (hyphen sep) |
| `Interview Scheduler` | mid | mid (no false positive) |
| `Software Engineer` | mid | mid |

- **Regression:** existing tiers (senior/staff/director, associate-guard, intern/program guard, leftmost-marker) unchanged. `skip_tiers` no-op when unset.

## §3 — Sign-off

Suite **2498** green (+1: non-Latin roman-numeral classification) · classify-tier now covers all 17 UI locales' titles · CHANGELOG parity ×17 at v1.189.0 · README badge+banner ×17. Same bug in the parent `classify-tier.mjs` is fixed in the parent `--json` PR.
