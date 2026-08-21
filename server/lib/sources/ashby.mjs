/**
 * Ashby public posting-api wrapper.
 *   GET https://api.ashbyhq.com/posting-api/job-board/<slug>?includeCompensation=true
 */
const UA = 'career-ops-web-ui/1.0';

// v1.69.0 (P-14) — self-describing adapter metadata. The registry
// auto-discovers every `*.mjs` in this folder and collects each
// module's `meta` export, so adding a new source is a pure file
// drop — no edit to registry.mjs required.
export const meta = {
  value: 'ashby',
  label: 'Ashby',
  region: 'en',
};

export async function fetchAshby(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal } = opts; // REVIEW-B3
  const res = await fetchImpl(apiUrl, { signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) {
    const err = new Error(`Ashby: HTTP ${res.status} (${apiUrl})`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return (data.jobs || []).map((j) => normalize(j));
}

// v1.75.0 — build the full location from primary +
// secondaryLocations. Ashby puts extra hiring regions in `secondaryLocations[]`
// (each with a region label and a postalAddress). Using only `j.location` drops
// them, so an EU-eligible role whose PRIMARY label is e.g. "Canada" reads as
// Canada-only and is wrongly removed by the location_filter. Fold in each
// secondary's region label, locality, and country (deduped, joined with " · ")
// so the filter can match e.g. "Europe", "Berlin", "Germany".
function formatLocation(j) {
  const parts = [];
  if (typeof j.location === 'string' && j.location.trim()) parts.push(j.location.trim());
  if (Array.isArray(j.secondaryLocations)) {
    for (const s of j.secondaryLocations) {
      if (!s || typeof s !== 'object') continue;
      const label = s.location || s.name;
      if (typeof label === 'string' && label.trim()) parts.push(label.trim());
      const pa = s.address && s.address.postalAddress;
      if (pa) {
        for (const k of ['addressLocality', 'addressCountry']) {
          if (typeof pa[k] === 'string' && pa[k].trim()) parts.push(pa[k].trim());
        }
      }
    }
  }
  // Remote work model lives in `workplaceType` ("Remote"|"Hybrid"|"Onsite") and
  // `isRemote`, SEPARATE from `location` — which keeps naming the office/HQ city
  // even for a fully remote role. Folding only the location strings renders a
  // remote posting as e.g. "San Francisco", so a location_filter blocking that
  // city drops a role the candidate could actually take. Append "Remote" so the
  // work model is visible to the scanner's string matching without discarding
  // the city (both `allow: ["Remote"]` and city filters keep working).
  // `workplaceType` wins when present: a board can carry `isRemote: true` with
  // `workplaceType: "Hybrid"` for an office-anchored role, and trusting isRemote
  // alone would mislabel those "Remote"; isRemote is the fallback when
  // workplaceType is absent.
  const wt = typeof j.workplaceType === 'string' ? j.workplaceType.trim().toLowerCase() : '';
  const remote = wt ? wt === 'remote' : j.isRemote === true;
  if (remote && !parts.some((p) => /remote/i.test(p))) parts.push('Remote');
  return [...new Set(parts)].join(' · ');
}

function normalize(j) {
  // workplaceType wins over the isRemote boolean (see formatLocation) so the
  // exported flag matches the location string.
  const wtLower = typeof j.workplaceType === 'string' ? j.workplaceType.trim().toLowerCase() : '';
  const isRemote = wtLower ? wtLower === 'remote' : j.isRemote === true;
  const wt = j.workplaceType || (isRemote ? 'Remote' : 'Onsite');

  // Compensation summary
  let salary = '';
  const tier = j.compensation?.compensationTierSummary;
  if (tier) salary = tier;
  else if (j.compensation?.summaryComponents?.length) {
    salary = j.compensation.summaryComponents
      .map((s) => s.compensationType + ' ' + (s.summary || ''))
      .join(', ');
  }

  return {
    id: `ashby-${j.id}`,
    title: j.title || '',
    company: '',
    url: j.jobUrl || j.applyUrl || '',
    salary,
    location: formatLocation(j),
    isRemote,
    workplaceType: wt,
    relocates: false,
    date: j.publishedAt || '',
    snippet: '',
    source: 'ashby',
  };
}
