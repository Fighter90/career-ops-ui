#!/usr/bin/env node
// Workflow-eval runner.
//
// Grades the REPOSITORY-STATE half of evals/workflow/tasks.yml — the graders that can
// be decided from the tree as it stands, with no agent run. They are the regression
// net for the rules in docs/adr/ and PROGRESS.md: each one corresponds to a mistake
// that actually shipped once.
//
// Trajectory graders (which commands an agent ran, in what order) need a recorded
// agent session and are reported as SKIP here rather than silently passing — a grader
// that cannot run must never read as green.
//
// Usage: node evals/workflow/run.mjs [--task <id>]

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const only = process.argv.includes('--task') ? process.argv[process.argv.indexOf('--task') + 1] : null;

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const results = [];
const record = (task, grader, status, detail) => results.push({ task, grader, status, detail });

/** Counts must come from the live registry, never from a literal in a doc. */
async function registryCounts() {
  const [s, p] = await Promise.all([
    import(join(ROOT, 'server/lib/sources/registry.mjs')),
    import(join(ROOT, 'server/lib/portals/registry.mjs')),
  ]);
  return {
    sources: s.SOURCES.length,
    en: s.SOURCES.filter((x) => x.region === 'en').length,
    ru: s.SOURCES.filter((x) => x.region === 'ru').length,
    adapters: p.ALL_ADAPTERS.length,
  };
}

function currentVersion() {
  return JSON.parse(read('package.json')).version;
}

// ── graders ────────────────────────────────────────────────────────────────────

async function gradeCountsFrozen() {
  const t = 'counts-frozen-on-fix-release';
  const c = await registryCounts();
  const ok = c.sources === c.en + c.ru && c.adapters === c.en;
  record(t, 'registry self-consistency', ok ? 'PASS' : 'FAIL',
    `sources=${c.sources} en=${c.en} ru=${c.ru} adapters=${c.adapters}` +
    (ok ? ' (sources = en+ru, adapters = en)' : ' — the two registries disagree'));

  // The five sources without an adapter must be exactly the RU five (see CONTEXT.md).
  const [s, p] = await Promise.all([
    import(join(ROOT, 'server/lib/sources/registry.mjs')),
    import(join(ROOT, 'server/lib/portals/registry.mjs')),
  ]);
  const av = new Set(p.ALL_ADAPTERS.map((a) => a.id));
  const noAdapter = s.SOURCES.filter((x) => !av.has(x.value));
  const allRu = noAdapter.length === 5 && noAdapter.every((x) => x.region === 'ru');
  record(t, 'sources without an adapter are exactly the RU five', allRu ? 'PASS' : 'FAIL',
    noAdapter.map((x) => `${x.value}(${x.region})`).join(', '));
}

function gradeQaPrompt() {
  const t = 'qa-prompt-mandatory';
  const v = currentVersion();
  const want = `qa/QA-REGRESSION-PROMPT-v${v}.md`;
  record(t, 'QA prompt exists for the current version', existsSync(join(ROOT, want)) ? 'PASS' : 'FAIL', want);

  const live = readdirSync(join(ROOT, 'qa')).filter((f) => /^QA-REGRESSION-PROMPT-v/.test(f));
  record(t, 'exactly one live QA prompt', live.length === 1 ? 'PASS' : 'FAIL', live.join(', ') || 'none');
}

function gradeSiteMirrors() {
  const t = 'site-build-after-fanout';
  const v = currentVersion();
  const dir = join(ROOT, 'site/src/content/changelog');
  if (!existsSync(dir)) return record(t, 'site mirrors carry the current version', 'SKIP', 'no site/ content dir');
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  const missing = files.filter((f) => !readFileSync(join(dir, f), 'utf8').includes(v));
  record(t, 'every site mirror carries the current version', missing.length === 0 ? 'PASS' : 'FAIL',
    missing.length ? `stale: ${missing.join(', ')}` : `${files.length}/${files.length} at ${v}`);
}

function gradeNoBlanketSweep() {
  const t = 'no-blanket-version-sweep';
  // A historical attribution names an OLD version on purpose. If a sweep rewrote them
  // all to the current version, every "as of"/"since" line would name it — the tell.
  const v = currentVersion();
  const conv = read('docs/sdd/CONVENTIONS.md');
  const m = conv.match(/Current count as of \*\*v([0-9.]+)\*\*: \*\*(\d+)\*\*/);
  record(t, 'CONVENTIONS baseline names the current version', m && m[1] === v ? 'PASS' : 'FAIL',
    m ? `as of v${m[1]}: ${m[2]} (package.json says ${v})` : 'baseline line not found');

  // PROJECT-CONTEXT keeps a chain of per-release records; the previous one must still
  // name ITS own test count, not the current one.
  const ctx = read('.claude/PROJECT-CONTEXT.md');
  const arrows = [...ctx.matchAll(/(\d{4}) → (\d{4}) tests/g)].map((x) => [x[1], x[2]]);
  const chained = arrows.length < 2 || arrows.every(([, to], i) => i === 0 || arrows[i - 1][0] === to);
  record(t, 'per-release test-count chain is continuous', chained ? 'PASS' : 'FAIL',
    arrows.slice(0, 4).map((a) => a.join('→')).join(', ') || 'no records');

  // The chain being internally consistent is not enough: it stays consistent even if
  // the NEWEST record's end count is wrong. Anchor the head of the chain to the
  // CONVENTIONS baseline, which is the number a release actually has to move.
  // (Found by injecting `3164 → 9999` and watching the chain grader pass anyway.)
  const head = arrows.length ? arrows[0][1] : null;
  const baseline = m ? m[2] : null;
  record(t, 'newest record ends at the CONVENTIONS baseline', head && baseline && head === baseline ? 'PASS' : 'FAIL',
    head && baseline ? `PROJECT-CONTEXT head ${head} vs CONVENTIONS ${baseline}` : 'one of the two not found');
}

