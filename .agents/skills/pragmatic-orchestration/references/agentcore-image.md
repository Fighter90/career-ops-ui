# AgentCore image boundary (qualification stage)

The image provides the existing Porch fleet runner through AgentCore's HTTP
contract on port 8080. `GET /ping` reports `Healthy` or `HealthyBusy`; `POST
/invocations` handles typed `ready`, `launch`, `control` and `reconcile` operations.
It reuses fleet reservations, request idempotency and native agent adapters.

This is the guest half of the provider, not automatic cloud overflow yet. No AWS
runtime, ECR repository, capacity provider, IAM policy or cloud resource is created
by building it. Controller lifecycle, passive cloud inventory, input/result object
exchange and unattended subscription bootstrap still require integration before
this can be enrolled in automatic placement.

## Build and inputs

Build context is this skill directory. Build only on an authorized remote Docker
host; use its existing resource admission and cgroup policy. The recipe is
`images/agentcore/Dockerfile`. The matching Dockerfile ignore file admits only
explicit source directories and the shipped example; user config, native auth,
repositories and caches are not copied. Do not override this with a broad COPY.

The development image includes OpenSSH client, rsync and the native C/C++ build
toolchain. The real project trial needed source transfer and native dependency
compilation; an overall successful package install had hidden an optional
`better-sqlite3` build failure when no compiler existed. These tools alone do not
qualify that dependency or deploy the shared Docker bridge. No SSH server,
Docker daemon, tailnet enrollment or access credential is configured by the image.

The qualification profile has Codex CLI 0.165.0 and its matching `codex-code-mode-host` installed side by side (official release assets checked
against their SHA-256 digests), Python 3.14, Node 24/npm, Git, jq and Chromium.
Native dependency versions and resolved base-image digests must be recorded for
a release. Chromium is not proof that a project's browser test suite works.
Porch's own canonical skill is installed by one symlink; no third-party or personal
skill bundle is implicitly installed. Curated project dependencies/skills remain
a separate versioned profile input.

Run as the nonroot image user with a prepared task checkout and a private fleet
configuration. `/work` is the logical workspace path. AgentCore Instances mounts
EBS volumes at `/mnt/<name>`, so derive an Instances profile that maps `/work` to
`/mnt/work` and prepares UID/GID 1000 ownership **during the image build**. Start
directly as `USER 1000:1000`; runtime `chown`, sudo and UID changes fail without
Linux capabilities. The native trial recipe in the repository's
`docs/benchmarks/2026-10-29-agentcore-native-trial/` demonstrates this packaging.
The configuration may be supplied by `PORCH_FLEET_CONFIG`; its default remains
`/work/fleet.json`. It must contain one local host whose
Porch path is the resolved executable under `/opt/porch`. Choose the existing exact profiles:
`codex` (GPT-6.1 Sol/high) or `codex-gpt-6.1-terra` (GPT-6.1 Terra/xhigh).
The guest does not support Claude in its current environment profile.

The volume's writable paths are `/work/porch` (coordination/runner history),
`/work/codex` (native Codex home), and configured task checkouts. Never bake the
native Codex home into an image or export it with task results. Do not share one
SQLite file across machines or mount the same mutable task checkout in two guests.

## Invocation protocol

The HTTP boundary accepts both Content-Length and chunked request bodies. Chunk
extensions and trailers are decoded before JSON parsing; an incomplete frame is
an explicit request error. AWS invocation can use chunked framing even when the
caller supplies a complete JSON byte string.

```json
{"protocol":1,"session_id":"porch-00000000-0000-0000-0000-000000000001","operation":"ready"}
```

The response echoes `session_id`, provides a random `boot_id`, and reports
`runner_ready` and `subscription_ready` separately. A healthy HTTP process does
not imply subscription readiness. `ready` calls the native Codex login-status
command and returns only a boolean, never the profile, token or full status text.
Every later request must name that boot. A process restart gives a different boot;
the caller must reconcile existing work, not replay the original launch.

```json
{
  "protocol":1,
  "session_id":"porch-00000000-0000-0000-0000-000000000001",
  "boot_id":"value-returned-by-ready",
  "operation":"launch",
  "body":{"request_id":"task-unique-id","agent":"codex","workspace":"task","prompt":"Task contract"}
}
```

Repeated identical launches with the same request id return the original
allocation. Changed task content under that id is rejected. Prompt content goes
through a private temporary input file, not the command line. The launch also
verifies native subscription login before sending a task. No paid API substitute
is selected when it is unavailable.

Control bodies contain `request_id`, `command` (`status`, `events`, `wait`, `steer`,
`cancel`), optional string `options`, and `guidance` for a steer. For example:

```json
{"request_id":"task-unique-id","command":"events","options":["--max-events","50"]}
```

Responses carry `exit_code` and the existing CLI's `stdout`, with only a boolean
indicating stderr presence. This preserves structured command results without
returning native stderr bodies. An invocation timeout returns an explicit unknown
outcome: use `reconcile` with the same identity. No blind retry or expiry frees it.

This HTTP service assumes AgentCore's authenticated invocation boundary. It must
not be exposed as a standalone public API. Local qualification binds loopback;
container port forwarding, if used on the dev host, must bind loopback as well.
`/ping` is a guest health request, not a passive cloud inventory operation: invoking
an AgentCore session may provision or wake it. Fleet status must not use invocation
as its passive load probe.

## Unattended authentication is still unqualified

The image contains no credentials and is initially not subscription-ready. A real
disposable-cloud pilot needs a supported bootstrap or a separate trusted Codex
subscription broker, following the ARAI pattern without using its production
service. Do not copy the Mac's credential files or claim an image-only deployment
solves authentication. Result archives must exclude the entire native auth home.

The built-in AWS command API is an alternative for deterministic operations, but
is not used to carry prompts here: it adds a shell-command encoding/streaming
contract. Reconsider it only if it demonstrably removes the typed runner boundary.

Sources checked 2026-10-29: [AWS HTTP contract](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-http-protocol-contract.html),
[AWS command execution](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-execute-command.html),
[Instances data lifecycle](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-instances-data-management.html),
and [Codex 0.165.0 release](https://github.com/openai/codex/releases/tag/rust-v0.165.0).

A native developer task on 2026-10-30 exposed an incomplete CLI installation: the
main executable could authenticate and talk to the model, but tool execution
failed without `codex-code-mode-host`. A version/login check alone cannot qualify
a coding environment. The recipe now verifies the matching host asset digest
and starts its help command during the build; a real edit/test task remains the
acceptance check.

Bootstrap is active work even before a delegate exists. A prepared entrypoint
creates `bootstrap-active` in the fleet state directory (the parent of its
`state_path`) before starting the HTTP guest. While it exists, `/ping` reports
`HealthyBusy`; the provisioning caller removes it after login, source staging
and dependency checks finish. Reboot does not mean those steps finished. The
marker is not a lease or a cleanup mechanism: the caller still owns bounded
provider cleanup independently of its laptop. Automatic cloud enrollment stays
unqualified until that lifecycle is integrated. The native pilot's first login
was interrupted when bootstrap was incorrectly reported as idle.
