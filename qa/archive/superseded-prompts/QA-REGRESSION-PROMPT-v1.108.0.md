# QA REGRESSION PROMPT — career-ops-ui **v1.108.0** (security hardening, round 2)

Delta regression for three CodeQL fixes. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.108.0**.

## §0 — Gates

```bash
npm test                                       # full suite (security-hardening-v1108 ×3)
node --test tests/security-hardening-v1108.test.mjs tests/cv-import.test.mjs
node scripts/check-changelog-parity.mjs         # all 15 locales at v1.108.0
```

## §1 — What changed (behavior-preserving)

1. **unvalidated-dynamic-method-call** — `server/lib/prompts.mjs`: the locale role-line + mode artifact resolve by **own key + `typeof`** — a tampered `lang`/`slug` (e.g. `"constructor"`) falls back to the default instead of dispatching to a prototype member.
2. **polynomial-redos** — `server/lib/routes/runners.mjs`: the PDF-filename slug is capped to 200 chars **before** the `/^-+|-+$/g` trim, so a huge all-dash slug can't backtrack.
3. **type-confusion** — `server/lib/cv-import.mjs`: an array `filename` (a repeated `X-Filename` header) is coerced to a string (first element), so the extension/format logic never runs on a non-string.

## §2 — Sanity

- Import a `.md` with a normal filename → still converts (passthrough). A duplicated `X-Filename` header no longer crashes the import.
- Generate a PDF (cover letter / report) with a normal title → filename slug unchanged.
- Evaluate/generate in each locale → prompts build correctly.

## §3 — Result

Static-analysis backlog **167 → ~14** over v1.106–v1.108: every genuinely security-relevant finding fixed (router XSS escape, prototype-pollution guards, sanitizer fixed-point, dynamic-dispatch guard, ReDoS cap, type coercion); the remainder are documented/categorical false positives (regex sanitizer, custom rate-limiter, host classification, guarded property writes, sanitized paths) + note-level lint, dismissed with rationale.

## §4 — Sign-off

All §0 gates green · imports/PDF/eval work across locales · full suite 1704 · no new i18n keys.