function gradeLocaleFanout() {
  const t = 'locale-fanout-integrity';
  const v = currentVersion();
  const locales = ['es','pt-BR','ko-KR','ja','ru','zh-CN','zh-TW','fr','pl','uk','da','ar','de','it','tr','hi'];
  const bad = locales.filter((l) => {
    const f = join(ROOT, `CHANGELOG.${l}.md`);
    if (!existsSync(f)) return true;
    // Plain string comparison, not a regex built from `v`: escaping only `.` and
    // not the backslash is incomplete sanitisation (CodeQL js/incomplete-sanitization),
    // and a literal prefix match is what this grader actually means anyway.
    const prefix = `## [${v}]`;
    const n = readFileSync(f, 'utf8').split('\n').filter((line) => line.startsWith(prefix)).length;
    return n !== 1;
  });
  record(t, 'exactly one new entry in each of 16 locales', bad.length === 0 ? 'PASS' : 'FAIL',
    bad.length ? `wrong count: ${bad.join(', ')}` : `16/16 at ${v}`);

  // An English section label surviving in a non-English changelog is a translation miss.
  const leaked = locales.filter((l) => {
    const f = join(ROOT, `CHANGELOG.${l}.md`);
    if (!existsSync(f)) return false;
    const body = readFileSync(f, 'utf8').split(`## [${v}]`)[1]?.split('\n## [')[0] ?? '';
    return /^### (Fixed|Added|Security)$/m.test(body); // "Notes" is also French — excluded
  });
  record(t, 'no English section labels in translated entries', leaked.length === 0 ? 'PASS' : 'FAIL',
    leaked.join(', ') || 'clean');
}

function gradeDivergences() {
  const t = 'parity-defend-divergence';
  // The fork's divergences live in the PARENT repo, one level up.
  const parent = join(ROOT, '..');
  const tc = join(parent, 'providers/telegram-channel.mjs');
  if (!existsSync(tc)) return record(t, 'fork divergences intact', 'SKIP', 'parent checkout not present');
  const src = readFileSync(tc, 'utf8');
  // Assert the SHAPE, not a count: a count is ambiguous (4 lines / 7 occurrences) and
  // silently drifts on any unrelated edit. What matters is that the boundaries are
  // Unicode-property lookarounds with the /u flag, and that the ASCII form is gone —
  // \b and \w never fire next to Cyrillic, which is the whole bug (ADR-0002).
  const line = (src.match(/^const LOCATIONISH_RE = .*$/m) || [''])[0];
  const unicodeForm = line.includes('(?<![\\p{L}\\p{N}])') && line.includes('(?![\\p{L}\\p{N}])') && /\/[a-z]*u[a-z]*;?\s*$/.test(line);
  const asciiForm = /\/\\b\(/.test(line) || line.includes('\\w*|');
  record(t, 'Cyrillic LOCATIONISH_RE keeps Unicode boundaries (ADR-0002)',
    unicodeForm && !asciiForm ? 'PASS' : 'FAIL',
    unicodeForm && !asciiForm ? 'lookarounds + /u flag present, ASCII form absent' : `reverted or reshaped: ${line.slice(0, 90)}`);
  record(t, 'providers/telegram.mjs still present (ADR-0001)',
    existsSync(join(parent, 'providers/telegram.mjs')) ? 'PASS' : 'FAIL', '');
}

function gradeNoPortRecorded() {
  const t = 'parity-scope-noport';
  const v = currentVersion();
  const entry = read('CHANGELOG.md').split(`## [${v}]`)[1]?.split('\n## [')[0] ?? '';
  const hasNotes = /### Notes/.test(entry);
  record(t, 'release entry carries a Notes section', hasNotes ? 'PASS' : 'FAIL', '');
  // A parity release explains its no-ports (relay / not mirrored / not followed); a
  // patch from an external QA pass explains what could NOT be verified from outside
  // and was recorded rather than claimed. Both are the same discipline — a deliberate
  // non-action with its reason written down — so both phrasings satisfy the grader.
  const explains = /relay|not mirrored|Not ported|not followed|not closable|recorded rather than claimed/i.test(entry);
  record(t, 'Notes explain what was not ported and why', explains ? 'PASS' : 'FAIL', '');
}

function reportTrajectorySkips() {
  const spec = read('evals/workflow/tasks.yml');
  const n = (spec.match(/^\s+trajectory:/gm) || []).length;
  record('(trajectory)', 'command-path graders', 'SKIP',
    `${n} trajectory grader group(s) need a recorded agent session — not decidable from the tree`);
}

// ── main ───────────────────────────────────────────────────────────────────────

await gradeCountsFrozen();
gradeQaPrompt();
gradeSiteMirrors();
gradeNoBlanketSweep();
gradeLocaleFanout();
gradeDivergences();
gradeNoPortRecorded();
reportTrajectorySkips();

const shown = only ? results.filter((r) => r.task === only) : results;
const pad = (s, n) => String(s).padEnd(n);
let fails = 0;
console.log(`\nworkflow evals — repo state @ v${currentVersion()} (${git('rev-parse', '--short', 'HEAD')})\n`);
for (const r of shown) {
  if (r.status === 'FAIL') fails++;
  const mark = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '·';
  console.log(`  ${mark} ${pad(r.task, 30)} ${pad(r.grader, 52)} ${r.detail}`);
}
const pass = shown.filter((r) => r.status === 'PASS').length;
const skip = shown.filter((r) => r.status === 'SKIP').length;
console.log(`\n  ${pass} pass · ${fails} fail · ${skip} skip\n`);
process.exit(fails ? 1 : 0);
