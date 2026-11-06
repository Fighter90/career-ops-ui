# Live verification of the CAR-239 evaluate determinism gates (2026-11-07)

The two CAR-239 graders — `evals/evaluate-locale-parity/run.mjs` and
`evals/evaluate-repeatability/run.mjs` — had only ever passed offline against
the deterministic stub. This run is their first **LIVE** leg: real provider,
real evaluate pipeline, real CV/profile corpus.

## Run conditions

| What | Value |
|---|---|
| Date | 2026-11-06 21:42 → 22:55 UTC (74 min span) |
| Endpoint | `POST /api/evaluate {jd: PROBE_JD, lang, save: false}` (SSE) |
| Server | **local** `127.0.0.1:4317`, web-ui **v1.269.0** (origin/main @ `998aeb8d`) |
| Data root | `CAREER_OPS_ROOT=/Users/sergejemelanov/My_diary/career-ops` — the real parent corpus (cv.md, config/profile.yml, modes/) prod mirrors |
| Provider | **openrouter · `deepseek/deepseek-v3.2`** (from the parent `.env` — the same provider+model prod runs) |
| Why not prod directly | `https://resumecraft.ru/api/health` → **HTTP 401**; the basic-auth secrets live in the deploy environment, not accessible from this session |
| Scoring determinism knobs | production defaults: cache ON (EVAL_SCORE_CACHE unset), seed 42, EVAL_SCORE_SAMPLES default (1 — the OpenAI-compatible provider accepts a seed) |
| Instrumentation | the real grader binaries through a logging forward-proxy on `127.0.0.1:4899`; every done-frame captured verbatim |

The parity grader ran first, so every repeatability call — including each
locale's first repeat — was a scoring-cache hit (the cache is locale-neutral by
contract). That mirrors prod behaviour, where the cache is warm from prior
evaluations.

## Locale parity — LIVE (1 JD × 19 locales)

Gate: max−min ≤ 0.5 (v1.268.0 measured 1.5).

| locale | score | wall s | cached tok | out tok | cost $ | steps | warnings |
|---|---|---|---|---|---|---|---|
| en | 3.5 | 209 | 33 792 | 13 804 | 0.0124 | 2 | 0 |
| es | 3.5 | 190 | 33 792 | 11 329 | 0.0044 | 1 | 0 |
| pt-BR | 3.5 | 113 | 0 | 5 369 | 0.0119 | 1 | 0 |
| ko | 3.5 | 227 | 33 792 | 12 314 | 0.0048 | 1 | 0 |
| ja | 3.5 | 160 | 33 792 | 11 726 | 0.0046 | 1 | 0 |
| ru | 3.5 | 262 | 34 048 | 13 842 | 0.0052 | 1 | 0 |
| zh-CN | 3.5 | 87 | 0 | 3 889 | 0.0112 | 1 | 0 |
| zh-TW | 3.5 | 109 | 33 920 | 4 788 | 0.0031 | 1 | 0 |
| fr | 3.5 | 126 | 0 | 5 337 | 0.0109 | 1 | 0 |
| pl | 3.5 | 104 | 33 920 | 4 862 | 0.0031 | 1 | 0 |
| uk | 3.5 | 131 | 33 920 | 5 732 | 0.0067 | 1 | 0 |
| da | 3.5 | 174 | 34 048 | 11 315 | 0.0044 | 1 | 0 |
| ar | 3.5 | 139 | 33 920 | 5 014 | 0.0064 | 1 | 0 |
| de | 3.5 | 79 | 33 920 | 3 646 | 0.0026 | 1 | 0 |
| it | 3.5 | 200 | 34 048 | 11 920 | 0.0046 | 1 | 0 |
| tr | 3.5 | 101 | 0 | 5 264 | 0.0118 | 1 | 0 |
| hi | 3.5 | 234 | 33 792 | 17 352 | 0.0063 | 1 | 0 |
| ta | 3.5 | 173 | 33 920 | 8 899 | 0.0048 | 1 | 0 |
| vi | 3.5 | 203 | 34 048 | 12 411 | 0.0047 | 1 | 0 |

**min 3.5 · max 3.5 · spread 0.0 (gate ≤ 0.5) → PASS.**

## Repeatability — LIVE (1 JD × 3 repeats × en/ru/de)

Gate: intra-locale spread ≤ 0.2 (scoring cache: 0).

| locale | repeats | spread | cached tok per repeat | wall s per repeat |
|---|---|---|---|---|
| en | 3.5 → 3.5 → 3.5 | **0.0** | 34 048 / 33 920 / 34 048 | 184 / 93 / 211 |
| ru | 3.5 → 3.5 → 3.5 | **0.0** | 33 920 / 34 176 / 34 176 | 88 / 109 / 89 |
| de | 3.5 → 3.5 → 3.5 | **0.0** | 0 / 34 048 / 34 048 | 159 / 206 / 234 |

**All three spreads 0.0 (gate ≤ 0.2) → PASS.**

## Verdicts

| Gate | Measured | Gate | Verdict |
|---|---|---|---|
| Locale-parity spread (1 JD × 19 locales) | **0.0** | ≤ 0.5 | **PASS** |
| Repeatability spread (×3 × en/ru/de) | **0.0 / 0.0 / 0.0** | ≤ 0.2 | **PASS** |
| Zero errors / zero warnings / zero fallback bodies across 28 live calls | 28/28 clean | required | **PASS** |

## Observations (for the record, none gate-relevant)

1. **The score is a server-side computation, and it shows.** 27 of 28 calls ran
   `steps=1` — only the very first call performed the scoring step (`steps=2`);
   every other call, in every locale and every repeat, read the same cached
   scoring JSON and re-rendered only the locale body. The **Score:** header is
   byte-identical across all 28 reports. v1.268.0's failure mode (dice re-rolled
   per call: en 3.2→3.0, ru 3.2→2.5, 19-locale spread 1.5) is gone.
2. **Render output is intentionally non-deterministic and that is fine.**
   Output tokens and report length vary per call (3.6k–17.4k chars; the de call
   at 3 646 out-tokens vs hi at 17 352). The CAR-239 contract pins the *score*,
   not the prose; render keeps temperature 0.3.
3. **Prompt-cache economics are provider-side.** `usage.cached` (~34k tokens —
   the CAR-111 stable prefix) was served on 23/28 calls; 5 calls (pt-BR,
   zh-CN, fr, tr, de×1) got `cached=0` from openrouter and cost ~3× more
   (~$0.011 vs ~$0.003) at equal quality. Nothing in web-ui can force that hit;
   it is visible, which is the point of surfacing `usage.cached`.
4. **Wall time:** parity avg 159 s (79–262 s), repeatability avg 152 s
   (88–234 s) — comfortably inside the 120 s scoring + 300 s render clocks, and
   the token-dense locales (hi 234 s, ta 173 s, ja 160 s) did not hit the 480 s
   ceiling.
5. **Run cost:** 28 evaluations, 1.25 M tokens (in+out), **≈ $0.165** total on
   deepseek/deepseek-v3.2 — roughly $0.006/evaluation with a warm cache.

## Provenance

- Grader console output captured verbatim (both `PASS`, exit 0);
  per-call done-frames logged to `live-eval-capture.jsonl` /
  `live-eval-raw-done.jsonl` in the session temp dir (not committed — they
  quote the CV-adjacent report text).
- Branch `analysis/live-evals-v1269`; no PR — numbers-only record per the
  tasking.
