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

/** Add `days` to an ISO date string (UTC), returning an ISO date string. */
export function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Normalized company match: exact match on alphanumerics-only,
 * else a word-boundary match on the space-normalized forms. So "Acme Inc"
 * matches "Acme, Inc." and "Acme" matches "Acme Corp".
 */
export function companyMatch(jobCompany, windowCompany) {
  const cleanNoSpaces = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const c1NoSpaces = cleanNoSpaces(jobCompany);
  const c2NoSpaces = cleanNoSpaces(windowCompany);
  if (!c1NoSpaces || !c2NoSpaces) return false;
  if (c1NoSpaces === c2NoSpaces) return true;

  const cleanWithSpaces = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const c1WithSpaces = cleanWithSpaces(jobCompany);
  const c2WithSpaces = cleanWithSpaces(windowCompany);
  if (!c1WithSpaces || !c2WithSpaces) return false;

  const esc = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex1 = new RegExp('\\b' + esc(c2WithSpaces) + '\\b');
  const regex2 = new RegExp('\\b' + esc(c1WithSpaces) + '\\b');
  return regex1.test(c1WithSpaces) || regex2.test(c2WithSpaces);
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
        const hit = window.applied_to.some((role) => jobTitleLower.includes(String(role).toLowerCase()));
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
