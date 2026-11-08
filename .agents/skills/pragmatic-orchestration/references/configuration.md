# Configuration and execution

## Prerequisites

- Python 3
- At least one supported harness: Codex CLI, OpenCode 2.2.6 or newer in the 2.x series, Claude Code, or native Grok Build
- Gemini CLI is optional and review-only
- Devin CLI is optional and opt-in: `devin` v3000.x on PATH, authenticated via `devin auth login`

Authentication stays with each harness.

## Agent profiles

Profiles live in `config.json`; set `PORCH_CONFIG` to use another file.

| Field | Purpose |
|---|---|
| `enabled` | Default participation in `review ask` and the basic review pool |
| `backend` | `codex-cli`, `claude-code`, `opencode`, `grok-build`, `gemini-cli`, or `devin-cli` |
| `model` | Backend model id |
| `role` | Analyst, lateral, or specialist role |
| `effort` | Backend reasoning effort/variant |
| `label` | Human-readable output label |
| `review_instructions` | Optional profile-specific instructions for non-raw review prompts |
| `supports_delegate` | Optional; set false for review-only profiles |

List effective profiles with:

```bash
"$PORCH" --list-agents
```

Non-empty environment values override profile model/effort for one invocation:

- `CODEX_MODEL`, `CODEX_EFFORT`
- `CLAUDE_MODEL`, `CLAUDE_EFFORT`
- `OPENCODE_MODEL`, `OPENCODE_EFFORT` (`none` omits the variant)
- `GROK_MODEL`, `GROK_EFFORT`
- `GEMINI_MODEL`
- `DEVIN_MODEL`; `PORCH_BIN_DEVIN` overrides the `devin` binary

