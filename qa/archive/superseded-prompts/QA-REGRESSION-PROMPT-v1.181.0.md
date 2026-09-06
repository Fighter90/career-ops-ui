# QA REGRESSION PROMPT — career-ops-ui **v1.181.0** (Getro parity port)

**Changed (LOW, scanner).** Parent-sync parity port of `providers/getro.mjs` #2640 into `server/lib/sources/getro.mjs`: salary, all-locations, and `work_mode` remote-detect. Pure data-mapping from the API response web-ui already fetches — no new host, no SSRF change.

- **Under test:** `package.json` **1.181.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2470, exit 0 (capture $? directly, never | grep)
node --test tests/sources-getro.test.mjs    # 20 (15 existing + 5 parity)
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.181.0
```

## §1 — Change (`server/lib/sources/getro.mjs`)

- **`getroSalary(job)`** (new, exported) — builds a **display string** from `compensation_amount_min_cents` / `_max_cents` (÷100) + `compensation_currency`, ANNUAL only (`compensation_period` empty or `'year'`; hourly/monthly → `''`). Forms: `"100000–150000 USD"` / `"from 120000 EUR"` / `"up to 90000"`. Mirrors the remotli/lever convention that the client `Skills.parseSalaryRange` re-parses (so the salary filter works). Parent emits a `{min,max,currency}` object for its own filter; web-ui's job shape is a string, hence the adaptation.
- **`getroLocation(job)`** (new, exported) — joins **all** `locations` (falls back to `searchable_locations`), comma-separated. Was `locations[0]` only.
- **`deriveWorkplace`** — now also treats `work_mode: 'remote'` as a remote flag (alongside `remote` / `workplace_type` / location text).
- **`normalizeGetroJob`** — `salary: getroSalary(job)` (was `''`), `location: getroLocation(job)`.

## §2 — Deliberately NOT ported (documented divergence)

- **`collection_id` auto-resolve** — the parent fetches the board's own `careers_url` (an arbitrary host) to read `__NEXT_DATA__.network.id`. That is a NEW SSRF surface and must go through web-ui's `safeGet` boundary — a separate, focused change, not this data-mapping port. web-ui's getro still requires an explicit numeric `getro_collection`.
- **1500-page hard cap** — web-ui keeps its `HARD_MAX_PAGES = 200` (4000 newest jobs/board); a browser-triggered scan should not fire up to 1500 sequential third-party calls per board.
- The other 11 parent commits in this sync (agent-inbox, invite-match, jd-similarity, jd-skill-gap, reserve-report-num, verify-cv-facts, classify-tier's tier-skip) have **no web-ui mirror** — verified against `server/lib/`.

## §3 — Invariants

- Scanner in-process; host-pin (`api.getro.com` + HTTPS + `redirect:'error'`) unchanged; no route / CSP / SSRF / parent-write change; no new dependency. The salary string is data the API already returns — no extra request.
- Dead-board contract, age-cutoff pagination, url-dedup, `getro_collection` validation — all unchanged (existing 15 tests still green).

## §4 — Sign-off

Suite **2470** green (+5) · `sources-getro` 20/20 · CHANGELOG parity ×17 at v1.181.0 · README badges + banner ×17 at 2470 / v1.181.0. Parent-sync #2640 ported (safe half); auto-resolve + 1500-cap consciously deferred.
