# QA regression — v1.244.1

Patch on v1.244.0: **three fixes from the post-deploy regression round** — icon
aria-labels leak raw `{band}`/`{by}`/`{score}` templates (HIGH a11y); 4-segment
titles («C++ | Rust | Go Developer | Onsite») lost segments to a bogus "country"
split; `daysSince` rejected full ISO timestamps so ~83% of dated rows rendered no
date segment. Counts unchanged: **5045** unit / browser contracts unchanged.

## §0 — Gates
```bash
npm run test:ci                      # 5045 pass, exit 0
npm run test:e2e:browser             # layout contracts pass
node --test tests/scan-title-split.test.mjs tests/scan-redesign-layout.test.mjs
```
## §1 — Verify (in #/scan)
1. Icon aria-labels (devtools or screen reader): «Соответствие: сильное» /
   "Boosted by: <keyword>" / "Match score 65 out of 100" — NO `{` braces.
2. A 4-segment title «A | B | C | Onsite» stays whole in the title line (segments
   land in meta only when the middle one IS a country).
3. Rows with full ISO timestamps show the relative date segment.
Everything else from the v1.244.0 QA prompt §1 holds (two-line rows, icons,
pagination, no overflow).
## §2 — Deploy
`/api/health`: `version: 1.244.1`. Public check **401**.
## §3 — Sign-off
- [ ] §0 green · [ ] §1 1–3 · [ ] §2 prod verify passed
