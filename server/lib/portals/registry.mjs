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
// v1.75.0 — board-wide remote aggregators.
import { remoteokAdapter } from './adapters/remoteok.mjs';
import { remotiveAdapter } from './adapters/remotive.mjs';
import { workingNomadsAdapter } from './adapters/workingnomads.mjs';
// v1.75.0 — config-driven regional aggregators.
// These read per-entry config (the `<provider>:` block) from `opts.company`,
// which en-scanner now threads through to every fetcher.
import { ibmAdapter } from './adapters/ibm.mjs';
import { arbeitsagenturAdapter } from './adapters/arbeitsagentur.mjs';
import { glintsAdapter } from './adapters/glints.mjs';
import { jobstreetAdapter } from './adapters/jobstreet.mjs';
// v1.76.0 — per-tenant ATS providers.
import { bamboohrAdapter } from './adapters/bamboohr.mjs';
import { breezyAdapter } from './adapters/breezy.mjs';
import { comeetAdapter } from './adapters/comeet.mjs';
import { personioAdapter } from './adapters/personio.mjs';
import { recruiteeAdapter } from './adapters/recruitee.mjs';
import { solidjobsAdapter } from './adapters/solidjobs.mjs';
// v1.79.0 — WeWorkRemotely board-wide RSS feed.
import { weworkremotelyAdapter } from './adapters/weworkremotely.mjs';
// v1.80.0 — Teamtailor per-tenant ATS (public /jobs.rss feed).
import { teamtailorAdapter } from './adapters/teamtailor.mjs';
// v1.81.0 — 13 new job-board providers.
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
// v1.82.0 — NoDesk board-wide remote RSS feed.
import { nodeskAdapter } from './adapters/nodesk.mjs';
// v1.87.0 — 4 new zero-auth providers.
import { getonbrdAdapter } from './adapters/getonbrd.mjs';
import { amazonAdapter } from './adapters/amazon.mjs';
import { avatureAdapter } from './adapters/avature.mjs';
import { successfactorsAdapter } from './adapters/successfactors.mjs';
// v1.97.0 — Dassault Systèmes zero-token
// provider (Exalead card-search XML), single-company, provider-selected.
import { dassaultAdapter } from './adapters/dassault.mjs';
import { beesiteAdapter } from './adapters/beesite.mjs';
import { higheredjobsAdapter } from './adapters/higheredjobs.mjs';
import { jibeapplyAdapter } from './adapters/jibeapply.mjs';
import { softgardenAdapter } from './adapters/softgarden.mjs';
// v1.118.0 — 9 new providers.
import { csodAdapter } from './adapters/csod.mjs';
import { phenomAdapter } from './adapters/phenom.mjs';
import { radancyAdapter } from './adapters/radancy.mjs';
import { deutschebahnAdapter } from './adapters/deutschebahn.mjs';
import { tkmsAdapter } from './adapters/tkms.mjs';
import { hecklerkochAdapter } from './adapters/hecklerkoch.mjs';
import { rheinmetallAdapter } from './adapters/rheinmetall.mjs';
import { larajobsAdapter } from './adapters/larajobs.mjs';
import { senjobAdapter } from './adapters/senjob.mjs';
import { youratorAdapter } from './adapters/yourator.mjs';
import { jobbankcaAdapter } from './adapters/jobbankca.mjs';
import { mycareersfutureAdapter } from './adapters/mycareersfuture.mjs';
// v1.119.0 — Chinese tech boards, zero-auth
// public JSON APIs, host-detected or explicit `provider:`.
import { meituanAdapter } from './adapters/meituan.mjs';
import { tencentAdapter } from './adapters/tencent.mjs';
// v1.123.0 — Oracle Recruiting Cloud (ORC) per-tenant
// ATS, zero-auth JSON API, host-detected (*.fa[.<region>][.ocs].oraclecloud.com)
// or explicit `provider: oraclecloud`.
import { oraclecloudAdapter } from './adapters/oraclecloud.mjs';
// v1.124.0 — wttj + agenticjobs are
// board-wide feeds (provider-selected); jobvite + gem are per-tenant ATS
// (host-detected or explicit `provider:`); alibaba is a single-company
// careers JSON API (meituan/tencent pattern). All zero-auth.
import { wttjAdapter } from './adapters/wttj.mjs';
import { agenticjobsAdapter } from './adapters/agenticjobs.mjs';
import { jobviteAdapter } from './adapters/jobvite.mjs';
import { gemAdapter } from './adapters/gem.mjs';
import { alibabaAdapter } from './adapters/alibaba.mjs';
// v1.127.0 — 3 new sources.
import { flowxtraAdapter } from './adapters/flowxtra.mjs';
import { vdabAdapter } from './adapters/vdab.mjs';
import { icimsAdapter } from './adapters/icims.mjs';
// v1.130.0 — 2 new sources.
import { a16zSpeedrunTalentAdapter } from './adapters/a16z-speedrun-talent.mjs';
import { cryptocurrencyjobsAdapter } from './adapters/cryptocurrencyjobs.mjs';
import { manfredAdapter } from './adapters/manfred.mjs';
// v1.135.0 — 5 new zero-auth sources.
import { joinAdapter } from './adapters/join.mjs';
import { joinupAdapter } from './adapters/joinup.mjs';
import { getroAdapter } from './adapters/getro.mjs';
import { considerAdapter } from './adapters/consider.mjs';
import { remotliAdapter } from './adapters/remotli.mjs';
// v1.136.0 — Eightfold AI boards.
import { eightfoldAdapter } from './adapters/eightfold.mjs';
// v1.219.0 — Torre (search.torre.co opportunity search — LatAm-heavy remote board).
import { torreAdapter } from './adapters/torre.mjs';
// v1.226.0 — Vietnamese sources (ITviec + CareerViet).
import { itviecAdapter } from './adapters/itviec.mjs';
import { telegramAdapter } from './adapters/telegram.mjs';
import { careervietAdapter } from './adapters/careerviet.mjs';
import { builtinAdapter } from './adapters/builtin.mjs';
import { feishuJobsAdapter } from './adapters/feishu-jobs.mjs';
import { garenaAdapter } from './adapters/garena.mjs';
import { mokahrAdapter } from './adapters/mokahr.mjs';

