/**
 * classify-tier.mjs — sort a job title into exactly one seniority tier so the
 * scanner can honour a `skip_tiers:` list in portals.yml (e.g. `skip_tiers:
 * [intern, entry]` drops those listings). Pure, zero-dependency.
 *
 * Unrecognised / plain titles ("Software Engineer" with no level word) fall
 * back to 'mid' — the default/unknown bucket. So `skip_tiers: [mid]` also drops
 * most ordinary listings, not just explicit mid-level roles.
 *
 * @param {unknown} title
 * @returns {'intern' | 'entry' | 'mid' | 'senior'}
 */
export function classifyTier(title) {
  if (typeof title !== 'string') return 'mid';

  // Normalise acronyms so their dots don't split words below.
  const cleanTitle = title
    .replace(/\bA\.I\./ig, 'AI').replace(/\bA\.I\b/ig, 'AI').replace(/\bA\.\s+I\b/ig, 'AI')
    .replace(/\bI\.T\./ig, 'IT').replace(/\bI\.T\b/ig, 'IT').replace(/\bI\.\s+T\b/ig, 'IT')
    .replace(/\bi\/o\b/ig, 'IO');

  // Level markers, tier + weight. Weight is only the tie-break for two markers
  // at the SAME offset (keeps `mid-level` over `mid`, `entry-level` over `entry`).
  const matchers = [
    { pattern: /\bchief\b/i, tier: 'senior', weight: 4 },
    { pattern: /\bvp\b/i, tier: 'senior', weight: 4 },
    { pattern: /\bvice\s+president\b/i, tier: 'senior', weight: 4 },
    { pattern: /\bdirector\b/i, tier: 'senior', weight: 4 },
    { pattern: /\bprincipal\b/i, tier: 'senior', weight: 4 },
    { pattern: /\bstaff\b/i, tier: 'senior', weight: 4 },
    { pattern: /\blead\b/i, tier: 'senior', weight: 4 },
    { pattern: /\bsenior\b/i, tier: 'senior', weight: 4 },
    { pattern: /\bsr\b/i, tier: 'senior', weight: 4 },
    { pattern: /\bsr\./i, tier: 'senior', weight: 4 },
    { pattern: /\bhead\s+of\b/i, tier: 'senior', weight: 4 },
    { pattern: /\b[a-z]{2,}[\s-](iii|iv|v)\b/i, tier: 'senior', weight: 4 },

    { pattern: /\bmid-level\b/i, tier: 'mid', weight: 3 },
    { pattern: /\bmid\b/i, tier: 'mid', weight: 3 },
    { pattern: /\b[a-z]{2,}[\s-](ii)\b/i, tier: 'mid', weight: 3 },
    { pattern: /\b(l4|l5)\b/i, tier: 'mid', weight: 3 },

    { pattern: /\bentry-level\b/i, tier: 'entry', weight: 2 },
    { pattern: /\bentry\b/i, tier: 'entry', weight: 2 },
    { pattern: /\bassociate\b/i, tier: 'entry', weight: 2 },
    { pattern: /\bjunior\b/i, tier: 'entry', weight: 2 },
    { pattern: /\b[a-z]{2,}[\s-](i)\b/i, tier: 'entry', weight: 2 },
    { pattern: /\b(l1|l2)\b/i, tier: 'entry', weight: 2 },

    { pattern: /\binternship\b/i, tier: 'intern', weight: 1 },
    { pattern: /\bintern\b/i, tier: 'intern', weight: 1 },
    { pattern: /\btrainee\b/i, tier: 'intern', weight: 1 },
    { pattern: /\bco-op\b/i, tier: 'intern', weight: 1 },
    {
      pattern: {
        test: (t) => /\bgraduate\b/i.test(t) && /\b(program|scheme)\b/i.test(t),
        // Position of the level word itself, not the "program" qualifier. Named
        // levelWordIndex, NOT `search`, so a matcher never shadows
        // String.prototype.search (which would coerce its argument to a RegExp).
        levelWordIndex: (t) => t.search(/\bgraduate\b/i),
      },
      tier: 'intern',
      weight: 1,
    },
  ];

  // Guard (a): "Associate [*] Director/VP/Chief/…" is senior — the `associate`
  // prefix qualifies a senior band, it does not demote it. Checked before the
  // position loop because `associate` leads, so leftmost-marker would return entry.
  const associateAt = cleanTitle.search(/\bassociate\b/i);
  if (associateAt >= 0) {
    const afterAssociate = cleanTitle.slice(associateAt + 'associate'.length);
    if (/\b(director|vice\s+president|vp|principal|partner|chief|head\s+of)\b/i.test(afterAssociate)) {
      return 'senior';
    }
  }

  // Guard (b): [intern/entry marker] + [programme bridge noun] + [senior role
  // noun] is senior. "Intern Program Director" manages an intern programme; it
  // is not itself an internship. The bridge-noun set is a closed list.
  const programBridge = /\b(?:intern(?:ship)?|trainee|co-op|graduate|junior|entry(?:-level)?)\s+(?:program|scheme|talent|cohort)\b/i;
  if (programBridge.test(cleanTitle)) {
    const afterBridge = cleanTitle.replace(programBridge, ' ').trim();
    if (/\b(chief|vp|vice\s+president|director|principal|staff|lead|senior|sr\.?|head\s+of|partner)\b/i.test(afterBridge)) {
      return 'senior';
    }
  }

  // POSITION decides, not rank: English titles put the level first, so the
  // LEFTMOST marker is the role's own level ("Summer Intern, Director of
  // Product" is an internship, not a directorship).
  let bestMatch = null;
  let bestIndex = Infinity;
  for (const matcher of matchers) {
    // Match first: the graduate matcher is a COMPOUND condition, so its position
    // alone would fire on a bare "Graduate Engineer" the condition itself rejects.
    if (!matcher.pattern.test(cleanTitle)) continue;
    const index = typeof matcher.pattern.levelWordIndex === 'function'
      ? matcher.pattern.levelWordIndex(cleanTitle)
      : cleanTitle.search(matcher.pattern);
    if (index < 0) continue;
    if (index < bestIndex || (index === bestIndex && matcher.weight > bestMatch.weight)) {
      bestMatch = matcher;
      bestIndex = index;
    }
  }
  return bestMatch ? bestMatch.tier : 'mid';
}

/**
 * Build a title→keep predicate from a portals.yml `skip_tiers` list. A title
 * whose classified tier is in the (lowercased) skip list is dropped. An empty
 * or missing list keeps everything (the predicate is a no-op).
 * @param {unknown} skipTiers
 * @returns {(title: string) => boolean}
 */
export function buildTierFilter(skipTiers) {
  const skip = Array.isArray(skipTiers)
    ? skipTiers.filter((t) => typeof t === 'string').map((t) => t.toLowerCase())
    : [];
  if (skip.length === 0) return () => true;
  return (title) => !skip.includes(classifyTier(title));
}

export default classifyTier;
