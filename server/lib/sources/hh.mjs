/**
 * hh.ru scanner. Public API at api.hh.ru.
 *
 * Notes for users outside Russia:
 *   • hh.ru blocks API requests from non-RU IPs with 403. The block is by IP,
 *     not User-Agent — HH_USER_AGENT alone does NOT lift it.
 *   • To reach the API from a non-RU exit node, set HH_PROXY to a Russian
 *     HTTP/HTTPS proxy URL (e.g. `http://user:pass@ru-host:port`). Only the
 *     hh.ru request is routed through it; every other source uses the direct
 *     connection. Requires a process restart to pick up a changed value.
 *   • Alternatively, run the whole server from a Russian IP / VPN exit node.
 *
 * Schema docs: https://github.com/hhru/api
 */

import { ProxyAgent } from 'undici';

const HH_API = 'https://api.hh.ru/vacancies';
const DEFAULT_UA =
  process.env.HH_USER_AGENT ||
  'career-ops-web-ui/1.0 (sergey-emelyanov@github.com)';

// Lazily-built proxy dispatcher, cached per HH_PROXY value so a test (or a
// restart with a new value) rebuilds it instead of reusing a stale agent.
// ProxyAgent construction is connectionless — it dials only on first request.
let _proxy = { url: null, agent: null };

/**
 * Resolve the undici dispatcher for the hh.ru request from HH_PROXY.
 * Returns `undefined` when no proxy is configured (direct connection).
 * @returns {import('undici').Dispatcher | undefined}
 */
export function hhProxyDispatcher() {
  const url = process.env.HH_PROXY || '';
  if (!url) {
    if (_proxy.agent) _proxy.agent.close().catch(() => {});
    _proxy = { url: null, agent: null };
    return undefined;
  }
  if (_proxy.url !== url) {
    // Close the superseded agent so its socket pool doesn't leak on rebuild.
    if (_proxy.agent) _proxy.agent.close().catch(() => {});
    _proxy = { url, agent: new ProxyAgent(url) };
  }
  return _proxy.agent;
}

const AREA_MOSCOW = 1;
const AREA_RUSSIA = 113;
const AREA_REMOTE = 1001;

/**
 * Search hh.ru for one query string.
 * Returns array of normalized job objects.
 */
export async function searchHH(query, opts = {}) {
  const {
    area = AREA_RUSSIA,
    perPage = 50,
    onlyRemote = false,
    searchField = 'name',
    fetchImpl = fetch,
    signal, // REVIEW-B3: propagate client-disconnect
  } = opts;

  const params = new URLSearchParams({
    text: query,
    area: String(area),
    per_page: String(perPage),
    search_field: searchField,
  });
  if (onlyRemote) params.set('schedule', 'remote');

  // undici honors a per-request `dispatcher`; the timeout wrapper forwards it
  // verbatim to native fetch. Omitted entirely when HH_PROXY is unset.
  const dispatcher = hhProxyDispatcher();

  const res = await fetchImpl(`${HH_API}?${params}`, {
    signal,
    ...(dispatcher ? { dispatcher } : {}),
    headers: {
      'User-Agent': DEFAULT_UA,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let detail = '';
    try {
      const j = JSON.parse(body);
      detail = ' · ' + (j.errors?.[0]?.type || j.description || '');
    } catch {}
    const err = new Error(`hh.ru: HTTP ${res.status}${detail}`);
    err.status = res.status;
    err.geoBlocked = res.status === 403;
    throw err;
  }

  const data = await res.json();
  return (data.items || []).map(normalizeHH);
}

function normalizeHH(item) {
  const sal = item.salary;
  const salStr = sal
    ? [
        sal.from && `от ${sal.from}`,
        sal.to && `до ${sal.to}`,
        sal.currency,
      ]
        .filter(Boolean)
        .join(' ')
    : '';
  // schedule = 'remote' / 'fullDay' / 'flexible' / 'shift'
  const schedule = item.schedule?.id || item.schedule?.name || '';
  const isRemote = schedule === 'remote' || /удал[её]н/i.test(item.schedule?.name || '');
  return {
    id: `hh-${item.id}`,
    title: item.name || '',
    company: item.employer?.name || '',
    url: item.alternate_url || `https://hh.ru/vacancy/${item.id}`,
    salary: salStr,
    location: item.area?.name || '',
    isRemote,
    workplaceType: isRemote ? 'Remote' : (schedule || 'Onsite'),
    relocates: false, // hh.ru rarely flags this; user must check page
    date: item.published_at || '',
    snippet: [item.snippet?.requirement, item.snippet?.responsibility]
      .filter(Boolean)
      .join(' / '),
    source: 'hh.ru',
  };
}

export const HH = { searchHH, AREA_MOSCOW, AREA_RUSSIA, AREA_REMOTE };
