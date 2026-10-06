# QA regression — v1.239.4

Patch from the v1.239.3 live regression (Remote QA run 36596104514). These parts were green:
- prod: 510 visits;
- cvstart.org: 170 visits;
- links;
- scan;
- ar A–G now ✓.

Three live findings remained:
- ko / zh-TW evaluate: "missing SCORE_SUMMARY block". These are 10–11k-character CJK reports, and the summary at the end fell past the 8192 output-token limit.
- de docs: "de stop words 3, en 0", a short list-shaped German answer.

The main-branch CI flake in `navigate dashboard → scan → pipeline → cv` was fixed separately (#378).
**Counts:** 103 sources / 98 adapters — unchanged. **Tests 3778 → 3782.**

## §0 — Gates

```bash
node --test tests/evaluate-truncation.test.mjs      # 3 pass — fails on v1.239.3 (no `truncated`, no EVAL_MAX_TOKENS)
node --test tests/evaluate-score-summary.test.mjs   # max_tokens 16384 asserted
node --test tests/remote-qa-lang-check.test.mjs     # short German list passes; drowned by English fails
npm run test:ci                                     # 3782 (3779 + 3 skipped), exit 0
npm run test:e2e:browser                            # 116 pass
node evals/workflow/run.mjs                         # 0 fail
```

## §1 — What changed

1. `runAnthropic` / `runOpenAICompatible` return `truncated`:
   - Anthropic: `stop_reason: max_tokens`;
   - OpenAI-compatible: `finish_reason: length`.
2. `/api/evaluate` (Anthropic + OpenAI/Qwen/OpenRouter/Hermes tail) asks for `EVAL_MAX_TOKENS` = 16384, and so does the auto-pipeline evaluate step. `evaluationWarnings(r)` puts "report cut off at the output-token limit" first. The deep-research and mode routes stay at 8192.
3. `languageOk` (live QA): for non-script locales, 3 locale stop words pass when the answer has no English ones.

## §5 — Sign-off

- [ ] §0 gates green with the counts above
- [ ] deploy parent `2f70fed` + v1.239.4, `verify`: 103 sources served == registry, NRestarts 0, no new 502s
- [ ] remote QA green on prod, including `live: true`
