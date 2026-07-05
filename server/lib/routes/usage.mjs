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
    res.json({ ...agg, totalCalls: rows.length, prices: PRICES });
  });
}
