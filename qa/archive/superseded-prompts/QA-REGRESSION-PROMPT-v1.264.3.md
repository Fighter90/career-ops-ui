# QA Regression Prompt — v1.264.3

> Release: **v1.264.3** (2026-11-01) · hardening-wave PR (rate-limit fleet: 6 agent branches integrated)
> Prod target: resumecraft.ru = **1.264.3**, parent 1.38.0 @ `0595b5d1`
> Tests: **7096** unit (0 fail) · Playwright **176** (174 harness: 173 pass / 0 fail / 1 opt-in skip · + e2e 21/0 · e2e-comprehensive 23/23) · registry 123 = 118 EN + 5 RU · 118 adapters · coverage **98.46/90.10** · evals 14/0/1skip
> Playwright arithmetic: 176 = the `test:e2e:browser` TAP total of **174** (173 pass / 0 fail / 1 skip — the
> opt-in `SCAN_REDESIGN_CAPTURE=1` layout-capture test in `scan-redesign-layout.test.mjs`) plus
> `tests/e2e.mjs` (21 checks) and `tests/e2e-comprehensive.mjs` (23 steps), each counted as one script-level pass.

## What shipped (verify these first)

1. **Rate-limit coverage ×47.** Pick three mutating actions in the UI and repeat one rapidly (>60/min is
   hard manually — verify via `WRITE_RATE_LIMIT=3/60s npm start` instead): the 4th write returns a JSON
   **429** with `Retry-After`; a *different* route stays usable (per-route buckets). Smoke the big three
   for regressions: evaluate a JD (`/api/evaluate`), run the auto-pipeline once, save the CV — all still
   work normally at human cadence.
2. **`TRUST_PROXY` is a no-op by default.** Local run without the env behaves exactly as before
   (loopback, no warnings in the server log). With `TRUST_PROXY=1` behind a proxy, per-client buckets
   key on the right-most XFF entry.
3. **cvstart.org copy feedback 2 s (CAR-141).** Click «Скопировать команду»: the ✓ + «Скопировано» state
   holds **2 seconds** (was 1.5 s) in any locale, `aria-live` announcement fires once, re-click restarts
   cleanly.
4. **Help §19/§32 ×19.** Open `#/help` in ru / de / ar: «на 19 языках» / «in 19 Sprachen» / «التسع عشرة» —
   the language enumeration names தமிழ் and Tiếng Việt everywhere; §32 says the guide ships in 19.

## Standard sweep (every release)

- [ ] All views render; 19 locales switch cleanly (no Latin leaks, RTL holds); dark/light across sidebar/tracker/scan.
- [ ] Mobile 390 px: sidebar drawer, scan table, tracker — no horizontal overflow.
- [ ] `#/health` all green; `/api/health` reports `1.264.3`.
- [ ] cvstart.org: /changelog paginated mirrors stamped `v1.264.3` on every page.
- [ ] README ×19 banners name v1.264.3 (lead) / v1.264.2 (previous); badges say tests-7096 / release-v1.264.3.

## Not in scope (by design)

- The parent-sync wave per the recorded port-list (fork sync past upstream `a9476866` is a prerequisite; personio language-dedup deferred to its own release) — BACKLOG.
- CAR-141 demo video — owner-deferred («видео не надо пока», 2026-11-01).
