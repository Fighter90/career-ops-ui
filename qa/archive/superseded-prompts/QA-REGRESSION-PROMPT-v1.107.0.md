# QA REGRESSION PROMPT — career-ops-ui **v1.107.0** (sanitizer hardening)

Delta regression for `stripDangerousMarkdown`. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.107.0**.

## §0 — Gates

```bash
npm test                                       # full suite (cv-xss-bypasses +3)
node --test tests/cv-xss-bypasses.test.mjs tests/cv-xss.test.mjs tests/jd-sanitize.test.mjs
node scripts/check-changelog-parity.mjs         # all 15 locales at v1.107.0
```

## §1 — What changed (behavior-preserving for valid markdown)

`server/lib/security.mjs::stripDangerousMarkdown` (at-rest XSS defense-in-depth):
1. Tag strip runs **to a fixed point** (repeat-until-stable, ≤8 passes) — a removal that reforms a payload (`<scr<script></script>ipt>`) is now caught.
2. End-tag patterns use `[^>]*>` — `</script foo>` / `</script\n bar>` are removed.
3. An **unclosed** executable opener (`<script …>` with no closing tag) is stripped.

## §2 — Sanity

- `stripDangerousMarkdown('<script>alert(1)</script foo>')` → no `<script`.
- `stripDangerousMarkdown('<scr<script></script>ipt>alert(1)</scr<script></script>ipt>')` → no `<script`.
- `stripDangerousMarkdown('<script src="//evil">alert(1)')` → no `<script`.
- Plain CV markdown (`# Hello`, `**bold**`, `&copy; 2026`) round-trips unchanged.

## §3 — Note

The authoritative XSS boundary is output-escaping (`UI.md` escape-firsts all markup on render). This change strengthens the *at-rest* guarantee for consumers that bypass the renderer and closes the matching CodeQL findings (bad-tag-filter, incomplete-multi-character-sanitization on security.mjs).

## §4 — Sign-off

All §0 gates green · the three new bypass classes are stripped · valid markdown unchanged · full suite 1701 · no new i18n keys.
