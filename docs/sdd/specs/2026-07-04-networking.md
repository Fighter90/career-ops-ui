# Spec — Networking & deep company research (Epic 16, v1.91.0)

## Problem

The existing `#/deep` page produces free-form company research; `#/contacto` drafts a single outreach message. Neither answers the operational question a job-seeker actually has: *for this company, who do I reach, how do I get warm, and what do I say?* Epic 16 asks for warm-path contact suggestions, an intro path, outreach drafting, a structured dossier, and a place to track it.

## Approach

A new `#/networking` SPA view backed by `server/lib/routes/networking.mjs`.

- **Plan endpoint** — `POST /api/networking/plan { company, role?, jd?, run? }`. `buildNetworkingPrompt` inlines `cv.md` / `profile` / `two-pager` via `bundleProjectContext({})` and instructs the model to emit four fixed sections: **Company dossier**, **Who to contact** (personas + LinkedIn search strings, never fabricated names), **Warmest intro path**, **Outreach drafts**. `run:true` + a key → live via the shared `runActiveProvider` cascade; else `{ mode:'manual', prompt }` for copy-paste. Nothing invented — grounded only in the candidate's real materials.
- **Persistence** — `POST /api/networking/save` writes `networking/net-{company}-{role}-{date}.md` (new `PATHS.networkingDir`, user layer, explicit Save). `GET /api/networking/plans` lists `net-*.md`; `GET`/`DELETE …/:name` open/remove.
- **Reuse** — the v1.90.0 `server/lib/llm-dispatch.mjs` cascade and the E2 path-containment pattern (`resolvePlanFile`).

## Data contract

Read: `cv.md`, `config/profile.yml`, `config/two-pager.yml`. Write: only `networking/net-*.md` on explicit Save. No other parent files touched. New `networking/` dir is user-owned output.

## Security

`sanitizeJobDescription` on any JD; `sanitizePathName` + `net-…​.md` gate + `resolvePlanFile()` containment on all filenames (path-injection safe); field/doc caps; `llmRateLimit` on plan/save; CSP-safe view (`UI.md()` XSS boundary). CodeQL FS-route alerts (`missing-rate-limiting`, `http-to-file-access`) are the known false positives — dismissed post-merge.

## Tests

`tests/networking-routes.test.mjs` — `buildNetworkingPrompt` section coverage + grounding, manual-fallback (cv inlined, no fabricated plan), company-required, save→list→open→delete round-trip, traversal 400.

## Out of scope

Writing outreach status back into `data/applications.md` (the tracker funnel) — the plan lives as its own artifact; a lightweight tracker note is a follow-up. Live LinkedIn/People lookups (the plan tells the user *how* to search, it does not scrape).
