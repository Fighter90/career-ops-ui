/**
 * role-matcher.mjs — shared fuzzy role-title matching.
 *
 * Ported verbatim from parent career-ops `role-matcher.mjs` (v1.15.0). Decides
 * whether two same-company titles describe the same opening — used by the
 * repost detector (server/lib/detect-reposts.mjs). Pure, no I/O, no deps.
 */

// Tokens that almost every role shares must not count as strong matching
// signal: seniority, work mode, contract shape, common locations, etc.
export const ROLE_STOPWORDS = new Set([
  // seniority / level
  'junior', 'mid', 'middle', 'senior', 'staff', 'principal', 'lead', 'head',
  'chief', 'associate', 'intern', 'entry', 'level',
  // contract / mode
  'remote', 'hybrid', 'onsite', 'contract', 'contractor', 'freelance',
  'fulltime', 'parttime', 'permanent', 'temporary', 'intern', 'internship',
  // generic job words
  'role', 'position', 'opportunity', 'team', 'based',
  // reposting/tracking annotations — meta noise, never part of the job itself
  'repost', 'reposted', 'relisted',
  // very common locations
  'bangalore', 'bengaluru', 'mumbai', 'delhi', 'hyderabad', 'pune', 'chennai',
  'london', 'berlin', 'paris', 'madrid', 'barcelona', 'amsterdam', 'dublin',
  'york', 'francisco', 'seattle', 'boston', 'austin', 'chicago', 'toronto',
  'tokyo', 'singapore', 'sydney', 'melbourne', 'lisbon', 'warsaw',
  // regions / countries
  'europe', 'emea', 'apac', 'latam', 'americas', 'india', 'spain', 'germany',
  'france', 'italy', 'canada', 'brazil', 'mexico', 'japan',
  // prepositions leaking through the length filter
  'with', 'from', 'into', 'over', 'this', 'that',
]);

// Short specialty acronyms that are discriminating despite their length.
export const SHORT_SPECIALTY = new Set([
  'api', 'sre', 'sdk', 'cli', 'gpu', 'cpu',
  'ios', 'qa', 'ux', 'ui', 'ar', 'vr',
  'ocr', 'crm', 'erp',
]);

// Generic role-level descriptors. Two titles whose only overlap is here are
// not the same opening; they are merely written at the same role altitude.
export const BASELINE_TOKENS = new Set([
  'software', 'engineer', 'developer', 'manager', 'architect',
  'analyst', 'designer', 'consultant', 'specialist',
  'platform', 'systems', 'services',
  'backend', 'frontend', 'full', 'stack', 'fullstack',
]);

/**
 * Convert a role title into content tokens used for fuzzy matching.
 * @param {string} role
 * @returns {string[]}
 */
export function roleTokens(role) {
  const text = typeof role === 'string' ? role : String(role ?? '');
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => (w.length > 3 || SHORT_SPECIALTY.has(w)) && !ROLE_STOPWORDS.has(w));
}

/**
 * Decide whether two role titles are likely the same opening: ≥2 shared
 * tokens, ≥1 non-baseline shared token, and a Jaccard overlap ≥ 0.6.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function roleFuzzyMatch(a, b) {
  const wordsA = [...new Set(roleTokens(a))];
  const wordsB = [...new Set(roleTokens(b))];
  if (wordsA.length === 0 || wordsB.length === 0) return false;

  const setB = new Set(wordsB);
  const overlap = wordsA.filter((w) => setB.has(w));
  if (overlap.length < 2) return false;

  const discriminating = overlap.filter((w) => !BASELINE_TOKENS.has(w));
  if (discriminating.length === 0) return false;

  // Parent #1922 (v1.21.0): a generic base title carries no suffix of its own
  // to counterbalance a specialized sibling's extra word, so shared tokens
  // alone can cross the Jaccard threshold even though that extra word is
  // exactly the signal that these are two separately-postable openings
  // ("Senior Analytics Engineer" vs "Senior Analytics Engineer, People
  // Analytics"). When one token set is a strict subset of the other and the
  // superset's extra tokens contain a non-baseline word, treat that word as a
  // specialization marker and keep the titles distinct.
  const smaller = wordsA.length <= wordsB.length ? wordsA : wordsB;
  const larger = wordsA.length <= wordsB.length ? wordsB : wordsA;
  const isProperSubset = larger.length > smaller.length && overlap.length === smaller.length;
  if (isProperSubset) {
    const smallerSet = new Set(smaller);
    const extraTokens = larger.filter((w) => !smallerSet.has(w));
    if (extraTokens.some((w) => !BASELINE_TOKENS.has(w))) return false;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return overlap.length / union >= 0.6;
}
