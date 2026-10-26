## Findings

1. **[medium] `public/js/views/health.js` ~120–150 — the malformed-payload guard is dead code.**
   - **Problem:** The view builds a `body[]` array that holds the `role="alert"` "Health data is unavailable or malformed" state and the guarded green summary. The function never uses it. It returns a second, hand-duplicated tree that ignores `checksOk`.
   - **Why it matters:** A broken `/api/health` payload renders empty card rows and no alert. The CAR-121 "never read as all-clear" contract is advertised but never shipped, and the duplicated tree will drift.
   - **Fix:** Return `c('div', null, [header, ...body])` and delete the duplicate summary, required-list and `<details>` block.

2. **[medium] `views/pipeline.js` (urlRow, entryCard, renderPreview, `window.open`), `views/reports.js` ~25 (`r.url` "Open JD"), `views/portals.js` row link — scraped or file-sourced URLs go into `href` unvalidated.**
   - **Problem:** These URLs come from pipeline.md (scanner-written from third-party feeds such as RSS and Telegram), report headers (LLM-generated) and portals.yml. They are written straight into `href`.
   - **Inconsistency:** `dashboard.js` (`isHttp`), `scan-results.js` (`safeUrl`), `funded.js` and `map.js` (`openUrl`) already gate these URLs.
   - **Why it matters:** CSP blocks `javascript:` execution, so this is defense-in-depth. It still produces dead or odd links (`local:jds/…`, `data:`).
   - **Fix:** Add one shared `UI.safeHref(u)` (http/https only), use it in all of these sites, and render plain text otherwise.

3. **[medium] `public/js/api.js` `call()` ~140 — `lang` is merged into every object body, not only LLM-bound ones.**
   - **Problem:** The comment says "LLM-bound mutations", but the code augments POST `/api/config` (env keys), PUT `/api/profile`, PUT `/api/batch`, PUT `/api/cv`, `/api/two-pager` and others.
   - **Why it matters:** Any server route that iterates body keys could persist or reject a stray `lang` key, for example as a `.env` entry or a YAML key. That is a hidden cross-module contract.
   - **Fix:** Make augmentation opt-in, e.g. `API.post(p, b, { lang: true })` or an allowlist of LLM paths. Leave write endpoints untouched and fix the comment.

4. **[medium] `public/js/lib/countries.js` `aliasHit`/`detectCountry` — regexes are compiled on every call in hot paths.**
   - **Problem:** Each `detectCountry` call constructs about 200 alias RegExps plus about 150 city RegExps. It runs several times per row on every `SR.render()`: `countriesIn`, `rowInCountry`, `splitTitleCountry`'s `isPlace`, `FitScore`, and `RoleStats`.
   - **Why it matters:** A chip toggle on a 5k-row scan compiles millions of regexes.
   - **Fix:** Precompile alias and city patterns once at module load, and memoize `detectCountry` by input string in a bounded Map (clear it when `lastResults` changes).

5. **[medium] `public/js/lib/auto-pipeline.js` `open()`/`start()` — a reopen race leaves the new modal inert.**
   - **Problem:** `UI.modal()` fires the previous modal's `onClose`, which aborts the in-flight run. But `running` is only cleared in the async `finally`. The `autoStart` `setTimeout(0)` from global-search Enter then hits `if (running) return` with no feedback.
   - **Related:** The file also bypasses `API.postStream` (no Accept-Language header, no error shaping) and carries its own copy of the SSE parser.
   - **Fix:** Reimplement on `API.postStream` with the signal. In `start()`, if a run is active, await its settlement (keep the promise at module scope) instead of silently returning, or show a "run in progress" message.

6. **[medium] `public/js/views/scan.js` `refreshWorkdayChip` — every live-poll tick fetches `/api/scan-results` twice.**
   - **Problem:** `refreshResults()` fetches every 2.5 s and dispatches `scan:refresh`. The Workday chip listener then GETs the same endpoint again.
   - **Why it matters:** This doubles server load and JSON parsing for the whole multi-minute scan, with no sequencing between the two reads.
   - **Fix:** Pass the payload in the event (`new CustomEvent('scan:refresh', { detail: next })`) or read `lastResults.workdayFallback` directly.

7. **[low] Duplicated transports — `lib/pdf-generate.js` `streamPostSse`, `lib/report-export.js` `saveDocx`, `views/cv.js` import, `api.js` `providerCostHint` all use raw `fetch`.**
   - **Problem:** Each bypasses the API layer (no lang header, no error shaping, no connection-state handling).
   - **Divergence:** `streamPostSse` keeps only the last `data:` line, which regresses the L-4 multi-line join, and has no AbortSignal. Navigating away keeps draining into a detached modal.
   - **Fix:** Route POST-SSE through `API.postStream(path, body, onEvent, signal)`. Add an `API.postBlob`/`API.raw` helper for binary uploads and downloads.

