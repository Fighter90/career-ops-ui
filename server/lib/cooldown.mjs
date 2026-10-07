// @ts-check
/**
 * cooldown.mjs — re-apply cooldown filter.
 *
 * Skips scanned jobs at companies you applied to recently, so the scan stays
 * focused on NEW opportunities instead of re-surfacing roles you already chased.
 *
 * Config lives in `config/profile.yml` under `re_apply_windows:` (same key the
 * parent reads), e.g.:
 *
 *   re_apply_windows:
 *     "Acme Inc":
 *       last_apply_date: 2026-05-01
 *       same_role_days: 30
 *       applied_to: ["Senior Backend Engineer", "Platform Engineer"]
 *       cross_role_bucket: "backend"        # optional keyword bucket
 *
 * A job is skipped when its company matches a window, the cooldown hasn't
 * elapsed (today < last_apply_date + same_role_days), and the job title matches
 * one of `applied_to` (substring) or the `cross_role_bucket` keywords.
 *
 * Pure logic + a thin YAML reader; wired into en-scanner.mjs.
 */
import { readFileSync, existsSync } from 'node:fs';
import yaml from 'js-yaml';
import { normalizeTextKey } from './text-key.mjs';
import { cleanStringList } from './location-filter.mjs';

/** Add `days` to an ISO date string (UTC), returning an ISO date string. */
export function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// CJK/Korean corporate-form markers (parent parity, career-ops @ 5d1a6380 /
// 48715f41, #2570). 株式会社 is usually written UNSPACED, as a prefix
// (株式会社メルカリ) or a suffix (メルカリ株式会社), so no word-boundary rule
// can reach it — 社 is a letter. Longer forms first (股份有限公司 before
// 有限公司) so a strip cannot leave a dangling 股份 behind.
const CORPORATE_FORMS = [
  '株式会社', '合同会社', '有限会社',   // Japanese
  '合名会社', '合資会社', '一般社団法人',
  '股份有限公司',                       // Chinese (longer forms first)
  '有限责任公司', '有限責任公司',       // no 有限公司 suffix: 责任 sits between
  '有限公司',
  '주식회사', '유한회사',               // Korean
];

/**
 * Split a normalizeTextKey'd string into [forms, remainder]: the corporate-form
 * markers found at its leading and trailing edges (in that order, joined by
 * '|'), or null when there are none. BOTH edges are inspected so a name with a
 * form at each end cannot slip one past the different-form check.
 * @param {string} key
 * @returns {[string|null, string]}
 */
function stripCorporateForm(key) {
  const forms = [];
  let rest = key;
  const prefix = CORPORATE_FORMS.find((form) => rest.startsWith(form));
  if (prefix) {
    forms.push(prefix);
    rest = rest.slice(prefix.length);
  }
  const suffix = CORPORATE_FORMS.find((form) => rest.endsWith(form));
  if (suffix) {
    forms.push(suffix);
    rest = rest.slice(0, -suffix.length);
  }
  return [forms.length ? forms.join('|') : null, rest];
}

/**
 * Strip a pair of keys, or return null — a verdict that the pair is NOT the
 * same company. DIFFERENT explicit forms (a KK and a GK sharing a trade name)
 * are two legal entities; and a side that is ONLY a marker carries no trade
 * name to compare. Otherwise strip, falling back to the raw key when the strip
 * empties it. Splits, never merges.
 * @param {string} rawA
 * @param {string} rawB
 * @returns {[string, string] | null}
 */
function stripFormPair(rawA, rawB) {
  const [formsA, restA] = stripCorporateForm(rawA);
  const [formsB, restB] = stripCorporateForm(rawB);
  if (formsA && formsB && formsA !== formsB) return null;
  if (Boolean(formsA && !restA) !== Boolean(formsB && !restB)) return null;
  return [restA || rawA, restB || rawB];
}

/**
 * Normalized company match (parent scan.mjs companyMatch): exact match on the
 * spaceless Unicode key, else a bounded containment match on the spaced key.
 * So "Acme Inc" matches "Acme, Inc.", "Acme" matches "Acme Corp", and
 * 株式会社メルカリ matches メルカリ.
 *
 * Unicode-aware (parent #2569): the old `[^a-z0-9]` strip erased non-Latin
 * names outright — 株式会社アカネ and 合同会社ゾロ both keyed to ''. The empty
 * guard means "no usable signal" never reads as "identical". The containment
 * anchors are lookarounds over the same letter/mark/digit class the key keeps,
 * not `\b` (ASCII-only: "Nestlé Deutschland" vs "Nestlé" would stop matching).
 * @param {unknown} jobCompany
 * @param {unknown} windowCompany
 */
