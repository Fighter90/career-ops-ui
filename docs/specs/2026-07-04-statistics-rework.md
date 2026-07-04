# Spec — Statistics rework (Epic 25, v1.94.0)

## Problem

The old `#/stats` page derived a target-role "market" picture from the user's own scan results. With few scans the data was sparse and, per user feedback, "collected wrong" — and there were too few charts. The user wants (a) a real market/salary report like a proper industry report, (b) richer analytics with more graphs, (c) currency choice on salary figures, and (d) export to a document.

## Approach

Rework `#/stats` into a **three-tab Statistics section** — no new route in the SPA, one enriched view — plus one new server route and one shared export lib.

- **Market report** (new tab) — `server/lib/routes/market.mjs` → `POST /api/stats/market`. Builds a salary/market-report prompt from `bundleProjectContext` (CV + profile give the target roles), a **region**, and a **currency**, runs it through the shared provider cascade (`llm-dispatch`), and falls back to a copy-paste prompt with no key. The report is analysis, not candidate content: every figure is labelled a directional estimate from the model's knowledge, given as ranges — the honesty contract of `/api/deep`, not of CV output. No file writes.
- **My pipeline** (new tab) — purely client-side aggregation of `GET /api/tracker`: score distribution, status funnel, top companies/roles, timeline, conversion rates. Honest mirror of `data/applications.md`; empty tracker → empty state.
- **Target-role trend** (preserved) — the v1.86.0 vacancy/salary-by-country view + snapshot trend, now with a **currency selector** (approximate USD→X FX, clearly indicative) and a **postings-by-role** overview.
- **Export** — shared `public/js/lib/report-export.js`: Markdown blob download (CSP-safe user-clicked `<a download>`), PDF via the existing `/api/stream/pdf/inline` runner, and copy. Reused by the later Career Plan and Профориентация sections.

## Data contract & honesty

Market figures are model estimates, never scraped, and the prompt + UI say so. No new factual claims about the candidate. The only write in the whole page is the pre-existing `POST /api/stats/snapshot`. `normalizeRegion` (120 chars) and `normalizeCurrency` (ISO whitelist) bound input; `llmRateLimit` guards the LLM route.

## Tests

`tests/market-routes.test.mjs` — `normalizeRegion`/`normalizeCurrency` bounding, `buildMarketPrompt` carries region + currency + the honesty label + context, and the no-key manual path returns a prompt seeded with the profile's target role.

## Out of scope

Live/scraped salary data (would need a data source the app can't run); server-side PDF templating beyond the existing inline runner; per-country FX beyond a small indicative table.
