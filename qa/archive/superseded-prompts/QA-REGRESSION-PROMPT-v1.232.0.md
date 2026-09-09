# QA regression — v1.232.0

Two defects from a browser QA pass, both **older than v1.231.5** — that release's
diff was `package.json`, the lockfiles and docs, so neither could have come from it.

## §0 — Gates

```bash
node --test tests/playwright-card-overflow.mjs      # 2 pass (needs a browser)
node --test tests/config-select-domains.test.mjs    # 5 pass
npm run test:ci                                     # 3018 pass, exit 0
npm run test:e2e:browser                            # 105 pass (card-overflow now registered)
```

Baseline 3013 → **3018**: five CONFIG-1 cases. The two PROFILE-1 cases are
browser-only and stay out of `test:ci`.

## §1 — PROFILE-1: `#/profile` scrolled the whole page sideways

Each profile field is a `.card` in a `.card-row` grid of
`repeat(auto-fit, minmax(220px, 1fr))`. The value was an anonymous `<div>` with
only inline font styles, so its computed `overflow-wrap` stayed `normal`. A
LinkedIn vanity URL gives CSS no legal break point, so **min-content width is
the whole string**, and `min-width: auto` on grid items refuses to shrink below
it. The card burst its track, then the row, the main column and the document.

Measured on the fixture: cards overflowed at **768, 1024, 1280 and 1440 px**;
at 1280 px it reached the document as 23 px of real horizontal scroll. Width
dependent, which is why it hid — ≤ 420 px drops to one wide column, and between
768 and 1024 px the text only spills out of the card without moving the page.

Fixed with a shared `.card-value` class carrying `overflow-wrap: anywhere`,
plus `.card-row > * { min-width: 0 }` as a backstop. **`anywhere`, not
`break-word`:** only `anywhere` is counted when the browser computes
min-content, so `break-word` would wrap the text and leave the track just as
wide. `dashboard.js` uses the same class; `health.js` already had
`word-break: break-all` and needed nothing.

## §2 — CONFIG-1: `POST /api/config` accepted any value for a select field

`{"LLM_PROVIDER":"not-a-provider"}` returned **200** and was written to the
user's `.env`. Nothing then errored: the resolver fell back to whichever key was
configured, `/api/status/providers` reported a working provider, and the setting
the user chose silently had no effect.

`LLM_PROVIDERS` — the exact 19-value domain — has been exported from
`env-config.mjs` all along; the validator simply never consulted it. It does now.

**Only `LLM_PROVIDER` is enforced.** The 16 model dropdowns are not, on purpose:
their real domain is the vendor's catalogue, which moves between our releases,
so enforcing our curated list would block a model the provider already serves
(this repo's own suites configure `gemini-2.0-flash`, which the curated list
dropped). A wrong model fails loudly at call time; only a wrong provider fails
silently. `select-remote` is excluded for the same reason.

**An already-stored value is grandfathered.** The form resends every non-secret
field on every Save, touched or not, so a strict check froze the page for anyone
whose `.env` predated it — a browser test caught it. Changes are still refused.

Also: `OLLAMA_API_KEY` was writable through the API but had no field in
`#/config`, so a user behind an authenticating Ollama proxy could not set it
from the app. It has a descriptor now (secret, 2 new i18n keys ×17). Server keys
and UI descriptors are both 45 and a test asserts they stay equal.

## §3 — Manual browser pass

1. `#/profile` at **1280** and **1440 px** with `linkedin` filled: no horizontal
   scrollbar, the URL wraps onto several lines, nothing is clipped.
2. At **768** and **1024 px**: no card is wider than its column.
3. Repeat in ru/ar/ja — the label length must not matter, only the value.
4. `#/config` → change a provider → Save shows the success toast; picking a
   nonsense value is impossible from the dropdown, and curl-ing one returns 400
   naming the field and listing the options.
5. `#/config` → the **OLLAMA_API_KEY** field exists, is masked, and saves.

## §4 — Invariants

- Registry stays **92** sources (87 EN + 5 RU); help stays 32 H2 / 122 H3 ×17.
- The empty string still unsets a key (`written: []`, key removed from `.env`).
- All three stylesheets within the 800-line contract.

## §5 — Sign-off

- [ ] `npm run test:ci` — 3018 pass, exit code captured directly
- [ ] `npm run test:e2e:browser` — 105 pass
- [ ] Manual: profile at 1280/1440, config save, OLLAMA_API_KEY field
- [ ] `/api/health` on resumecraft.ru reports 1.232.0
