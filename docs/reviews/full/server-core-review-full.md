1. **[high] en-scanner.mjs `appendToPipeline` (~L560) and ru-scanner.mjs `appendToPipeline` (~L440)** — The scanners read, modify and rewrite `data/pipeline.md` without `withFileLock`. The same applies to `saveLastScan` and to the scan-history appends.
   - **Why it matters:** This breaks the shared-file invariant. A POST `/api/pipeline` or `/api/tracker` critical section that `await`s between its read and its write can have the scanner's synchronous write land in between, and one side's rows are silently lost.
   - **Fix:** Make both functions `async` and wrap them in `withFileLock(PATHS.pipeline, …)`. Do the same for `PATHS.scanHistory` and `LAST_SCAN_PATH`.

2. **[medium] html-to-text.mjs `HTML_TAG_RE` / `MEDIA_OPEN_RE` (~L25)** — The quoted alternatives `"[^"]*"` and `'[^']*'` can contain `<`. That breaks the comment's "bounded at the next `<`" claim.
   - **Why it matters:** Input like `<a"<a"<a"…` with no closing `>` rescans to the end from every `<`. With `INPUT_CAP` at 200 KB, that is O(n²), which is a ReDoS reachable from any scraped description.
   - **Fix:** Use `"[^"<]*"` and `'[^'<]*'`, or cap each attribute run (e.g. `{0,2000}`).

3. **[medium] discover-ats.mjs `yamlScalar` (~L130)** — The `needsQuote` check ignores `\n`/`\r`, and the quoted form doesn't escape them either.
   - **Why it matters:** A user-supplied company name like `"Acme\n    api: http://…"`, passed to `/api/portals/track`, injects arbitrary keys into `portals.yml`. That includes fetch endpoints for the unpinned adapters in finding 4.
   - **Fix:** Reject or strip control characters (`[\x00-\x1f\x7f\u2028\u2029]`) before rendering. Also quote leading `-?!` and bare `true/false/null/number` scalars.

4. **[medium] Several adapters pass `company.api` / `company.<id>` straight to fetch** — Affected: `remoteok`, `remotive`, `thehub`, `themuse`, `landingjobs`, `weworkremotely`, `vdab`, `wttj`, `mycareersfuture`, `glints`, `jobstreet`, `jobspresso`, `jobicy`, `himalayas`, `arbeitnow`, `4dayweek`, `flowxtra`, `higheredjobs`.
   - **Why it matters:** These diverge from the established host-pinned override pattern (nodesk, larajobs, cryptocurrencyjobs). Any http(s) host reaches the fetch slot, guarded only by the weak check in finding 5, and `portals.yml` is API-writable.
   - **Fix:** Add one shared `pinnedOverride(raw, HOST_RE)` helper. Apply it in every board adapter and fall back to the canonical feed.

5. **[medium] fetch-timeout.mjs / http-json.mjs `guardResolvedHost`** — On the scanner path this is resolve-then-connect, not a pinned connection. It also fails open on a DNS error.
   - **Why it matters:** A TTL-0 rebinding host passes the check, and `fetch` then resolves again to 127.0.0.1 or IMDS. `fetchResponse` skips the guard entirely. So the "DNS-rebinding-guarded transport" invariant only holds for `safeGet`.
   - **Fix:** Use a connect-time pinned lookup, either an undici `Agent` with a custom `lookup` or the `safe-fetch` transport for GET. Fail closed on lookup error, and add the guard to `fetchResponse`.

6. **[medium] openai.mjs `runQwen` / `runGitHubModels` (~L120, ~L170)** — These read `QWEN_BASE_URL` and `GITHUB_MODELS_URL` via `envKey`. Neither key is in `BASE_URL_POLICIES`, and neither goes through `runConfigured`.
   - **Why it matters:** A hand-edited `.env` or process env can redirect the Bearer API key to any host. That is exactly the case `configuredChatUrl` exists to block for ZAI, Moonshot, Ark and Ollama.
   - **Fix:** Add vendor policies (`aliyuncs.com`, `models.github.ai`) and route both providers through `runConfigured`.

7. **[medium] rate-limit.mjs / security.mjs `isPubliclyExposed`** — The documented deploy binds 127.0.0.1 behind Caddy.
   - **Why it matters:** `isPubliclyExposed()` returns false there, so the LLM rate limit and health redaction are off for internet traffic. Even when they are on, `req.ip` is the proxy, so everyone shares one bucket.
   - **Fix:** Add an explicit `BEHIND_PROXY` / `PUBLIC_EXPOSED` override. Set `app.set('trust proxy', 'loopback')` and key buckets on the forwarded client IP.

