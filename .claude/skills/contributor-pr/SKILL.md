---
name: contributor-pr
description: Review, merge and release an external contributor's PR in web-ui, then refresh the contributors surfaces (README ×17 + cvstart.org). Trigger when a fork PR appears, the user says "проверь pr и замерж", "merge the contributor PR", or asks to update the contributors list.
---

# contributor-pr — external PR intake pipeline

Proven on v1.125.2 (PRs #144/#145 by @Alien10140 — Gemini defaults + the
headless deep-prompt 502 fix). External code gets a stricter path than our
own branches: fork CI does not auto-run, review claims are verified
empirically, and merges need explicit user authorization.

## Phase 1 — Review (local runs ARE the CI gate)

1. Fork PRs from first-time contributors show **"no checks reported"** —
   GitHub Actions waits for maintainer approval. Don't chase it; the local
   full-suite run below substitutes, and push-CI on main re-validates after
   merge. (Approving runs via `gh api …/actions/runs/<id>/approve` and
   `gh pr merge` are both classifier-blocked for external PRs — when
   blocked, STOP and hand the user the exact commands; never work around.)
2. `git fetch origin pull/<n>/head:pr-<n>` and read the FULL diff. Extra
   scrutiny on LLM surfaces (`prompts.mjs`, `routes/llm.mjs`), sanitizers,
   any new ingress, and i18n snapshot regeneration (dup keys / glosses).
   Check the contributor's tests honor CI isolation (dynamic imports in
   `before()`, `CAREER_OPS_ROOT` mktemp — the paths-once rule).
3. **Verify factual claims against live sources, never training data.**
   v1.125.2 lesson: an AI review called `gemini-3.6-flash` "fabricated" as
   a BLOCKER; fetching https://ai.google.dev/gemini-api/docs/models proved
   the contributor right (3.6-flash Stable, 2.0-flash shut down). Model
   ids, API shapes, deprecations → WebFetch the official docs.
4. Run the full suite on EACH pr-branch: `npm test`, capture the exit code
   directly (never pipe to grep). Record per-branch counts.
5. Before merging, re-check `gh pr view <n> --json headRefOid` still equals
   the SHA you reviewed.

## Phase 2 — Merge

- Needs the user's explicit go for THESE PRs (standing "merge all branches"
  does not auto-extend to external code; the classifier enforces this).
- `gh pr merge <n> --squash --delete-branch`, oldest first; then
  `git checkout main && git pull` (STANDALONE checkout — a checkout inside
  a blocked compound command silently never runs; v1.125.2: a README commit
  landed on the local pr-144 branch that way and had to be cherry-picked).
- Full suite on merged main.

## Phase 3 — Release rollup (patch bump, one release for the pack)

- Add a **drift-gate test** pinning any literal the PR changed across every
  surface it lives on (server fallback ↔ client dropdown ↔ dicts ×17 ↔
  help ×17) — text-extraction, not imports, to dodge paths-once. Regex
  traps: `match()` returns the FIRST `hintFallback:`-style hit in the file —
  slice from the owning field first.
- Sweep stale literals the PR missed (help ×17 carried `gemini-2.0-flash`
  twice per bundle).
- Then the standard ship: CHANGELOG ×17 **crediting the @handle**, banner
  four touch-points ×17 (see parent-sync Phase 3), QA prompt, counts in
  CONVENTIONS/PROJECT-CONTEXT/CLAUDE.md, `npm version`, PR → CI → merge →
  tag → Release → `gh workflow run publish-package.yml --ref vX.Y.Z` →
  wiki → site changelog sync → local redeploy.

## Phase 4 — Contributors surfaces

- **README ×17** — hand-maintained borderless row of circular avatars
  (contrib.rocks was dropped: its ~24h server cache lags new people), in
  the site's contribution order, bots excluded, then a bold localized
  "All contributors →" link to the graph. Template (id via
  `gh api users/<login> --jq .id`; `&output=png` is MANDATORY — JPEG
  avatars have no alpha and the circle corners render white without it):

  ```html
  <a href="https://github.com/<login>" title="<login>"><img src="https://wsrv.nl/?url=avatars.githubusercontent.com/u/<id>%3Fv%3D4&w=160&h=160&fit=cover&mask=circle&output=png" width="80" height="80" alt="<login>"/></a>
  ```

- **cvstart.org** — the landing block bakes GitHub's `/contributors` into
  `facts.json` at Pages build. GitHub recomputes that list asynchronously
  (hours after merge): if a fresh deploy still misses the person,
  re-dispatch `deploy-pages.yml` later or let the weekly cron catch it —
  nothing to fix in code.
- A one-line localized credit also goes in the CHANGELOG entry and the
  README banner lead (Phase 3), not as a standalone line under the block.

## Traps

- A sweep regex that removes "the old avatar line" will also eat a fresh
  table/row cell containing the same `<login>.png` substring — scope
  deletions to the exact line shape, then re-verify cell count ×17.
- Country flags go on language LISTS only; a broad `[label](FILE.md)`
  flag-adder will pollute code-literal links in historical changelog
  entries (438 sites cleaned in v1.125.2).
- contrib.rocks / GitHub stats caches cannot be busted from our side —
  don't burn cache-key variants trying.
