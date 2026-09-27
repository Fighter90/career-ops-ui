# QA regression — v1.238.2

Follow-up to v1.238.1. After the heap fix the prod server no longer restarted, but
Caddy still answered 62 page and asset loads with 502 *connection reset by peer*
while the hourly scan ran. **Counts:** 98 sources (93 EN + 5 RU) / 93 adapters —
unchanged. **Tests 3486 → 3488.**

## §0 — Gates

```bash
node --test tests/http-keepalive.test.mjs              # 2 pass — the 7 s idle test fails without the fix
node --test tests/scan-single-flight.test.mjs          # still 3 pass
npm run test:ci                                        # 3488 (3485 + 3 skipped), exit 0
npm run test:e2e:browser                               # 116 pass
npm run test:e2e && npm run test:e2e:full              # smoke + 23/23
node evals/workflow/run.mjs                            # 0 fail
```

## §1 — What changed

1. **Proxy-safe keep-alive.** The server starts through `listen()` in
   `server/lib/http-timeouts.mjs`: `keepAliveTimeout` 125 s (longer than Caddy's
   2-minute idle upstream default), `headersTimeout` 130 s. The proxy, not the app,
   now closes idle connections, so a busy event loop can no longer reset a socket
   Caddy has just reused.
2. **`verify` explains 502s.** Caddy's `http.log.error` reasons (addresses masked),
   502s per minute since the viewer started, and the scan timer's outcome lines.
3. **`release.yml` on dispatch** creates a tag that does not exist yet at the
   dispatched commit, after the `package.json` == tag check.

## §2 — Manual pass

1. `curl -sI http://127.0.0.1:4317/ | grep -i keep-alive` → `Keep-Alive: timeout=125`.
2. With a scan running, reload `#/dashboard` and `#/reports` repeatedly for a minute:
   no 502, no half-loaded page.

## §3 — Invariants

- Local use without a proxy is unchanged apart from idle sockets living longer; the
  server still binds `127.0.0.1` by default.
- One scan at a time (`SCAN_BUSY`) and the heap drop-in from v1.238.1 stay.

## §5 — Sign-off

- [ ] §0 gates green with the counts above
- [ ] deploy, then `verify`: NRestarts 0 and **no new 502s** through an hourly scan
- [ ] remote QA green on prod, including `live: true`
