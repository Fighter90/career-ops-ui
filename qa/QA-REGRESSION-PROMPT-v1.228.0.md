# QA REGRESSION PROMPT — career-ops-ui **v1.228.0** (Telegram channels as a scan source · paged `/api/scan-results`)

**Minor release, no parent delta.** One new source and one new API mode, both driven by a real failure the user hit in the Telegram assistant. Registry: **85 → 86 sources** (81 EN + 5 RU), `ALL_ADAPTERS` **80 → 81**.

## §0 — Gates
```bash
npm test                                          # 2893 (was 2865), exit 0
node --test tests/sources-telegram.test.mjs       # 18 — new
node --test tests/scan-results-query.test.mjs     # 10 — new
node --test tests/adapter-registry.test.mjs       # ALL_ADAPTERS === 81, ids include 'telegram'
npm run test:ci                                   # exit 0 (changelog parity + i18n audit + also-leftovers)
npm run test:e2e                                  # 21/21
npm run test:e2e:full                             # 23/23
npm run test:e2e:browser                          # 101/101
node scripts/check-changelog-parity.mjs           # 16 non-EN at v1.228.0
```

## §1 — Telegram channels are a scan source
**Why the obvious routes don't work:** Telegram publishes no RSS, and the Bot API cannot read a channel your bot does not administer. The only auth-free path to someone else's job channel is the public web preview at `https://t.me/s/<channel>` — plain server-rendered HTML, no JS, no cookie. Verified across the 16 channels the user supplied: 15 returned 20 posts each on a bare GET.

**Config lives in its own top-level block**, not in `tracked_companies`:
```yaml
telegram_channels:
  enabled: true
  max_posts: 100          # default cap per channel (hard cap 300)
  channels:
    - { name: "PHP jobs", channel: rabotaphp }
    - { name: "Salary PM", channel: salary_pm, max_posts: 50 }
```
A channel is not an employer: the scanner filters `tracked_companies` through `detectApi()`, and a channel has no `careers_url` to detect. `expandTelegramChannels()` in `server/lib/en-scanner.mjs` expands the block into ordinary adapter-selected entries, so quarantine, filters, and dedup all run on **one** scan path rather than a parallel one.

**Check:**
- `channel:` accepts `rabotaphp`, `@rabotaphp`, `https://t.me/rabotaphp`, and a link to a single post.
- **Telegram** appears in the `#/scan` Source dropdown and in the site's source list.
- A live run of the configured 15: **299 posts, 15/15 channels**.

## §2 — What this source deliberately does NOT do
Three behaviours are intentional. Do not "fix" them:

- **A channel post is prose, not a job record.** No structured fields exist. The title is the first substantive line; company / location / salary come only from explicit labels. Separating real postings from ads and digests is the existing `title_filter`'s job — the same one already tuned for other sources.
- **The company is never guessed.** With no label the row is attributed to the channel (`@rabotaphp`). A wrong employer would enter the tracker as fact.
- **An empty parse throws.** `t.me` answers a private or missing channel with a redirect; returning zero rows would read as a quiet day and hide a config typo forever. `jobGeeks` from the original list does exactly this (HTTP 302) and is deliberately **not** configured.

## §3 — The Telegram assistant was answering from a fraction of the data
**Symptom (user-reported):** asked to find all Продуктовый менеджер, the bot reported **9** matches where `#/scan` showed 211, and said it was "working with a limited local index".

**Cause:** its skill already pointed at `/api/scan-results`, but that route could only return the whole snapshot — ~2 MB on the real box — which does not fit in an agent's context. It could see the endpoint and not consume it.

**Fix:** `?q=<text>&limit=50[&region=ru|en][&set=filtered|fresh][&offset=N]` returns `{ total, returned, offset, limit, set, region, query, rows }`, where **`total` is the count before paging**. The same question now costs 2 KB.

**Regression risk — check first:** **no parameters must still return the bare snapshot unchanged.** The `#/scan` table depends on that exact shape.

Also verify the clamps: `limit=0` → 1 (not 50 — `parseInt('0') || 50` was a real falsy-zero bug caught by its own test), `limit=9999` → 200, a negative `offset` → 0.

The production skill was also rewritten: it had said to summarize the *new* postings, pointing at `fresh` (last run only) rather than `filtered` (everything kept).

## §4 — The Unicode boundary, again
Remote detection uses `(?<![\p{L}\p{M}\p{N}_])` rather than `\b`. `\b` is ASCII-only, so a space before a Cyrillic word is not a boundary at all and `\bудал` never matched "удалёнка" — the same trap the title filter hit in v1.227.3, caught here by a test before it shipped. Check the same class of bug anywhere new matching is added.

## §5 — Docs
- `docs/help/<lang>.md` §5 gained a `telegram_channels` subsection in **all 17 locales** (H3 parity gate bumped 121 → 122). This corpus is the ONLY grounding for the "Ask the docs" assistant, so a user asking how to add a channel now gets a real answer.
- `docs/portals-examples.md` gained a copy-paste Telegram section with the key table.
- Stale doc counts swept across all 17 READMEs while here: test totals (1856 / 1945 / 1955 / 549 / 419 / 284 / 2527 → **2893**), Playwright (70 / 90 / 12 → **101**), e2e smoke (20 → **21**), route modules (12 / 32 → **37**), playwright-smoke flows (12 → **22**). Verified by running each suite, not by copying a badge.
