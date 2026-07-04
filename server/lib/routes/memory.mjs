/**
 * Memory layer routes (v1.93.0, roadmap Epic 24).
 *
 * A short, USER-EDITABLE "remember this about me" note stored in the user layer
 * at `config/memory.md`. It captures how the user wants the assistant to work
 * with them (tone, format, cadence) plus durable preferences — behavioural
 * steering, NOT new factual claims about their experience (those belong in
 * cv.md / profile / two-pager per the DATA_CONTRACT). Because it is inlined
 * into `bundleProjectContext`, it automatically reaches EVERY AI request —
 * evaluate, mock interview, networking, CV Studio — across all providers.
 *
 *   GET  /api/memory          → the current note (empty-safe)
 *   PUT  /api/memory          → save (explicit user action)
 *   POST /api/memory/suggest  → a draft prompt that mines the user's own
 *                               tracker/reports for BEHAVIOURAL patterns to
 *                               propose (for the user to review + save; no
 *                               fabricated content, no live call here)
 *
 * The only write is `config/memory.md` on an explicit Save.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PATHS } from '../paths.mjs';
import { withFileLock } from '../file-lock.mjs';
import { llmRateLimit } from '../rate-limit.mjs';

const MAX_MEMORY = 8 * 1024;   // a note, not a document
const MAX_MINE = 24 * 1024;    // cap on tracker text mined for suggestions

/** Coerce arbitrary input to a bounded plain-text note. Exported for tests. */
export function normalizeMemory(body) {
  const raw = body && typeof body === 'object' ? body.markdown : body;
  return (typeof raw === 'string' ? raw : '').slice(0, MAX_MEMORY);
}

export function readMemory() {
  if (!existsSync(PATHS.memory)) return '';
  try { return readFileSync(PATHS.memory, 'utf8'); } catch { return ''; }
}

const SUGGEST_INSTRUCTIONS = [
  'From the APPLICATION TRACKER below, propose a SHORT "remember about me" note',
  'the job-search assistant should keep in mind for future work. Capture only',
  'BEHAVIOURAL and PREFERENCE patterns — the kinds of roles/companies the user',
  'pursues, what they seem to accept or reject, cadence, and any explicit',
  'preferences. Do NOT invent skills, employers, or achievements, and do NOT',
  'restate CV facts. 5–10 terse first-person bullets. Output ONLY the bullets.',
  '',
].join('\n');

export function registerMemoryRoutes(app) {
  app.get('/api/memory', (_req, res) => {
    res.json({ markdown: readMemory() });
  });

  app.put('/api/memory', async (req, res) => {
    const markdown = normalizeMemory(req.body);
    try {
      await withFileLock(PATHS.memory, async () => {
        mkdirSync(dirname(PATHS.memory), { recursive: true });
        writeFileSync(PATHS.memory, markdown);
      });
    } catch {
      return res.status(500).json({ error: 'failed to save memory' });
    }
    return res.json({ ok: true, markdown });
  });

  // Build a draft prompt seeded with the user's own tracker (best-effort). The
  // user runs it in any LLM, reviews, and pastes an edited result into the note
  // — we never auto-write derived claims.
  app.post('/api/memory/suggest', llmRateLimit, (_req, res) => {
    let tracker = '';
    if (existsSync(PATHS.applications)) {
      try { tracker = readFileSync(PATHS.applications, 'utf8').slice(0, MAX_MINE); } catch { tracker = ''; }
    }
    if (!tracker.trim()) {
      return res.status(400).json({ error: 'no application tracker yet — evaluate a few roles first, then suggest.' });
    }
    const prompt = `${SUGGEST_INSTRUCTIONS}APPLICATION TRACKER:\n"""\n${tracker}\n"""\n`;
    res.json({ prompt, message: 'Run this in any LLM, review the bullets, then paste an edited version into your memory note.' });
  });
}
