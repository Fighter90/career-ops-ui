# QA REGRESSION PROMPT — career-ops-ui **v1.183.0** (canonical URL dedup)

**Added (scanner).** The scanner and pipeline now key a posting on a **canonical URL** so the same job re-listed with a tracking param / `http↔https` / trailing slash is recognised as one posting instead of a new one.

- **Under test:** `package.json` **1.183.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # 2477, exit 0 (capture $? directly, never | grep)
node --test tests/url-key.test.mjs tests/parsers.test.mjs tests/en-scanner.test.mjs tests/ru-scanner.test.mjs
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.183.0
```

## §1 — Change

- New pure module `server/lib/url-key.mjs` → `normalizeUrl(raw)`: forces `https`, lowercases host, drops `#fragment` + a single trailing slash, removes a narrow tracking-param denylist (`utm_*`, `gh_src`, `fbclid`, `gclid`, `mc_cid/eid`, `igshid`, `_hsenc/_hsmi`, `trk`, `trackingid`), sorts the remaining query. **Non-http / placeholder / junk → `''`** ("no key is not a key" — callers must never treat `''` as a matchable value).
- Wired into: `en-scanner.mjs` + `ru-scanner.mjs` `seen` dedup (both the seed from scan-history/pipeline/apps AND the fresh-filter check), and `parsers.mjs::addPipelineUrl` (dedup on the canonical key, still writes the raw URL).

## §2 — Invariants

- **Under-strips by design.** It must NEVER merge two genuinely different postings: a kept functional query id (e.g. `gh_jid`) keeps two postings distinct; generic `ref`/`source`/`src` are NOT stripped.
- Scanner in-process; the persisted scan-history/pipeline URL is still the real URL (only the dedup KEY is canonical). No route / CSP / SSRF / parent-write change; no new dependency (uses the `URL` builtin).
- The `''`-is-not-a-key rule: a row with a placeholder URL (`N/A`, `TBD`, `local:jds/…`) must not dedup-collide with another placeholder.

## §3 — Manual check

Scan a source twice where a board appends `?utm_source=…` on the second pass (or re-run a scan): the re-listed roles must NOT reappear as fresh in `#/scan` results, and `data/pipeline.md` must not gain duplicate lines for them.

## §4 — Sign-off

Suite **2477** green (+6: 5 url-key + 1 addPipelineUrl canonical-dedup) · en/ru-scanner suites pass · CHANGELOG parity ×17 at v1.183.0 · README badge + banner ×17 at 2477 / v1.183.0.
