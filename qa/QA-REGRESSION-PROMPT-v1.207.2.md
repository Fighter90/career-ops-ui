# QA REGRESSION PROMPT — career-ops-ui **v1.207.2** (fix: unwrap a whole-document ```markdown fence)

**Fixed.** `career-plan/generate` and `orientation/generate` occasionally returned their ENTIRE brief wrapped in a ```markdown … ``` code fence (model whim), so `UI.md` rendered a monospace code dump instead of a formatted plan. The shared LLM-declutter step now unwraps that whole-document fence. Found by the E2E-BROWSER-v1.207.1 run (NEW-1, MEDIUM).

- **Under test:** `package.json` **1.207.2**.

## §0 — Gates

```bash
npm test                                     # 2621, exit 0
node --test tests/llm-output.test.mjs        # 11 subtests (+3)
node scripts/check-changelog-parity.mjs      # 16 non-EN at v1.207.2
```

## §1 — The fix (`server/lib/llm-output.mjs::cleanLlmMarkdown`)

After the existing scaffold-strip + `.trim()`, a final step unwraps a whole-document markdown fence:

```
/^```(?:markdown|md)[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/i
```

- **Unwraps** only when the fence wraps the **entire** answer AND the language is explicitly `markdown`/`md`.
- **Leaves intact:** a real `python` / `js` / other-language fence, a **bare** ` ``` ` full-document block (could be genuine output), and a `markdown` block that is NOT the whole document (prose follows).
- **Inner code blocks survive:** the non-greedy middle still reaches the FINAL fence, so ```` ```js … ``` ```` inside the wrapped answer is preserved.
- **Idempotent:** the unwrapped result no longer starts with a fence.
- **Boundary discipline:** the fix is in `cleanLlmMarkdown` (declutter), NOT in `UI.md` (the client XSS boundary) — those responsibilities stay separate (`cleanLlmMarkdown` is not a sanitizer).

Applied to every route that already runs `cleanLlmMarkdown`: `career-plan`, `orientation`, `market`, `networking`, `cv-studio`, `interview`, `docs-assistant`, `llm` (evaluate/deep).

## §2 — Verify

- `POST /api/career-plan/generate {run:true}` / `POST /api/orientation/generate` with a model that fences its output → the returned `markdown` starts with `#`, not ```` ``` ````; `UI.md` renders headings/lists/bold, not a monospace block.
- Unit: `unwraps a whole-document ```markdown / ```md fence`; `preserves INNER code blocks`; `does NOT unwrap a real ```python / ```js / bare-``` code answer`.

## §3 — Out of scope (reported, not fixed)

**NEW-2 (LOW)** — the SPA has horizontal overflow below ~500px (`.topbar-actions`, and separately `#/help` content). The app is a **desktop local-tab tool**; the overflow is multi-source and no spec promises a mobile app layout. Not addressed here — a proper responsive pass would be its own effort.

## §4 — Sign-off

Suite **2621** green (+3) · CHANGELOG parity ×17 at v1.207.2 · README badge+banner ×17 · one shared-helper fix, no new dependency, no parent edits. Server-code change → resumecraft.ru rsynced + restarted (footer → 1.207.2).
