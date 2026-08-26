# QA REGRESSION PROMPT — career-ops-ui **v1.221.0** (DNS-rebinding hardening on the scanner)

**Security release, server-only.** Adds resolved-IP validation to the scanner HTTP core so a source hostname that resolves to a private/loopback/cloud-metadata address is refused before the connection. Defence-in-depth; no behaviour change for a healthy scan.

- **Under test:** `package.json` **1.221.0**. Sources **83** (unchanged). No client/i18n-key change.

## §0 — Gates

```bash
npm test                                                   # 2775, exit 0
node --test tests/http-json-dns-guard.test.mjs             # 4 (loopback/metadata/RFC1918 blocked, mock skips, bad URL passes)
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.221.0
```

## §1 — What changed (server-only)

- `server/lib/http-json.mjs` — `fetchJson`/`fetchText` call a new `guardResolvedHost(fetchImpl, url)` before fetching:
  - runs **only** when `fetchImpl === globalThis.fetch` (the real network path);
  - `dns.lookup`s the URL's hostname and throws `ECAREEROPS_BLOCKED_ADDRESS` when the resolved IP is caught by `security.mjs::isPrivateOrLoopbackHost` (loopback / RFC1918 / link-local + `169.254.169.254` cloud-metadata / CGNAT / IPv6 ULA/link-local);
  - **fail-open** on a resolver error (a host that won't resolve can't be connected to anyway — let `fetch` surface the real failure).
- An injected test `fetchImpl` (≠ global `fetch`) is never resolved, so all 60 mocked source suites are unaffected.

## §2 — Why this is safe + scoped

- The **user-supplied-URL** path (`/api/pipeline/preview`, `/api/auto-pipeline`, logos, discover-ats, liveness) already had stronger DNS **connection-pinning** in `safe-fetch.mjs` (v1.20.1) — unchanged.
- Scanner sources are host-pinned to public registrable domains, so a rebinding attack there requires controlling that domain's DNS — infeasible; this guard is defence-in-depth for a misconfigured source or a hostile record.
- **LLM providers are NOT affected** — Ollama (`localhost:11434`) and Hermes (`127.0.0.1:8642`) fetch through `openai.mjs`'s own transport, never `http-json`, so their loopback URLs keep working.

## §3 — Manual check

A normal scan is unchanged (public boards resolve to public IPs). A source pointed at a hostname resolving to `127.0.0.1` / `169.254.169.254` / a `10.x`/`192.168.x` address fails with `ECAREEROPS_BLOCKED_ADDRESS` instead of connecting inward.

## §4 — Sign-off

Suite **2775** green · guard blocks loopback/metadata/RFC1918 on the real fetch path, skips injected mocks, and reuses the existing `isPrivateOrLoopbackHost` ranges · no CSP/route change · LLM loopback providers unaffected · changelog parity ×17 at v1.221.0 · README banner+badges ×17 · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed. Closes the last queued plan item. Deploy: Pages (facts/version), local + resumecraft restart (server change).
