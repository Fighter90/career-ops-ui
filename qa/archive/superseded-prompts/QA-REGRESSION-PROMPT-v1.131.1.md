# QA Regression Prompt — v1.131.1 (adapter host-pinning hardening)

> Patch. Code-review follow-ups on the two v1.130.0 sources. Defense-in-depth
> only — no behavior change for valid inputs. Baseline: v1.131.0 (green, 2133).

## What changed

- **`a16z-speedrun-talent` adapter** — `buildEndpoint` re-validates the `api:` /
  `a16z-speedrun-talent:` override (HTTPS + exact host `speedrun-talent-network.com`)
  and returns the canonical `FEED_URL` when it fails, instead of passing an
  off-host value to the fetch slot (parity with the `cryptocurrencyjobs` adapter).
  The exact-host check is a single exported `SPEEDRUN_TALENT_HOST_RE` shared by
  `assertSpeedrunUrl` and the adapter.
- **`cryptocurrencyjobs` source** — `cleanUrl` now uses `CRYPTOCURRENCYJOBS_HOST_RE`
  (exact match) instead of `endsWith`, so a `sub.cryptocurrencyjobs.co` item link
  is dropped: the parser is never looser than the SSRF guard / adapter override.
- +2 tests → **2135**.

## Sign-off checklist

- [ ] `npm test` — **2135** green (capture `$?`, never `| grep`).
- [ ] `node --test tests/sources-a16z-speedrun-talent.test.mjs tests/sources-cryptocurrencyjobs.test.mjs` — green; the new "buildEndpoint re-validates the override host" (off-host/non-HTTPS/subdomain → feed) and "subdomain link is dropped" cases pass.
- [ ] `node --test tests/adapter-registry.test.mjs` — `ALL_ADAPTERS.length === 67`, unchanged.
- [ ] Manual: `a16zSpeedrunTalentAdapter.buildEndpoint({ api: 'https://evil.example.com/x' })` → `FEED_URL`; an on-host HTTPS override is returned verbatim.
- [ ] No source-registry / i18n / help / route change (no §17, no new keys, H2/H3 29/105 unchanged).
- [ ] CHANGELOG parity ×17 at 1.131.1; README banner ×17; tests badge 2135 ×17.
- [ ] `/api/health` → `version 1.131.1`, `parentVersion 1.24.0`.
