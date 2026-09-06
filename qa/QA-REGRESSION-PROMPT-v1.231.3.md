# QA regression — v1.231.3

Two defects in the top bar v1.231.2 rebuilt, both found against the live build.

1. **Clicking Doctor broke the bar** — the icon-only button came back as a wide
   "🩺Doctor" pill spilling over the theme toggle. Reported from a phone the day
   v1.231.2 shipped.
2. **FIND-3: the search field had collapsed to 8 px** at 320 px — one character
   of a 21-character placeholder. Found by a browser regression pass.

## §0 — Gates

```bash
node --test tests/with-spinner-preserves-children.test.mjs   # 3 pass
node --test tests/qa-report-fixes.test.mjs                   # 73 pass
npm run test:ci                                              # 3012 pass, 0 fail, exit 0
npm run test:e2e:browser -- tests/playwright-narrow-viewport.mjs   # 4 pass (needs a browser binary)
```

Baseline moved 3009 → **3012**: three CI-isolated `withSpinner` cases. The
fourth new case is the Playwright one, which is opt-in and not in `test:ci`.

## §1 — What changed

`UI.withSpinner` (`public/js/api.js`) did its busy cue through `textContent`:

```js
const original = button.textContent;               // "🩺Doctor"
button.textContent = '⏳ ' + original;              // both spans destroyed
button.textContent = button.dataset.originalText;  // one bare text node
```

Assigning `textContent` replaces **every** child with one text node. v1.231.2
had just split each top-bar action into `.btn-ico` + `.btn-label` spans and
hidden the label under `max-width: 900px`, so the first Doctor tap removed both
spans for good. The mobile rules had nothing left to match: the label reappeared
as bare text and the 36 px square grew into a pill that pushed the row out of
the bar. It never healed — only a page reload restored the markup.

The fix snapshots the child **nodes** and restores them with
`replaceChildren`. Text-only buttons — the large majority of the 24 call sites —
round-trip exactly as before. A `dataset.spinnerBusy` flag keeps a re-entrant
call from snapshotting the hourglass as if it were the original content.

## §1b — FIND-3: the search field

Putting the bar on one row left the searchbar as the only flexible item — this
changelog said so out loud a release ago ("may shrink to nothing"). It did:
**8 px of input at 320 px, 28 px at 340 px.**

No `min-width` fixes it. At 320 px the bar holds 32 px of padding, a 40 px menu
and 162 px of actions; there is no 120 px left. Below **420 px** — the width at
which the field clears 100 px unaided — it now hides behind a magnifier and
expands over the whole bar on tap.

| width | before | after |
|---|---|---|
| 320 px | 8 px | magnifier → **182 px** |
| 360 px | 48 px | magnifier → **222 px** |
| 390 px | 78 px | magnifier → **252 px** |
| 421 px | ~107 px | **109 px**, shown directly |
| 1280 px | 447 px | **447 px**, unchanged |

The disclosure keeps ONE accessible name and reports state via `aria-expanded`
— no second i18n key, and nothing renames itself under the user. The 🔍/✕ swap
is pure CSS: no JS writes into that button, which is what broke Doctor above.

Also levelled: the four actions rendered 36×36, 36×36, 36×44, 36×44. The odd
pair was the *short* one — `.btn` carries a `min-height: 44px` floor restored
for WCAG 2.5.5, so the bell and theme toggle were the ones below it. All five
(the magnifier included) are now 36×44. Width stays 36 px: five 44 px squares
plus a 40 px menu do not fit a 320 px bar, and 36 px still clears the 24 px
WCAG 2.5.8 AA minimum.

## §2 — Manual browser pass

At **320 px**, on `#/dashboard`:

1. The top bar is one row: `[☰]` `[search]` `[🔔] [🌙] [🩺] [⚡]`.
2. Tap **🩺**. It shows ⏳ while in flight.
3. When it settles (modal or error toast — either is fine), the button is a
   36 px square again with the stethoscope and **no** "Doctor" text.
4. Tap it a second time. Same result — the bug was permanent after one tap, so
   a second tap is the honest check.
5. Nothing scrolls horizontally, and the actions still share one row.

Repeat at **390 px** and in a locale with a long label (de "Doctor", ru
"Доктор") — the label is hidden, so locale must not change the geometry.

Then the search, at 320 px:

6. The field is not shown; a 🔍 sits with the other actions.
7. Tap it. The field takes the whole bar, gets focus, and the menu and other
   actions step aside. The 🔍 becomes ✕.
8. Type something, then tap ✕ — the text survives (blur only closes an EMPTY
   field, so an unsubmitted query is never thrown away). Esc closes it too.
9. Nothing scrolls horizontally in either state.
10. At **430 px** the magnifier is gone and the field is shown directly.

Above **900 px** the labels return and the buttons are pills again; click
Doctor there too and confirm the label comes back intact, not doubled.

## §3 — Invariants

- No route, CSP, SSRF or server surface is touched. `public/js/api.js` is the
  only runtime file in the diff.
- `withSpinner` still returns the awaited result, still disables the button in
  flight, still sets and clears `aria-busy`, and still restores the prior
  `disabled` state — all four are asserted.
- The restore path runs from `finally`, so it holds whether the request
  succeeds or throws. The browser test relies on this: it clicks Doctor against
  a fixture root with no parent checkout, so the call fails by design.

## §4 — Not applicable

- No parent-sync. No new scan source: the registry stays **92** (87 EN + 5 RU).
- No i18n dictionary change. No help-bundle change (still 32 H2 / 122 H3 ×17).

## §5 — Sign-off

- [ ] `npm run test:ci` — 3012 pass, exit code captured directly, not grepped
- [ ] Playwright narrow-viewport — 3 pass
- [ ] CI matrix (Node 18/20/22 + CodeQL) green
- [ ] Manual pass at 320 px: two consecutive Doctor taps, and the search
      open/close cycle with text in the field
- [ ] All five top-bar actions measure 36×44
- [ ] `/api/health` on resumecraft.ru reports 1.231.3
