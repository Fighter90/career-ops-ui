# QA REGRESSION PROMPT — career-ops-ui **v1.177.0** (csod session-cookie replay)

**Parent-sync GAP #1 (MEDIUM, scanner — `qa/PARENT-SYNC-WORKLIST-v1.26.0.md`; parent #2769).** Some Cornerstone (csod) tenants set session cookies on the bootstrap career-site home page and answer `401 CSOD Unauthorized` on the search API unless those cookies come back with the anonymous bearer token — so the scan returned **0 jobs** for those tenants.

- **Under test:** `package.json` **1.177.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2454, exit 0 (capture $? directly, never | grep)
node --test tests/sources-parity-v1118a.test.mjs tests/http-json.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.177.0
```

## §1 — Fix

- **New `server/lib/http-json.mjs::fetchResponse(fetchImpl, url, opts)`** — a response-returning sibling of `fetchText`/`fetchJson` (same `redirect:'error'` SSRF stance). Reads the body once and returns `{ status, headers, text() }` so `headers.getSetCookie()` (repeated Set-Cookie) survives on a real fetch and a test stub can expose whatever headers it likes. Additive — no existing source calls it.
- **`sources/csod.mjs`** — reads the bootstrap through `fetchResponse`, builds a `Cookie` header from the response's `Set-Cookie` via the new exported `cookieHeaderFrom` (leading `name=value` only; Path/HttpOnly/Secure/… dropped; last definition wins), and replays it on the search POST as `...(cookie ? { cookie } : {})`.

## §2 — Safety

- **Same-origin only** — `assertCsodUrl` host-pins to `*.csod.com` and every request uses `redirect:'error'`, so a 3xx can't move the session cookies to another host. Cookies are never sent to a third party.
- **No-cookie tenants unchanged** — when the bootstrap sets no cookies, `cookieHeaderFrom` returns `''` and no `cookie` header is sent (pre-#2769 behaviour byte-identical).

## §3 — Invariants

- `fetchText` was removed from the csod import (now unused). Scanner in-process only; no route / CSP / SSRF / parent-write change; no new dependency.

## §4 — Sign-off

Suite **2454** green · `sources-parity-v1118a` cookie test (replay + `cookieHeaderFrom` unit + no-cookie preservation) · same-origin guard intact · parity ×17. **Closes PARENT-SYNC GAP #1.** Remaining backlog: GAP #4 (Chrome UA 131→151), GAP #5 (states FALLBACK aliases), decoder consolidation.
