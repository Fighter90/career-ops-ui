# stripDangerousMarkdown — fixed-point + end-tag hardening (v1.107.0)

**Status:** Shipped · **Version:** 1.107.0 · **Date:** 2026-07-06

## Problem

`server/lib/security.mjs::stripDangerousMarkdown` is the documented **at-rest**
XSS defense-in-depth (the client renderer `UI.md` escape-firsts everything, but
the file must also be safe for any consumer that bypasses the renderer). CodeQL
flagged two genuine weaknesses in its regex tag-stripper:

- **bad-tag-filter** — `<\/script\s*>` doesn't match `</script foo>` /
  `</script\n bar>`, so a script closed with a trailing token/attribute survived.
- **incomplete-multi-character-sanitization** — a single strip pass can *reveal*
  a new match: removing the inner pair from `<scr<script></script>ipt>` reforms
  `<script>…</script>`, which the one-pass strip then leaves behind.

## Fix

- The strip now runs **to a fixed point** — `do { … } while (changed && passes < 8)`
  — so reformed payloads are removed on subsequent passes.
- End-tag patterns use `<\/tag[^>]*>` instead of `\s*>`, catching `</script foo>`.
- An **unclosed** executable/embedding opener (`<script …>` / `<iframe …>` / … with
  no closing tag in the input) is now stripped too, so a downstream consumer can't
  complete it.

Behavior for valid CV/JD markdown is unchanged (CVs don't contain legitimate
`<script>`); the strip only ever removes *more*.

## Tests

`tests/cv-xss-bypasses.test.mjs` +3: end-tag-with-junk variants, the
single-pass-reveals-a-payload nested case, and the unclosed-opener case. The
existing XSS/sanitize suites (`cv-xss`, `jd-sanitize`) still pass. Full suite
**1701** green. No new i18n keys.

## Note

Regex-based HTML sanitization is inherently incomplete — this remains
**defense-in-depth**; the authoritative XSS boundary is output-escaping (`UI.md`
on the client, which escape-firsts all markup). This change closes the specific
CodeQL findings and genuinely strengthens the at-rest guarantee.
