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
 *     → {{t:key}} resolution             (views/help.js, ACTIVE locale — CAR-107)
 *     → UI.md()                          (SPA renderer, loaded from api.js)
 *     → drop <h1>                        (views/help.js keeps a single h1)
 *     → drop code/pre/script/style       (the checker's own exemption)
 *     → text                              (detached clone ⇒ textContent rules)
 *     → every key of i18n-dict.en.js must be absent
 *
 * The {{t:key}} step is part of the chain since CAR-107 (P2.1): the bundles
 * reference UI labels as placeholders and views/help.js substitutes them
 * through I18n.t before UI.md(). This gate mirrors that step with the same
 * locale mapping, so a placeholder resolved for the bundle's own locale is
 * what the checker's DOM clone would see.
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
import { stripGithubOnlyBlocks, substituteHelpPlaceholders } from '../server/lib/help-markdown.mjs';
import { htmlToText } from '../server/lib/html-to-text.mjs';
import { loadMd } from './helpers/ui-md.mjs';
import { loadI18n } from './helpers/i18n-vm.mjs';
import { renderedTextOutsideCode } from '../scripts/remote-qa/help-render-scan.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HELP_DIR = resolve(__dirname, '..', 'docs', 'help');

// Exact same key list the prod checker derives (prod-regression.mjs).
const KEYS = [...readFileSync(resolve(__dirname, '..', 'public/js/lib/locales/i18n-dict.en.js'), 'utf8')
  .matchAll(/^\s*'([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+)':/gm)].map((m) => m[1]);

const md = loadMd(); // self-probing: fails loudly if the api.js extraction mis-slices

// The real I18n module (assembled dict + locale switching) — the same
// substitution the #/help view applies. ko-KR.md ↔ SPA code `ko`, the one
// filename/code mismatch (routes/help.mjs FILE_ALIASES).
const I18N = loadI18n();
function langForFile(f) {
  const stem = f.replace(/\.md$/, '');
  return stem === 'ko-KR' ? 'ko' : stem;
}

/**
 * Reproduce the checker's view of a rendered help page via the shared
 * renderedTextOutsideCode() (one implementation with the CLI scan), plus the
 * TOC strings the help view derives from the <h2> headings.
 */
function checkerText(markdown, lang) {
  // CAR-107 (P2.1) — resolve {{t:key}} to the ACTIVE locale's label before
  // rendering, exactly as views/help.js does (unknown key keeps its raw
  // placeholder, which the key scan below then reports as a leak).
  I18N.setLang(lang);
  const resolved = substituteHelpPlaceholders(stripGithubOnlyBlocks(markdown), (key) => I18N.t(key, `{{t:${key}}}`));
  const html = md(resolved);
  const body = renderedTextOutsideCode(html, { dropH1: true }); // views/help.js strips the doc's own title
  // TOC: h2 text with the backtick/bold/italic fences dropped — exactly the
  // `plain` transform views/help.js applies to TOC labels. Code-span text
  // stays visible here (the TOC shows a cited key as plain text), so this is
  // the one place a key inside a heading still leaks.
  const toc = [...html.matchAll(/<h2>([\s\S]*?)<\/h2>/gi)]
    .map((m) => htmlToText(m[1]).replace(/`([^`]+)`/g, '$1'))
    .join('\n');
  return body + '\n' + toc;
}

const files = readdirSync(HELP_DIR).filter((f) => f.endsWith('.md')).sort();

test('help-rendered-keys: every bundle cites keys only inside code spans (prod raw-i18n-key scan, ×' + files.length + ')', () => {
  const failures = [];
  for (const f of files) {
    const text = checkerText(readFileSync(join(HELP_DIR, f), 'utf8'), langForFile(f));
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

// Positive control: the shared extractor must keep seeing the WHOLE text.
// A bundle's plain text is ~50–140 KB — if the extraction ever regresses to a
// capped pipeline (htmlToText's default DESCRIPTION_CAP is 4000) this fails
// before the main gate silently stops scanning the tail of every bundle.
test('help-rendered-keys: renderedTextOutsideCode removes code blocks structurally and is uncapped', () => {
  const html = [
    '<p>intro scan.title visible</p>',
    '<pre><code>pre.scan.title.hidden</code></pre>',
    '<code>code.scan.title.hidden</code>',
    '<script>script.scan.title.hidden</script>',
    '<h1>h1.scan.title.hidden</h1>',
    `<p>${'x'.repeat(5000)}</p>`,
    '<p>tail scan.title past-cap</p>',
  ].join('');
  const text = renderedTextOutsideCode(html);
  assert.ok(text.includes('intro scan.title visible'), 'text outside code blocks kept');
  assert.ok(text.includes('past-cap'), 'text past 4000 chars still scanned (uncapped pipeline)');
  assert.ok(!text.includes('pre.scan.title'), '<pre> interior removed (nested <code> included)');
  assert.ok(!text.includes('code.scan.title'), '<code> span removed');
  assert.ok(!text.includes('script.scan.title'), '<script> block removed');
  assert.ok(text.includes('h1.scan.title'), 'h1 kept by default (CLI view)');
  assert.ok(!renderedTextOutsideCode(html, { dropH1: true }).includes('h1.scan.title'),
    'dropH1 removes the title block (checker view)');
});
