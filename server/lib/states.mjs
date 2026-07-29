/**
 * Canonical application states — parent `templates/states.yml` port (v1.128.0).
 *
 * `templates/states.yml` is the SINGLE SOURCE OF TRUTH for the application
 * status vocabulary: career-ops (the writer) and this dashboard (a reader) both
 * consult it. Ported from the parent's `web/src/lib/core/states.ts` so the
 * web-ui reads the list LIVE instead of hardcoding a whitelist that had to be
 * manually re-synced every parent release (e.g. 'Hired' in v1.118.0). Reads are
 * always safe per the parent-project contract; `js-yaml` is already a dep.
 *
 * The FALLBACK below is a last resort if the file is unreadable (fresh clone,
 * or a CI-isolated test whose CAREER_OPS_ROOT has no templates/). It is kept
 * byte-identical to the shipped states.yml, so behaviour is stable either way.
 */
import { existsSync, readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { PATHS } from './paths.mjs';

/** @typedef {{ id: string, label: string, aliases: string[], description: string, group: string }} CanonicalState */

/** @type {CanonicalState[]} — mirror of templates/states.yml (parent v1.23.0). */
const FALLBACK = [
  { id: 'evaluated', label: 'Evaluated', aliases: ['evaluada'], description: 'Offer evaluated with report, pending decision', group: 'evaluated' },
  { id: 'applied', label: 'Applied', aliases: ['aplicado', 'enviada', 'aplicada', 'sent'], description: 'Application submitted', group: 'applied' },
  { id: 'responded', label: 'Responded', aliases: ['respondido'], description: 'Company has responded (not yet interview)', group: 'responded' },
  { id: 'interview', label: 'Interview', aliases: ['entrevista'], description: 'Active interview process', group: 'interview' },
  { id: 'offer', label: 'Offer', aliases: ['oferta'], description: 'Offer received', group: 'offer' },
  { id: 'rejected', label: 'Rejected', aliases: ['rechazado', 'rechazada'], description: 'Rejected by company', group: 'rejected' },
  { id: 'discarded', label: 'Discarded', aliases: ['descartado', 'descartada', 'cerrada', 'cancelada'], description: 'Discarded by candidate or offer closed', group: 'discarded' },
  { id: 'skip', label: 'SKIP', aliases: ['no_aplicar', 'no aplicar', 'skip', 'monitor'], description: "Doesn't fit, don't apply", group: 'skip' },
  { id: 'hired', label: 'Hired', aliases: ['contratado', 'contratada', 'hired', 'accepted', 'accept'], description: 'Offer accepted, job landed!', group: 'hired' },
];

let cache = null;

/**
 * Read the canonical states from `templates/states.yml`, falling back to the
 * built-in list if the file is missing or malformed. Cached per process (the
 * parent file does not change under a running server; matches how PATHS
 * resolves once — see tests/paths-once.test.mjs).
 * @returns {CanonicalState[]}
 */
export function readCanonicalStates() {
  if (cache) return cache;
  try {
    if (existsSync(PATHS.statesYml)) {
      const doc = yaml.load(readFileSync(PATHS.statesYml, 'utf8'));
      const list = doc && Array.isArray(doc.states) ? doc.states : null;
      if (list && list.length) {
        const parsed = [];
        for (const s of list) {
          if (!s || typeof s.label !== 'string') continue;
          const id = typeof s.id === 'string' ? s.id : s.label.toLowerCase();
          parsed.push({
            id,
            label: s.label,
            aliases: Array.isArray(s.aliases) ? s.aliases.filter((a) => typeof a === 'string') : [],
            description: typeof s.description === 'string' ? s.description : '',
            group: typeof s.dashboard_group === 'string' ? s.dashboard_group : id,
          });
        }
        if (parsed.length) { cache = parsed; return parsed; }
      }
    }
  } catch {
    /* fall through to FALLBACK */
  }
  cache = FALLBACK;
  return FALLBACK;
}

/** Canonical labels in file order (the tracker's status whitelist). */
export function canonicalLabels() {
  return readCanonicalStates().map((s) => s.label);
}

/**
 * Map any raw status — canonical label, id, or alias, case-insensitive, with
 * stray markdown bold tolerated — to its canonical label, or null if unknown.
 * @param {string} raw
 * @returns {string | null}
 */
export function canonicalizeStatus(raw) {
  if (typeof raw !== 'string') return null;
  const q = raw.trim().toLowerCase().replace(/\*\*/g, '');
  if (!q) return null;
  for (const s of readCanonicalStates()) {
    if (s.label.toLowerCase() === q || s.id.toLowerCase() === q || s.aliases.some((a) => a.toLowerCase() === q)) {
      return s.label;
    }
  }
  return null;
}

/** Test-only: drop the memoized list so a fresh CAREER_OPS_ROOT is re-read. */
export function _resetStatesCache() { cache = null; }
