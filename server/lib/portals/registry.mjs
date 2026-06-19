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
