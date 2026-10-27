# SPEC — Language-switch invariants (owner-reported class)

- **Status:** Draft (the reference fix is already on a branch: `fix/scan-lang-switch-state`, PR pending)
- **Release:** v1.261.0
- **Related:** Owner report «при переключении языка некоторый контент не показывается правильно»; CAR-126 sweep; `tests/playwright-lang-switch-scan.mjs`
- **Owner:** orchestrator

## Goal
Switching the UI language never blanks or degrades any view: every data-bearing view re-renders completely in the new locale, with already-loaded content repainted instantly and user selections preserved.

## Context
`I18n.onChange → Router.render()` (app.js) re-creates the entire view on every language switch. Anything declared INSIDE a view's render function is recreated — for #/scan that was the loaded results corpus, the refresh sequence, the error bookkeeping and the three facet-chip sets, so a switch blanked the page until the slow `/api/scan-results` round-trip finished (probe: 304 → 121 words at switch vs 230 on a direct ru load). The reference fix hoists scan state to module level (the pipeline view's established pattern) with a source-static gate plus a behavioral Playwright harness (seeded corpus + a 4 s delayed refetch; the ru results area must paint from module state while the refetch is in flight — red on the old shape).

## Scope
1. Reference fix (already implemented): scan.js state hoist — merge the pending PR.
2. **Sweep harness promoted to a repo gate**: `tests/playwright-lang-switch-sweep.mjs` (opt-in, browser) — for each data-bearing route (scan, pipeline, tracker, reports, portals, stats, config, usage, dashboard) × the en→ru and ru→en pairs: assert the switched render's word count is within 25 % of the direct load's, no page errors, and the chrome locale actually flipped. Routes failing the invariant are listed as violations (this spec's acceptance for v1.261.0: scan green; violations become follow-up tickets, not silent passes).
3. Follow-up tickets: any view the sweep flags (candidates by construction: views with render()-local data caches — audit `let .* = await|\.then\(` inside render functions of the remaining views).

## Out of scope
- Persisting view state across full page reloads (only the in-process re-render path is invariant).
- URL-state preservation on switch (already handled by the v2 views' URL mirrors).
- CAR-137 hint strings.

## Acceptance criteria
1. `tests/scan-lang-switch-state.test.mjs` green (module-level scan state, declared once, rationale documented).
2. `tests/playwright-lang-switch-scan.mjs` green (red verified on the old shape: blank at the assertion window while a 4 s refetch is in flight).
3. `tests/playwright-lang-switch-sweep.mjs` green for scan on both pairs; violations (if any) filed as Linear tickets with route + symptom, each referenced here.
4. `npm run test:e2e:browser` green; no page errors during any switch.

## Plan
- T-1 [done]: scan reference fix (branch pending merge).
- T-2 [flash]: sweep harness (reuse the probe pattern from /tmp/lang-switch-probe.mjs — promote into tests/, drop the hardcoded playwright path, use the resolvePlaywright escape hatch).
- T-3 [orchestrator]: run the sweep; file follow-ups per violation; re-run after each fix.

## Risks and invariants touched
- R-07 (CSP-safe DOM — the harness adds no DOM code); R-08 (locale parity — the switch path renders through the same dicts). Hoisting state to module level must not leak state BETWEEN tests: Playwright contexts are fresh per test but the SERVER process persists — suites seeding different corpora per test must stay in separate files (playwright-scan-filters.mjs and the new lang-switch harness already are).
