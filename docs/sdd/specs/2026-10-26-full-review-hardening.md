# SPEC — full-review hardening (FULL-R1…R5, FULL-M2…M5)

- **Status:** Done (all items landed 2026-10-27 — see `2026-10-27-oct27-wave-two.md` for the final mapping) In progress (backfilled mid-wave 2026-10-27 — the HIGHs, medium
  clusters M2–M5 and FULL-M6's safe-fetch half are merged; FULL-M1, FULL-M6's client
  halves and CAR-150 are in flight on named branches. Spec-first was violated here
  too: the review corpus and the first fixes landed before this file — it is written
  while the wave runs, closing the HANDOFF-rule-4 gap for the remainder.)
- **Release:** rides the v1.261.0 train (unreleased at spec time)
- **Related:** `docs/reviews/full/` (committed at `45af3b24`, 2026-10-26) —
  `CONSOLIDATED.md` (the index, ~57 findings: 7 high, ~25 medium),
  `server-core-review-full.md`, `routes-review-draft.md`, `sources-review-draft.md`,
  `client-site-review-full.md` · the `FULL-R*`/`FULL-M*` rows of
  `docs/sdd/BACKLOG.md` · companion spec [2026-10-07-ux-v2-wave.md](2026-10-07-ux-v2-wave.md)
  (same train)
- **Owner:** maintainer

## Goal

Every high-severity finding of the 2026-10-26 full-project review is fixed with
red→green evidence, the medium clusters follow in the review's own batching order, and
what is deliberately left open is written down instead of forgotten.

## Context

An opus-5-5 four-domain review of the entire source (server core, server routes, scan
sources, client+site) was committed to the repo at `45af3b24` on 2026-10-26: ~57
findings — 7 high, ~25 medium, rest low/nit — with a fix-wave batching plan
(`CONSOLIDATED.md`): Wave A = the highs, Wave B = the medium clusters, Wave C = client
mediums, Wave D = consolidation **last** (it touches everything).

The highs, verbatim in one line each:

- **H1** — CSRF: state-changing GET SSE endpoints (`/api/stream/batch|scan|pdf`)
  reachable cross-site with cached basic-auth → silent LLM spend + file writes.
- **H2** — `data/pipeline.md` unlocked read-modify-write in `markPipelineRejected` and
  the scanner writers → lost rows on interleave.
- **H3** — `rss.mjs` fetches a config-supplied URL with no HTTPS/private-IP check over
  raw `fetchImpl` → full SSRF (IMDS/loopback).
- **H4** — `scripts/wiki-banner-check.mjs` `rmSync(wikiDir, {recursive,force})` on a
  user-supplied `--wiki` path when `Home.md` is missing → a typo wipes an arbitrary
  directory.
- **H5** — `stripDangerousMarkdown` corrupts ordinary CV prose: the `javascript:` strip
  deletes the word from «JavaScript: React, Node»; entity decode permanently rewrites
  `R&amp;D` → `R&D`.
- **H6** — ~25 sources call raw `fetchImpl` past the DNS-rebinding guard;
  remoteok/remotive accept any https "mirror" host (live SSRF).
- **H7** — `health.js`'s malformed-payload guard is dead code — a broken `/api/health`
  renders empty cards with no alert (the CAR-121 never-read-as-all-clear contract was
  never actually shipped).

## Scope — the fix/PR mapping (each SHA + PR verified via `git log origin/main`)

