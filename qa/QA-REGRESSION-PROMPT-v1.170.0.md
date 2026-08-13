# QA REGRESSION PROMPT — career-ops-ui **v1.170.0** (P4-ETA: generation ETA hints)

**Audit finding (LOW — `FIX-PROMPT-post-v1.158.0.md` SHIP 9 / P4-ETA).** Heavy AI generations showed a bare "Generating…" with no ETA/percentage (career-plan ~40 s observed). Each long-generation page now carries an honest `⏱ ~Ns` hint, reusing the `#/auto` ETA idea. Client-only.

- **Under test:** `package.json` **1.170.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2434, exit 0 (capture $? directly, never | grep)
node --test tests/generation-eta-hint.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.170.0
```

## §1 — Fix

- A muted `.eta-hint` span (`⏱ ~Ns`) sits next to the generate button on: `#/career-plan` (~40 s), `#/orientation` (~30 s), `#/stats` market report (~30 s), `#/networking` (~30 s), `#/two-pager` AI-fill (~20 s). Mirrors the `#/auto` `.auto-eta` pattern (sets expectations before the click).
- Two generic i18n keys carry it: `common.eta` (`~{n}s`, substituted per page) and `common.etaTitle` ("Typical generation time"). The `.eta-hint` style joins the existing `.auto-eta, .advisor-eta` rule (muted, `align-self: center`).

## §2 — Manual pass

1. **Each of the 5 pages** — the `⏱ ~Ns` hint shows next to the generate button (before clicking); `title` shows "Typical generation time". Clicking still generates as before.
2. **Locale + RTL** — the hint is localized (`~{n}s` → e.g. `약 40초` / `~40 с` / `~40 ثانية`) and mirrors correctly in `ar`.

## §3 — Invariants

- **Client-only** — no route, CSP, SSRF, or parent-write change. +2 i18n keys ×17 (`common.eta`, `common.etaTitle`); snapshot **1219 → 1221**, parity ×17.
- **No behaviour change to generation** — the hint is a static, non-interactive label; the busy state / generation flow is unchanged.

## §4 — Sign-off

Suite **2434** green · `⏱ ~Ns` hint on all 5 long-generation buttons · localized ×17 + RTL-correct · generation flow unchanged · parity ×17. **Closes SHIP 9 / P4-ETA (LOW).**
