# Review: scan sources (`server/lib/sources/*`) + maintenance scripts

## Findings

**1. [high] `server/lib/sources/rss.mjs:~95` (`fetchRss`) — SSRF on a config-supplied URL**
- **Problem:** The feed URL comes from config and is fetched with no validation:
  - no HTTPS check (`http:` works);
  - no host or private-IP check;
  - raw `fetchImpl`, so the DNS-rebinding guard never runs.
- **Why it matters:** This is the one source whose URL is fully user/config-controlled. `http://169.254.169.254/...` or `http://127.0.0.1:4317/api/...` is fetched, and the body is parsed back into the UI. It breaks the SSRF invariant outright.
- **Fix:**
  - Require `https:` plus `!isPrivateOrLoopbackHost`.
  - Fetch via `fetchText(fetchImpl, url, { redirect:'error' })`, which applies `guardResolvedHost`.
  - Better still, route the URL through `isValidJobUrl`/`safeGet` like getro does.

**2. [high] `scripts/wiki-banner-check.mjs:~105` — recursive delete of a user-supplied directory**
- **Problem:** If `Home.md` is missing and `--check-only` is not set, the script runs `rmSync(wikiDir, {recursive:true, force:true})` on the `--wiki` path, then clones into it.
- **Why it matters:** A typo such as `--wiki ~/code` or `--wiki .` wipes an arbitrary directory with no prompt.
- **Fix:**
  - Only clone into a non-existent path, or into an empty one.
  - Never `rm` a path that already exists. Refuse instead and tell the user why.

**3. [high] Raw `fetchImpl(...)` calls across about 25 sources bypass the DNS-rebinding-guarded transport**
- **Affected sources:** ashby, greenhouse (including the /offices call), lever, remoteok, remotive, workingnomads, jobicy, himalayas, justjoin, landingjobs, nofluffjobs, thehub, themuse, arbeitnow, 4dayweek, smartrecruiters, hackernews, workday, pageup, habr, hh, geekjob, getmatch, trudvsem.
- **Problem:** These call `fetchImpl` directly instead of `fetchJson`/`fetchText`, so the guard never runs. workingnomads' header even admits this.
- **Worst case:** remoteok and remotive explicitly accept any `https:` "mirror" host. `api: https://internal.corp/...` is then fetched with no resolve-time private-address check, which is a live SSRF.
- **Fix:**
  - Mechanically port these calls to `fetchJson`/`fetchText`; status and error shape are already compatible.
  - For the mirror sources, pin the host or route through `safeGet`.
  - Add a lint/test that greps `sources/*.mjs` for `await fetchImpl(` outside `http-json`.

**4. [medium] `habr.mjs:~95`, `hh.mjs:~85`, `geekjob.mjs:~40`, `getmatch.mjs:~45` — redirects are followed**
- **Problem:** No `redirect` option is set, so Node follows redirects to any host.
  - hh does this on purpose to detect `/vpncheeck` via `res.url`.
  - The others do it by accident.
- **Why it matters:** Combined with #3, a compromised or misbehaving upstream can bounce the request to an internal target.
- **Fix:**
  - Use `redirect:'manual'` and validate `Location` against the source's allowlist.
    - hh: `*.hh.ru`, which still detects vpncheck from the `Location` header.
    - Others: the exact host.
  - Otherwise use `redirect:'error'`.

**5. [medium] `workday.mjs:~215` (`fetchWorkday`) — no host pin on the endpoint or on emitted job URLs**
- **Problem:**
  - There is no `assert…Url`: a POST carrying browser headers goes to whatever `apiUrl` the adapter hands in.
  - `confirmDeadViaCareersPage` is also a raw fetch.
  - `normalize` accepts any response `externalPath` that starts with `http` (including `http:` or an off-host URL) as the job URL.
- **Why it matters:** Every other per-tenant source pins `*.myworkdayjobs.com` / `*.myworkdaysite.com`. Here a single adapter regression becomes an SSRF, and a hostile tenant can inject off-site links.
- **Fix:**
  - Add `assertWorkdayUrl` (HTTPS plus those two host suffixes) at function entry.
  - In `normalize`, accept `externalPath` only when it is relative, or absolute on the tenant origin.

