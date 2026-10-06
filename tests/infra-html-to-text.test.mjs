/**
 * v1.241.0 review hardening — html-to-text.mjs.
 *
 *  - HTML_TAG_RE `<(?:…)+>` rescanned to the end of the input from every `<`
 *    of a `<<<<…` run (20 000 of them = 11 s of blocked event loop during a
 *    scan) and the media regex did the same for unclosed `<script>` openers.
 *  - It also ate prose: `salary <50k or >100k` lost `<50k or >`.
 * A tag must now start like a tag, scanning is linear, input is capped.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let htmlToText;
let INPUT_CAP;
before(async () => {
  ({ htmlToText, INPUT_CAP } = await import('../server/lib/html-to-text.mjs'));
});

const timed = (fn) => { const t = Date.now(); fn(); return Date.now() - t; };

test('adversarial angle-bracket runs finish fast', () => {
  const inputs = {
    ltRun: '<'.repeat(150_000),
    tagStartsNoGt: '<a'.repeat(100_000),
    quotedLt: '<a "<a" '.repeat(20_000),
    unclosedMedia: '<script>'.repeat(20_000) + '<style>'.repeat(20_000),
    huge: '<p>x</p>'.repeat(200_000), // 1.6 MB — capped before matching
  };
  for (const [name, s] of Object.entries(inputs)) {
    const ms = timed(() => htmlToText(s));
    assert.ok(ms < 1500, `${name}: ${ms}ms`);
  }
});

test('prose comparisons survive; real tags still go', () => {
  assert.equal(htmlToText('salary <50k or >100k'), 'salary <50k or >100k');
  assert.equal(htmlToText('<p>salary <50k or >100k</p>'), 'salary <50k or >100k');
  assert.equal(htmlToText('a <> b'), 'a <> b');
  assert.equal(htmlToText('<!-- c --><p>x</p><?xml v?>'), 'x');
  assert.equal(htmlToText('<br/>a</p>'), 'a');
});

test('media spans: first closer wins, interleaving keeps left-to-right order', () => {
  assert.equal(htmlToText('<script>1</script>a<script>2</script>b'), 'a b');
  assert.equal(htmlToText('<script>x<style>y</script>z</style>w'), 'z w');
  // an opener without a closer is just a tag; its name is skipped afterwards
  assert.equal(htmlToText('<script>never closed <p>body</p>'), 'never closed body');
  assert.equal(htmlToText('<style>open<style>again</p><script>s</script>end'), 'open again end');
});

test('input is capped before stripping (INPUT_CAP)', () => {
  assert.equal(INPUT_CAP, 200_000);
  const s = 'x'.repeat(INPUT_CAP) + '<p>after</p>';
  assert.equal(htmlToText(s).length, 4000);
});
