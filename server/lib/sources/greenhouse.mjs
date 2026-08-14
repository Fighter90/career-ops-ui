/**
 * Greenhouse public boards-api wrapper.
 *   GET https://boards-api.greenhouse.io/v1/boards/<slug>/jobs
 *
 * Each job has location.name (often "Hybrid - SF, NYC") + offices[].
 */
const UA = 'career-ops-web-ui/1.0';

// v1.69.0 (P-14) — self-describing adapter metadata; see ashby.mjs for the rationale.
export const meta = {
  value: 'greenhouse',
  label: 'Greenhouse',
  region: 'en',
};

// ── Office enrichment ───────────────────────────────────────────────
// Some Greenhouse boards put the *work model* ("Hybrid", "In-Office",
// "Distributed") in location.name and keep the actual city only in the
// separate /offices endpoint — which the /jobs list does not embed. For those
// boards the scanner's location_filter never sees a city, so every role is
// evaluated against "Hybrid" and silently dropped. The city is recoverable
// from /v1/boards/{slug}/offices (offices → departments → jobs), one extra
// request paid only for boards that actually exhibit the pattern.
const WORK_MODEL = /^(?:hybrid|in[-\s]?office|on[-\s]?site|distributed|remote|flexible)$/i;

/**
 * True when a location string is only a work model with no geography at all
 * ("Hybrid", "Distributed; Hybrid"). Anything with a place in it
 * ("Hybrid - London") is already filterable and left alone.
 */
export function isWorkModelOnly(name) {
  if (typeof name !== 'string') return false;
  const parts = name.split(';').map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => WORK_MODEL.test(p));
}

/** boards/{slug}/jobs → boards/{slug}/offices, or null for any other shape. */
export function officesUrlFor(apiUrl) {
  const m = String(apiUrl).match(/^(https:\/\/[^/]+\/v1\/boards\/[^/]+)\/jobs(?:$|[?#])/);
  return m ? `${m[1]}/offices` : null;
}

/** Build jobId → Set(office names) by walking offices → departments → jobs. */
export function buildOfficeMap(json) {
  const map = new Map();
  const walk = (offices) => {
    if (!Array.isArray(offices)) return;
    for (const office of offices) {
      if (!office || typeof office !== 'object') continue;
      const name = typeof office.name === 'string' ? office.name.trim() : '';
      if (name) {
        for (const dept of Array.isArray(office.departments) ? office.departments : []) {
          for (const job of Array.isArray(dept?.jobs) ? dept.jobs : []) {
            if (!job || job.id == null) continue;
            if (!map.has(job.id)) map.set(job.id, new Set());
            map.get(job.id).add(name);
          }
        }
      }
      walk(office.children);
    }
  };
  walk(json?.offices);
  return map;
}

export async function fetchGreenhouse(apiUrl, opts = {}) {
  const { fetchImpl = fetch, signal } = opts; // REVIEW-B3
  const res = await fetchImpl(apiUrl, { signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) {
    const err = new Error(`Greenhouse: HTTP ${res.status} (${apiUrl})`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const jobs = (data.jobs || []).filter((j) => j.absolute_url || j.id != null);

  // Only pay for /offices when this board actually hides its cities there.
  let officeMap = null;
  if (jobs.some((j) => isWorkModelOnly(j.location?.name) && !(j.offices || []).length)) {
    const officesUrl = officesUrlFor(apiUrl);
    // officesUrlFor only rewrites the trailing /jobs → /offices on the SAME
    // host, so the enrichment request stays pinned to the boards-api host.
    if (officesUrl) {
      try {
        const or = await fetchImpl(officesUrl, { signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
        if (or.ok) officeMap = buildOfficeMap(await or.json());
      } catch {
        // Best-effort: a scan must never fail because the secondary lookup did.
        officeMap = null;
      }
    }
  }

  return jobs.map((j) => normalize(j, officeMap));
}

function normalize(j, officeMap = null) {
  let loc = j.location?.name || '';
  const offices = (j.offices || []).map((o) => o.name).filter(Boolean);
  // When the job's location is a bare work model and /jobs
  // embedded no offices, recover the city from the /offices map and fold it
  // into the location string (a `[loc, ...offices]` join)
  // so the returned `location` field — and downstream filtering — sees it.
  if (officeMap && isWorkModelOnly(loc) && !offices.length) {
    const fromMap = officeMap.get(j.id);
    if (fromMap && fromMap.size > 0) loc = [loc, ...fromMap].join(' · ');
  }
  const allLocs = [loc, ...offices].filter(Boolean).join(' · ');
  const isRemote = /remote|anywhere|fully\s*distributed/i.test(allLocs) ||
                   /\bremote\b/i.test(j.title);
  const isHybrid = /hybrid/i.test(allLocs);
  const relocates = /\b(visa|relocation|relocates?|sponsorship)\b/i.test(allLocs + ' ' + (j.title || ''));
  return {
    id: `gh-${j.id}`,
    title: j.title || '',
    company: j.company_name || '',
    url: j.absolute_url || '',
    salary: '', // greenhouse rarely exposes salary in board-api
    location: loc || (offices[0] || ''),
    isRemote,
    workplaceType: isRemote ? 'Remote' : (isHybrid ? 'Hybrid' : 'Onsite'),
    relocates,
    date: j.first_published || j.updated_at || '',
    snippet: '',
    source: 'greenhouse',
  };
}
