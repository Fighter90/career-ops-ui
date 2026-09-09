# QA regression — v1.232.1

One defect: **Save on `#/config` wrote fields the user never touched.** Not a
v1.232.0 regression — it is older, and it surfaces through exactly the mechanism
v1.232.0's own notes described ("the form resends every non-secret field on
every Save, touched or not").

## §0 — Gates

```bash
node --test tests/playwright-config-save-scope.mjs   # 6 pass (needs a browser)
npm run test:ci                                      # 3018 pass, exit 0
npm run test:e2e:browser                             # 111 pass
```

Test baseline unchanged at **3018**: the fix is client-side, and its gate is a
browser suite, which is not part of `test:ci`.

## §1 — What was wrong

Two individually sound decisions combined into a write:

1. v1.57.1 seeds an unset control with its `defaultValue`, so the field shows
   the value the server will actually use instead of looking unconfigured.
   Correct, and unchanged.
2. `save()` consulted `dirty` **for secrets only** and sent every other field.

So the value put there for DISPLAY travelled to the server as if the user had
chosen it. Measured on a fixture with two keys set: changing one dropdown posted
**28 keys and pinned 18** the user had never opened, each its own default. With
nothing changed at all, Save still posted 27.

Nothing behaves differently on the day. What changes is the STATUS of each
setting — from *unset, follow the project default* to *pinned in `.env`*. These
curated lists move between releases, so the next time a default changes, every
user who ever pressed Save is silently left on the old value.

**The comparison basis matters and is the part worth reviewing.** Comparing
against `cfg.values` — the obvious fix — is not enough: an unset select shows
its default while the stored value is `''`, so they differ honestly and all 17
model dropdowns are still written. It cut the body from 27 keys to 19, not to
one. Save now compares against what each control was **seeded** with, which is
the only expression of "untouched" that separates a display default from a user
who deliberately picked that same value. `dirty` is not the basis either: it
fires when someone types a value and puts the original back.

Also fixed: the toast's key count lived inside `t()`'s FALLBACK argument, and
`config.saved` exists in all 17 dictionaries — so the number never rendered and
a Save of 12 keys looked identical to a Save of one.

## §2 — Manual browser pass

With a `.env` holding a handful of keys and every `*_MODEL` unset:

1. `#/config` → change **one** dropdown → Save. The toast now ends in `· 1`.
2. `grep DEEPSEEK_MODEL "$CAREER_OPS_ROOT/.env"` → **empty**. Same for
   `ZAI_MODEL`, `OLLAMA_MODEL`, `ARK_MODEL` and the rest.
3. Save again without changing anything → toast ends in `· 0`, `.env` byte-identical.
4. Clear a filled non-secret field (HOST) → Save → the key is **gone** from
   `.env`. Unsetting must keep working.
5. Change a dropdown while an API key is stored → the key survives untouched.
6. With `LLM_PROVIDER` holding a value outside the list, change something else →
   Save succeeds and that value is left exactly as it was.

## §3 — Invariants

- The v1.57.1 prefill is untouched: an unset field still shows the value the
  server uses.
- Secrets are still sent only when touched.
- Registry stays **92** sources; help stays 32 H2 / 122 H3 ×17.
- The server-side grandfathering from v1.232.0 stays — it guards direct API
  callers, who do not go through the form.

## §4 — Sign-off

- [ ] `npm run test:ci` — 3018 pass, exit code captured directly
- [ ] `npm run test:e2e:browser` — 111 pass
- [ ] Manual: one-field Save writes one key; untouched Save writes none
- [ ] `/api/health` on resumecraft.ru reports 1.232.1
