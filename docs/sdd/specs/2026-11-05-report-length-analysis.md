# CAR-245 (P2.2) — v1.268.0 report-length regression analysis

**Date:** 2026-11-05 · **Type:** analysis (read-only investigation, no code change)
**Symptom:** v1.268.0 prod regression reports are 1 584–4 634 chars
(zh-CN 1 583, zh-TW 1 714, ja 2 055, max 4 634) vs **13–19 k chars** on
v1.267.2 for the same synthetic JD ×19 locales. A–G headings present; no
fallback-body warnings.

---

## (a) Root-cause verdict

**Primary cause: the render prompt's explicit length cap — deliberate
instruction-level contraction, not truncation, not fallback, not the token
budget.** `server/lib/eval-scoring.mjs` `RENDER_INSTRUCTIONS` bullet 3:

> `• Elaborate each block to at most 5 sentences of grounded prose in the target language …`

and bullet 6:

> `• Output only the seven \`## \` sections, nothing before or after.`

7 blocks × ≤5 sentences ≈ 1.5–4 k chars — exactly the observed band. The old
single-shot prompt said *"output the **full** A-G evaluation per
modes/oferta.md"* with **no length cap** (the only volume budget in the old
prompt was the ta-only CAR-174 line, "max 5 sentences / 900 words", which
never applied to the other 18 locales), and oferta.md's own template directs
tables with row budgets, a Risk Summary, a Machine Summary, a Verdict lead
and the **`## Job Description (archived verbatim)`** section — the JD text
alone is typically 3–10 k chars and was the single largest contributor to the
13–19 k totals. The two-step contract dropped all of those sections from the
render output *and* capped the prose: a structural, instruction-driven
shortening that binds **every** model.

**Secondary contributor: the provider/model switch.** v1.267.2's QA runs and
v1.268.0's runs were not produced by the same model (prod moved to
`deepseek/deepseek-v3.2` via OpenRouter; code defaults are
`deepseek-chat` for the direct DeepSeek provider and that id in
`OPENROUTER_FALLBACK_MODELS`). DeepSeek's house style is more compact, and
`RENDER_TEMPERATURE = 0.3` biases toward terse rendering. This shifts the
*level within* the cap but cannot explain the order of magnitude — the ≤5-sentence
cap does, because no model can exceed it while following instructions.

**Ruled out:**

| Hypothesis | Evidence against |
|---|---|
| Token budget / provider truncation | render `maxTokens = opts.maxTokens \|\| 16384` (32 768 for ta/hi/it/pl/ja via `evalMaxTokens`, threaded at `routes/llm.mjs:288` and `routes/auto-pipeline.mjs:733`). 16 384 tokens ≫ the ~1–3 k tokens a 4 k-char report needs. `openai.mjs:119` detects `finish_reason === 'length'` → `r.truncated`; `eval-two-step.mjs:141` would emit `render cut off at the token ceiling` and retry. Regression carried A–G complete with no such warning. |
| Fallback-body path | `eval-two-step.mjs:144-149`: the server skeleton fallback fires only when `missingBlocks(body).length > 0` **after** one retry; a fallback produces one-line sections (~700 chars total). The 1.6–4 k reports are real prose, and no `render incomplete after retry` warning was reported. |
| Retry path firing | The retry (line 119-121) adds *"Output ALL SEVEN sections … nothing else"* — it fires only on **missing** headings. A short-but-complete report breaks the loop at `missing.length === 0` with no warning; prod had all seven headings. Note the retry's *"nothing else"* wording reinforces the same brevity bias. |
| Scoring-step failure | A failed scoring step throws (`scoring step failed after retry`) — no report at all. Prod produced reports. |

## (b) Evidence

**Scaffolding mass, old vs new (counted from source):**

