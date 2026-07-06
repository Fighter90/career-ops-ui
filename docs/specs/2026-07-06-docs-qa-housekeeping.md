# Docs & QA housekeeping (v1.110.0)

**Status:** Shipped · **Version:** 1.110.0 · **Date:** 2026-07-06 · **No code change.**

## What

A documentation-only release closing the parity gap that opened while shipping
v1.98→v1.109 (each feature's help paragraph landed in `en.md`; the QA prompts
still named v1.97).

1. **QA prompts refreshed.**
   - `qa/QA-REGRESSION-PROMPT.md` → **v1.109.0**: header/gates/exit-criteria
     updated (baseline 1706, 30 routes, CodeQL backlog note), plus a new **§14**
     that drives verification of everything added v1.98→v1.109 (bug reporter,
     portals health, two-pager export + auto-fill, CV Doctor, docs assistant,
     AI CLI tools, company logos, AI usage & cost, security hardening, scan
     Exclude + pipeline overview) with the new-routes list.
   - `qa/UX-AUDIT-PROMPT.md` + `qa/DESIGNER-EXPORT-PROMPT.md` (perennial) — the
     product-surface tables gained the v1.98–v1.109 pages so an audit covers them.

2. **Help ported to all 16 languages.** The in-place feature paragraphs added to
   `docs/help/en.md` over v1.100–v1.109 — Ask the docs (§1), AI CLI tools +
   company logos (§2), AI usage & cost (§6), scan Exclude (§7), pipeline overview
   (§8), two-pager export + auto-fill (§21), CV Doctor / Tailor to a job (§24) —
   are now translated into all **15** non-English bundles. Inserted after each
   section's first paragraph; **H2/H3 structure counts unchanged** (help gates
   green). Idempotency markers stripped before shipping (they'd escape-render).

## Invariants

- No code, no i18n dict keys, no route changes. Full suite unchanged at **1706**.
- Help gates (`canonical-docs-coverage`, `help-ui`, `help-ru-config-section`,
  `locales-de-it-tr`) green — the ports add paragraphs, never headings.
