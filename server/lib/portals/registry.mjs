/**
 * Adapter registry (v1.13.0).
 *
 * Single source of truth for which ATS adapters the scanner knows
 * about. Each adapter file in `./adapters/` exports an object with:
 *
 *   {
 *     id:        'greenhouse' | 'ashby' | 'lever' | …
 *     label:     'Greenhouse' | 'Ashby' | 'Lever' | …
 *     matches(company)         → boolean
 *     buildEndpoint(company)   → string | null
 *     fetch(endpoint, opts)    → Promise<job[]>
 *   }
 *
 * To add a new ATS:
 *   1. Add `server/lib/portals/adapters/<id>.mjs` with the contract above.
 *   2. Add it to ALL_ADAPTERS below.
 *   3. Done — en-scanner picks it up via resolveAdapter().
 *
 * The full PR-1 phase (14 new portals — Workable / SmartRecruiters /
 * Workday / GitLab / HashiCorp / Cloudflare / Datadog / Stripe / Notion /
 * Linear / Posthog / Hugging Face / Replicate / Modal Labs) appends to
 * ALL_ADAPTERS one entry at a time without touching the scanner.
 */
import { greenhouseAdapter } from './adapters/greenhouse.mjs';
import { ashbyAdapter } from './adapters/ashby.mjs';
import { leverAdapter } from './adapters/lever.mjs';
import { workableAdapter } from './adapters/workable.mjs';
import { smartRecruitersAdapter } from './adapters/smartrecruiters.mjs';
import { workdayAdapter } from './adapters/workday.mjs';
import { rssAdapter } from './adapters/rss.mjs';
// v1.75.0 — parent v1.12.0 parity: board-wide remote aggregators.
import { remoteokAdapter } from './adapters/remoteok.mjs';
import { remotiveAdapter } from './adapters/remotive.mjs';
import { workingNomadsAdapter } from './adapters/workingnomads.mjs';
// v1.75.0 — parent v1.12.0 parity: config-driven regional aggregators.
// These read per-entry config (the `<provider>:` block) from `opts.company`,
// which en-scanner now threads through to every fetcher.
import { ibmAdapter } from './adapters/ibm.mjs';
import { arbeitsagenturAdapter } from './adapters/arbeitsagentur.mjs';
import { glintsAdapter } from './adapters/glints.mjs';
import { jobstreetAdapter } from './adapters/jobstreet.mjs';
// v1.76.0 — parent career-ops v1.13.0 parity: per-tenant ATS providers.
import { bamboohrAdapter } from './adapters/bamboohr.mjs';
import { breezyAdapter } from './adapters/breezy.mjs';
import { comeetAdapter } from './adapters/comeet.mjs';
import { personioAdapter } from './adapters/personio.mjs';
import { recruiteeAdapter } from './adapters/recruitee.mjs';
import { solidjobsAdapter } from './adapters/solidjobs.mjs';
// v1.79.0 — parent career-ops v1.14.0 parity: WeWorkRemotely board-wide RSS feed.
import { weworkremotelyAdapter } from './adapters/weworkremotely.mjs';
// v1.80.0 — Teamtailor per-tenant ATS (public /jobs.rss feed).
import { teamtailorAdapter } from './adapters/teamtailor.mjs';
// v1.81.0 — parent career-ops origin/main parity: 13 new job-board providers.
// Board-wide public APIs (provider-selected, fixed endpoint):
import { thehubAdapter } from './adapters/thehub.mjs';
import { arbeitnowAdapter } from './adapters/arbeitnow.mjs';
import { himalayasAdapter } from './adapters/himalayas.mjs';
import { jobicyAdapter } from './adapters/jobicy.mjs';
import { landingjobsAdapter } from './adapters/landingjobs.mjs';
import { fourDayWeekAdapter } from './adapters/4dayweek.mjs';
import { themuseAdapter } from './adapters/themuse.mjs';
import { jobspressoAdapter } from './adapters/jobspresso.mjs';
import { hackernewsAdapter } from './adapters/hackernews.mjs';
// Poland boards — detected by host (justjoin.it / nofluffjobs.com) OR provider:
import { justjoinAdapter } from './adapters/justjoin.mjs';
import { nofluffjobsAdapter } from './adapters/nofluffjobs.mjs';
// Per-tenant ATS — host-detected from careers_url:
import { pinpointAdapter } from './adapters/pinpoint.mjs';
import { ripplingAdapter } from './adapters/rippling.mjs';
// v1.82.0 — parent career-ops v1.15.0 parity: NoDesk board-wide remote RSS feed.
import { nodeskAdapter } from './adapters/nodesk.mjs';
// v1.87.0 — parent career-ops v1.16.0 parity: 4 new zero-auth providers.
import { getonbrdAdapter } from './adapters/getonbrd.mjs';
import { amazonAdapter } from './adapters/amazon.mjs';
import { avatureAdapter } from './adapters/avature.mjs';
import { successfactorsAdapter } from './adapters/successfactors.mjs';

