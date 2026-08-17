# QA REGRESSION PROMPT — career-ops-ui **v1.209.0** (help documents the Outcome button; "Ask the docs" points to it)

**Fixed (docs).** The v1.207.0 **Outcome** button (record an application's final outcome from `#/tracker`) shipped *after* the v1.206 help pass, so §11 Tracker had 6 H3s and none covered it — and the floating **Ask the docs** assistant (grounded ONLY on `docs/help/<lang>.md`) confidently answered *"edit the Status directly"* instead of naming the button. **Docs-only + gate bump.**

- **Under test:** `package.json` **1.209.0**.

## §0 — Gates

```bash
npm test                                       # 2625, exit 0
node scripts/check-changelog-parity.mjs        # 16 non-EN at v1.209.0
# structure gates (both must be green at 119):
node --test tests/help-ru-config-section.test.mjs tests/locales-de-it-tr.test.mjs tests/canonical-docs-coverage.test.mjs
```

## §1 — Fix

Added a **"Record an outcome"** H3 at the end of §11 Tracker in **all 17** help bundles (`docs/help/*.md`). It walks the **Outcome** button: pick what happened (rejected / offer / hired / declined / ghosted / advanced) → **Preview** (shows *"Will set #N Company → State"*, writes nothing) → **Record outcome** (logs to the append-only outcome journal, archives the submitted CV + cover letter, syncs the row's canonical **Status**). It notes the tool is read-only until Record and needs the parent career-ops project (the button hides otherwise).

## §2 — Why the placement works

`routes/docs-assistant.mjs` grounds the assistant by splitting the guide into whole `##` sections (`splitSections`) and inlining the top-N by keyword overlap (`topSections`, 14 KB budget) — no per-section truncation. §11 Tracker's body is ~5.3 KB, so the whole section (now including the new H3) is inlined. Verified live against `POST /api/docs-assistant/ask {"question":"How do I record the outcome…"}`: §11 Tracker is the top-ranked section and the grounding prompt contains `### Record an outcome` + `click the **Outcome** button`.

## §3 — Gate

Each bundle is now **31 H2 / 119 H3** (was 118). Two count assertions bumped 118 → 119: `help-ru-config-section.test.mjs` (12 locales) and `locales-de-it-tr.test.mjs` (de/it/tr). H2 stays 31 (`canonical-docs-coverage.test.mjs` untouched). No new unit test needed — the existing parity gates enforce the ×17 addition.

## §4 — Sign-off

Suite **2625** green · CHANGELOG/README parity ×17 at v1.209.0 · docs-only, no code or behaviour change, no new dependency, no server/parent edits. Deploy: resumecraft.ru rsync of `docs/help/*.md` (help served live — **no restart**) + cvstart.org Pages version refresh.
