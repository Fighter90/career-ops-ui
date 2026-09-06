# QA REGRESSION PROMPT — career-ops-ui **v1.171.0** (D-4: type-scale + z-index tokens)

**Audit finding (LOW, design-system — `FIX-PROMPT-post-v1.158.0.md` SHIP 9 / D-4).** Sizes/weights/line-heights and layering were literal per component; the system couldn't be reproduced from tokens alone. First-step, value-preserving token introduction. CSS-only.

- **Under test:** `package.json` **1.171.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2437, exit 0 (capture $? directly, never | grep)
node --test tests/design-tokens-scale.test.mjs tests/dark-theme-tokens.test.mjs tests/elevation-token.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.171.0
```

## §1 — Fix (first step)

- **z-index layers** — `--z-topbar`(5)/`--z-sidebar`(10)/`--z-hud`(11)/`--z-banner`(50)/`--z-modal`(200)/`--z-popover`(950)/`--z-toast`(1000)/`--z-fab`(1150)/`--z-drawer`(9999)/`--z-skiplink`(10000). **Every** z-index literal in `app.css`/`components.css`/`overlays.css` migrated to a token (backdrop = `calc(var(--z-sidebar) - 1)`, onboarding = `calc(var(--z-banner) - 1)`). Values preserved → stacking is byte-identical. A canary forbids new bare z-index numbers.
- **Type scale** — `--font-size-xs`(11)/`sm`(12)/`md`(13)/`base`(15)/`lg`(18)/`xl`(22)/`2xl`(28), base = Inter 15px. The core sizes the components already used are migrated to the ramp (value-preserving). Off-ramp one-offs (14/16/20/24…) stay literal pending incremental migration (`docs/UX-ROADMAP.md`).

## §2 — Manual pass

1. **Stacking** — skip-link (Tab from load) sits above everything; the notifications drawer over the toast over the modal scrim over the sticky banners over the sidebar over the topbar — unchanged from before. The docs FAB + panel sit above the drawer's siblings as before.
2. **Type** — every screen looks pixel-identical (base body 15px, chips 12/13px, headings 18/22/28px) — the migration only renamed values.
3. **Dark mode** — unaffected (z-index/type are theme-invariant; the dark-mode contrast guard is green).

## §3 — Invariants

- **CSS-token only, no pixel change** — every migration preserves the exact value; no behaviour, JS, i18n, route, CSP, SSRF, or parent-write change.
- **No bare z-index** — `tests/design-tokens-scale.test.mjs` fails if a new `z-index: <number>` appears outside a comment.

## §4 — Sign-off

Suite **2437** green · stacking order byte-identical · every screen pixel-identical · no bare z-index literal remains · dark-mode guard green · parity ×17. **Closes SHIP 9 / D-4 first step (LOW); off-ramp font migration remains incremental backlog.**