| Item | PR | Commit (squash) | What shipped |
|---|---|---|---|
| FULL-R1 (H1+H2) | #519 | `db3b5265` | CSRF: `request-guard.mjs` `isCrossSite` falls back to **Referer** on acting GETs (`/api/stream/*`, `/api/run`, `/api/geocode`) when both `Sec-Fetch-Site` and `Origin` are absent — the old-browser cross-site `<img>` hole; `pipeline.md`/`last-scan.json` writers go under `withFileLock` + atomic temp-then-rename. Tests: `tests/full-r1-csrf-stream-referer.test.mjs` (130 lines), `tests/full-r1-pipeline-lock-race.test.mjs` (256), `tests/full-r1-csrf-acting-get-coverage.test.mjs` (69). (CAR-158.) Review rounds existed on the way in (gate the real ACTING_GET, harden the writer gate, CodeQL r2 structural asserts). |
| FULL-R2 (H3+H6) | #514 | `e0eede6b` | `rss.mjs`: `assertRssFeedUrl` (https, hostname, private-host refusal) before any request, fetched through the guarded `fetchText` transport; 31 raw `await fetchImpl(` call sites across 27 source files ported to the shared guarded transports; remoteok/remotive mirrors pinned; shared `delay(ms, signal)` (closes the feishu/mokahr listener leak); redirect validation. |
| FULL-R3 (H4) | #511 | `1e469dbc` | `wiki-banner-check.mjs` never `rmSync`es an existing path — clone into a non-existent/empty target only; the refusal is tested. |
| FULL-R4 (H5) | #513 | `6c59479d` | Schemes (`javascript:`/`vbscript:`/`data:text/html`) stripped only in link/attribute contexts; entities decoded into a scratch copy for detection, cut from the original — «JavaScript: 5 yrs» and «R&amp;D» survive verbatim. |
| FULL-R4 review round | #518 | `1f8231d3` | Prose-preservation cases locked into `tests/cv-xss-bypasses.test.mjs` so the sanitizer cannot regress to whole-document stripping. |
| FULL-R5 (H7 + client mediums) | #515 | `064957ca` | The dead health guard ships — the view returns the guarded `body[]` tree (role=alert on malformed `/api/health`, CAR-121 contract finally live; `tests/full-r5-health-guard.test.mjs`, synthetic DOM); shared `UI.safeHref` applied at pipeline/reports/portals hrefs; `api.js` `lang` injection becomes opt-in for LLM paths; `countries.js` regexes precompiled + bounded memo; auto-pipeline reopen race awaited through `API.postStream`. |
| FULL-M2 | #520 | `c3513371` | `safeGet` combines `timeoutMs` with the caller signal — a bridge controller aborts on whichever comes first (the tar-pit stall where the deadline was silently cancelled by the caller's signal is dead); listener detached on settle; already-aborted signals pass through unchanged. (CAR-168.) |
| FULL-M3 | #522 | `424c6a17` | Page-1 shape guards on the dead-API-reads-as-empty-board sources (getro/mycareersfuture/meituan/mokahr/glints — a malformed 200 throws, never «healthy, 0 jobs») + shared `pinnedOverride(raw, HOST_RE)` at the ~18 `company.api` call-sites. (CAR-166.) |
| FULL-M4 | #523 | `66ab9227` | `/api/logo`: magic-byte pin + nosniff + private cache (no more relaying attacker-chosen SVG from the app origin); batch: single-flight guard (BATCH_BUSY, like scan.mjs), `--parallel` bounded, `--min-score` validated. (CAR-163.) |
| FULL-M5 | #521 | `7c1b7c28` | `routes/llm.mjs` stops re-implementing the provider cascade — it routes through `runActiveProvider` with the abort signal and `res.on('close')`, so tokens stop burning after client disconnect; the local gate is deleted. (CAR-167.) |
| CAR-147 | #524 | `b5118ece9` | `evalTimeoutMs(lang)`: token-dense locales (ta/hi) get a 480 s evaluation ceiling — the flat 300 s wall returned HTTP 502 on prod for ta reports; red test first (`test(llm): CAR-147 red` in the same PR's history), then the fix. Surfaced during the wave's live checks; rides the same train. |
| housekeeping | #517 | `0f53add8` | CodeQL batch closed alongside (unused-variable + trivial-conditional cleanup in the same file families). |
| FULL-M6a/b/c (safe-fetch) | #525 | `bfaa7160` | Merged while this spec was being written (10:58, 2026-10-27 — recorded as merged, not in flight): credential headers (Authorization/Cookie) stripped on cross-origin redirect hops (same-origin hops stay verbatim); the transport abort listener detached on every settle path (the pile-up); the error listener registered before any destroy (the pre-abort crash). Tests: `tests/full-m6-safefetch.test.mjs` (231 lines). (CAR-165.) |

