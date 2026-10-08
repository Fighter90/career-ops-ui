# QA regression — v1.242.1

Patch on v1.242.0: **packaging only** — the v1.242.0 git tag carried root `node_modules`
and `site/node_modules` symlinks (a blanket `git add -A` slipped them past the
trailing-slash ignore patterns), which failed the server deploy's tar extraction and
rolled back. No app code changed since v1.242.0. Counts unchanged: **4812** unit /
**118** browser / coverage **98.15 % line / 89.36 % branch**.

## §0 — Gates

```bash
npm run test:ci                      # 4812 pass, exit 0
npm run test:e2e:browser             # 118 pass
node evals/workflow/run.mjs          # 12 pass
git ls-tree v1.242.1 --name-only | grep node_modules   # must print NOTHING
```

## §1 — What changed (verify each)

1. `git archive v1.242.1 | tar -t | grep node_modules` → empty (the v1.242.0 archive
   contained two symlink entries — this is the defect).
2. **Deploy to the server succeeds** (the v1.242.0 deploy failed at
   `tar: node_modules: Cannot open: File exists` and rolled back): the log shows
   extraction with no tar errors, `ok=true version=1.242.1` post-restart, timers held
   and resumed.
3. Everything from the v1.242.0 QA prompt §1 still holds on prod (sources correctness
   behaviours ride this deploy — production never received 1.242.0).

## §2 — Manual browser pass

`#/scan` (one EN scan — justjoin/nofluffjobs/himalayas boards return rows),
`#/dashboard`, `#/map` at 390 px. Spot locale check en/ru.

## §3 — Invariants

No routes touched; no CSP changes; parent files untouched; npm tarball unaffected
(npm excludes node_modules when packing).

## §4 — Deploy

`/api/health` on the server: `version: 1.242.1`. Public check answers **401**.

## §5 — Sign-off

- [ ] §0 green (incl. the archive check) · [ ] §1 1–3 · [ ] §2 in a real browser · [ ] §4 prod verify passed
