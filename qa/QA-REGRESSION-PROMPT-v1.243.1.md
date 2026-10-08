# QA regression — v1.243.1

Patch on v1.243.0: **one regression fix** — the v1.243.0 CAR-36 guard listened for
`hashchange` on `document` (never fires there) → the Record-outcome modal still
survived navigation in the shipped build. Guard now listens at `window`. No other
changes. Counts unchanged: **5036** unit / browser ≥ **118**.

## §0 — Gates

```bash
npm run test:ci                      # 5036 pass, exit 0
npm run test:e2e:browser             # pass
node --test tests/tracker-modal-nav-guard.test.mjs   # 7 pass — and RED against the v1.243.0 code
```

## §1 — Verify

1. #/tracker → Outcome on a row → navigate via KEYBOARD (nav link focus + Enter) and
   via back/forward — the modal must CLOSE and the new view must be clickable
   (v1.243.0 failed exactly this; mouse clicks were masked by backdrop-close).
2. Everything from the v1.243.0 QA prompt §1 still holds (packaging-only patch).

## §2 — Deploy

`/api/health`: `version: 1.243.1`. Public check **401**.

## §3 — Sign-off

- [ ] §0 green · [ ] §1 keyboard + back/forward paths · [ ] §2 prod verify passed
