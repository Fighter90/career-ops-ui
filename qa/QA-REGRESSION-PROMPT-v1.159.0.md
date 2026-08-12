# QA REGRESSION PROMPT — career-ops-ui **v1.159.0** (FIX-1: locale-aware report metadata)

**Audit finding (HIGH, `FIX-PROMPT-post-v1.158.0.md` SHIP 1).** On `#/reports`, every report generated in a non-English locale rendered a **blank metadata strip** — no score pill, date, or legitimacy chip — because `parseReportHeader` matched only English `**Score:**` / `**Legitimacy:**` / `**Date:**` bold labels. The report bodies were complete (score `1.5 / 5`, `Легитимность: High Confidence`) but unparsed, so the docs' "Score → next step" table sat above cards showing no score. Read/parse-only fix; no parent-sync. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.159.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2410, exit 0 (capture $? directly, never | grep)
node --test tests/report-header-locale.test.mjs tests/reports-write.test.mjs tests/parsers.test.mjs
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.159.0
```

## §1 — Root cause + fix

- `parseReportHeader(text, opts)` now resolves each field by precedence: **(1)** English bold labels (keeps EN reports byte-identical) → **(2)** the language-invariant `## Machine Summary` YAML block (`score:` / `legitimacy:` / `date:` / `url:` — the same locale-free source `auto-pipeline.mjs::extractScore` reads) → **(3)** locale-aware prose labels (`REPORT_LABELS`, all 17 UI locales).
- `scoreStringToNum` tolerates `1.5/5`, `1.5 / 5`, `1,5/5`, `1.5 из 5`, `4.5 out of 5`, bare `4.5`; rejects out-of-range (0–5).
- `date` falls back to the report file **mtime** (threaded from `store.mjs::safeListReports` and `routes/reports.mjs` GET `/:slug`) when the body has none — never null.

## §2 — Manual pass

1. **A non-English report on `#/reports`** — a report whose body is Russian/Japanese/Arabic (with a `## Machine Summary` block) shows a **score pill**, a **date** tag and a **legitimacy** chip, exactly like an English one. (Repro fixture: write a `reports/*.md` with `## Machine Summary\nscore: 1.5 / 5\nlegitimacy: High`.)
2. **English reports unchanged** — an existing EN report's row is byte-identical (score display string, e.g. `4.5/5`, not `4.5 / 5`).
3. **Score → next-step table** — the decision table now sits above cards that actually show scores; triage is possible again.
4. **Undated report** — a report with no date line still shows a date (file mtime), so cards keep chronological order.

## §3 — Invariants

- **Read/parse only** — no route added, no CSP/SSRF change, parent files stay read-only. No i18n-dict key added (`REPORT_LABELS` is a server-side constant, not a UI string).
- **EN byte-identity** — the score/legitimacy/date display strings for an English report are unchanged (bold labels win over the Machine Summary block).
- **17-locale coverage** — `REPORT_LABELS` has an entry per UI locale; the build fails if a locale is added without a score/legitimacy label.

## §4 — Sign-off

Suite **2410** green · a RU/JA/AR report renders score pill + date + legitimacy on `#/reports` · EN reports byte-identical · undated reports get an mtime date · `REPORT_LABELS` covers 17 locales · no route/CSP/SSRF/parent-write change. **Closes SHIP 1 (FIX-1, HIGH).**
