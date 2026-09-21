# 0001 — Keep both `telegram` and `telegram-channel`

**Status:** Accepted · 2026-09-21 (v1.237.0)

## Context

The parent project shipped two readers of the same `t.me/s/<channel>` preview pages:
`providers/telegram.mjs` (recall-leaning) and `providers/telegram-channel.mjs` (strict —
a post becomes a row only when it names an employer in one of five explicit shapes
**and** links to a vacancy page, never a homepage, listing root, form, shortener or
social link). On HRitem-curated channels roughly 32–77% of posts pass the strict reader.

On 2026-09-21 upstream **deleted** `providers/telegram.mjs`, consolidating on the
strict one. web-ui mirrors both as separate, user-selectable sources.

## Decision

**Do not follow the deletion.** web-ui keeps both sources registered.

## Consequences

- The registry stays at 94 sources; following upstream would drop it to 93.
- Anyone with `telegram` configured keeps working. Removing a registered source is a
  breaking change for that user's scans, not a cleanup.
- The two sources must stay documented as a deliberate recall/precision pair, or a
  future session will "de-duplicate" them exactly as upstream did. See the
  `telegram` vs `telegram-channel` entry in [CONTEXT.md](../../CONTEXT.md).
- Our source count now diverges from the parent's provider count by one. That is
  expected and is not a parity failure.

## Revisit when

The user asks for it, as an announced removal with a migration note — not as a side
effect of a parity release.
