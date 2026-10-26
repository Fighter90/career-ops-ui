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
 * The fix scopes scheme strips to real link/attribute contexts and makes
 * entity decoding detection-only: dangerous constructs are found on
 * a decoded scratch copy but CUT from the original text.
 *
 * Re-review round (PR #513): CommonMark link forms the old global strip
 * used to cover must stay neutralized (autolinks, angle-bracket
 * destinations, next-line and block/list reference definitions); the
 * href/src regex must stay linear; the strip must be idempotent on every
 * input; scheme detection must survive `&colon;`/`&Tab;`/`&NewLine;`
 * encoding; `on…=` renaming must not touch prose.
 *
 * The XSS contract is pinned by tests/cv-xss-bypasses.test.mjs (and the
 * v1111 / infra-security-sanitizers suites) — those must stay green.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripDangerousMarkdown } from '../server/lib/security.mjs';

/**
 * What a CommonMark/HTML5 renderer does to the file before it reaches a
 * browser: decode all entities a renderer may legally decode and strip
 * tab/newline/CR (URL parsers drop them inside schemes).
 */
function decodeEntities(s) {
  return s
    .replace(/&(colon|Tab|NewLine|lt|gt|quot|amp);/gi, (_, name) => ({
      colon: ':', tab: '\t', newline: '\n', lt: '<', gt: '>', quot: '"', amp: '&',
    }[name.toLowerCase()]))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/[\t\n\r]/g, '');
}

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

test('an entity-encoded scheme in a link context is still neutralized (positive)', () => {
  const out = stripDangerousMarkdown('[click](java&#115;cript:alert(1))');
  assert.match(out, /\]\(data-blocked:alert\(1\)\)/, out);
  assert.doesNotMatch(decodeEntities(out), /javascript|vbscript/i, out);
  const hex = stripDangerousMarkdown('<a href="ja&#x76;ascript:alert(1)">x</a>');
  assert.match(hex, /href="data-blocked:alert\(1\)"/, hex);
  assert.doesNotMatch(decodeEntities(hex), /javascript/i, hex);
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

// ─── Re-review 1 [high]: CommonMark link forms stay covered ────────

test('autolink <javascript:…> is neutralized', () => {
  const out = stripDangerousMarkdown('<javascript:alert(1)>');
  assert.doesNotMatch(decodeEntities(out), /javascript\s*:/i, out);
  assert.match(out, /<data-blocked:alert\(1\)>/, out);
});

test('angle-bracket destinations are neutralized', () => {
  const inline = stripDangerousMarkdown('[x](<javascript:alert(1)>)');
  assert.match(inline, /\]\(<data-blocked:alert\(1\)>\)/, inline);
  const ref = stripDangerousMarkdown('[r]: <javascript:alert(1)>');
  assert.match(ref, /\]: <data-blocked:alert\(1\)>/, ref);
});

test('reference destination on the NEXT line is neutralized', () => {
  const out = stripDangerousMarkdown('[r]:\n  javascript:alert(1)');
  assert.match(out, /\]:\n  data-blocked:/, out);
  assert.doesNotMatch(decodeEntities(out), /javascript\s*:/i, out);
});

test('reference definitions inside blockquotes and lists are neutralized', () => {
  for (const pre of ['> ', '- ', '* ', '+ ', '1. ', '2) ', '> - ']) {
    const out = stripDangerousMarkdown(`${pre}[r]: javascript:alert(1)`);
    assert.match(out, /data-blocked:/, `${pre}[r]:… → ${out}`);
    assert.doesNotMatch(decodeEntities(out), /javascript\s*:/i, `${pre} → ${out}`);
  }
});

test('a blank line still ends a reference definition (prose after it survives)', () => {
  const md = '[r]:\n\njavascript: is a scheme, not a destination here';
  assert.equal(stripDangerousMarkdown(md), md);
});

// ─── Re-review 2 [high]: the attr regex stays linear ───────────────

test('a long whitespace run after href= is processed in bounded time', () => {
  const payload = '<a href=' + ' '.repeat(100000);
  const t0 = performance.now();
  stripDangerousMarkdown(payload);
  const ms = performance.now() - t0;
  assert.ok(ms < 1000, `href= + 100k spaces took ${ms.toFixed(0)}ms — polynomial backtracking`);
});

test('a long whitespace run after ]( is processed in bounded time', () => {
  const payload = '[x](' + ' '.repeat(100000);
  const t0 = performance.now();
  stripDangerousMarkdown(payload);
  const ms = performance.now() - t0;
  assert.ok(ms < 1000, `]( + 100k spaces took ${ms.toFixed(0)}ms — polynomial backtracking`);
});

