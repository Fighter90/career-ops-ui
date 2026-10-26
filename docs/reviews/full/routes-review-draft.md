# career-ops-ui: server routes domain review (all 37 modules)

## Findings

**1. [high] batch.mjs:~120, scan.mjs:~95, runners.mjs:~150/175 — state-changing GET endpoints are open to CSRF**
- **Problem:** Several GET endpoints have side effects:
  - `/api/stream/batch` spawns a parallel paid-LLM fan-out.
  - `/api/stream/scan` writes `last-scan.json` and pipeline files.
  - `/api/stream/scan-parent` and `/api/stream/pdf` spawn processes (`pdf` launches Chromium).
- **Why it matters:**
  - A cross-site `<img src="http://127.0.0.1:PORT/api/stream/batch?parallel=50">` carries the browser's cached basic-auth credentials.
  - `llmRateLimit` is a no-op on loopback, which is exactly the deployment this attack targets.
  - The result is silent spend and file writes triggered from any page the user visits.
  - Unless a global origin guard exists outside this domain, nothing stops it.
- **Fix:** Gate every `/api/stream/*` route (and every non-GET route) on `Sec-Fetch-Site ∈ {same-origin, none}` or a matching `Origin`. `EventSource` sends both from the SPA. Alternatively require a per-session token in the query string.

**2. [high] auto-pipeline.mjs:~395 (`markPipelineRejected`) — unlocked read-modify-write of `pipeline.md`**
- **Problem:** The function reads, rewrites and saves `data/pipeline.md` with no `withFileLock`. It also builds the path with `projPath('data','pipeline.md')` rather than `PATHS.pipeline`, so it could never share a lock key with the other writers anyway. The write is not atomic.
- **Why it matters:**
  - `POST`/`DELETE /api/pipeline` hold `withFileLock(PATHS.pipeline)`.
  - The hourly timer plus a user "Add URL" interleave, and one side's update is lost.
  - Lost updates mean dropped queued URLs or resurrected rejected ones.
  - This violates the shared-file locking invariant.
- **Fix:**
  - Make the function async.
  - Wrap it in `withFileLock(PATHS.pipeline, …)`.
  - Write to a temp file, then rename.
  - Await it at every call site, ideally inside a try/catch that never breaks the SSE stream.

**3. [medium] logos.mjs:~95–120 — attacker-chosen SVG served from the app origin**
- **Problem:**
  - `domain` is any public host.
  - An upstream `image/svg+xml` is relayed verbatim, with the upstream `Content-Type`.
  - `looksLikeImage` also accepts `<svg` sniffed out of an HTML body.
  - The response carries `Cache-Control: public`.
- **Why it matters:**
  - Navigating to `/api/logo?domain=evil.tld` renders attacker SVG in the app origin. Only the global CSP stands between that and XSS.
  - `public` caching of an authenticated response lets shared intermediaries store it.
- **Fix:**
  - Drop SVG, or force `image/x-icon`/png/gif/jpeg by magic bytes only.
  - Set `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; sandbox`.
  - Use `Cache-Control: private, max-age=86400`.

**4. [medium] runners.mjs:~120, batch.mjs:~205, llm.mjs:~300 (gemini `save:true`), outcome.mjs, followup.mjs (seed) — parent scripts mutate the tracker outside the lock**
- **Problem:** These scripts rewrite `data/applications.md` (and `follow-ups.md`) while web-ui writers hold `withFileLock(PATHS.applications)`:
  - Scripts: normalize, dedup, merge, reconcile, the batch merge, gemini-eval with save, outcome/set-status and followup-seed.
  - Web-ui writers: tracker POST, auto-pipeline step 5, backfill-scores.
- **Why it matters:** A dedup or merge running concurrently with an auto-pipeline append loses rows.
- **Fix:** Wrap each `runNodeScript` call for tracker-mutating scripts in `withFileLock(PATHS.applications, …)`. A small `TRACKER_MUTATING` set keeps the list in one place.

