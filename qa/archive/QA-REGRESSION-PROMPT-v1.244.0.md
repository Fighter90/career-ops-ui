# QA regression — v1.244.0

Minor on v1.243.2: **the #/scan results redesign (Phase 4)** — two-line row anatomy,
icon signals with localized accessible names, title hygiene, pagination, layout
contract tests. Counts: **5045** unit (was 5036) / browser suite gained the layout
contracts / coverage **98.14 % line / 89.34 % branch** (floor 96/86).

## §0 — Gates

```bash
npm run test:ci                      # 5045 pass, exit 0
npm run test:e2e:browser             # includes scan-redesign-layout contracts
node evals/workflow/run.mjs          # pass
npm run test:coverage:gate           # exit 0 (node 22)
```

## §1 — What changed (verify each)

1. **Row anatomy**: a scan row = line 1 title, line 2 `company · location · source ·
   date · work-type`; boost/fit/score/trust/reloc are icons with localized
   aria-labels + tooltips (screen reader reads «Соответствие: сильное» / "Fit: strong").
2. **Title hygiene**: a trailing `| Germany | Remote` renders in the meta line, not in
   the title; legit pipes («C++ | Rust | Go Developer») never split.
3. **No sprawl**: zero horizontal page overflow and zero internal table scroll at
   1440 px AND 390 px (was 675 px at 390).
4. **Pagination**: results paginate at 50 (25/50/100/200 selectable); a 700-row scan
   renders ~1,000 DOM nodes in the results table (was 5,493 for 200 rows).
5. **Counts/order untouched by title-fit** (guard suite green).
6. **Filters**: source filter still lists every registry source; selecting filters rows.
7. The old `scan.col.loc/type/source` header columns are gone (folded into the meta
   line); the Age column remains desktop-only.

## §2 — Manual browser pass

#/scan at 1440/1024/390 (light+dark, en+ru+ar): two-line rows, icons, pagination,
filters, chips. Keyboard: rows reachable, pager operable. RTL: table mirrored, no
clipping. #/tracker (CAR-36 modal fix intact), #/dashboard.

## §3 — Invariants

Counts/order unchanged by title-fit; `last-scan.json` format untouched; `#scan-results
table tbody tr` selector preserved (job-facets + Playwright); CSP untouched.

## §4 — Deploy

`/api/health`: `version: 1.244.0`. Public check **401**. Timers held/resumed.

## §5 — Sign-off

- [ ] §0 green · [ ] §1 1–7 · [ ] §2 in a real browser · [ ] §4 prod verify passed
