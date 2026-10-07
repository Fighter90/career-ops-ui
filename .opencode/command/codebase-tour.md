---
description: Give a 90-second tour of the career-ops-ui codebase for an agent joining fresh.
---

Walk through the repo in this order, ONE sentence per item:

1. Stack — Node 18+ (CI matrix 18/20/22), Express 4, vanilla SPA, no build step, no TS.
2. Server entry — `server/index.mjs` (createApp factory + route modules under `server/lib/routes/`).
3. Server lib — `server/lib/*.mjs` one-liners: `prompts.mjs`+`llm-dispatch.mjs` (LLM layer), `sources/` (109 board sources incl. `_shape.mjs` guards), `portals/registry.mjs` + `portals/adapters/` (104 EN + 5 RU adapters), `en-scanner.mjs`/`ru-scanner.mjs`, `eval-validate.mjs`, `liveness-*.mjs`, `security.mjs`, `safe-fetch.mjs`.
4. Client entry — `public/index.html` → `public/js/app.js` → `public/js/router.js`.
5. Views — `public/js/views/*.js`, one per route; libs in `public/js/lib/` (i18n ×17, api.js).
6. Tests — `node --test tests/*.test.mjs`, in-process via `createApp()`, CI-isolated (temp `CAREER_OPS_ROOT`, fake fetch, no network); browser suite `npm run test:e2e:browser`.
7. Parent integration — `paths.mjs::resolveProjectRoot()` finds the parent career-ops; this UI reads/writes via `PATHS.*`; parent is read-only (ADR-0002).
8. Streaming — SSE for long-running scans / PDF generation (`API.stream` client-side).
9. Hard rules — never edit outside `web-ui/`, never log secrets, never relax CSP, never bypass `isValidJobUrl()`/`stripDangerousMarkdown()`.
10. Where to start — `docs/architecture/OVERVIEW.md`, then `docs/sdd/HANDOFF.md` (operating manual) and `/sdd-status`.

Output as a numbered list. Under 250 words.
