# SPEC — Header role per the parent's convention, language warning, chatter strip — v1.248.7

- **Status:** Done (deployed, prod-verified)
- **Release:** v1.248.7 (PR, tag `v1.248.7`)
- **Related:** fixes the v1.248.6 role-extraction mistake; ta drift recorded as CAR-70
- **Owner:** orchestrator

## Goal

v1.248.6 assumed the report H1 is `# <Role> — <Company>`; the parent's
modes/oferta.md «Report format» defines `# Evaluation: {Company} — {Role}`.
Every auto-pipeline tracker row therefore carried the COMPANY (with the
`Evaluation:` prefix) as the role. Plus: the ta language drift (CAR-70)
needed a surface, and saved reports started with model chatter.

## Scope

1. **Header role** — strip the localized prose label first (`Evaluation:`,
   `Оценка вакансии:`, `Оцінка:` + 13 more locale variants, longest first;
   pattern shape = parsers.mjs prose-label regex with escapeReMeta and the
   full-width colon). After a label: `Company — Role` → role = right side.
   Without a label: `Role — Company` → left side. A part naming
   `guess.company` decides regardless. The role is never the company and
   never a bare label word — the fallback is `cleanRoleLine(guess.role)`.
2. **cleanup-plan line counts** — the per-category numbers now SUM the
   `— N dirty-URL line(s)` / `— N test-row line(s)` counts (the N), not
   count the output lines (a file with 5 dirty URLs reported 1).
3. **Language warning** — the evaluation prompt opens AND closes with a
   mandatory language instruction (whole report, tables included);
   after validation passes the pipeline runs `languageOk(markdown, lang)`
   (the pure module shared with remote-qa) and pushes a
   `report not in <locale>` warning onto the done event + step detail.
   NOT a rejection: the content (A–G + score) already validated.
4. **Chatter strip** — at save, everything before the first `# ` line is
   sliced off (model preambles never carry facts; the header does).

## Verification (real output)

- `npm run test:ci` → **5196 tests / 5193 pass / 0 fail** (5 new tests:
  the four H1 shapes + the English-at-ta warning).
- coverage gate 98.17/89.42 · e2e 21/0 · browser · full · evals 12/0 ·
  link-check «No broken links».
