# OpenCode Go profiles

The model and variant snapshot was captured on 2026-10-30 from the [Go catalog](https://opencode.ai/inference/go/v1/models). Catalog entries and variants can change; verify the selected model in OpenCode 2 before use.
The 28 current tool-capable Go models have explicit profiles in `config.example.json`.
The [Go documentation](https://opencode.ai/v2/docs/console/go/) describes availability and workspace settings.

For each model ID below, the Porch profile is `opencode-go-<model-id>` and
the native OpenCode model is `opencode-go/<model-id>`. Profiles select the
highest reasoning variant exposed by the verified CLI; `none` means omit
the variant when that model has no selectable reasoning levels.
`OPENCODE_EFFORT` overrides the profile for one invocation.

| Model | Model ID | Default variant |
| --- | --- | --- |
| Beam Free | `beam-free` | `max` |
| Claude Haiku 5.5 | `claude-haiku-5-5` | `max` |
| DeepSeek V4 Pro | `deepseek-v4-pro` | `max` |
| DeepSeek V4.1 Flash | `deepseek-v4.1-flash` | `max` |
| Gemini 4 Argon | `gemini-4-argon` | `high` |
| GLM-5.2 | `glm-5.2` | `max` |
| GLM-5.3 | `glm-5.3` | `max` |
| GLM-5.3-Flash | `glm-5.3-flash` | `max` |
| GPT-5.6 Luna | `gpt-5.6-luna` | `max` |
| GPT-6 Luna | `gpt-6-luna` | `max` |
| Grok 4.7 | `grok-4.7` | `xhigh` |
| Hy3 | `hy3` | `high` |
| Hy4 preview | `hy4-preview` | `high` |
| Iceman Contributor Free | `iceman-contributor-free` | `none` |
| Kimi K2.7 Code | `kimi-k2.7-code` | `none` |
| Kimi K3 | `kimi-k3` | `max` |
| Kimi K3.1 Pro | `kimi-k3.1-pro` | `max` |
| LongCat-2.0 | `longcat-2.0` | `high` |
| MiMo-V2.6-Flash | `mimo-v2.6-flash` | `none` |
| MiMo-V2.6-Pro | `mimo-v2.6-pro` | `none` |
| MiniMax-M3 | `minimax-m3` | `thinking` |
| MiniMax M3.1 Flash | `minimax-m3.1-flash` | `max` |
| Muse Spark 1.2 Contributor | `muse-spark-1.2-contributor` | `xhigh` |
| Muse Spark 1.3 Contributor | `muse-spark-1.3-contributor` | `xhigh` |
| Qwen3.7 Plus | `qwen3.7-plus` | `max` |
| Qwen3.8 Flash | `qwen3.8-flash` | `xhigh` |
| Qwen3.8 Max | `qwen3.8-max` | `xhigh` |
| Step 5 Preview | `step-5-preview` | `high` |

## Usage

```bash
"$PORCH" review ask -a opencode-go-deepseek-v4.1-flash "Audit the implementation"
"$PORCH" delegate -a opencode-go-glm-5.3-flash --detach --name implement-task "Implement the task"
```

All newly added profiles are disabled in the default review pool and can be
selected explicitly with `-a`. The existing enabled Kimi K3 profile keeps its
prior setting. Earlier short profile names keep their existing mappings.

If you use `config.json` or `PORCH_CONFIG`, copy the desired profile entries
from `config.example.json` into that config. A user-local config takes precedence
over the example. Go workspace privacy and regional settings can restrict a
listed model; OpenCode reports those provider errors directly.

The public API supplies model IDs; the CLI supplies supported variants.
They are recorded separately because some CLI variants, such as MiniMax M3
`thinking` and LongCat-2.0 `high`, are not enumerated by the public API.
The offline catalog snapshot is in `scripts/tests/fixtures/opencode-go-models.json`.
Regression coverage checks catalog profiles, review/delegate argv, steerable
HTTP payloads and representative end-to-end CLI calls with fake backends.
