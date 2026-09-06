# QA regression sign-off — career-ops-ui v1.231.2

Three fixes, all reported from outside: a mobile top-bar that wrapped into a
second row of wide pills, and the two findings from the v1.231.1 browser
regression (FIND-1 parent drift on the server, FIND-2 the cvstart.ru redirect).

---

## §0 — Gates

```bash
npm run test:ci                                  # 3009 pass, 0 fail
node tests/playwright-narrow-viewport.mjs        # 2 pass — 320px, no overflow
node --test tests/css-modularization.test.mjs    # app.css <= 800 LOC
node --test tests/qa-report-fixes.test.mjs       # 73 pass (BUG-008-tb updated)
```

---

## §1 — Mobile top bar: one row, icon-only

**Before:** the actions were forced onto a full-width second row
(`flex-basis: 100%`), so a phone showed [☰ · search] over
[🔔 🌙 **Диагностика** **Открыть Scan**] — two wide pills on their own line.

**Now:** one row, all four actions as 36 px squares.

| width | document | actions | label | icon |
|---|---|---|---|---|
| 320 px | 320, no overflow | 4 × 36 px | hidden | shown |
| 390 px | 390, no overflow | 4 × 36 px | hidden | shown |
| 1280 px | no overflow | 88 / 116 px | **shown** | hidden |

**Check by hand:**

1. At ≤ 900 px the two right-hand buttons are square and show 🩺 and ⚡ — not
   text, and not empty.
2. Above 900 px they show their labels again, without an icon.
3. Switch locale to RU at 360 px: **the layout must not change at all.** The
   label is hidden, so its length no longer participates.
4. VoiceOver / NVDA on the square buttons still announces "Doctor" /
   "Open Scan" (localized) — the name comes from `aria-label`, because a
   `display:none` label is dropped from the accessible-name computation.

**Two traps this fix walked into, both now guarded:**

- The desktop `.topbar` / `.topbar-actions` / `.btn-ico` rules are declared
  **lower in `app.css`** than the `max-width: 900px` block. At equal specificity
  the later rule wins, so the mobile `gap` silently stayed 24 px (→ 320 px
  overflowed) and the icon stayed `display:none` (→ empty square buttons). The
  mobile rules are one class deeper on purpose. Do not "simplify" them back.
- `applyI18n()` assigns `el.textContent`, so the key had to move from the
  `<button>` onto an inner `<span class="btn-label">`; on the button it would
  wipe the icon span on every language change.

---

## §2 — FIND-1: parent version on the server

v1.231.0 was a parity release against parent **1.32.0**, but
`/opt/career-ops/src` still held 1.31.0 files, so `/api/health` reported
`parentVersion: 1.31.0` on resumecraft.ru while local reported 1.32.0.

**Fixed by rsync, not `git pull`.** The server's parent checkout has a stale git
HEAD by design (1.30.0) with the newer files copied over it — a pull would try
to merge into 14 modified files. 95 runtime files were synced and
`plugins-registry/theirstack.json` + `lib/context-budget.test.mjs` removed
(retired and moved upstream respectively).

**Check:** `/api/health` on resumecraft.ru reports `parentVersion: 1.32.0`,
twice in a row.

**Trap:** the first rsync **aborted mid-transfer** on
`lib/context-budget.test.mjs` — a file in the delta that no longer exists
locally — leaving a partial deploy that reported success. Same failure shape as
the dangling-symlink trap in `QA-REGRESSION-PROMPT-v1.228.3.md`. Verify a parent
deploy by checksum (`rsync -rn --checksum`), never by exit code.

---

## §3 — FIND-2: the cvstart.ru redirect

The redirect prepended `/ru/` to every path without looking at what was there.

| request | before | now |
|---|---|---|
| `cvstart.ru/` | `/ru/` ✅ | `/ru/` ✅ |
| `cvstart.ru/help/` | `/ru/help/` ✅ | `/ru/help/` ✅ |
| `cvstart.ru/ru/help/` | `/ru/ru/help/` **404** | `/ru/help/` ✅ |
| `cvstart.ru/en/help/` | `/ru/en/help/` **404** | `/help/` ✅ |
| `cvstart.ru/de/` | `/ru/de/` **404** | `/de/` ✅ |
| `cvstart.ru/enterprise/` | `/ru/enterprise/` | `/ru/enterprise/` — unchanged |

`en` is **stripped**, not passed through: cvstart.org serves English at the root
and has no `/en/` directory. The locale test is anchored and requires `/` or
end-of-string after the prefix, so `/enterprise/` is not mistaken for `en`.

**Check:** the redirect is client-side JavaScript. `curl -L` does not execute it
and will report the 404 page — that is not a failure. Open the paths in a
browser, or read the served HTML and confirm it contains the `LOCALES` test.

---

## §4 — Not covered here

- Collage / Telegram (strict) / Gem REST against live data: none are configured
  in `portals.yml`, so no rows from them appear in a scan. Covered by unit tests
  (14 + 24 + 23), not reproducible from the browser.
- Mail on cvstart.ru after the Cloudflare migration — only a real message
  proves the MX survived.

---

## §5 — Sign-off

- [ ] `npm run test:ci` → 3009 / 0
- [ ] top bar one row at 320 / 360 / 390 / 430 px, icons visible, labels hidden
- [ ] top bar labels return above 900 px
- [ ] resumecraft.ru `/api/health` → `parentVersion: 1.32.0`
- [ ] the four cvstart.ru path forms in §3, in a real browser
