# Two-pager: live AI auto-fill + Preview + PDF/DOCX/Markdown export (v1.100.0)

**Status:** Shipped · **Version:** 1.100.0 · **Date:** 2026-07-05

## Problem

The two-pager (`#/two-pager`, v1.89.0) captures what the candidate actually wants
from their next role, and it is inlined into every evaluation and powers the `◎`
fit badge on scan. But two gaps remained:

1. **No live auto-fill.** The "AI fill assistant" only ever built a prompt and
   showed it in a modal — the user had to run it in another tool and paste the
   YAML back by hand. The user explicitly asked for the assistant to *fill the
   fields itself from the CV*.
2. **No way to take the two-pager out of the app.** It could be saved to
   `config/two-pager.yml` but not viewed as a document or exported to share with a
   coach/recruiter. The user asked to **view** the two pages and **export to PDF
   and DOCX**.

## Solution

### Server

- **`server/lib/docx.mjs`** (new) — a dependency-free Office Open XML `.docx`
  writer. `buildDocx(title, blocks)` emits a DEFLATE ZIP of the four OOXML parts
  Word/Google Docs need (`[Content_Types].xml`, `_rels/.rels`,
  `word/document.xml`, `word/_rels/document.xml.rels`) with a CRC-32 per entry.
  `markdownToBlocks(md)` maps lightweight Markdown (headings, bullets, paragraphs)
  to blocks. No new runtime dependency — deps stay `express` + `js-yaml`.
- **`server/lib/routes/export.mjs`** (new, 26th route module) —
  `POST /api/export/docx {title?, markdown}` → a `.docx` download. Stateless,
  bounded to 200 KB, no writes / no LLM / no user-URL fetch. The Markdown is a body
  the client already assembled and reviewed; it never touches cv.md/profile/disk.
- **`server/lib/routes/two-pager.mjs`** (extended) — `POST /api/two-pager/draft`
  now accepts `{run: true}`. With a provider configured it runs the shared cascade
  (`runActiveProvider`), and the returned YAML is parsed and coerced back into the
  bounded two-pager shape by `parseYamlFields` (strip ```` ```yaml ```` fences →
  `yaml.load` → `normalizeTwoPager`; unknown keys dropped, arrays/strings capped).
  `{run:false}` / no provider → the manual prompt, exactly as before.

### Client

- **`public/js/lib/report-export.js`** — new `saveDocx(md, title, button)` POSTs
  to `/api/export/docx` and downloads the blob; a **Save as DOCX** button was added
  to the shared `actionsBar`, so the market report, career plan, and career
  orientation reports all gain DOCX export for free.
- **`public/js/views/two-pager.js`** — the field editors gained `.set()`; the
  **✨ AI fill assistant** button now runs live and applies the returned fields to
  the form (manual-prompt modal as fallback), and a new **👁 Preview & export**
  button renders the two-pager as Markdown in a modal with the MD/PDF/DOCX/Copy bar.

## Invariants held

- **Source of truth.** Auto-fill reads only `bundleProjectContext` (cv.md +
  profile + memory + two-pager) — nothing invented; the user reviews and Saves.
- **No new dependency.** The `.docx` writer is hand-rolled on `node:zlib`.
- **Security envelope.** Export route does no writes, no LLM, no URL fetch, and is
  size-bounded; two-pager write path unchanged (explicit Save only).

## Tests

`tests/export-routes.test.mjs` — valid ZIP/OOXML output + Word content-type,
empty-input 400, 4-part package + XML-escaping, YAML-fence parsing and
null-on-garbage for `parseYamlFields`. 4 new i18n keys ×16
(`export.saveDocx`, `twoPager.preview`, `twoPager.aiFilling`, `twoPager.aiFilled`).
