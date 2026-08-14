# QA REGRESSION PROMPT — career-ops-ui **v1.182.0** (locale-neutral salary ranges)

**Fixed (scanner, i18n).** One-sided salary strings across six job-board sources emitted the English words `from` / `up to`, which leaked untranslated into non-English scan + tracker rows. Now the locale-neutral symbols `≥` / `≤`.

- **Under test:** `package.json` **1.182.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # 2470, exit 0 (capture $? directly, never | grep)
node --test tests/sources-getro.test.mjs tests/sources-remotli.test.mjs tests/sources-manfred.test.mjs tests/sources-agenticjobs.test.mjs tests/sources-justjoin.test.mjs
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.182.0
```

## §1 — Change

- Six source salary builders (`server/lib/sources/{getro,remotli,manfred,agenticjobs,justjoin,jobicy}.mjs`) now return `≥ <n><cur>` / `≤ <n><cur>` for a one-sided range instead of `from <n>` / `up to <n>`. Two-sided ranges (`<lo>–<hi> <cur>`, en-dash) were already language-neutral and are unchanged.
- Affected source-suite test expectations updated to `≥`/`≤`.

## §2 — Invariants

- **Display only.** The client `Skills.parseSalaryRange` (`public/js/lib/skills.js`) extracts digit tokens regardless of any `≥`/`≤`/`from`/`up to` prefix, so the salary **filter** on `#/scan` behaves identically — verify a `≥ 120000` job is still matched/excluded by the min/max salary filter exactly as before.
- Scanner in-process; no route / CSP / SSRF / parent-write change; no new dependency. No i18n keys added (the symbols are language-independent).

## §3 — Sign-off

Suite **2470** green · the five updated source suites pass with `≥`/`≤` · CHANGELOG parity ×17 at v1.182.0 · README badge + banner ×17 at v1.182.0 · a `≥`/`≤` salary still filters correctly on `#/scan`.
