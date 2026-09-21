# Architecture Decision Records

Numbered, immutable records of decisions whose *reasoning* is not recoverable from
the code or the git history. A record is added when a choice will look arbitrary — or
plain wrong — to someone who did not see the evidence behind it.

Format: context (what forced the decision), decision, consequences, and what would
make us revisit it. Superseded records are not deleted; they get a `Superseded by`
line and stay.

| # | Title | Status |
|---|---|---|
| [0001](0001-keep-both-telegram-sources.md) | Keep both `telegram` and `telegram-channel` | Accepted |
| [0002](0002-defend-fork-divergences.md) | Defend fork divergences on every upstream merge | Accepted |
| [0003](0003-mirror-vs-relay.md) | Mirror or relay: how a parent change reaches web-ui | Accepted |
| [0004](0004-liveness-hard-vs-soft-tiers.md) | Liveness: hard vs soft expiry tiers | Accepted |
