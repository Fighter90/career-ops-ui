# QA REGRESSION PROMPT — career-ops-ui **v1.91.0** (Epic 16: Networking & deep company research)

Delta-focused regression for the networking planner. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.91.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                        # full suite (≥1622 cases; new: networking-routes)
node --test tests/networking-routes.test.mjs    # buildNetworkingPrompt + plan/save/list/delete + traversal
node --test tests/i18n-coverage.test.mjs        # 24 new keys ×16 locales, zero missing
node tools/i18n-audit.mjs                        # clean
node scripts/check-changelog-parity.mjs          # all 15 locales at v1.91.0
```

## §1 — What changed

1. **New `#/networking` page** (nav: Deep research → Networking 🤝). Enter a **company** (required, + optional role / JD) → **Build plan**. The plan renders four sections: **Company dossier**, **Who to contact** (personas + LinkedIn search strings), **Warmest intro path**, **Outreach drafts** — all grounded server-side in `cv.md` / `config/profile.yml` / `config/two-pager.yml`. Never fabricates real names or credentials.
2. **Live vs manual.** `POST /api/networking/plan { run:true }` runs live via `server/lib/llm-dispatch.mjs` (shared cascade). No key → `{ mode:'manual', prompt }` and the SPA shows a copy-paste modal (no fabricated plan).
3. **Saved plans.** **Save plan** → `POST /api/networking/save` → writes `networking/net-{company}-{role}-{date}.md` in the **parent** user layer (new `PATHS.networkingDir`). The **Saved plans** list opens/deletes them.

## §2 — Contract & security invariants

- **Writes only on explicit Save**, into `networking/`. `/plan` and the GET listing never write. Parent files outside `networking/` untouched.
- **Path-traversal safe.** `resolvePlanFile()` resolves each filename against `networking/` and proves containment (`startsWith(dir + sep)`); `sanitizePathName` + `net-…​.md` gate; `../../etc/passwd` → 400.
- **JD sanitized** via `sanitizeJobDescription`. Field caps (200 chars), doc cap (200 KB).
- **CSP-safe view.** `networking.js` uses `addEventListener` + `UI.el`; plan markdown rendered via `UI.md()` (XSS boundary), manual prompt via a `readonly` textarea.
- **CodeQL** `js/missing-rate-limiting` + `js/http-to-file-access` on the FS routes are the known false positives — dismiss post-merge (main is unprotected), don't weaken. Real hardening (llmRateLimit on writes, sanitizePathName, containment) is already in place.

## §3 — i18n

24 new keys (`nav.networking`, `net.*`) present + translated in all **16** locales. Switch locale: nav item, setup labels/placeholders, buttons, saved-plan controls read in-language. Arabic RTL.

## §4 — Sign-off

All §0 gates green · Build plan renders the 4 sections (or an honest manual prompt with no key) · save/list/open/delete round-trips into `networking/` · traversal blocked · 24 keys ×16 locales · CSP/SSRF/parent-write invariants intact.
