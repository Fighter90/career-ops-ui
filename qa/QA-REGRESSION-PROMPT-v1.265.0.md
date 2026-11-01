# QA Regression Prompt — v1.265.0

> Release: **v1.265.0** (2026-11-01) · parent-sync wave against career-ops @ `fe857ecf`
> Prod target: resumecraft.ru = **1.265.0**, parent 1.38.0 @ `fe857ecf`
> Tests: **7135** unit (0 fail) · Playwright **176** (174 harness: 173 pass / 0 fail / 1 opt-in skip · + e2e 21/0 · e2e-comprehensive 23/23) · registry **125 = 120 EN + 5 RU · 120 adapters** · coverage ≥ 98/89

## What shipped (verify these first)

1. **Apple source (`#/scan` dropdown → Apple).** Add a portals.yml entry with
   `careers_url: https://jobs.apple.com/en-us/search` + `apple: { queries: ["business operations"] }`:
   the scan returns REQ postings from the hydration blob (zero tokens), PIPE rows carry the
   pipeline hint in the snippet, `max_pages` caps the walk.
2. **Bulldogjob source.** Entry with `careers_url: https://bulldogjob.pl/companies/jobs/s/role,devops`:
   `__NEXT_DATA__` listings paginate via `/page,N`, truncation warns with "raise max_pages".
3. **IBM rework.** An IBM entry walks `max_pages` (default 20) with pacing; a broken later page
   keeps partials and names the page in the server log; a full board at the cap warns "raise max_pages".
4. **justjoin ages correctly.** A refreshed-old posting now carries its original publication date
   (the "Posted within" filter no longer shows it as fresh).
5. **jobvite multi-city.** A shared-URL posting renders one row with locations joined ` · `.
6. **Tracker "Still live?" on UltiPro/Built In.** A closed UltiPro posting reads expired
   (`ultipro_api_closed` / `ultipro_api_unavailable`); a Built In "Sorry, this job was removed"
   banner reads expired even with an APPLY control present.

## Standard sweep (every release)

- [ ] All views render; 19 locales switch cleanly (no Latin leaks, RTL holds); dark/light across sidebar/tracker/scan.
- [ ] `#/health` all green; `/api/health` reports `1.265.0`.
- [ ] cvstart.org: mirrors stamped `v1.265.0`; the Sources section shows 125.
- [ ] README ×19 banners name v1.265.0 (lead) / v1.264.3 (previous); badges tests-7135 / release-v1.265.0.

## Not in scope (by design)

- personio language-dedup (#4789 stack) — deferred, own release.
- The parent-side scan.mjs location-compiler half of the jobvite fix — documented no-port.
