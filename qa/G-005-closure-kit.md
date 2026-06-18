# G-005 closure kit — report blocks A-G → canonical A-F

**Status:** open since v1.27 · Severity: Minor (cross-repo) · the
**single** remaining backlog item after the P-31 program (WS0–WS11,
v1.31→v1.54).

**What it is.** Canonical [career-ops.org/docs apply-for-a-job](https://career-ops.org/docs/introduction/guides/apply-for-a-job)
specifies a **6-block A–F** evaluation report. The parent project's
`Fighter90/career-ops :: modes/oferta.md` still emits the legacy
**7-block A–G** schema (`C=Risks`, `F=Verdict`, `G=Legitimacy`). The
web-ui renderer is **schema-tolerant** — it displays both A–G and A–F
reports correctly — so this is cosmetic/nomenclature drift, not a
functional break. It can only be fully closed by a coordinated parent
commit **first**, then a one-shot web-ui follow-up.

This kit is the ready-to-apply spec for both halves.

---

## Why it isn't shipped pre-emptively

`server/lib/prompts.mjs` builds the manual-mode `/api/evaluate` prompt
as *"output the full **A-G** evaluation **per modes/oferta.md**"*. If
the web-ui flips to "A-F" while the parent `modes/oferta.md` it
references still defines A-G, the model gets contradictory instructions
(prompt says A-F/STAR, the referenced mode file says A-G/Verdict/
Legitimacy) — strictly worse drift. So the web-ui patch lands **only
after** the parent commit, as a single reviewed step.

The help bundles (§9 ×8) were **already realigned to canonical A-F in
v1.15.0** with a backward-compat note — no help change is needed; this
is verified in `tests/canonical-docs-coverage.test.mjs`.

---

## STEP 1 — Parent repo (`Fighter90/career-ops`) — NOT this repo

> CLAUDE.md hard rule #1: this repo never edits the parent. A maintainer
> applies this in `Fighter90/career-ops`.

Rewrite `modes/oferta.md` so the evaluation output is the canonical
**A–F** schema (matches career-ops.org/docs and web-ui help §9):

| New | Block | Was (A–G) |
|---|---|---|
| A | Role Summary — 3-bullet recap, risks inline | A (same) |
| B | CV Match — top 3 hit + top 3 missing | B (same) |
| C | **Strategy** — apply now / contacto / deep / skip | C was `Risks` |
| D | Compensation — vs `compensation.target_range` | D (same) |
| E | **Personalization** — angle, archetype framing, hooks | E was `Application Strategy` |
| F | **STAR stories** — 1–3 ready-to-paste S-T-A-R blocks | F was `Verdict` |
| — | *(removed)* | G was `Posting Legitimacy` |

- **Drop block G** (Posting Legitimacy).
- **Move score + legitimacy to the report header**:
  `score: 4.2/5` · `legitimacy: High|Medium|Low`.
- Commit message: `fix(modes): realign oferta.md report to canonical A-F (closes web-ui G-005)`.

## STEP 2 — web-ui (this repo) — apply ONLY after Step 1 is merged

Single source-edit. `server/lib/prompts.mjs` — the only remaining
A-G nomenclature in web-ui:

```diff
- Then output the full A-G evaluation per modes/oferta.md (Role Summary, CV Match, Risks, Compensation,
- Application Strategy, Verdict, Posting Legitimacy) and a 0-5 score.
+ Then output the full A-F evaluation per modes/oferta.md (Role Summary, CV Match, Strategy,
+ Compensation, Personalization, STAR stories). Put the 0-5 score and legitimacy in the report header.
```

- `docs/help/*.md` §9 ×8 — **no change** (already canonical A-F since
  v1.15.0; the backward-compat note stays — old A-G reports still render).
- The renderer stays schema-tolerant — **no change** (graceful degrade
  for pre-realignment reports is a permanent contract).

## STEP 3 — Lock it (new test, ship with Step 2)

Add `tests/oferta-report-schema.test.mjs`:

- `prompts.mjs` must NOT contain `A-G` / `Verdict` / `Posting Legitimacy`
  in the oferta prompt block; MUST contain `A-F` + `Strategy` +
  `Personalization` + `STAR`.
- help §9 ×8 still carries the "canonical career-ops.org A-F" heading
  and the pre-v1.15 backward-compat note (renderer contract intact).
- Bundle as its own release: `chore: vX.Y.0 — close G-005 (A-F realign)`
  + CHANGELOG ×8 + Playwright manual-mode evaluate spot-check.

## Verification (after Step 2)

```bash
grep -n 'A-G\|Posting Legitimacy\|Verdict' server/lib/prompts.mjs   # → no oferta-block hits
node --test tests/oferta-report-schema.test.mjs                      # green
npm run test:ci                                                      # green, parity all 8
# Playwright #/evaluate (no key) → manual prompt names A-F blocks
```

When Steps 1–3 land, G-005 closes and the backlog is **empty**.
