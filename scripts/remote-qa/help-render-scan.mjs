#!/usr/bin/env node
/**
 * Local checker-equivalent for the prod "raw-i18n-key" finding on #/help.
 *
 * Renders every docs/help/<locale>.md through the exact production chain —
 * stripGithubOnlyBlocks() (server ingress) + UI.md() (SPA renderer, loaded
 * from public/js/api.js via tests/helpers/ui-md.mjs) — then applies the
 * exact prod-regression.mjs scan: drop <code>/<pre>/<script>/<style>,
 * read the text, and report every i18n key that appears as plain text
 * with ±60 characters of context.
 *
 *   node scripts/remote-qa/help-render-scan.mjs [locale …]   (default: all 19)
 *
 * Read-only; exits 1 when any key leaks. Kept outside tests/ (it is a
 * debugging aid, the gate lives in tests/help-rendered-keys.test.mjs).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripGithubOnlyBlocks } from '../../server/lib/help-markdown.mjs';
import { loadMd } from '../../tests/helpers/ui-md.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HELP_DIR = join(ROOT, 'docs', 'help');

const KEYS = [...readFileSync(join(ROOT, 'public/js/lib/locales/i18n-dict.en.js'), 'utf8')
  .matchAll(/^\s*'([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+)':/gm)].map((m) => m[1]);

const md = loadMd();

// Minimal DOM-enough extraction: the renderer emits well-formed tags by
// construction, so regex-based removal of code/pre/script/style + tag
// stripping is exact for key detection. A detached DOM clone has no layout,
// so innerText falls back to textContent — tags contribute nothing, which
// is precisely "remove every tag" (prod-regression.mjs's own fallback).

// Minimal DOM-enough parsing: the rendered help is flat HTML (headings,
// paragraphs, lists, tables, blockquotes). We only need element-boundary
// awareness for code/pre/script/style removal and text extraction, so a
// regex-based extractor over the renderer's own output is exact enough —
// the renderer emits well-formed tags by construction.
function stripAndExtract(html) {
  const cleaned = html
    .replace(/<(pre|script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<code\b[\s\S]*?<\/code>/gi, '');
  return cleaned
    .replace(/<[^>]+>/g, '') // detached clone ⇒ textContent: tags contribute nothing
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

const only = process.argv.slice(2);
const files = readdirSync(HELP_DIR).filter((f) => f.endsWith('.md'))
  .filter((f) => !only.length || only.some((l) => f.replace(/\.md$/, '').split('-')[0] === l));

let total = 0;
for (const f of files.sort()) {
  const raw = readFileSync(join(HELP_DIR, f), 'utf8');
  const text = stripAndExtract(md(stripGithubOnlyBlocks(raw)));
  const hits = [];
  for (const k of KEYS) {
    let idx = text.indexOf(k);
    while (idx !== -1) {
      hits.push({ key: k, ctx: text.slice(Math.max(0, idx - 60), idx + k.length + 60) });
      total += 1;
      idx = text.indexOf(k, idx + k.length);
    }
  }
  if (hits.length) {
    console.log(`\n=== ${f}: ${hits.length} leak(s) ===`);
    for (const h of hits) console.log(`  [${h.key}] …${h.ctx.replace(/\n/g, '⏎')}…`);
  }
}
console.log(total ? `\nTOTAL: ${total} leaked key occurrence(s)` : '\nCLEAN: 0 leaked keys');
process.exit(total ? 1 : 0);