**In flight (explicitly NOT done at spec time)** — named branches, no merged PR:

| Item | Branch | State (verified via `git log`) |
|---|---|---|
| FULL-M1 (server shared-file writes) | `fix/m1-wave1` (pushed) | 3 commits: `86af60bb` tracker-mutating parent-script spawns hold the tracker file lock; `d98b9f54` shared-file PUT saves go through `withFileLock` + atomicWrite; `03c085dc` TRACKER_MUTATING is the one roster (gate test — no scattered script lists). |
| FULL-M6s (dotenv) | `fix/m6s-wave1` (local) | 1 commit: `858c4637` refuse `__proto__`/`constructor`/`prototype` keys + null-proto `parseEnv`. |
| FULL-M6 (client consolidation) | `fix/m6-wave1` (local) | Base only — no commits yet. |
| CAR-150 (undo metadata) | `fix/car150-undo-metadata` (local) | Red test only: `88be27ca` (comp column lost on the undo bare re-add fallback); fix pending. |

## Process discipline (as directed for this wave)

- **Executors:** GLM-5.3-Flash, one agent per finding/cluster with an exclusive file
  group (the CONSOLIDATED batching: H1+H2 one agent — same file family; H3+H6 one
  agent — the SSRF cluster; H4, H5, H7 one each; then the medium clusters).
