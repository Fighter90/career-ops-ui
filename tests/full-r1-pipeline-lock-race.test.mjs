/**
 * FULL-R1 (finding 2) — unlocked `data/pipeline.md` / `data/last-scan.json`
 * read-modify-write races.
 *
 * `routes/pipeline.mjs` (POST/DELETE/restore) already serializes every
 * pipeline.md read-modify-write through `withFileLock(PATHS.pipeline, …)`
 * (v1.20.1 H-6). Three other writers of the SAME file bypass that lock
 * entirely:
 *
 *   - `markPipelineRejected` in routes/auto-pipeline.mjs (reads, rewrites,
 *     saves pipeline.md with a plain readFileSync/writeFileSync pair)
 *   - `appendToPipeline` in en-scanner.mjs
 *   - `appendToPipeline` in ru-scanner.mjs
 *
 * and `saveLastScan` (en-scanner.mjs, shared by both scanners) does the
 * same unlocked read-modify-write on `data/last-scan.json`.
 *
 * Each test below proves the SPECIFIC race the backlog describes: a slow
 * lock-holding writer (standing in for a concurrent POST /api/pipeline,
 * DELETE /api/pipeline, or a second scanner phase) interleaved with one of
 * the four unlocked call sites loses the lock holder's — or the unlocked
 * writer's — update. Red before the fix (an assertion about which URL/key
 * survives fails); green after every call site is wrapped in
 * `withFileLock`.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { withFileLock, _resetLocks } from '../server/lib/file-lock.mjs';

// FULL-R1 CodeQL — host+pathname compare, not substring containment on a URL
// literal (js/incomplete-url-substring-sanitization), and strictly stronger:
// an unrelated URL that merely CONTAINS the token now fails.
function hasExactUrl(raw, host, path) {
  try { const p = new URL(raw); return p.host === host && p.pathname === path; } catch { return false; }
}

let dir, PATHS, runEnScan, runRuScan, saveLastScan, parsePipeline, addPipelineUrl, createApp, server, baseUrl;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  dir = mkdtempSync(resolve(tmpdir(), 'pipeline-lock-race-'));
  for (const d of ['config', 'data', 'modes', 'reports']) mkdirSync(resolve(dir, d), { recursive: true });
  writeFileSync(resolve(dir, 'cv.md'), '# cv\n');
  writeFileSync(resolve(dir, 'config', 'profile.yml'), 'candidate:\n  full_name: Test\n');
  writeFileSync(resolve(dir, 'modes', 'oferta.md'), '# Oferta\n');
  writeFileSync(resolve(dir, 'data', 'applications.md'), '');
  process.env.CAREER_OPS_ROOT = dir;
  ({ PATHS } = await import('../server/lib/paths.mjs'));
  ({ runEnScan, saveLastScan } = await import('../server/lib/en-scanner.mjs'));
  ({ runRuScan } = await import('../server/lib/ru-scanner.mjs'));
  ({ parsePipeline, addPipelineUrl } = await import('../server/lib/parsers.mjs'));
  ({ createApp } = await import('../server/index.mjs'));
  server = createApp();
  await new Promise((r) => {
    server = server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      r();
    });
  });
});

after(async () => {
  await new Promise((r) => server.close(r));
  delete process.env.CAREER_OPS_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  _resetLocks();
  writeFileSync(PATHS.pipeline, '# Pipeline — Pending URLs\n\n```\n```\n');
  writeFileSync(resolve(dir, 'portals.yml'), [
    'tracked_companies:',
    '  - name: GH-Co',
    '    careers_url: https://job-boards.greenhouse.io/ghco',
    '    api: https://boards-api.greenhouse.io/v1/boards/ghco/jobs',
    '    enabled: true',
    'title_filter:',
    '  positive: []',
    '  negative: []',
  ].join('\n'));
});

// A manual "slow lock holder" standing in for a concurrent POST/DELETE
// /api/pipeline: acquires the SAME withFileLock(PATHS.pipeline) key,
// reads, waits, appends its own line, writes. Because `withFileLock`'s
// synchronous prelude (LOCKS.get/LOCKS.set) runs before any `await`,
// calling this BEFORE the scanner/markPipelineRejected guarantees it
// claims the lock slot first — deterministic ordering without a real
// race window.
function slowLockedPipelineWrite(url, delayMs) {
  return withFileLock(PATHS.pipeline, async () => {
    let content = '';
    try { content = readFileSync(PATHS.pipeline, 'utf8'); } catch {}
    await sleep(delayMs);
    // addPipelineUrl correctly inserts into a NON-empty fence (unlike a
    // naive "replace the empty ```\n``` pair" regex, which silently does
    // nothing once a test has pre-populated the fence with another URL).
    const updated = addPipelineUrl(content, url);
    writeFileSync(PATHS.pipeline, updated);
    return updated;
  });
}

test('en-scanner appendToPipeline (via runEnScan) does not lose a concurrent locked pipeline.md write', async () => {
  const fakeFetch = async () => new Response(JSON.stringify({
    jobs: [{
      id: 1, title: 'Senior Engineer', company_name: 'GH-Co',
      absolute_url: 'https://job-boards.greenhouse.io/ghco/jobs/1',
      location: { name: 'Remote' }, first_published: '2026-01-01',
    }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  const locked = slowLockedPipelineWrite('https://example.com/locked-writer', 80);
  const scan = runEnScan({ fetchImpl: fakeFetch, writeFiles: true });
  await Promise.all([locked, scan]);

  const content = readFileSync(PATHS.pipeline, 'utf8');
  const urls = parsePipeline(content);
  assert.ok(
    urls.some((u) => hasExactUrl(u, 'example.com', '/locked-writer')),
    `the concurrent locked writer's URL must survive the scanner's append — got: ${JSON.stringify(urls)}`,
  );
  assert.ok(
    urls.some((u) => hasExactUrl(u, 'job-boards.greenhouse.io', '/ghco/jobs/1')),
    `the scanner's fresh URL must survive the concurrent locked write — got: ${JSON.stringify(urls)}`,
  );
});

test('ru-scanner appendToPipeline does not lose a concurrent locked pipeline.md write', async () => {
  writeFileSync(resolve(dir, 'portals.yml'), 'tracked_companies: []\n');
  // The default RU config fans out to all 5 sources; only hh.ru needs to
  // yield a real, un-filtered hit for `fresh.length > 0` (which is what
  // actually triggers appendToPipeline — an empty result would make this
  // test pass trivially, proving nothing).
  const fakeFetch = async (url) => {
    if (url.startsWith('https://hh.ru/search/vacancy')) {
      return new Response(
        '<div data-qa="vacancy-serp__vacancy"><a data-qa="serp-item__title" href="https://hh.ru/vacancy/9001">Senior Go Engineer</a><a data-qa="vacancy-serp__vacancy-employer-text">RU Co</a><span data-qa="vacancy-serp__vacancy-address">Москва</span></div>',
        { status: 200, headers: { 'content-type': 'text/html' } },
      );
    }
    if (url.startsWith('https://opendata.trudvsem.ru/')) {
      return new Response(JSON.stringify({ status: 200, results: { vacancies: [] } }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    // habr / getmatch / geekjob: empty HTML result, no hits.
    return new Response('<html><body>no results</body></html>', {
      status: 200, headers: { 'content-type': 'text/html' },
    });
  };

  const locked = slowLockedPipelineWrite('https://example.com/ru-locked-writer', 80);
  const scan = runRuScan({ fetchImpl: fakeFetch, writeFiles: true });
  await Promise.all([locked, scan]);

  const content = readFileSync(PATHS.pipeline, 'utf8');
  const urls = parsePipeline(content);
  assert.ok(
    urls.some((u) => hasExactUrl(u, 'example.com', '/ru-locked-writer')),
    `the concurrent locked writer's URL must survive the RU scanner's run — got: ${JSON.stringify(urls)}`,
  );
  assert.ok(
    urls.some((u) => hasExactUrl(u, 'hh.ru', '/vacancy/9001')),
    `the RU scanner's own fresh URL must survive the concurrent locked write — got: ${JSON.stringify(urls)}`,
  );
});

test('markPipelineRejected (auto-pipeline) does not lose, and is not lost by, a concurrent locked pipeline.md write', async () => {
  // The domain-root rejection path (`new URL(url).pathname` <= 1 char
  // after trailing slashes) fires BEFORE any fetch/LLM call, so this needs
  // no network and no key.
  const rejectUrl = 'https://job-boards.greenhouse.io/';
  writeFileSync(PATHS.pipeline, `# Pipeline — Pending URLs\n\n\`\`\`\n${rejectUrl}\n\`\`\`\n`);

  const locked = slowLockedPipelineWrite('https://example.com/reject-race-writer', 80);
  const post = fetch(baseUrl + '/api/auto-pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: rejectUrl }),
  }).then((r) => r.text());

  await Promise.all([locked, post]);

  const content = readFileSync(PATHS.pipeline, 'utf8');
  assert.match(
    content,
    /https:\/\/example\.com\/reject-race-writer/,
    `the concurrent locked writer's URL must survive markPipelineRejected — got:\n${content}`,
  );
  assert.match(
    content,
    /## Rejected[\s\S]*job-boards\.greenhouse\.io/,
    `the rejected URL must be moved into the ## Rejected section — got:\n${content}`,
  );
  // And it must have left the fence — the timer must not re-pick it up.
  const fenceUrls = parsePipeline(content);
  assert.ok(!fenceUrls.includes(rejectUrl), `the rejected URL must leave the fence — got: ${JSON.stringify(fenceUrls)}`);
});

test('saveLastScan does not lose a concurrent locked last-scan.json write', async () => {
  const lastScanPath = resolve(dir, 'data', 'last-scan.json');
  try { rmSync(lastScanPath); } catch {}

  // Deterministic choreography rather than a bare timer: saveLastScan is
  // (pre-fix) a fully SYNCHRONOUS function, while the manual lock holder is
  // async and `withFileLock`'s first `await` always defers its own critical
  // section by at least one microtask turn — so a plain "start both, add a
  // delay" race lets the synchronous call run to completion before the
  // async holder's body even starts, which passes for the wrong reason
  // (never proving the lock). Explicit signals pin the interleaving that
  // actually matters: the holder has READ the file and is paused mid
  // critical-section when the second writer runs.
  let releaseHold;
  const holdGate = new Promise((r) => { releaseHold = r; });
  let signalRead;
  const readGate = new Promise((r) => { signalRead = r; });

  // Stand-in for a second concurrent snapshot writer (e.g. a second scan
  // phase, or a future caller) — same file, same withFileLock key the fix
  // must share with saveLastScan.
  const lockedWriter = withFileLock(lastScanPath, async () => {
    let prev = { en: null, ru: null };
    try { prev = JSON.parse(readFileSync(lastScanPath, 'utf8')); } catch {}
    signalRead();
    await holdGate; // stay inside the critical section until the test says go
    prev.ru = { marker: 'locked-writer' };
    writeFileSync(lastScanPath, JSON.stringify(prev, null, 2));
    return prev;
  });

  await readGate; // the holder has read; post-fix it also now holds the lock
  const save = saveLastScan({ kind: 'en', when: '2026-01-01T00:00:00.000Z', fresh: [], filtered: [], errors: [] });
  // Give the (pre-fix, unlocked) saveLastScan's synchronous body a turn to
  // run to completion before the holder resumes and overwrites it.
  await sleep(20);
  releaseHold();
  await Promise.all([lockedWriter, save]);

  assert.ok(existsSync(lastScanPath), 'last-scan.json must exist after both writers finish');
  const final = JSON.parse(readFileSync(lastScanPath, 'utf8'));
  assert.ok(final.ru && final.ru.marker === 'locked-writer', `the concurrent locked writer's ru key must survive — got: ${JSON.stringify(final)}`);
  assert.ok(final.en && final.en.kind === 'en', `saveLastScan's own en key must survive — got: ${JSON.stringify(final)}`);
});
