/**
 * UI.md() list continuation absorption (public/js/api.js).
 *
 * The list handler only consumed consecutive `- `/`* ` lines, so an
 * indented continuation line after a bullet fell OUT of the emitted
 * `<ul>` and the paragraph pass skipped the chunk (it starts with the
 * emitted `<ul>`) — the continuation leaked as raw prose with literal
 * `**`/backtick markers. ~95 such dangling runs per locale in docs/help.
 *
 * Fix (list-handler absorption): a continuation line (leading whitespace,
 * not a new block — not `#`, not `[-*] ` bullet, not a CB<n> fence
 * placeholder, not empty) joins the previous `<li>` as `<br/>`-joined
 * text. Regular / nested / numbered lists, fences and headings after a
 * list keep their existing rendering.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMd } from './helpers/ui-md.mjs';

const md = loadMd();

test('(a) continuation line after a bullet is absorbed into the <li>', () => {
  const out = md('- пункт один\n  продолжение пункта');
  assert.equal(out, '<ul><li>пункт один<br/>продолжение пункта</li></ul>');
});

test('(a) continuation markers render — no literal ** / backticks leak', () => {
  // the real docs/help shape: multi-line continuation with emphasis + code
  const out = md(
    '- **Forgetting the `meta` export.** Since v1.69.0 the `meta` block is the\n' +
    '  *only* thing that registers a source.\n' +
    '- next bullet'
  );
  assert.match(out, /<em>only<\/em>/, 'italic in the continuation must render');
  assert.match(out, /<code>meta<\/code>/);
  assert.doesNotMatch(out, /\*only\*/, 'no literal *only* leak');
  assert.doesNotMatch(out, /<\/ul>\n[ \t]+\S/, 'no raw text run right after </ul>');
  assert.match(out, /<li>next bullet<\/li>/, 'the following bullet still becomes its own item');
});

test('(a) multi-line continuation joins with <br/> and inline() runs per line', () => {
  const out = md('- item\n  line **two**\n  line `three`\n- item2');
  assert.match(out, /<li>item<br\/>line <strong>two<\/strong><br\/>line <code>three<\/code><\/li><li>item2<\/li>/);
  // markers from different lines must not pair up across the <br/> join
  assert.doesNotMatch(out, /\*\*/);
});

test('(a) blank line ends the list — continuation after it is a paragraph', () => {
  const out = md('- item\n  continuation\n\nPlain paragraph');
  assert.match(out, /<li>item<br\/>continuation<\/li><\/ul>/);
  assert.match(out, /<p>Plain paragraph<\/p>/);
});

test('(b) regular bullet list unchanged', () => {
  const out = md('- one\n- two\n- three');
  assert.equal(out, '<ul><li>one</li><li>two</li><li>three</li></ul>');
});

test('(b) nested bullet is NOT absorbed into the parent item (behavior preserved)', () => {
  const out = md('- item one\n  - nested item\n- item two');
  assert.match(out, /<li>item one<\/li>/, 'parent item must not swallow the nested bullet');
  assert.doesNotMatch(out, /item one<br\/>- nested/);
  assert.match(out, /<li>item two<\/li>/);
});

test('(b) numbered list untouched (no <ol>, literal markers as before)', () => {
  const out = md('1. one\n2. two');
  assert.doesNotMatch(out, /<ol/i);
  assert.match(out, /1\. one/);
  assert.match(out, /2\. two/);
});

test('(b) star bullets still work', () => {
  const out = md('* alpha\n* beta');
  assert.equal(out, '<ul><li>alpha</li><li>beta</li></ul>');
});

test('(c) fenced code block inside a list is NOT absorbed into the <li>', () => {
  const out = md('- item one\n  ```\n  code here\n  ```\n- item two');
  assert.match(out, /<pre><code>  code here/, 'the fence still renders as a code block');
  assert.match(out, /<li>item one<\/li>/, 'the item closes without swallowing the fence');
  assert.doesNotMatch(out, /item one<br\/><pre>/, 'the fence must not join the item');
  assert.match(out, /<li>item two<\/li>/);
});

test('(d) heading after a list still renders', () => {
  const out = md('- item\n# Heading');
  assert.match(out, /<li>item<\/li>/);
  assert.match(out, /<h1>Heading<\/h1>/);
});

test('(d) continuation starting with **bold** (not a `* ` bullet) is absorbed', () => {
  const out = md('- item\n  **Note:** this matters');
  assert.match(out, /<li>item<br\/><strong>Note:<\/strong> this matters<\/li>/);
});

test('(d) indented `#` line is not absorbed (new-block guard)', () => {
  const out = md('- item\n  # not a heading');
  assert.doesNotMatch(out, /item<br\/>#/);
});