**5. [medium] content.mjs:~70, ~330, ~455; config.mjs:~150 — shared-file writes with no lock and no atomicity**
- **Problem:**
  - `PUT /api/cv` writes without a lock.
  - The `PUT /api/profile` field-merge path is a read-modify-write.
  - The `PUT /api/modes/_profile` section-merge path is a read-modify-write.
  - `POST /api/config`'s `updateEnvFile` writes without a lock.
  - All of these use plain `writeFileSync` with no lock.
- **Why it matters:**
  - Two tabs saving different profile fields, or different `_profile` sections, silently drop one edit. That defeats the stated merge-not-replace contract.
  - A crash mid-write truncates `profile.yml` or `.env`.
- **Fix:** Use `withFileLock(path)` around read+write, plus temp-then-rename. `portals.mjs` and `discover-ats.mjs` already do exactly this; reuse that helper.

**6. [medium] batch.mjs:~140–150 — batch arguments are only partly validated, and runs can overlap**
- **Problem:**
  - `--parallel` has no upper bound: `parallel=500` means 500 concurrent paid evaluations.
  - `--min-score` passes `String(req.query.minScore)` raw. An array value becomes `"a,b"`, and a value starting with `--` reaches bash `getopt`-style parsing.
  - There is no single-run guard, so two batch runs race on batch-state and additions.
- **Fix:**
  - Clamp `parallel` to 1–10.
  - Validate `minScore` against `/^\d(\.\d+)?$/` and require 0–5.
  - Add an `activeBatch` slot with a `BATCH_BUSY` error event, mirroring `scan.mjs`'s `activeScan`.

**7. [medium] auto-pipeline.mjs:~690, reports.mjs:~75, llm.mjs:~180 (`freeDeepName`) — check-then-write races allow clobbering**
- **Problem:** Each site checks with `existsSync` and then calls `writeFileSync` without `wx`.
- **Why it matters:**
  - Two concurrent auto-pipeline runs for the same company/role/day overwrite each other's report.
  - `POST /api/reports` without `overwrite` can still clobber under a race.
  - `overwrite` is truthy-coerced, so the string `"false"` overwrites.
- **Fix:**
  - Use the existing `writeExclusive` from interview.mjs, or `flag: 'wx'` with a suffix retry.
  - Require `overwrite === true`.

**8. [medium] llm.mjs:~110–175, ~255–340, ~430–490 — a second provider cascade, divergent from `llm-dispatch`**
- **Problem:** `_hasKeyFor`, `_provGate` and `_tailProvider` re-implement the cascade that `runActiveProvider` already owns. `/api/evaluate` and `/api/mode` use this copy.
- **Why it matters:**
  - Neither route threads an abort signal. A client disconnect keeps burning tokens, which auto-pipeline fixed for CAR-92.
  - Usage recording is hand-copied at each branch.
  - Every new provider must be added in three places.
  - `test-gemini` skips `geminiEvalArgs`, breaking the documented `--lang`-first contract.
- **Fix:**
  - Route both endpoints through `runActiveProvider`, which needs `cachePrefix` and `signal` options.
  - Wire an `AbortController` to `res.on('close')`.
  - Delete the local gate.
  - Use `geminiEvalArgs` in `test-gemini`.

**9. [medium] tracker.mjs:~45 — the status filter disagrees with the funnel**
- **Problem:** The funnel counts canonicalized statuses, but `?status=` filters on the raw cell (`r.status === status`).
- **Why it matters:** Clicking the "Applied" chip (count 12) returns only the rows literally spelled `Applied`. Rows like `**Applied**` or `aplicado` vanish, so the counts and the list contradict each other.
- **Fix:** Filter with `(canonicalizeStatus(r.status) || r.status) === (canonicalizeStatus(status) || status)`.

**10. [medium] auto-pipeline.mjs:~560 — "JD too short" never leaves the timer's queue**
- **Problem:** The general "JD too short" failure is not `rejected` and never calls `markPipelineRejected`. The Telegram branch, by contrast, rejects for the same `< MIN_JD_CHARS` condition.
- **Why it matters:** The timer re-fetches the same junk URL every tick forever, wasting outbound requests and log noise.
- **Fix:** Call `markPipelineRejected(url, 'JD too short')` and return `fail(1, …, { rejected: true })`, consistent with the identity gate.

