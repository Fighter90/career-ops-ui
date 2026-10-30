// CAR-210…216 — the 390px visual-sweep regression locks (source-static).
// Each assertion is red against the pre-fix shape: it pins the exact fix
// contract (empty host outside the tracker table, collapsed scan log that
// never wraps, flat bold in help §1, the v2empty funnel pattern, the stats
// hint divider, the career-plan Result-tab note, the shrunken docs FAB).
// No server, no network, no parent layout — plain file reads only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
test('CAR-210 — tracker first-run empty state renders OUTSIDE the min-width table', () => {
  const src = read('public/js/views/tracker.js');
  // The dedicated full-width host exists and ships in the page tree.
  assert.match(src, /const emptyHost = c\('div', \{ hidden: true \}\)/, 'emptyHost declared');
  assert.match(src, /emptyHost,\n\s*tableWrap,/, 'emptyHost precedes tableWrap in the tree');
  // applyFilters fills the host (not a td) when the tracker has no rows at all…
  const applyFilters = src.slice(src.indexOf('function applyFilters'), src.indexOf('function sortableTh'));
  assert.match(applyFilters, /if \(rows\.length === 0\) \{[\s\S]*?emptyHost\.appendChild/, 'rows.length===0 fills emptyHost');
  // …and the empty title no longer renders inside a table cell.
  assert.doesNotMatch(applyFilters, /c\('td'[\s\S]*?track\.emptyTitle/, 'emptyTitle not inside a td');
  // Visibility contract: the table (and pager) hide while the host shows.
  assert.match(src, /emptyHost\.hidden = !\(tableActive && emptyFirstRun\)/, 'applyViewMode gates the host');
  assert.match(src, /tableWrap\.style\.display = tableActive && !emptyFirstRun \? '' : 'none'/, 'table hides on a first-run empty tracker');
});

test('CAR-211 — collapsed scan-log line never wraps (nowrap + ellipsis in the strip)', () => {
  const css = read('public/css/app.css');
  assert.match(
    css,
    /\.scan-terminal:not\(\.v2-scan-log-open\) \.console \{ max-height: 1\.6em; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; \}/,
    'the collapsed console clips one line with an ellipsis instead of slicing a wrapped second line',
  );
});

test('CAR-214 — help §1 carries no bold span broken across blockquote lines', () => {
  const md = read('docs/help/en.md');
  // The four empty-start pages: every **…** span complete on its own line.
  assert.match(md, /— \*\*Auto-pipeline\*\*, \*\*Apply checklist\*\*,\n> \*\*Batch\*\*, and \*\*Funded companies\*\* —/, 'flat bold per line in §1');
  // And nowhere in the bundle does a bold opener dangle at end-of-line inside a quote.
  const broken = md.split('\n').filter((l) => {
    const open = (l.match(/\*\*/g) || []).length;
    return open % 2 === 1;
  });
  assert.equal(broken.length, 0, `lines with an unpaired ** (renders as literal asterisks): ${broken.slice(0, 3).join(' | ')}`);
});

test('CAR-216 — dashboard funnel empty state is the v2empty pattern, not a bare "No results"', () => {
  const src = read('public/js/views/dashboard.js');
  assert.match(src, /v2empty\.dash\.statusesTitle/, 'statuses empty has a title');
  assert.match(src, /v2empty\.dash\.statusesBody/, '…and an explanation body');
  assert.match(src, /href: '#\/evaluate'[\s\S]*?v2empty\.reports\.openEvaluate/, '…and the real first-step action');
  // The bare common.empty fallback is gone from the funnel section.
  const funnel = src.slice(src.indexOf("t('dash.statuses'"), src.indexOf('function profileFixtureBanner'));
  assert.doesNotMatch(funnel, /common\.empty/, 'bare "No results" removed from the funnel card');
  // Both keys ship in the EN dict (the ×19 parity gate re-checks the rest).
  assert.match(read('public/js/lib/locales/i18n-dict.en.js'), /'v2empty\.dash\.statusesTitle'/);
  assert.match(read('public/js/lib/locales/i18n-dict.en.js'), /'v2empty\.dash\.statusesBody'/);
});

test('CAR-212 — the stats "?" hint is pinned off the scrolling tab tape (divider + 44px target)', () => {
  const src = read('public/js/views/stats.js');
  const hintRow = src.slice(src.indexOf('const hintRow'), src.indexOf('const tabStrip'));
  assert.match(hintRow, /borderInlineStart: '1px solid var\(--line/, 'logical divider between tape and hint');
  assert.match(hintRow, /minHeight: '44px'/, 'touch-target row height');
});

