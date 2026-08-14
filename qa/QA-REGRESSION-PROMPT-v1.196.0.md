# QA REGRESSION PROMPT — career-ops-ui **v1.196.0** (Workday `api` host validation, #443)

**Fixed (security).** The Workday adapter validated a `portals.yml` `api:` endpoint with `company.api.includes('myworkdayjobs.com')` — a substring check (CodeQL `js/incomplete-url-substring-sanitization`, HIGH). A crafted URL like `https://evil.com/?x=myworkdayjobs.com` or `https://myworkdayjobs.com.evil.com/…` passed and `buildEndpoint()` returned it as the fetchable endpoint. It now parses the URL and checks the hostname.

- **Under test:** `package.json` **1.196.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # 2522, exit 0 (capture $? directly, never | grep)
node --test tests/workday-adapter-endpoint.test.mjs
node scripts/check-changelog-parity.mjs     # 16 non-EN at v1.196.0
```

## §1 — Change (`server/lib/portals/adapters/workday.mjs`)

- New `isWorkdayApi(api)`: `new URL(api).hostname.toLowerCase()` must equal `myworkdayjobs.com` or end with `.myworkdayjobs.com`; empty / unparseable → `false`. Both `matches()` and `buildEndpoint()` now call it instead of `.includes('myworkdayjobs.com')`.

## §2 — Behaviour (`company.api`)

| api | `matches` | `buildEndpoint` |
|---|---|---|
| `https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/jobs` | true | (passed through) |
| `https://myworkdayjobs.com/x` (apex) | true | passed through |
| `https://evil.com/?x=myworkdayjobs.com` | **false** | **null** |
| `https://myworkdayjobs.com.evil.com/…` | **false** | **null** |
| `https://notmyworkdayjobs.com/…` | **false** | **null** |
| `not a url … myworkdayjobs.com` | **false** | **null** |

- **Regression:** `careers_url`-based detection (the `#255` single-segment fix) is unchanged — only the `api` short-circuit was hardened.

## §3 — Sign-off

Suite **2522** green (+1: real accepted, 4 crafted URLs rejected, apex accepted) · CHANGELOG parity ×17 at v1.196.0 · README badge+banner ×17 · CodeQL alert **#443** addressed by a real code fix (parsed host), not a dismissal.
