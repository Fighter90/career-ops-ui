# QA REGRESSION PROMPT — career-ops-ui **v1.174.0** (reports parsing + SEO — 4-finding audit)

**User audit (2026-08-13) — 4 findings + a layout bug on `#/reports`.** Localized (RU) reports showed "Score not detected", legitimacy chips carried stray `**`, a long score spilled out of its coloured block, and the cvstart.org SEO description was stale.

- **Under test:** `package.json` **1.174.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2448, exit 0 (capture $? directly, never | grep)
node --test tests/report-header-locale.test.mjs   # 11 cases incl. the 4 new repros
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.174.0
```

## §1 — Fixes

- **FIND-1 (HIGH) — score parsing.** `server/lib/parsers.mjs::parseReportHeader`: a non-English report whose H1 contains the score-label word (`# Оценка вакансии: <title>`, note the trailing colon) had that title captured as the score → `scoreNum: null` → "Score not detected". New precedence: EN bold → Machine Summary → **localized bold label** (`boldLabelValue`, matches `**Оценка:** 1.5 / 5` and can never match a `#` heading) → **prose fallback** (`proseLabelValue`, now scans line-by-line, **skips heading lines**, and requires the label adjacent to its colon).
- **FIND-2 (MEDIUM) — legitimacy chip.** `stripEmphasis` removes markdown `**`/`*` from the value; the chip reads "High Confidence", not "** High Confidence".
- **Overflow (MEDIUM) — layout.** `compactScore` collapses a score value with trailing status text ("1.8, Status: Evaluated, …") to just the score; `.score-pill` gains `flex-shrink:0; white-space:nowrap; max-width:100%; overflow:hidden; text-overflow:ellipsis`; the card's left column gets `minWidth:0` + `overflow-wrap:anywhere` so a long title/chip shrinks instead of pushing the pill past the card edge.
- **FIND-3 (MEDIUM) — SEO description.** `site/src/i18n/*.json` ×17 `meta.desc` hard-coded "Scan ~55 job boards" while the body counts the live registry ("~75"). `meta.desc` now carries a `{adapters}` placeholder substituted in `Landing.astro` from `Math.floor(facts.adapters/5)*5`, feeding all three description metas (meta / OG / Twitter).

## §2 — Manual pass (`#/reports`, RU data)

1. RU reports that read "Score not detected" now show a real coloured score pill (e.g. 1.5 / 5).
2. Legitimacy tags read "High Confidence" (no leading `**`).
3. A report whose score line carried trailing status text shows a compact pill (e.g. "1.8 / 5") that stays inside the card — nothing spills past the coloured block.
4. EN reports are unchanged (byte-identical score/legitimacy).
5. `curl -s https://cvstart.org/ | grep 'name="description"'` → "Scan ~75 job boards" (and `/ru/`, `/ja/` etc. likewise).

## §3 — Invariants

- **EN reports byte-identical** — `compactScore` returns a clean "X.X" / "X.X / Y" verbatim; `stripEmphasis` is a no-op on values without asterisks.
- Server parser + client render/CSS + site i18n only — no route / CSP / SSRF / parent-write change; no new dependency.
- `meta.desc` is registry-derived — it can't drift from the body count again.

## §4 — Sign-off

Suite **2448** green · `report-header-locale` 11/11 · RU scores render · legitimacy chips clean · no card overflow · EN byte-identical · cvstart.org description "~75" ×17 · parity ×17. **Closes the 4-finding audit** (FIND-4 wiki refreshed in the release fan-out).
