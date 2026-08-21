/**
 * Lever public postings API.
 *   GET https://api.lever.co/v0/postings/<slug>
 */
const UA = 'career-ops-web-ui/1.0';

// v1.69.0 (P-14) — self-describing adapter metadata; see ashby.mjs for the rationale.
export const meta = {
  value: 'lever',
  label: 'Lever',
  region: 'en',
};

export async function fetchLever(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal } = opts; // REVIEW-B3
  const res = await fetchImpl(apiUrl, { signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) {
    const err = new Error(`Lever: HTTP ${res.status} (${apiUrl})`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  // lever returns either an array directly OR { ... data: [] }
  const list = Array.isArray(data) ? data : (data.data || []);
  return list.map(normalize);
}

function normalize(j) {
  const cats = j.categories || {};
  // Lever puts a SINGLE primary city in `location` and exposes the full set on
  // multi-location postings in `allLocations`; reading only the primary silently
  // hides every other eligible location from location_filter (a req open in
  // Barcelona AND Montevideo would look Barcelona-only). Merge, deduped.
  const primary = typeof cats.location === 'string' ? cats.location.trim() : '';
  const allLocs = Array.isArray(cats.allLocations)
    ? cats.allLocations.filter((l) => typeof l === 'string' && l.trim()).map((l) => l.trim())
    : [];
  const merged = [];
  for (const l of [primary, ...allLocs]) {
    if (l && !merged.some((m) => m.toLowerCase() === l.toLowerCase())) merged.push(l);
  }
  const location = merged.join(' · ');
  const isRemote = /remote|anywhere/i.test(location);
  const isHybrid = /hybrid/i.test(primary);
  return {
    id: `lever-${j.id}`,
    title: j.text || '',
    company: '',
    url: j.hostedUrl || j.applyUrl || '',
    salary: j.salaryRange?.min ? `${j.salaryRange.min}-${j.salaryRange.max} ${j.salaryRange.currency}` : '',
    location,
    isRemote,
    workplaceType: isRemote ? 'Remote' : (isHybrid ? 'Hybrid' : (cats.commitment || 'Onsite')),
    relocates: false,
    date: j.createdAt ? new Date(j.createdAt).toISOString() : '',
    snippet: cats.team || cats.department || '',
    source: 'lever',
  };
}