export function companyMatch(jobCompany, windowCompany) {
  const noSpaces = stripFormPair(normalizeTextKey(jobCompany), normalizeTextKey(windowCompany));
  if (!noSpaces) return false;
  const [c1NoSpaces, c2NoSpaces] = noSpaces;
  if (c1NoSpaces && c1NoSpaces === c2NoSpaces) return true;

  const withSpaces = stripFormPair(normalizeTextKey(jobCompany, ' '), normalizeTextKey(windowCompany, ' '));
  if (!withSpaces) return false;
  const [c1WithSpaces, c2WithSpaces] = withSpaces;
  if (!c1WithSpaces || !c2WithSpaces) return false;

  const bounded = (name) => new RegExp(
    `(?<![\\p{L}\\p{M}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{M}\\p{N}])`,
    'u',
  );
  return bounded(c2WithSpaces).test(c1WithSpaces) || bounded(c1WithSpaces).test(c2WithSpaces);
}

/**
 * Load + validate `re_apply_windows` from config/profile.yml. Returns {} when
 * absent/malformed (fail-soft — a bad config must never break a scan).
 * @param {string} profilePath
 */
export function loadReApplyWindows(profilePath) {
  if (!profilePath || !existsSync(profilePath)) return {};
  try {
    const raw = yaml.load(readFileSync(profilePath, 'utf8')) || {};
    const windows = (raw && typeof raw === 'object' && raw.re_apply_windows) || {};
    const valid = {};
    for (const [company, win] of Object.entries(windows)) {
      if (!win || typeof win !== 'object') continue;
      // js-yaml's default schema parses an UNQUOTED `last_apply_date: 2026-05-01`
      // as a JS Date (the YAML timestamp type), not a string. Coerce it back to
      // a YYYY-MM-DD string so unquoted dates work too — otherwise the window is
      // silently dropped and cooldown never fires.
      let lastApplyDate = win.last_apply_date;
      if (lastApplyDate instanceof Date && !Number.isNaN(lastApplyDate.getTime())) {
        lastApplyDate = lastApplyDate.toISOString().slice(0, 10);
      }
      if (typeof lastApplyDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(lastApplyDate)) continue;
      if (Number.isNaN(Date.parse(lastApplyDate))) continue;
      const sameRoleDays = win.same_role_days;
      if (sameRoleDays !== undefined && (!Number.isInteger(sameRoleDays) || sameRoleDays < 0)) continue;
      if (win.applied_to !== undefined && !Array.isArray(win.applied_to)) continue;
      if (win.applied_to !== undefined && win.applied_to.some((x) => typeof x !== 'string')) continue;
      if (win.cross_role_bucket !== undefined && typeof win.cross_role_bucket !== 'string') continue;
      // Store the normalized YYYY-MM-DD string so buildCooldownFilter's addDays works.
      valid[company] = { ...win, last_apply_date: lastApplyDate };
    }
    return valid;
  } catch {
    return {};
  }
}

const GENERIC_BUCKET_KEYWORDS = new Set(['all', 'roles', 'role', 'family', 'bucket', 'group', 'team']);

/**
 * Build a predicate `(job) => { skip, reason?, cooldownUntil? }` from windows.
 * `today` is an ISO date string. Empty windows → a no-op filter.
 */
export function buildCooldownFilter(windows, today) {
  if (!windows || Object.keys(windows).length === 0) {
    return () => ({ skip: false });
  }
  return (job) => {
    const jobCompany = (job && job.company) || '';
    const jobTitleLower = ((job && job.title) || '').toLowerCase();
    for (const [windowCompany, window] of Object.entries(windows)) {
      if (!companyMatch(jobCompany, windowCompany)) continue;
      const lastApplyDate = window.last_apply_date;
      if (!lastApplyDate) continue;
      const cooldownUntil = addDays(lastApplyDate, Number(window.same_role_days || 0));
      if (today >= cooldownUntil) continue; // cooldown elapsed

      if (Array.isArray(window.applied_to)) {
        // Blank entries dropped: `applied_to: [""]` is a substring of every
        // title and used to put the whole company on cooldown.
        const hit = cleanStringList(window.applied_to)
          .some((role) => jobTitleLower.includes(role.toLowerCase()));
        if (hit) return { skip: true, reason: `cooldown:${windowCompany}:${cooldownUntil}`, cooldownUntil };
      }
      if (window.cross_role_bucket) {
        const keywords = String(window.cross_role_bucket)
          .toLowerCase().split('_').filter((kw) => kw && !GENERIC_BUCKET_KEYWORDS.has(kw));
        const hit = keywords.some((kw) => (kw === 'em'
          ? (/\bem\b/i.test(jobTitleLower) || jobTitleLower.includes('engineering manager'))
          : jobTitleLower.includes(kw)));
        if (hit) return { skip: true, reason: `cooldown:${windowCompany}:${cooldownUntil}`, cooldownUntil };
      }
    }
    return { skip: false };
  };
}
