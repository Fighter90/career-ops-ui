/**
 * LLM usage recorder + aggregator (v1.105.0).
 *
 * Every LIVE provider call (from `runActiveProvider` and `routes/llm.mjs`)
 * appends one JSONL line — `{ ts, provider, in, out }` — to the user
 * layer at `data/llm-usage.jsonl`. The Usage page reads it back and rolls it up
 * per provider over time windows, turning token counts into an *estimated* USD
 * cost via the editable `llm-pricing.mjs` table.
 *
 * Recording is best-effort: a failed write NEVER breaks the LLM response. The
 * write is a side effect of a user-initiated live generation, so it fits the
 * "writes only on explicit user action" contract (same as the tracker).
 */
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PATHS } from './paths.mjs';
import { priceFor } from './llm-pricing.mjs';

const MAX_LINES = 50_000; // read cap — plenty of history without unbounded memory

/** Normalize the many provider usage shapes to `{ in, out }` token counts. */
export function normalizeUsage(u) {
  if (!u || typeof u !== 'object') return { in: 0, out: 0 };
  const inp = u.input_tokens ?? u.prompt_tokens ?? u.promptTokenCount ?? 0;
  // Gemini reports thinking separately (thoughtsTokenCount) from the visible
  // answer (candidatesTokenCount); both are billed as output.
  const gemOut = (u.candidatesTokenCount != null || u.thoughtsTokenCount != null)
    ? (Number(u.candidatesTokenCount) || 0) + (Number(u.thoughtsTokenCount) || 0)
    : undefined;
  const out = u.output_tokens ?? u.completion_tokens ?? gemOut ?? 0;
  return { in: Number(inp) || 0, out: Number(out) || 0 };
}

/** Append one usage record. `provider` is the mode string; `usage` is raw.
 *  `file` defaults to the user-layer log; tests pass an isolated temp path. */
export function recordUsage(provider, usage, nowMs, file = PATHS.llmUsage) {
  try {
    const { in: inp, out } = normalizeUsage(usage);
    if (!inp && !out) return; // nothing to record (manual / errored / no usage)
    const line = JSON.stringify({ ts: nowMs || Date.now(), provider: String(provider || 'unknown'), in: inp, out }) + '\n';
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, line);
  } catch { /* best-effort: never break the response over telemetry */ }
}

/**
 * CAR-92 — best-effort usage extraction from a provider SUBPROCESS's stdout
 * (the gemini-eval.mjs path). The script does not print usage today, so this
 * usually finds nothing and the caller skips recording silently — but when a
 * usage line IS present (a JSON line carrying the common token keys, or a
 * human "usage: 1234 prompt / 567 output tokens" line), the Gemini spend
 * reaches the Usage page like every other provider's. Returns null when no
 * usage is found; malformed numbers are never fabricated.
 * @param {string} stdout
 * @returns {{ prompt_tokens: number, completion_tokens: number } | null}
 */
export function parseSubprocessUsage(stdout) {
  const s = String(stdout || '');
  const lines = s.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim();
    if (!l.startsWith('{') || !l.endsWith('}') || !/tokens/i.test(l)) continue;
    try {
      const o = JSON.parse(l);
      const inp = Number(o.prompt_tokens ?? o.input_tokens ?? o.promptTokenCount);
      const out = Number(o.completion_tokens ?? o.output_tokens ?? o.candidatesTokenCount);
      if (Number.isFinite(inp) || Number.isFinite(out)) {
        return { prompt_tokens: Number.isFinite(inp) ? inp : 0, completion_tokens: Number.isFinite(out) ? out : 0 };
      }
    } catch { /* not JSON after all */ }
  }
  const m = s.match(/usage[^:\n]*:\s*([\d,]+)\s*(?:prompt|input)[^\d]+([\d,]+)\s*(?:output|completion|out)/i);
  if (m) {
    return {
      prompt_tokens: Number(m[1].replace(/,/g, '')) || 0,
      completion_tokens: Number(m[2].replace(/,/g, '')) || 0,
    };
  }
  return null;
}

/** Read + parse the usage log (bounded), newest-last. Exported for tests. */
export function readUsage(file = PATHS.llmUsage) {
  if (!existsSync(file)) return [];
  let lines;
  try { lines = readFileSync(file, 'utf8').split('\n').filter(Boolean); } catch { return []; }
  if (lines.length > MAX_LINES) lines = lines.slice(-MAX_LINES);
  const rows = [];
  for (const l of lines) {
    try {
      const r = JSON.parse(l);
      if (r && typeof r.ts === 'number') rows.push({ ts: r.ts, provider: String(r.provider || 'unknown'), in: Number(r.in) || 0, out: Number(r.out) || 0 });
    } catch { /* skip a corrupt line */ }
  }
  return rows;
}

const WINDOWS = [
  { key: '24h', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
  { key: 'all', ms: Infinity },
];

/**
 * Roll up rows into per-window, per-provider totals + estimated USD.
 * @returns { windows: { <key>: { providers: [{provider,in,out,calls,usd}], totalIn, totalOut, totalUsd, calls } } }
 */
export function aggregate(rows, nowMs) {
  const now = nowMs || Date.now();
  const out = { windows: {} };
  for (const w of WINDOWS) {
    const cutoff = w.ms === Infinity ? -Infinity : now - w.ms;
    const byProv = new Map();
    for (const r of rows) {
      if (r.ts < cutoff) continue;
      const e = byProv.get(r.provider) || { provider: r.provider, in: 0, out: 0, calls: 0, usd: 0 };
      e.in += r.in; e.out += r.out; e.calls += 1;
      byProv.set(r.provider, e);
    }
    let totalIn = 0, totalOut = 0, totalUsd = 0, calls = 0;
    const providers = [...byProv.values()].map((e) => {
      e.usd = priceFor(e.provider, e.in, e.out);
      totalIn += e.in; totalOut += e.out; totalUsd += e.usd; calls += e.calls;
      return e;
    }).sort((a, b) => b.usd - a.usd || (b.in + b.out) - (a.in + a.out));
    out.windows[w.key] = { providers, totalIn, totalOut, totalUsd, calls };
  }
  return out;
}
