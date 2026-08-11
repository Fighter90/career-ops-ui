# QA REGRESSION PROMPT — career-ops-ui **v1.136.0** (parent career-ops v1.26.x parity — quality wave)

Delta regression for **1 new scan source** (`eightfold`) + a wave of **quality/robustness** ports to code web-ui mirrors. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.136.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                          # full suite — 2343, exit 0 (capture $? directly, never | grep)
# new source + core-quality ports
node --test tests/sources-eightfold.test.mjs tests/text-key.test.mjs tests/detect-reposts.test.mjs \
            tests/title-filter.test.mjs tests/http-json.test.mjs tests/sources-oraclecloud.test.mjs \
            tests/sources-workable.test.mjs tests/sources-ats-providers.test.mjs tests/states.test.mjs
# registry + drift gates
node --test tests/adapter-registry.test.mjs       # ALL_ADAPTERS.length === 74, sorted ids incl. 'eightfold'
node --test tests/scan-sources-endpoint.test.mjs  # EN set (74) incl. eightfold
node --test tests/scan-fallback-sources.test.mjs  # FALLBACK_SOURCES value parity with the registry (79)
node --test tests/site-sources.test.mjs           # SOURCE_URLS covers every registry value
node scripts/check-changelog-parity.mjs           # all 16 locales at v1.136.0
```

## §1 — What changed

Parent **v1.26.x** mainline (post-v1.26.0). Registry now **79 sources = 74 EN + 5 RU** (`ALL_ADAPTERS` 74).

**New source:** `eightfold` (Eightfold AI, #2684) — `https://<tenant>.eightfold.ai/api/apply/v2/jobs`, host-pinned to `*.eightfold.ai` (the branded `careers.<company>.com` CNAME is rejected — point the entry at the tenant host), paginated with a safety cap, dead-board-throw, url-dedup.

**Quality / robustness ports** (code web-ui mirrors from the core):
- **Unicode dedup/role keys** (#2569/#2587/#2667) — new `server/lib/text-key.mjs::normalizeTextKey` (NFKC + keep `\p{L}\p{M}\p{N}`) keys `detect-reposts` company grouping and folds `role-matcher` titles. Width/punctuation company variants cluster; distinct non-Latin employers never collapse; full-width titles fold to their half-width twin; non-Latin role tokens survive.
- **`fetchJsonWithRetry` refused-redirect** (#2657) — a `redirect:'error'` 3xx is now non-retryable (fails fast instead of burning the retry budget).
- **`title_filter.positive` AND-groups** (#2552) — ` + ` (whitespace-delimited) requires every term.
- **`oraclecloud`** numbered apexes `oraclecloud1-99.com` (#2683, bounded family).
- **`workable`** retry + browser headers + request serialization (#2675).
- **`personio`** XML→HTML-scrape fallback when the feed is disabled.
- **`states`** FALLBACK aliases resynced (#2615).

## §2 — Manual browser pass

1. **`#/scan` Source filter** — the dropdown lists **Eightfold** (offline FALLBACK + live registry). Source count reflects **79**.
2. **`#/tracker`** — status tabs still fold the canonical funnel; the new `evaluated`/`skip` aliases resolve (parent file read first, FALLBACK backs a fresh clone).
3. **cvstart.org landing** (after Pages redeploy) — Job-sources section shows **79** incl. the `eightfold` chip (→ eightfold.ai).
4. No new UI strings / i18n keys (source label + quality ports are data/logic) — chrome unchanged.

## §3 — Contract & security invariants

- **SSRF:** eightfold host-pinned `*.eightfold.ai` (HTTPS, `redirect:'error'`); oraclecloud's numbered apex stays a **bounded** family (no leading zero, ≤ 2 digits — never a wildcard). The refused-redirect fix does NOT weaken the guard — `redirect:'error'` still refuses; it just stops *retrying* the deterministic refusal.
- **Dead-board-throw** preserved on eightfold + personio (XML+HTML both fail → throw) + workable.
- **Unicode keys never merge distinct entities:** `normalizeTextKey(null) === normalizeTextKey(undefined) === ''` (nullish keys to empty, not to the literal "null"); all-punctuation → '' with a raw-lowercase fallback in detect-reposts so distinct symbol-only names don't collapse.
- **Read-only / in-process:** no new writes; scanners still in-process.

## §4 — Not ported (parent parity note)

reply-matcher #2672 / jd-similarity #2661 / jd-skill-gap #2686 (no web-ui email-reply / JD-analysis surface); scan env-paths #2568 / `--flag=value` #2589 + per-run dedup-read perf (web-ui runs scanners in-process); cover-letter / CV-template / doctor / ollama / generate-pdf (CLI-only). The web `js-yaml`/`nanoid` HIGH advisories were already patched in v1.135.0.

## §5 — Sign-off

All §0 gates green (**2343**, exit 0) · eightfold in the `#/scan` Source filter + on the landing (79 sources) · Unicode keys cluster variants / keep non-Latin distinct · refused-redirect fails fast · title AND-groups gate · oraclecloud numbered apex bounded · workable/personio hardened · states aliases resynced · registry + drift gates green · no new i18n keys · CHANGELOG parity ×17.
