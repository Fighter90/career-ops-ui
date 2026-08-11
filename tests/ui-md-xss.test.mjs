/**
 * UI.md() escape-first XSS boundary (public/js/api.js).
 *
 * career-plan.js (v1.137.0 auto-render), reports.js, orientation.js,
 * cv-studio.js, networking.js, evaluate.js and docs-assistant.js all render
 * LLM/report markdown via `c('div', { className:'md', html: UI.md(str) })`.
 * The PR-#188 review asked for a test that FEEDS a malicious payload through
 * that path and asserts no executable tag survives. This is that test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMd } from './helpers/ui-md.mjs';

const md = loadMd();

// The escaped output may contain the LITERAL characters "onerror=" as inert
// text (`&lt;img … onerror=…&gt;`); that is safe. What must never appear is a
// LIVE element (`<tag …>`) carrying an on*= handler, or a live <script>.
const LIVE_HANDLER = /<[a-z][^>]*\son\w+\s*=/i;

test('UI.md escapes raw HTML tags — no live <script> / <img onerror>', () => {
  const outImg = md('<img src=x onerror=alert(1)>');
  assert.doesNotMatch(outImg, /<img\b/i, 'a live <img> must not be emitted');
  assert.doesNotMatch(outImg, LIVE_HANDLER, 'no live element may carry an on*= handler');
  assert.match(outImg, /&lt;img/i, 'the tag is HTML-escaped to inert text');

  const outScript = md('<script>alert(1)</script>');
  assert.doesNotMatch(outScript, /<script/i, 'no live <script> tag');
  assert.match(outScript, /&lt;script/i, 'the <script> is escaped');
});

test('UI.md strips dangerous link schemes but keeps safe ones', () => {
  const js = md('[click me](javascript:alert(1))');
  assert.doesNotMatch(js, /href="?javascript:/i, 'javascript: href is rejected');
  assert.match(js, /click me/, 'the label text is kept as plain text');

  const data = md('[x](data:text/html,<script>alert(1)</script>)');
  assert.doesNotMatch(data, /href="?data:text\/html/i, 'data:text/html href is rejected');

  const ok = md('[docs](https://example.com/page)');
  assert.match(ok, /<a href="https:\/\/example\.com\/page"[^>]*>docs<\/a>/, 'https link renders as a real anchor');
});

test('UI.md neutralizes inline event handlers embedded in raw HTML', () => {
  const out = md('<a href="#" onmouseover="steal()">hover</a>');
  assert.doesNotMatch(out, LIVE_HANDLER, 'no live element may carry the on* handler');
  assert.doesNotMatch(out, /<a\s/i, 'the raw <a> is escaped, not emitted live');
});

test('UI.md still renders ordinary markdown (positive control)', () => {
  const out = md('**bold** and `code` and a heading\n\n## Title');
  assert.match(out, /<strong>bold<\/strong>/);
  assert.match(out, /<code>code<\/code>/);
  assert.match(out, /<h2>Title<\/h2>/);
});
