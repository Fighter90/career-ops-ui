#!/usr/bin/env node
/**
 * WS7 (v1.37.0) — pre-commit AI review.
 *
 * Two layers:
 *   1. DETERMINISTIC FLOOR (fail-HARD) — fast, no network, runs always:
 *      - no `.env` / secret-bearing file staged
 *      - no high-confidence secret pattern in the staged diff
 *      - no `.also(` leftover in staged `public/js/views/*` (the same
 *        invariant `scripts/check-no-also-leftovers.mjs` guards in CI)
 *      - every staged `.mjs`/`.js` parses (`node --check`)
 *   2. AI LAYER (fail-SOFT) — advisory only. Runs the `claude` CLI in
 *      non-interactive `-p` mode over the staged diff IF it is on PATH
 *      and `AI_REVIEW !== 'off'`. Missing CLI / no network / timeout →
 *      print a notice and DO NOT block (the deterministic floor already
 *      protected the commit; CI runs the full gate anyway).
 *
 * Honors CLAUDE.md hard rule #7 — this strengthens the hook, never
 * bypasses it; it never calls `--no-verify`.
 *
 * Testable: the pure check functions are exported and unit-tested in
 * tests/ai-precommit-review.test.mjs without a real repo or AI.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

// ── Deterministic checks (pure — exported for tests) ────────────────

// Global flags: every match on a line is examined (see secretHits).
const SECRET_PATTERNS = [
  /\bsk-ant-[A-Za-z0-9_-]{20,}/g,                          // Anthropic
  /\bsk-(?:proj|or-v1|svcacct|admin)-[A-Za-z0-9_-]{20,}/g, // OpenAI project/service, OpenRouter
  /\bsk-[A-Za-z0-9]{20,}\b/g,                             // OpenAI legacy
  /\bxai-[A-Za-z0-9]{20,}/g,                               // xAI
  /\bgsk_[A-Za-z0-9]{20,}/g,                               // Groq
  /\bgithub_pat_[A-Za-z0-9_]{22,}/g,                       // GitHub fine-grained PAT
  /\bgh[pousr]_[A-Za-z0-9]{30,}/g,                         // GitHub classic / OAuth / app tokens
  /\bAIza[0-9A-Za-z_-]{30,}/g,                             // Google / Gemini
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,                       // Slack
];

// A match that is itself a placeholder (`sk-or-v1-xxxxxxxx…`, `YOUR_KEY_HERE`,
// `xai-EXAMPLE…`). Judged on the TOKEN, never the whole line: a real key on a
// line that also says "example" or carries a `<tag>` is still a real key.
const PLACEHOLDER_TOKEN = /YOUR_|_HERE|example|placeholder|dummy|redacted|x{8,}|\*{4,}|\.{3}|…/i;

/** Files that must never be committed. */
export function blockedPaths(stagedFiles) {
  return stagedFiles.filter((f) => {
    if (/\.example$/.test(f)) return false;       // .env.example is allowed
    return /(^|\/)\.env(\.|$)/.test(f) ||
      /\.(pem|key|p12|pfx)$/.test(f) ||
      /(^|\/)id_(rsa|ed25519)$/.test(f);
  });
}

/**
 * Files exempt from the *content* secret scan. A secret DETECTOR and
 * its tests inherently contain secret-shaped literals (the regexes
 * themselves, fixtures asserting the detector fires) — scanning them
 * for secrets is a category error. The blocked-PATH check (.env /
 * .pem / id_rsa) still applies to every file regardless.
 */
export function secretScanExempt(path) {
  return (
    /(^|\/)tests\//.test(path) ||
    /\.test\.(mjs|js)$/.test(path) ||
    /scripts\/ai-precommit-review\.mjs$/.test(path) ||
    /(^|\/)\.githooks\//.test(path)
  );
}

/**
 * High-confidence secret strings in the added lines of a diff. Returns one
 * entry per offending line, with the token itself masked so the blocker
 * message never prints the secret it caught.
 */
export function secretHits(diffText) {
  const hits = [];
  for (const line of String(diffText).split('\n')) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    const body = line.slice(1);
    const found = new Set();
    for (const re of SECRET_PATTERNS) {
      for (const m of body.matchAll(re)) {
        if (!PLACEHOLDER_TOKEN.test(m[0])) found.add(m[0]);
      }
    }
    if (!found.size) continue;
    // Mask EVERY real token on the line — the blocker message is printed, and a
    // second key next to the first must not leak in clear text.
    let masked = body;
    for (const tok of found) masked = masked.split(tok).join(tok.slice(0, 7) + '…');
    hits.push(masked.trim().slice(0, 80));
  }
  return hits;
}

/**
 * `.also(` leftover in staged view files. MIRRORS
 * `scripts/check-no-also-leftovers.mjs` EXACTLY: line-by-line, skip
 * lines whose trimmed start is `//` or `*` (commented-out / JSDoc),
 * then `/\.also\(/`. A bare whole-file regex false-positived on a
 * historical comment in config.js (v1.39.0 incident) — the floor
 * MUST equal the CI gate, never be stricter.
 */
