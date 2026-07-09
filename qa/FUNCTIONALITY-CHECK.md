# FUNCTIONALITY CHECK — career-ops-ui · FINAL (perennial, run on every release)

> **The single authoritative, version-agnostic functional-correctness
> prompt.** Where `REGRESSION-FINAL.md` proves *nothing regressed* and
> `UX-AUDIT-PROMPT.md` judges *whether it's good UX*, **this** prompt
> answers one question per item: **does it actually work — correctly,
> completely, and clearly — for a real user?** Paste it verbatim to a
> QA agent (or run it yourself). It always validates *the current
> `HEAD`* — read `package.json::version` first and treat that as `vX`.
> Record the run in `qa/v54-regression/<YYYY-MM-DD>-FUNCTIONALITY.md`.
>
> **Method.** For every item: perform the action as the user would,
> observe the real result, and mark **PASS** / **FAIL** /
> **PARTIAL** / **SKIP** with evidence (route, exact copy, response
> body, screenshot, server log line). A check is PASS only if the
> behaviour is correct *and* legible to the user — a silent success
> the user can't perceive is PARTIAL. Any FAIL → file a one-fix ship
> per the project doctrine (bump + CHANGELOG ×16 + test +
> Playwright-verify + pre-commit AI-review LGTM + CI-watch). Never
> batch. Never `--no-verify`.

---

## §0 — Boot & hard gate

```bash
vX=$(node -p "require('./package.json').version")
npm ci && npm run test:ci          # MUST: N/N pass · ✓ no .also( · ✓ CHANGELOG parity all 16 @ vX
node tests/e2e.mjs                 # MUST: passed: N · failed: 0
node tests/e2e-comprehensive.mjs   # MUST: 0 failed
npm run test:e2e:browser           # MUST: green, no "asynchronous activity after the test"
node --test tests/sh-files.test.mjs        # MUST: green
node scripts/check-changelog-parity.mjs    # MUST: all 16 @ vX
node scripts/check-no-also-leftovers.mjs   # MUST: ✓
career-ops-ui doctor               # MUST: exit 0
bash bin/start.sh                  # MUST: installs deps if missing, serves 127.0.0.1:4317, opens browser
curl -fsS 127.0.0.1:4317/api/health | python3 -m json.tool  # ok=true, version==vX
```

If §0 is not green, stop — nothing below is trustworthy.

## §1 — Every route loads and does its job

Navigate each and confirm it **renders real data, not a spinner/empty
state by accident**, exactly one `<h1>`, zero console errors, no 4xx/5xx
for first-paint assets:

`#/dashboard #/scan #/pipeline #/auto #/evaluate #/batch #/deep #/apply
#/tracker #/reports #/cv #/profile #/settings #/config #/health
#/activity #/help #/two-pager #/mock-interview #/networking #/cv-studio
#/memory #/stats #/career-plan #/orientation` (the last two sit in the
**Growth** nav group) + the 7 `#/<mode>` pages (contacto, followup,
interview-prep, patterns, project, training, batch-prompt) + `#/portals`
(MUST alias → `#/config`, never 404) + an unknown hash (MUST render the
dedicated 404 view, not silently fall back to dashboard).

- `#/dashboard`: the hero shows the 2 P0 CTAs + a focal *last-evaluation*
  hint (or the cold-start empty-state); KPI cards + status chips reflect
  the parent's real `applications.md`/`pipeline.md`/`reports/`.
- First paint: the `<h1>` is focusable (`tabindex=-1`) and `#content`
  is `aria-live=polite` — a screen reader hears the heading **without**
  focus being yanked from the skip-link.

## §2 — The core journey actually completes (Scenario A, cold start)

Empty parent files; set up exactly ONE provider key. Repeat the whole
arc once per provider (**Anthropic, Gemini, OpenAI, Qwen** — the "OR"
promise):

1. Land on `#/dashboard` with **0 keys** → the red onboarding banner
   states ⚡ Run-live is manual-prompt mode and links to
   `#/config?tab=api-keys`. Set one key via `#/config` → Save →
   banner is replaced by the quiet active-provider chip **without a
   server restart**.
2. `#/cv` → the editor (`#cv-editor`, descriptive `aria-label`) loads
   `cv.md`; the page title is a quiet breadcrumb, the CV preview owns
   the page; editing + Save round-trips to the parent `cv.md`.
