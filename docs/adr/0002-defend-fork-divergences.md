# 0002 — Defend fork divergences on every upstream merge

**Status:** Accepted · 2026-09-21 (v1.237.0), extending a rule in force since 2026-09-06

## Context

`Fighter90/career-ops` (the **fork**, our `origin`) carries fixes that
`career-ops-hq/career-ops` (**upstream**) does not have. The most load-bearing is in
`providers/telegram-channel.mjs`:

```js
// fork
const LOCATIONISH_RE = /(?<![\p{L}\p{N}])(remote|удал[её]нк\p{L}*|…|москва|спб|…)(?![\p{L}\p{N}])/iu;
// upstream
const LOCATIONISH_RE = /\b(remote|удал[её]нк\w*|…|москва|спб|…)\b/i;
```

`\b` and `\w` are ASCII-only and never fire next to Cyrillic, so every Russian
alternative is unreachable and `Senior Engineer | Москва` returns the **city as the
employer** — the wrong-field-as-fact the provider's own policy exists to prevent.

On 2026-09-21 upstream did not merely lack the fix: it **actively reverted** that line
to the ASCII form and deleted the comment explaining why. **The merge carrying that
revert produced zero conflicts** — git kept our side because our commit descends from
theirs. That is luck, not protection: resolved the other way, the bug would have been
reinstated silently and no upstream test would have noticed.

## Decision

Before every `git merge upstream/main`, diff each known divergence and snapshot the
file; after the merge, diff the snapshot. **Do not rely on a conflict marker to
surface a divergence.**

```bash
git diff HEAD..upstream/main -- providers/telegram-channel.mjs   # inspect BEFORE merging
cp providers/telegram-channel.mjs /tmp/tc.before                 # snapshot
# … merge …
diff /tmp/tc.before providers/telegram-channel.mjs               # must be empty
```

Post-merge fast check of all four current divergences:

```bash
grep -c 'p{L}' providers/telegram-channel.mjs   # 4 — Cyrillic boundaries intact
ls providers/telegram.mjs                       # present — see ADR-0001
grep -c hermes web/src/lib/clis.ts              # 1 — Hermes CLI entry
grep -c vpFixtureEnv test-all.mjs               # 9 — fixture isolation
```

## Consequences

- Every parity release starts with a divergence diff, before any merge.
- "Take theirs" is never a default resolution on these files.
- The fork's source count and provider set will keep drifting from upstream. That is
  intended.

## Revisit when

A divergence is accepted upstream — then it stops being a divergence and drops off
the checklist.
