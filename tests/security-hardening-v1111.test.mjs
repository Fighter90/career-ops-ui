/**
 * Security hardening (v1.111.0) — close the incomplete-multi-character-sanitization
 * class at the trust boundary. stripDangerousMarkdown() strips well-formed
 * dangerous tags and `<tag …>` openers that carry a closing `>`. A *truncated*
 * opener with no `>` at all (a payload ending in `<script`, `<iframe`, …) used
 * to survive verbatim; it must now be neutralized by escaping its `<`, so the
 * OUTPUT provably contains no live `<script`/`<iframe`/… substring.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripDangerousMarkdown } from '../server/lib/security.mjs';
import { buildModePrompt } from '../server/lib/prompts.mjs';
import { importDocumentToMarkdown } from '../server/lib/cv-import.mjs';

const DANGEROUS = ['script', 'iframe', 'object', 'embed', 'style', 'form', 'svg'];

test('truncated dangerous openers (no closing >) leave no live <tag substring', () => {
  for (const tag of DANGEROUS) {
    for (const payload of [`<${tag}`, `# CV\n\ntrailing <${tag}`, `<${tag}\n`, `<  ${tag}`]) {
      const out = stripDangerousMarkdown(payload);
      assert.ok(!new RegExp(`<\\s*${tag}\\b`, 'i').test(out),
        `output still contains a live <${tag} for input ${JSON.stringify(payload)}: ${JSON.stringify(out)}`);
      // The `<` must have been escaped, not silently dropped — content preserved.
      assert.match(out, new RegExp(`&lt;\\s*${tag}`, 'i'));
    }
  }
});

test('truncated dangerous CLOSER (</script with no >) is neutralized too', () => {
  const out = stripDangerousMarkdown('alert()</script');
  assert.ok(!/<\s*\/\s*script\b/i.test(out));
  assert.match(out, /&lt;\/script/i);
});

test('well-formed dangerous tags are still fully REMOVED (not escaped)', () => {
  // The loop removes these before the escape belt runs, so the payload is gone
  // entirely — the escape belt only catches truncated survivors.
  const out = stripDangerousMarkdown('a<script>steal()</script>b');
  assert.equal(out, 'ab');
  assert.doesNotMatch(out, /script/i);
});

test('benign markdown with a stray < is untouched (no dangerous tag name follows)', () => {
  const out = stripDangerousMarkdown('C++ is < 20 lines and 3 < 5 always');
  assert.match(out, /3 < 5/);
  assert.doesNotMatch(out, /&lt;/);
});

test('mode role-line renders via string template ({slug} interpolated, no dynamic call)', () => {
  const en = buildModePrompt('', 'oferta', {}, 'en');
  assert.match(en, /You are career-ops in oferta mode\./);
  const ru = buildModePrompt('', 'deep', {}, 'ru');
  assert.match(ru, /career-ops в режиме deep/);
});

test('mode role-line: a tampered lang falls back to en (no prototype access, no throw)', () => {
  for (const bad of ['constructor', '__proto__', 'toString', 'nope', 42, null, undefined]) {
    const out = buildModePrompt('', 'oferta', {}, bad);
    assert.match(out, /You are career-ops in oferta mode\./);
  }
});

test('cv-import: buffer size decisions use a coerced Number (type-confusion barrier)', async () => {
  const empty = await importDocumentToMarkdown(Buffer.alloc(0), 'cv.md');
  assert.equal(empty.ok, false);
  assert.match(empty.error, /empty/);
  const ok = await importDocumentToMarkdown(Buffer.from('# Hi\n', 'utf8'), 'cv.md');
  assert.equal(ok.ok, true);
  assert.equal(ok.sizeBytes, 5);
  assert.equal(typeof ok.sizeBytes, 'number');
});
