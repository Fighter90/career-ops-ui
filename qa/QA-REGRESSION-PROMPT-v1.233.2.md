# QA regression — v1.233.2

Two CodeQL `js/remote-property-injection` alerts, closed by making an existing
invariant structural. **No behaviour changes.**

## §0 — Gates

```bash
node --test tests/config-endpoint.test.mjs tests/config-select-domains.test.mjs   # 31 pass
npm run test:ci                                                                    # 3021 pass, exit 0
npm run test:e2e:browser                                                           # 116 pass
gh api /repos/Fighter90/career-ops-ui/code-scanning/alerts --jq '[.[]|select(.state=="open")]|length'   # 0
```

Baseline unchanged at **3021** — the loop's behaviour is identical, and the
existing `empty value unsets the key on disk + in process.env` test already
pins the part that mattered.

## §1 — What changed

`POST /api/config` applies saved values to the running process so no restart is
needed. That loop read:

```js
for (const [k, val] of Object.entries(safe)) {
  if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
  if (val === '' || val == null) delete process.env[k];
  else process.env[k] = val;
}
```

`safe` is built twenty lines earlier by iterating `KNOWN_KEYS` and copying only
those, so `k` was never user-controlled and the code was safe. But **read on its
own the loop says "assign to a property whose name came out of an object built
from the request body"**, and CodeQL cannot follow the constraint across the two
loops. It flagged lines 127-128 as high-severity remote property injection.

The alerts are dated 2026-09-09 because v1.232/v1.233 shifted the line numbers,
not because the code was new — this loop predates all of it.

It now iterates the constant array:

```js
for (const k of KNOWN_KEYS) {
  if (!Object.prototype.hasOwnProperty.call(safe, k)) continue;
  const val = safe[k];
  …
}
```

Same behaviour, but the property name is provably a module-level literal, so
the guarantee is structural rather than asserted. The explicit
`__proto__`/`constructor`/`prototype` guard went with it: a hardcoded list of
SCREAMING_SNAKE names cannot contain one.

**Dismissing these as false positives was the alternative.** Fixing was
preferable: an assertion in a comment is worth less than a shape the tool — and
the next reader — can verify.

## §2 — What to check

The subtle part of this loop is that an **empty value must still delete from
`process.env`**, not merely from the file. That is the one thing a careless
rewrite would break.

1. `#/config` → set `HOST` to something, Save → `process.env.HOST` follows
   immediately, no restart.
2. Clear `HOST`, Save → the key is gone from `.env` **and** from the running
   process.
3. `#/config` still refuses an unknown key with 400 and an out-of-domain
   `LLM_PROVIDER` with 400.

## §3 — Invariants

- Registry stays **92** sources; help stays 32 H2 / 122 H3 ×17.
- `/api/config` still reports **45** keys.
- Only `server/lib/routes/config.mjs` changed, plus release docs.

## §4 — Sign-off

- [ ] `npm run test:ci` — 3021 pass, exit code captured directly
- [ ] `npm run test:e2e:browser` — 116 pass
- [ ] GitHub code-scanning: **0 open alerts**
- [ ] `/api/health` on resumecraft.ru reports 1.233.2
