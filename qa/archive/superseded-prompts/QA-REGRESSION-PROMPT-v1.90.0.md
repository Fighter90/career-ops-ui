# QA REGRESSION PROMPT — career-ops-ui **v1.90.0** (Epic 15: Mock Interview 2.0)

Delta-focused regression for the mock-interview feature. Pairs with `qa/QA-REGRESSION-PROMPT.md`.

- **Under test:** `package.json` **1.90.0**. **Server:** `npm start` → `http://127.0.0.1:4317`.

## §0 — Gates

```bash
npm test                                       # full suite (≥1616 cases; new: interview-routes)
node --test tests/interview-routes.test.mjs    # normalizeHistory + buildInterviewPrompt + turn/save/list/delete + traversal
node --test tests/i18n-coverage.test.mjs       # 30 new keys ×16 locales, zero missing
node tools/i18n-audit.mjs                       # clean
node scripts/check-changelog-parity.mjs         # all 15 locales at v1.90.0
```

## §1 — What changed

1. **New `#/mock-interview` page** (nav: Interview prep → Mock interview 🎤). Turn-by-turn rehearsal:
   - Enter a **role** (+ optional **company** / **JD**) → **Start interview**. The interviewer opens with one focused question.
   - Type an answer → **Send answer**. Reply carries **### Feedback** (STAR+R strengths/gaps), **### Score** (`N/5`), **### Next question**.
   - **Save transcript** → `POST /api/mock-interview/save` → writes `interview-prep/mock-{company}-{role}-{date}.md` in the **parent** user layer. The **Saved sessions** list opens/deletes them.
   - **New interview** resets to the setup form.

2. **Live vs manual.** With a provider key, `POST /api/mock-interview/turn { run:true }` runs live via the shared cascade (`server/lib/llm-dispatch.mjs`: Anthropic → Gemini → OpenAI → Qwen → OpenRouter → GitHub Models). With **no** key, the endpoint returns `{ mode:'manual', prompt }` and the SPA shows a copy-paste modal — **no fabricated answer** is ever rendered.

3. **Grounding.** The turn prompt inlines `cv.md`, `config/profile.yml`, `config/two-pager.yml`, and `interview-prep/story-bank.md` (new `PATHS.storyBank`, via `bundleProjectContext({ extraFiles })`). Verify the story bank shows up in the prompt: `tests/interview-routes.test.mjs::"POST /turn with no key returns an honest manual prompt"`.

## §2 — Contract & security invariants

- **Writes only on explicit Save.** `/turn` and the GET listing never write; `/save` is the only writer, into the user layer. Off-limits parent files untouched.
- **Path-traversal safe.** `GET`/`DELETE /api/mock-interview/sessions/:name` run `sanitizePathName` and require the `mock-…​.md` prefix/suffix; `../../etc/passwd` → 400.
- **JD sanitized.** A supplied JD goes through `sanitizeJobDescription` (same ingress guard as `/api/evaluate`).
- **Bounded input.** `normalizeHistory` caps history to 40 turns × 6000 chars, coerces unknown speakers to `interviewer`, drops junk.
- **CSP-safe view.** `mock-interview.js` uses `addEventListener` + `UI.el`; interviewer markdown is rendered through `UI.md()` (the XSS boundary), the manual prompt through a `readonly` textarea `.value`.
- **CodeQL `js/missing-rate-limiting`** on `/turn` is guarded by `llmRateLimit`; if flagged, it is the known false positive — **dismiss**, don't weaken.

## §3 — i18n

30 new keys (`nav.mockInterview`, `mock.*`) present + translated in all **16** locales. Switch locale: nav item, setup labels/placeholders, buttons, bubbles ("You"/"Interviewer"), and saved-session controls read in-language. Arabic renders RTL.

## §4 — Sign-off

All §0 gates green · full turn loop works (opening question → answer → feedback+score+follow-up) · manual fallback shows a real prompt with no invented answer · save/list/open/delete round-trips into `interview-prep/` · traversal blocked · 30 keys ×16 locales · CSP/SSRF/parent-write invariants intact.
