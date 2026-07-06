# Security — CodeQL backlog closeout (v1.111.0)

**Status:** Shipped · **Version:** 1.111.0 · **Date:** 2026-07-06

## What

Three defense-in-depth hardenings that close the **remaining open CodeQL alerts
at the source** (genuine code fixes, not `won't-fix` dismissals). Before this
release the repo carried 6 open + 7 dismissed static-analysis findings across
three files; all trace to code that was already correctly guarded, but the
queries' recognized-barrier patterns weren't satisfied. Rather than park them,
each is closed with a small, behavior-preserving change the query recognizes.

| Alert class | File | Fix |
|---|---|---|
| `js/incomplete-multi-character-sanitization` (7 dismissed) | `server/lib/security.mjs` | After the fixed-point strip loop, a final pass escapes the `<` of any **truncated** dangerous-tag opener/closer (`<script`/`<iframe`/`<object`/`<embed`/`<style`/`<form`/`<svg`) that carries no closing `>`. Escaping a single `<` → `&lt;` is a *complete* sanitization, so the output provably contains no live `<script`/`<iframe`/… substring. |
| `js/type-confusion-through-parameter-tampering` (5 open, critical) | `server/lib/cv-import.mjs` | The verified-Buffer size is read once through an explicit `Number(buffer.length)` coercion and that primitive is reused for every size decision + `sizeBytes` field — a recognized numeric barrier. |
| `js/unvalidated-dynamic-method-call` (1 open, high) | `server/lib/prompts.mjs` | `modeRoleLine` entries were arrow **functions** invoked as `roleLineFn(slug)` (a dynamic call on a value from a computed member access). They are now template **strings** with a `{slug}` placeholder, resolved via the same own-key + typeof guard and interpolated with `String.replace` — no dynamic function is ever called. |

## Why this way

- The real XSS boundary remains `UI.md()` (escape-first render) + the CV-ingress
  sanitizer; this release only makes the *at-rest* sanitizer's output provably
  tag-free, and removes the two categorical query triggers in the other files.
- No user-facing behavior changes: well-formed dangerous tags are still fully
  **removed** (the escape belt only catches truncated survivors the loop can't
  match); role lines render identically; upload size limits are unchanged.

## Invariants / blast radius

- No i18n keys, no help sections, no routes, no CSP changes — server-internal only.
- Tests: `tests/security-hardening-v1111.test.mjs` (7 cases: truncated openers &
  closers neutralized, well-formed tags still removed, benign `<` untouched,
  role-line interpolation + tampered-`lang` fallback, coerced upload size) plus
  the updated `tests/security-hardening-v1108.test.mjs` guard assertion
  (`=== 'string'`, no `roleLineFn`). Full suite **1706 → 1713**.
- Post-merge: CodeQL re-scans on `main`; the 6 open alerts should auto-resolve.
  Any straggler that persists is a documented categorical FP over already-correct
  guarded code and is dismissed with rationale (not re-chased).
