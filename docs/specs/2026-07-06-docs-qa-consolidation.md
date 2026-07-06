# Docs & QA consolidation (v1.112.0)

**Status:** Shipped · **Version:** 1.112.0 · **Date:** 2026-07-06 · **No user-facing code change.**

## What

A documentation + test-coverage release that brings the SDD reference and the
whole-project QA prompt back in sync with the shipped surface, and closes a
coverage gap flagged in the v1.111.0 code review.

1. **SDD conventions refreshed** (`docs/sdd/CONVENTIONS.md`):
   - Route-module list corrected from a stale **24** to the current **30**
     (adds `cli-detect`, `docs-assistant`, `export`, `logos`, `portals`, `usage`
     and the `cv-studio` tailor endpoint), each with a one-line contract.
   - Test-baseline line updated to **v1.111.0 / 1713** with a v1.110/v1.111 note.

2. **Master QA prompt consolidated** (`qa/QA-REGRESSION-PROMPT.md`) so it stands
   alone as the single regression prompt for **all** functionality:
   - §7 release mechanics destaled: v1.111.0, `parentVersion` 1.17.0,
     **release-event-triggered publish** (no manual `gh workflow run` — it races
     to an E409), 30 route modules.
   - §14 additions table corrected — the scan **Exclude** row was mislabelled
     v1.111.0 by a global version-bump; restored to **v1.109.0** — and extended
     with a new **v1.111.0 CodeQL closeout** row.
   - §8/§14 headers moved to the v1.98→v1.111 range.
   - A versioned milestone snapshot `qa/QA-REGRESSION-PROMPT-v1.110.0.md`
     (the v1.98→v1.110 feature run) shipped alongside in v1.111.0.

3. **Coverage test** (`tests/security-hardening-v1111.test.mjs`): a case for the
   `sizeBytes > MAX_UPLOAD_BYTES` branch of `cv-import.mjs` after the v1.111
   `Number()` coercion — the one gap the code review noted. Suite **1713 → 1714**.

## Invariants

- No routes, no i18n keys, no help H2/H3 changes, no CSP changes.
- Help bundles remain gate-locked at **28 H2 / 102 H3** across all 16 locales.
- CHANGELOG ×16 + README ×16 bumped with native "New:" trailers (no English leak);
  parity gate green.
