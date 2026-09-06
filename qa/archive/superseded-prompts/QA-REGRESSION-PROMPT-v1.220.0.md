# QA REGRESSION PROMPT — career-ops-ui **v1.220.0** (Get on Board: multiple categories per entry)

**Server-only feature release.** Completes the parent getonbrd sync deferred in v1.219.0: a `getonbrd` portal entry can now scan several board categories at once. No client change.

- **Under test:** `package.json` **1.220.0**. Sources **83** (unchanged). No help/count change.

## §0 — Gates

```bash
npm test                                                   # 2771, exit 0
node --test tests/sources-getonbrd.test.mjs                # 8 (backward-compat + multi-category + dedup)
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.220.0
```

## §1 — What changed

- `server/lib/sources/getonbrd.mjs`:
  - `resolveCategories(entry)` (exported) — `categories:` (array) wins over `category:` (string); each slug `CATEGORY_SLUG_RE`-validated, deduped, order-preserved; empty or >12 throws; default `[programming]`.
  - `feedBase(category)` builds `https://www.getonbrd.com/api/v0/categories/{category}/jobs`.
  - `fetchGetonbrd(feedUrl, opts)` loops over the resolved categories (when the entry configures them) with a `seen` Set that dedups postings by URL across categories. With **no** category config it honors the single passed `feedUrl` — the `programming` default OR the adapter's `getonbrd:`/`api:` override — so existing entries and the override path are byte-identical.

## §2 — Manual / config

```yaml
tracked_companies:
  - name: Get on Board
    provider: getonbrd
    enabled: true
    categories: [programming, operations-management, machine-learning-ai]   # NEW; or a single `category:`
    max_pages: 3
```
A posting listed under two categories appears once (deduped by URL). A bad slug (`category: "bad/slug"`) is rejected with a clear error before any fetch. Omitting `categories`/`category` scans `programming` exactly as before.

## §3 — Invariants / security

- SSRF host-pin to `www.getonbrd.com` (`assertGetonbrdUrl`) + `redirect:'error'` unchanged; the category slug regex is anchored so a config typo can't inject a path/query. No new route, no client change, no CSP surface. Parent read-only contract intact.

## §4 — Sign-off

Suite **2771** green · getonbrd 8 tests (default + override backward-compat, multi-category, cross-category URL dedup, validation/cap) · changelog parity ×17 at v1.220.0 · README banner+badges ×17 · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed. Deploy: Pages (facts/version), local + resumecraft restart (server change).
