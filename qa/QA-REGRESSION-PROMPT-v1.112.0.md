# QA REGRESSION PROMPT — career-ops-ui **v1.112.0** (Docs & QA consolidation)

Delta regression for a **docs + test-coverage** release — no user-facing code change.
Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.112.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates
```bash
npm test                                   # full suite (≥1714; +1 oversize-upload coverage case)
node scripts/check-changelog-parity.mjs    # all 16 at v1.112.0
node --test tests/canonical-docs-coverage.test.mjs tests/help-ui.test.mjs   # 28 H2 / 102 H3 unchanged
```

## §1 — What changed (docs only)
1. **`docs/sdd/CONVENTIONS.md`** — route-module list corrected **24 → 30** (adds cli-detect, docs-assistant, export, logos, portals, usage + cv-studio tailor); test baseline → v1.111.0 / 1713.
2. **`qa/QA-REGRESSION-PROMPT.md`** — consolidated as the single standalone whole-project prompt: §7 release mechanics destaled (v1.111, parentVersion 1.17.0, release-triggered publish); §14 additions table corrected (scan Exclude → v1.109.0) + v1.111 CodeQL row.
3. **Coverage test** for the `sizeBytes > MAX_UPLOAD_BYTES` branch of `cv-import.mjs`.

## §2 — Verify
- Docs render correctly (`#/help` unaffected; H2/H3 counts stable); the master QA prompt reads as a coherent standalone document; `docs/sdd/CONVENTIONS.md` route count matches CLAUDE.md (30).
- No behavioral change anywhere in the app.

## §3 — Sign-off
All §0 gates green · route-count docs match reality (30) · master prompt standalone · no code behavior change.