export const ALL_ADAPTERS = [
  greenhouseAdapter,
  ashbyAdapter,
  leverAdapter,
  workableAdapter,
  smartRecruitersAdapter,
  workdayAdapter,
  rssAdapter,
  remoteokAdapter,
  remotiveAdapter,
  workingNomadsAdapter,
  ibmAdapter,
  arbeitsagenturAdapter,
  glintsAdapter,
  jobstreetAdapter,
  // v1.76.0 — parent v1.13.0 parity. Per-tenant ATS detected by careers_url host
  // (or explicit `provider:`). Order after the URL-detected ATS above is safe:
  // each matches a distinct host, so resolveAdapter never mis-routes.
  bamboohrAdapter,
  breezyAdapter,
  comeetAdapter,
  personioAdapter,
  recruiteeAdapter,
  solidjobsAdapter,
  // v1.79.0 — parent v1.14.0 parity. Board-wide remote RSS aggregator,
  // provider-selected (like RemoteOK / Remotive / Working Nomads).
  weworkremotelyAdapter,
  // v1.80.0 — per-tenant ATS, auto-detected from a <slug>.teamtailor.com host.
  teamtailorAdapter,
  // v1.81.0 — parent origin/main parity: 13 new job-board providers.
  // Board-wide public APIs, provider-selected (like RemoteOK / Remotive):
  thehubAdapter,
  arbeitnowAdapter,
  himalayasAdapter,
  jobicyAdapter,
  landingjobsAdapter,
  fourDayWeekAdapter,
  themuseAdapter,
  jobspressoAdapter,
  hackernewsAdapter,
  // Poland boards — host-detected (justjoin.it / nofluffjobs.com) or provider-selected.
  justjoinAdapter,
  nofluffjobsAdapter,
  // Per-tenant ATS — auto-detected from careers_url host (pinpointhq.com / ats.rippling.com).
  pinpointAdapter,
  ripplingAdapter,
  // v1.82.0 — board-wide remote RSS feed, provider-selected (like We Work Remotely).
  nodeskAdapter,
  // v1.87.0 — parent career-ops v1.16.0 parity. getonbrd is a board-wide public
  // JSON:API (provider-selected); amazon / avature / successfactors are per-tenant
  // ATS endpoints (host-detected or explicit `provider:`), all zero-auth.
  getonbrdAdapter,
  amazonAdapter,
  avatureAdapter,
  successfactorsAdapter,
];

/**
 * Find the adapter that handles a given company entry. Returns
 * `{ adapter, endpoint }` or `null` when no adapter matches.
 */
export function resolveAdapter(company) {
  for (const a of ALL_ADAPTERS) {
    if (a.matches(company)) {
      const endpoint = a.buildEndpoint(company);
      if (endpoint) return { adapter: a, endpoint };
    }
  }
  return null;
}

/** Returns the adapter id used by detection — for compat with existing FETCHERS map. */
export function adapterIds() {
  return ALL_ADAPTERS.map((a) => a.id);
}
