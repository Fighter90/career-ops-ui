# QA REGRESSION PROMPT — career-ops-ui **v1.223.0** (eval-badge tone fix + OpenWorker install docs + Recruitee coverage)

**Client fix + docs + one test.** Fixes a LOW cosmetic bug where a successful ⚡ live eval was painted red, documents installing the OpenWorker coworker from its GitHub URL / .zip / one command, and closes a long-standing Recruitee coverage gap.

- **Under test:** `package.json` **1.223.0**. Sources **83** (unchanged). No route/CSP/server-logic change.

## §0 — Gates

```bash
npm test                                                   # 2783 (±2 flaky live scan-stream), exit 0
node --test tests/eval-badge-tone.test.mjs                 # 3 (buggy strict tone gone · numeric-code failure predicate · guarded exit suffix)
node --test tests/sources-recruitee.test.mjs               # 3 (incl. the new quoted-angle end-to-end case)
node --test tests/canonical-docs-coverage.test.mjs tests/help-ui.test.mjs   # help parity intact (32 H2 / 121 H3)
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.223.0
```

## §1 — What changed

- **`public/js/views/evaluate.js` — result-badge tone (BUG-1).** A successful live evaluation is no longer coloured as a failure. The in-process live providers (OpenRouter, DeepSeek, …) return **no subprocess exit `code`**, so the old `r.code === 0 ? 'badge-ok' : 'badge-bad'` evaluated `undefined === 0` → false and painted every success **red** (while `r.code ?? 0` still rendered "exit 0"). Now: `failed = typeof r.code === 'number' && r.code !== 0`, `cls = failed ? 'badge-bad' : 'badge-ok'`, and the "· exit N" suffix shows **only** when there is a real numeric code. renderResult runs only on a 200 (failures throw to the catch), so a live result is always `badge-ok`.
- **Docs — OpenWorker coworker install.** `docs/integrations/openworker.md`, in-app help **§32 ×17**, and README **§34** now describe the one-command installer (`curl … | bash`, idempotent) and the three OpenWorker install paths (**GitHub URL · `.zip` · single-file import**), which the coworker repo now supports (its `career-ops.md` is the only top-level `.md`). Help heading structure unchanged (parity gate green).
- **Coverage — `tests/sources-recruitee.test.mjs`.** New end-to-end case for the v1.214.2 quoted-angle fix (a `>` inside a tag attribute, e.g. `<a title="salary > 100k">`, must not leak into the description). The other three checklist gaps the user raised were verified **already covered** by unit tests: classify-tier `Associate <senior noun>` (`classify-tier.test.mjs:19`), getonbrd `categories:` multi-fetch dedup (`sources-getonbrd.test.mjs:88,99`), ashby plain `<…>` survival (`sources-ashby.test.mjs:85`).

## §2 — Manual browser pass

Run a live ⚡ eval on `#/evaluate` with any in-process provider key set (OpenRouter, DeepSeek, …). The result badge is **green** (`badge-ok`) and reads just the provider name (e.g. "OpenRouter"), no "· exit 0". A manual-fallback still shows the amber `badge-warn`. (If you have the Gemini subprocess path, a non-zero exit still shows red + "· exit N".)

## §3 — Contract / invariants

- No server, route, CSP, or dependency change; no i18n **key** change (help prose only).
- Help parity 32 H2 / 121 H3 across 17 locales; changelog parity ×17 at v1.223.0.
- Scan registry unchanged at **83**.

## §4 — Not in scope

- The eval badge is source-static tested (the project has no jsdom view harness); the browser pass above is the behavioural check.

## §5 — Sign-off

Suite **2783** green · successful live eval renders `badge-ok` · help §32 ×17 + README + openworker.md document the 3 install paths + one-command · Recruitee quoted-angle covered end-to-end · parity ×17 · README banner+badges ×17 · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed. Deploy: Pages (facts/version), local + resumecraft restart.
