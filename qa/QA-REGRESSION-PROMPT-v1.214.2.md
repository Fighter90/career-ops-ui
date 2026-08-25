# QA REGRESSION PROMPT — career-ops-ui **v1.214.2** (html-to-text quoted-angle-bracket fix)

**Patch (post-career-ops-1.29.0-tag delta, origin-main `327d0c2`).** The shared `html-to-text.mjs` (Greenhouse/Recruitee descriptions) stripped tags with `<[^>]+>`, which stops at the FIRST `>` — so an attribute value containing `>` (`<a title="salary > 100k">`) leaked its tail (`100k">`) into the description a content filter reads.

- **Under test:** `package.json` **1.214.2**. Registry **82** = 77 EN + 5 RU — unchanged (help/OVERVIEW/API untouched).

## §0 — Gates

```bash
npm test                                                   # 2742, exit 0
node --test tests/html-to-text.test.mjs                    # 11 (was 7: +quoted-angle attr, +encoded-quote attr, +empty <>, +quoted media)
node --test tests/sources-greenhouse-offices.test.mjs      # 9 (uses htmlToText via contentToText)
node --test tests/sources-recruitee.test.mjs               # 2 (uses htmlToText)
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.214.2
```

## §1 — What changed

- **`server/lib/html-to-text.mjs`** — quote-aware markup stripping. New `HTML_TAG_RE = /<(?:[^>"']|"[^"]*"|'[^']*')+>/g` and `HTML_MEDIA_RE` (script/style, quote-aware attributes) + a `stripMarkup()` helper. `htmlToText` now **strips markup before decoding entities** (twice: once for literal tags, once for entity-escaped tags the first decode reveals) — so an encoded quote inside a quoted attribute can't become a false delimiter. A literal `<>` in plain text is still preserved (the `+` requires content between the brackets). Ported from the parent fix.

## §2 — Manual browser pass

1. A Greenhouse/Recruitee posting whose HTML body has an attribute containing `>` (e.g. an `<a title="pay > market">`) now shows a clean description in the scan row — no stray `market">` tail — and a `content_filter` matches the real text.

## §3 — Invariants / security

- `htmlToText` is still not an XSS boundary — it produces plain text for filter matching only. No new source/route/dependency. Only the touched-file behaviour and the test count changed.

## §4 — Not ported (this round's parent delta)

- **xquik** (`88b325c`) — an external X/Xquik BYO-key community plugin registered via `plugins-registry/xquik.json`, not a `providers/` source; no web-ui surface.
- **Read-only relays** — `follow-up` / `weekly-digest` / `rejection-latency` / `salary-gap` fixes are absorbed by web-ui's fail-soft relays; no code change.
- CLI/verify/docs/i18n/plugins-infra fixes — not web-ui surfaces.
- Still queued (opt-in): SmartRecruiters detail descriptions, detect-reposts `aggregator:` skip, `stem:`/`word:` title prefixes, DNS-rebinding guard.

## §5 — Sign-off

Suite **2742** green (2738 + 4) · `html-to-text` 7→11 · greenhouse/recruitee still green through the reordered pipeline · CHANGELOG parity ×17 at v1.214.2 · help **untouched** (82/77) · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed · site rebuild (changelog mirrors + facts version) + wiki (version + tests). Deploy: resumecraft rsync of `html-to-text.mjs` + `package.json`, restart. cvstart.org Pages rebuild.
