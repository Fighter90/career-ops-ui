## Findings (ordered by severity)

**1. [high] `security.mjs:~250–300` — `stripDangerousMarkdown` corrupts ordinary CV text on every save or import.**
- **Problem:** It deletes text, not just markup:
  - `.replace(/javascript\s*:/gi,'')` turns "**JavaScript:** React, Node" into "**** React, Node". `vbscript\s*:` and `data\s*:\s*text/html` behave the same way.
  - `decodeHtmlEntities` permanently rewrites `&amp;`, `&lt;` and numeric entities in prose, so "R&amp;D" becomes "R&D".
  - The comment claims the output is "re-escaped for `<`, `>`, `&`". No re-escaping happens.
- **Why it matters:** This silently mutates candidate data on the most common CV formatting ("JavaScript:" skill lines). The changes then flow into every prompt and export. The XSS protection it buys is redundant, because `UI.md` escapes first.
- **Fix:**
  - Strip schemes only inside link and attribute contexts, e.g. `\]\(\s*javascript:` and `(?:href|src)\s*=\s*["']?\s*javascript:`.
  - Run the dangerous-tag passes on a decoded *copy* to decide what to cut, but cut from the original text. Leave plain entities untouched.
  - Fix the comment. Add a regression test with "JavaScript: 5 yrs" and "R&amp;D".

**2. [medium] `safe-fetch.mjs:safeGet` + `discover-ats.mjs:makeSafeFetchImpl` — the per-probe timeout disappears when a route signal is passed.**
- **Problem:** `safeGet` ignores `timeoutMs` whenever `opts.signal` is set. `makeSafeFetchImpl` passes both `timeoutMs` and `init.signal || signal`.
- **Why it matters:** With `deps.signal` (the request-close controller), every probe has no deadline. Node's `http.request` has no socket timeout, so one tar-pitting host stalls the discover request until the client gives up. The same trap exists for any future caller.
- **Fix:** In `safeGet`, always arm the `timeoutMs` controller and combine it with the caller's signal (as `fetch-timeout.withTimeout` already does). Remove the "signal wins" branch.

**3. [medium] `en-scanner.mjs:appendToPipeline/appendToHistory/saveLastScan`, `ru-scanner.mjs` (same functions), `scan-quarantine.mjs:saveQuarantine` — shared-file writes bypass `withFileLock`.**
- **Problem:** These do read-modify-write on `data/pipeline.md`, `scan-history.tsv` and `last-scan.json` without the per-path lock. Routes such as POST `/api/pipeline` and the auto-pipeline do take the lock.
- **Why it matters:** The writes are synchronous today, so they only clobber a locked writer that awaits between its read and its write. That is still a violation of a stated invariant, and it becomes a lost-row bug the moment either side gains an `await`.
- **Fix:** Make the append helpers `async` and wrap them in `withFileLock(PATHS.pipeline|scanHistory|lastScan, …)`. Await them from `runEnScan`/`runRuScan`.

**4. [medium] `portals/adapters/{remoteok,remotive,thehub,themuse,weworkremotely,landingjobs,arbeitnow,himalayas,jobicy,jobspresso,4dayweek,flowxtra,higheredjobs,vdab,mycareersfuture,wttj,
===DBG===
DEBUG status=200 stop=max_tokens in=335813 out=16000 [thinking,text]
