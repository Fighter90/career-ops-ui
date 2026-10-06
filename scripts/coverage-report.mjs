#!/usr/bin/env node
/**
 * Coverage ratchet for server/ and public/.
 *
 * Runs `node --test --experimental-test-coverage` over the same file set as
 * `npm run test:coverage` (read from package.json, so the two never drift),
 * parses Node's tree-formatted coverage table, and prints line / branch /
 * funcs per directory and per file for server/ and public/ only.
 *
 * Gate: exits 1 when the unweighted mean of those files, or any file not
 * listed as exempt, is below the --line / --branch thresholds. Defaults come
 * from the committed scripts/coverage-baseline.json — the means measured when
 * it was last written, rounded DOWN, plus the files that were already under
 * them (grandfathered). Raising the floor is a deliberate `--write-baseline`;
 * it never drops on its own.
 *
 *   node scripts/coverage-report.mjs                    # run tests + gate
 *   node scripts/coverage-report.mjs --from out.txt     # parse a saved run
 *   node scripts/coverage-report.mjs --save out.txt     # keep the raw output
 *   node scripts/coverage-report.mjs --line 85 --branch 75
 *   node scripts/coverage-report.mjs --write-baseline   # re-measure the floor
 *
 * The table: directories are rows with empty columns, and depth is one space
 * of indentation per level after the reporter prefix (`# ` for TAP, `ℹ ` for
 * spec), so file paths are rebuilt from a directory stack.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(REPO, 'scripts', 'coverage-baseline.json');
const SCOPES = ['server/', 'public/'];

/** Strip the reporter prefix (`# ` TAP, `ℹ ` spec); null for other lines. */
function tableText(line) {
  const m = line.match(/^(?:#|ℹ) ?(.*)$/);
  return m ? m[1] : null;
}

const num = (s) => {
  const v = Number.parseFloat(s);
  return Number.isFinite(v) ? v : null;
};

/**
 * Parse the coverage table out of a test-runner transcript.
 * @returns {{ rows: {file:string,line:number,branch:number,funcs:number}[], all: {line:number,branch:number,funcs:number}|null }}
 */
export function parseCoverageTable(text) {
  const lines = String(text).split(/\r?\n/);
  const start = lines.findIndex((l) => /start of coverage report/.test(l));
  if (start < 0) throw new Error('no coverage table found in the test output');
  const rows = [];
  const stack = [];
  let all = null;
  for (let i = start + 1; i < lines.length; i++) {
    const body = tableText(lines[i]);
    if (body == null) continue;
    if (/end of coverage report/.test(body)) break;
    const cols = body.split('|');
    if (cols.length < 4) continue;              // ruler lines
    const nameCol = cols[0];
    const name = nameCol.trim();
    if (!name || name === 'file') continue;     // header
    const [line, branch, funcs] = cols.slice(1, 4).map(num);
    if (name === 'all files') {
      all = { line, branch, funcs };
      continue;
    }
    const depth = nameCol.length - nameCol.trimStart().length;
    stack.length = depth;
    if (line == null && branch == null && funcs == null) {
      stack[depth] = name;                       // a directory row
      continue;
    }
    rows.push({ file: [...stack.slice(0, depth), name].join('/'), line, branch, funcs });
  }
  return { rows, all };
}

/** Only the product code: server/ and public/. */
export function scopeRows(rows) {
  return rows.filter((r) => SCOPES.some((s) => r.file.startsWith(s)));
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Unweighted means per direct parent directory, and over all rows. */
export function summarize(rows) {
  const groups = new Map();
  for (const r of rows) {
    const d = r.file.includes('/') ? r.file.slice(0, r.file.lastIndexOf('/')) : '.';
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d).push(r);
  }
  const dirs = new Map();
  for (const [d, rs] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    dirs.set(d, {
      files: rs.length,
      line: mean(rs.map((r) => r.line)),
      branch: mean(rs.map((r) => r.branch)),
      funcs: mean(rs.map((r) => r.funcs)),
    });
  }
  return {
    dirs,
    mean: {
      line: mean(rows.map((r) => r.line)),
      branch: mean(rows.map((r) => r.branch)),
      funcs: mean(rows.map((r) => r.funcs)),
    },
  };
}

/**
 * Gate rows against { line, branch, exempt }.
 * `below` lists every file under either threshold; `failing` drops the exempt.
 */
export function evaluate(rows, { line, branch, exempt = [] }) {
  const ex = new Set(exempt);
  const { mean: m } = summarize(rows);
  const below = rows.filter((r) => r.line < line || r.branch < branch);
  const failing = below.filter((r) => !ex.has(r.file));
  const meanOk = m.line >= line && m.branch >= branch;
  return { mean: m, below, failing, meanOk, ok: meanOk && failing.length === 0 };
}

/** A fresh ratchet: means rounded down, files already under them exempt. */
export function baselineFrom(rows) {
  const { mean: m } = summarize(rows);
  const line = Math.floor(m.line);
  const branch = Math.floor(m.branch);
  const exempt = rows.filter((r) => r.line < line || r.branch < branch).map((r) => r.file).sort();
  return { line, branch, exempt };
}

/** CLI flags → options object. */
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s);
    const value = () => (inline !== undefined ? inline : argv[++i]);
    if (flag === '--line' || flag === '--branch') {
      const v = Number(value());
      if (!Number.isFinite(v)) throw new Error(`${flag} needs a number`);
      out[flag.slice(2)] = v;
    } else if (flag === '--from' || flag === '--save') {
      out[flag.slice(2)] = value();
    } else if (flag === '--write-baseline') {
      out.writeBaseline = true;
    } else {
      throw new Error(`unknown flag ${argv[i]}`);
    }
  }
  return out;
}

