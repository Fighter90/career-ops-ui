# QA REGRESSION PROMPT — career-ops-ui **v1.227.3** (`word:` / `stem:` title-filter prefixes)

**Patch release, no parent delta.** One silent-no-op filter defect, found by checking web-ui against a live `portals.yml` that had just adopted `word:intern`. Registry unchanged: **85 sources** (80 EN + 5 RU), `ALL_ADAPTERS` **80**.

## §0 — Gates
```bash
npm test                                     # 2852 (was 2846), exit 0 — capture $? directly
node --test tests/title-filter.test.mjs      # 16 (was 10)
npm run test:ci                              # exit 0
npm run test:e2e                             # 21/21
npm run test:e2e:browser                     # 101/101
node scripts/check-changelog-parity.mjs      # 16 non-EN at v1.227.3
```

## §1 — The defect
`title_filter` / `content_filter` default to case-insensitive **substring** matching. That is why a bare negative `intern` also rejects **“International Product Manager”** and **“Internal Tools Engineer”**. Flipping that default would break every configured install, so the parent made precision opt-in per entry:

| Entry | Means |
|---|---|
| `word:intern` | whole word only — rejects “Operations Intern”, keeps “International …” / “Internal …” |
| `stem:agent` | must START a word, may continue — separates “Agentforce” from “Reagents” |

**web-ui implemented neither.** A prefixed entry was matched as the *literal text* `"word:intern"`, which appears in no job title, so the line became a **silent no-op** — the same `portals.yml` filtered correctly through the CLI and not at all here.

Ported from the parent's `title-keywords.mjs`, including the **Unicode word boundary** `[\p{L}\p{M}\p{N}_]` instead of `\b`, which is ASCII-only and matched mid-word in accented or Cyrillic titles. The 2–3 letter acronym rule now shares that same boundary — it previously used its own `\b`, so `coo` and `word:coo` disagreed on non-ASCII titles.

## §2 — Behaviour to verify
```
word:intern   DROP  Intern · Software Intern · Internship · Стажёр Intern
              KEEP  International Product Manager · Internal Tools Engineer · Product Manager
stem:agent    DROP  Agentforce Developer · Agent Manager
              KEEP  Reagents Chemist
word:  (bare) KEEP  everything — a typo must never veto a whole scan
coo           DROP  COO           KEEP  Coordinator          (acronym rule, unchanged)
.net          DROP  .NET Developer                            (substring, unchanged)
intern (bare) DROP  International Product Manager             (the default word: opts out of)
```

## §3 — Manual pass
1. Put `word:intern` in `portals.yml::title_filter.negative`, run a scan from `#/scan`, and confirm intern postings are gone **while** any “International …” title survives. Before this release the first half silently failed.
2. Re-run the same scan through the CLI (`npm run scan`) and confirm both produce the same set — CLI/UI parity is the point of the fix.
3. Confirm an unprefixed config behaves exactly as before (no silent change for existing installs).

## §4 — Not changed
No registry, scanner-source, route-contract, server, i18n-dict or help-bundle change. Defaults for unprefixed keywords are byte-for-byte the previous behaviour.

## §5 — Noted, not a defect
- **`provider: rss` is a web-ui-only source.** The parent ships 90 providers, none named `rss`, so `node validate-portals.mjs` reports `unknown provider "rss"` for that entry while web-ui scans it fine. A capability difference, not a config error — do not "fix" it by deleting the entry.
- **`config/profile.yml` nests the narrative fields.** `exit_story`, `cto_summary` and `pet_projects` live under `narrative:`, not at the top level. A top-level check reports them missing when they are present.

## §6 — Carried forward
- **SURF-1 · cvstart.ru** — still `https_certificate.state: "new"` after a full API remove/re-add cycle and 50 days stuck; served GitHub's default `*.github.io` cert, `verify error:num=62 hostname mismatch`. DNS is correct. Needs the domain removed and re-added **once** in repo Settings → Pages, then left alone. **Never verify this with local `curl`** — Kaspersky MITMs TLS on the dev machine and re-signs with its own CA, so curl reports a false 200; use `openssl s_client -verify_hostname` or a clean machine.
- **resumecraft.ru** — Basic-auth gated; unverifiable from a clean machine. Needs an unauthenticated `/api/health` and an HSTS header.
- **280 px** viewport overflow (v1.227.2 §3) — documented, not gated.

## §7 — Sign-off
Unit **2846 → 2852** · Playwright 101/101 · E2E 21/21 + 23/23 · parity ×17 at v1.227.3 · README banner+badges ×17 · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed · site mirrors ×17 rebuilt (facts 1.227.3 / 2852).
