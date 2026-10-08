# QA regression — v1.243.2

Re-cut of v1.243.1 under a fresh tag (the server-side tag cache could not update the
re-pointed v1.243.1 — `git fetch --tags` refuses to clobber; the deploy never ran).
**Tree identical to v1.243.1**: the tracker outcome-modal window-listener fix on top of
v1.243.0. package.json now reads 1.243.2. Counts unchanged: **5036** unit / browser pass.

## §0 — Gates
```bash
npm run test:ci                      # 5036 pass, exit 0
node --test tests/tracker-modal-nav-guard.test.mjs   # 7 pass — RED against the v1.243.0 code
git ls-tree v1.243.2 | grep node_modules             # empty
```
## §1 — Verify
1. #/tracker → Outcome → navigate via KEYBOARD / back-forward — modal CLOSES, view clickable.
2. All v1.243.0 QA §1 checks hold (identical tree + the fix).
## §2 — Deploy
`/api/health`: `version: 1.243.2`. Public check **401**.
## §3 — Sign-off
- [ ] §0 green · [ ] §1 modal fixed on prod · [ ] §2 prod verify passed
