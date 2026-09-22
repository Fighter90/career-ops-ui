# QA regression — v1.237.1

Patch from an **external QA pass** on v1.237.0. That pass PASSED with two defects, both in
what v1.237.0 itself added, and one side observation that turned out to be a latent outage.
No product-behaviour change beyond one allowlist addition. Counts frozen at 94 / 89 EN / 5 RU / 89.

## §0 — Gates

```bash
node --test tests/footer-book-link-locale.test.mjs           # 5 pass — BOOK-1 regression
node --test tests/sources-jobstreet-seek-hosts.test.mjs      # 4 pass — SEEK host migration
node --test tests/sources-jobstreet-market-path.test.mjs     # 13 pass (unchanged)
node --test tests/i18n-locale-files.test.mjs                 # 6 pass — snapshot carries footer.patternsUrl
node --test tests/adapter-registry.test.mjs tests/scan-sources-endpoint.test.mjs \
           tests/scan-fallback-sources.test.mjs tests/site-sources.test.mjs \
           tests/help-source-counts.test.mjs                 # count gates — UNCHANGED
npm run test:ci                                              # 3210 pass, exit 0
npm run test:e2e:browser                                     # 116 pass
node scripts/check-changelog-parity.mjs                      # green
node tools/i18n-audit.mjs                                    # clean
node evals/workflow/run.mjs                                  # 14 pass / 0 fail / 1 skip
```

**3201 → 3210** (+5 footer-link locale, +4 SEEK hosts). Both new suites were shown red on the
defect before the fix.

## §1 — What changed

### 1. BOOK-1 — the book link localized its label but not its target
Every locale's footer href pointed at `/en/` while the `ru` label read «Паттерны агентного
кодинга». New `data-i18n-href` applier in `public/js/app.js` (same shape as `data-i18n-title`,
**accepts only absolute `https://`**), `data-i18n-href="footer.patternsUrl"` on the anchor, and
a `footer.patternsUrl` key in all 17 SPA dicts and 17 site locale files: `ru` → `/ru/`, all
others → `/en/`. `Footer.astro` reads the URL from i18n instead of hardcoding it.

### 2. SEEK host migration — allowlist widened before the outage
`www.seek.com.au` → `au.seek.com`, `www.seek.co.nz` → `nz.seek.com`. Detail pages already 301;
both host pairs serve the v5 API at 200 (verified 2026-09-22). `http-json.mjs` uses
`redirect:'error'` (keep it — SSRF), so once the API path redirects, an old-host entry fails.
`au.seek.com` and `nz.seek.com` added to `ALLOWED_JOBSTREET_HOSTS`; old hosts retained.

### 3. WIKI-1 — unescaped `|` in the Agentic Practices doc-map row (wiki only, one char)

## §2 — What to check in the browser

1. **SPA footer, language = Русский:** the 📘 link's `href` must end in `/ru/`. Switch to any
   other language: it must end in `/en/`. Switch back: `/ru/` again (the applier runs on every
   language change, not only at boot).
2. **cvstart.org/ru/** footer: the book link → `/ru/`. **cvstart.org/** (and any other locale)
   → `/en/`.
3. `#/scan` with a Jobstreet entry whose `api:` uses **`au.seek.com`**: the entry is accepted
   (no "untrusted hostname"), the scan runs, result links are `https://au.seek.com/job/<id>`.
4. The same with the old `www.seek.com.au`: still accepted, still runs.
5. Wiki **Home → Documentation map**: the *Agentic Practices* row renders as a link with its
   description visible.

## §3 — Invariants

- `data-i18n-href` never sets a non-`https://` value (test asserts the regex is present).
- Label and URL agree in every locale: a translated title ⇔ a localized URL.
- Look-alike SEEK hosts (`au.seek.com.evil.com`, `au-seek.com`, `http://au.seek.com`) refused.
- `redirect:'error'` untouched.
- Counts unmoved; help structure 32 H2 / 122 H3 ×17.

## §4 — Not closable from outside (recorded, not claimed)

- Oracle Cloud — Akamai blocked both REST probes.
- Personio pin and `appendWorkType` — need a `portals.yml` entry; the UI has track / toggle /
  discover / health but **no delete**, so a probe entry cannot be removed from the UI.
- Liveness string cases — no controllable page. 40 live probes: 12 live, 28 inconclusive,
  **0 false expired**.

## §5 — Sign-off

- [ ] §0 gates green at 3210
- [ ] ru footer → `/ru/`, every other locale → `/en/`, on both the SPA and cvstart.org
- [ ] `au.seek.com` accepted as a Jobstreet endpoint; `www.seek.com.au` still accepted
- [ ] Wiki Agentic Practices row renders
- [ ] docs ×17, site ×17 carry v1.237.1
