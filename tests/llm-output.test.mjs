/**
 * v1.58.0 — cleanLlmMarkdown strips agent/tool scaffolding the model
 * sometimes echoes into prose (#/deep + Saved research showed raw
 * <tool_call>{json}</tool_call> blocks). Pure + idempotent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanLlmMarkdown } from '../server/lib/llm-output.mjs';

test('removes paired <tool_call>/<tool_response> blocks, keeps prose + markdown', () => {
  const raw = [
    'Сначала прочитаю файлы.',
    '',
    '<tool_call>',
    '{"name": "read_file", "parameters": {"path": "cv.md"}}',
    '</tool_call>',
    '<tool_response>',
    'Jane Doe, Senior Engineer',
    '</tool_response>',
    '',
    '# Deep Research',
    '',
    '## 1. Market',
    '- **bold** point',
    '| A | B |',
    '|---|---|',
    '| 1 | 2 |',
  ].join('\n');
  const out = cleanLlmMarkdown(raw);
  assert.ok(!/tool_call|tool_response/i.test(out), 'scaffolding tags must be gone');
  assert.ok(!out.includes('read_file'), 'tool JSON must be gone');
  assert.ok(out.includes('# Deep Research'), 'real markdown heading kept');
  assert.ok(out.includes('**bold** point') && out.includes('| A | B |'), 'markdown body kept');
  assert.ok(!/\n{3,}/.test(out), 'blank-line craters collapsed');
});

test('handles <tool_use>, <function_call>, [TOOL_CALL] and <thinking> variants', () => {
  const raw = 'A\n<tool_use>{"x":1}</tool_use>\nB\n[TOOL_CALL]do[/TOOL_CALL]\nC\n<function_call>f()</function_call>\nD\n<thinking>secret reasoning</thinking>\nE';
  const out = cleanLlmMarkdown(raw);
  for (const t of ['tool_use', 'function_call', 'TOOL_CALL', 'thinking', 'secret reasoning', '{"x":1}']) {
    assert.ok(!out.includes(t), `must strip ${t}`);
  }
  assert.equal(out.replace(/\s+/g, ' ').trim(), 'A B C D E');
});

test('drops a dangling unterminated trailing scaffold (stream cut mid tool-call)', () => {
  const raw = '# Brief\n\nReal content here.\n\n<tool_call>\n{"name":"web_search","parameters":{"query":"...';
  const out = cleanLlmMarkdown(raw);
  assert.ok(out.includes('# Brief') && out.includes('Real content here.'));
  assert.ok(!out.includes('tool_call') && !out.includes('web_search'));
});

test('idempotent + safe on already-clean / falsy input', () => {
  const clean = '# Title\n\nParagraph with `code` and **bold**.\n\n```\ncode block stays\n```';
  assert.equal(cleanLlmMarkdown(clean), clean.trim());
  assert.equal(cleanLlmMarkdown(cleanLlmMarkdown(clean)), clean.trim(), 'idempotent');
  assert.equal(cleanLlmMarkdown(''), '');
  assert.equal(cleanLlmMarkdown(null), '');
  assert.equal(cleanLlmMarkdown(undefined), '');
});

test('does NOT eat a fenced code block that merely mentions the word tool_call', () => {
  const raw = '# Doc\n\n```\nif (x) callTool(); // not a tool_call tag\n```\n\nDone.';
  const out = cleanLlmMarkdown(raw);
  assert.ok(out.includes('callTool()') && out.includes('Done.'), 'real code/prose preserved');
});

// ── v1.58.3 (R-2 / FIX-C1) — orphan / unbalanced scaffold tags ──

test('R-2: strips an ORPHAN closing tag with no opener (the v1.58.2 leak)', () => {
  assert.equal(cleanLlmMarkdown('Hi there </tool_response> bye'), 'Hi there  bye');
  assert.equal(cleanLlmMarkdown('Brief.\n</thinking>\n## Section'), 'Brief.\n\n## Section');
  const meta = 'Я запущу.\nСначала прочитаю.\n</tool_response>\nТеперь создам брифинг.';
  const out = cleanLlmMarkdown(meta);
  assert.ok(!out.includes('tool_response'), 'orphan </tool_response> must be gone');
  assert.ok(out.includes('Теперь создам брифинг.'), 'real prose kept');
});

test('R-2: strips Anthropic tool XML (<invoke>/<parameter>/antml:*) and fenced tool blocks', () => {
  assert.equal(
    cleanLlmMarkdown('txt <invoke name="x"><parameter name="p">y</parameter></invoke> end'),
    'txt y end');
  assert.ok(!/antml:/.test(cleanLlmMarkdown('a <invoke>b</invoke> c')));
  const fenced = '## A\n```tool_response\n{"k":1}\n```\n## B';
  const out = cleanLlmMarkdown(fenced);
  assert.ok(out.includes('## A') && out.includes('## B') && !out.includes('tool_response'));
});

test('R-2: still idempotent on lopsided traces; never eats real autolinks', () => {
  const x = 'meta\n</tool_response>\n<invoke name=q>z</invoke>\n## H';
  assert.equal(cleanLlmMarkdown(cleanLlmMarkdown(x)), cleanLlmMarkdown(x), 'idempotent');
  const real = '# T\n\nSee <https://example.com> and `<not_a_tag>` in prose.';
  assert.equal(cleanLlmMarkdown(real), real.trim(), 'real <https://> autolink + code span preserved');
});

// ── v1.207.2 — unwrap a WHOLE-DOCUMENT ```markdown fence some models emit ──
// (career-plan / orientation returned their entire brief wrapped, so UI.md
// rendered a monospace code dump instead of a formatted plan).

test('unwraps a whole-document ```markdown / ```md fence', () => {
  assert.equal(
    cleanLlmMarkdown('```markdown\n# Career plan\n\n## Q1\n- **learn** Go\n```'),
    '# Career plan\n\n## Q1\n- **learn** Go');
  // ```md alias + trailing whitespace after the closing fence
  assert.equal(cleanLlmMarkdown('```md\n# H\n\ntext\n```   '), '# H\n\ntext');
  // idempotent — a second pass finds no wrapping fence
  const out = cleanLlmMarkdown('```markdown\n# H\n\ntext\n```');
  assert.equal(cleanLlmMarkdown(out), out, 'idempotent');
});

test('preserves INNER code blocks when unwrapping the outer markdown fence', () => {
  const out = cleanLlmMarkdown('```markdown\n# Doc\n\nRun:\n```js\nfoo()\n```\n\nDone.\n```');
  assert.ok(out.startsWith('# Doc'), 'outer fence gone, heading first');
  assert.ok(out.includes('```js\nfoo()\n```'), 'inner code block preserved');
  assert.ok(out.includes('Done.'));
  assert.ok(!out.endsWith('```markdown') && !/^```markdown/.test(out), 'outer wrapper removed');
});

test('does NOT unwrap a real ```python / ```js / bare-``` code answer', () => {
  const py = '```python\nprint("hi")\n```';
  assert.equal(cleanLlmMarkdown(py), py, 'a real code-language fence is left intact');
  const bare = '```\nsome raw output\n```';
  assert.equal(cleanLlmMarkdown(bare), bare, 'a bare full-doc fence is left (could be real output)');
  // a ```markdown block that is NOT the whole doc (prose follows) is left alone
  const partial = '```markdown\n# Snippet\n```\n\nMore prose after.';
  assert.equal(cleanLlmMarkdown(partial), partial, 'only a WHOLE-document wrap is unwrapped');
});
