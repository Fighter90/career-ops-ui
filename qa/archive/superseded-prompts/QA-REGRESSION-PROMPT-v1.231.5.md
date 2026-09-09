# QA regression — v1.231.5

**Security release. No behaviour change is intended** — five Dependabot
advisories closed by dependency updates, one of them a critical RCE.

## §0 — Gates

```bash
npm audit --audit-level=low                # 0 vulnerabilities
(cd site && npm audit --audit-level=low)   # 0 vulnerabilities
npm run test:ci                            # 3013 pass, exit 0
npm run test:e2e:browser -- tests/playwright-narrow-viewport.mjs   # 4 pass
(cd site && npm run build)                 # 86 pages, 17 changelog mirrors
```

Test baseline unchanged at **3013**: no code changed, only dependencies.

## §1 — What was fixed

Merged first, from Dependabot's own PRs:

| # | package | from → to | severity |
|---|---|---|---|
| 339 | `multer` | 2.2.0 → 2.3.0 | **high** — DoS via file-descriptor leak on abort |
| 340 | `svgo` (site) | 4.0.2 → 4.1.0 | **high** + medium — `removeScripts` let executable links through |

Merging those triggered a rescan that surfaced five more. Every affected range
was already satisfied by the existing `^` specifier, so these needed an update,
not a manifest edit:

| package | manifest | from → to | severity |
|---|---|---|---|
| `astro` | site | 7.1.0 → **7.3.2** | **critical** — RCE through AVIF image optimization (needs ≥ 7.2.8); also fixes an authorization bypass from a missing path-segment boundary check (≥ 7.2.4) |
| `sharp` | site | 0.35.3 → **0.35.4** | high — libheif vulnerabilities |
| `js-yaml` | site | 4.3.1 → **4.3.2** | high — `maxTotalMergeKeys` does not limit CPU on empty merge sources |
| `js-yaml` | root | 4.3.1 → **4.3.2** | high — same advisory, direct dependency |

## §2 — What to check, and why

`js-yaml` and `multer` are load-bearing at runtime, and Astro moved a **minor**
version, so "deps only" is not the same as "risk free":

1. **Config parsing (`js-yaml`).** `#/config` loads and saves; `profile.yml`
   round-trips; a malformed YAML still produces a readable error rather than a
   stack trace.
2. **File upload (`multer`).** Whatever route accepts an upload still accepts
   one, and still rejects an oversized or wrong-type file the same way.
3. **Site build (`astro` 7.1 → 7.3).** 86 pages, 17 changelog mirrors,
   `facts.json` at the shipped version, `sitemap-index.xml` present. The landing
   page renders and the version string on it matches `package.json`.
4. **Images (`sharp`).** The site's generated images still appear; no broken
   `<img>` on the landing page.

## §3 — Invariants

- No source file changed. The diff is `package.json`, both lockfiles, and the
  release docs.
- Registry stays **92** sources (87 EN + 5 RU); help stays 32 H2 / 122 H3 ×17.
- `npm audit` reports **0** vulnerabilities in both manifests, and the
  Dependabot alert list has no open entries.

## §4 — Sign-off

- [ ] `npm audit` clean in root and site
- [ ] `npm run test:ci` — 3013 pass, exit code captured directly
- [ ] Playwright narrow-viewport — 4 pass
- [ ] Site rebuilt: 86 pages, 17 mirrors
- [ ] Manual: `#/config` saves, an upload works, the landing page renders
- [ ] `/api/health` on resumecraft.ru reports 1.231.5
- [ ] GitHub Dependabot alerts: 0 open
