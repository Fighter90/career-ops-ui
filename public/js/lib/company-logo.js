/* global window, document, localStorage */
/**
 * CompanyLogo (v1.104.0) — optional company logos in the scan table & beyond.
 *
 * Privacy-preserving: the logo is the favicon of the company's OWN domain
 * (proxied SSRF-safe by GET /api/logo), never a third-party logo API. It is
 * OFF by default and gated on a localStorage flag the user flips in Settings.
 * When a scan row's URL points at a shared ATS host (greenhouse, lever, …) the
 * favicon would be the ATS's, not the company's, so we skip it and show a
 * deterministic letter-avatar instead. On any image error we also fall back to
 * the avatar — a logo is decoration, never load-bearing.
 *
 * CSP-safe: DOM via createElement, error handling via the img.onerror property
 * (not an inline attribute), no innerHTML.
 */
window.CompanyLogo = (function () {
  var PREF_KEY = 'coShowLogos';

  // Shared ATS / aggregator hosts whose favicon is NOT the employer's brand.
  var GENERIC = [
    'greenhouse.io', 'lever.co', 'ashbyhq.com', 'myworkdayjobs.com', 'workday.com',
    'smartrecruiters.com', 'teamtailor.com', 'recruitee.com', 'workable.com',
    'bamboohr.com', 'jobvite.com', 'icims.com', 'successfactors.com', 'avature.net',
    'oraclecloud.com', 'taleo.net', 'breezy.hr', 'personio.de', 'pinpointhq.com',
    'rippling.com', 'notion.site', 'linkedin.com', 'indeed.com', 'glassdoor.com',
    'himalayas.app', 'weworkremotely.com', 'remoteok.com', 'jobicy.com',
    'ycombinator.com', 'getonbrd.com', 'nofluffjobs.com', 'justjoin.it',
    'arbeitnow.com', 'themuse.com', 'thehub.io', 'jobspresso.co', '4dayweek.io',
    'landing.jobs', 'nodesk.co', 'amazon.jobs',
  ];

  function enabled() {
    try { return localStorage.getItem(PREF_KEY) === '1'; } catch (e) { return false; }
  }
  function setEnabled(on) {
    try { localStorage.setItem(PREF_KEY, on ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  function isGeneric(host) {
    return GENERIC.some(function (g) { return host === g || host.endsWith('.' + g); });
  }

  /** The company domain to fetch a favicon for, or null (→ avatar). */
  function domainFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    var host;
    try { host = new URL(url).hostname.toLowerCase(); } catch (e) { return null; }
    host = host.replace(/^www\./, '');
    if (!host || host.indexOf('.') === -1) return null;
    if (isGeneric(host)) return null;
    return host;
  }

  // Deterministic pastel color from a name (so the same company keeps its hue).
  function colorFor(name) {
    var s = String(name || '?'); var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return 'hsl(' + h + ', 55%, 45%)';
  }
  function initial(name) {
    var s = String(name || '').trim();
    return (s ? s[0] : '?').toUpperCase();
  }

  var SIZE = 20;
  function avatar(name) {
    var d = document.createElement('span');
    d.textContent = initial(name);
    d.setAttribute('aria-hidden', 'true');
    var st = d.style;
    st.display = 'inline-flex'; st.alignItems = 'center'; st.justifyContent = 'center';
    st.width = SIZE + 'px'; st.height = SIZE + 'px'; st.borderRadius = '4px';
    st.background = colorFor(name); st.color = '#fff';
    st.fontSize = '11px'; st.fontWeight = '700'; st.flex = '0 0 auto'; st.lineHeight = '1';
    return d;
  }

  /** A logo/avatar node for a scan row (url = posting URL, name = company). */
  function badge(url, name) {
    if (!enabled()) return null;
    var domain = domainFromUrl(url);
    if (!domain) return avatar(name);
    var img = document.createElement('img');
    img.src = '/api/logo?domain=' + encodeURIComponent(domain);
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.width = SIZE; img.height = SIZE; img.loading = 'lazy'; img.decoding = 'async';
    var st = img.style;
    st.width = SIZE + 'px'; st.height = SIZE + 'px'; st.borderRadius = '4px';
    st.objectFit = 'contain'; st.flex = '0 0 auto'; st.background = 'var(--panel-2, #eef1f6)';
    img.onerror = function () { if (img.parentNode) img.parentNode.replaceChild(avatar(name), img); };
    return img;
  }

  return { enabled: enabled, setEnabled: setEnabled, domainFromUrl: domainFromUrl, avatar: avatar, badge: badge, PREF_KEY: PREF_KEY };
})();
