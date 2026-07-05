# CV Doctor — tailor a résumé + cover letter to a JD, with a checklist gate (v1.101.0)

**Status:** Shipped · **Version:** 1.101.0 · **Date:** 2026-07-05

## Problem

The user shared a detailed career-coaching brief (an hh.ru recruiter's method for
reworking résumés and cover letters) and asked to extract the **transferable
mechanic** and build it into the app — **without** any emphasis on their personal
experience, employers, or career track. CV Studio already had diagnostics, a
privacy mask, and a voice-match rewrite, but nothing that *tailors the CV to a
specific posting* or *writes a cover letter*, and nothing that gates the output
against a recruiter-grade checklist.

## Solution — extend CV Studio (no new route module)

### Server (`server/lib/routes/cv-studio.mjs`)

- `TAILOR_INSTRUCTIONS` — the coaching brief distilled into **generic** rules:
  the recruiter model (seconds per résumé, role-match first, top 2–3 jobs read),
  five invariants (relevant-first, role = vacancy role, shorter = stronger, match
  stack/setup, numbers only in results), résumé rules (explicit keywords,
  quantified results with the perfective formula, `NEEDS_METRIC` instead of
  invented numbers, single-language consistency), cover-letter rules (≤ ~150 words,
  hook → stack → **bridge** → close), and a **checklist gate** where `error`s block
  and `warn`s advise. **Zero** hardcoded companies, roles, or tracks.
- `buildTailorPrompt(ctx, jd, headline, lang)` — assembles the instructions + the
  pasted JD + `<project_context>` (the candidate's own CV/profile/two-pager via
  `bundleProjectContext`) + optional headline hint.
- `POST /api/cv-studio/tailor {jd, headline?, run?}` — shared provider cascade,
  manual-prompt fallback with no key, `llmRateLimit`, JD bounded 24 KB, **no file
  writes**. Returns the 3-section Markdown (tailored résumé · cover letter ·
  checklist report with `GATE: PASS|BLOCKED`).

### Client (`public/js/views/cv-studio.js`)

A 4th card, **Tailor to a job**: a JD textarea + optional headline input →
`POST …/tailor {run:true}` → renders the 3-part result with the shared
`report-export.js` bar (Markdown / PDF / **DOCX** / Copy, from v1.100.0). Manual
prompt in a modal when no key.

## Invariants held

- **Source of truth.** Only the candidate's materials + the JD; reorder/reframe/
  emphasise, **never fabricate**; `NEEDS_METRIC` rather than an invented number;
  no authorship claims not already in `cv.md`.
- **Generic.** A regression asserts the distilled instructions contain none of the
  brief's specific employers/tracks.
- **No writes / bounded / rate-limited / CSP-safe.**

## Tests

`tests/cv-studio-routes.test.mjs` +3: `buildTailorPrompt` is generic (gate +
bridge + no-fabrication present, no hardcoded employer), manual-mode seeded from
the candidate materials, too-short JD → 400. 10 new i18n keys ×16
(`cvs.tailor*`). Generic reference doc `docs/prompts/resume-cover.md`. Help §24
extended in place (H3 count unchanged).
