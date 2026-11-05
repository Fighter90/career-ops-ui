/**
 * LLM usage & cost route (v1.105.0).
 *
 *   GET /api/usage → per-provider token totals + estimated USD over
 *                    24h / 7d / 30d / all-time windows.
 *
 * Read-only: reads the `data/llm-usage.jsonl` log that live provider calls
 * append to (see `llm-usage.mjs`) and rolls it up via the editable price table
 * (`llm-pricing.mjs`). The USD figure is an ESTIMATE, surfaced as such — never
 * billed. No writes, no LLM, no user CV/profile data.
 */
import { readUsage, aggregate } from '../llm-usage.mjs';
import { PRICES } from '../llm-pricing.mjs';

export function registerUsageRoutes(app) {
  app.get('/api/usage', (_req, res) => {
    const rows = readUsage();
    const agg = aggregate(rows);
    // v1.268.0 (CAR-230) — real evaluate latency: p50/p90 of the calls that
    // carry a durationMs (every llm-dispatch call since this release). The
    // evaluate view quotes it instead of the stale "2–4 min" copy.
    const d = rows.map((r) => Number(r.durationMs)).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
    const pick = (q) => (d.length ? d[Math.min(d.length - 1, Math.floor(q * (d.length - 1)))] : null);
    res.json({
      ...agg,
      totalCalls: rows.length,
      llmLatency: d.length ? { n: d.length, p50Ms: pick(0.5), p90Ms: pick(0.9), maxMs: d[d.length - 1] } : null,
      prices: PRICES,
    });
  });
}
