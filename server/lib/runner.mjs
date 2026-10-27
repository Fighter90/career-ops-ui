/**
 * Subprocess runner for career-ops CLI scripts.
 * Provides both buffered (run) and streaming (stream via SSE) modes.
 */
import { spawn } from 'node:child_process';
import { PROJECT_ROOT, PATHS } from './paths.mjs';
import { withFileLock } from './file-lock.mjs';

// Grace period after SIGTERM before we escalate to SIGKILL. Long enough
// for a well-behaved script to flush stdout and exit, short enough that
// a stuck child doesn't hold a connection slot indefinitely (REVIEW-A2).
const KILL_GRACE_MS = 5_000;

// Default ceiling for streaming endpoints (REVIEW-A3). Buffered runs use
// `opts.timeoutMs` (no default) so route handlers stay in control.
const STREAM_DEFAULT_MAX_MS = 30 * 60 * 1000; // 30 minutes

/**
 * SIGTERM the child, then SIGKILL after KILL_GRACE_MS if it hasn't exited.
 * Returns the watchdog timer so callers can clear it on natural exit.
 */
function killWithEscalation(child, graceMs = KILL_GRACE_MS) {
  try { child.kill('SIGTERM'); } catch {}
  return setTimeout(() => {
    // `child.killed` flips to true the moment SIGTERM is *delivered*, not when the
    // child exits — testing it here made this escalation dead code, so a script
    // that traps SIGTERM (Playwright installs a handler) hung the request forever.
    if (child.exitCode === null && child.signalCode === null) {
      try { child.kill('SIGKILL'); } catch {}
    }
  }, graceMs);
}

/**
 * Run a node script, return { code, stdout, stderr, killed? } when done.
 * Resolves even on non-zero exit (caller decides what to do).
 *
 * Timeout semantics (REVIEW-A2): on `opts.timeoutMs` expiry we send
 * SIGTERM, then escalate to SIGKILL after KILL_GRACE_MS. The promise
 * always resolves — never hangs.
 */
/**
 * FULL-M1 — the one roster of parent scripts that rewrite a shared data
 * file, mapped to the PATHS key of the file each one writes. The parent
 * tree is read-only for web-ui, so a spawned script cannot take
 * `withFileLock` itself — the lock has to wrap the SPAWN in the route.
 * Only merge-tracker.mjs / set-status.mjs take the parent's own OS-level
 * tracker lock (and followup-seed.mjs a follow-ups-scoped one);
 * dedup-tracker.mjs and normalize-statuses.mjs take nothing, and none of
 * them can serialize against web-ui's in-process tracker writers without
 * sharing this lock chain.
 *
 * Accepted residual (single-user app): a tracker write from a CLI outside
 * web-ui still races a web-ui write — the OS lock covers only the parent
 * scripts that opt in, and this in-process lock covers only spawns
 * web-ui itself makes.
 *
 * FULL-M1 review F2 — SCOPE: TRACKER_MUTATING covers TRACKER-scoped
 * mutations (data/applications.md + data/follow-ups.md) only. Other
 * shared-file spawners stay outside by design: POST /api/run/reconcile
 * (rewrites data/pipeline.md — the pipeline fence has its own
 * FULL-R1 lock contract) and assessments.mjs's assessment-log.mjs
 * (append-only TSV). Do not assume this roster is "all parent scripts".
 */
export const TRACKER_MUTATING = new Map([
  ['merge-tracker.mjs', 'applications'],
  ['dedup-tracker.mjs', 'applications'],
  ['normalize-statuses.mjs', 'applications'],
  ['set-status.mjs', 'applications'],
  ['outcome.mjs', 'applications'],
  ['followup-seed.mjs', 'followUps'],
]);

/**
 * Run a parent script; when it is in TRACKER_MUTATING, hold the lock for
 * the shared file it mutates around the WHOLE spawn, so two
 * web-ui-triggered mutations — and a spawn racing web-ui's own in-process
 * tracker writers — serialize on the same lock chain. Everything else
 * passes through to runNodeScript unchanged.
 *
 * @template T
 * @param {string} scriptName — parent script, e.g. 'merge-tracker.mjs'
 * @param {string[]} args
 * @param {object} [opts] — forwarded to the runner (timeoutMs, signal, env)
 * @param {(scriptName: string, args: string[], opts: object) => Promise<T>} [runner]
 *   — injectable for tests; defaults to runNodeScript
 * @returns {Promise<T>}
 */
