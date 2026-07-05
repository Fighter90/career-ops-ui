<!--
  Reference copy of the GENERIC résumé + cover-letter tailoring mechanic that
  powers CV Studio → "Tailor to a job" (POST /api/cv-studio/tailor).

  This is deliberately generic — it hardcodes NO companies, roles, career tracks,
  or personal history. Everything specific comes from the candidate's own
  materials (cv.md / config/profile.yml / config/two-pager.yml, inlined via
  bundleProjectContext) plus the target job description the user pastes.

  Distilled from career-coaching practice into transferable rules. Source-of-
  truth is absolute: reorder, reframe, emphasise — NEVER fabricate a fact,
  metric, employer, date, or authorship claim not already in the materials.

  The live prompt is assembled in server/lib/routes/cv-studio.mjs
  (TAILOR_INSTRUCTIONS + buildTailorPrompt); keep this doc in sync with it.
-->

# Résumé + cover-letter doctor — the generic mechanic

## 0. Recruiter model (why the rules are what they are)

A recruiter spends **seconds** per résumé with ~99 others beside it. They first
check: **does the candidate's role match the vacancy's role?** If not, skip. Then
the eye runs diagonally for matches and reads the **top 2–3 jobs**. The cover
letter is a **teaser** whose only job is to get the résumé opened. Anything not
grasped at a glance does not work.

## 1. Five invariants

1. **Relevant first** — what matches the vacancy goes in the top lines.
2. **Role = role of the vacancy** — headline and titles reflect the role actually
   performed and what the JD asks for; never inflate beyond the evidence.
3. **Shorter = stronger** — cut duplication and walls of text.
4. **Match the stack and setup** — surface the JD's key stack keywords (only those
   the candidate genuinely has), methodology, and team/scale signals.
5. **Numbers only in results** — achievements are quantified with a metric marker
   (✔); never put numbers in plain responsibilities.

## 2. Résumé rules

- Headline = the target role (from the JD / the optional headline hint), using the
  candidate's **real** role, not a paper job title.
- State key stack keywords explicitly so a keyword scan hits them.
- Summary: 1–2 sentences on scale/scope; lead with what the JD prioritises.
- Each job: short project description (NDA-safe) → area of responsibility →
  quantified results. Prefer the perfective formula:
  *"{Built / Introduced / Rolled out} X, which {cut / sped up / automated} Y by
  {Z% | A→B}."*
- Make every metric **specific** ("38% p99", not "improved performance"). If a
  result has no metric in the materials, mark it `NEEDS_METRIC` — never invent one.
- One consistent language of terms in a single document.

## 3. Cover-letter rules

- **Short:** ≤ ~150 words, readable in ≤15 seconds on the diagonal. No long lists
  of domains/projects.
- **Structure, in order:** (1) greeting + one-line hook naming the role and years
  in the domain; (2) a compact inline stack line; (3) the **bridge** (below);
  (4) optionally one line on growth/learning; (5) a one-line close; (6) sign-off.
- **The bridge technique:** pull the key role requirement from the JD, find the
  candidate fact that best meets it, and write **one** sentence linking them —
  *"You wrote you need {REQUIREMENT} — I have exactly that: {FACT}."* If no genuine
  match exists, **do not invent one** — omit the bridge.

## 4. Checklist gate (run before returning)

Score each item PASS/FAIL. **`error` BLOCKS** the output — fix and re-check until
all errors pass. **`warn`** is advisory.

**Résumé** — R1(error): headline = target role · R2(error): the top job's first
1–2 bullets carry the role-relevant signals · R3(error): one consistent term
language · R4(error): numbers only in results, not responsibilities · R5(warn):
every result has a specific metric (else `NEEDS_METRIC`) · R6(warn): each job has a
project description + methodology where the materials allow.

**Cover** — CL1(error): within the word limit · CL2(error): role in the hook = the
vacancy role · CL3(error): a bridge is present when the JD states an explicit role
requirement · CL4(error): no long domain/project list · CL5(warn): one consistent
term language.

## 5. Output

Return exactly three Markdown sections:

```markdown
## 1. Tailored résumé
<Headline, Summary, Experience with ✔ results, Skills, Education>

## 2. Cover letter
<the letter per §3; end with a word count>

## 3. Checklist report
| ID | Severity | Status | Comment |
| -- | -------- | ------ | ------- |
| …  | …        | …      | …       |

ERRORS: n · WARNINGS: m · GATE: PASS|BLOCKED
```

If the gate would be **BLOCKED**, fix the artifacts until all errors PASS, then
return the corrected versions. Use **only** the candidate materials and the JD —
never fabricate facts, metrics, employers, or authorship.
