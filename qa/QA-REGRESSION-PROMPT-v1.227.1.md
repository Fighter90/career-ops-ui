# QA REGRESSION PROMPT — career-ops-ui **v1.227.1** (help-guide integrity: BUG-A + BUG-B + two inherited defects)

**Patch release, no parent delta.** Four defects in the help surface, all found by manual reading because **no gate covered them**. Registry unchanged: **85 sources** (80 EN + 5 RU), `ALL_ADAPTERS` **80**.

## §0 — Gates
```bash
npm test                                          # 2845 (was 2837), exit 0 — capture $? directly, never pipe to grep
node --test tests/help-source-counts.test.mjs     # 3 — BUG-A
node --test tests/help-banner-strip.test.mjs      # 5 — BUG-B
node scripts/check-changelog-parity.mjs           # 16 non-EN at v1.227.1
npm run test:ci                                   # exit 0
npm run test:e2e                                  # 21/21
npm run test:e2e:browser                          # 99/99
```

## §1 — BUG-A · the §17 breakdown contradicted the total
- Was: «the `server/lib/sources/` registry ships **85** adapters — **78 English + 5 Russian**» → 78+5 = **83 ≠ 85**. ja/ko had drifted further, to **77** (= 82). Now **80 EN + 5 RU** in all 17.
- The stale «As of **v1.213.0**» anchor is removed (16 locales; ja never had one). Version-free wording replaces it — the count is asserted against the live registry instead, which cannot go stale. That anchor had already been hand-fixed once in v1.210.1 and drifted again; a one-off edit was never going to hold.
- **Gate:** `tests/help-source-counts.test.mjs` — stated total == `SOURCES.length`; the breakdown parts == the live EN/RU split AND sum to the total; the paragraph pins no version. It locates the paragraph by the registry PATH, never by the number, so it cannot go vacuous when the number is wrong.

## §2 — BUG-B · the GitHub banner printed as raw markup in `#/help`
- Was: every locale opened `#/help` with 268 characters of literal `<p align="center"><img src="https://…`.
- v1.225.0/v1.225.1 recorded it as "stripped in-app by `UI.md()` (no image support)". **That was wrong**: `UI.md()` is escape-first — step 2 of its pipeline HTML-escapes every source byte before any markdown transform. That is the correct XSS boundary, but escaping is not removal, and nothing removed the banner because no code ever tried.
- Fix: `server/lib/help-markdown.mjs::stripGithubOnlyBlocks`, applied at BOTH `GET /api/help/:lang` and the docs-assistant retrieval corpus (both read the bundles from disk). The bundles keep the banner, so GitHub still renders the showcase.
- **Gate:** `tests/help-banner-strip.test.mjs` — banner stays on disk ×17; never survives the strip; every bundle's first rendered line is its heading; the strip stays narrow (prose, inline `<img>`, markdown images and empty input all survive); and BOTH consumers are pinned to route through it.

## §3 — Inherited defects fixed alongside
- **Cadence board “#” column blank since v1.117.0.** It read `entry.appNum`; `followup-cadence.mjs` emits `num` — `appNum` never existed in the payload. Confirmed against live relay data (`num, date, appliedDate, company, via, role, status, …, urgency, nextFollowupDate, daysUntilNext`). Both field names are now read. The v1.227.0 “Next up” line inherited the same mistake and is fixed with it.
- **`pickNextUpcoming` is correct as written.** It reads `nextFollowupDate`, which live data confirms is the real field. It returned `null` in QA because every tracked entry was `overdue` (i.e. due) — by definition there was nothing *not yet* due to name. Not a defect.

## §4 — Manual browser pass
1. `#/help` in **en / ru / ja / ar** — the first visible line is the `# Help — …` heading. No `<p align=…>` text anywhere. Hard-reload (cache-bust) to be sure.
2. `#/help` §17 — the sentence reads «**85** adapters — **80 English + 5 Russian**» (localized), and carries **no** `vX.Y.Z`.
3. `#/docs-assistant` (and the floating robot FAB) — ask “how many sources are supported?”; the answer cites 85 / 80+5 and no markup leaks into the reply.
4. `#/modes/followup` — the cadence board's **#** column now shows tracker row numbers, not blanks. **Due only** still filters; with everything overdue it is a no-op by construction, which is correct.
5. GitHub — open `docs/help/en.md` in the repo: the provider banner still renders there.

## §5 — Not changed
No registry, scanner, route-contract, i18n-dict or locale-file change. `docs/help/*.md` heading structure untouched (32 H2 / 121 H3) — only the §17 sentence body.

## §6 — Sign-off
Suite **2845** green (was 2837, +8) · E2E 21/21 + 23/23 · Playwright 99/99 · parity ×17 at v1.227.1 · README banner+badges ×17 · help ×17 corrected · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed · site changelog mirrors ×17 rebuilt. Both new gates were verified to FAIL against the exact bugs before being committed — a gate never seen red is not a gate. Deploy: Pages (cvstart.org), local + resumecraft, wiki.
