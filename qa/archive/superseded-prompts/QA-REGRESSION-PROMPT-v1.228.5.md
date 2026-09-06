# QA REGRESSION PROMPT — career-ops-ui **v1.228.4 → v1.228.5**

Two patch releases, both from review of the previous pass. No parent delta. Registry unchanged: **86 sources** (81 EN + 5 RU), `ALL_ADAPTERS` **81**.

## §0 — Gates
```bash
npm test                                     # 2909 (2907 at v1.228.3), exit 0
node --test tests/health-privacy.test.mjs    # 7 — 3 new across these two releases
npm run test:ci                              # exit 0
npm run test:e2e / :full / :e2e:browser      # 21/21 · 23/23 · 101/101
node scripts/check-changelog-parity.mjs      # 16 non-EN at v1.228.5
```

## §1 — v1.228.4: the liveness probe did filesystem work per request
`GET /api/ping` read and parsed `package.json` on **every hit**. It is the only endpoint reachable without credentials, so a disk read plus a JSON parse per request is a denial-of-service lever handed to anyone — CodeQL flagged it as missing rate limiting, on an endpoint added one release earlier.

The version is read once at registration. Rate limiting would have capped the damage; removing the work removes the lever.

**Check:** `/api/ping` returns exactly `{ ok, version }` — two fields, no more. Adding a third needs a second look, and the test says so.

## §2 — v1.228.4: the profile owner's name is masked off loopback, and now pinned
`/api/health` already replaced the owner's real name with `hidden` on a non-loopback bind — **but only because that row shared the `hidden ?? value` guard with the project root.** Nothing tested it, so an edit giving the row its own value would have leaked a real person's name to the LAN with nothing to notice.

**Check:** on `HOST=0.0.0.0`, `Profile customized` reads `hidden` and the name appears nowhere else in the payload. Note the row embeds the name in a status string rather than being the bare name — which is exactly why the guard must cover the whole value.

## §3 — v1.228.5: the version described the file, not the running code
**FIND-4 from the previous pass.** `/api/health` re-read `package.json` per request, so a process started before a deploy reported the *new file's* version while serving the old code. The reporting instance answered `version: 1.228.4` while 404ing `/api/ping`, a route added in 1.228.3.

That is how a deploy that copies files and never restarts **looks like a success**: the one string an operator checks is the one that cannot see the problem. Same class as the v1.228.1 symlink, and part of why that one survived a release is that the version check afterwards looked right.

The version is captured at module load. A stale process now reports the **old** version — the truth, visible on the first request. `parentVersion` stays per-request on purpose: it describes the parent checkout, which this process does not load and which can legitimately change underneath a running server.

**Check, and this is the important part — do not verify a deploy by the version string alone.** Check something behavioural that the release changed:

| release | behavioural marker |
|---|---|
| v1.228.2 | `?q=менеджер продакт` (reversed word order) returns a non-zero total |
| v1.228.3 | `/api/ping` exists; `telegram_channels` is answerable in EN |
| v1.228.4/5 | `/api/health` and `/api/ping` report the same version |

## §4 — Two things about the tests themselves
- **The version guarantee is pinned without touching `package.json`.** The first draft of that test rewrote the real file and restored it in a `finally` — which survives an exception but not a killed run, and an empty `package.json` is a hole this project fell into once already during this series. It now checks that both endpoints agree *and* that `package.json` is not read inside `registerHealthRoutes`, because a runtime check cannot tell a module-scope read from a per-request one without moving the file under a live server. Verified non-decorative: putting the read back inside the handler fails the test.
- **`tests/cli-doctor.test.mjs` parses `package.json`** and fails on an empty file. An earlier claim in this series that the suite could not catch that was wrong. The gap was never coverage — it was committing without running the suite.

## §5 — Open, and not code
- **cvstart.ru now has its own Pages site** (`Fighter90/cvstart-ru-redirect`), which is the right shape: the one-custom-domain limit is per repository, so a second repository is a second site. Certificate state was `new` at the time of writing. Two things to check once it issues: `cert_domains` covers only the apex, so `www.cvstart.ru` has no certificate; and the redirect doubles the prefix for `cvstart.ru/ru/...` → `cvstart.org/ru/ru/...`, since it appends the whole pathname after `/ru/`. The Caddy redirect block on the project's own server is no longer needed and stays uninstalled.
- **ZeroSSL is dead as Caddy's fallback issuer** (`HTTP 422 caddy_legacy_user_removed`). Scope, measured rather than asserted: the Let's Encrypt production account is healthy, the certificate is a 89-day one expiring 12 Nov, and Caddy starts renewing 13 Oct — a **29-day retry window**. The missing fallback matters only if Let's Encrypt is unreachable for that whole month. Caddy is 2.6.2.
- **280 px shows a 5 px overflow** from content wrapping inside cards, not from any element exceeding the viewport. `WIDTHS = [320]` remains correct.
