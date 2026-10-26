# Full project review — opus-5-5, 2026-10-26

Four domain reviews over the entire source (server core, server routes, scan sources, client+site).
Raw domain reports: `routes-review-draft.md`, `sources-review-draft.md`, `server-core-review-full.md`
(+ `-partial`, superseded), `client-site-review-full.md`. ~57 findings: 7 high, ~25 medium, rest low/nit.

## Consolidated HIGH findings (fix first)

| # | Domain | Finding |
|---|--------|---------|
| H1 | routes | CSRF: state-changing GET SSE endpoints (`/api/stream/batch|scan|pdf`) open to cross-site `<img>` with cached basic-auth — silent LLM spend + file writes. Fix: `Sec-Fetch-Site`/Origin gate on every `/api/stream/*`. |
| H2 | routes+core | `data/pipeline.md` unlocked read-modify-write: `markPipelineRejected` (routes) AND scanner `appendToPipeline`/`saveLastScan` (core) bypass `withFileLock`; lost rows on interleave. Fix: async + `withFileLock(PATHS.pipeline)` everywhere, temp-then-rename. |
| H3 | sources | `rss.mjs` fetches a config-supplied URL with no HTTPS/private-IP check and raw `fetchImpl` — full SSRF (IMDS/loopback). Fix: https + private-host reject + guarded transport. |
| H4 | sources | `scripts/wiki-banner-check.mjs` `rmSync(wikiDir, {recursive,force})` on a user-supplied `--wiki` path when `Home.md` is missing — a typo wipes an arbitrary directory. Fix: never rm an existing path. |
| H5 | core | `stripDangerousMarkdown` corrupts ordinary CV text: `javascript:`-scheme strip deletes the word "JavaScript:" from skill lines; entity decode permanently rewrites `R&amp;D`→`R&D`. XSS protection is redundant (UI.md escapes first) — the data corruption is not. Fix: strip schemes only in link/attribute contexts; decode into a scratch copy for detection only. |
| H6 | sources | ~25 sources call raw `fetchImpl` bypassing the DNS-rebinding guard; remoteok/remotive accept any https "mirror" host (live SSRF). Fix: port to `fetchJson`/`fetchText`; pin mirrors; lint-grep gate. |
| H7 | client | `health.js` malformed-payload guard is dead code — a broken `/api/health` renders as empty cards, no alert (the CAR-121 contract was never shipped). Fix: return the guarded tree. |

## Medium clusters (fix second)

- **M-server-writes**: tracker-mutating parent scripts + `PUT /api/cv|profile|modes|config` write shared files without lock/atomicity (reuse the portals.mjs pattern).
- **M-transport**: `safeGet` drops `timeoutMs` when a caller signal is set; `guardResolvedHost` is check-not-pin and fails open on DNS error; redirects followed unpinned in 4 RU sources; workday endpoint unpinned.
- **M-unpinned-overrides**: ~18 adapters pass `company.api` unvalidated into the fetch slot — one shared `pinnedOverride(raw, HOST_RE)`.
- **M-shape-gaps**: getro/mycareersfuture/meituan/mokahr/glints read malformed 200s as empty boards (dead API = "healthy, 0 jobs") — `_shape.mjs` on page 1.
- **M-logo**: `/api/logo` relays attacker-chosen SVG from the app origin, `Cache-Control: public` — magic-byte pin, nosniff, private cache.
- **M-batch**: `--parallel` unbounded, `--min-score` unvalidated, no single-run guard.
- **M-cascade**: routes/llm.mjs re-implements the provider cascade without abort signals (tokens burn after client disconnect) — route through `runActiveProvider` + res.on('close').
- **M-client**: blanket `lang` injection into all write bodies; `countries.js` compiles ~350 regexes per call in hot paths; auto-pipeline reopen race; health dead guard (H7).
- **M-consolidation**: `hasControlChar` ×5, `openSse` ×4, html-to-text ×3 (server) + SSE parser ×4, focus-preserver ×3, H1-label tables ×3 (client) — single-source them.

## Lows/nits

 See the domain reports (tracker filter vs funnel, JD-too-short never rejected, techinasia key in logs, init.mjs 0600-after-write, personio REMOTE_RE, workday module state, plural keys, scan favorites per-row parse, Landing jsonLd locales, cv-privacy `i` flag, safeGet redirect header leak, ISPrivate ranges, dotenv `__proto__`, llm-usage rotation, file-lock GC dead code…).

## Clean categories (verified)

Path traversal, prototype pollution, ReDoS (bounded), secrets masking, request Host/Origin guard logic, prompt/JD fencing, UI.md escape-first XSS containment, stale-response tokens.

## Fix-wave batching

- **Wave A (highs)**: H1+H2 (one agent — same file family), H3+H6 (SSRF cluster, one agent), H4, H5, H7 (one agent each).
- **Wave B (medium clusters)**: M-server-writes, M-transport, M-unpinned-overrides+M-shape-gaps, M-logo+M-batch, M-cascade.
- **Wave C (client)**: M-client + client lows.
- **Wave D (consolidation)**: M-consolidation after A–C land (touches everything).
