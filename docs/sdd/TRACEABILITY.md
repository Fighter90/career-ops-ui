# TRACEABILITY — invariants → code → gates

The things this project must not lose, each tied to the code that upholds it and the
**executable gate** that fails when it breaks. A row without a gate is a defect in this
table: add the test, then the row. `docs/sdd/README.md` explains how specs use it.

Gate commands run from the repo root on Node ≥ 22: `node --test <file>` for one, `npm run test:ci` for all.

| ID | Invariant | Where it lives | Gate (fails when broken) |
|---|---|---|---|
| **R-01** | web-ui never reaches outside its own tree except the declared parent relays; the parent (`../`) is **read-only** apart from an authorised `git pull`/merge | `server/lib/parent-relay.mjs`, `server/lib/runner.mjs`, `server/lib/paths.mjs` | `tests/test-root-isolation.test.mjs`, `tests/parent-relay*.test.mjs`, `tests/runner-kill-escalation.test.mjs` |
| **R-02** | An explicit `CAREER_OPS_ROOT` is always honoured (an empty temp dir never falls back to the real parent) | `server/lib/paths.mjs` (`resolveProjectRoot`) | `tests/test-root-isolation.test.mjs`, `tests/reports-list-cache.test.mjs` |
| **R-03** | Routes validate input types before use; a malformed body is a JSON 4xx, never a process exit | `server/lib/async-safety.mjs`, each `server/lib/routes/*.mjs`, global error handler in `server/index.mjs` | `tests/request-guard.test.mjs` (async handlers), per-route suites |
| **R-04** | The source registry contract: every `server/lib/sources/<slug>.mjs` exports `meta {value,label,region}`, `region ∈ {en, ru}`, host-pinned, HTTPS-only, `redirect:'error'`; a malformed 200 **throws** (never an empty board) | `server/lib/sources/registry.mjs`, `server/lib/sources/*.mjs`, `server/lib/portals/adapters/*.mjs` | `tests/sources-registry-discovery.test.mjs`, `tests/adapter-registry.test.mjs`, `tests/sources-<slug>.test.mjs` ×109 |
| **R-05** | Counts agree everywhere: registry total ↔ adapters ↔ `#/scan` fallback ↔ cvstart.org ↔ help ×17 ↔ docs | `server/lib/portals/registry.mjs`, `public/js/lib/scan-results.js`, `site/src/components/Sources.astro`, `docs/help/*.md` | `tests/scan-sources-endpoint.test.mjs`, `tests/scan-fallback-sources.test.mjs`, `tests/site-sources.test.mjs`, `tests/help-source-counts.test.mjs` |
| **R-06** | SSRF envelope: the scanner transport refuses private/loopback targets (DNS-rebinding guard on every hop), the server refuses foreign `Host` names and cross-site writes | `server/lib/http-json.mjs`, `server/lib/fetch-timeout.mjs`, `server/lib/safe-fetch.mjs`, `server/lib/security.mjs`, `server/lib/request-guard.mjs` | `tests/http-json-dns-guard.test.mjs`, `tests/ssrf-redirect-rebind.test.mjs`, `tests/fetch-timeout-dns-guard.test.mjs`, `tests/request-guard.test.mjs`, `tests/security-hardening-v11*.test.mjs` |
| **R-07** | CSP-safe DOM: no inline script, no `innerHTML` with data; every dynamic value goes through `UI.el` / `UI.md` | `public/js/**`, `server/index.mjs` (CSP header) | `tests/security-headers.test.mjs`, `tests/no-innerhtml*.test.mjs`, Playwright suites |
| **R-08** | i18n parity: every key exists in all 17 locales, no Latin leaks, help bundles share one structure | `public/js/lib/locales/i18n-dict.*.js`, `docs/help/*.md` | `tests/i18n-coverage.test.mjs`, `tests/i18n-locale-files.test.mjs`, `tools/i18n-audit.mjs` |
| **R-09** | Release surfaces move together: CHANGELOG ×17, README ×17, site mirrors, QA prompt, baselines | `CHANGELOG*.md`, `README*.md`, `site/src/content/changelog/*`, `qa/` | `scripts/check-changelog-parity.mjs`, `node evals/workflow/run.mjs` |
| **R-10** | Fork divergences from upstream are defended on every merge (ADR-0002) | `providers/telegram-channel.mjs`, `providers/telegram.mjs`, `web/src/lib/clis.ts`, `test-all.mjs` (parent repo) | the post-merge snapshot diff + greps in `docs/adr/0002-defend-fork-divergences.md` |
| **R-11** | `pipeline.md` is read and written in **both** formats (fenced URLs and the parent's `## Pending` / `## Processed` checklist) without data loss | `server/lib/parsers.mjs` (`parsePipeline`, `addPipelineUrl`, `removePipelineUrl`) | `tests/parsers-pipeline-checklist.test.mjs`, `tests/pipeline-*.test.mjs` |
| **R-12** | An aborted, failed or single-company scan never replaces the saved snapshot with an emptier one | `server/lib/en-scanner.mjs`, `server/lib/ru-scanner.mjs` (`saveLastScan`) | `tests/scan-snapshot-safety.test.mjs` *(added with the review fixes)* |

## Maintenance rules

1. **Add a row when you add an invariant**, in the same PR as its gate.
2. **A gate that only greps source text** (rather than running behaviour) is recorded as *weak* in the spec that relies on it, and replaced when the behaviour becomes testable.
3. **Counts** (R-05) are regenerated from the live registry, never hand-edited into tests.
4. A row that cannot be tied to a runnable gate is a bug in this file — open it as a task in the next spec.
