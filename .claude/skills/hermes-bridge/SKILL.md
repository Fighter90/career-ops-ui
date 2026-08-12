---
name: hermes-bridge
description: Deploy career-ops-ui to a cloud server and/or bridge it to Telegram through a Nous Research Hermes agent. Walks the documented steps, checks prerequisites (keys, endpoint reachability via the SSRF-safe path, Node version), and never writes secrets to disk or logs. Trigger when the user says "connect career-ops to Telegram", "Hermes bridge", "deploy career-ops to a cloud box", "wire the pipeline to Telegram via Hermes", or asks how to run the UI on a server.
---

# hermes-bridge — cloud deploy + Telegram-via-Hermes

**Single source of truth:** [`docs/integrations/HERMES.md`](../../../docs/integrations/HERMES.md).
This skill *operationalizes* that guide — it does not restate it. If the two ever
disagree, the doc wins; fix the skill to match. Read the doc first, then walk the
steps below.

> **Status (v1.151.0): the LLM-provider path — Shape A — is WIRED.** Hermes's
> `hermes gateway` exposes an OpenAI-compatible `POST /v1/chat/completions`, so
> career-ops-ui already integrates it as a provider: set `HERMES_API_KEY` (+
> optionally `HERMES_BASE_URL`, `HERMES_MODEL`) in `#/config`. What this skill
> still *does* is the operator how-to: (a) deploy the existing UI to a cloud box
> and (b) prepare the Telegram-via-Hermes bridge — neither is a shipped app
> feature. It must still **never** route a secret to disk/log/Telegram or weaken a
> security header.

## Non-negotiable guardrails (apply to every step)

1. **Secrets never touch disk or logs.** Provider keys and the Telegram bot token
   go in the parent `.env` (gitignored) or Hermes's own config. Do not echo them,
   do not write them into a note, do not paste them into a commit.
2. **The parent career-ops project is read-only** except the app's existing
   user-action write-through. This skill deploys the *viewer*; it does not edit
   `../cv.md`, `../config/`, `../reports/`, etc.
3. **Reachability checks use the SSRF-safe path only.** To test whether a Hermes /
   Nous Portal endpoint is reachable, go through `isValidJobUrl()` + `safeGet`
   (the same guard the app uses) — never a raw `fetch`/`curl` to an
   unvalidated user-supplied URL, and never to loopback or `file://`.
4. **The security envelope survives the move off `127.0.0.1`** — CSP (no
   `unsafe-inline`/`unsafe-eval`, `frame-ancestors 'none'`), the SSRF guard, the
   `stripDangerousMarkdown()` / `UI.md()` markdown boundary, and no-secrets-in-logs
   all stay intact. Do not relax a header to make remote deployment easier.

## Step 0 — The provider is already wired (Shape A, v1.151.0)

The scoping spike is done: Hermes's API Server (`hermes gateway`) is
OpenAI-compatible (`POST /v1/chat/completions` at `http://127.0.0.1:8642/v1`,
Bearer `API_SERVER_KEY`, streaming, `GET /v1/models`), so **Shape A shipped** —
career-ops-ui reaches it via the shared `runOpenAICompatible` client. To use it,
the user just sets `HERMES_API_KEY` in `#/config` and starts `hermes gateway`; no
new code is needed. This skill's job from here is the deployment + Telegram
how-to below. (Shape B — a bespoke agent-runtime relay — was not needed.)

## Step 1 — Prerequisite check (deployment)

Verify, and report any gap instead of proceeding:

- **Node ≥ 18** on the target box (`node -v`).
- Parent `career-ops` present with this repo at `career-ops/web-ui/`.
- Provider key(s) in the parent `.env` (presence only — never print the value).
- The app boots and `/api/health` is green on loopback *before* exposing it.

## Step 2 — Cloud deploy (per HERMES.md §2)

Walk the user through: bind to loopback + reverse proxy (nginx/Caddy) terminating
HTTPS → `127.0.0.1:4317`; a systemd/pm2 unit under a non-root user with
`Restart=on-failure`; and — only if `HOST=0.0.0.0` is required on a container
network — confirm the rate-limit / SSRF / path-sanitize hardening (a no-op on
loopback) is active. Never hand the user a config that exposes `0.0.0.0` to the
public internet directly.

## Step 3 — Telegram-via-Hermes (per HERMES.md §3)

Stand up the Hermes agent, connect its Telegram channel with a `@BotFather` token
that lives in **Hermes's** config (career-ops-ui never sees it). Pick the bridge
direction — push (career-ops-ui → Hermes → Telegram) or tool-call (Hermes calls a
read-only UI endpoint) — and apply the §3.2 **"what NOT to expose"** list: no CV
text, no salary numbers, no raw report bodies, no keys, no internal URLs. Send the
minimum useful summary + a link the authenticated user opens themselves.

## Step 4 — Honesty check before you finish

Confirm you did **not**: weaken a security header, expose `0.0.0.0` directly to
the internet, or route a secret to disk/log/Telegram. If the user only wanted the
LLM-provider integration, that already shipped (Shape A) — point them at
`#/config` (`HERMES_API_KEY`) and `docs/integrations/HERMES.md`.
