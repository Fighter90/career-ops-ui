# QA Regression Prompt — v1.128.0 (four ports from the parent web app)

> Minor release. Re-implements four solutions from the parent's own Next.js web
> app (`../web/`) in vanilla JS / ESM. Baseline: v1.127.0 (all green, 2045).

## What changed

1. **`server/lib/states.mjs`** — reads `templates/states.yml` live as the
   canonical application-status vocabulary (CI-safe hardcoded fallback).
   `POST /api/tracker` folds any label/id/alias (incl. Spanish/legacy, stray
   `**`) → canonical label; `GET /api/tracker` funnel buckets by canonical
   status. Removes the hardcoded `ALLOWED_STATUSES` (no more manual re-sync).
2. **`public/js/lib/score-tone.js`** (`window.ScoreTone`) — 4-tier score tone
   (≥4.2 good / ≥3.8 warn / ≥3.0 muted / <3.0 bad) + letter fallback; `#/tracker`
   uses it; new `.score-muted` CSS tier.
3. **`public/js/lib/company-logo.js`** — `domainFromName()` (~90 brand→domain
   overrides + legal-suffix strip + slug fallback) so ATS-hosted rows resolve a
   brand logo via `/api/logo` before the letter-avatar (now 1–2 initials).
4. **`public/js/lib/job-facets.js`** (`window.JobFacets`) —
   `seniorityFromTitle` / `sourceFromUrl` / `daysSince` pure helpers.

## Sign-off checklist

- [ ] `npm test` — **2066** green (+21: states 4, score-tone 4, job-facets 8,
      company-logo-domain 5).
- [ ] `node --test tests/states.test.mjs` — live read + fallback + canonicalize.
- [ ] Manual: `#/tracker` — a Spanish status row (e.g. "contratada") buckets
      under **Hired** in the funnel; score cells use the 4 tone colors.
- [ ] Manual: `#/scan` with logos enabled — a greenhouse/lever-hosted row shows
      the employer's brand logo (not a letter-avatar) for a known brand.
- [ ] `node --test tests/score-tone.test.mjs tests/job-facets.test.mjs tests/company-logo-domain.test.mjs`.
- [ ] `/api/tracker` (POST) with `status: "aplicado"` writes `Applied`.
- [ ] Help H2/H3 unchanged (29/105); no i18n/CHANGELOG-locale count drift.
- [ ] `/api/health` → `version 1.128.0`, `parentVersion 1.23.0`.