**6. [medium] Destructive cleanup scripts in `scripts/` — `clean-test-fixtures.mjs` and `post-qa-cleanup.mjs`**
- **`clean-test-fixtures.mjs:~45`:**
  - Deletes any `pipeline.md` line matching `/example\.com/i`. This is the exact substring bug that `post-qa-cleanup.isExampleUrl` was written to fix, so `notexample.com…` URLs are deleted too.
  - Takes no backup and no `withFileLock`.
  - The `--confirm` flag described in the header is not implemented.
  - `new URL('..', import.meta.url).pathname` breaks on paths that contain spaces or on Windows.
- **`post-qa-cleanup.mjs`:**
  - `ROOT` defaults to `cwd/..`, so running it from the wrong directory sweeps the wrong project.
  - It writes without `withFileLock` while the server may be appending to `pipeline.md`.
- **Fix:**
  - Reuse `isExampleUrl` in clean-test-fixtures.
  - Add the backup, implement `--confirm`, and use `fileURLToPath`.
  - Take `withFileLock` in both scripts.
  - Derive `ROOT` from `paths.mjs` instead of `cwd`.

**7. [medium] Phase-2 "malformed 200 reads as an empty board" gaps remain in several sources**
- **getro:** `json?.results || {}` followed by `jobs=[]` → `break` makes page 0 silently empty.
- **mycareersfuture:** a non-array `results` becomes `[]`, and the keyword still counts as succeeded.
- **meituan:** `parseMeituanResponse` returns `[]` when `data.list` is missing, and `succeededOnce` is set anyway.
- **mokahr:** `parseMokaHrJobs` returns `[]` when the decrypted payload lacks `data.jobs`.
- **glints:** `opportunities.data` being a non-array becomes `[]`.
- **Why it matters:** A dead or changed API reads as "healthy, 0 jobs", and quarantine never fires. This is the exact failure `_shape.mjs` exists to prevent.
- **Fix:** Use `requireContainer`/`requireArray` on page 1 in each of these sources.

**8. [medium] `feishu-jobs.mjs:~150` and `mokahr.mjs:~175` — local `sleep` helpers leak abort listeners**
- **Problem:** Both add an `abort` listener to the scan-wide signal on every page and never remove it when the timer fires normally. That is up to 200 pages × N keywords of listeners on one signal, triggering a MaxListeners warning and a leak.
- **Related:** `pageup.mjs`'s `sleep` ignores the signal entirely.
- **Why it matters:** This is unbounded growth over long scans, and cancellation is ignored.
- **Fix:** Delete the local helpers and use the shared `delay(ms, signal)` from `http-json.mjs`.

**9. [medium] Sanitizer drift — local strip-then-decode helpers contradict the single-source `html-to-text`**
- **Problem:** These helpers strip tags first and decode entities second:
  - `remotli.htmlToText` — its comment even argues for this order;
  - `gem.htmlToText`;
  - `agenticjobs.stripHtml`;
  - many local `clean()`/`text()` helpers (avature, deutschebahn, dassault, csod, phenom, neogov, rheinmetall, softgarden, beesite).
- **Why it matters:**
  - This is the documented CodeQL order bug: `&lt;script&gt;` comes back out as a literal `<script>` in titles and snippets.
  - It also violates the "sanitizers single-source" invariant.
  - Separately, agenticjobs re-implements `countryName`, which already lives in `_country.mjs`.
- **Fix:**
  - Replace these helpers with `htmlToText` from `html-to-text.mjs`.
  - Import `countryName` from `_country.mjs`.

**10. [low] Job-URL validation is inconsistent across sources**
- **Lever:** emits `j.hostedUrl || j.applyUrl` with no scheme check, and keeps title-less rows.
- **SmartRecruiters:** the `buildPublicUrl` fallback returns a raw `j.applyUrl`.
- **Workday:** see #5.
- **Why it matters:** Every other source drops `javascript:`/`http:` links, because the URL is the dedup key and is rendered and liveness-checked downstream.
- **Fix:**
  - Require `https:` for these URLs.
  - Lever: drop rows with an empty `text`.