3. `#/auto` → paste a real job URL. Before Run: the 5 pipeline steps
   are visible (pending), the "~1–2 min" ETA + the cost hint
   ("Using <Provider> <model> — ~$0.0X/eval") show. Run → the SSE
   stepper advances validate→fetch→evaluate→save report→add tracker;
   a report link + tracker row appear; the PDF is reachable.
4. `#/reports` shows the new report; `#/tracker` shows the new row;
   the funnel chips reflect it.

Every step must work end-to-end with **only that one key**. No key
anywhere ⇒ the copy-paste manual prompt (never a hard error), and the
prompt text names the canonical report blocks.

## §3 — Power-user journey (Scenario B)

`#/scan` (free-text + Remote/Hybrid/Onsite visible; Source/Scope +
facet chips behind the *Advanced filters* disclosure) → run a scan →
the multi-minute crawl shows progress, the **Stop** button is a
prominent destructive control while busy and actually aborts the
EventSource → results populate → click a company → `#/pipeline`
pre-filtered. `#/pipeline` with >1000 rows stays smooth (virtualized,
full scrollbar, ▶/✕ per row work). `#/batch` evaluates a TSV in
parallel. `#/deep` / `#/apply` / `#/<mode>` produce the right prompt
or live result, and the manual-vs-live distinction is unambiguous.

## §4 — Every API endpoint honours its contract

Hit each with valid + invalid input; assert status + body shape:

- `GET /api/health` → `{ ok, warnings, version: vX, parentVersion,
  checks[] }`.
- `GET /api/status/providers` → `{ activeProvider, activeModel,
  keysConfigured }`; matches the `.env` reality; **no secret values**.
- `GET /api/tracker` (no params) → exactly `{ rows }` (back-compat);
  `?page=&pageSize=&status=` → `{ rows, total, page, pageSize,
  funnel }` with the documented clamps; funnel = whole history.
- `GET /api/dashboard`, `/api/activity`, `/api/reports`, `/api/cv`,
  `/api/config` (secrets masked), `/api/scan/sources` (59 adapters:
  41 EN + 5 RU, incl. Dassault Systèmes),
  `/api/help/:lang` (16 locales; bad lang → `en` fallback).
- The AI/user-layer feature routes must also honour their contract:
  `GET/PUT /api/two-pager` (+ `POST /api/two-pager/draft`),
  `POST /api/interview/{turn,save}` + `GET /api/interview/sessions`,
  `POST /api/networking/{plan,save}` + `GET /api/networking/plans`,
  `POST /api/cv-studio/humanize` (no writes),
  `GET/PUT /api/memory` (+ `POST /api/memory/suggest`),
  `POST /api/stats/market` (currency + region; no writes) + the
  target-role snapshot store, `GET/PUT /api/career-plan` +
  `POST /api/career-plan/generate`, and the career-orientation route.
  Writes land only in the user layer (`config/two-pager.yml`,
  `config/memory.md`, `config/career-plan.md`, `networking/net-*.md`).
- Writes only on explicit user action: `POST /api/pipeline`,
  `POST /api/tracker`, `PUT /api/cv`, `POST /api/jds`,
  `DELETE /api/{jds,interview-prep}/:name`, `POST /api/config`, the
  streaming runners. Each must actually mutate the right parent file
  and nothing else.

## §5 — Safety envelope is real, not decorative

- SSRF: `/api/pipeline`, `/api/pipeline/preview`, `/api/auto-pipeline`
  reject loopback / `file://` / non-http(s) / script-char URLs
  (`isValidJobUrl` + DNS-pinned `safeGet`).
- XSS: a CV / JD containing `<script>`, `javascript:`, `<img onerror>`,
  entity-encoded payloads renders inert (`stripDangerousMarkdown`).
- Secrets: `GET /api/config` masks; no key is ever echoed or logged
  (the no-leak canary in `anthropic.test.mjs` / `openai.test.mjs`).
- CSP (when bound beyond loopback) excludes `'unsafe-inline'` /
  `'unsafe-eval'`; `frame-ancestors 'none'`; every `.js/.css` →
  `Cache-Control: no-store`.
