# CodeQL triage round 2 — hardening (v1.108.0)

**Status:** Shipped · **Version:** 1.108.0 · **Date:** 2026-07-06

## Fixes

1. **unvalidated-dynamic-method-call — `server/lib/prompts.mjs`.**
   `SCAFFOLD_STRINGS.modeRoleLine[lang]` was indexed by a (resolved) locale and
   then *called*. It now resolves by **own key + `typeof === 'function'`**, so a
   tampered `lang` (e.g. `"constructor"`) can never dispatch to a prototype
   method. Same guard applied to `MODE_ARTIFACT[slug]`.

2. **polynomial-redos — `server/lib/routes/runners.mjs`.** The PDF-filename slug
   ran `.replace(/^-+|-+$/g, '')` on the **uncapped** slug — an all-dash input
   could backtrack O(n²). The slug is now capped to 200 chars **before** the
   regex.

3. **type-confusion — `server/lib/cv-import.mjs`.** `importDocumentToMarkdown`
   now coerces an array `filename` (a repeated `X-Filename` header) to a string
   (using the first element), so the extension/format logic never runs on a
   non-string.

## Dismissed (with rationale)

- **remote-property-injection (×8, content.mjs/config.mjs)** — the writes are
  behind the v1.106.0 `UNSAFE_KEY` guard (`__proto__`/`constructor`/`prototype`
  rejected); CodeQL's dataflow doesn't credit the guard. FP.
- **path-injection (×2, help.mjs)** — the locale is sanitized to `[a-zA-Z0-9_-]`
  and resolved against a fixed candidate list; `resolve()` on a sanitized leaf
  can't escape the help dir. FP.
- **xss-through-exception (api.js:452)** — the sink is `createTextNode` (escapes
  automatically). FP.
- **~30 note-level lint** (`unused-local-variable`, `useless-assignment-to-local`,
  etc., mostly in test files) — non-security; tracked as low-priority cleanup.

## Tests

`tests/security-hardening-v1108.test.mjs` (3): array-filename coercion (behavioral),
plus source-pattern guards for the prompts dispatch and the runners slug cap. Full
suite **1704** green.

## Result

The CodeQL backlog went from **167 → ~14** over v1.106–v1.108 (all genuinely
security-relevant findings fixed; the remainder dismissed as documented/
categorical false positives or note-level lint).