export function alsoLeftovers(stagedFiles, readFile) {
  const out = [];
  for (const f of stagedFiles) {
    if (!/public\/js\/views\/.*\.js$/.test(f)) continue;
    let src = '';
    try { src = readFile(f); } catch { continue; }
    for (const line of src.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
      if (/\.also\(/.test(line)) { out.push(f); break; }
    }
  }
  return out;
}

/**
 * Aggregate the deterministic floor. `secretDiffText` is the diff of
 * NON-exempt files only (caller filters via `secretScanExempt`);
 * `stagedFiles` is the full list (path + .also checks apply to all).
 */
export function deterministicFloor({ stagedFiles, secretDiffText, readFile }) {
  const blockers = [];
  const bp = blockedPaths(stagedFiles);
  if (bp.length) blockers.push(`secret-bearing file staged: ${bp.join(', ')}`);
  const sh = secretHits(secretDiffText);
  if (sh.length) blockers.push(`secret pattern in staged diff (${sh.length} line(s)) — e.g. "${sh[0]}"`);
  const al = alsoLeftovers(stagedFiles, readFile);
  if (al.length) blockers.push(`.also( leftover in staged view(s): ${al.join(', ')}`);
  return { blockers };
}

// ── CLI main (thin git/AI plumbing) ─────────────────────────────────

/**
 * `git diff --cached` listing of the files to check. R is included: a
 * renamed file with an edit is new content too. -z keeps paths raw
 * (no C-quoting of spaces / non-ASCII), so they can be read back.
 */
export const STAGED_LIST_ARGS = ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'];

/** Split NUL-separated `git … -z` output into paths. */
export function parseStagedList(out) {
  return String(out).split('\0').filter(Boolean);
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function syntaxBlockers(stagedFiles) {
  const out = [];
  for (const f of stagedFiles) {
    if (!/\.(mjs|js)$/.test(f) || !existsSync(f)) continue;
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
    catch (e) { out.push(`${f}: ${(e.stderr || e.message || '').toString().split('\n')[0]}`); }
  }
  return out;
}

function runAiLayer(diffText) {
  if (process.env.AI_REVIEW === 'off') { console.log('  · AI layer skipped (AI_REVIEW=off)'); return; }
  let claudeBin = '';
  try { claudeBin = execFileSync('command', ['-v', 'claude'], { shell: '/bin/bash', encoding: 'utf8' }).trim(); }
  catch { console.log('  · AI layer skipped (claude CLI not on PATH) — deterministic floor passed, CI runs full gate'); return; }
  if (!claudeBin) return;
  const dir = mkdtempSync(resolve(tmpdir(), 'ai-rev-'));
  const f = resolve(dir, 'diff.patch');
  writeFileSync(f, diffText.slice(0, 60_000));
  try {
    const prompt =
      'You are a strict pre-commit reviewer for an Express+vanilla-JS repo. ' +
      'Review ONLY this staged diff. Reply in <= 8 bullet lines: bugs, ' +
      'security, convention violations. If clean, reply "LGTM".\n\n' +
      readFileSync(f, 'utf8');
    const out = execFileSync(claudeBin, ['-p', prompt], { encoding: 'utf8', timeout: 90_000, maxBuffer: 8 * 1024 * 1024 });
    console.log('  · AI review (advisory):\n' + out.trim().split('\n').map((l) => '    ' + l).join('\n'));
  } catch (e) {
    console.log('  · AI layer fail-soft (' + ((e.message || 'error').split('\n')[0]) + ') — not blocking');
  }
}

function main() {
  let stagedFiles = [];
  try {
    stagedFiles = parseStagedList(git(STAGED_LIST_ARGS));
  } catch {
    console.log('ai-precommit-review: not a git repo / no staged changes — skipping');
    process.exit(0);
  }
  if (stagedFiles.length === 0) { process.exit(0); }
  const fullDiff = (() => { try { return git(['diff', '--cached', '--unified=0']); } catch { return ''; } })();
  // Secret CONTENT scan runs only over non-exempt files (the detector
  // + its tests legitimately contain secret-shaped literals).
  const secretFiles = stagedFiles.filter((f) => !secretScanExempt(f));
  const secretDiffText = secretFiles.length
    ? (() => { try { return git(['diff', '--cached', '--unified=0', '--', ...secretFiles]); } catch { return ''; } })()
    : '';

  console.log('▸ pre-commit review (' + stagedFiles.length + ' file(s))');
  const { blockers } = deterministicFloor({
    stagedFiles, secretDiffText, readFile: (f) => readFileSync(f, 'utf8'),
  });
  blockers.push(...syntaxBlockers(stagedFiles));

  if (blockers.length) {
    console.error('\n✗ commit BLOCKED — deterministic floor:');
    for (const b of blockers) console.error('  - ' + b);
    console.error('\nFix the cause (never use --no-verify — CLAUDE.md hard rule #7).');
    process.exit(1);
  }
  console.log('  ✓ deterministic floor clean (no secrets / .env / .also / syntax errors)');
  runAiLayer(fullDiff);
  console.log('✓ pre-commit review passed');
  process.exit(0);
}

// Run as CLI only when invoked directly (not when imported by tests).
import { fileURLToPath } from 'node:url';
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
