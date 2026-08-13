# QA REGRESSION PROMPT — career-ops-ui **v1.175.0** (SEO-description regression guard + nullish-safe strip)

**AI-review follow-up on v1.174.0.** The FIND-3 fix (SEO `meta.desc` `~55` → registry-derived `{adapters}` placeholder) worked and was verified live, but shipped with **no CI guard** — the advisory AI reviewer flagged that it would drift on the next locale edit exactly like the "~55" it replaced. This release adds the guard and a defensive parser tweak.

- **Under test:** `package.json` **1.175.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                    # full suite — 2451, exit 0 (capture $? directly, never | grep)
node --test tests/site-meta-desc-parity.test.mjs   # 3 cases
node scripts/check-changelog-parity.mjs     # all 16 non-EN locales at v1.175.0
```

## §1 — Change

- **`tests/site-meta-desc-parity.test.mjs` (new, +3)** — CI-isolated (reads repo source only): (1) every one of the 17 `site/src/i18n/*.json` `meta.desc` contains `{adapters}`; (2) no locale re-hard-codes a `~NN` count or a stray `55/75/79/80`; (3) `Landing.astro` derives the count from `facts.adapters`, substitutes `{adapters}`, and feeds the substituted `metaDesc` into BOTH the JSON-LD description and the `<Base description=…>` (so all three description metas), with no un-substituted `meta.desc` sink left.
- **`server/lib/parsers.mjs` — `stripEmphasis` nullish guard** — returns `''` for a nullish input instead of the string `"undefined"` (the report fields are string-initialized, so this is defense-in-depth; no behavior change for real inputs).

## §2 — Manual pass

1. `npm run build` in `site/` stays green; the built `dist/index.html` (and `/ru/`, `/ja/`) still render "Scan ~75 …" in `name=description` / `og:description` / `twitter:description`.
2. `grep -L '{adapters}' site/src/i18n/*.json` is empty; `grep -l '~55' site/src/i18n/*.json` is empty.

## §3 — Invariants

- **Guard, not behavior** — the SEO fix itself is unchanged; this only prevents future per-locale drift. EN report parsing unchanged.
- Test + a one-line parser guard; no route / CSP / SSRF / parent-write change; no new dependency.

## §4 — Sign-off

Suite **2451** green · `site-meta-desc-parity` 3/3 · parity ×17 · built metas still "~75". **Closes the AI-review parity-test gap on FIND-3.**
