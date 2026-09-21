# 0003 — Mirror or relay: how a parent change reaches web-ui

**Status:** Accepted · 2026-09-21 (v1.237.0), formalising practice since v1.119.0

## Context

web-ui sits inside the parent checkout and reaches parent logic two ways. Which one
applies decides whether an incoming parent fix needs a port at all — and getting it
wrong costs either a missed fix or a pointless one. Every parity release asks this
question about every changed file, and the answer was previously only in reviewers'
heads.

## Decision

Classify each changed parent path before porting anything.

| Class | How web-ui uses it | A parent fix means |
|---|---|---|
| **mirror** | re-implemented in `server/lib/` so the HTTP API never shells out — `role-matcher.mjs`, `detect-reposts.mjs`, `trust-validator.mjs`, `liveness-core.mjs`, `url-key.mjs`, `scan-sanitize.mjs`, `cooldown.mjs`, every `sources/*.mjs` | **port it**, with the parent's test cases |
| **relay** | shelled out via `server/lib/parent-relay.mjs`, JSON forwarded — `stats.mjs`, `jd-skill-gap.mjs`, `analyze-patterns.mjs`, `doctor.mjs`, `followup-*` | **no change** — the fix arrives with the deployed parent |
| **not mirrored** | web-ui neither re-implements nor calls it — `lib/latex-escape.mjs`, `browser-extract.mjs`, `openai-eval.mjs`, `update-system.mjs`, the scaffolder | **no change**, record the reason |
| **separate surface** | a different product — the Go dashboard TUI, `web/`, CLI mode prompts | **no change**, record the reason |

Two rules that follow from this:

1. **Check whether web-ui is already ahead before porting a mirror fix.** It sometimes
   is — its `senjob` used the shared C0-safe decoder from day one, so the parent's fix
   for that was a no-port. Grep for the shared idiom first.
2. **Write the no-ports down.** Every parity release records them in the CHANGELOG
   **Notes** section with the reason. A silent no-port is indistinguishable from an
   oversight at review time, and the next release re-litigates it.

## Consequences

- The CHANGELOG Notes section is load-bearing, not decoration.
- A relayed fix is live as soon as the parent tree is deployed to the server, which
  happens in the same deploy step — so "not ported" does not mean "not fixed".

## Revisit when

A relay becomes a mirror (or the reverse). That is itself a decision worth an ADR,
because it changes what a parent fix implies.
