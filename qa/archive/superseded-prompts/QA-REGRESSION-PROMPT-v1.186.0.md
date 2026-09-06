# QA REGRESSION PROMPT — career-ops-ui **v1.186.0** (CV Studio skill-gap panel)

**Added (cv-studio).** A "Skill gap" panel in `#/cv-studio` relayed read-only from `jd-skill-gap.mjs`: pick a saved JD, get its required skills classified vs your CV into named / implied / missing.

- **Under test:** `package.json` **1.186.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # 2485, exit 0 (capture $? directly, never | grep)
node --test tests/jds-skill-gap-route.test.mjs tests/i18n-coverage.test.mjs
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.186.0
```

## §1 — Change

- **Route:** `GET /api/jds/:name/skill-gap` in `routes/jds.mjs`. `:name` → `sanitizePathName` → confirm `existsSync(jds/<name>)` → `runNodeScript('jd-skill-gap.mjs', ['jds/'+name, '--json'])` → `{available:true, existing, supportedByResume, gap, lowConfidence}` or fail-soft. The JD path is a `runNodeScript` **array arg** (no shell interpolation); traversal names fold to a safe non-existent path (404).
- **View:** a "Skill gap" card in `views/cv-studio.js` — fetches `/api/jds` for a picker, "Analyze" fetches the relay, renders three colour-coded chip buckets + a low-confidence note. Empty state when no JDs saved. +13 `cvs.gap*` i18n keys ×17.

## §2 — Manual check (open `#/cv-studio`, scroll to "Skill gap vs a job")

- With ≥1 saved JD: pick it → **Analyze skill gap** → three buckets render (named ✓ / implied / missing). **Regression watch:** bucket items are `String()`-wrapped chips — no raw-number children (the funnel-tab class of bug).
- No saved JDs → an honest "save one first" note, no error.
- Path-traversal `:name` (e.g. `../../etc/passwd`) → 404, never a script run or file leak.

## §3 — Sign-off

Suite **2485** green (+4: relay + traversal-reject + 404 + fail-soft) · i18n coverage + parity ×17 (13 new keys) · CHANGELOG parity ×17 at v1.186.0 · README badge+banner ×17 · **populated buckets verified via headless screenshot**.
