# QA REGRESSION PROMPT — career-ops-ui **v1.194.0** (Workday single-segment URL fix, #255)

**Fixed (scanner).** The Workday portal adapter now parses careers URLs whose path is a single segment (e.g. `https://parsons.wd5.myworkdayjobs.com/Search`, `.../KBR_Careers`, `.../Careers`). Before, the site fell back to `External`, so the adapter hit the wrong CXS endpoint (`/wday/cxs/<tenant>/External/jobs`) and a bounded probe could look healthy while returning nothing.

- **Under test:** `package.json` **1.194.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # 2519, exit 0 (capture $? directly, never | grep)
node --test tests/workday-adapter-endpoint.test.mjs tests/workday-fallback.test.mjs tests/adapter-registry.test.mjs
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.194.0
```

## §1 — Change (`server/lib/portals/adapters/workday.mjs`)

- Replaced the two-segment `URL_PATTERN` with `HOST_PATTERN` (captures tenant / wdN / raw path) + a structural path parse in `buildEndpoint`: `pathPart.split('/').filter(Boolean).filter((s) => !LOCALE.test(s))` and take the **first** segment as the site (so a deep posting link `/en-US/External/job/…` resolves to `External`, not the job slug); default `External` when there is none. The tenant / cell are lowercased for the case-sensitive CXS path.
- `matches()` now uses `HOST_PATTERN.test(...)` (recognises any `<tenant>.wd<N>.myworkdayjobs.com` host). An explicit `company.api` still short-circuits unchanged.

## §2 — Behaviour (mapping `careers_url` → CXS endpoint)

| careers_url | site | endpoint |
|---|---|---|
| `…/Search` | Search | `…/wday/cxs/parsons/Search/jobs` |
| `…/KBR_Careers` | KBR_Careers | `…/wday/cxs/kbr/KBR_Careers/jobs` |
| `…/Careers` | Careers | `…/wday/cxs/slihrms/Careers/jobs` |
| `…/en-US/External` | External | `…/wday/cxs/acme/External/jobs` (unchanged) |
| `…/en-US/External/job/City/Title` | External | `…/wday/cxs/acme/External/jobs` (deep link → site, not slug) |
| `…/` or `…/en-US` | External (default) | `…/wday/cxs/acme/External/jobs` |
| `Parsons.WD5.…/Search` | Search | `…/wday/cxs/parsons/Search/jobs` (tenant lowercased) |
| `?query`/`#frag` | ignored | — |

## §3 — Sign-off

Suite **2519** green (+7: single-segment, two-segment+query, deep-link→site, locale-only default, uppercase-host lowercasing, api pass-through, matches) · CHANGELOG parity ×17 at v1.194.0 · README badge+banner ×17 (2510→2519, folds in the +2 from the earlier test-only chore) · verified against the exact URLs in #255. Issue **#255** closed with an EN comment.
