# QA regression — v1.239.3

Patch from the v1.239.2 live regression (Remote QA run 36581340197). That run was green in:
- prod: 510 visits;
- cvstart.org: 170 visits;
- links;
- scan: waited 10 min for the hourly scan, then ATS + Regional done;
- 16 of 17 evaluate locales (ja SCORE_SUMMARY and hi language fixed by v1.239.2).

The one remaining failure: **ar** evaluate missed every A–G block. A targeted run (36589887836, `locales: ar`) printed the masked heading skeleton:

```
"## ʷ ʷ — ʷ ʷ"
```

That skeleton has no Latin letter in any heading: the block letter is written in Arabic, in abjad order.
**Counts:** 103 sources / 98 adapters — unchanged. **Tests 3776 → 3778.**

## §0 — Gates

```bash
node --test tests/eval-validate.test.mjs        # "Arabic abjad block letters" fails on v1.239.2
node --test tests/remote-qa-lang-check.test.mjs # headingSkeleton masks every word
npm run test:ci                                 # 3778 (3775 + 3 skipped), exit 0
npm run test:e2e:browser && npm run test:e2e && npm run test:e2e:full
node evals/workflow/run.mjs                     # 0 fail
```

## §1 — What changed

1. `validateEvaluationReport` also accepts أ ب ج د هـ و ز as A–G:
   - only as a standalone word within the first 24 characters of a `#`–`###` heading;
   - the same letters inside an Arabic word do not count.
2. `scripts/remote-qa/prod-llm.mjs` prints `headingSkeleton(md)` when an A–G check fails. In the skeleton:
   - every word is masked (`w` for Latin, `ʷ` for any other script);
   - a lone A–G letter, the markup and the punctuation are kept.

## §5 — Sign-off

- [ ] §0 gates green with the counts above
- [ ] deploy parent `2f70fed` + v1.239.3, `verify`: 103 sources served == registry, NRestarts 0, no new 502s
- [ ] remote QA green on prod, including `live: true` — all 17 evaluate cells `A–G ✓`
