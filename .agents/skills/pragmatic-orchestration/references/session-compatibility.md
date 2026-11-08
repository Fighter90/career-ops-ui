# Session format compatibility

This matrix records the reader's scope and evidence, not a promise that future
agent versions retain a private storage format. `sessions roots` reports the
reader's harness-level evidence (`verified` or `spec`); a verified harness does
not imply that every storage variant has been verified on a live installation.

| Source / storage | Coverage | Evidence and limits (2026-10-29) |
|---|---|---|
| Codex JSONL rollouts, state, catalog, summaries, history | Conversation, metadata, lineage | Existing reader previously verified against local installations. Cloud catalog entries may not have local transcripts. |
| Codex `.jsonl.zst` | Compressed rollouts | Synthetic compressed and corrupt fixtures; needs Python 3.14+ standard-library Zstandard. Missing decoder or corrupt data returns partial. |
| OpenCode 2 SQLite | Conversation, reasoning, tools, shell, metadata | Inline and row-based fixtures; assistant text verified against an isolated OpenCode 2.2.6 session. |
| Cursor VS Code SQLite | Composer and bubbles | Fixture-verified; installed version coverage is not established. |
| Cursor ACP SQLite/protobuf | User and assistant text | Synthetic graph and broken-reference fixtures. Tool, shell and reasoning nodes are explicitly reported as unsupported; not live-verified. |
| Hermes `state.db` | Conversation, reasoning and tools | Synthetic SQLite fixture and local schema inspection; local database had no sessions. Legacy JSON exports are not covered. |
| Claude Code; Claude Desktop/Cowork; Grok; Devin; Gemini; Porch | Native stores described in [session history](session-history.md) | Existing adapters previously verified locally; the classification and source-layer caveats there apply. |
| Qwen Code; Kimi Code; OMP | Native stores described in [session history](session-history.md) | Fixture/spec evidence; live version coverage is not established. |

When updating a reader, record the source application version and date tested,
add sanitized fixtures for schema changes and partial/corrupt inputs, and check
that `roots`, `list`, `grep`, and `show` expose missing or unsupported data.
Do not copy real transcripts or credentials into fixtures. Test the supported
runtime/platform combinations separately before claiming they were verified.

Format research was informed by [Agent Sessions](https://github.com/jazzyalex/agent-sessions),
particularly its documented Codex archive, OpenCode migration, Cursor ACP and
Hermes support. Its [source verification matrix](https://github.com/jazzyalex/agent-sessions/blob/v6.2/STEWARDS.md)
is useful evidence about its own app, not proof that this reader supports the
same versions or surfaces.
