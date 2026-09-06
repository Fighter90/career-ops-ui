# QA REGRESSION PROMPT — career-ops-ui **v1.169.0** (D-5: inline PDF preview)

**Audit finding (LOW — `FIX-PROMPT-post-v1.158.0.md` SHIP 9 / D-5).** PDF exports were served `Content-Disposition: attachment`, so even the `#/cv` "Open" link downloaded the file — while the docs stress "Review it before sending it anywhere". Route + client fix.

- **Under test:** `package.json` **1.169.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2432, exit 0 (capture $? directly, never | grep)
node --test tests/output-pdfs.test.mjs tests/path-traversal.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.169.0
```

## §1 — Fix

- `GET /api/output/pdfs/:name?inline=1` (or `?disposition=inline`) serves the SAME `sanitizePathName`-validated file with `Content-Disposition: inline`, so the browser renders it in a new tab. The default (no param) stays `attachment` (download).
- `#/cv` generated-PDF list: the first button is now **👁 Preview** → `?inline=1` (`target=_blank`); **⬇ Download** unchanged. `cv.openPdf` reworded "Open" → "Preview" ×17.

## §2 — Manual pass

1. **`#/cv`** — after generating a PDF, the list shows **👁 Preview** + **⬇ Download**. Preview opens the PDF **rendered in a new tab** (not a download); Download still downloads.
2. **Direct** — `GET /api/output/pdfs/<name>?inline=1` → `Content-Disposition: inline`; without the param → `attachment`.

## §3 — Invariants

- **Security unchanged** — same `sanitizePathName` gate; `?inline=1` still rejects non-`.pdf` (400) and path traversal. `inline` only changes the disposition header on the user's own `application/pdf` file (no HTML → no XSS). No CSP change.
- **i18n** — one existing key reworded ×17; no new keys (snapshot **1219**).

## §4 — Sign-off

Suite **2432** green · `?inline=1` → inline, default → attachment · path/name guards hold under `?inline=1` · `#/cv` Preview renders in-tab, Download downloads · parity ×17. **Closes SHIP 9 / D-5 (LOW).**
