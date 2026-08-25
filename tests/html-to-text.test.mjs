/**
 * Shared HTML → plain-text pipeline (html-to-text.mjs). The extracted form of
 * greenhouse's contentToText: every source that embeds an HTML body strips
 * through this one pipeline so a divergent private copy cannot grow the way
 * entity decoders once did.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText, DESCRIPTION_CAP } from '../server/lib/html-to-text.mjs';

test('DESCRIPTION_CAP is 4000 (greenhouse/alibaba precedent)', () => {
  assert.equal(DESCRIPTION_CAP, 4000);
});

test('htmlToText: "" for missing / non-string / empty input (never throws)', () => {
  assert.equal(htmlToText(null), '');
  assert.equal(htmlToText(undefined), '');
  assert.equal(htmlToText(42), '');
  assert.equal(htmlToText(''), '');
});

test('htmlToText: plain text passes through unchanged', () => {
  assert.equal(htmlToText('Already plain text'), 'Already plain text');
});

test('htmlToText: strips tags', () => {
  assert.equal(htmlToText('<p>Hello <b>world</b></p>'), 'Hello world');
});

test('htmlToText: drops <script>/<style> WITH their contents', () => {
  assert.equal(htmlToText('<style>.x{color:red}</style><script>evil()</script><p>Body</p>'), 'Body');
});

test('htmlToText: double-decodes entity-escaped markup to readable text', () => {
  // Entity-escaped markup first reveals real tags, and only after those are
  // gone can the text-level entities decode.
  assert.equal(htmlToText('&lt;p&gt;C++ &amp;amp; Rust&amp;rsquo;s runtime&lt;/p&gt;'), 'C++ & Rust’s runtime');
});

test('htmlToText: collapses whitespace + caps at DESCRIPTION_CAP', () => {
  assert.equal(htmlToText('<p>a</p>   <p>b</p>'), 'a b');
  assert.equal(htmlToText('<p>' + 'x'.repeat(5000) + '</p>').length, 4000);
});
