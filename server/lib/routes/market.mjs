/**
 * Market-report route (v1.94.0, Epic 25 — rich statistics).
 *
 * Generates a salary & labour-market analysis for the candidate's TARGET ROLES
 * and a region, modelled on a real market report: grade ladder with median +
 * P10/P25/P75/P90, top employers, in-demand skill matrix, benefits frequency,
 * remote/format split, trends, and negotiation guidance.
 *
 *   POST /api/stats/market  → the report (live) or a copy-paste prompt
 *
 * Honesty contract: this is MARKET analysis (like /api/deep company research),
 * NOT user-facing content about the candidate — so the model may estimate, but
 * it is told to label every figure a DIRECTIONAL ESTIMATE from its own training
 * knowledge (not scraped/real-time data), give ranges, and never present its
 * numbers as authoritative. No file writes. Live runs use the shared provider
 * cascade; no key ⇒ manual prompt (honest), same as CV Studio.
 */
import { bundleProjectContext, resolveLocale, buildLocaleDirective } from '../prompts.mjs';
import { cleanLlmMarkdown } from '../llm-output.mjs';
import { llmRateLimit } from '../rate-limit.mjs';
import { runActiveProvider, providerAvailable } from '../llm-dispatch.mjs';

const MAX_REGION = 120;
const CURRENCIES = ['USD', 'EUR', 'GBP', 'RUB', 'KZT', 'UAH', 'PLN', 'TRY', 'JPY', 'CNY'];

/** Bound + clean the free-text region string. Exported for tests. */
export function normalizeRegion(v) {
  return (typeof v === 'string' ? v : '').replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_REGION);
}

/** Whitelist the requested display currency (ISO-4217), default USD. Exported for tests. */
export function normalizeCurrency(v) {
  const cur = (typeof v === 'string' ? v : '').trim().toUpperCase();
  return CURRENCIES.includes(cur) ? cur : 'USD';
}

const INSTRUCTIONS = [
  'You are a labour-market analyst. Using the candidate materials inlined below',
  '(their CV + profile give you the TARGET ROLES, seniority, and location policy),',
  'produce a salary & job-market report for those target roles in the given region.',
  '',
  'Structure it in Markdown with THESE sections (use tables; keep it scannable):',
  '  1. **Executive summary** — 3–5 bullets + a small key-numbers table.',
  '  2. **Salary by grade** — a table: grade | N/prevalence | median | P10 | P25 | P75 | P90.',
  '     Cover the ladder relevant to the target roles (e.g. Junior→Middle→Senior→Lead→Head).',
  '  3. **Top employers / companies** — who hires for these roles in this market, with rough bands.',
  '  4. **In-demand skills** — a frequency table (skill | % of postings | trend ↑/→/↓).',
  '  5. **Benefits & perks** — frequency table (benefit | % of employers).',
  '  6. **Format & remote split** — office / hybrid / remote shares.',
  '  7. **Trends 12–24 months** — incl. AI impact on the role.',
  '  8. **Negotiation guidance** — target band (P50–P75), levers, and red flags.',
  '',
  'HARD HONESTY RULES:',
  '  - Every number is a DIRECTIONAL ESTIMATE from your training knowledge, NOT',
  '    scraped or real-time data. State this once near the top and prefer ranges.',
  '  - Do NOT invent specific company salary figures as if verified — band them.',
  '  - If the region is unclear, assume a sensible default from the profile and say so.',
  '  - Output ONLY the report (Markdown). No preamble, no questions.',
  '',
].join('\n');

/** Build the full market-report prompt. Pure; exported for tests. */
export function buildMarketPrompt(ctx, region, lang, currency) {
  return [
    buildLocaleDirective(lang),
    INSTRUCTIONS,
    `REGION / MARKET: ${region || '(infer from the profile’s location policy)'}`,
    `PRIMARY CURRENCY: report salary figures primarily in ${currency || 'USD'} (add a second currency in parentheses only if genuinely helpful).`,
    '',
    ctx,
  ].filter((x) => x !== '').join('\n');
}

export function registerMarketRoutes(app) {
  app.post('/api/stats/market', llmRateLimit, async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const region = normalizeRegion(body.region);
    const currency = normalizeCurrency(body.currency);
    const lang = resolveLocale(req);
    const ctx = bundleProjectContext({});
    if (!ctx) {
      return res.status(400).json({ error: 'no candidate materials yet — add your CV / profile first, so the report knows your target roles' });
    }
    const prompt = buildMarketPrompt(ctx, region, lang, currency);

    if (!body.run) {
      return res.json({
        mode: 'manual',
        prompt,
        message: providerAvailable()
          ? 'Set { run: true } to generate live, or copy this prompt into any LLM.'
          : 'No API key set — copy this prompt into any LLM, then paste the report back.',
      });
    }
    const r = await runActiveProvider(prompt);
    if (r.mode === 'too-large') {
      return res.status(413).json({ error: 'prompt too large', details: [`assembled prompt is ${r.size} bytes; soft cap is ${r.cap}.`] });
    }
    if (r.mode === 'manual') return res.json({ mode: 'manual', prompt, message: 'No provider available — copy this prompt into any LLM.' });
    if (r.error) return res.status(502).json({ mode: r.mode, prompt, error: r.error });
    return res.json({ mode: r.mode, prompt, markdown: cleanLlmMarkdown(r.markdown), usage: r.usage });
  });
}
