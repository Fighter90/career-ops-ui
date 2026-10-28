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
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripGithubOnlyBlocks } from '../../server/lib/help-markdown.mjs';
import { htmlToText } from '../../server/lib/html-to-text.mjs';
import { loadMd } from '../../tests/helpers/ui-md.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HELP_DIR = join(ROOT, 'docs', 'help');

// Minimal DOM-enough parsing: the rendered help is flat HTML (headings,
// paragraphs, lists, tables, blockquotes) and the renderer emits well-formed
// tag pairs by construction, so splitting on the paired boundary tags is an
// exact block removal — the even-index segments are the between-block text,
// the odd indexes are block interiors. <pre>/<script>/<style> are dropped
// first so a nested <code> inside them cannot leak its body, then standalone
// <code> spans go. No hand-rolled entity handling anywhere: keys are ASCII
// without &/</>, so entity decoding cannot change what the substring search
// finds; the remaining tags are stripped by the scanner's own quote-aware
// htmlToText pipeline, uncapped — a bundle's plain text is ~50–140 KB and the
// gate must see all of it.
const H1_BOUNDARY_RE = /<\/?h1\b[^>]*>/gi;
const BLOCK_BOUNDARY_RE = /<\/?(?:pre|script|style)\b[^>]*>/gi;
const CODE_BOUNDARY_RE = /<\/?code\b[^>]*>/gi;

/**
 * The checker's view of a rendered help page: plain text outside code/pre/
 * script/style blocks. Shared with tests/help-rendered-keys.test.mjs — one
 * implementation, two consumers.
 * @param {string} html
 * @param {{ dropH1?: boolean }} [opts] — the help view strips the doc's own
 *   <h1> title before scanning; the CLI keeps it (its bundles carry none).
 * @returns {string}
 */
export function renderedTextOutsideCode(html, { dropH1 = false } = {}) {
  let body = html;
  if (dropH1) body = body.split(H1_BOUNDARY_RE).filter((_, i) => i % 2 === 0).join('');
  body = body.split(BLOCK_BOUNDARY_RE).filter((_, i) => i % 2 === 0).join('');
  body = body.split(CODE_BOUNDARY_RE).filter((_, i) => i % 2 === 0).join('');
  return htmlToText(body, { cap: Infinity });
}

function main() {
  const KEYS = [...readFileSync(join(ROOT, 'public/js/lib/locales/i18n-dict.en.js'), 'utf8')
    .matchAll(/^\s*'([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+)':/gm)].map((m) => m[1]);

  const md = loadMd();
  const only = process.argv.slice(2);
  const files = readdirSync(HELP_DIR).filter((f) => f.endsWith('.md'))
    .filter((f) => !only.length || only.some((l) => f.replace(/\.md$/, '').split('-')[0] === l));

  let total = 0;
  for (const f of files.sort()) {
    const raw = readFileSync(join(HELP_DIR, f), 'utf8');
    const text = renderedTextOutsideCode(md(stripGithubOnlyBlocks(raw)));
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
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
