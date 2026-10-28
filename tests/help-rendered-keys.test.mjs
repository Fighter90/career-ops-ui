/**
 * Rendered-key gate for the help bundles (#/help).
 *
 * The prod remote-QA checker (scripts/remote-qa/prod-regression.mjs) visits
 * #/help in every locale, strips <code>/<pre> from a DOM clone, and fails on
 * any i18n key that shows up as plain text — a key is only allowed to appear
 * on screen inside a citation span. This gate runs the SAME scan locally,
 * against the SAME production render chain, without a browser:
 *
 *   docs/help/<locale>.md
 *     → stripGithubOnlyBlocks()          (server ingress, routes/help.mjs)
 *     → UI.md()                          (SPA renderer, loaded from api.js)
 *     → drop <h1>                        (views/help.js keeps a single h1)
 *     → drop code/pre/script/style       (the checker's own exemption)
 *     → text                              (detached clone ⇒ textContent rules)
 *     → every key of i18n-dict.en.js must be absent
 *
 * The renderer is line-oriented: its list handler consumes only `- `/`* `
 * lines, and a wrapped continuation line dangling after a bullet is emitted
 * as RAW text (no inline() pass — the paragraph pass-through sees the chunk
 * already starting with the emitted `<ul>`). A key cited in such a line
 * reaches the page with its backticks literal. The fix lives in the bundles
 * (unwrap those bullets onto one line, the convention of every older
 * section); this gate fails if the drift ever comes back.
 *
 * Also scanned, mirroring the DOM the checker actually reads: the TOC the
 * help view builds copies every <h2>'s textContent with backticks/bold
 * stripped, so a key cited inside a heading would leak through the TOC as
 * plain text even though the heading itself renders it as <code>.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripGithubOnlyBlocks } from '../server/lib/help-markdown.mjs';
import { loadMd } from './helpers/ui-md.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HELP_DIR = resolve(__dirname, '..', 'docs', 'help');

// Exact same key list the prod checker derives (prod-regression.mjs).
const KEYS = [...readFileSync(resolve(__dirname, '..', 'public/js/lib/locales/i18n-dict.en.js'), 'utf8')
  .matchAll(/^\s*'([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+)':/gm)].map((m) => m[1]);

const md = loadMd(); // self-probing: fails loudly if the api.js extraction mis-slices

/**
 * Reproduce the checker's view of a rendered help page: element-free text
 * (a detached clone has no layout, so innerText falls back to textContent —
 * tags contribute nothing) after code/pre/script/style are removed, plus the
 * TOC strings the help view derives from the <h2> headings.
 */
function checkerText(markdown) {
  const html = md(stripGithubOnlyBlocks(markdown));
  const body = html
    .replace(/<h1>[\s\S]*?<\/h1>/gi, '') // views/help.js strips the doc's own title
    .replace(/<(pre|script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<code\b[\s\S]*?<\/code>/gi, '');
  // TOC: h2 textContent with the backtick/bold/italic fences dropped —
  // exactly the `plain` transform views/help.js applies to TOC labels.
  const toc = [...html.matchAll(/<h2>([\s\S]*?)<\/h2>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/`([^`]+)`/g, '$1'))
    .join('\n');
  return (body + '\n' + toc)
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

const files = readdirSync(HELP_DIR).filter((f) => f.endsWith('.md')).sort();

test('help-rendered-keys: every bundle cites keys only inside code spans (prod raw-i18n-key scan, ×' + files.length + ')', () => {
  const failures = [];
  for (const f of files) {
    const text = checkerText(readFileSync(join(HELP_DIR, f), 'utf8'));
    const leaked = [];
    for (const k of KEYS) {
      const at = text.indexOf(k);
      if (at !== -1) {
        leaked.push(`    ${k}  …${text.slice(Math.max(0, at - 60), at + k.length + 60).replace(/\n/g, '⏎')}…`);
      }
    }
    if (leaked.length) failures.push(`  ${f}\n${leaked.slice(0, 6).join('\n')}${leaked.length > 6 ? `\n    … +${leaked.length - 6} more` : ''}`);
  }
  assert.equal(failures.length, 0,
    `raw i18n keys visible outside code spans (the prod raw-i18n-key finding):\n${failures.join('\n')}`);
});
