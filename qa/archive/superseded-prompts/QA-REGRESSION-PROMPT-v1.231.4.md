# QA regression — v1.231.4

One defect: **v1.231.3 fixed the aftermath of the Doctor click, not the
moment.** The user reported it again, from mobile and from desktop, with the
button mid-run.

## §0 — Gates

```bash
node --test tests/with-spinner-preserves-children.test.mjs        # 4 pass
npm run test:ci                                                    # 3013 pass, exit 0
npm run test:e2e:browser -- tests/playwright-narrow-viewport.mjs   # 4 pass (needs a browser)
```

Baseline 3012 → **3013**: one case asserting the in-flight state.

## §1 — What changed

v1.231.3 made `withSpinner` snapshot the child nodes and restore them in
`finally`. The spans came back — but the **in-flight** state still did

```js
button.replaceChildren(document.createTextNode('⏳ ' + original));
```

so for the whole length of a `doctor.mjs` run the 36 px square held the text
`⏳ 🩺Doctor` and became a wide pill that broke the row. On desktop it rendered
as a jammed `⏳🩺Doctor`. Restoring the children fixed the aftermath, not the
moment, and an end-state-only assertion passed it.

A button that **has element children is now never rewritten**. Its cue is the
`.is-loading` class, which the stylesheet already dimmed and which now swaps
the icon for an hourglass in CSS, so the geometry cannot change. Text-only
buttons — 23 of the 24 call sites — keep the prepended hourglass, unchanged
since v1.58.

Measured:

| viewport | idle | in flight | after |
|---|---|---|---|
| 320 px | 36 px | **36 px** | 36 px |
| 1280 px | 88 px | 114 px | 88 px |

The desktop growth is the hourglass being added beside a visible label, which
is what every other button in the app has done for many releases. No overflow
at either width, and the icon is hidden while loading, so there is no
`⏳🩺Doctor` pile-up.

## §2 — Manual browser pass

At **320 px** on `#/dashboard`:

1. Tap **🩺**. **While it runs**, the button must stay a 36 px square showing ⏳
   — not a `⏳ 🩺Doctor` pill. This is the whole fix; watch the run, not the end.
2. When it settles, the stethoscope is back and the square is unchanged.
3. Tap again — the bug was permanent after one tap in v1.231.2 and transient in
   v1.231.3, so a second tap is the honest check.
4. Nothing scrolls horizontally at any point.

At **1280 px**: the button reads `⏳Doctor` while running (no stethoscope), then
`🩺Doctor` again. It widens by the hourglass and returns; the bar does not wrap.

Repeat in ru/de — the label is hidden on mobile, so locale must not change the
geometry there.

## §3 — Invariants

- `withSpinner` still returns the awaited result, disables the button in
  flight, sets and clears `aria-busy`, and restores the prior `disabled` state.
- The `.is-loading` class is added and removed on every path, including throws.
- No route, CSP, SSRF or server surface touched: `public/js/api.js` and
  `public/css/overlays.css` are the whole runtime diff.

## §4 — Not applicable

No parent-sync, no new source (registry stays **92** = 87 EN + 5 RU), no i18n
change, no help change (32 H2 / 122 H3 ×17).

## §5 — Sign-off

- [ ] `npm run test:ci` — 3013 pass, exit code captured directly
- [ ] Playwright narrow-viewport — 4 pass
- [ ] Manual: the button watched **during** a run at 320 px and at 1280 px
- [ ] `/api/health` on resumecraft.ru reports 1.231.4
