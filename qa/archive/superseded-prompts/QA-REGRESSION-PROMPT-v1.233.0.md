# QA regression — v1.233.0

Three findings from a browser QA pass, all in the same `#/config` save path.
**CONFIG-3 was caused by v1.232.1's own fix** — the comment I wrote there
claimed the code told two cases apart that it demonstrably did not.

## §0 — Gates

```bash
node --test tests/playwright-config-save-scope.mjs   # 11 pass (needs a browser)
npm run test:ci                                      # 3018 pass, exit 0
npm run test:e2e:browser                             # 116 pass
```

Unit baseline unchanged at **3018** — every fix is in the client or in one
route's response shape, and the gates are browser cases.

## §1 — CONFIG-3: agreeing with a seeded default was discarded

With `HOST` absent, the control shows `127.0.0.1` (the v1.57.1 prefill). Typing
that exact value and saving posted `{}` and left the key absent. The only route
to pinning it was to enter a wrong value, save, then set the right one back —
which nobody would find.

`initial` conflates two origins:

| seeded from | equal to seed means |
|---|---|
| `.env` | the field was not edited — correct to skip |
| `defaultValue` | **ambiguous**: never opened, *or* opened and agreed |

Fixed by recording `seededFromFile` alongside `initial`. Where the seed came
from the file, nothing changes. Where it came from `defaultValue`, `dirty`
becomes a valid second signal — it is not a general basis (it fires on
type-and-revert), but it is the only remaining evidence, and it costs at most
the one field the user was working in, never CONFIG-2's eighteen, for which
`dirty` is empty because nobody opened them.

## §2 — ADJACENT-1: removing a key reported "· 0"

`updateEnvFile` only ever returned what it wrote, so a deletion had nothing to
count and the toast read "Settings saved · 0" — which a user reasonably takes
as "nothing happened" while the key had in fact been removed. The response now
carries `removed` as well, computed against the pre-write snapshot so it names
keys that really were present rather than every key the request asked to clear.
The toast counts both.

## §3 — ADJACENT-2: a select could be set but never cleared

None of the 18 dropdowns had an empty option, so the form could not send `''`
for one. Text fields can be emptied; selects could not. Combined with CONFIG-3
that closed a loop for an unset select: it could not be pinned (its value
equalled the seed) and, once pinned, could not be released.

Each select now leads with an explicit **"Use the default (…)"** entry, and an
unset key selects *that* rather than the default value. v1.57.1's intent
survives — the label still names the value the server will use — but it now
says so instead of impersonating a choice. `select-remote` needed care: the live
catalogue calls `replaceChildren`, which wiped the entry, so it is re-created
there too.

One new i18n key, `config.useDefault`, across all 17 dictionaries.

## §4 — Manual browser pass

With `HOST` absent from `.env`:

1. `#/config` → the HOST field shows `127.0.0.1`. Save without touching it →
   toast **· 0**, key still absent. (CONFIG-2 must not return.)
2. Click into HOST, type `127.0.0.1` — the same value — and Save → toast **· 1**,
   `grep HOST .env` now finds it. **This is CONFIG-3.**
3. Clear HOST → Save → toast **· 1** (not 0), key gone.
4. Any model dropdown reads **"Use the default (…)"** when the key is unset.
5. Set a model, Save, then choose "Use the default" and Save → the key is gone.
6. `#/config` in ru/ja/ar — the default entry is translated, not English.

## §5 — Invariants

- Registry stays **92** sources; help stays 32 H2 / 122 H3 ×17.
- Secrets are still sent only when touched.
- CONFIG-1's server-side domain check and its grandfathering are untouched.

## §6 — Checked and deliberately left alone

- **`lang` in every POST body** is a literal allowlist entry, not a prefix rule.
  Verified by behaviour: `lang` → 200, while `langx`, `lang_evil` and `LANG`
  all → 400, same as any unknown key.
- **`facts.json` is absent from the deployed site by design** — 22 files import
  it at build time and the values are inlined into the HTML. Verify the version
  token in the page, not the file. (§2.3 of the v1.231.5 prompt was misleading
  on this.)
- **`/api/cv/import` treating an extensionless file as text** is documented and
  deliberate, so clipboard saves without an extension still work. The route
  converts and returns; it never writes or executes, and `.exe`/`.zip` are
  refused explicitly.

## §7 — Sign-off

- [ ] `npm run test:ci` — 3018 pass, exit code captured directly
- [ ] `npm run test:e2e:browser` — 116 pass
- [ ] Manual §4, especially steps 1 and 2 together
- [ ] `/api/health` on resumecraft.ru reports 1.233.0
