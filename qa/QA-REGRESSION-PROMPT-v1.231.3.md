# QA regression — v1.231.3

One defect, reported from a phone the day v1.231.2 shipped: **clicking Doctor
broke the top bar.** The icon-only button came back as a wide "🩺Doctor" pill
that spilled over the theme toggle.

## §0 — Gates

```bash
node --test tests/with-spinner-preserves-children.test.mjs   # 3 pass
node --test tests/qa-report-fixes.test.mjs                   # 73 pass
npm run test:ci                                              # 3012 pass, 0 fail, exit 0
npm run test:e2e:browser -- tests/playwright-narrow-viewport.mjs   # 3 pass (needs a browser binary)
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
- [ ] Manual pass at 320 px, two consecutive Doctor taps
- [ ] `/api/health` on resumecraft.ru reports 1.231.3
