# QA REGRESSION PROMPT — career-ops-ui **v1.195.0** (detect-reposts inverted index)

**Performance (scanner).** Duplicate-posting detection no longer degrades to O(N²) on a large `scan-history.tsv`. The per-company title grouping — previously a nested loop paying a full `roleFuzzyMatch` on every pair — is now an inverted index. **Output is identical** (the same repost clusters, same order), proven by a differential test against the old algorithm.

- **Under test:** `package.json` **1.195.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # 2521, exit 0 (capture $? directly, never | grep)
node --test tests/detect-reposts-grouping.test.mjs tests/detect-reposts.test.mjs
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.195.0
```

## §1 — Change (`server/lib/detect-reposts.mjs`)

- New exported `groupRowsByTitle(rows)` replaces the nested-loop title grouping inside `detectRepostsInGroup`:
  1. **Bucket** rows by lowercased title in one pass (atomic exact-title groups — no fuzzy calls).
  2. Tokenize each **distinct** title once; build an inverted index over **non-baseline** `roleTokens`.
  3. Seed buckets in first-appearance order; only fuzzy-match candidates that share a discriminating token, gated by `overlap ≥ 2` and `jaccard ≥ 0.6` — the exact necessary conditions of `roleFuzzyMatch`, so the gate drops only pairs it would reject. **Every surviving pair is still decided by `roleFuzzyMatch`.**
- Now imports `roleTokens`, `BASELINE_TOKENS` from `role-matcher.mjs` (already exported).

## §2 — Identical-output proof

- `tests/detect-reposts-grouping.test.mjs` runs `groupRowsByTitle` against a **reference re-implementation of the exact old nested loop** and asserts byte-identical groups (same rows, same order) across **15 curated cases** (exact dups, case-only, specialization split, seniority difference, non-Latin, ordering variants) and **200 seeded-random histories** (up to 40 rows). No `Math.random` — an LCG keeps it reproducible.
- The full pre-existing `detect-reposts.test.mjs` (clustering behaviour) still passes unchanged.

## §3 — Sign-off

Suite **2521** green (+2: curated + seeded-random differential) · existing detect-reposts tests unchanged · CHANGELOG parity ×17 at v1.195.0 · README badge+banner ×17 · **no behaviour change** — the release is purely a speed-up with a machine-checked identical-output guarantee.
