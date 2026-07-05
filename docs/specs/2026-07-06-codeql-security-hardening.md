# CodeQL triage — security hardening (v1.106.0)

**Status:** Shipped · **Version:** 1.106.0 · **Date:** 2026-07-06

## Problem

The repo carried ~167 open CodeQL alerts. The overwhelming majority are false
positives on a heavily-reviewed codebase (the scanner's legitimate `data/*`
reads/writes, `url.includes()` on trusted ATS hosts, sanitized path resolution,
`createTextNode`-is-safe). A triage pass separated the **genuinely fixable** from
the noise.

## Real fixes

1. **xss-through-exception — `public/js/router.js`.** The route-render error path
   interpolated `${(err && err.message) || err}` straight into `innerHTML`. A
   server error can echo user-supplied input, so the message is untrusted. It now
   goes through an escaper (`UI.escapeHtml`, with an inline fallback) before
   reaching `innerHTML`. The i18n title/labels are app-controlled but escaped too.

2. **Prototype-pollution guards — `content.mjs` + `config.mjs`.** `setArray` and
   `setDotted` walk a dotted path and write `node[key]`; the env-apply loop writes
   `process.env[k]`. The keys come from **fixed field specs / an allowlisted env
   map**, not raw request keys — so this is belt-and-braces — but they now reject
   `__proto__` / `constructor` / `prototype` so a property write can never target
   the prototype chain.

## Dismissed as false positives (with rationale)

- **`js/missing-rate-limiting` (×36)** — routes carry the project's custom
  `llmRateLimit`, which CodeQL doesn't credit; read-only GETs don't need it.
- **`js/http-to-file-access` / `js/file-access-to-http` / `js/file-system-race`
  (×38)** — the zero-token scanner legitimately reads/writes `data/*`
  (scan-history, quarantine, snapshots); the existsSync-then-read patterns are
  single-process and benign.

## Tests

`tests/security-hardening-v1106.test.mjs` (3 source-pattern guards, matching the
`router.test.mjs` convention for client-side / helper-internal checks): the error
escaper is present and the raw form is gone; both content.mjs writers guard unsafe
keys; config.mjs skips prototype keys. Full suite **1698** green.

## Not done here

The remaining alerts (lint-grade `unused-local-variable`/`useless-assignment`,
and the `incomplete-sanitization`/`url-substring`/`regexp-anchor`/`bad-tag-filter`
patterns) are lower-value and need a careful per-alert pass; tracked for a future
cleanup rather than blanket-dismissed.