- Parent boundary: `git log --stat -20` shows zero writes outside
  `web-ui/`; the server never writes parent files at rest.

## §6 — Resilience & honesty

- Kill the server mid-SSE (scan / auto-pipeline): the client surfaces
  a clear, actionable error + Retry; the server logs **no**
  uncaughtException / unhandled rejection.
- Stop a scan: the EventSource closes, state resets, no zombie poll.
- Wrong/stale key: the error names the actual provider and the fix.
- Long ops (scan, auto, batch, PDF): progress + time expectation +
  cancelability + honest cost/credit signalling — never a dead UI.

## §7 — i18n, docs & deploy parity

- Switch all 16 locales (en, es, pt-BR, ko, ja, ru, zh-CN, zh-TW, fr,
  pl, uk, da, ar, de, it, tr; Arabic is RTL) on the core flow: no
  untranslated leakage, no truncation, correct RTL mirroring,
  terminology matches career-ops.org/docs. `tests/i18n-coverage` green.
- `package.json::version` == `/api/health.version` == every
  `CHANGELOG*.md` top entry == README ×16 badge ==
  `docs/architecture/TESTING.md` totals. Help bundles ×16 at the
  parity gate (28 H2 / 103 H3). API.md documents every live endpoint.
- Pipeline AI-review: a push to `main` triggers
  `.github/workflows/ai-review.yml`; with the `ANTHROPIC_API_KEY`
  repo secret it posts a commit-comment review, without it it logs a
  clear skip and stays green (advisory, never blocks).

## §8 — Known cross-repo caveat

**G-005** (MINOR, OPEN, blocked on the parent): `modes/oferta.md`
still emits the legacy A-G report vs canonical A-F. The renderer is
schema-tolerant — **both display correctly**, so this is *not* a
functional FAIL; mark it KNOWN. It closes only via the parent
commit in `qa/G-005-closure-kit.md` STEP 1, then the gated web-ui
follow-up.

---

### Exit criteria

§0 green · §1–§7 every item PASS (PARTIALs triaged, no FAIL) ·
§F-A exhaustive matrix every item PASS · §8 the only KNOWN caveat ·
`git status` clean · tag `vX` on `origin/main` with CI green on all
jobs. Any FAIL or new PARTIAL → a one-fix ship (bump + CHANGELOG ×16 +
test + Playwright-verify + AI-review LGTM + CI-watch) before the
release is called done.

---

## §F-A — EXHAUSTIVE FUNCTIONAL MATRIX (every endpoint × every action × 16 locales)

> One row = one verifiable behaviour. Mark **PASS / FAIL / PARTIAL /
> SKIP** with evidence (request, response body, route, exact copy,
> server log). PASS only if correct **and** legible to the user. Do
> every UI action in **all 16 locales** (en · es · pt-BR · ko · ja ·
> ru · zh-CN · zh-TW · fr · pl · uk · da · ar · de · it · tr; Arabic
> is RTL) — a behaviour that's correct in `en` but emits an
> untranslated/clipped message elsewhere is **PARTIAL**.

### §F-A.1 — Read endpoints (GET) — must be correct, complete, side-effect-free

For each: 200 + documented JSON shape; no parent-file write (diff the
parent before/after — zero changes); `lang` query/body tolerated;
`:name`/`:slug` path-traversal (`../`, URL-encoded, absolute) →
sanitized 400/404, never escapes the dir; absent resource → 404 JSON
(not 500, not HTML); never leaks a secret/key/token.

