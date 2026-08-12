# QA REGRESSION PROMPT — career-ops-ui **v1.141.0** (funded-company enrichment)

User-reported UX pass (no parent-sync). `#/funded` becomes a visual card grid: company logos, a funding-amount chart, and per-company round / amount / discovery-score / suggested-action. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.141.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # full suite — 2363, exit 0 (capture $? directly, never | grep)
node --test tests/funded-view.test.mjs         # parseAmount + card-render wiring
node --test tests/parity-routes-v1133.test.mjs # funded reads res.companies + renders cards (updated guard)
node tools/i18n-audit.mjs                       # dictionary clean; snapshot 1186 keys
node scripts/check-changelog-parity.mjs        # all 16 locales at v1.141.0
```

## §1 — What changed (all `#/funded`, client-side; no new server route)

- `public/js/views/funded.js`: the flat table became an **enriched card grid** — each company card has a **logo** (`CompanyLogo.badge('', name)` → derived-from-name domain via `/api/logo`, letter-avatar fallback), **round** + **amount** chips, the parent relay's **discovery_score** + **suggested_action** (previously discarded), and the funding-news source link + date.
- A **funding-amount horizontal bar chart** of the top companies by disclosed amount (new pure `parseAmount` — "$120M"/"€1.5B"/"500K" → magnitude).
- 3 new i18n keys × 17 (`funded.byAmount`, `funded.score`, `funded.action`).

## §2 — Manual browser pass (click **Discover** — makes a live feed fetch; disconnect a full-tunnel VPN if feeds 0-out)

1. **`#/funded` → Discover** — a **funding-amount bar chart** (top companies by amount) appears above a **grid of cards**. Each card shows a logo/avatar, the company name (links to the funding news), round + amount chips, a **Score N** chip, a "**Suggested action**: …" line, and a source · date footer.
2. **Empty / unavailable** — a quiet news day still shows the per-source diagnostics; no parent script → the "unavailable" message. Neither should throw.
3. **Logos** — enable logos (settings); a card with a resolvable domain shows a real logo, others a letter-avatar. Toggling logos off → letter-avatars.
4. **Localization** — non-EN locale: the chart title, "Score", and "Suggested action" labels are translated; RTL (العربية) mirrors the cards.
5. **No console errors.**

## §3 — Invariants

- **Read-only** — still `GET /api/company-funded` (host-pinned public feeds); no writes, no LLM, no new route. The "verify a company independently" caveat stays.
- **Correct field access** — reads `res.companies` (never `res.candidates`) and `funding.sources[0]` for the evidence link/date (v1.133.1 guard, updated table→cards).
- **UI.el children are arrays** — cards pass children as arrays (the v1.133.1 varargs pitfall stays guarded).
- **Not in the feed** — description + salary range aren't in the funding source, so they're intentionally absent (documented, not a bug).
- **i18n parity** — 17 locales, audit clean, snapshot 1186 keys.

## §4 — Not in this release (see `docs/UX-ROADMAP.md`)

Remaining Phase 3 — interactive/rebuildable charts + the **"Unknown" archetype fix** (orientation prompt-quality, LLM output not a code literal). `?`-hint next wave (remaining view headers). Portals→settings + filter redesign → **Phase 4 / v1.142.0**. Nous Research / Hermes → Phase 5 / 5b.

## §5 — Sign-off

Suite **2363** green · funded renders cards + logo + amount chart + score/action · reads `companies` not `candidates` · localized labels ×17 · RTL mirrored · 0 console errors · read-only, no new route · i18n 17/17 · CHANGELOG parity ×17.
