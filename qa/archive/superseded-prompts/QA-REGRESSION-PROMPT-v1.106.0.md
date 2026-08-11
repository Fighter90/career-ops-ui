# QA REGRESSION PROMPT — career-ops-ui **v1.106.0** (security hardening — CodeQL triage)

Delta regression for the three static-analysis fixes. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.106.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # full suite (security-hardening-v1106 ×3)
node --test tests/security-hardening-v1106.test.mjs
node scripts/check-changelog-parity.mjs         # all 15 locales at v1.106.0
```

## §1 — What changed (behavior-preserving)

1. **xss-through-exception** — `public/js/router.js`: the route-render error screen now escapes `err.message` via `UI.escapeHtml` before `innerHTML`. An error whose text contains `<img onerror=…>` renders as literal text, not an element.
2. **prototype-pollution guards** — `content.mjs` (`setArray`/`setDotted`) and `config.mjs` (env-apply loop) reject `__proto__` / `constructor` / `prototype` keys. Valid profile/config saves are unaffected (the keys come from fixed field specs).

## §2 — Sanity checks

- Navigate to a route that errors (e.g. stop the server mid-nav) → the error screen shows the message as plain text, Retry works.
- Save the Profile form and App settings → unchanged behavior; values persist.
- `Object.prototype` is never polluted by a profile/config save.

## §3 — CodeQL

The ~74 `js/missing-rate-limiting` / `js/http-to-file-access` / `js/file-access-to-http` / `js/file-system-race` alerts are dismissed as false positives (custom limiter not credited; scanner legitimately reads/writes `data/*`). The 3 fixed findings (router XSS, 2× property-injection clusters) should resolve on the next scan.

## §4 — Sign-off

All §0 gates green · error screen escapes the message · profile/config saves unaffected · no prototype pollution · full suite 1698 · no new i18n keys.
