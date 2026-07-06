# QA REGRESSION PROMPT — career-ops-ui **v1.110.0** (milestone: v1.98 → v1.110)

Delta regression for the feature run that landed between v1.98.0 and v1.110.0.
Pairs with the perennial `qa/QA-REGRESSION-PROMPT.md` (whole-project) — this file
is the frozen milestone snapshot. Run both.

- **Under test:** `package.json` **1.110.0+**. **Server:** `npm start` → `http://127.0.0.1:4317`.
- **Read-only against a live parent.** Never trigger a write route (`PUT`/`POST`
  that persists) while pointed at the user's real career-ops project — use a
  `CAREER_OPS_ROOT=$(mktemp -d)` bootstrap for any write-path check.

## §0 — Gates

```bash
npm test                                     # full suite (≥1706 cases)
node scripts/check-changelog-parity.mjs      # all 16 locales at the shipped version
node tools/i18n-audit.mjs                     # clean (0 missing / 0 extra)
node --test tests/i18n-locale-files.test.mjs tests/i18n-coverage.test.mjs   # 16-locale key parity + byte snapshot
node --test tests/canonical-docs-coverage.test.mjs tests/help-ui.test.mjs tests/help-ru-config-section.test.mjs tests/locales-de-it-tr.test.mjs  # help gates: 28 H2 / 102 H3 per bundle
```

Baseline floors: **1706** unit · 70 Playwright · 20 smoke E2E · 23 comprehensive E2E.

## §1 — What changed (walk each end-to-end)

| Ver | Surface | Verify |
|---|---|---|
| 1.98.0 | **In-app bug reporter** | Notifications drawer → 🐞 → preview snapshot (from `/api/health`) → pre-filled GitHub issue. Snapshot NEVER contains CV/profile text, URLs, or provider keys; carries a `co-web-<base36>` dedupe fingerprint. |
| 1.99.0 | **`#/portals` health** | Probe runs each tracked company's `careers_url` via SSRF-safe `safeGet`; dead ATS slugs flagged; read-only (no writes). |
| 1.100.0 | **`#/two-pager` export + auto-fill** | ✨ live auto-fill (`POST /api/two-pager/draft {run:true}`) parses returned YAML back into the bounded form; Preview → export **MD / PDF / DOCX** (dependency-free `server/lib/docx.mjs`). Manual fallback with no key. |
| 1.101.0 | **`#/cv-studio` Tailor to a job** | Paste a JD → tailored résumé + cover letter through a **generic recruiter checklist gate** (errors block / warnings advise). Grounded in CV+profile+two-pager; NO hardcoded companies/roles; no writes. |
| 1.102.0 | **`#/docs-assistant` (Ask the docs)** | Answers grounded ONLY in `docs/help/<lang>.md`; cites the `##` sections it used; says the guide doesn't cover it rather than inventing. Reads no user data. |
| 1.103.0 | **`#/config` → AI CLI tools tab** | Read-only PATH scan reports which agent CLIs are installed + paths; **NEVER executes** a found binary; no writes/LLM/network. |
| 1.104.0 | **Company logos in scan** | `GET /api/logo?domain=` proxies the company's OWN-domain favicon via SSRF-safe `safeGet` binary path; off by default (Appearance toggle); skips shared ATS hosts → letter-avatar. No third-party logo API, no disk writes. |
| 1.105.0 | **`#/usage` (AI usage & cost)** | Per-provider token totals + estimated USD over 24h/7d/30d/all from `data/llm-usage.jsonl`; priced by the editable `llm-pricing.mjs`; read-only. Cost is an **estimate** (say so). |
| 1.106–1.108 | **Security hardening (CodeQL)** | Router error text escaped; prototype-pollution guards on config/content; sanitizer end-tag hardening; dynamic-dispatch guard; PDF-slug ReDoS cap; filename type coercion. |
| 1.109.0 | **Scan Exclude + pipeline overview** | `#/scan` **Exclude** field + comma-OR search; `#/pipeline` **overview strip** (inbox / tracked / Applied / Responded / Interview / Offer chips deep-link to `#/tracker`). |
| 1.110.0 | **Docs & QA refresh** | QA prompts + help paragraphs ported to all 16 locales; H2/H3 counts unchanged. |

## §2 — Contract & security invariants (must all still hold)

- **Parent read-only.** No code path writes outside explicit user actions. New
  routes that fetch user URLs go through `isValidJobUrl` / `safeGet` (SSRF).
- **CSP unchanged.** `script-src` excludes `'unsafe-inline'`; every handler is
  `addEventListener`; `UI.md()` is escape-first; no `'unsafe-eval'`;
  `frame-ancestors 'none'`.
- **Honesty of the AI pages.** Manual-vs-live is explicit; cost is an estimate;
  logos are opt-in; CLI detection never executes; bug snapshot is privacy-floored.
- **Bounded inputs.** Every new POST caps its payload; every generator has a
  manual fallback with no provider key.
- **CodeQL FPs.** The recurring `js/missing-rate-limiting` + `js/http-to-file-access`
  on user-layer write routes are documented FPs — dismiss post-merge, don't chase.

## §3 — i18n

16 locales (`en es pt-BR ko ja ru zh-CN zh-TW fr pl uk da ar de it tr`; Arabic RTL).
Every new key present + translated in all 16 (parity-gated). Spot-switch locale on
each new page: labels, buttons, privacy notes read in-language; RTL mirrors the chrome.

## §4 — Sign-off

All §0 gates green · each §1 surface works live (or shows its manual fallback with
no key) · §2 security invariants intact (parent read-only, CSP, SSRF, honesty,
bounds) · 16-locale parity + help gates green · no write reached a live parent
during read-only checks.