export function runTrackedScript(scriptName, args = [], opts = {}, runner = runNodeScript) {
  const fileKey = TRACKER_MUTATING.get(scriptName);
  if (!fileKey || !PATHS[fileKey]) return runner(scriptName, args, opts);
  return withFileLock(PATHS[fileKey], () => runner(scriptName, args, opts));
}

export function runNodeScript(scriptName, args = [], opts = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(process.execPath, [scriptName, ...args], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, ...(opts.env || {}) },
      });
    } catch (err) {
      // spawn throws synchronously for an arg it cannot pass (a NUL byte, an
      // invalid type). Inside a Promise executor that rejected the promise, and
      // from an async Express 4 handler an unhandled rejection exits the server.
      resolve({ code: -1, stdout: '', stderr: String(err?.message || err) });
      return;
    }
    // CAR-92 — a caller-supplied abort signal (the SSE route's req-close
    // controller) terminates the child, so a client disconnect stops the
    // subprocess (and its spend) instead of letting it run to completion.
    if (opts.signal) {
      const kill = () => { try { child.kill('SIGTERM'); } catch { /* already gone */ } };
      if (opts.signal.aborted) kill();
      else opts.signal.addEventListener('abort', kill, { once: true });
    }
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killWatchdog = null;
    // setEncoding keeps a multibyte character that straddles two chunks intact
    // (a per-chunk toString() turned it into U+FFFD).
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));

    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          killWatchdog = killWithEscalation(child, opts.killGraceMs);
        }, opts.timeoutMs)
      : null;

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (killWatchdog) clearTimeout(killWatchdog);
      resolve({ code, stdout, stderr, ...(timedOut ? { killed: true } : {}) });
    });
    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      if (killWatchdog) clearTimeout(killWatchdog);
      resolve({ code: -1, stdout, stderr: stderr + '\n' + err.message });
    });
  });
}

/**
 * Stream a node script's output to an SSE response.
 * Sends `data: <line>\n\n` for every stdout/stderr line, then `event: done` with exit code.
 *
 * Hard upper bound (REVIEW-A3): a runaway script is killed after
 * `opts.maxRuntimeMs` (default 30 minutes). Client-disconnect path also
 * escalates SIGTERM → SIGKILL via KILL_GRACE_MS (REVIEW-A2).
 */
export function streamNodeScript(res, scriptName, args = [], opts = {}) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const send = (event, data) => {
    if (event) res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send('start', { script: scriptName, args });

  let child;
  try {
    child = spawn(process.execPath, [scriptName, ...args], {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
    });
  } catch (err) {
    // See runNodeScript: a spawn that throws synchronously must end the stream,
    // not escape the handler as an unhandled rejection.
    send('error', { message: String(err?.message || err) });
    res.end();
    return;
  }

  // Lines are emitted whole: a chunk boundary can fall mid-line (and mid
  // character — hence setEncoding), so the unterminated tail of each chunk is
  // carried into the next and flushed on exit.
  const carry = { stdout: '', stderr: '' };
  const handleChunk = (stream, chunk) => {
    const lines = (carry[stream] + chunk).split('\n');
    carry[stream] = lines.pop();
    for (const line of lines) {
      if (line.length === 0) continue;
      send('log', { stream, line });
    }
  };
  const flush = () => {
    for (const stream of ['stdout', 'stderr']) {
      if (carry[stream]) send('log', { stream, line: carry[stream] });
      carry[stream] = '';
    }
  };

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (d) => handleChunk('stdout', d));
  child.stderr.on('data', (d) => handleChunk('stderr', d));

  let killWatchdog = null;
  const cleanup = () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    killWatchdog = killWithEscalation(child);
  };
  res.on('close', cleanup);

  // Hard runtime cap.
  const maxRuntimeMs = Number.isFinite(opts.maxRuntimeMs) ? opts.maxRuntimeMs : STREAM_DEFAULT_MAX_MS;
  const runtimeTimer = maxRuntimeMs > 0
    ? setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          send('error', { message: `maximum runtime exceeded (${maxRuntimeMs}ms)` });
          killWatchdog = killWithEscalation(child);
        }
      }, maxRuntimeMs)
    : null;

  child.on('close', (code) => {
    if (runtimeTimer) clearTimeout(runtimeTimer);
    if (killWatchdog) clearTimeout(killWatchdog);
    flush();
    send('done', { code });
    res.end();
  });
  child.on('error', (err) => {
    if (runtimeTimer) clearTimeout(runtimeTimer);
    if (killWatchdog) clearTimeout(killWatchdog);
    send('error', { message: err.message });
    res.end();
  });
}