**11. [low] tracker.mjs:~110–112 — score and reportSlug sanitization is too loose**
- **Problem:**
  - `/^[\d.]+\/?5?$/` accepts `"4.2/"`, which is written as `4.2//5`. It also accepts `"999"` and `"..."`.
  - `reportSlug` is only pipe-escaped. A value like `x](javascript:…` produces a crafted markdown link in the tracker.
- **Fix:**
  - Use `/^(?:[0-4](?:[.,]\d)?|5(?:[.,]0)?)(?:\/5)?$/`.
  - Pass the slug through `sanitizePathName` before building the link.

**12. [low] auto-pipeline.mjs:~725–760 — tracker-append logic forked from tracker.mjs, with weaker dedup**
- **Problem:** The duplicate check compares the pipe-escaped `safeCompany` against parsed (unescaped) cells, with no whitespace normalization.
- **Why it matters:** Company names containing `|` or doubled spaces evade dedup and create duplicate rows. tracker.mjs's `norm()` already handles this.
- **Fix:** Extract a shared `appendTrackerRow({company, role, …})` used by both routes.

**13. [low] portals.mjs:~50, ~80 — probe gating and toggle matching have gaps**
- **Problem:**
  - `/api/portals/health` probes up to 400 user-file URLs with no `isValidJobUrl` gate (the SSRF invariant requires both gates) and no rate limit.
  - `setEnabledInRaw`'s `keyRe` misses list items whose first key is `- careers_url:`.
  - `keyRe` also matches a `careers_url` in any other YAML section, such as `russian_portals`.
- **Fix:**
  - Filter probe targets through `isValidJobUrl` and add `llmRateLimit`.
  - Allow an optional `-\s+` prefix in `keyRe`.
  - Confine the search to the `tracked_companies` block.

**14. [low] activity.mjs:~15 — `limit` is not clamped**
- **Problem:** `parseInt` accepts negatives and `1e9`.
- **Why it matters:** `readActivity` materializes an arbitrarily large tail.
- **Fix:** `Math.min(1000, Math.max(1, n || 200))`.

**15. [nit] Quality — duplicated primitives across the domain**
- **Problem:**
  - `hasControlChar` is copied 5× (assessments, outcome, runners, stats, and inline in discover-ats). This breaks the single-source sanitizer invariant.
  - `openSse` is copied 4×. scan.mjs's copy lacks `res.on('error')` and the `writableEnded` guard that auto-pipeline documents as a crash cause.
  - HTML-to-text stripping is written 3 different ways (auto-pipeline, pipeline preview, cv-studio).
  - Nine stats/relay handlers are near-identical.
  - help.mjs reimplements `resolveHelpFile`. The docs-assistant copy also lacks the containment check.
- **Fix:** Move these into `security.mjs` (`hasControlChar`, `htmlToText`), an `sse.mjs` module, and a `parent-relay.relayScript(script, args, {emptyOk})` helper.

## Clean categories
- **Path traversal:** clean. Every `:name`/`slug` goes through `sanitizePathName` or a strict regex, plus a containment check where it matters.
- **Prototype pollution:** clean.
  - The config write iterates `KNOWN_KEYS`.
  - The profile merges use fixed path allowlists with `UNSAFE_KEY` guards and `Object.hasOwn` checks.
- **ReDoS:** no exploitable pattern found. Inputs are length-capped before the heavier regexes, as in the guess and slug code.
- **Secrets:** clean. Values are masked on read, stderr is sanitized, and logs carry host only.
- **SSRF:** user URLs go through `isValidJobUrl` + `safeGet` everywhere except finding 13. geocode's raw `fetch` targets an operator-fixed host, which is acceptable but worth a comment.

## Verdict
Input validation and path handling are solid. The SSRF envelope is applied consistently, and comments explain intent unusually well.

The real exposure is concurrency and CSRF:
- Side-effecting GET SSE endpoints.
- Unlocked read-modify-writes on `pipeline.md`, profile, `.env`, and the parent scripts that touch the tracker.

Fix findings 1–5 first. Then fold the duplicated cascade, SSE and sanitizer code into shared modules before the 400–800 LOC route files drift further.
===DBG===
