# QA REGRESSION PROMPT — career-ops-ui **v1.215.0** (OpenWorker coworker integration)

**Docs + site only — no app-code change.** Adds the OpenWorker coworker as a first-class, documented integration: a new help section the in-app AI assistant grounds on, an integration doc with the coworker-mechanism spec, and landing/README/wiki links to the standalone [`Fighter90/career-ops-coworker`](https://github.com/Fighter90/career-ops-coworker) repo.

- **Under test:** `package.json` **1.215.0**. Sources **82** (unchanged). Help **32 H2 / 121 H3** ×17.

## §0 — Gates

```bash
npm test                                                   # 2742, exit 0
node --test tests/help-ui.test.mjs tests/canonical-docs-coverage.test.mjs tests/help-ru-config-section.test.mjs tests/locales-de-it-tr.test.mjs   # H2 32 / H3 121 ×17
node scripts/check-changelog-parity.mjs                    # 16 non-EN at v1.215.0
```

## §1 — What changed (docs/site only)

- **Help §32 "Run it from OpenWorker" ×17** (`docs/help/<lang>.md`). Documents the coworker so the in-app **Ask the docs** assistant (`POST /api/docs-assistant/ask`) and the floating **DocsFab** button — both grounded on whole `##` help sections — can answer questions about it. H2 31→32, H3 119→121; the count gates were bumped in `help-ui`, `canonical-docs-coverage`, `help-ru-config-section`, and `locales-de-it-tr`.
- **`docs/integrations/openworker.md`** — integration guide + a "How the coworker mechanism works" spec (persona = frontmatter + system-prompt; the closed catalog `code_files/files/git/search/shell/todo`; connectors grant + `recommends ⊆ connectors`; snapshot install; approval-gating), verified against `andrewyng/openworker`.
- **Landing footer** (`site/src/components/Footer.astro`) — a "OpenWorker coworker" link (community column).
- **README ×17** — a "Run it from OpenWorker" section + the release banner/badges.
- **Wiki** — a new `OpenWorker-Coworker` page + Home `## Links` and Sidebar `Integrations` entries.

## §2 — Manual browser pass

1. `#/docs-assistant` (and the floating docs button on any page): ask *"how do I run this from OpenWorker?"* — the answer is grounded in help §32 (per locale).
2. cvstart.org footer shows the **OpenWorker coworker** link → `github.com/Fighter90/career-ops-coworker`.
3. Help guide (any locale) ends with **§32**; the section renders with its two subsections.

## §3 — Invariants / security

- No server route, no dependency, no CSP/SSRF/sanitizer change. `docs-assistant` grounding is unchanged (it just has one more section to retrieve). Parent read-only contract intact.

## §4 — Not changed / next

- **App-code untouched** — the coworker is a *separate repo*; nothing in `server/`/`public/` depends on it.
- **NEXT (queued, user-requested):** full LLM-provider roster in settings (OpenAI / Anthropic / Gemini / BytePlus Ark / Volcengine Ark / Inkling / GLM (Z.ai) / DeepSeek / Kimi / Qwen / MiniMax / Mistral / Grok — some already wired) + provider logos across the UI, patterned on `openworker`/`aisuite`. Its own release(s).

## §5 — Sign-off

Suite **2742** green · help **32 H2 / 121 H3** ×17 · §32 present in all 17 · changelog parity ×17 at v1.215.0 · README banner+badges ×17 · CONVENTIONS/PROJECT-CONTEXT/CLAUDE refreshed · `docs/integrations/openworker.md` (mechanism spec) · site footer link + rebuild (facts + help mirrors) + wiki page/links. Coworker repo `Fighter90/career-ops-coworker` published (17-lang, verified installable). Deploy: Pages (site/ + help changed); resumecraft + local need no server change (docs-only) — restart optional to serve the new help.
