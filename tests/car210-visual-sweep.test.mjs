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