**11. [low] Duplicated retry logic and duplicated profile-keyword code**
- **Retry helpers:** `fetchTextWithRetry`/`withRetry` are copy-pasted almost verbatim in 15+ sources (applitrack, adp, bwi, computrabajo, eploy, itviec, jazzhr, jobbankca, magneto, neogov, occ, paylocity, taleo, ultipro, techinasia, zoho).
- **Misleading comment:** `builtin.mjs` states that `fetchJsonWithRetry` "has zero callers among the 90". It is used by at least 11 sources.
- **Profile keywords:** `mycareersfuture` duplicates `jobbankca`'s `profileTargetKeywords`/`resolveProfileKeywords`.
- **Fix:**
  - Add `fetchTextWithRetry` to `http-json.mjs` beside `fetchJsonWithRetry`.
  - Delete the stale comment.
  - Import the profile helpers from one module.

**12. [low] Secrets handling**
- **`scripts/init.mjs:~185`:**
  - Writes `.env`, then calls `chmodSync(0o600)` afterwards, leaving a world-readable window with API keys on disk.
  - The `--anthropic-key` flags put keys in shell history and `ps` output.
- **`techinasia.mjs`:** Error messages from `fetchJsonWithRetry` embed the Algolia URL with `x-algolia-api-key` in its query string. These messages land in SSE and quarantine logs. comeet already redacts this kind of URL.
- **Fix:**
  - Create or patch `.env` with `mode:0o600` atomically.
  - Document env-var or stdin input instead of key flags.
  - Redact `x-algolia-api-key` in techinasia error messages, as comeet does.

**13. [low] `workday.mjs:~150` — module-level state and colliding IDs**
- **Problem:**
  - `lastWorkdayFallback` is module-global, so concurrent scans or companies overwrite each other's fallback reason.
  - Row IDs are `wd-${bulletFields[1] || title}`, which collide for same-title postings when `bulletFields` is absent.
- **Fix:**
  - Return the fallback reason on the result array, e.g. a `workdayFallback` property, following the `…Truncated` convention.
  - Key IDs on `externalPath`.

**14. [low] `personio.mjs:~25` — `REMOTE_RE` matches `deutschlandweit` and `bundesweit`**
- **Problem:** `arbeitsagentur.mjs` explicitly documents that these words mark on-site nationwide field roles, not remote ones. Personio tags such roles `isRemote: true`.
- **Why it matters:** The remote tag smuggles these roles past the commute `location_filter`, and the two German sources disagree with each other.
- **Fix:** Drop those two alternatives, matching arbeitsagentur.

**15. [nit] Assorted small defects**
- `ai-precommit-review.mjs`: the `mkdtemp` directory holding the full staged diff is never removed.
- `capture-map-screenshots.mjs`: `LOCALE_TO_FILE` is missing `vi` (only 18 of 19 locales).
- `capture-dashboard-screenshots.mjs`: prints a literal `\n` (`'\\n'`).
- `smartrecruiters`: the `[?&](limit|offset)=` strip regex produces `…/postings&foo=1?limit=…` when other query parameters exist.
- `import-trending-companies`: the probe timer is not cleared on rejection.
- `builtin`: `parseCards` runs twice per page.
- `taleo`/`ibm`: no cross-page dedup when the API ignores the page or offset parameter.

## Category status

- **Injection / path traversal / prototype pollution:** clean. Slugs and IDs are charset-pinned or go through `safeEncodeURIComponent`, and the city maps use `Object.hasOwn`.
- **ReDoS:** none found. Unbounded-input regexes are length-capped or index-scanned (paylocity, jobvite, pageup).
- **Race conditions on shared files:** only in the maintenance scripts (#6). The sources write no files.

## Verdict

The source layer is unusually disciplined: host pinning, Phase-2 shape guards, and partial-board semantics are applied to most of the 121 adapters.

The real risk is in the tail. Raw-`fetchImpl` sources bypass the DNS-rebinding guard, and the generic RSS source has no SSRF guard at all. Copy-pasted sanitizers and retry helpers have drifted from the shared modules.

Fix #1–#5 before the next release. Then consolidate the retry and sanitizer helpers so new adapters cannot reintroduce these issues.
===DBG===
