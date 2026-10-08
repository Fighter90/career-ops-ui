/**
 * CAR-42 (v1.243.0 views-3) — #/help TOC anchor clicks scrolled but pushed
 * no history entry, so Back left the help page entirely instead of
 * returning to the reading position.
 *
 * The fix: history.pushState('#/help?h=<heading-id>') on click — pushState
 * (not location.hash=) so the router's hashchange render never fires — plus
 * a deep-link scroll on re-render, driven by the top-level parser
 * helpSectionIdFromHash. The parser is run for real in a vm below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const HELP = readFileSync(resolve(__d, '..', 'public', 'js', 'views', 'help.js'), 'utf8');

function sliceFn(src, startMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start >= 0, `${startMarker} must exist`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unbalanced braces after ${startMarker}`);
}

test('parser: "#/help?h=<id>" round-trips the section id; plain "#/help" yields null', () => {
  const ctx = vm.createContext({ URLSearchParams, decodeURIComponent });
  vm.runInContext(sliceFn(HELP, 'function helpSectionIdFromHash'), ctx);
  const parse = (h) => vm.runInContext(`helpSectionIdFromHash(${JSON.stringify(h)});`, ctx);
  assert.equal(parse('#/help?h=help-h-3'), 'help-h-3');
  assert.equal(parse('#/help?h=help-h-12'), 'help-h-12');
  assert.equal(parse('#/help'), null, 'no query → no scroll target');
  assert.equal(parse(''), null);
  assert.equal(parse(undefined), null);
  assert.equal(parse('#/help?other=1'), null, 'a query without h= yields no target');
  assert.equal(parse('#/dashboard?h=help-h-3'), 'help-h-3',
    'the parser is route-agnostic (the view only ever calls it on #/help)');
});

test('TOC click records the position in history via pushState (never location.hash)', () => {
  const onClick = sliceFn(HELP, 'onClick: (e) => {');
  assert.match(onClick, /e\.preventDefault\(\);/,
    'the bare anchor must not navigate');
  assert.match(onClick,
    /history\.pushState\(null, '', '#\/help\?h=' \+ encodeURIComponent\(h\.id\)\);/,
    'Back must return to the previous reading position');
  assert.doesNotMatch(onClick, /location\.hash\s*=/,
    'assigning location.hash would fire hashchange → router re-render → scroll top');
  // The scroll + focus behaviour is preserved alongside the history entry.
  assert.match(onClick, /scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
  assert.match(onClick, /target\.focus\(\{ preventScroll: true \}\);/);
});

test('Back / Forward / deep-link: a re-rendered help view scrolls to the recorded section', () => {
  // The view reads the parser once and scrolls after mount (double rAF —
  // the same mount-ordering pattern the scroll-spy uses).
  assert.match(HELP, /helpSectionIdFromHash\(location\.hash\)/);
  assert.match(HELP, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => \{[\s\S]*?deepLinkTarget\.scrollIntoView/);
  assert.match(HELP, /deepLinkTarget\.focus\(\{ preventScroll: true \}\);/);
  // Unknown / absent ids stay at the top — the scroll is gated.
  assert.match(HELP, /if \(deepLinkTarget\) \{/);
});