- **Review:** a fresh-context GLM instance reviews each fix against anti-fit criteria
  — the reviewer is never the authoring agent's context. Findings either fold into the
  squash (R1's rounds) or become follow-up PRs (FULL-R4 #518, FULL-M6 #525).
- **Red→green mandatory:** every merged commit names its finding and carries its
  failing-first evidence in the message (e.g. `b5118ece` opens with "Red first:";
  `064957ca` with "Red→green: tests/full-r5-health-guard.test.mjs"). This is auditable
  from the git log itself — that is the proof this spec cites rather than a claim.
- The UX wave on the same train ran the same shape («фиксер → opus → go», PROGRESS
  `5083b967`); the model attribution for THIS wave is the orchestrator's standing
  direction and is not independently verifiable from the repo — stated, not proven.

## Accepted residuals (recorded so nobody "finishes" them by accident)

1. **TOCTOU check-not-pin.** The DNS-rebinding guard resolves-then-checks
   (`guardResolvedHost`); after #520 it fails **closed** on DNS error, but it is still
   a check, not a connect-time pin — a theoretical rebinding window remains. Accepted
   for now; the review's own verdict names it: "the scanner transport is check-not-pin"
   (`server-core-review-full.md` verdict). A connect-time pinned lookup or a
   safe-fetch-everywhere end state is the follow-up if it is ever reopened.
2. **Lows/nits deferred** per `CONSOLIDATED.md`: tracker filter vs funnel divergence,
   JD-too-short never rejected, techinasia key in logs, `init.mjs` 0600-after-write,
   personio REMOTE_RE, workday module state, plural keys, scan favorites per-row
   parse, Landing jsonLd locales, cv-privacy `i` flag, llm-usage rotation, file-lock GC
   dead code, and the sources nits (`smartrecruiters` query-param strip,
   `taleo`/`ibm` cross-page dedup…). None is a security hole per the domain verdicts;
   they live in the domain reports, not in BACKLOG.
3. **geocode's raw `fetch`** targets an operator-fixed host — reviewed as acceptable
   with a comment (routes review clean list), not ported to the guarded transport.
4. **Wave D (consolidation) deliberately last:** `hasControlChar` ×5, `openSse` ×4,
   html-to-text ×3 (server); SSE parser ×4, focus-preserver ×3, H1-label tables ×3
   (client). Touches everything; only safe after A–C land. `fix/m6-wave1` is the
   client half; the server half has no branch yet.
5. **Clean categories recorded as clean** so they are not re-audited: path traversal,
   prototype pollution, ReDoS (bounded), secrets masking, request Host/Origin guard
   logic, prompt/JD fencing, UI.md escape-first XSS containment, stale-response tokens
   (the one gap — the auto-pipeline reopen race — is fixed in #515).

## Out of scope

- FULL-M1 / FULL-M6's remaining halves (dotenv, client consolidation) / CAR-150
  completion — in flight on their own branches (table above); they land as their own
  reviewed PRs, not by edits to this spec.
- Wave D consolidation until M1/M6 land.
- Retroactive re-audit of the clean categories.
- Any parent-project (`career-ops`) file — this repo treats it as read-only.

## Acceptance criteria

1. Every HIGH finding H1–H7 has a merged fix whose commit names the finding and shows
   its failing-first evidence — proven by the mapping table above (each row's SHA is
   checked out of `origin/main` by `git log origin/main --grep FULL-`).
2. Medium clusters M2–M5 and FULL-M6's safe-fetch half are merged the same way;
   M1, M6's remaining halves and CAR-150 are visibly in flight on named branches with
   red tests present where the fix is pending (CAR-150: `88be27ca`).
3. Review rounds leave a trace: squash-folds are quoted in commit bodies; separate
   rounds are separate PRs (FULL-R4 #518 is the exemplar).
4. The review corpus itself is committed and stable: `45af3b24` (4 domain reports +
   CONSOLIDATED index) — findings are tracked in files, not in memory.
5. Whole-tree gate on this spec's base (real run, 2026-10-27):
   `node --test tests/*.test.mjs tests/acceptance/*.test.mjs` → **6428 pass / 0 fail /
   6 skipped** (188 s).
6. Nothing merged weakens an envelope: the R-06 SSRF surface only grows (R2/M2/M3),
   the request guard only tightens (R1), and every new lock is additive (R1).

## Risks and invariants touched

- **R-06 (SSRF envelope):** R2/#514, M2/#520, M3/#522 all strengthen it — the raw
  `fetchImpl` bypass count is now **zero** in `server/lib/sources/` and
  `server/lib/portals/adapters/` (verified 2026-10-27 by grep) and the structural gate
  `tests/sources-raw-fetch-lint.test.mjs` keeps it that way; the residual check-not-pin
  is recorded under Accepted residuals.
- **R-03 (input validation / malformed bodies):** R1's Referer fallback and M4's
  `--min-score` validation extend the gate set; `tests/full-r1-csrf-*` pin them.
- **R-11 (pipeline dual format):** R1's locked atomic writes and the (separate)
  CAR-151 restore path both mutate `data/pipeline.md` — the lock discipline is what
  keeps the two features from interleaving; `tests/full-r1-pipeline-lock-race.test.mjs`
  (256 lines) is the race gate.
- **R-01 (parent read-only):** M1's tracker-mutating script spawns write parent data
  files — that is the declared relay surface; the fix adds locking around it, never a
  new write path.
- **R-04 (source contract):** M3's page-1 shape guards extend the v1.242.0
  `malformed-200-throws` rule to the last five sources that read bad payloads as empty
  boards.

## Verification

**Backfill verification (real, this tree at spec time, 2026-10-27):**

```
node --test tests/*.test.mjs tests/acceptance/*.test.mjs
# pass 6428  fail 0  cancelled 0  skipped 6  duration 188 s
```

**Mapping audit command (the table above is reproducible from it):**

```
git log origin/main --oneline --grep 'FULL-[RM]'   # → #519 #520 #522 #523 #521 #525 + #511 #513 #514 #515 #517 #518
git log --all --oneline --grep 'FULL-M6'           # → the merged #525 trio + the m6s dotenv commit still on its branch
```

**Explicitly not yet verified:** the wave's release train (test:ci + browser suite +
deploy verify) — v1.261.0 is unreleased; M1, M6's remaining halves and CAR-150 have no
green-PR evidence yet because they have no PRs yet. This spec will be superseded or
amended when they land.
