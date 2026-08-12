# QA REGRESSION PROMPT — career-ops-ui **v1.144.0** (enable/disable tracked portals)

User-reported UX request (no parent-sync). You can turn a watched company on/off from `#/portals` and the scanner honors it. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.144.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # full suite — 2370, exit 0 (capture $? directly, never | grep)
node --test tests/portals-routes.test.mjs      # setEnabledInRaw + POST /api/portals/toggle round-trip + 404
node tools/i18n-audit.mjs                       # dictionary clean; snapshot 1200 keys
node scripts/check-changelog-parity.mjs        # all 16 locales at v1.144.0
```

## §1 — What changed

- **`POST /api/portals/toggle { careers_url, enabled }`** (server/lib/routes/portals.mjs) — an explicit user write that surgically flips a company's `enabled:` in `portals.yml` (comment/order-preserving text edit via `setEnabledInRaw`, keyed by exact `careers_url`, `withFileLock`, and **parse-validated** — refuses to write if the result wouldn't re-parse). Same write-through contract as `POST /api/tracker`.
- **Enable / Disable button per company on `#/portals`** (public/js/views/portals.js) with an optimistic toast.
- 5 new i18n keys × 17 (`portals.disable`/`enable`/`enabledToast`/`disabledToast`/`toggleFailed`); snapshot 1195→1200.
- **Scanner unchanged** — `en-scanner.mjs` already filters `companies.filter((c) => c.enabled !== false)`.

## §2 — Manual browser pass (needs a portals.yml with tracked companies)

1. **`#/portals`** — each company row has a **Disable** (if watched) or **Enable** (if disabled) button, next to its badge. A company with no `careers_url` shows a disabled button.
2. Click **Disable** on a company → toast "the scanner will skip it"; the row's badge flips to "disabled"; re-open `portals.yml` — the entry now has `enabled: false`, and everything else (comments, other companies, key order) is unchanged.
3. Click **Enable** → round-trips back.
4. **Scan honors it** — run a scan (`#/scan` → Scan): a disabled company contributes no results; re-enable it and it's back.
5. **Localization** — non-EN locale: the button + toasts are translated; RTL (العربية) mirrors.
6. **No console errors.**

## §3 — Invariants

- **Parent write is surgical + safe** — only the one `enabled:` line changes; a malformed edit that wouldn't parse is refused (no write). Comments/ordering preserved (not a yaml round-trip).
- **SSRF / read-only elsewhere** — the health probe route is unchanged; the toggle is the only new write, gated on an explicit user click.
- **i18n parity** — 17 locales, audit clean, snapshot 1200.

## §4 — Not in this release (see `docs/UX-ROADMAP.md`)

The **scan-filter visual redesign** and moving `#/portals` fully into a settings nav section are a later Phase-4 slice (subjective/cosmetic — want your eye). Interactive stats charts (Phase 3). Nous Research / Hermes → Phase 5 / 5b.

## §5 — Sign-off

Suite **2370** green · toggle writes `enabled` surgically (comments preserved) · parse-validated / 404 on unknown · scanner skips disabled · localized button+toasts ×17 · 0 console errors · i18n 17/17 · CHANGELOG parity ×17.