`/api/health` (≥13 checks, `ok` reflects required-only; "Profile
customized" = false for fixture names — BUG-002/UX-032) ·
`/api/dashboard` · `/api/status/providers` (lists every configured
provider incl. `openrouter`; `activeProvider`/`activeModel` match the
OR-router) · `/api/config` (secrets masked) · `/api/cv` · `/api/profile`
· `/api/portals` · `/api/reports[/:slug]` · `/api/jds[/:name]` ·
`/api/tracker` (server-side pagination params honoured) · `/api/pipeline`
· `/api/pipeline/preview` (SSRF-gated) · `/api/interview-prep[/:name]`
(**served clean** — `<tool_call>`/`<tool_response>` stripped even for
pre-v1.58 saved files) · `/api/modes[/:name|_profile]` · `/api/activity`
· `/api/openrouter/models` (≥300 ids OR curated fallback — never empty;
no key required) · `/api/scan-results` · `/api/scan/sources` ·
`/api/scan/regional/config` · `/api/output/pdfs[/:name]` ·
`/api/help/:lang` (every one of the 16; unknown lang → en fallback).
SSE streams open, emit `start`→`log…`→`done`/`error`, close cleanly,
`Stop` aborts: `/api/stream/{scan,scan-parent,batch,liveness,pdf,
pdf/deep,pdf/report}`.

### §F-A.2 — Mutation endpoints — only on explicit user action, correct effect

Confirm each writes the parent **only** when the user triggers it,
via `withFileLock` where it edits `applications.md`/`pipeline.md`,
and the effect is exactly as claimed:

- `POST /api/pipeline` — valid URL appends; **duplicate → `deduped:true`,
  no second row** (client shows "Already in queue" — BUG-005);
  invalid (`not-a-url`, `javascript:`, `<script>`, loopback, `file:`)
  → 400 humanized message (BUG-006), nothing written.
- `POST /api/tracker` — appends a row; bad payload → 400, file intact.
- `POST /api/evaluate` (+ `/test-anthropic` `/test-gemini`) — empty/
  `<50` → 400 "JD required/too short"; valid → manual prompt OR live
  result tagged with the real provider; `save` writes a `jds/` file.
- `POST /api/deep` — empty company → 400; valid → brief **clean +
  markdown-formatted**, saved to `interview-prep/`.
- `POST /api/mode/:slug` — only whitelisted slugs; required fields
  enforced server-side; `#/followup` non-ISO date rejected (BUG-001
  defends client-side; server still sane).
- `POST /api/config` — known keys persist; **`lang` injected by
  api.js MUST NOT 400** (v1.57.2); bad PORT/HOST/Anthropic → 400 with
  per-field `FIELD: reason` detail; **secret value never echoed**;
  whitespace/newline-wrapped key stored trimmed & authenticates;
  applies live (no restart — verify §6).
- `POST /api/auto-pipeline` — SSE stepper; invalid URL → step-1 fail.
- `POST /api/batch/merge`, `POST /api/reports`, `POST /api/stream/pdf/inline`.
- `PUT /api/cv` — XSS payloads stripped (`stripDangerousMarkdown`),
  round-trips; `PUT /api/profile` — field/array/yaml merge keeps
  untouched keys; `PUT /api/modes/_profile` — section merge vs
  confirm-gated rebuild; `PUT /api/batch`.
- `DELETE /api/pipeline|jds/:name|interview-prep/:name` — confirm-gated
  in UI, removes exactly the target, 404 if absent.

### §F-A.3 — Every UI action produces its correct, legible effect

Per page (all 16 locales) confirm the *functional* result, not just
that a control exists: every sidebar link routes; theme toggle
persists; `⌘K`/`Ctrl K` focuses search and it filters; Doctor/Verify
show real output then the progress toast is **gone**; Scan streams
and Stop truly aborts; Pipeline add/dup/invalid/delete behave per
§F-A.2; Evaluate/Deep/modes produce output + working Copy/Download/
PDF; CV upload/save/PDF; Tracker funnel/pagination/dedup/normalize/
merge mutate correctly; Config 3 tabs save & reload reflect; Auto
stepper completes with resolvable artifact deep-links; Health numbers
match the APIs; Help TOC filters and links resolve; 404 offers a
working way back. Each must be **perceivable** — a silent success is
PARTIAL.

### §F-A.4 — Negative, boundary & abuse cases (must fail safely)

Empty/whitespace-only inputs; max-length (>4000) and 1-over; embedded
newlines/control chars; Unicode/RTL/emoji in names & JD; duplicate
submits & rapid double-click; network drop mid-request (localized
"Network error … (METHOD /path)" + recovery banner); server down then
up (auto-reconnect); concurrent writes to the same parent file (no
lost row — `withFileLock`); traversal/SSRF/XSS/`javascript:` all
rejected with the security envelope intact (CSP, headers,
`isValidJobUrl`, `safeGet`, `UI.md` escape-first — `cleanLlmMarkdown`
is declutter, NOT the sanitizer); no secret in any response or log;
no parent write from any read path.