export const ALL_ADAPTERS = [
  builtinAdapter,
  feishuJobsAdapter,
  garenaAdapter,
  mokahrAdapter,
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
  // v1.76.0 — Per-tenant ATS detected by careers_url host
  // (or explicit `provider:`). Order after the URL-detected ATS above is safe:
  // each matches a distinct host, so resolveAdapter never mis-routes.
  bamboohrAdapter,
  breezyAdapter,
  comeetAdapter,
  personioAdapter,
  recruiteeAdapter,
  solidjobsAdapter,
  // v1.79.0 — Board-wide remote RSS aggregator,
  // provider-selected (like RemoteOK / Remotive / Working Nomads).
  weworkremotelyAdapter,
  // v1.80.0 — per-tenant ATS, auto-detected from a <slug>.teamtailor.com host.
  teamtailorAdapter,
  // v1.81.0 — 13 new job-board providers.
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
  // v1.87.0 — getonbrd is a board-wide public
  // JSON:API (provider-selected); amazon / avature / successfactors are per-tenant
  // ATS endpoints (host-detected or explicit `provider:`), all zero-auth.
  getonbrdAdapter,
  amazonAdapter,
  avatureAdapter,
  successfactorsAdapter,
  // v1.97.0 — Dassault Systèmes, single global Exalead
  // endpoint, provider-selected (`provider: dassault`) or 3ds.com host-detected.
  dassaultAdapter,
  // v1.117.0 — beesite / jibeapply / softgarden are
  // per-tenant ATS endpoints (host-detected or explicit `provider:`);
  // higheredjobs is a board-wide RSS feed (provider-selected). All zero-auth.
  beesiteAdapter,
  higheredjobsAdapter,
  jibeapplyAdapter,
  softgardenAdapter,
  // v1.118.0 — csod (Cornerstone) / phenom /
  // are per-tenant ATS (host-detected or explicit `provider:`); radancy is
  // provider-selected only (branded hosts carry no vendor token); deutschebahn /
  // tkms / hecklerkoch / rheinmetall are single-company careers sites
  // (host-detected or provider-selected); larajobs + senjob (the
  // first African board, Senegal) are board-wide feeds, provider-selected. All
  // zero-auth.
  csodAdapter,
  phenomAdapter,
  radancyAdapter,
  deutschebahnAdapter,
  tkmsAdapter,
  hecklerkochAdapter,
  rheinmetallAdapter,
  larajobsAdapter,
  senjobAdapter,
  youratorAdapter,
  jobbankcaAdapter,
  mycareersfutureAdapter,
  torreAdapter,
  // v1.119.0 — meituan (zhaopin.meituan.com)
  // and tencent (careers.tencent.com) are single-company Chinese tech boards
  // with public JSON APIs — host-detected or explicit `provider:`, zero-auth,
  // keyword-driven pagination config via the company entry.
  meituanAdapter,
  tencentAdapter,
  // v1.123.0 — Oracle Recruiting Cloud (ORC).
  // Per-tenant Fusion Candidate Experience host, distinct host pattern, so
  // ordering after the other host-detected ATS is safe.
  oraclecloudAdapter,
  // v1.124.0 — see imports above.
  wttjAdapter,
  agenticjobsAdapter,
  jobviteAdapter,
  gemAdapter,
  alibabaAdapter,
  flowxtraAdapter,
  vdabAdapter,
  icimsAdapter,
  a16zSpeedrunTalentAdapter,
  cryptocurrencyjobsAdapter,
  manfredAdapter,
  joinAdapter,
  joinupAdapter,
  getroAdapter,
  considerAdapter,
  remotliAdapter,
  eightfoldAdapter,
  itviecAdapter,
  telegramAdapter,
  careervietAdapter,
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
