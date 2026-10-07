/**
 * v1.58.40 (UX-D-H) — every visible `career-ops.org/docs/...` URL in
 * the SPA views and help bundles must be a clickable link.
 *
 * Locks the invariant going forward: if a future PR pastes a plain-text
 * URL into a view, this test fails. The audit at v1.58.36 confirmed
 * the current state already complies — this is a no-regress guard.
 *
 * Scope:
 *  - public/js/views/*.js — every occurrence of `career-ops.org`
 *    must be either (a) inside `c('a', { href: …, … }, …)` or
 *    (b) inside an attribute value such as `href:` / `title:` /
 *    a docstring/comment. Plain-text string-literal occurrences
 *    that are passed as child-text to a non-`<a>` element are the
 *    failure mode.
 *  - docs/help/*.md — markdown rendered via UI.md() turns
 *    `[text](url)` into <a>. Bare URLs are tolerated by GFM (auto-
 *    linked) but they ship a poor visible representation; require
 *    every `career-ops.org/docs` occurrence to be inside `[text](url)`
 *    OR `<https://career-ops.org/...>` (the explicit autolink form).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __d = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__d, '..');

function read(...parts) { return readFileSync(resolve(ROOT, ...parts), 'utf8'); }

test('UX-D-H: every career-ops.org/docs occurrence in views/*.js is inside an <a> create or an attribute (not bare child text)', () => {
  const viewsDir = resolve(ROOT, 'public', 'js', 'views');
  // Recursive: the split views under views/scan/* and views/config/* count.
  const files = readdirSync(viewsDir, { recursive: true }).filter((f) => f.endsWith('.js'));
  assert.ok(files.some((f) => /[/\\]/.test(f)), 'scan must reach view subdirectories');
  const failures = [];
  for (const f of files) {
    const src = read('public', 'js', 'views', f);
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // We only care about deep-link URLs (with /docs/ path), not bare
      // brand mentions of "career-ops.org" in prose.
      if (!/career-ops\.org\/docs\//.test(line)) continue;
      // Skip pure comments + docstrings.
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      // Allowed: attribute slot — `href:` / `title:` / `aria-label:` etc.
      // The value can be a string literal OR an i18n call `t('key', 'fallback')`.
      if (/(href|title|aria-label|alt):\s*(['"`]|t\()/.test(line)) continue;
      // Allowed: passed as the visible TEXT inside an existing <a>.
      // Pattern: `}, '…career-ops.org/docs…'),` where `}, ` closes the
      // attribute object of an `c('a', { … },` call. We approximate
      // this by checking that the previous non-blank line above starts
      // an `<a>` construction. The grep at v1.58.40 confirmed all 3
      // such matches (apply.js / batch.js / reports.js) follow this
      // shape.
      let j = i - 1;
      while (j >= 0 && /^\s*$/.test(lines[j])) j--;
      if (j >= 0 && /target:\s*'_blank'|c\('a',|rel:\s*'noopener/.test(lines[j])) continue;
      // Otherwise: probable bare-text plain URL — failure.
      failures.push(`${f}:${i + 1}: ${line.trim()}`);
    }
  }
  assert.deepEqual(failures, [],
    'Plain-text career-ops.org URLs in views/*.js (must be inside <a> create or attribute):\n  ' + failures.join('\n  '));
});

test('UX-D-H: every career-ops.org/docs occurrence in docs/help/*.md is markdown-linked', () => {
  const helpDir = resolve(ROOT, 'docs', 'help');
  const files = readdirSync(helpDir).filter((f) => f.endsWith('.md'));
  const failures = [];
  for (const f of files) {
    const src = read('docs', 'help', f);
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // We only care about deep-link doc URLs (with /docs/ path), not
      // bare brand mentions of "career-ops.org" in prose.
      if (!/career-ops\.org\/docs\//.test(line)) continue;
      // Skip code-fence + code-span content (we don't want to lint code).
      // Cheap heuristic: skip lines starting with 4+ spaces (code blocks)
      // or containing a fenced code marker.
      if (/^\s{4}/.test(line) || /```/.test(line)) continue;
      // Allowed: `[text](https://career-ops.org/docs/...)` markdown link
      // (path may be empty for root brand link, but we already gated on
      // `/docs/` above so this requires at least that path).
      if (/\]\(https?:\/\/career-ops\.org\/docs\/[^)]*\)/.test(line)) continue;
      // Allowed: `<https://career-ops.org/docs/...>` explicit autolink.
      if (/<https?:\/\/career-ops\.org\/docs\/[^>]+>/.test(line)) continue;
      // Allowed: comment / metadata lines (HTML comments etc.).
      if (line.trimStart().startsWith('<!--')) continue;
      failures.push(`docs/help/${f}:${i + 1}: ${line.trim()}`);
    }
  }
  assert.deepEqual(failures, [],
    'Bare career-ops.org URLs in docs/help/*.md (must use [text](url) or <url>):\n  ' + failures.join('\n  '));
});
