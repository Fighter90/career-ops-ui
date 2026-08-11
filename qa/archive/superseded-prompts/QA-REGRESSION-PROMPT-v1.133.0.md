# QA REGRESSION PROMPT — career-ops-ui **v1.133.0** (two parent-parity relays)

Delta regression for the two new read-only relays + views: **Funded companies** (`#/funded`) and **Weekly interview digest** (`#/interview-digest`). Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.133.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                        # full suite — 2143, exit 0 (capture $? directly, never | grep)
node --test tests/parity-routes-v1133.test.mjs  # both relays: passthrough · --from/--to threading · --dry-run read-only · script-error fail-soft
node --test tests/i18n-coverage.test.mjs        # 26 new keys ×17, zero missing
node --test tests/i18n-locale-files.test.mjs    # key parity + regenerated snapshot
node tools/i18n-audit.mjs                        # clean
node scripts/check-changelog-parity.mjs          # all 16 locales at v1.133.0
```

## §1 — What changed

Two NEW read-only views that relay parent career-ops scripts (same fail-soft `{available:false}` contract as `/api/stats/lifetime`):

1. **`#/funded` (Sourcing → Funded companies 💰)** — `GET /api/company-funded` shells out to the parent's `company-funded.mjs` with `--json --dry-run`: a review-first list of recently funded companies from public host-pinned RSS feeds (TechCrunch / PR Newswire / The Guardian / Hacker News). New route module `server/lib/routes/funded.mjs` (the 32nd) + `public/js/views/funded.js`.
2. **`#/interview-digest` (Analytics → Interview digest 📅)** — `GET /api/interview/weekly-digest` shells out to the parent's zero-LLM `weekly-digest.mjs`: a roll-up of `interview-prep/sessions/*.md` (companies + rounds this week, recurring competencies, open gaps). Added to `server/lib/routes/interview.mjs` + `public/js/views/interview-digest.js`.

## §2 — Manual browser pass

**`#/funded`:**
- Click **Discover** → a table of candidates (Company / Funding signal / Source / Date), company names link out (`target=_blank rel=noopener`) when a valid `https?://` URL is present. Honest **empty** ("No funded companies surfaced") and **unavailable** ("script was not found") states. It is user-triggered — the view does NOT auto-fetch on mount.
- Live-fetch note: the relay hits external RSS feeds; a slow/blocked network should degrade to the fail-soft note, not hang the UI.

**`#/interview-digest`:**
- Click **Load this week** → range line (`from → to`), a session/company count, a per-company card (company — role, rounds), recurring competencies as badges, open gaps. With no interview sessions on file, the honest **empty** state shows (this is `available:true` with empty arrays — normal).

**No console errors** on either view across load + empty + populated.

## §3 — Contract & security invariants

- **Read-only.** `#/funded` passes `--dry-run` — the discovery script writes NO artifact (proven by `tests/parity-routes-v1133.test.mjs`). `#/interview-digest` is a pure read. No new writes anywhere; parent-project read-only contract intact.
- **No SSRF surface.** `company-funded` runs with the parent's FIXED feed set — no request input is threaded into `--sources`. `weekly-digest` only accepts `?from=&to=`, threaded ONLY when BOTH match `^\d{4}-\d{2}-\d{2}$` (else the script's default current-week range is used).
- **Rate-limited + bounded.** Both relays carry `llmRateLimit` and a `runNodeScript` timeout (45s / 30s); `sanitizeDetail` clips stderr so no absolute paths leak.
- **CSP-safe.** Both views build DOM via `UI.el` + `addEventListener`; no inline handlers, no `innerHTML` of dynamic content.
- **i18n.** 26 new keys (`funded.*`, `digest.*`, `nav.funded`, `nav.interviewDigest`) present + translated in all 17 locales; Arabic RTL; snapshot regenerated.

## §4 — Not ported (parent parity note)

The parent's Next.js **web/** Follow-up Tracker page (#1422) and backend PDF render (#2182) are intentionally **not** ported — web-ui already has its own follow-up relay (v1.117.0) + PDF runners, and the `followup-cadence.mjs` hardening arrives for free via the shell-out relay.

## §5 — Sign-off

All §0 gates green (2143, exit 0) · both views load, Discover/Load work, honest empty + unavailable states · zero console errors · `--dry-run` read-only proven · no SSRF (`--sources` never user-threaded, `?from=&to=` strictly validated) · 26 keys ×17 · CHANGELOG/README parity ×17 · CSP / read-only invariants intact.