The enabled `codex` profile uses `gpt-6.1-sol` at `high` effort, and the enabled
`codex-gpt-6-luna` profile uses `gpt-6-luna` at `low` effort.
The opt-in `codex-gpt-6.1-sol` profile selects the same GPT-6.1 Sol model and
`high` effort explicitly in review and delegate. If you maintain a user-local
`config.json` or `PORCH_CONFIG`, copy this profile from `config.example.json`
to make the new id available there; user configurations are not merged with
the shipped example. The model id is documented in the
[official Codex model guide](https://developers.openai.com/codex/models#gpt-6.1-sol).
The opt-in `codex-gpt-6.1-terra` profile uses `gpt-6.1-terra` at `xhigh`
effort for review and delegate. `CODEX_EFFORT` overrides this default.
It requires Codex CLI 0.159.0 or later; see the
[official OpenAI model guide](https://learn.chatgpt.com/docs/models).
Copy this profile into existing user-local configs to make the new id available.
The opt-in `codex-gpt-6-astra` profile retains `gpt-6-astra` at `high` effort. Astra accepts
`low`, `medium`, `high`, `xhigh`, and `max`; it does not accept `none`. The
default Claude Code profile, `claude-opus`, uses `claude-opus-5-5` at
`medium` effort. `claude-code` is a disabled alias with the same model and
effort; `claude-sonnet` remains available explicitly. The disabled-by-default
`claude-fable` profile uses `claude-fable-5-1` at `low` effort and
supports the same five effort levels. Start Fable 5.1 at `high` for the hardest
long-horizon work, or retain `low` when it is one reviewer in a larger pool.
The opt-in `opencode-go-gemini-4-argon-contributor` profile uses
`opencode-go/gemini-4-argon-contributor` with `high` effort for review and
delegate. Select it with `-a opencode-go-gemini-4-argon-contributor`.
The captured catalog exposes `low`, `medium`, and `high` variants; `OPENCODE_EFFORT`
overrides the default. Copy this profile into an existing user-local config
to use the new id. OpenCode Go lists this as Gemini 4 Argon **Contributor**:
prompts and completions may be used to train Google models, and it is not ZDR.
See the [Go catalog and privacy terms](https://dev.opencode.ai/v2/docs/console/go/).

The [current OpenCode Go profiles](opencode-go.md) cover all 28 tool-capable
models verified on 2026-10-30, including DeepSeek V4.1 Flash, DeepSeek V4 Pro,
GLM 5.3/Flash, Qwen 3.8 Max/Flash, Kimi K3.1 Pro and MiniMax M3.1 Flash.
Use `-a opencode-go-<model-id>` for an exact model. The new profiles are opt-in;
copy them from `config.example.json` when maintaining an existing local config.

The disabled-by-default `opencode-go-muse-spark-1.3-contributor` and
`opencode-go-deepseek-v4.1-flash` profiles use the OpenCode Go catalog at
their maximum effort (`xhigh` for Muse and `max` for DeepSeek). Select either
explicitly with `-a`; keeping them disabled avoids changing the default review
pool. Muse supports `minimal`, `low`, `medium`, `high`, and `xhigh`; DeepSeek
supports `low`, `high`, and `max`. OpenCode Go's
privacy terms state that Muse Spark Contributor prompts and completions may be
used for model training, the service is not zero-data-retention, and availability
is region-limited. Check the current OpenCode Go terms before reviewing sensitive
repositories because catalog and privacy terms can change.

The disabled-by-default `devin` profile uses Devin CLI's `swe-2-flash-high` model (SWE-2 Flash;
`swe-2-flash-medium`, `swe-2-flash-max` and the `swe-2-*` family also work —
see `devin models`);
Devin versions effort into the model id, so there is no effort override. Both
one-shot and steerable paths run over `devin acp` (JSON-RPC 2.0 NDJSON on
stdio) — print mode `devin -p` is not used because a denied or
confirmation-required tool call silently cancels the session without final
text. Review runs `devin acp --agent-type review`, an agent with no write/edit
tools; yolo delegate runs the default agent type under `session/set_mode
bypass`. The helper strips inherited `ACP_BACKEND` from the child environment.

The opt-in `devin-gemini-4-argon` profile selects Gemini 4 Argon with `high`
effort for review and delegate through the same ACP paths. Its exact Devin model
id is `gemini-4-argon-high`; do not use the OpenCode Go Contributor id here.
Verified with `devin models list` on CLI 3000.11.92, which also lists
`gemini-4-argon-low` and `gemini-4-argon-medium`. Use `DEVIN_MODEL` with an
exact model id to override it; there is no separate Devin effort flag.
Copy this profile into existing user-local configs to select the new id.

## Shell-safe prompts

Prefer `--prompt-file`, stdin, or a single-quoted heredoc for prompts containing backticks, `$`, `!`, or quotes. Double-quoted positional prompts are shell-expanded and may accidentally execute substitutions or leave a backend waiting on stdin.

```bash
"$PORCH" review ask --prompt-file prompt.md
"$PORCH" review ask "$(cat <<'EOF'
Explain `foo` and $PATH handling.
EOF
)"
```

The shell-interpolation warning applies only to positional prompts that still contain backticks or `$()`; file/stdin content is not warned.

Prompt sources are selected explicitly, independently of their contents. An
empty or whitespace-only positional prompt or prompt file is a usage error;
it never switches to inherited stdin. Do not combine a positional prompt with
`--prompt-file`. Stdin supplies the prompt only when neither source is selected.
This applies to review, delegate, and steering guidance. File-based backend
transports receive closed stdin; stream-based transports receive the staged
prompt file. The internal prompt builders do not append ambient stdin.
File paths are read literally, including a file named `-`; file-reading tools
must not reinterpret such a path as an instruction to read stdin.

## Environment variables

| Variable | Purpose |
|---|---|
| `PORCH_CONFIG` | Alternate profile configuration |
| `PORCH_AGENTS`, `PORCH_EXCLUDE` | Default inclusion/exclusion selection |
| `PORCH_PROGRESS` | Review progress: `full`, `compact`, or `none` |
| `PORCH_OUTPUT_DIR`, `PORCH_RUN_DIR` | Artifact locations |
| `PORCH_SAVE_OUTPUTS` | Disable ordinary archival with `0`; steerable service artifacts remain |
| `PORCH_STEER_DIR` | Steerable registry; reuse the same value for every control command |
| `PORCH_MAX_PARALLEL` | Fan-out concurrency; `0` means unlimited/default |
| `PORCH_DEBUG_EVENTS*` | Opt-in bounded event tape and its path/record/byte limits |
| `GEMINI_API_KEY` | Gemini CLI authentication when required |

Porch imposes no execution deadline in any mode. Provider context/output
limits and managed harness settings still apply.

# Quota inspection

Use the read-only quota command to make scheduling decisions without starting a
review or delegate turn:

```bash
"$PORCH" quota [all|codex|grok]
```

The output is a versioned JSON envelope. Codex is queried through
`account/rateLimits/read` on `codex app-server`; this does not consume an
available reset credit. Grok is queried through the official `/usage` command
in a temporary tmux session on `grok-aws`. Override the safe SSH alias with
`PORCH_GROK_QUOTA_SSH_HOST` and the absolute remote working directory with
`PORCH_GROK_QUOTA_CWD`.

When both providers are requested, one failure does not discard the successful
result. Exit `0` means all requested providers succeeded, `2` means partial
success, and `3` means all requested providers failed.

Current model IDs: `gpt-6.1-sol`, [GPT-6 Luna](https://openai.com/index/introducing-gpt-6-sol-and-luna/) and [Grok 4.7](https://docs.x.ai/developers/models/grok-4.7). The default native `grok` profile uses `grok-4.7` at `high` effort. Existing user-local `config.json` files and environment overrides retain precedence; update them explicitly to adopt these defaults.
