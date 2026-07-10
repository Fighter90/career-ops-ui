# QA REGRESSION PROMPT — career-ops-ui **v1.118.2** (release delta driver: v1.118.1 + v1.118.2)

Delta driver covering the two patch releases after the v1.118.0 parity pack. Run on top of the definitive whole-project prompt (`qa/QA-REGRESSION-PROMPT.md`); this file covers ONLY what v1.118.1–v1.118.2 added. Server: `npm start` → `http://127.0.0.1:4317`.

- **Version under test:** `package.json` **1.118.2** · `parentVersion` **1.18.0** · **31 route modules** · **59 adapters (54 EN + 5 RU)**.
- **Baseline:** **1822** `node --test` cases (1817 → +1 hh-451 → +4 site-script guards) · CHANGELOG/README parity ×16 at v1.118.2.

---

## §1 — v1.118.1: hh.ru HTTP 451 geo-block handling

Background: hh.ru now serves **HTTP 451** (regional legal block) to non-Russian IPs on its public search pages (`hh.ru/search/vacancy`); the JSON API has long been 403 for every programmatic client. A 451 from your network is **environment, not a regression**.

1. Unit (`tests/ru-scanner.test.mjs`): `searchHH` with a stubbed 451 response throws with `err.geoBlocked === true && err.status === 451` (mirrors the existing 403 case).
2. Run behavior: on the FIRST 451 (or 403) the RU scan **disables hh.ru for the rest of the run** — remaining queries must NOT hit hh again; the other RU sources (habr / trudvsem / getmatch / geekjob) still complete.
3. Log contract (`ru-scanner.mjs`): the disable line names the actual cause — 451 gets the geo hint (`…geo-blocks requests from outside Russia (HTTP 451) — scan via a Russian IP / VPN exit node. See help §7.`), 403 keeps the anti-bot wording. Server messages stay English-by-policy.
4. Help ×16: the `### hh.ru` subsection under §7 is rewritten in ALL 16 bundles — heading now says a Russian IP is required since July 2026; the old "works from any IP" claim must be gone everywhere. H2/H3 counts unchanged (28 / 103).
5. Live (optional, network-dependent): from a non-RU IP, an RU scan shows one `⚠ hh.ru disabled for this run (hh.ru: HTTP 451)` stderr pair and zero further hh requests.

## §2 — v1.118.2: landing follow-up (PR #118 review closeout)

1. `site/README.md` says **Astro 7** (matches `site/package.json` `astro ^7.0.7` — the #116 security upgrade closing 5 GHSAs + esbuild).
2. `site/scripts/generate-og.mjs` has no unused `writeFileSync` import (CodeQL #396 fixed at source; #395 dismissed with rationale — fixed-URL build-time star snapshot into a gitignored artifact).
3. **Site-script guards** (`tests/site-scripts.test.mjs`, +4, CI-isolated mkdtemp fixture — no parent project, no network):
   - check-i18n passes on a 16-locale parity fixture;
   - check-i18n **fails (exit ≠ 0)** when a locale is missing a key;
   - check-i18n **fails** when a locale dictionary file is missing entirely;
   - sync-assets source invariant: no write destination is ROOT-derived (`join(ROOT`/`resolve(ROOT`/`ROOT +` all trip the guard) — landing writes never leave `site/`.
4. Pages workflow (`.github/workflows/deploy-pages.yml`): build step runs `npx astro check` + `node scripts/check-i18n.mjs` before `npm run build`, on **Node 22** (Astro 7 requires ≥22.12); paths-filter unchanged (`site/**`, `docs/help/**`, `images/dashboard-*.png`).
5. CLAUDE.md carve-out: the no-build rule for `public/` explicitly records the `site/` exception (CI-only build; nothing in `server/`/`public/` imports from `site/`).

## §3 — Release mechanics ×16

```bash
node scripts/check-changelog-parity.mjs   # "all 15 locales at v1.118.2"
npm test                                  # ≥1822 green — run raw, check $?, never `| grep`
```

- CHANGELOG ×16 carry both `## [1.118.1]` (hh 451) and `## [1.118.2]` (landing follow-up) entries.
- README ×16: release badge v1.118.2, tests badge 1822.
- `qa/REGRESSION-FINAL.md` baseline block: v1.118.2 · unit ≥ 1822 · 28 H2 / 103 H3 · 59 adapters.
- GitHub Release latest = `v1.118.2`; GitHub Packages `@fighter90/career-ops-ui` dist-tag `latest` = `1.118.2`.
- Live landing (`https://cvstart.org`) facts show **v1.118.2 / 1,822** (redeployed post-release; facts.json is a build-time snapshot — stale numbers there mean the Pages workflow wasn't re-run, not a code bug).

## §4 — Sign-off

`npm test` ≥1822 green · `npm run test:ci` green · Playwright suite green · CI matrix (Node 18/20/22 + CodeQL + dependency review) green on PRs #117–#119. CodeQL notes: `js/missing-rate-limiting` on llmRateLimit-guarded routes stays the known categorical FP; the two site-script alerts (#395/#396) are resolved as described in §2.