8. **[medium] env-config.mjs `effectiveEnv` (~L250)** — Every call does `existsSync`, `readFileSync` and a full parse of `.env`.
   - **Why it matters:** `providerAvailable()`, `gate()` and `tailProvider()` probe up to 18 `has*Key` functions per request. That is dozens of synchronous file reads on the event loop per LLM or health call.
   - **Fix:** Cache the parsed `.env` keyed by mtime and size, as `store.mjs`'s report cache does.

9. **[low] security.mjs `stripDangerousMarkdown` / `decodeHtmlEntities` (~L230)** — The comment says the output is "rewritten with HTML entities re-escaped". Nothing re-escapes.
   - **Why it matters:** Legitimate `&lt;T&gt;` or `&#36;` in a CV is permanently decoded on save, so the stored file is lossily altered.
   - **Fix:** Decode only into a scratch copy used for detection, and strip from the original. Otherwise re-escape `< > &` after stripping, and correct the comment either way.

10. **[low] file-lock.mjs `withFileLock` `finally` (~L55)** — The "GC" check compares against a freshly created promise, so it is always false. It is dead code with a misleading comment, and entries are never deleted.
    - **Why it matters:** The map is bounded only by the number of distinct paths. The dead code invites a wrong mental model.
    - **Fix:** Store the tail promise and `if (LOCKS.get(path) === tail) LOCKS.delete(path)` after release.

11. **[low] llm-usage.mjs `recordUsage` / `readUsage` (~L60, ~L120)** — `data/llm-usage.jsonl` is never rotated. `readUsage` reads the whole file into memory before slicing to 50k lines.
    - **Why it matters:** Growth is unbounded, and the read cost scales with the file's full lifetime on every `/api/usage` call.
    - **Fix:** Rotate as `activity-log` does, or tail-read the last N bytes.

12. **[low] dotenv.mjs `parseEnvLine` / env-config.mjs `parseEnv` (~L50)** — Keys are not validated, and they are written into a plain `{}` and into `process.env`.
    - **Why it matters:** A line like `__proto__=…` or `constructor=…` in `.env` reaches object ingress. That violates the env prototype-pollution invariant.
    - **Fix:** Require `/^[A-Za-z_][A-Za-z0-9_]*$/` for keys and build the result with `Object.create(null)`.

13. **[low] safe-fetch.mjs `_safeGetInner` / `defaultTransport` (~L150, ~L120)** — Caller headers (e.g. liveness's `X-API-Key`) are re-sent on cross-origin redirect hops. Separately, the per-request `abort` listener is never removed on success.
    - **Why it matters:** Credentials can leak to a redirect target. The listener piles up on long-lived signals, such as discover-ats's shared `deps.signal`.
    - **Fix:** Drop non-default headers when the redirect origin changes, and call `removeEventListener` in `settle`/`error`.

14. **[low] security.mjs `isPrivateOrLoopbackHost` (~L45)** — Several non-public ranges are not classified as non-public.
    - **Why it matters:** These address forms pass the SSRF guard.
    - **Fix:** Add these ranges:
      - NAT64 `64:ff9b::/96` (embedded IPv4)
      - 6to4 `2002::/16`
      - `198.18.0.0/15`
      - `192.0.0.0/24`
      - multicast and `240.0.0.0/4`, including `255.255.255.255`

15. **[nit] Assorted consistency and dead-comment issues:**
    - `hasGeminiKey` is duplicated in anthropic.mjs and gemini.mjs, and llm-dispatch imports it from the anthropic one. Keep one copy.
    - docx.mjs's header says "STORED", but entries are DEFLATE.
    - The scanners build parent directories with `replace(/\/[^/]+$/, '')`, which breaks on Windows paths. Use `dirname`.
    - parsers.mjs `removePipelineUrl` compares raw URLs, while `addPipelineUrl` dedups on the `normalizeUrl` key. A tracking-param variant can be added-deduped but never removed.

**Clean categories:**
- **Prompt and LLM layer:** prompt and JD fencing, the provider cascade and the llm-output cleaner are solid.
- **Parsers:** parsers, comp-compare, eval-validate and classify-tier show no real defects beyond the nit above.
- **Request guard:** Host/Origin CSRF logic is clean.

**Verdict:**
- The domain is unusually well-hardened at the user-URL boundary (`safeGet`, `isValidJobUrl`, linear-time strippers), with heavy, mostly accurate commentary.
- The weak spots are consistency gaps: the scanner write paths skip `withFileLock`, the scanner transport is check-not-pin, and ~18 adapters plus two LLM base URLs sit outside the pinning patterns used everywhere else.
- Fix findings 1–6 first. They are each small, mechanical, and close real invariant violations.
===DBG===
DEBUG status=200 stop=end_turn in=335837 out=10393 [thinking,text]
