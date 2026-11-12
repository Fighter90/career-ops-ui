# QA regression prompt — v1.271.16

**The parent-sync wave: a NEW rexx-systems scan source + four provider fixes, shipped by a 6-agent swarm.**

## §0 Gates

- `npm run test:ci` — **8583 tests / 8561 pass / 0 fail** (CI × Node 18/20/22, run 43310036925). Playwright **210 / 209 pass / 0 fail / 1 opt-in skip** (same run).
- Coverage: rexx 98.47/93.06, adapter 100 — no new exemptions.

## §1 What changed (spot-check these live)

1. **rexx** appears in the `#/scan` Source dropdown (live registry + FALLBACK) and on cvstart.org's source table.
2. **Lever salaries** — scan a Lever board; the comp column shows annualized ranges (an hourly wage ×2080), never raw hourly figures.
3. **Workable / BambooHR dedup** — unchanged behavior; listingIdentity is internal (URL dedup fallback intact for id-less rows).
4. **Avature** — a board whose page links are all non-http(s) continues walking (no premature end).
5. **Gupy** — `confidencial_logo.png` / confidencia-tenant rows no longer surface.

## §2 Invariants

- Registry **141 = 136 EN + 5 RU · 136 adapters**; all five count gates green (adapter-registry, scan-sources-endpoint, scan-fallback-sources, site-sources, help-source-counts ×19).
- RU sources unchanged (geekjob, getmatch, habr-career, hh.ru, trudvsem).
- No security-envelope changes; `_shape` guards untouched; fetchImpl injectability preserved.

## §3 Not ported (deliberate)

See CHANGELOG Notes: modes/in+at (parent prompts), dashboard Inbox (Go TUI), non-board throw (already `_shape`-covered since v1.242.0), seek_searches/pracecz (no such readers/sources here), evaluator/batch/latex CLI fixes.

## §4 Sign-off

- Prod `/api/health` = `1.271.16`, `parentVersion = 1.40.0+` (fork @ f4709886).
- remote-qa routes ×19 + site + links green.
