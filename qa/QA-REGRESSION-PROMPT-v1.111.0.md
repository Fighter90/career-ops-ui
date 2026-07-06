# QA REGRESSION PROMPT — career-ops-ui **v1.111.0** (Security: CodeQL backlog closeout)

Delta regression for a **server-internal security** release — no user-facing change.
Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.111.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates
```bash
npm test                                        # full suite (≥1713; new: security-hardening-v1111 ×7-8)
node --test tests/security-hardening-v1111.test.mjs tests/cv-xss-bypasses.test.mjs tests/cv-xss.test.mjs
gh api "repos/Fighter90/career-ops-ui/code-scanning/alerts?state=open" --jq 'length'   # expect 0
```

## §1 — What changed (three defense-in-depth hardenings)
1. **`security.mjs`** — after the fixed-point strip loop, `stripDangerousMarkdown` escapes the `<` of any **truncated** dangerous-tag opener/closer (`<script`/`<iframe`/`<object`/`<embed`/`<style`/`<form`/`<svg` with no closing `>`). The output provably contains no live `<tag` substring.
2. **`cv-import.mjs`** — the verified-Buffer size is read once via `Number(buffer.length)` and reused for the empty / >10 MB checks + `sizeBytes`.
3. **`prompts.mjs`** — `modeRoleLine` entries are template **strings** interpolated with `String.replace`, not stored functions (no dynamic dispatch).

## §2 — Verify (must all hold)
- **CV markdown still safe at rest:** paste a CV containing `<script>…</script>`, `<script` (no `>`), `<iframe src=…`, and entity-encoded `&lt;script&gt;` → `PUT /api/cv` → re-`GET`; no live dangerous tag survives; well-formed tags are fully removed; benign `3 < 5` prose is untouched.
- **Uploads still size-gated:** empty file → "empty"; >10 MB → "too large"; a normal `.md`/`.pdf`/`.docx` imports with a numeric `sizeBytes`.
- **Mode prompts render identically per locale:** every `#/<mode>` page (contacto, cover, followup, interview-prep, patterns, project, training) produces its role line in the active language; a nonsense/hostile `lang` falls back to English, never throws.
- **CodeQL:** 0 open alerts post-merge (5 of 6 fixed at source; 1 categorical `type-confusion` FP dismissed with rationale).

## §3 — Sign-off
All §0 gates green · CV XSS-at-rest intact · uploads gated · mode prompts per-locale · 0 open CodeQL alerts · no i18n/help/route/CSP change.
