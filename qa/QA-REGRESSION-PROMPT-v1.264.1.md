# QA Regression Prompt — v1.264.1

> Release: **v1.264.1** (2026-10-31) · wave PR **#611** (squash → `58a48f15`) + CAR-137/138 tail (exact FAQ counts)
> Prod target: resumecraft.ru = **1.264.1**, parent 1.38.0 @ `0595b5d1`
> Tests: **7075** unit (0 fail) · Playwright **176** · registry 123 = 118 EN + 5 RU · 118 adapters · coverage 98.5/90.1

## What shipped (verify these first)

1. **CAR-203 — sidebar pill truncation.** Switch the UI language to **ru**, look at the sidebar:
   «Профинансированные компании» must show an **ellipsis** inside its pill (no hard clipping),
   and hovering the label shows a **tooltip with the full localized label**. Switch language again
   (en → ru → ar) — the tooltip must follow the active language everywhere (favorites/recents rows too).
   Check: 44 px row height intact, active state paints, RTL (ar) ellipsis on the correct side, mobile drawer fine.
2. **CAR-218 — one 480 s eval ceiling.** Config → set any provider; run one live evaluation.
   No behavioural change for normal runs (90–140 s); the point is that **no locale dies at exactly 300 s**
   anymore. (Historic transients: es/zh-CN `502 · 300 s · 0 ch` on v1.264.0 — those specific locales
   must now survive a slow run.)
3. **CAR-217 — exact FAQ counts on cvstart.org.** Open cvstart.org (EN): the FAQ answer «Which job
   boards can it scan?» must read «**123** job-board sources: **118** international … plus **5** Russian»
   (not «~120 adapters»). Other locales keep the rounded `~…` wording (documented, not a bug).

## Standard sweep (every release)

- [ ] All views render: dashboard, scan, pipeline, reports, tracker, evaluate, deep, cv-studio,
      career-plan, orientation, market, mock-interview, networking, memory, stats, usage, portals,
      funded, interview-digest, activity, config, help, map.
- [ ] All **19 locales** switch cleanly (no Latin leaks in non-Latin locales, RTL holds for ar).
- [ ] Dark/light theme toggle across the touched surfaces (sidebar, tracker, scan, help).
- [ ] Mobile 390 px: sidebar drawer (✕ works), scan table, tracker, help — no horizontal overflow.
- [ ] `#/health` all green; `/api/health` reports `1.264.1`.
- [ ] LLM pages live-evaluate once (any provider) — answer, score block, no warnings band.
- [ ] cvstart.org: landing, /help, /methodology, /changelog (EN paginated mirrors carry 477+1 = **478** entries after this release).

## Browser automation

- Local: `npm run test:e2e:browser` (Playwright 176 + the 3 opt-in skips documented).
- Adversarial pass after deploy: console-error sweep ×7 routes ×4 locales (CSP violations fail),
  390 px sweep over form-bearing routes, keyboard-only pass on the sidebar (focus order, Escape on drawer).

## Not in scope (by design)

- Site i18n copy upgrades (`meta.helpDesc` / `helpTeaser.c1.desc` / `faq.a2`) stay EN-only this release.
- CAR-141 demo video — owner.
- `movesReady` degradation mirror + `code: 'timeout'` branch — documented v1.264.0 decisions.
