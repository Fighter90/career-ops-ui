/**
 * FULL-M2 — transport hardening (docs/sdd/BACKLOG.md).
 *
 *   (a) `safeGet` must honour `timeoutMs` even when the caller passes its own
 *       AbortSignal — the two COMBINE, so a tar-pit origin cannot hold the
 *       call open forever just because the caller also wants cancel-ability.
 *       Before the fix the deadline was armed only when NO signal was given.
 *
 *   (b) habr / hh / geekjob / getmatch must never follow a redirect to a
 *       private-address host. Regression lock: the same-host pin + per-hop
 *       guard shipped in FULL-R2 (#514, `fetchTextFollowSameHost`) refuses
 *       it — these cases keep it refused.
 *
 * CI-isolated: injected transports, injected DNS hooks, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeGet, _setTransport, _setLookup } from '../server/lib/safe-fetch.mjs';
import { fetchTextFollowSameHost } from '../server/lib/http-json.mjs';
import { searchHabr } from '../server/lib/sources/habr.mjs';
import { searchHH } from '../server/lib/sources/hh.mjs';
import { searchGeekJob } from '../server/lib/sources/geekjob.mjs';
import { searchGetMatch } from '../server/lib/sources/getmatch.mjs';

// ─── safe-fetch scaffolding (mirrors tests/ssrf-redirect-rebind.test.mjs) ──

let dnsAnswers = [];
let restoreTransport = null;
let restoreLookup = null;

const withPublicDns = () => {
  restoreLookup = _setLookup(async () => dnsAnswers[0] || { address: '93.184.216.34', family: 4 });
};

function undo() {
  restoreTransport?.();
  restoreLookup?.();
  restoreTransport = null;
  restoreLookup = null;
}

// ─── (a) safeGet: timeoutMs must survive a caller signal ──────────────────

test('safeGet honours timeoutMs even when the caller passes a signal (tar-pit stall)', async () => {
  withPublicDns();
  const ac = new AbortController(); // the caller never aborts it
  restoreTransport = _setTransport((url, pinned, opts) => new Promise((resolve, reject) => {
    // A socket that never answers: settle only if something aborts it.
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => reject(opts.signal.reason ?? new Error('aborted')), { once: true });
    }
  }));
  try {
    const started = Date.now();
    await assert.rejects(
      Promise.race([
        safeGet('https://tar-pit.example.com/', { signal: ac.signal, timeoutMs: 100 }),
        // The hang-guard is what FAILED before the fix: safeGet never settled,
        // so this rejection fired instead and the assertion below went red.
        new Promise((_, rej) => setTimeout(
          () => rej(new Error('safeGet hung past timeoutMs with a caller signal (tar-pit stall)')),
          1500,
        )),
      ]),
      (err) => err.name === 'TimeoutError' && /timed out/.test(err.message),
    );
    assert.ok(Date.now() - started < 1200, `must reject via the deadline, got ${Date.now() - started}ms`);
  } finally { undo(); }
});

test('safeGet: the caller abort still wins over the combined deadline', async () => {
  withPublicDns();
  const ac = new AbortController();
  restoreTransport = _setTransport((url, pinned, opts) => new Promise((resolve, reject) => {
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => reject(opts.signal.reason ?? new Error('aborted')), { once: true });
    }
    setTimeout(() => ac.abort(), 30); // caller cancels long before the 60s budget
  }));
  try {
    await assert.rejects(
      () => safeGet('https://example.com/', { signal: ac.signal, timeoutMs: 60000 }),
      /aborted/,
    );
  } finally { undo(); }
});

test('safeGet: an already-aborted caller signal with timeoutMs rejects immediately', async () => {
  withPublicDns();
  const ac = new AbortController();
  ac.abort();
  let reached = false;
  restoreTransport = _setTransport(async (url, pinned, opts) => {
    reached = true;
    if (opts.signal?.aborted) throw new Error('aborted');
    return { status: 200, headers: {}, body: Buffer.from('nope', 'utf8') };
  });
  try {
    await assert.rejects(() => safeGet('https://example.com/', { signal: ac.signal, timeoutMs: 5000 }), /aborted/);
    assert.equal(reached, true, 'the caller signal reaches the transport unchanged');
  } finally { undo(); }
});

// ─── (b) the RU scrapers never follow a redirect to a private host ────────

const resp302 = (to) => async (u) => ({
  ok: false,
  status: 302,
  url: String(u),
  headers: { get: (k) => (String(k).toLowerCase() === 'location' ? to : null) },
  text: async () => '',
});

const PRIVATE_TARGET = 'https://169.254.169.254/latest/meta-data/';

const SEARCHES = [
  ['habr', searchHabr],
  ['hh', searchHH],
  ['geekjob', searchGeekJob],
  ['getmatch', searchGetMatch],
];

for (const [name, search] of SEARCHES) {
  test(`${name}: a 302 to a private-address host is refused, never fetched (FULL-M2b)`, async () => {
    let calls = 0;
    const fetchImpl = async (u) => {
      calls += 1;
      // Belt and braces: if the pin were ever bypassed, the private hop
      // itself fails LOUDLY instead of "succeeding" against IMDS.
      if (calls > 1) throw new Error(`private host fetched: ${u}`);
      return resp302(PRIVATE_TARGET)(u);
    };
    await assert.rejects(
      () => search('q', { fetchImpl, maxPages: 1 }),
      (err) => err.status === 302,
    );
    assert.equal(calls, 1, 'only the original request is made — the redirect target is never fetched');
  });
}

test('fetchTextFollowSameHost: a private-address redirect target is refused (helper contract)', async () => {
  let calls = 0;
  const fetchImpl = async (u) => {
    calls += 1;
    if (calls > 1) throw new Error(`private host fetched: ${u}`);
    return resp302('http://10.0.0.5/x')(u);
  };
  await assert.rejects(
    () => fetchTextFollowSameHost(fetchImpl, 'https://career.habr.com/vacancies?q=q'),
    (err) => err.status === 302 && err.location === 'http://10.0.0.5/x',
  );
  assert.equal(calls, 1);
});
