# Hermes agent + Telegram — integration guide

> **Status (v1.151.0): the LLM-provider path — Shape A — is now WIRED.** The
> Phase 5 scoping spike confirmed Hermes ships an **OpenAI-compatible API Server**
> (`hermes gateway` → `POST /v1/chat/completions`, Bearer auth), so career-ops-ui
> now talks to a running Hermes as just another provider in its cascade (set
> `HERMES_API_KEY` in `#/config`). What remains *forward-looking* in this doc is
> the **cloud-server deployment** playbook (§2) and the **Telegram bridge** (§3) —
> those are how-to guidance, not shipped app features. See
> [`docs/UX-ROADMAP.md`](../UX-ROADMAP.md) Phase 5.

`career-ops-ui` is an Express + vanilla-JS viewer that sits inside the parent
[`Fighter90/career-ops`](https://github.com/Fighter90/career-ops) pipeline. It is
a **loopback single-tenant** app by design (binds `127.0.0.1`). This guide covers
two things that go beyond that default:

1. Running career-ops-ui on a **cloud server** (moving off `127.0.0.1` safely).
2. Bridging its events/reports to **Telegram through a Hermes agent**.

---

## 1. What Hermes is (and what it is not)

**Hermes** is Nous Research's open autonomous-agent product — tool-calling, skills,
voice, and connectors to 20+ messaging platforms (Telegram among them). It's an
**agent runtime** that "works with Nous Portal / OpenRouter / OpenAI / any
endpoint" (self-hosted: "a $5 VPS, a GPU cluster, or serverless"). Crucially, per
its docs (<https://hermes-agent.nousresearch.com/docs>) and the
[`NousResearch/hermes-agent`](https://github.com/NousResearch/hermes-agent) repo,
it **also exposes an OpenAI-compatible API Server** — `hermes gateway` binds
`http://127.0.0.1:8642` and serves `POST /v1/chat/completions` (Bearer auth via
`API_SERVER_KEY`, streaming, `GET /v1/models`).

That API Server is exactly **Shape A**, so that's the path career-ops-ui took
(v1.151.0). Two shapes exist; A is the one that applies here:

### Shape A — Hermes's OpenAI-compatible API Server (WIRED, v1.151.0)

`hermes gateway` exposes an OpenAI-style `POST /v1/chat/completions`, so Hermes is
**just another LLM provider** in the existing cascade, mirroring the Qwen/OpenAI
branches (already `/chat/completions`-shaped). What shipped in v1.151.0:

- `HERMES_API_KEY` (the gateway's `API_SERVER_KEY`) + `HERMES_BASE_URL` (default
  `http://127.0.0.1:8642/v1`) + `HERMES_MODEL` (default `hermes-agent`) in
  [`server/lib/env-config.mjs`](../../server/lib/env-config.mjs) + fields in `#/config`;
- `runHermes` in [`server/lib/openai.mjs`](../../server/lib/openai.mjs) riding the
  shared `runOpenAICompatible` client (Bearer auth, timeout, `cleanLlmMarkdown`);
- a dispatch branch in
  [`server/lib/llm-dispatch.mjs`](../../server/lib/llm-dispatch.mjs)
  (`runActiveProvider` / `providerAvailable`) **and** the mirror in `routes/llm.mjs`;
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

**Decision (resolved, v1.151.0):** the scoping spike confirmed the API Server is
OpenAI-compatible (base URL, Bearer auth, model ids, streaming all verified), so
**Shape A shipped** and Shape B was not needed. This section is retained to explain
the alternative had the contract turned out to be agent-runtime-only.

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
| In-app help §"Hermes & Telegram" ×17 + site surface | **shipped** (v1.147.0) |
| **Provider integration — Shape A** (OpenAI-compatible API Server) | **shipped** (v1.151.0) |
| Cloud-server deployment playbook (§2) | how-to guidance (not an app feature) |
| Telegram bridge (§3) | how-to guidance (not an app feature) |

The Phase 5 scoping spike is done: `hermes gateway` exposes an OpenAI-compatible
`POST /v1/chat/completions` (base `http://127.0.0.1:8642/v1`, Bearer
`API_SERVER_KEY`), so **Shape A** applied and shipped in v1.151.0 — set
`HERMES_API_KEY` in `#/config` and the ⚡ live eval runs through your local Hermes
gateway (last in the auto provider order). **Shape B** (a bespoke agent-runtime
relay) was not needed. The §2 cloud-deploy and §3 Telegram sections remain
how-to guidance for operators, not shipped app behaviour.

---

*See also:* [`docs/architecture/OVERVIEW.md`](../architecture/OVERVIEW.md) ·
[`docs/architecture/DATA-FLOWS.md`](../architecture/DATA-FLOWS.md) ·
[`docs/UX-ROADMAP.md`](../UX-ROADMAP.md) (Phase 5 / 5b) ·
the `hermes-bridge` skill (`.claude/skills/hermes-bridge/SKILL.md`).
