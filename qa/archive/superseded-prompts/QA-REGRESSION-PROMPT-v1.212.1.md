# QA REGRESSION PROMPT — career-ops-ui **v1.212.1** (landing source-count fix)

**Patch release.** cvstart.org under-counted scan sources (showed **80**, dropped **Job Bank (Canada)**) while the app listed **81**. Root cause: `jobbankca` top-level-imported `js-yaml`, which the Pages build (site/-only `npm ci`) can't resolve, so the registry enumeration silently dropped it. No app behaviour changed — the scanner always had all 81.

- **Under test:** `package.json` **1.212.1**. Registry **81** = 76 EN + 5 RU, `ALL_ADAPTERS` **76** — unchanged.

## §0 — Gates

```bash
npm test                                                   # 2687, exit 0
node --test tests/site-sources.test.mjs                    # 6 (was 4: +static third-party-import gate, +sync-assets guard assertion)
node --test tests/sources-jobbankca.test.mjs               # 24 (resolveProfileKeywords now async — still green)
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.212.1
# Prove the fix in the dep-isolated Pages environment:
mv node_modules/js-yaml node_modules/js-yaml.HIDDEN
node --input-type=module -e 'const r=await import("./server/lib/sources/registry.mjs");console.log(r.SOURCES.length, r.SOURCES.some(s=>s.value==="jobbankca"))'   # 81 true
mv node_modules/js-yaml.HIDDEN node_modules/js-yaml
```

## §1 — What changed

- **`server/lib/sources/jobbankca.mjs`** — removed the top-level `import * as yaml from 'js-yaml'`. `resolveProfileKeywords` is now `async` and does `const yaml = await import('js-yaml')` inside its try (fail-open preserved: a missing dep → `[]`). Its one call site in `fetchJobBankCa` now `await`s it. The module is import-safe with only `node:` builtins + relative modules, so the registry can enumerate it in the dep-free Pages build.
- **`site/scripts/sync-assets.mjs`** — new hard guard: `fail()` when `scanSources.length !== adapters` (registry enumeration vs adapter-file count). Turns a silent source drop into a loud build failure in the exact environment where it happened.
- **`tests/site-sources.test.mjs`** — two new tests: (a) a static gate scanning every `server/lib/sources/*.mjs` and asserting no top-level import of a third-party (bare) package — only `node:` or relative; (b) an assertion that sync-assets contains the `scanSources.length !== adapters` guard.

## §2 — Manual browser pass (after Pages redeploy)

1. cvstart.org **Job sources** header reads **"81 job boards"** (not 80).
2. A **Job Bank (Canada)** chip is present and links to **jobbank.gc.ca**.
3. Senjob + Yourator still present; EchoJobs still absent.
4. Footer version badge reads **v1.212.1**.
5. App unchanged: `#/scan` Source dropdown still lists 81 incl. Job Bank; `/api/scan/sources` = 81.

## §3 — Invariants / security

- No SSRF/XSS surface touched. jobbankca's host-pinning (`assertJobBankUrl`), HTTPS-only, `redirect:'error'` unchanged.
- js-yaml still loads at scan time on the server (repo-root dep present) — the lazy import only defers *when*, never *whether*, for the running app.
- No new dependency, no new route, parent read-only contract intact.

## §4 — Not changed / follow-ups

- **deploy-pages.yml NOT changed** — the lazy-import + sync-assets guard make a repo-root `npm ci` in the Pages job unnecessary; the guard now fails loudly if any future source reintroduces a top-level third-party import.
- **Observation-level validation of Consider (CSRF handshake) + multi-location Lever** — would need a real `provider: consider` and a multi-location `provider: lever` portal in `portals.yml` + a live scan. That file is user data in the parent project (off-limits to this repo); the user adds those portals if they want end-to-end confirmation beyond the suites.

## §5 — Sign-off

Suite **2687** green (2685 + 2 site-sources gates) · `site-sources` 4→6 · `sources-jobbankca` 24 (async resolveProfileKeywords) · dep-isolation proof: registry enumerates **81** with js-yaml hidden · CHANGELOG parity ×17 at v1.212.1 · help **untouched** (source count unchanged 81/76) · CONVENTIONS/PROJECT-CONTEXT/CLAUDE.md refreshed · site rebuilt (facts.sources **81**, assertion passes) · wiki version + tests bumped. Deploy: Pages rebuild (site/ + registry changed) → cvstart.org back to 81; resumecraft + local rsync of `jobbankca.mjs` + restart.
