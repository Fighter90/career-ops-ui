# QA regression — v1.239.2

Patch from the v1.239.1 live regression (Remote QA run 36573692773). That run was clean on prod (510 visits), cvstart.org (170), links, and the scan (it waited 11 min for the hourly scan, then ATS + Regional done). Its evaluate column had three findings:
- ar: all block letters A–G missing (the model translated the letters);
- ja: no SCORE_SUMMARY block;
- hi: 29 % Devanagari script share (threshold 30 %).

Also in this release: multer 2.4.0 (CVE-2026-88932, Dependabot #28, PR #372).
**Counts:** 103 sources / 98 adapters — unchanged. **Tests 3775 → 3776.**

## §0 — Gates

```bash
node --test tests/critical-fixes.test.mjs     # "protects the machine-read format" fails on v1.239.1
npm run test:ci                               # 3776 (3773 + 3 skipped), exit 0
node evals/workflow/run.mjs                   # 0 fail
```

## §1 — What changed

`buildLanguageReminder(lang)` — the last lines of every evaluation prompt — now also says:
- the Latin capital letter A–G in each block heading is not translated;
- the `---SCORE_SUMMARY---` … `---END_SUMMARY---` block keeps its markers and keys in English;
- the report is written in the language's own script.

The validator is unchanged.

## §2 — Manual pass

Remote QA with `live: true` (optionally `locales: ar,ja,hi,uk`, `scan: false`): every evaluate cell shows `lang ✓ · A–G ✓`.

## §5 — Sign-off

- [ ] §0 gates green with the counts above
- [ ] deploy parent `2f70fed` + v1.239.2, `verify`: 103 sources served == registry, NRestarts 0, no new 502s
- [ ] remote QA green on prod, including `live: true`
