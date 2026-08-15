# QA REGRESSION PROMPT — career-ops-ui **v1.201.0** (localized tracker headers)

**Fixed.** `parseApplications` read only canonical English column headers, so a `data/applications.md` with non-English or variant headers keyed rows under the wrong names and the SPA (reading `.company`/`.status`/…) rendered **blank columns**. A new `HEADER_ALIASES` fold maps known localized/variant headers onto the canonical field names.

- **Under test:** `package.json` **1.201.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                          # 2563, exit 0 (capture $? directly, never | grep)
node --test tests/tracker-header-aliases.test.mjs # 6 subtests
node --test tests/parsers.test.mjs                # existing parser suite (regression)
node scripts/check-changelog-parity.mjs           # 16 non-EN at v1.201.0
```

## §1 — Change (`server/lib/parsers.mjs`)

- New `export const HEADER_ALIASES` — identity entries (mirroring the parent's `tracker-aliases.json`: `#`/`num`/`date`/`company`/`via`/`role`/`location`/`score`/`status`/`pdf`/`report`/`notes`/`url`) + localized/variant synonyms: `empresa→company`, `puesto`/`position→role`, `estado`/`stage→status`, `fecha→date`, `enlace`/`link→url`.
- `parseApplications` header→key mapping folds each normalized header: `const norm = h.replace(/^#/, 'num').toLowerCase().trim(); return HEADER_ALIASES[norm] ?? norm;`. The `?? norm` keeps unknown/already-canonical headers unchanged.

## §2 — Behaviour

- A tracker with headers `empresa | puesto | estado | fecha | enlace` parses into `.company / .role / .status / .date / .url` (populated, not blank).
- `position` / `stage` / `link` variant headers fold the same way.
- **Regression:** an all-English tracker (`# | Date | Company | Role | Status | URL | …`) parses **byte-identically** to before — every canonical header maps to itself or falls through via `?? norm`; the `#`→`num` normalization is preserved. Unknown columns pass through untouched (no silent drop). No risky mis-map (no `salary`/`recruiter` guesses).

## §3 — Sign-off

Suite **2563** green (+6) · CHANGELOG parity ×17 at v1.201.0 · README badge+banner ×17 · site changelog ×17 · pure parser change, no route change, no new dependency, no parent edits.
