/**
 * title-fit.mjs — free, banded title-vs-profile fit hint for #/scan rows.
 *
 * Port of the parent's `web/src/lib/title-fit.mjs` (career-ops b0805395,
 * #3260/#3261) plus the target-role extractor from its
 * `web/src/lib/profile-keywords.mjs` (`profileTargetKeywords`). Behaviour of
 * `titleFit` and its tokenizer is kept verbatim so both UIs band the same
 * posting the same way; tests/title-fit.test.mjs ports every parent case.
 *
 * CONTRACT: annotation only. The band is attached to scan rows as
 * `fit: { band, score }` when the scan snapshot is SERVED (GET
 * /api/scan-results) — it never feeds the scanners' filters, the row order,
 * or any count, and `data/last-scan.json` is never rewritten. The SPA renders
 * the band word only (never the score), with a tooltip saying it is a free
 * keyword estimate, not an evaluation.
 *
 * Why at serve time rather than inside en-scanner / ru-scanner: the profile
 * can change after a scan, and computing on read keeps the scanners untouched
 * and the snapshot file byte-identical. The per-row cost is a Set lookup.
 *
 * Exposes:
 *   titleFit(title, targets)      → { band: 'strong'|'related'|'weak', score } | null
 *   profileTargetRoles(profile)   → string[]  (target_roles.primary + archetypes[].name)
 *   loadProfileTargetRoles(file?) → string[]  (tolerant read of config/profile.yml)
 *   annotateSnapshotFit(snapshot, targets) → shallow copy with `fit` on rows
 */
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { PATHS } from './paths.mjs';

// Letters/digits across scripts, plus +#/. so c#, c++, node.js, .net survive.
const TOKEN_RE = /[\p{L}\p{N}+#.]+/gu;

// Seniority/level words say nothing about WHICH role a title describes: without
// excluding them, "Senior Platform Engineer" would only ever reach 2/3 against
// the target "platform engineer" and read as a partial match.
const SENIORITY = new Set([
  'junior', 'jr', 'mid', 'middle', 'senior', 'sr', 'staff', 'principal',
  'lead', 'head', 'chief', 'associate', 'assistant', 'intern', 'internship',
  'entry', 'level', 'ii', 'iii', 'iv',
]);

function tokens(text) {
  const raw = String(text ?? '').toLowerCase().match(TOKEN_RE) ?? [];
  return raw
    // TOKEN_RE keeps sentence-ending periods so dotted names survive intact
    // (node.js, .net); strip only TERMINAL dots afterwards.
    .map((tok) => tok.replace(/\.+$/, ''))
    .filter((tok) => tok.length > 1 && !SENIORITY.has(tok));
}

/**
 * Best token-overlap ratio between ONE target role phrase and the title.
 *
 * @param {string|undefined|null} title Posting title as printed by the scanner.
 * @param {string[]|undefined|null} targets Profile target-role phrases.
 * @returns {{band: 'strong'|'related'|'weak', score: number}|null}
 *   null when either side yields no usable tokens (caller omits the chip).
 */
export function titleFit(title, targets) {
  const titleTokens = new Set(tokens(title));
  if (!titleTokens.size || !Array.isArray(targets)) return null;

  let best = -1;
  for (const target of targets) {
    const roleTokens = [...new Set(tokens(target))];
    if (!roleTokens.length) continue;
    let hits = 0;
    for (const tok of roleTokens) if (titleTokens.has(tok)) hits++;
    best = Math.max(best, hits / roleTokens.length);
  }
  if (best < 0) return null;

  // Bands, not numbers: a lone shared generic token lands weak, roughly half
  // the role's tokens lands related, most of them strong.
  const rounded = Math.round(best * 100) / 100;
  const band = rounded >= 0.6 ? 'strong' : rounded >= 0.34 ? 'related' : 'weak';
  return { band, score: rounded };
}

/**
 * Target-role phrases from a parsed profile.yml — mirror of the parent's
 * `profileTargetKeywords`: `target_roles.primary[]` then
 * `target_roles.archetypes[].name`. Never throws; malformed input → [].
 *
 * @param {unknown} profile
 * @returns {string[]}
 */
export function profileTargetRoles(profile) {
  const roles = profile && typeof profile === 'object' ? profile.target_roles : null;
  if (!roles || typeof roles !== 'object') return [];
  return [
    ...(Array.isArray(roles.primary) ? roles.primary : []),
    ...(Array.isArray(roles.archetypes) ? roles.archetypes.map((a) => a && a.name) : []),
  ].filter((k) => typeof k === 'string');
}

/**
 * Read config/profile.yml tolerantly. Missing, unreadable or invalid YAML → []
 * (which means "no chips" — never an error surfaced to the scan view).
 *
 * @param {string} [file] Defaults to PATHS.profile under CAREER_OPS_ROOT.
 * @returns {string[]}
 */
export function loadProfileTargetRoles(file = PATHS.profile) {
  try {
    return profileTargetRoles(yaml.load(readFileSync(file, 'utf8')));
  } catch {
    return [];
  }
}

const SETS = ['fresh', 'filtered'];

/**
 * Return a shallow copy of a last-scan snapshot whose `{en,ru}.{fresh,filtered}`
 * rows carry `fit: {band, score}`. Rows with no band are passed through as-is
 * (key absent, not undefined). Row order, row count and every other field are
 * preserved exactly; the input is never mutated. No targets → input returned.
 *
 * @param {object} snapshot
 * @param {string[]} targets
 * @returns {object}
 */
export function annotateSnapshotFit(snapshot, targets) {
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(targets) || !targets.length) {
    return snapshot;
  }
  const out = { ...snapshot };
  for (const region of ['en', 'ru']) {
    const block = snapshot[region];
    if (!block || typeof block !== 'object') continue;
    const copy = { ...block };
    for (const set of SETS) {
      if (!Array.isArray(block[set])) continue;
      copy[set] = block[set].map((row) => withFit(row, targets));
    }
    out[region] = copy;
  }
  return out;
}

function withFit(row, targets) {
  if (!row || typeof row !== 'object') return row;
  const f = titleFit(row.title, targets);
  if (!f) return row;
  return { ...row, fit: { band: f.band, score: f.score } };
}