/** The file globs after `--experimental-test-coverage` in an npm script. */
export function testArgsFromScript(script) {
  const parts = String(script).trim().split(/\s+/);
  const at = parts.indexOf('--experimental-test-coverage');
  if (at < 0) throw new Error('test:coverage script has no --experimental-test-coverage');
  return parts.slice(at + 1);
}

function runCoverage() {
  const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'));
  const files = testArgsFromScript(pkg.scripts['test:coverage']);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--test', '--experimental-test-coverage', ...files], {
      cwd: REPO, stdio: ['ignore', 'pipe', 'inherit'],
    });
    const chunks = [];
    child.stdout.on('data', (c) => chunks.push(c));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, text: Buffer.concat(chunks).toString('utf8') }));
  });
}

const pct = (v) => (v == null ? '   -  ' : v.toFixed(2).padStart(6));

function printReport(rows, verdict, opts) {
  const { dirs } = summarize(rows);
  const w = Math.max(...rows.map((r) => r.file.length), 9);
  const head = (label) => `${label.padEnd(w)} | line % | branch % | funcs %`;
  console.log(`\nPer directory (unweighted mean of its files; server/ + public/ only)\n${head('directory')}`);
  for (const [d, s] of dirs) {
    console.log(`${`${d}/ (${s.files})`.padEnd(w)} | ${pct(s.line)} |   ${pct(s.branch)} |  ${pct(s.funcs)}`);
  }
  console.log(`\nPer file\n${head('file')}`);
  for (const r of rows) console.log(`${r.file.padEnd(w)} | ${pct(r.line)} |   ${pct(r.branch)} |  ${pct(r.funcs)}`);
  const ex = new Set(opts.exempt || []);
  console.log(`\nUnder line ${opts.line}% / branch ${opts.branch}%: ${verdict.below.length} file(s)`);
  for (const r of verdict.below) {
    console.log(`  ${ex.has(r.file) ? 'exempt ' : 'FAIL   '} ${r.file}  line ${pct(r.line)}  branch ${pct(r.branch)}`);
  }
  console.log(`\nMean over ${rows.length} files: line ${verdict.mean.line.toFixed(2)}%  branch ${verdict.mean.branch.toFixed(2)}%  funcs ${verdict.mean.funcs.toFixed(2)}%`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let text;
  let testCode = 0;
  if (args.from) {
    text = readFileSync(args.from, 'utf8');
  } else {
    ({ code: testCode, text } = await runCoverage());
    if (args.save) writeFileSync(args.save, text);
  }
  const rows = scopeRows(parseCoverageTable(text).rows);
  if (!rows.length) throw new Error('coverage table has no server/ or public/ rows');

  if (args.writeBaseline) {
    const b = baselineFrom(rows);
    writeFileSync(BASELINE, JSON.stringify(b, null, 2) + '\n');
    console.log(`wrote ${BASELINE}: line ${b.line}% branch ${b.branch}%, ${b.exempt.length} exempt file(s)`);
    return 0;
  }
  let base = { line: 0, branch: 0, exempt: [] };
  try { base = JSON.parse(readFileSync(BASELINE, 'utf8')); } catch { /* no baseline → flags only */ }
  const opts = {
    line: args.line ?? base.line,
    branch: args.branch ?? base.branch,
    exempt: base.exempt || [],
  };
  const verdict = evaluate(rows, opts);
  printReport(rows, verdict, opts);
  if (testCode !== 0) console.log(`\nFAIL: the test run itself exited ${testCode}`);
  if (!verdict.meanOk) console.log(`FAIL: mean is under line ${opts.line}% / branch ${opts.branch}%`);
  if (verdict.failing.length) console.log(`FAIL: ${verdict.failing.length} non-exempt file(s) under threshold`);
  return verdict.ok && testCode === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; }, (e) => {
    console.error(`coverage-report: ${e.message}`);
    process.exitCode = 1;
  });
}
