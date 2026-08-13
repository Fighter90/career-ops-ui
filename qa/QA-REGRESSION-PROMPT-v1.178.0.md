# QA REGRESSION PROMPT — career-ops-ui **v1.178.0** (parent-parity constant refresh)

**Parent-sync GAP #4 + #5 (LOW — `qa/PARENT-SYNC-WORKLIST-v1.26.0.md`).** Two stale constants refreshed to match the parent; closes the actionable parent-sync worklist (only the optional ~20-decoder consolidation remains).

- **Under test:** `package.json` **1.178.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2456, exit 0 (capture $? directly, never | grep)
node --test tests/http-json.test.mjs tests/states.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.178.0
```

## §1 — Changes

- **GAP #4 — browser User-Agent.** `server/lib/http-json.mjs::BROWSER_LIKE_USER_AGENT` Chrome `131` → `151` (the UA workable/workday/oraclecloud/a16z/eightfold send to clear WAF/bot gates), matching the parent's `user-agent.mjs`. Guarded by `tests/http-json.test.mjs` — `Chrome major ≥ 151`.
- **GAP #5 — tracker states FALLBACK.** `server/lib/states.mjs`'s last-resort `FALLBACK` gained the parent's Turkish status aliases (#2615): `değerlendirildi`/`degerlendirildi` (evaluated), `başvuruldu`/`basvuruldu` (applied), `yanıt verildi`/… (responded), `mülakat`/`mulakat` (interview), `teklif` (offer), `reddedildi` (rejected), `iptal edildi`/… (discarded), `uygun değil`/… (skip), `kabul edildi`/`işe alındı`/… (hired). Guarded by `tests/states.test.mjs`.

## §2 — Invariants

- **Fallback-only for GAP #5** — production reads the live `templates/states.yml` (which already carried these aliases); the `FALLBACK` only applies on a fresh clone / CI-isolated `CAREER_OPS_ROOT`. No behaviour change in production.
- Two constants only — no route / CSP / SSRF / parent-write change; no new dependency.

## §3 — Sign-off

Suite **2456** green · UA is Chrome 151 · Turkish aliases fold via the FALLBACK · parity ×17. **Closes the actionable PARENT-SYNC worklist (GAP #1–#5); decoder consolidation stays optional backlog.**
