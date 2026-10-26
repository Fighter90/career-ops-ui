/**
 * FULL-R4 — stripDangerousMarkdown must stop corrupting ordinary prose.
 *
 * The pre-fix implementation had two data-corruption defects on top of its
 * XSS job:
 *   1. Scheme strips (`javascript\s*:`, `vbscript\s*:`, `data:\s*text/html`)
 *      ran on the WHOLE document, so a plain skills line
 *      «JavaScript: React, Node» lost its leading word on every save.
 *   2. Entities were decoded IN PLACE before the strip regexes, so stored
 *      prose was permanently rewritten: `R&amp;D` → `R&D`, `&lt;T&gt;` →
 *      `<T>`, `&#36;` → `$`.
 * The fix scopes scheme strips to real link/attribute contexts (markdown
 * inline links, markdown reference definitions, href/src attributes) and
 * makes entity decoding detection-only: dangerous constructs are found on
 * a decoded scratch copy but CUT from the original text.
 *
 * The XSS contract is pinned by tests/cv-xss-bypasses.test.mjs (and the
 * v1111 / infra-security-sanitizers suites) — those must stay green.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripDangerousMarkdown } from '../server/lib/security.mjs';

// ─── Prose that the old implementation corrupted ───────────────────

test('a skills line starting with "JavaScript:" survives byte-identical', () => {
  const line = 'JavaScript: React, Node.js, TypeScript — 5 yrs';
  assert.equal(stripDangerousMarkdown(line), line);
});

test('vbscript:/data:text/html mentions in prose survive', () => {
  const line = 'Blocked vbscript: and data:text/html payloads in code review';
  assert.equal(stripDangerousMarkdown(line), line);
});

test('R&amp;D and numeric entities are preserved verbatim (no in-place decode)', () => {
  const line = 'R&amp;D lead — grew the team 3&#215; in two years';
  assert.equal(stripDangerousMarkdown(line), line);
});

test('&lt;T&gt; prose survives', () => {
  const line = 'Returns &lt;T&gt; for a generic input';
  assert.equal(stripDangerousMarkdown(line), line);
});

test('&#36; currency entity survives', () => {
  const line = 'Compensation: &#36;120K base, remote';
  assert.equal(stripDangerousMarkdown(line), line);
});

// ─── The XSS job is not weakened ────────────────────────────────────

test('a real payload is removed while prose entities on the same document survive', () => {
  const md = 'R&amp;D lead\n\n<script>alert(1)</script>\n\nSkills: JavaScript: React\n';
  const out = stripDangerousMarkdown(md);
  assert.doesNotMatch(out, /<script/i);
  assert.match(out, /R&amp;D lead/);
  assert.match(out, /Skills: JavaScript: React/);
});

test('an entity-encoded payload is still found and cut from the original', () => {
  const out = stripDangerousMarkdown('lead &amp; founder\n\n&lt;script&gt;alert(1)&lt;/script&gt;\n');
  assert.doesNotMatch(out, /<script/i);
  assert.doesNotMatch(out, /script&gt;alert/i);
  assert.match(out, /lead &amp; founder/);
});

test('an entity-encoded scheme in a link context is still neutralized', () => {
  const out = stripDangerousMarkdown('[click](java&#115;cript:alert(1))');
  assert.doesNotMatch(out, /javascript\s*:/i);
  const hex = stripDangerousMarkdown('<a href="ja&#x76;ascript:alert(1)">x</a>');
  assert.doesNotMatch(hex, /javascript\s*:/i);
});

test('an entity-encoded onerror handler is still renamed', () => {
  const out = stripDangerousMarkdown('&lt;img src=x onerror=alert(1)&gt;');
  assert.doesNotMatch(out, /onerror/i);
  assert.match(out, /&lt;img src=x/);
});

test('schemes in REAL link/attribute contexts are still neutralized', () => {
  const cases = [
    ['[x](javascript:alert(1))', /javascript\s*:/i],
    ['[x]( javascript:alert(1) )', /javascript\s*:/i],
    ['[x](vbscript:alert(1))', /vbscript\s*:/i],
    ['<a href="javascript:alert(1)">x</a>', /javascript\s*:/i],
    ['<a href=javascript:alert(1)>x</a>', /javascript\s*:/i],
    ["<a href='vbscript:msgbox(1)'>x</a>", /vbscript\s*:/i],
    ['<img src=data:text/html;base64,AAAA>', /data\s*:\s*text\/html/i],
    ['[ref]: javascript:alert(1)\n\n[click][ref]', /javascript\s*:/i],
  ];
  for (const [payload, banned] of cases) {
    const out = stripDangerousMarkdown(payload);
    assert.doesNotMatch(out, banned, `${payload} → ${out}`);
  }
});

test('an entity-encoded truncated opener cannot survive for a naive decoder', () => {
  // `&lt;script src=x` with no `&gt;` — the old belt only escaped literal
  // `<`; the encoded form decoded back to a live truncated script tag.
  const out = stripDangerousMarkdown('# CV\n\nintro &lt;script src=//evil');
  assert.doesNotMatch(out, /(?:^|[^&])&lt;script/i, out);
  assert.match(out, /&amp;lt;script src=\/\/evil/, 'the entity `<` must be re-escaped so a single decode yields no `<`');
});

test('the strip is idempotent across re-saves (save-path invariant)', () => {
  // Benign and prose content must be a fixed point from the FIRST save —
  // re-saving an unedited CV must never rewrite it.
  const stable = [
    'R&amp;D &lt;T&gt; &#36;100K',
    '&lt;script&gt;alert(1)&lt;/script&gt;',
    'a</script>b',
    '<scr<script></script>ipt>a</script>',
    '[x](javascript:alert(1)) &lt;img src=x onerror=alert(1)&gt;',
    'closer alone: &lt;/script&gt; stays',
  ];
  for (const c of stable) {
    const once = stripDangerousMarkdown(c);
    assert.equal(stripDangerousMarkdown(once), once, `not idempotent: ${JSON.stringify(c)} → ${JSON.stringify(once)}`);
  }
  // A truncated literal opener is escaped on save 1 (the v1.111.0 belt,
  // pinned as `&lt;script`) and HARDENED exactly once on save 2 — `&lt;script`
  // would single-decode back to a live `<script`, `&amp;lt;script` does not.
  // Stable from save 2 on; never drifts further.
  for (const c of ['tail <script', 'tail &lt;script src=//evil', 'alert()</script']) {
    const once = stripDangerousMarkdown(c);
    const twice = stripDangerousMarkdown(once);
    assert.equal(stripDangerousMarkdown(twice), twice, `never stabilizes: ${JSON.stringify(c)} → ${JSON.stringify(once)} → ${JSON.stringify(twice)}`);
  }
});
