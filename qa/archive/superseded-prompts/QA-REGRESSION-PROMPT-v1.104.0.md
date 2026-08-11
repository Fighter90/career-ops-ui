# QA REGRESSION PROMPT — career-ops-ui **v1.104.0** (company logos in the scan table)

Delta regression for the company-logo proxy + Appearance toggle. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.104.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # full suite (logo-routes ×5)
node --test tests/logo-routes.test.mjs         # domain guard, image sniff/reject, negative cache, binary safeGet
node --test tests/i18n-coverage.test.mjs       # 5 new appear.* keys ×16, zero missing
node --test tests/help-ui.test.mjs             # 28 H2 per bundle (unchanged)
node scripts/check-changelog-parity.mjs         # all 15 locales at v1.104.0
```

## §1 — What changed

1. **App settings → Appearance** gains a toggle **Show company logos in the scan table** (off by default, stored in localStorage).
2. With it **on**, each `#/scan` row shows the company's logo next to its name — the favicon of the company's own domain, proxied via `GET /api/logo?domain=…`. Postings on a shared job board (Greenhouse/Lever/Ashby/…) show a coloured **letter badge** instead; any logo that 404s / errors also falls back to the badge.

## §2 — Contract & security invariants

- **Privacy.** The logo comes only from the company's **own** domain (already contacted by the scanner), never a third-party logo API. Off by default.
- **SSRF-safe.** `/api/logo` validates the domain (no scheme/path/port/loopback) and fetches `/favicon.ico` through the DNS-pinned `safeGet` binary path (private ranges blocked, 200 KB cap, 6 s abort). A domain that resolves private / times out / returns non-image → **404**, never a throw or a raw HTML page.
- **No disk writes.** Hits and misses are cached **in memory** (LRU, 24 h). No user data (CV/profile) is involved.
- **CSP-safe.** The `<img>` fallback uses the `img.onerror` property (not an inline attribute); no innerHTML.

## §3 — i18n

5 new keys (`appear.*`) present + translated in all **16** locales. Switch locale: the Appearance card title, the toggle label + hint, and the on/off toasts read in-language. Arabic RTL.

## §4 — Sign-off

All §0 gates green · toggle persists · scan rows show real favicons for direct-domain postings and letter badges for shared-board ones · a broken logo falls back to a badge · `/api/logo` rejects bad domains (400) and never serves non-images · nothing written to disk · 5 keys ×16 · privacy / SSRF-safe / no-writes / CSP invariants intact.
