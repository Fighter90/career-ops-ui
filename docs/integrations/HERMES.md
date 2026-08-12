# Hermes agent + Telegram — integration guide

> **Status: planned / not-yet-wired.** This document is the *design contract* for
> bridging career-ops-ui to **Nous Research's Hermes** agent and, through it, to
> **Telegram**. The provider integration itself is **not shipped** — it is blocked
> on the Phase 5 API-contract spike (see [`docs/UX-ROADMAP.md`](../UX-ROADMAP.md)
> Phase 5). Nothing here describes an endpoint the server calls today. Read it as
> "how this *will* work and how to deploy toward it," not "what runs now."

`career-ops-ui` is an Express + vanilla-JS viewer that sits inside the parent
[`Fighter90/career-ops`](https://github.com/Fighter90/career-ops) pipeline. It is
a **loopback single-tenant** app by design (binds `127.0.0.1`). This guide covers
two things that go beyond that default:

1. Running career-ops-ui on a **cloud server** (moving off `127.0.0.1` safely).
2. Bridging its events/reports to **Telegram through a Hermes agent**.

---

## 1. What Hermes is (and what it is not)

**Hermes** is Nous Research's open autonomous-agent product — tool-calling, skills,
voice, and connectors to 20+ messaging platforms (Telegram among them). Its docs
(<https://hermes-agent.nousresearch.com/docs>) and the
[`NousResearch/hermes-agent`](https://github.com/NousResearch/hermes-agent) repo
describe an **agent runtime** that "works with Nous Portal / OpenRouter / OpenAI /
any endpoint" — **not**, as of this writing, a documented hosted
`/chat/completions` API you can drop in next to Anthropic or OpenAI.

That distinction drives the whole integration and is why the code is not written
yet. There are **two possible shapes**, and which one applies must be confirmed
from **Nous Portal** and/or the repo before any code lands:

### Shape A — Hermes exposes an OpenAI-compatible endpoint (the light path)

If Nous Portal (or a self-hosted Hermes) offers an OpenAI-style
`POST /v1/chat/completions`, then Hermes becomes **just another LLM provider** in
the existing cascade. The work mirrors the Qwen/OpenAI branches (they are already
`/chat/completions`-shaped):

- a `NOUS_API_KEY` in [`server/lib/env-config.mjs`](../../server/lib/env-config.mjs)
  + a field in `#/config`;
- a dispatch branch in
  [`server/lib/llm-dispatch.mjs`](../../server/lib/llm-dispatch.mjs)
  (`runActiveProvider` / `providerAvailable`);
- a row in the provider-order cascade;
- the model catalogue + a `#/config` hint;
- `cli-detect` / help / README roster entries;
- a price row in [`server/lib/llm-pricing.mjs`](../../server/lib/llm-pricing.mjs).

No new route — it rides the shared `runActiveProvider` cascade like every other
provider.

### Shape B — Hermes is the agent runtime (the heavy path)

If Hermes is only reachable as an agent runtime (not a plain completions API),
career-ops-ui does **not** add a `runActiveProvider` branch. Instead it either:

- **shells out** to a locally-run Hermes agent (arg-array `spawn`, never a shell
  string — same discipline as the scan/runner subprocesses), or
- calls a **Nous Portal agent endpoint** through a dedicated **relay route**
  (`server/lib/routes/hermes.mjs`, to be created) that speaks Hermes's own
  request/response shape.

In this shape, Telegram delivery is Hermes's job, not the server's: career-ops-ui
hands Hermes a message (or Hermes calls career-ops-ui as a **tool**), and Hermes
fans it out to whatever channels the user has connected.

**Decision gate:** run the Phase 5 scoping spike (confirm base URL, auth header,
whether it is OpenAI-compatible, model ids, streaming, tool-calling shape) before
committing to Shape A or B. Do not write the provider until the contract is known.

---

## 2. Cloud-server deployment

career-ops-ui defaults to `127.0.0.1:4317`. To reach a Hermes agent that lives on
a server (or to run the UI itself remotely) you move off loopback — which means
the security envelope that loopback gave you for free now has to be built
explicitly. **This is the same code either way; only the exposure changes.**

### 2.1 Provision

- A small VPS (1 vCPU / 1 GB RAM is enough for the viewer), **Node ≥ 18**.
- Clone the parent `career-ops` and this repo inside it as `career-ops/web-ui/`,
  exactly as in a local install. The parent-project **read-only contract** still
  holds: on a headless box the server still only ever *reads* `cv.md`,
  `config/`, `reports/`, `portals.yml` and only *writes* on explicit user actions
  (see [`docs/architecture/DATA-FLOWS.md`](../architecture/DATA-FLOWS.md)).
- Put provider keys in the parent project's `.env` (never commit it —
  `.env` / `.env.*` are gitignored). Use `.env.example` placeholders as the
  template.

### 2.2 Run it as a service, behind a reverse proxy, over HTTPS

- **Never** expose `HOST=0.0.0.0` directly. Bind the app to loopback and put a
  reverse proxy (nginx / Caddy) in front that terminates **HTTPS** and forwards to
  `127.0.0.1:4317`. Let's Encrypt / Caddy-automatic-TLS is fine.
- Run the app under a process manager — a **systemd** unit or `pm2` — with
  `Restart=on-failure`, a dedicated non-root user, and the working directory set
  to `career-ops/web-ui/`.
- When you *do* set `HOST=0.0.0.0` (so the proxy can reach it on a container
  network), the built-in hardening that was a **no-op on loopback** switches on and
  becomes load-bearing:
  - `llmRateLimit` (10 req/min/IP by default, `LLM_RATE_LIMIT="N/Ws"` to tune) on
    the LLM routes;
  - `safeGet` DNS-rebind defense on every user-URL fetch;
  - `sanitizePathName()` on every `:name`/`:slug` param.

### 2.3 Invariants that MUST survive the move off `127.0.0.1`

These are non-negotiable and are enforced in code today — do not relax them to
make a remote deployment "easier":

- **CSP** — `script-src` has **no** `'unsafe-inline'` / `'unsafe-eval'`; every
  handler is `addEventListener`, never inline `onclick=`. `frame-ancestors 'none'`.
  A reverse proxy must **not** strip or rewrite these headers.
- **SSRF guard** — any endpoint that fetches a user-supplied URL goes through
  `isValidJobUrl()` + `safeGet` (no loopback, no `file://`, no script chars). A
  Hermes relay route that fetches anything MUST reuse the same validator.
- **Markdown/XSS boundary** — CV/markdown ingress is sanitized by
  `stripDangerousMarkdown()` on the server and rendered through the escape-first
  `UI.md()` on the client. A Telegram/Hermes message path renders through the same
  boundary; it does not get its own looser renderer.
- **No secrets in logs** — provider keys, tokens, and PII are never logged. A
  remote box with shipped logs makes this rule *more* important, not less.

---

## 3. Telegram via Hermes

The goal: career-ops-ui events — a finished scan, a new report, a follow-up that
just went urgent — reach a **Telegram** chat, and (optionally) a Telegram message
can ask career-ops-ui for a status. Hermes is the bridge; career-ops-ui never
talks to the Telegram Bot API directly.

### 3.1 Wiring (planned)

1. Stand up a Hermes agent (per the Hermes docs) and connect its **Telegram**
   channel with a bot token you create via `@BotFather`. **The bot token lives in
   Hermes's config, not in career-ops-ui.** career-ops-ui never sees it.
2. Choose the direction of the bridge:
   - **career-ops-ui → Hermes (push):** a small relay route posts an event to the
     Hermes agent, which delivers it to Telegram. The relay carries only a
     rendered summary — never CV text, profile salary numbers, raw report bodies,
     URLs, or keys.
   - **Hermes → career-ops-ui (tool-call):** Hermes calls a **read-only** GET
     endpoint (e.g. a scoped `/api/health`-style summary) as one of its tools, and
     narrates the result into Telegram. This keeps career-ops-ui a data source, not
     a message sender.
3. Whichever direction, the relay route is subject to every §2.3 invariant — SSRF
   guard on any outbound fetch, no secrets in logs, and the message body rendered
   through the shared sanitizer.

### 3.2 Threat model — what NOT to expose

Bridging a private, single-tenant job-search viewer to a public messaging platform
is exactly where a live job search can leak. Explicitly **do not** send to
Telegram/Hermes:

- **CV contents** or any PII from `cv.md`.
- **Salary numbers** from `config/profile.yml` or compensation figures from stats.
- **Raw report bodies** from `reports/` (send a link or a one-line status, gated
  behind auth — not the text).
- **Provider API keys or the Telegram bot token** — ever, in any field or log line.
- **Internal URLs** or the loopback address of the box.

Send the **minimum** that makes the notification useful: "Scan finished — 12 new
matches" and a link the authenticated user opens themselves. When in doubt, send
less. The relay is an egress point; treat every field as public the moment it
leaves the box.

---

## 4. Status & next steps

| Piece | State |
|---|---|
| This guide + the README teaser | **shipped** (v1.146.0) |
| A `hermes-bridge` skill that walks the deployment | **shipped** (v1.146.0) |
| In-app help §"Hermes & Telegram" ×17 + site surface | planned (v1.147.0) |
| Provider integration (Shape A **or** B) | **blocked** on the Phase 5 API-contract spike |

To unblock the provider work, confirm the actual Hermes/Nous Portal contract
(base URL, auth, OpenAI-compatibility, model ids, streaming, tool-calling) from
Nous Portal and the [`NousResearch/hermes-agent`](https://github.com/NousResearch/hermes-agent)
repo, then follow **Shape A** (light, provider-cascade) or **Shape B** (relay
route / local shell) as the contract dictates. Until then, everything above is a
plan — no server code calls Hermes.

---

*See also:* [`docs/architecture/OVERVIEW.md`](../architecture/OVERVIEW.md) ·
[`docs/architecture/DATA-FLOWS.md`](../architecture/DATA-FLOWS.md) ·
[`docs/UX-ROADMAP.md`](../UX-ROADMAP.md) (Phase 5 / 5b) ·
the `hermes-bridge` skill (`.claude/skills/hermes-bridge/SKILL.md`).
