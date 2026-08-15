# QA REGRESSION PROMPT — career-ops-ui **v1.202.0** (discover ATS boards on #/portals)

**Added (feature).** Given a bare **company name**, `#/portals` probes Greenhouse / Ashby / Lever for its public job board (zero LLM, zero browser) and surfaces the boards that exist and currently list ≥1 job. One explicit click adds a chosen board to the tracked companies the scanner watches (`portals.yml`).

- **Under test:** `package.json` **1.202.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                          # 2586, exit 0 (capture $? directly, never | grep)
node --test tests/discover-ats-resolver.test.mjs  # resolver + slug + budget
node --test tests/discover-ats-route.test.mjs     # /discover preview + /track write
node scripts/check-changelog-parity.mjs           # 16 non-EN at v1.202.0
```

## §1 — Change

- New `server/lib/discover-ats.mjs`: `deriveSlugs`, `buildProbeUrl`, `discoverAts`, plus write helpers (`renderPortalEntry`, `insertIntoTrackedCompanies`, `isDuplicateCompany`, `yamlScalar`, `KNOWN_CAREERS_HOSTS`, `_setSafeGet`).
- New `server/lib/routes/discover-ats.mjs`: `registerDiscoverAtsRoutes(app)`, `POST /api/portals/discover` + `POST /api/portals/track`. Wired in `server/index.mjs`.
- `public/js/views/portals.js`: a "Discover ATS board" card (input + results + Add).
- i18n ×17 (14 keys) + snapshot regen.

## §2 — Security envelope

- **Probe SSRF:** slugs are `SLUG_RE`(`^[a-z0-9-]+$`, no `..`); each probe URL is `https://<FIXED vendor host>/<slug>` with `new URL().hostname === host` re-asserted; the careers_url is fed to `resolveAdapter` and the adapter **id is re-checked** (a slug can't reroute vendors); the fetch rides the DNS-pinned `safeGet` (GET-only wrapper, cross-origin redirect → throw = not-resolved). Fan-out capped at **MAX_PROBES=12** (per-probe 8 s timeout, 2 MB cap). Global `fetch` is never called on a name-derived URL.
- **Write:** `/track` requires `careers_url` https on `KNOWN_CAREERS_HOSTS` (Greenhouse/Ashby/Lever), no userinfo, AND `resolveAdapter`-recognized; then `withFileLock` → surgical text splice (`insertIntoTrackedCompanies`, comments/order preserved) → `yaml.load` re-parse guard (refuse write if it wouldn't parse) → atomic temp-then-rename. Idempotent (dedupe by name/careers_url). 404 if `portals.yml` absent (mirrors `/toggle`).
- **Workday excluded** by design (POST-only CXS feed can't ride the GET seam; site slug unguessable from a name).

## §3 — Behaviour

- `POST /api/portals/discover { company: "Stripe" }` → `{ company, results: [{ vendor, label, slug, careers_url, jobCount }] }` (only boards with ≥1 job; empty array when nothing resolves). 400 on empty / >120-char name.
- `POST /api/portals/track { name, careers_url }` → `{ ok, added:true }` (or `{ added:false, duplicate:true }`); 400 on a non-ATS / non-https careers_url.
- **Client:** CSP-safe (`c()` + `addEventListener` + `textContent`, no `innerHTML`/inline handlers); already-tracked results render disabled; Add → toast + list refresh.

## §4 — Sign-off

Suite **2586** green (+23) · CHANGELOG parity ×17 at v1.202.0 · README badge+banner ×17 · site changelog ×17 · two new routes (one read-only, one explicit write), no new dependency, no parent edits. NOTE: `/api/portals/track` is a new FS-writing route — CodeQL may raise the usual missing-rate-limiting false positive (dismiss post-merge, per the project's standing note).
