# QA REGRESSION PROMPT — career-ops-ui **v1.228.1 → v1.228.3**

Three patch releases in one pass. No parent delta. Registry unchanged throughout: **86 sources** (81 EN + 5 RU), `ALL_ADAPTERS` **81**.

## §0 — Gates
```bash
npm test                                          # 2907 (was 2865 at v1.227.5), exit 0
node --test tests/docs-assistant-routes.test.mjs  # 10 — 4 new, incl. a real-corpus guard
node --test tests/scan-results-query.test.mjs     # 14 — 4 new, multi-word matching
node --test tests/sources-telegram.test.mjs       # 23 — 3 new, company extraction
node --test tests/health-privacy.test.mjs         # 5  — 1 new, /api/ping leaks nothing
npm run test:ci                                   # exit 0
npm run test:e2e / :full / :e2e:browser           # 21/21 · 23/23 · 101/101
node scripts/check-changelog-parity.mjs           # 16 non-EN at v1.228.3
```

## §1 — v1.228.1: a dangling symlink was truncating deploys
`.claude/skills/refero-design` pointed at `../../.agents/skills/refero-design`, a path that has never existed here. **rsync aborts on it mid-transfer**: a deploy reported success while the server kept running the previous version, and the mismatch surfaced only because the version was checked afterwards. The parent's `node test-all.mjs` crashed on it too, since its fixture copy walks the working directory and cannot stat the link.

**Check:** `find . -type l ! -exec test -e {} \; -print` returns nothing, in the repo and in `/opt/career-ops/src/web-ui`. rsync without `--delete` does not remove a file deleted upstream — the server needed it cleared separately, and that is a general trap for this deploy path.

## §2 — v1.228.2: a two-word search matched the phrase, not the words
`/api/scan-results?q=` ran one `includes(q)` over title + company + location.

| query | before | after |
|---|---|---|
| `продакт менеджер` | 32 | **152** |
| `Product Manager` | 227 | **253** |

`Менеджер продукта` and `Менеджер по развитию продукта` were invisible to it — the same words, reordered or with filler between.

**This is the whole reason the Telegram assistant reported 9.** It was not guessing and not ignoring the API: 9 is what the endpoint returned. The assistant's count was honest; the endpoint's was not.

**Check:** term order is irrelevant (`продукта менеджер` == `менеджер продукта`); it is **AND**, so `менеджер разработчик` returns 0, not the union; padded and doubled whitespace changes nothing. And the shape the SPA depends on: **no parameters must still return the bare snapshot**.

## §3 — v1.228.3: the docs assistant was silent in English
Retrieval was fine. `buildAskPrompt` did `if (ctx.length + sec.body.length > MAX_CONTEXT) break` — a `break`, so one oversized section ended the loop and left the context **empty**; the assistant then truthfully said nothing matched while the answer sat in the section it had refused to inline.

| | §5 body | budget | result |
|---|---|---|---|
| EN | **16 081** | 14 336 | `break` on iteration 1 → empty |
| RU | 13 009 | 14 336 | fits |

Ranking was identical — §5 ranked first in both. Only size differed, and v1.228.0 adding `telegram_channels` to §5 is part of why English crossed the line.

**Check:** `splitSections` yields **75** chunks for `docs/help/en.md` (was 32); `telegram_channels` ranks first in EN *and* RU; a section with no `###` is left whole even when oversized; a small section still keeps its `###` inside. **The trap to watch for:** a help section that grows past 6 KB *without* subheadings becomes unretrievable in full — give it `###`s.

## §4 — v1.228.3: company names, and a probe that leaks nothing
- **Company:** `Компания: FinCore Technology (продуктовая разработка, высоконагруженные системы)` yielded `FinCore Technology (продуктовая разработка, высоконагруженны` — capped at 60, cut mid-word. The name now ends at the first separator introducing a description: a **spaced** dash (so `Coca-Cola` survives), comma, semicolon, pipe, or `(`. Check `Hewlett-Packard — enterprise hardware` → `Hewlett-Packard`, and that no live row exceeds 60 characters.
- **`GET /api/ping`** returns `{ ok, version }` and **exactly** those two fields. `/api/health` reports absolute paths, the profile owner's real name and which API keys are set — it must stay behind auth. Check externally: `/api/ping` → 200 unauthenticated, `/` and `/api/health` → 401, and `Strict-Transport-Security` present.

## §5 — Do not re-chase these
Three findings from the v1.228.2 pass were false positives. Recorded so the next pass does not spend time on them:

- **`~85` on cvstart.org is not drift.** `Math.floor(facts.adapters / 5) * 5` rounds 86 down to 85 deliberately, and the copy says "Scan **~**85" — the tilde is the marker. Exact counts appear where precision matters.
- **DOC-1 and DOC-2 are already corrected** in the prompt files. v1.227.2 §4.3 states the desktop check is a no-regression check with 910/910 measurements; v1.227.1 §4.4 names `#/followup` and notes `#/modes/followup` is a 404.
- **`content_filter` is present** — `portals.yml` line 243 locally, 229 on the server. A copy taken before the sync will not show it; compare file sizes (42 155 vs 45 756) before concluding a section is missing.

## §6 — Open, and why
- **cvstart.ru has no certificate, and remove/re-add in Settings → Pages will not produce one.** GitHub Pages allows **one** custom domain per site; `cvstart.org` holds it, and the issued certificate covers only `cvstart.org` / `www.cvstart.org`. This is structural, not an unfinished issuance. The agreed path is a redirect from the project's own server. **Do not install that Caddy block until the DNS A records for `cvstart.ru` and `www.cvstart.ru` already point at the server** — the block is written and deliberately left out for exactly this reason: until the DNS A records point at the server, ACME fails and burns Let's Encrypt's failed-validation limit (14 attempts in one hour against a limit of 5 per hostname).
- **280 px shows a 5 px overflow** (`scrollWidth` 285 vs `clientWidth` 280) from content wrapping inside cards, not from any element exceeding the viewport. `WIDTHS = [320]` remains correct — 280 px is below every current device except the Galaxy Fold cover screen.
- **ZeroSSL, Caddy's fallback issuer, is dead on the server** — `HTTP 422 caddy_legacy_user_removed`, the retired legacy integration. Not urgent: the Let's Encrypt certificate for resumecraft.ru is valid to 12 Nov 2026 and renews around 13 Oct. But there is no safety net if Let's Encrypt is unreachable that day. Caddy is 2.6.2.
