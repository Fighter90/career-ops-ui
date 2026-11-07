/**
 * Remote (apply.remote.com) adapter (registry contract).
 *
 * Remote's own in-house ATS — a single-company source (like ibm): any https
 * URL on apply.remote.com matches (the board root and a single posting link
 * both lead to the one board), and `provider: remote-com` is an explicit
 * override. NOT the remoteok/remotive/remotli job boards — those match their
 * own hosts and this host is theirs never.
 *
 * Example portals.yml entry:
 *
 *   tracked_companies:
 *     - name: Remote
 *       careers_url: https://apply.remote.com/jobs
 *       enabled: true
 *
 * buildEndpoint returns the fixed API URL string (no auth, no pagination —
 * the whole board in one response); a non-apply.remote.com entry yields
 * null, which resolveAdapter treats as no endpoint (fail-soft per company).
 * Ported from the parent's providers/remote-com.mjs (upstream #6392).
 */
import { fetchRemoteCom, isRemoteAtsUrl, API_URL } from '../../sources/remote-com.mjs';

export const remoteComAdapter = {
  id: 'remote-com',
  label: 'Remote',
  matches(company) {
    if (!company || typeof company !== 'object') return false;
    if (company.provider === 'remote-com') return true;
    return isRemoteAtsUrl(company.careers_url) || isRemoteAtsUrl(company.api);
  },
  buildEndpoint(_company) {
    return API_URL;
  },
  fetch: fetchRemoteCom,
};
