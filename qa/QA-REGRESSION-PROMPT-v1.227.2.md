# QA REGRESSION PROMPT — career-ops-ui **v1.227.2** (MOBILE-1: `#/config` narrow-viewport overflow)

**Patch release, no parent delta.** One layout defect from the v1.227.1 browser regression, plus the gate that would have caught it. Registry unchanged: **85 sources** (80 EN + 5 RU), `ALL_ADAPTERS` **80**.

## §0 — Gates
```bash
npm test                                              # 2846, exit 0 — capture $? directly, never pipe to grep
npm run test:e2e:browser                              # 101 (was 99)
node --test tests/playwright-narrow-viewport.mjs      # 2 — MOBILE-1
node scripts/check-changelog-parity.mjs               # 16 non-EN at v1.227.2
npm run test:ci                                       # exit 0
npm run test:e2e                                      # 21/21
```

## §1 — MOBILE-1 · `#/config` overflowed horizontally at ≤ 352 px
- **Was:** every select-kind field carried an **inline** `min-width: 300px`. An inline style beats the stylesheet, so the control could not shrink with its container. At 320 px the select's right edge landed at **353 px**, the page grew a horizontal scrollbar, and controls were pushed off the right edge. All **18** provider/model selects (`cfg-llm-provider`, every `cfg-*-model`).
- **Now:** `min-width: min(300px, 100%)` + `max-width: 100%` — the 300 px comfort width applies only when there is room. One construction site in `public/js/views/config.js`, so one edit covers all 18.
- **Threshold:** the select starts at x≈53 and was 300 wide → right edge 353, so anything ≤ 352 px broke. iPhone SE 1st gen (320), older Android, Galaxy Fold cover screen (280). 360/375 px had just enough slack to hide it — which is why every earlier mobile pass read clean.

## §2 — The gate
`tests/playwright-narrow-viewport.mjs`, wired into `npm run test:e2e:browser`:
1. **no route scrolls horizontally at 320 px** — sweeps `#/config`, `#/dashboard`, `#/scan`, `#/tracker`, `#/cv`, `#/help`; on failure it names the widest offending element (tag + id + class + right edge) so the assertion points straight at the cause.
2. **no `#/config` select extends past the viewport** — reports each offender's id, right edge and inline `min-width`.

Verified to **fail first**: `#/config at 320px: scrollWidth 353 > clientWidth 320 — widest element right edge 353px (SELECT#cfg-llm-provider.select)`, and 18 selects listed at 353. A gate never seen red is not a gate.

## §3 — Known, documented, NOT gated: 280 px
The Galaxy Fold cover screen still overflows by ~5 px, from an **unrelated** cause: long content inside the config card's `<details>` blocks (`scrollWidth 232` in a `174` box) and the 256 px sidebar against a 280 px viewport — not the inline `min-width` this release fixes. No single element exceeds the viewport; it is a content-reflow problem. Reflowing for a width no mainstream phone reports is separate work. The suite's `WIDTHS` list is `[320]` and ready to become `[320, 280]` once that lands.

## §4 — Manual browser pass
1. Device emulation at **320×720** (not a window resize) → `#/config`: no horizontal scrollbar, `document.documentElement.scrollWidth === clientWidth`, every provider select fits.
2. Same at **375×812** — unchanged from before; selects still render at a comfortable width.
3. `#/config` on a desktop width: selects are still 300 px wide (the `min()` must not shrink them where there is room).
4. Sweep `#/dashboard`, `#/scan`, `#/tracker`, `#/cv`, `#/help` at 320 px — no horizontal overflow.
5. Spot-check RTL (`ar`) at 320 px.

## §5 — Not changed
No registry, scanner, route-contract, server, i18n-dict or help-bundle change. Unit suite unchanged at **2846** — the new coverage is browser-level by nature.

## §6 — Carried forward (not this release)
- **SURF-1 · cvstart.ru** — GitHub Pages reports `https_certificate.state: "new"` and `https_enforced: false`; the domain is served GitHub's default `*.github.io` cert, whose SAN list has no `cvstart.ru`, so browsers reject it. DNS is correct (apex → 185.199.108–111.153). The `CNAME` file has been created/deleted three times, and each delete resets Let's Encrypt provisioning. Re-requested via the Pages API; provisioning is asynchronous. **Note for future runs:** a local `curl` here reports HTTP 200 because Kaspersky MITMs TLS and re-signs with its own CA — verify this surface with `openssl s_client` or an uninstrumented machine, never with local curl.
- **resumecraft.ru** — Basic-auth gated (`WWW-Authenticate: Basic realm="restricted"`); it is only reachable from a browser with cached credentials, so the surface is still unverifiable from a clean machine. Needs an unauthenticated `/api/health` (or a separate health host) plus an HSTS header.
- **docs-assistant retrieval** is phrasing-sensitive: doc-shaped queries hit §17, conversational ones fall through to a refusal.

## §7 — Sign-off
Unit **2846** · Playwright **99 → 101** · E2E 21/21 + 23/23 · parity ×17 at v1.227.2 · README banner+badges ×17 · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed · site mirrors ×17 rebuilt (facts 1.227.2). Deploy: Pages, local + resumecraft, wiki.