8. **[low] `api.js` `providerCostHint` ~520 — one `MutationObserver` per mounted hint on `document.body` with `{subtree: true}`.**
   - **Problem:** Every scan-console line, toast or HUD repaint runs every live observer.
   - **Problem:** Any body mutation that lands between hint creation and the router's `appendChild` (the node is not yet connected) aborts the listeners before first use.
   - **Fix:** Observe `#content` only, and skip the check until the node has been connected once (a `wasConnected` flag). Alternatively, tie cleanup to the router's route-change hook.

9. **[low] `views/evaluate.js` (manual Copy) and `views/mode-page.js` (`showResult`/`showPrompt` Copy) — false "Copied" toast.**
   - **Problem:** `navigator.clipboard.writeText` is not awaited, so the success toast appears even when the write is rejected (insecure context, permission denied).
   - **Inconsistency:** `deep.js` and `report-export.js` already fixed this pattern.
   - **Fix:** `await` the write inside try/catch and fall back to `auto.copyFail`. Better, centralize it as `UI.copy()`, reusing `ReportExport.copy`.

10. **[low] `views/scan/runner.js` `runScanAll` end — the summary toast is dead code.**
    - **Problem:** The "final summary" `setTimeout(800)` is scheduled at scan start, when `totalNew` is still 0, so it never fires.
    - **Fix:** Move the toast into the terminal-`done` branch or delete it.

11. **[low] `lib/cv-privacy.js` `ADDRESS_RE` — the `i` flag defeats the capitalized-street heuristic.**
    - **Problem:** With `/gim`, `[A-Z][a-z]+` matches any lowercase word. Lines like "…grew revenue 40 percent the hard way" or "…led 3 teams on every court" at end of line are redacted as addresses.
    - **Fix:** Drop `i` from the street-name part and keep case-insensitivity only on the suffix group, e.g. `(?:[Ss]treet|St|…)`, or use a separate `i` regex for the suffix.

12. **[low] `site/src/components/Landing.astro` jsonLd `inLanguage` — stale locale list.**
    - **Problem:** The list is hard-coded with 17 codes and is missing `ta` and `vi`. `check-i18n.mjs` gates `astro.config` but not this list. `Seo.astro`'s "×16" comment is also stale.
    - **Fix:** Use `inLanguage: LOCALES.map((l) => l.code)`.

13. **[low] `views/config.js` `useDefault` option label — fragile i18n string surgery.**
    - **Problem:** The no-default case does `.replace(' ({v})', '')`, which assumes every locale renders the placeholder with exactly that spacing and parentheses. Otherwise the user sees a literal `{v}`.
    - **Fix:** Add a separate `config.useDefaultPlain` key, or build the label from two keys.

14. **[low] Duplicated logic that should be single-source.**
    - **Duplicates:**
      - `withFocusPreserved` is copied ×3 (tracker, reports, stats).
      - The localized H1 label tables are copied ×3 (`pipeline-view.TITLE_LABELS`, `report-ops.H1_LABEL_WORDS`, server `H1_LABEL_WORDS`).
      - `statusClass`/`trackerStatusClass` diverge.
      - `trendCard` duplicates `statCard`.
      - The SSE frame parser is copied ×4.
    - **Why it matters:** Each copy relies on "keep in sync by convention" and has already drifted once (CAR-93).
    - **Fix:** Move these into `public/js/lib/` (e.g. `focus.js`, `report-title.js` shared by both libs) and drift-gate the server copy in a test.

15. **[nit] `lib/scan-results.js` row render — favorites are re-parsed from localStorage per row.**
    - **Problem:** `window.ScanPrefs.isFavorite(r.url)` calls `listFavorites()` for each row, which does `JSON.parse` of localStorage plus a Set build every time. That is up to 200 parses per render.
    - **Fix:** Snapshot `new Set(ScanPrefs.listFavorites())` once per `render()`, as is already done for `favSet`.

## Category notes

- **Security:** No unescaped `innerHTML` sinks were found. `UI.md` escapes first and uses a scheme allowlist. The router error is escaped. Bug-report scrubbing is adequate. Path traversal, prototype pollution and ReDoS are clean client-side; the regexes are bounded. The only gap is unvalidated `href`s (#2).
- **Race conditions:** Stale-response tokens are applied consistently across the views. The auto-pipeline reopen race (#5) is the remaining gap.

## Verdict

- Mature, defensively commented SPA with strong CSP discipline. The XSS surface is well contained via `UI.el`/`UI.md`; no high-severity holes were found.
- The main risks are contract drift: a silently dead health guard, the blanket `lang` injection into write bodies, and four divergent copies of the fetch/SSE transport.
- Next steps: consolidate transports and shared helpers in `lib/`, add `safeHref`, and memoize country detection before scan corpora grow further.
===DBG===
DEBUG status=200 stop=end_turn in=579815 out=12687 [thinking,text]