// ─── Re-review 5 [med]: idempotent on EVERY input ──────────────────

test('the strip is idempotent across re-saves on every input (save-path invariant)', () => {
  const cases = [
    'R&amp;D &lt;T&gt; &#36;100K',
    '&lt;script&gt;alert(1)&lt;/script&gt;',
    'a</script>b',
    '<scr<script></script>ipt>a</script>',
    '[x](javascript:alert(1)) &lt;img src=x onerror=alert(1)&gt;',
    'closer alone: &lt;/script&gt; stays',
    'tail <script',
    'alert()</script',
    '# CV\n\nintro &lt;script src=//evil',
    '<javascript:alert(1)>',
    '[r]:\n  javascript:alert(1)',
    '<meta http-equiv=refresh content="0; url=javascript:alert(1)">',
    'JavaScript: React, Node — R&amp;D',
  ];
  for (const c of cases) {
    const once = stripDangerousMarkdown(c);
    assert.equal(stripDangerousMarkdown(once), once, `not idempotent: ${JSON.stringify(c)} → ${JSON.stringify(once)}`);
  }
});

// ─── Re-review 6 [low]: other destination-carrying attributes ──────

test('other destination-carrying attributes are covered too', () => {
  const cases = [
    '<form action=javascript:alert(1)>',
    '<button formaction=javascript:alert(1)>go</button>',
    '<svg><a xlink:href="javascript:alert(1)">x</a></svg>',
    '<video poster="javascript:alert(1)"></video>',
    '<body background="javascript:alert(1)">',
    '<object data="javascript:alert(1)"></object>',
    '<meta http-equiv=refresh content="0; url=javascript:alert(1)">',
    '<meta http-equiv=refresh content=0;url=javascript:alert(1)>',
    "<meta http-equiv='refresh' content=\"0;url='javascript:alert(1)'\">",
  ];
  for (const payload of cases) {
    const out = stripDangerousMarkdown(payload);
    assert.doesNotMatch(decodeEntities(out), /javascript\s*:/i, `${payload} → ${out}`);
  }
});

// ─── Re-review 7 [low]: HTML5 named entities inside schemes ────────

test('&colon;/&Tab;/&NewLine;-encoded schemes in link contexts are neutralized', () => {
  const colon = stripDangerousMarkdown('[x](javascript&colon;alert(1))');
  assert.doesNotMatch(decodeEntities(colon), /javascript\s*:/i, colon);
  const tab = stripDangerousMarkdown('<a href="java&Tab;script:alert(1)">x</a>');
  assert.doesNotMatch(decodeEntities(tab), /javascript\s*:/i, tab);
  const nl = stripDangerousMarkdown('<a href="java&NewLine;script:alert(1)">x</a>');
  assert.doesNotMatch(decodeEntities(nl), /javascript\s*:/i, nl);
});

test('&colon;-style entities in PROSE survive (detection-only decode)', () => {
  const line = 'Use javascript&colon; URLs carefully — see &#58; notes and &NewLine; literals';
  assert.equal(stripDangerousMarkdown(line), line);
});

// ─── Re-review 8 [nit]: on…= renaming stays inside tag regions ─────

test('on…= prose (no tag context) is no longer rewritten', () => {
  const line = '- one = 1; when one = two, one=three';
  assert.equal(stripDangerousMarkdown(line), line);
});

test('handlers inside tag regions — including a quoted > — are still renamed', () => {
  const quoted = stripDangerousMarkdown('<img alt="a>b" onerror=alert(1)>');
  assert.doesNotMatch(quoted, /(?:^|[\s/"'])on[a-z]+\s*=/i, quoted);
  const plain = stripDangerousMarkdown('<img src=x onerror=alert(1)>');
  assert.doesNotMatch(plain, /(?:^|[\s/"'])on[a-z]+\s*=/i, plain);
});

// ─── Entity-encoded truncated opener cannot survive a naive decoder ──

test('an entity-encoded truncated opener cannot survive for a naive decoder', () => {
  const out = stripDangerousMarkdown('# CV\n\nintro &lt;script src=//evil');
  assert.doesNotMatch(out, /(?:^|[^&])&lt;script/i, out);
  assert.match(out, /&amp;lt;script src=\/\/evil/, 'the entity `<` must be re-escaped so a single decode yields no `<`');
});
