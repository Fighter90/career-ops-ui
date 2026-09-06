# Parent-sync worklist — career-ops v1.20.0 → v1.26.0

> Generated 2026-08-13 after merging santifer/career-ops upstream into Fighter90/career-ops
> (parent now at VERSION 1.26.0, HEAD `7ac66bd`). web-ui was at v1.171.0.
>
> **All 73 parent provider sources are already ported** to `server/lib/sources/` (web-ui also
> carries 5 extra RU sources + rss). So this range brought **no new sources** — only quality/
> hardening diffs to shared modules and existing adapters. Systematic parent-vs-web-ui behavioral
> comparison (`16c8497..0cbe710`) found **5 real GAPs**; everything else is already ported or N/A.

## GAPs to port (prioritized)

### 1. csod — bootstrap session-cookie replay — MEDIUM-HIGH
- **Parent** `providers/csod.mjs` (`7aee3b9` #2769): some Cornerstone tenants return `401 CSOD Unauthorized`
  on the search API unless the bootstrap page's `Set-Cookie` values are replayed as a `Cookie` header.
  Parent reads bootstrap via `fetchResponse` (to see `getSetCookie()`), builds a cookie header, replays it
  same-origin (`redirect:'error'`).
- **web-ui** `server/lib/sources/csod.mjs:10-11`: comment says "no session cookies"; sends only the bearer
  token → will 401 on the exact tenants #2769 fixes.
- **Action:** add a `fetchResponse`-style helper to `server/lib/http-json.mjs` (expose response headers /
  `getSetCookie()`), extract bootstrap cookies in `csod.mjs`, replay as `Cookie` on the search fetch
  (same-origin, https-only, `redirect:'error'`).

### 2. HTML-entity decoder — can throw RangeError + XML-1.0-Char drift — MEDIUM
- **Parent** `providers/_html-entities.mjs` (`a050631` #2713, `0448748` #2150): one shared decoder;
  `isEmittableCodePoint()` restricts numeric refs to the XML 1.0 §2.2 Char set (rejects NUL, C0 controls,
  surrogates, U+FFFE/FFFF, >0x10FFFF); regex matches hex vs decimal separately (`#[xX][0-9a-fA-F]+|#[0-9]+`)
  so `&#1a2;` no longer mis-parses.
- **web-ui:** no shared module — ~10 per-source copies at 3 drift levels. **Worst (crash path):**
  `sources/oraclecloud.mjs:101`, `sources/gem.mjs:152`, `sources/dassault.mjs:80` use bare
  `Number.isFinite(code) ? String.fromCodePoint(code) : m` with **no try/catch** → `&#99999999;` throws an
  uncaught `RangeError`, aborting that source's parse (the #2150 bug). Middle tier
  (deutschebahn/rheinmetall/hecklerkoch/radancy/agenticjobs) won't throw but admits NUL/C0/noncharacters and
  mis-parses `&#1a2;`. `sources/jobvite.mjs:224` already matches parent behavior.
- **Action:** add `server/lib/html-entities.mjs` mirroring parent `isEmittableCodePoint` + split regex; route
  every source's `decodeEntities` through it. **Min viable:** patch the 3 bare sources so they can't throw.

### 3. cli-detect — Hermes not probed — LOW-MEDIUM
- **Parent** `docs/SUPPORTED_CLIS.md` lists **Hermes** (`HERMES.md`, binary `hermes`) with Kimi + Copilot.
- **web-ui** `server/lib/routes/cli-detect.mjs:25-37` `KNOWN` = claude, cursor, codex, gemini, opencode,
  copilot, qwen, antigravity(`agy`), grok, kimi — **10 tools, no `hermes`** (Kimi ✓ Copilot ✓ already present).
- **Action:** add `{ id: 'hermes', name: 'Hermes', bins: ['hermes'] }`; bump the roster count in
  CLAUDE.md/help/config prose ("9 first-class … = 10 tools" → 11).

### 4. BROWSER_LIKE_USER_AGENT — stale Chrome — LOW
- **Parent** `user-agent.mjs`: `Chrome/151.0.0.0`.
- **web-ui** `server/lib/http-json.mjs:26-27`: `Chrome/131.0.0.0` (used by workable/workday/oraclecloud/
  a16z/eightfold to clear WAF bot gates).
- **Action:** bump the Chrome token to 151.

### 5. states.mjs FALLBACK constant — stale vs states.yml — LOW (fallback-only)
- **Parent** `templates/states.yml` (`04ef492` #2615): added Turkish + extra aliases (değerlendirildi,
  başvuruldu, yanıt verildi, mülakat, teklif, reddedildi, iptal edildi, uygun değil, kabul edildi/işe alındı,
  sent, accept) + `terminal:` keys.
- **web-ui** `server/lib/states.mjs:24-34`: hardcoded `FALLBACK` (labelled "parent v1.23.0") missing those;
  comment falsely claims "byte-identical". **Live** web-ui reads the real `templates/states.yml`
  (`readCanonicalStates()`), so aliases ARE picked up at runtime — FALLBACK only bites on a fresh clone / CI
  `CAREER_OPS_ROOT`.
- **Action:** refresh the `FALLBACK` array to match parent v1.26.0 states.yml.

## Verified ALREADY-PORTED (no action)
- Jobvite XML feed migration (#2623) — `sources/jobvite.mjs` uses `Xml.aspx?c={eId}`, host-pinned.
  *(optional LOW: it imports `fetchText`, not `fetchTextWithRetry` — a retry wrapper would harden the 2nd-request 429.)*
- Personio HTML fallback (`5fe2784`) — `sources/personio.mjs:152-235`.
- Workable hardening (#2675) — `sources/workable.mjs` UA + headers + `fetchJsonWithRetry` + `serialized()`.
- Oracle numbered tenant apexes (#2683) — `sources/oraclecloud.mjs:60` `ORACLE_HOST_RE`.
- isRetryableError refused-redirect (#2657) — `http-json.mjs:137-143`.
- title_filter AND-groups (#2552) — `location-filter.mjs:49-102`.

## N/A (parent-only)
- UA consolidation module (#2536) — parent-internal; web-ui uses its own per-source UA convention.
- Vendor-detection gaps (#2658) — in `analyze-patterns.mjs` (web-ui relays read-only via `GET /api/stats/patterns`).
- workday cap-hit provenance (#2763) — no `--since` paging in web-ui's in-process workday port.
- All `fix(web)` commits — target the parent's own Next.js `web/` folder (a different project).

## Recommended porting order
2 (crash fix — start with the 3 bare sources) → 3 (Hermes, user-visible) → 1 (csod, correctness) →
4 (UA) → 5 (states FALLBACK). One fix per release.