| | v1.267.2 single prompt (`prompts.mjs`) | v1.268.0 render step (`eval-scoring.mjs`) |
|---|---|---|
| Instruction lines shown to the model | ~79 (37 stable + 32 tail incl. the 7-heading skeleton + 10 reminder) | 16 (11 shared header + 5–6 render bullets + 1-line skeleton/reminder) |
| Output-format directive | "output the **full A-G evaluation per modes/oferta.md**" — inherits oferta.md's whole report template | "Write EXACTLY seven sections … at most 5 sentences … Output only the seven `## ` sections, nothing before or after" |
| Length guidance | none (ta-only volume budget: "max 5 sentences / 900 words") | hard cap ≤5 sentences/block for **all** locales |
| Sections requested | A–G + Verdict lead + Risk Summary + Machine Summary + **JD archived verbatim** | A–G only; header/SCORE_SUMMARY/yaml are server-built (`assembleReport`) |
| Typical output | 13–19 k chars | 1.6–4.6 k chars |

Diff quotes:

- Old (`git show 8449c2425~1:server/lib/prompts.mjs`): `Then output the full A-G evaluation per modes/oferta.md (Role Summary, Match with CV, …) and a 0-5 score.` — plus `evaluationPromptTail`'s seven-heading skeleton and a 4-sentence language reminder.
- New (`eval-scoring.mjs:77-84`): `You will now RENDER an evaluation report body … This is translation and elaboration only` → `• Elaborate each block to at most 5 sentences` → `• Output only the seven \`## \` sections, nothing before or after.`

Both prompts still bundle the same `modes/oferta.md` (via
`bundleProjectContext({ modeSlugs: ['_shared', 'oferta'] })`), but the render
step's closing instruction ("nothing before or after") outranks it, so the
template's tables/archive sections are no longer produced.

**Side effect worth noting:** v1.268.0 reports no longer carry a
`## Job Description (archived verbatim)` section — the #2789 archival
contract lives in the parent's mode/pipeline surfaces, so nothing enforces it
on the web-ui two-step path; report length is only one consequence of the
leaner contract.

## (c) Recommendation — minimal change to restore ≥8 k-char median

Edit **only** `RENDER_INSTRUCTIONS` in `server/lib/eval-scoring.mjs` (the
EN shared header is cache-stable across locales — CAR-111 parity is kept as
long as the edit lands there and not in a per-locale tail):

1. Replace the ≤5-sentence bullet with a floor+target band, e.g.:

   ```
   • Elaborate each block to 3–6 substantive bullets of grounded prose in the
     target language (target 1 500–2 500 words for the whole body): name the
     concrete JD requirements, the CV evidence that meets or misses each, and
     the risk. Ground every claim in the documents; never pad.
   ```

2. Add per-section minimums so no block collapses to one line:

   ```
   • Every section carries at least 3 bullets; Block B (Match with CV) and
     Block E (Customization Plan) each name specific cv.md bullets by content.
   ```

3. Re-add the JD archive as a **server-side** assembly step, not a render
   instruction: the render step must stay "seven sections only" (it is what
   makes the machine surface locale-stable), but `assembleReport` can append
   `\n## Job Description (archived verbatim)\n\n<jd>\n` from the `jd` it
   already receives — restoring the 3–10 k-char archival section and closing
   the #2789 gap with zero model variance. This single change alone moves the
   median above 8 k chars deterministically.

Expected effect: floors give ~1.5–2.5 k chars of prose, the archive adds
3–10 k ⇒ median lands in the old 13–19 k band or slightly below it — above
the 8 k target either way. Keep `RENDER_TEMPERATURE` and the scoring step
untouched; keep the retry wording ("Output ALL SEVEN sections") as-is — it is
a structural, not length, guard.

Red-first gate to add: a unit test pinning `RENDER_INSTRUCTIONS` against a
length-floor marker (mirror `tests/prompt-skeleton-drift.test.mjs`), plus a
fixture assertion that a render of the full scoring JSON for the synthetic QA
JD exceeds 8 000 chars.

## (d) CHANGELOG Notes entry — yes

This is a shipped user-visible behavior change (report body ~4× shorter, JD
archive no longer in web-ui reports), not a bug fix: the v1.268.0 CHANGELOG
entry should gain a **Notes** bullet, e.g. *"Notes: two-step evaluation
reports are deliberately leaner than the v1.267.2 single-shot ones — seven
prose sections capped at 5 sentences per block, machine surface server-built;
the JD-verbatim archive section is currently not part of the web-ui report
body."* A Notes line is required by the ship-train convention ("Notes must
name what is deliberately *not* done") and this is exactly such a case.
