# QA REGRESSION PROMPT — career-ops-ui **v1.173.0** (Hermes joins cli-detect)

**Parent-sync finding (LOW, config — `qa/PARENT-SYNC-WORKLIST-v1.26.0.md` GAP #3).** The parent added **Hermes** (Nous Research) as a supported agent runtime (`docs/SUPPORTED_CLIS.md`, `HERMES.md`). web-ui's `#/config` → "AI CLI tools" tab probes a fixed allowlist of agent CLIs but did not include Hermes. Additive, read-only.

- **Under test:** `package.json` **1.173.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2444, exit 0 (capture $? directly, never | grep)
node --test tests/cli-detect-routes.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.173.0
```

## §1 — Change

- `server/lib/routes/cli-detect.mjs` — `KNOWN` allowlist gains `{ id: 'hermes', name: 'Hermes', bins: ['hermes'] }` (11 tools; Cursor v1.127.0 + Hermes v1.173.0 among the 10 first-class + Gemini legacy). Detection remains a pure PATH scan — the found binary is **never** executed (no spawn, no `--version`).
- `tests/cli-detect-routes.test.mjs` — the two `tools.length` assertions move 10 → 11, and a `tools.some(t => t.id === 'hermes')` check is added. No new `test()` block, so the suite total stays **2444**.
- `CLAUDE.md` cli-detect prose updated (10 → 11 tools; Hermes noted).

## §2 — Manual pass

1. Open `#/config` → **AI CLI tools** tab. The roster lists **11** tools including **Hermes**; each shows installed/not-installed + path (if found). If `hermes` is on PATH it resolves; otherwise it reads "not installed" — no binary is run either way.
2. `GET /api/cli-detect` returns `tools.length === 11` with a `hermes` entry.

## §3 — Invariants

- **Read-only PATH scan** — never executes a found binary; the allowlist is fixed, never derived from input. No writes / LLM / network.
- **No i18n / route / CSP / SSRF / parent-write change**; no new dependency.
- **Test-count unchanged (2444)** — assertions updated, not added.

## §4 — Sign-off

Suite **2444** green · `#/config` AI-CLI tab shows 11 tools incl. Hermes · `GET /api/cli-detect` → 11 · no binary executed · parity ×17. **Closes PARENT-SYNC GAP #3 (LOW).** Remaining GAPs (#1 csod cookie replay, #4 Chrome UA, #5 states FALLBACK) stay documented backlog in `qa/PARENT-SYNC-WORKLIST-v1.26.0.md`.
