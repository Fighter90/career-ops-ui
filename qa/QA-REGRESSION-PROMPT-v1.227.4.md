# QA REGRESSION PROMPT — career-ops-ui **v1.227.4** (`content_filter` prefixes — the other half of v1.227.3)

**Patch release, no parent delta.** v1.227.3 fixed the prefix handling in `title_filter` and left `content_filter` untouched. Registry unchanged: **85 sources** (80 EN + 5 RU), `ALL_ADAPTERS` **80**.

## §0 — Gates
```bash
npm test                                       # 2858 (was 2852), exit 0
node --test tests/content-filter.test.mjs      # 12 (was 6)
node --test tests/title-filter.test.mjs        # 16
npm run test:ci                                # exit 0
npm run test:e2e                               # 21/21
npm run test:e2e:browser                       # 101/101
node scripts/check-changelog-parity.mjs        # 16 non-EN at v1.227.4
```

## §1 — What was still broken
`content_filter` kept its own raw `lower.includes(k)` and never went through `compileKeyword`, so a `word:`-prefixed entry there was still matched as the **literal text** `"word:java"` — the same silent no-op v1.227.3 fixed for titles, one filter over.

Now routed through the parent's `compileContentKeyword`, which shares the prefix machinery but deliberately does **not** auto-anchor short keywords. That asymmetry is intentional:

| Filter | Short keyword (`go`, `sql`, `aws`) |
|---|---|
| `title_filter` | **anchored** — "COO" inside "Coordinator" is always wrong |
| `content_filter` | **substring** — a short run inside a paragraph of prose is routinely intended |

## §2 — Behaviour to verify
```
content_filter negative word:java   DROP "We use Java on the backend"
                                    KEEP "Built with JavaScript and React"
content_filter negative stem:agent  DROP "our agentic pipeline"
                                    KEEP "reagents are stored on site"
content_filter negative go          DROP "a good fit"   ← NOT anchored, by design
content_filter negative java        DROP "Built with JavaScript"  ← default, unchanged
content_filter word: (bare)         KEEP everything
blank / absent description          KEEP always — providers without a description
                                    must never be filtered out by content
```

## §3 — Re-verified from the same AI review (unchanged, no regression)
Switching the 2–3 letter acronym rule from `\b` to the Unicode boundary in v1.227.3 was questioned. Checked across 14 edge cases and it is **behaviourally identical for ASCII**, stricter only where intended:

```
DROP COO · Chief Officer, COO · VP Engineering · SDR · Директор COO · VP «Продукт»
KEEP Coordinator · co-op · VPN Engineer · SVP Sales · Understanding
KEEP COO_lead · coo1 · _coo          ← underscore and digit are word chars under BOTH
```

## §4 — Manual pass
1. Add `word:java` to `portals.yml::content_filter.negative`, scan, and confirm postings that only mention "JavaScript" survive while ones naming Java are dropped. Before this release the prefix did nothing here.
2. Confirm an unprefixed `content_filter` behaves exactly as before — no silent change for existing installs.
3. Confirm a provider that returns no description is still scanned (blank description must pass the content filter).
4. Run the same config through the CLI and diff the result sets — CLI/UI parity is the point.

## §5 — Not changed
No registry, scanner-source, route-contract, server, i18n-dict or help-bundle change. Unprefixed matching is byte-for-byte the previous behaviour in both filters.

## §6 — Process note
This defect existed because v1.227.3's own code comment claimed `title_filter` **and** `content_filter` while only the title path was wired — the comment was written from intent rather than from the code. The AI review caught exactly that gap. The comment now states what each filter actually does, including the deliberate acronym asymmetry.

## §7 — Carried forward
- **SURF-1 · cvstart.ru** — still `https_certificate.state: "new"` after a full API remove/re-add and 50 days stuck. Needs one manual remove/re-add in Settings → Pages, then left alone. **Never verify with local `curl`** (Kaspersky MITM); use `openssl s_client -verify_hostname` or a clean machine.
- **resumecraft.ru** — Basic-auth gated; needs an unauthenticated `/api/health` + HSTS to be verifiable from a clean machine.
- **280 px** viewport overflow — documented, not gated.

## §8 — Sign-off
Unit **2852 → 2858** · Playwright 101/101 · E2E 21/21 + 23/23 · parity ×17 at v1.227.4 · README ×17 · CONVENTIONS/PROJECT-CONTEXT/CLAUDE · site mirrors ×17 (facts 1.227.4 / 2858).
