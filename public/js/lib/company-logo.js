/* global window, document, localStorage */
/**
 * CompanyLogo (v1.104.0) — optional company logos in the scan table & beyond.
 *
 * Privacy-preserving: the logo is the favicon of the company's OWN domain
 * (proxied SSRF-safe by GET /api/logo), never a third-party logo API. It is
 * OFF by default and gated on a localStorage flag the user flips in Settings.
 * When a scan row's URL points at a shared ATS host (greenhouse, lever, …) the
 * favicon would be the ATS's, not the company's — but the posting URL is ALWAYS
 * a job board, so we ALSO resolve a domain from the company NAME (a curated
 * override map for the brand≠slug long tail, then a slug+.com heuristic). Only
 * when neither yields a domain do we fall back to a deterministic letter-avatar.
 * On any image error we also fall back to the avatar — a logo is decoration,
 * never load-bearing.
 *
 * CSP-safe: DOM via createElement, error handling via the img.onerror property
 * (not an inline attribute), no innerHTML.
 */
window.CompanyLogo = (function () {
  var PREF_KEY = 'coShowLogos';

  // Curated company NAME → domain overrides for the common cases slug+.com gets
  // wrong (brand ≠ registrable slug). Ported from the parent web/src/lib/company.ts.
  var DOMAIN_OVERRIDES = {
    anthropic: 'anthropic.com',
    openai: 'openai.com',
    google: 'google.com',
    'google deepmind': 'deepmind.google',
    deepmind: 'deepmind.google',
    meta: 'meta.com',
    'meta platforms': 'meta.com',
    facebook: 'meta.com',
    microsoft: 'microsoft.com',
    apple: 'apple.com',
    amazon: 'amazon.com',
    aws: 'aws.amazon.com',
    netflix: 'netflix.com',
    nvidia: 'nvidia.com',
    x: 'x.com',
    twitter: 'x.com',
    xai: 'x.ai',
    'x.ai': 'x.ai',
    stripe: 'stripe.com',
    shopify: 'shopify.com',
    airbnb: 'airbnb.com',
    uber: 'uber.com',
    lyft: 'lyft.com',
    spotify: 'spotify.com',
    linkedin: 'linkedin.com',
    github: 'github.com',
    gitlab: 'gitlab.com',
    notion: 'notion.so',
    figma: 'figma.com',
    canva: 'canva.com',
    databricks: 'databricks.com',
    snowflake: 'snowflake.com',
    datadog: 'datadoghq.com',
    cloudflare: 'cloudflare.com',
    vercel: 'vercel.com',
    netlify: 'netlify.com',
    hugging: 'huggingface.co',
    huggingface: 'huggingface.co',
    'hugging face': 'huggingface.co',
    cohere: 'cohere.com',
    'mistral ai': 'mistral.ai',
    mistral: 'mistral.ai',
    perplexity: 'perplexity.ai',
    scale: 'scale.com',
    'scale ai': 'scale.com',
    replit: 'replit.com',
    ramp: 'ramp.com',
    brex: 'brex.com',
    plaid: 'plaid.com',
    coinbase: 'coinbase.com',
    robinhood: 'robinhood.com',
    doordash: 'doordash.com',
    instacart: 'instacart.com',
    pinterest: 'pinterest.com',
    reddit: 'reddit.com',
    discord: 'discord.com',
    slack: 'slack.com',
    atlassian: 'atlassian.com',
    salesforce: 'salesforce.com',
    oracle: 'oracle.com',
    ibm: 'ibm.com',
    intel: 'intel.com',
    amd: 'amd.com',
    tesla: 'tesla.com',
    spacex: 'spacex.com',
    palantir: 'palantir.com',
    twilio: 'twilio.com',
    zoom: 'zoom.us',
    dropbox: 'dropbox.com',
    asana: 'asana.com',
    airtable: 'airtable.com',
    segment: 'segment.com',
    elastic: 'elastic.co',
    mongodb: 'mongodb.com',
    hashicorp: 'hashicorp.com',
    'booking.com': 'booking.com',
    booking: 'booking.com',
    revolut: 'revolut.com',
    wise: 'wise.com',
    klarna: 'klarna.com',
    adyen: 'adyen.com',
    glovo: 'glovoapp.com',
    cabify: 'cabify.com',
    typeform: 'typeform.com',
    factorial: 'factorialhr.com',
    n26: 'n26.com',
    vdab: 'vdab.be',
    'red hat': 'redhat.com',
    redhat: 'redhat.com',
  };

  var LEGAL_SUFFIX = /\b(inc|llc|ltd|limited|gmbh|co|corp|corporation|sa|s\.a|ag|plc|sl|s\.l|bv|oy|ab|company|group|holdings|technologies|technology|labs|systems)\b/gi;

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

  /**
   * Resolve a likely registrable domain from the company NAME alone, or null if
   * the input is empty/unusable. Curated overrides first (raw then suffix-
   * stripped), then a slug+.com heuristic. Ported from parent companyDomain().
   */
  function domainFromName(name) {
    if (!name || typeof name !== 'string') return null;
    var key = name.trim().toLowerCase();
    if (!key) return null;
    if (DOMAIN_OVERRIDES[key]) return DOMAIN_OVERRIDES[key];

    var cleaned = key
      .replace(/[®™©]/g, ' ')
      .replace(LEGAL_SUFFIX, ' ')
      .replace(/[.,&'’/()|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return null;
    // re-check overrides after stripping suffixes (e.g. "Stripe, Inc." → "stripe")
    if (DOMAIN_OVERRIDES[cleaned]) return DOMAIN_OVERRIDES[cleaned];

    var slug = cleaned.replace(/\s+/g, '');
    if (slug.length < 2) return null;
    return slug + '.com';
  }

  // Deterministic pastel color from a name (so the same company keeps its hue).
  function colorFor(name) {
    var s = String(name || '?'); var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return 'hsl(' + h + ', 55%, 45%)';
  }
  // 1–2 uppercase initials for the monogram fallback (parent companyInitials()).
  function initial(name) {
    if (!name) return '?';
    var words = String(name)
      .replace(LEGAL_SUFFIX, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) return String(name).trim().slice(0, 1).toUpperCase() || '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
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
    // Posting URLs are ALWAYS job boards, so a non-ATS host is rare; fall back
    // to resolving the employer domain from the company name before the avatar.
    var domain = domainFromUrl(url) || domainFromName(name);
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

  return { enabled: enabled, setEnabled: setEnabled, domainFromUrl: domainFromUrl, domainFromName: domainFromName, initial: initial, avatar: avatar, badge: badge, PREF_KEY: PREF_KEY };
})();
