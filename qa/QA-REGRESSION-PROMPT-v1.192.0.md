# QA REGRESSION PROMPT — career-ops-ui **v1.192.0** (Fact-check gate)

**Added (cv-studio).** A "Fact-check your CV" card in `#/cv-studio`: paste a tailored CV or cover letter and check every asserted metric and fact against your real CV, profile, and two-pager. Get a **pass / warn / block** verdict plus the exact invented metrics, unsupported facts, and forbidden / advisory phrases. Zero-token relay of `verify-cv-facts.mjs`.

- **Under test:** `package.json` **1.192.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # 2508, exit 0 (capture $? directly, never | grep)
node --test tests/cv-studio-verify-facts-route.test.mjs tests/i18n-coverage.test.mjs tests/i18n-locale-files.test.mjs
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.192.0
```

## §1 — Change

- **Route:** `POST /api/cv-studio/verify-facts` in `routes/cv-studio.mjs`. Writes the client's `{text}` (≤64 KB) to a `mkdtempSync` temp file (**never** the parent), runs `verify-cv-facts.mjs <tmp> --source cv.md --source config/profile.yml --source config/two-pager.yml --json`, and **trusts the JSON verdict regardless of exit code** — the parent exits 1 on a `block` verdict but still prints valid JSON. Fail-soft `{available:false}` only on timeout / unparseable / missing script. Temp dir removed in a `finally`. `llmRateLimit`.
- **View:** a 7th `#/cv-studio` card — textarea + "Verify facts" → verdict badge (pass=`badge-ok` / warn=`badge-warn` / block=`badge-bad`) + chip buckets (invented / unsupportedFacts rendered `kind: value` / forbidden / warnings), all `String()`-wrapped. +15 `cvs.vf*` i18n keys ×17.

## §2 — Manual check (open `#/cv-studio`, "Fact-check your CV" card at the bottom)

- Paste text with a made-up number (e.g. "Increased revenue by 250%") → **block** verdict + the number listed under "Metric-like claims not in your sources". **Regression watch:** a block verdict must NOT read as `{available:false}` (the script exits 1) — it must render the verdict.
- Paste text with only supported facts → **pass**.
- Empty textarea → a "paste some text" toast, no request.
- Parent script absent → honest "unavailable" line, not a 500.

## §3 — Sign-off

Suite **2508** green (+4: block-exits-1-still-available, pass, empty-400, fail-soft) · i18n coverage + parity ×17 (+15 keys) · CHANGELOG parity ×17 at v1.192.0 · README badge+banner ×17 · **populated block verdict verified via headless screenshot on a synthetic cv.md + stub** (invented `250%`/`$1.2m`, `title: CTO`, `synergy`).
