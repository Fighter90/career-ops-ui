/**
 * Pre-commit secret floor (scripts/ai-precommit-review.mjs) — the key
 * shapes it must catch, the placeholders it must leave alone, and the
 * staged-file listing it must read (renames included, raw UTF-8 paths).
 *
 * Every token is assembled at runtime from parts, so no literal in this
 * file looks like a live credential to a secret scanner or to push
 * protection. Pure functions only — no git, no network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  secretHits, parseStagedList, STAGED_LIST_ARGS,
} from '../scripts/ai-precommit-review.mjs';

const body = (n, ch = 'aB3') => ch.repeat(Math.ceil(n / ch.length)).slice(0, n);
const add = (s) => '+' + s;

const TOKENS = {
  'OpenRouter sk-or-v1': ['sk', 'or', 'v1', body(48)].join('-'),
  'OpenAI project sk-proj': 'sk-' + 'proj-' + body(30) + '_' + body(20),
  'OpenAI legacy sk-': 'sk-' + body(40),
  'Anthropic sk-ant': 'sk-' + 'ant-' + 'api03-' + body(40),
  'xAI xai-': 'xai' + '-' + body(60),
  'Groq gsk_': 'gsk' + '_' + body(52),
  'GitHub fine-grained github_pat_': 'github' + '_pat_' + body(22) + '_' + body(59),
  'GitHub classic ghp_': 'ghp' + '_' + body(36),
};

for (const [name, tok] of Object.entries(TOKENS)) {
  test(`secretHits catches ${name}`, () => {
    assert.equal(secretHits(add(`const k = "${tok}";`)).length, 1, tok.slice(0, 12));
  });
}

test('a real key is NOT excused by the word "example" elsewhere on the line', () => {
  const tok = TOKENS['Anthropic sk-ant'];
  assert.equal(secretHits(add(`const k = "${tok}"; // example: replace before release`)).length, 1);
  assert.equal(secretHits(add(`curl -H "x-api-key: ${tok}" https://api.example.com`)).length, 1);
});

test('a real key is NOT excused by an HTML-ish <tag> on the same line', () => {
  const tok = TOKENS['Groq gsk_'];
  assert.equal(secretHits(add(`<code>${tok}</code>`)).length, 1);
  assert.equal(secretHits(add(`<key> = ${tok}`)).length, 1);
});

test('placeholders inside the token itself are still ignored', () => {
  const lines = [
    'ANTHROPIC_API_KEY=YOUR_ANTHROPIC_KEY_HERE',
    'OPENAI_API_KEY=<your-key>',
    'OPENROUTER_API_KEY=sk-or-v1-' + 'x'.repeat(48),
    'XAI=xai-' + 'EXAMPLE' + body(30),
    'GROQ=gsk_' + 'placeholder' + body(30),
    'TOKEN=github_pat_' + 'YOUR_TOKEN_HERE' + body(30),
  ];
  for (const l of lines) assert.deepEqual(secretHits(add(l)), [], l);
});

test('ordinary code with sk-/xai-/gsk_ substrings is not a hit', () => {
  for (const l of ['const task-runner = 1;', 'desk-top', 'class="xai-logo"', 'gsk_short', 'github_pat_doc']) {
    assert.deepEqual(secretHits(add(l)), [], l);
  }
});

test('removed and context lines never count; only added lines do', () => {
  const tok = TOKENS['xAI xai-'];
  const diff = ['+++ b/x.mjs', `-old ${tok}`, ` ctx ${tok}`].join('\n');
  assert.deepEqual(secretHits(diff), []);
});

test('staged list asks git for renames (R) and NUL-separated raw paths', () => {
  assert.ok(STAGED_LIST_ARGS.includes('-z'), 'needs -z so non-ASCII paths are not C-quoted');
  const filter = STAGED_LIST_ARGS.find((a) => a.startsWith('--diff-filter='));
  assert.ok(filter && filter.includes('R'), `renamed files must be scanned too: ${filter}`);
  for (const ch of 'ACM') assert.ok(filter.includes(ch));
});

test('parseStagedList splits on NUL and keeps spaces / UTF-8 intact', () => {
  assert.deepEqual(
    parseStagedList('a.mjs\0docs/help/ru справка.md\0dir/ü.js\0'),
    ['a.mjs', 'docs/help/ru справка.md', 'dir/ü.js']);
  assert.deepEqual(parseStagedList(''), []);
  assert.deepEqual(parseStagedList('\0'), []);
});

// ── CLI end to end on a throwaway repo (no AI: AI_REVIEW=off) ──────────────

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'ai-precommit-review.mjs');
const cleanEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_'))), AI_REVIEW: 'off' };

function repo() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'ci-precommit-')));
  const git = (...a) => execFileSync('git', a, { cwd: dir, env: cleanEnv, stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 'ci@example.invalid');
  git('config', 'user.name', 'ci');
  return { dir, git, run: () => spawnSync(process.execPath, [CLI], { cwd: dir, env: cleanEnv, encoding: 'utf8' }) };
}

test('CLI: a key inside a RENAMED file blocks the commit, and is not echoed', () => {
  const { dir, git, run } = repo();
  try {
    writeFileSync(join(dir, 'old name.mjs'), 'export const a = 1;\n');
    git('add', '.'); git('commit', '-qm', 'base');
    git('mv', 'old name.mjs', 'новое имя.mjs');
    const tok = 'gsk' + '_' + body(52);
    writeFileSync(join(dir, 'новое имя.mjs'), `export const a = 1;\nexport const k = "${tok}";\n`);
    git('add', '.');
    const r = run();
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /secret pattern in staged diff/);
    assert.ok(!(r.stdout + r.stderr).includes(tok), 'the secret itself must not be printed');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI: clean staged change passes; syntax error and .env block', () => {
  const { dir, git, run } = repo();
  try {
    writeFileSync(join(dir, 'ok.mjs'), 'export const n = 42;\n');
    git('add', '.');
    const ok = run();
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /AI layer skipped \(AI_REVIEW=off\)/);
    git('commit', '-qm', 'ok');
    writeFileSync(join(dir, 'bad.mjs'), 'export const = ;\n');
    writeFileSync(join(dir, '.env'), 'X=1\n');
    git('add', '-f', '.');
    const bad = run();
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /bad\.mjs/);
    assert.match(bad.stderr, /secret-bearing file staged: \.env/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI: nothing staged → exits 0 quietly', () => {
  const { dir, run } = repo();
  try { assert.equal(run().status, 0); } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('every real token on one line is masked in the blocker message', async () => {
  const { secretHits } = await import('../scripts/ai-precommit-review.mjs');
  const a = 'sk-ant-' + 'A'.repeat(40), b = 'ghp_' + 'B'.repeat(36);
  const hits = secretHits(`+x = "${a}"; y = "${b}"\n`);
  assert.equal(hits.length, 1);
  assert.ok(!hits[0].includes('A'.repeat(20)) && !hits[0].includes('B'.repeat(20)), hits[0]);
});
