# QA regression sign-off — career-ops-ui v1.231.0

Parity release against parent **career-ops v1.32.0**. Registry **90 → 92**
(87 EN + 5 RU), `ALL_ADAPTERS` **85 → 87**. Two new sources, one new opt-in mode
on an existing source, and one defect found in the parent's own code while
porting.

---

## §0 — Gates

```bash
npm run test:ci                                     # 3009 pass, 0 fail (was 2962, +47)
node --test tests/sources-collage.test.mjs          # 14
node --test tests/sources-telegram-channel.test.mjs # 24
node --test tests/sources-gem.test.mjs              # 23 (was 14)
node --test tests/adapter-registry.test.mjs         # ALL_ADAPTERS === 87, ids sorted
node --test tests/scan-fallback-sources.test.mjs    # FALLBACK_SOURCES === registry
node scripts/check-changelog-parity.mjs             # 16 locales at v1.231.0, dates equal
```

Both gate lists (`adapter-registry`, `scan-sources-endpoint`) and
`FALLBACK_SOURCES` were **regenerated from the live registry**, never
hand-edited — manual insertion breaks alphabetical order.

---

## §1 — What changed

| area | change | source |
|---|---|---|
| `collage` | **new source** — Collage HR public job-site API | parent #3787 |
| `telegram-channel` | **new source** — strict Telegram reader, alongside the existing `telegram` | parent #3668 |
| `gem` | opt-in REST mode alongside GraphQL | parent #3783 |
| `telegram-channel` | Cyrillic location filter — **web-ui-only fix, not yet upstream** | — |

---

## §2 — Manual pass

1. **Collage refuses to guess.** Add `- name: Acme` + `provider: collage` with
   no `api:` and no `careers_url`. Expect a hard error naming both options —
   never a scan.
2. **Collage from a careers URL.** `careers_url: https://secure.collage.co/jobs/<addr>`
   must resolve to `https://api.collage.co/v1/positions/<addr>`.
3. **Two Telegram sources, side by side.** Configure the SAME channel twice —
   once `provider: telegram`, once `provider: telegram-channel`. The strict one
   must return **fewer** rows, and every row it returns must carry a real
   employer (not the channel handle) and a link that is not a `t.me` URL.
4. **The strict reader drops what it cannot attribute.** A post with an
   employer but only a phone number → no row. A post with a link but no named
   employer → no row. A post listing three vacancies → no row.
5. **Gem REST is opt-in.** An entry without `api:` must still use GraphQL —
   confirm the outbound request goes to `jobs.gem.com`, not `api.gem.com`.
6. **The `#/scan` Source filter** lists **Collage** and **Telegram (strict)**.

---

## §3 — Invariants

- Registry **92 / 87**: `/api/scan/sources` length, `ALL_ADAPTERS.length`.
- `telegram-channel` is **`provider:`-selected only**. A bare `t.me` URL is
  ambiguous between it and `telegram` and must auto-select neither.
- Collage's `assertCollageApiUrl` pins host **and path shape** — without the
  path check, `/login` on `api.collage.co` would be accepted as a board.
- Gem's REST rows are pinned to `jobs.gem.com/{vanity}/{id}`; anything else the
  API returns is dropped.
- A Cyrillic location must never become an employer (pinned; the test fails
  against the ASCII `\b` form).

---

## §4 — Not ported, and why

- **Workday facet recovery (#3851, #3874).** web-ui does not paginate or
  facet-split Workday at all — one POST at `offset: 0` — so neither code path
  exists here. Same conclusion as v1.229.0, re-verified rather than assumed.
- **`providers/_types.js`** — documentation only (optional `Job.salary`).

---

## §5 — Carried upstream

The Cyrillic word-boundary defect is **fixed here and still present in the
parent**. `LOCATIONISH_RE` there uses `\b`, which is ASCII-only, so `москва`,
`спб`, `офис` and `удалёнк*` are unreachable and a Cyrillic city is returned as
the employer. Worth an upstream PR.

---

## §6 — Sign-off

- [ ] `npm run test:ci` → 3009 / 0
- [ ] §2 manual pass, especially the two Telegram sources side by side
- [ ] README ×17 badges + banner at v1.231.0 / 3009
- [ ] CHANGELOG ×17 at v1.231.0, same date
- [ ] help ×17 states 92 / 87
- [ ] site changelog mirrors ×17 carry v1.231.0
- [ ] wiki Home banners ×17 + two Scanner-Providers rows
