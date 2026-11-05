#!/usr/bin/env node
/**
 * perf-probe.mjs — GET-latency probe of a DEPLOYED web-ui (CAR-236).
 *
 *   BASE_URL=https://<prod-host> BASIC_USER=… BASIC_PASS=… node scripts/remote-qa/perf-probe.mjs
 *   ROUNDS=3 (measured rounds per endpoint, default 3; one uncounted warm-up first)
 *
 * Measures TTFB (response headers received) and full-body time for the GET
 * endpoints the slowest SPA pages fan out to on mount:
 *   /                      — the SPA shell
 *   /api/health            — baseline (existsSync + profile yaml, no user data)
 *   /api/pipeline          — pipeline.md parse
 *   /api/tracker           — the LEGACY full-history shape (no query params)
 *   /api/tracker/stages    — the stages endpoint's actual route shape (v1.130;
 *                            the route has no `?withStages=1` param — probing a
 *                            bogus param would return the legacy shape again)
 *   /api/reports           — the full report-header list
 *   /api/dashboard         — apps + pipeline + reports stacked
 *   /api/map/jobs          — extra, same #/pipeline mount fan-out (pipeline.js
 *                            fires it alongside the six above); probed because
 *                            it reads every jds/*.md + scan-history per request.
 *
 * GET-only: the probe can never mutate the instance. Output: one compact
 * markdown table (endpoint, ttfbMs, totalMs, bytes — medians over the measured
 * rounds) plus a verdict line per endpoint (>2000 ms total → SLOW). The prod
 * host is redacted from every printed line (makeRedactor contract), and every
 * error is redacted BEFORE truncation. Exit 1 when any endpoint is SLOW or
 * errored, 0 otherwise.
 *
 * `bytes` is the DECODED body length — wire size under gzip differs; the
 * number is for payload-size comparison between endpoints.
 */
import { makeRedactor } from './redact.mjs';

const BASE = (process.env.BASE_URL || '').replace(/\/+$/, '');
if (!BASE) { console.error('BASE_URL is required'); process.exit(2); }
const BASIC_USER = process.env.BASIC_USER || '';
const BASIC_PASS = process.env.BASIC_PASS || '';
const ROUNDS = Math.max(1, Number.parseInt(process.env.ROUNDS, 10) || 3);
const SLOW_MS = Number.parseInt(process.env.SLOW_MS, 10) || 2000;
const TIMEOUT_MS = 90_000;

// Redact the prod host before truncating: a cut mid-host would dodge the mask.
const redact = makeRedactor(BASE);

// fetch equivalent of prod-llm's Playwright httpCredentials: Basic auth, sent
// only when configured, only to the probed origin (the URL is built from BASE).
const headers = {};
if (BASIC_USER) {
  headers.Authorization = 'Basic ' + Buffer.from(`${BASIC_USER}:${BASIC_PASS}`).toString('base64');
}

const ENDPOINTS = ['/', '/api/health', '/api/pipeline', '/api/tracker', '/api/tracker/stages', '/api/reports', '/api/dashboard', '/api/map/jobs'];

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

async function once(path) {
  const t0 = performance.now();
  const resp = await fetch(BASE + path, { headers, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
  const ttfb = performance.now() - t0;
  const buf = await resp.arrayBuffer();
  const total = performance.now() - t0;
  return { status: resp.status, ttfb, total, bytes: buf.byteLength };
}

const rows = [];
const verdicts = [];
let failed = false;

for (const path of ENDPOINTS) {
  // Warm-up (uncounted): fills safeListReports / states / board caches so the
  // measured rounds answer "what does a steady-state page load cost", not
  // "what does a post-restart first hit cost". A cold hit is still visible:
  // it shows up as a high round-1 outlier inside the measured set.
  try {
    const warm = await once(path);
    if (warm.status === 401) {
      rows.push({ path, error: 'HTTP 401 — set BASIC_USER/BASIC_PASS' });
      verdicts.push(`❌ ${path} — 401 unauthorized (basic-auth env not set?)`);
      failed = true;
      continue;
    }
  } catch (e) {
    rows.push({ path, error: redact(String(e && e.message || e)).slice(0, 160) });
    verdicts.push(`❌ ${path} — warm-up failed: ${redact(String(e && e.message || e)).slice(0, 120)}`);
    failed = true;
    continue;
  }

  const samples = [];
  let lastErr = null;
  for (let i = 0; i < ROUNDS; i++) {
    try { samples.push(await once(path)); } catch (e) { lastErr = e; }
  }
  if (!samples.length) {
    const msg = redact(String(lastErr && lastErr.message || lastErr)).slice(0, 160);
    rows.push({ path, error: msg });
    verdicts.push(`❌ ${path} — all ${ROUNDS} rounds failed: ${msg.slice(0, 120)}`);
    failed = true;
    continue;
  }
  const ok = samples.filter((s) => s.status >= 200 && s.status < 300);
  if (!ok.length) {
    const s = samples[0];
    rows.push({ path, error: `HTTP ${s.status} on every round` });
    verdicts.push(`❌ ${path} — HTTP ${s.status} on every round`);
    failed = true;
    continue;
  }
  const ttfbMed = Math.round(median(ok.map((s) => s.ttfb)));
  const totalMed = Math.round(median(ok.map((s) => s.total)));
  const totalMax = Math.round(Math.max(...ok.map((s) => s.total)));
  const bytesMed = median(ok.map((s) => s.bytes));
  rows.push({ path, ttfbMed, totalMed, totalMax, bytesMed });
  if (totalMed > SLOW_MS) {
    verdicts.push(`🐌 SLOW ${path} — ${totalMed} ms median (max ${totalMax} ms) > ${SLOW_MS} ms ttfb=${ttfbMed} ms bytes=${bytesMed}`);
    failed = true;
  } else {
    verdicts.push(`✅ ${path} — ok ${totalMed} ms median (max ${totalMax} ms, ttfb ${ttfbMed} ms, ${bytesMed} B)`);
  }
}

const cell = (v) => v === undefined ? '—' : String(v);
const lines = [
  '## GET latency probe', '',
  `${ENDPOINTS.length} endpoints × ${ROUNDS} measured rounds (1 uncounted warm-up) · SLOW threshold ${SLOW_MS} ms.`, '',
  '| endpoint | ttfbMs | totalMs | bytes |', '|---|---|---|---|',
  ...rows.map((r) => r.error
    ? `| ${cell(r.path)} | ERR | ERR | ERR |`
    : `| ${cell(r.path)} | ${r.ttfbMed} | ${r.totalMed} | ${r.bytesMed} |`), '',
  ...verdicts,
];
console.log(redact(lines.join('\n')));
process.exit(failed ? 1 : 0);
