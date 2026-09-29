# QA regression — v1.239.1

Patch from the v1.239.0 live regression (Remote QA run 36567385635): prod 510 visits,
cvstart.org 170 visits and links were clean, but the live job reported the scan as
failed (the server was running the hourly scan retried after the deploy and answered
`SCAN_BUSY`) and the ja and uk evaluations came back mostly in English
(ja script 20 %, uk script 15 %). **Counts:** 103 sources (98 EN + 5 RU) / 98
adapters — unchanged. **Tests 3774 → 3775.**

## §0 — Gates

```bash
node --test tests/critical-fixes.test.mjs     # includes "restates the output language after the JD" — fails on v1.239.0
node --test tests/locale-scaffold.test.mjs tests/evaluate-score-summary.test.mjs
node --check scripts/remote-qa/prod-llm.mjs
npm run test:ci                               # 3775 (3772 + 3 skipped), exit 0
node evals/workflow/run.mjs                   # 0 fail
```

## §1 — What changed

1. `buildEvaluationPrompt` ends with `buildLanguageReminder(lang)`: "Write the whole
   report in <language> (locale: <code>) …" after the JD. Nothing for English.
2. `scripts/remote-qa/prod-llm.mjs`: when the scan console says "a scan is already
   running", reload `#/scan` after a minute and click again, up to 30 times; the
   summary line reports how long it waited.
3. `Actions → Wiki (apply patch)` (v1.239.0 follow-up) applies `docs/wiki-patches/*.patch`.

## §2 — Manual pass

1. Remote QA with `live: true`: ja and uk evaluations `lang ✓`; the scan row shows
   both phases done (with "waited N min" if the hourly scan was running).

## §5 — Sign-off

- [ ] §0 gates green with the counts above
- [ ] deploy parent `2f70fed` + v1.239.1, `verify`: 103 sources served == registry, NRestarts 0, no new 502s
- [ ] remote QA green on prod, including `live: true`
