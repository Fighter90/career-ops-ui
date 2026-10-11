/* global window, URL */
(function () {
  'use strict';
  const TRACKING = [/^utm_/i, /^gh_src$/i, /^fbclid$/i, /^gclid$/i, /^mc_cid$/i, /^mc_eid$/i, /^igshid$/i, /^_hsenc$/i, /^_hsmi$/i, /^trk$/i, /^trackingid$/i];
  function safeDecode(raw) { try { return decodeURIComponent(raw) || null; } catch { return null; } }
  function promoteFragment(url) {
    const match = /^#\/jobs?\/([^/?#]+)(?:\?[^#]*)?$/i.exec(url.hash);
    if (!match) return;
    const id = safeDecode(match[1]);
    if (!id) return;
    url.searchParams.append(url.hostname.toLowerCase() === 'app.mokahr.com' ? 'mokahr_job_id' : '_career_ops_fragment_job_id', id);
  }
  function normalizeUrl(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return '';
    let url;
    try { url = new URL(raw.trim()); } catch { return ''; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    url.protocol = 'https:';
    url.hostname = url.hostname.toLowerCase();
    promoteFragment(url);
    url.hash = '';
    const keep = [];
    for (const pair of url.searchParams.entries()) if (!TRACKING.some((re) => re.test(pair[0]))) keep.push(pair);
    keep.sort((a, b) => a[0] !== b[0] ? (a[0] < b[0] ? -1 : 1) : (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    url.search = '';
    for (const [key, value] of keep) url.searchParams.append(key, value);
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1);
    return url.toString();
  }
  window.PostingUrlKey = { normalizeUrl };
})();
