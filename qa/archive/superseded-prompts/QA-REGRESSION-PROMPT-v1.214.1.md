# QA REGRESSION PROMPT — career-ops-ui **v1.214.1** (Ashby description cap)

**Patch.** v1.214.0 gave Ashby a `description` but mapped `descriptionPlain` through **uncapped**, while Greenhouse/Recruitee cap at `DESCRIPTION_CAP` (4000) via `htmlToText`. Result: one `content_filter` behaved differently per board (a keyword past char 4000 matched Ashby but not Greenhouse), and Ashby alone bloated scan-results (~645 KB, max 16 KB/row vs Greenhouse's 4 KB).

- **Under test:** `package.json` **1.214.1**. Registry **82** = 77 EN + 5 RU — unchanged (help/OVERVIEW/API untouched).

## §0 — Gates

```bash
npm test                                                   # 2738, exit 0
node --test tests/sources-ashby.test.mjs                   # 10 (was 8: +cap-at-4000, +plain-`<…>`-survives)
node --test tests/html-to-text.test.mjs                    # 7 (DESCRIPTION_CAP source)
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.214.1
```

## §1 — What changed

- **`server/lib/sources/ashby.mjs`** — `description` is now `(…descriptionPlain…).slice(0, DESCRIPTION_CAP)`, importing `DESCRIPTION_CAP` from `html-to-text.mjs`. **Cap-only, deliberately NOT `htmlToText`:** `descriptionPlain` is already plain text, so running the shared pipeline's tag-stripper on it would eat legitimate `<…>` in a JD (`C++ templates <T>`, `salary < 100k`). Truncation is all it needs to match Greenhouse/Recruitee's 4000-char ceiling.

## §2 — Manual browser pass

1. On a scan that includes an Ashby board with long JDs, `scan-results` is materially smaller (no 16 KB description rows).
2. A `content_filter` keyword now matches (or not) the same way on Ashby, Greenhouse, and Recruitee for text within the first 4000 chars — the board no longer changes the answer.

## §3 — Invariants / security

- No new source/route/dependency. `DESCRIPTION_CAP` is the single shared ceiling now honoured by all three description-bearing boards. Ashby text is truncated, never tag-stripped (plain-text `<…>` preserved — covered by a test).

## §4 — Not changed

- Greenhouse/Recruitee already capped (via `htmlToText`) — untouched. SmartRecruiters descriptions remain the deferred opt-in detail-fetch. DNS-rebinding guard still queued.

## §5 — Sign-off

Suite **2738** green (2736 + 2) · `sources-ashby` 8→10 (cap + plain-`<…>`) · CHANGELOG parity ×17 at v1.214.1 · help **untouched** (82/77) · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed · site rebuild (changelog mirrors + facts version) + wiki (version + tests). Deploy: resumecraft rsync of `ashby.mjs` + `package.json`, restart. cvstart.org Pages rebuild.
