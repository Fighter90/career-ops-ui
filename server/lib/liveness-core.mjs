/**
 * liveness-core.mjs — PURE liveness classifier. Zero-dep, no I/O, deterministic.
 *
 * Given a fetched page's { status, requestedUrl, finalUrl, bodyText,
 * applyControls }, decide whether the posting is still `active`, `expired`,
 * or `uncertain`. CONSERVATIVE BY DESIGN: a false "expired" is the worst
 * error (the user misses a real job), so anything ambiguous stays uncertain.
 *
 * Note on verbs: this module returns `active` for a live posting (matching
 * the parent). The `/api/liveness` route maps `active → live` at the wire
 * boundary so the SPA badge speaks in `live | expired | uncertain`.
 */

// Portals write closure banners with typographic punctuation and accents:
// WTTJ renders "Cette offre n’est plus disponible." with U+2019, not ASCII "'".
// A pattern spelled with a plain apostrophe silently never matches, so a clearly
// expired posting fell through to `no_apply_control` → uncertain → never filtered.
// Normalize once at the entry point and spell every pattern below in the
// normalized alphabet: ASCII quotes, no diacritics, collapsed whitespace.
//
// keepLineBreaks collapses a run of whitespace that held a line break to "\n"
// instead of " ". Every run becomes one character either way, so the two forms
// of a text line up index for index.
function normalizeForMatch(text = '', { keepLineBreaks = false } = {}) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[‘’ʼ′´`]/g, "'")
    .replace(/[“”″]/g, '"')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, (run) => (keepLineBreaks && run.includes('\n') ? '\n' : ' '));
}

const HARD_EXPIRED_PATTERNS = [
  /job (is )?no longer available/i,
  /job.*no longer open/i,
  // Generalized "filled" signal. The old /position has been filled/ missed the
  // phrasing SPA ATSs (Phenom, e.g. careers.icf.com) inject on a filled req —
  // "the job you are trying to apply for has been filled" — so those pages
  // returned HTTP 200 with a generic Apply control and were classified active.
  // A job noun within 60 chars, then "has been filled" — but NOT when the thing
  // filled is an application/form (the lookbehind) or "filled out" (the
  // lookahead). Both guards avoid the worse error: reading a LIVE posting whose
  // copy says "once the application form has been filled…" as expired.
  /\b(?:job|jobs|position|role|posting|opening|vacancy|requisition|req|listing)\b[\s\S]{0,60}?(?<!\b(?:application|form)\s)has been filled\b(?!\s+out)/i,
  /this job has expired/i,
  /job posting has expired/i,
  /no longer accepting applications/i,
  /this (position|role|job) (is )?no longer/i,
  // Widened from /this job (listing )?is closed/i, which only ever knew the
  // noun "job": boards write the same banner with whichever noun names the req
  // ("This role is closed" was 111 of 111 uncertain postings in one measured
  // run; "position" is equally common), so the narrow pattern left genuinely
  // dead postings sitting at no_apply_control → uncertain forever.
  //
  // The trailing \b(?!-) is a compound-adjective guard, and both halves earn
  // their keep. \b alone rejects "closedown" (d→o is word→word) but NOT
  // "closed-loop" (d→- is word→non-word, so the boundary matches) — and
  // "This role is closed-loop control of the platform" is real prose in a
  // control-systems JD. The (?!-) lookahead is what catches closed-loop /
  // closed-form / closed-source. Erring here is cheap in one direction only:
  // a missed banner costs one wasted re-check, a false match deletes a live
  // job from every future scan (see the 429 guard below for the mechanism).
  /this (?:job|role|position)(?: listing)? is closed\b(?!-)/i,
  // Built In keeps a removed posting's full JD and its APPLY control, and says
  // it is gone only in a banner under the title: "Sorry, this job was removed
  // at 08:47 p.m. (UTC) on Wednesday, Oct 14, 2026" (#6327). The "sorry"
  // keeps a sibling listing's "Job removed" badge from matching. (#6336)
  /\bsorry,? this job was removed\b/i,
  /job (listing )?not found/i,
  /the page you are looking for doesn.t exist/i,
  /applications?\s+(?:(?:have|are|is)\s+)?closed/i,
  // "Was closed on 15 December" is a closure. "Will be closed on", "is to be
  // closed on" and "may be closed on" give a date still ahead, on a posting
  // that is open until then.
  /(?<!\bbe\s)closed on \d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  /(?<!\bbe\s)closed on (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}/i,
  /diese stelle (ist )?(nicht mehr|bereits) besetzt/i,
  // French closure banners. Spelled accent-free on purpose: normalizeForMatch
  // strips diacritics, so "expiree" here matches "expirée" on the page.
  /offre (expiree|n'est plus disponible)/i,
  /(cette )?offre n'est plus (disponible|en ligne|active)/i,
  /(offre|poste|annonce) (deja )?pourvu(e)?/i,
  /offre (cloturee|desactivee|terminee)/i,
  /ce poste n'est plus (disponible|a pourvoir|ouvert)/i,
  /recrutement (termine|cloture)/i,
  /candidatures (closes|cloturees)/i,
  // Norwegian closure banners. arbeidsplassen.no, Jobbnorge and employer
  // career sites can keep a closed posting's "Søk her" link, so this has to be
  // a hard pattern (parent #6620). normalizeForMatch() folds å to a but not ø,
  // hence [øo] and "gatt". Only the past tense and statements that the post is
  // gone match: a deadline still ahead ("Søknadsfrist: 20.11.2026",
  // "Søknadsfristen utløper 20. november") and "Stillingen vil bli besatt"
  // never do.
  /s[øo]knadsfristen (?:er utl[øo]pt|har gatt ut)/i,
  /\b(?:stillingen|annonsen) er (?:ikke lenger (?:ledig|aktiv|tilgjengelig)|besatt|utl[øo]pt)\b/i,
];

const LISTING_PAGE_PATTERNS = [
  /\d+\s+jobs?\s+found/i,
  /search for jobs page is loaded/i,
];

// Weak expiry signals: real when nothing else on the page contradicts them,
// but too broad to override a visible apply control. The tier exists because
// HARD_EXPIRED_PATTERNS is checked BEFORE hasApplyControl — anything put in
// that list wins over a live Apply button, which is the wrong default for a
// phrase this generic.
//
// /\bjob expired\b/i belongs here and not up there because it false-fires on
// four shapes measured on genuinely LIVE postings: a "Similar jobs" carousel
// carrying a "Job Expired" entry, a "Hide job expired" filter chip, a footer
// FAQ asking "what happens when a job expired?", and — before the closed-loop
// guard above — "This role is closed-loop control of the platform" prose.
// bodyText is the whole page's innerText plus same-origin iframe text, so all
// of that chrome is in scope, not just the posting's own copy.
//
// Checked after hasApplyControl and before the listing-page heuristic, so the
// dead-page shape the phrase was added for (a bare "JOB EXPIRED" banner with
// no apply control anywhere) still resolves to expired. The comments on the
// 5xx and 429 guards below spell out why the tiering is worth the complexity:
// an `expired` result is written to scan-history as skipped_expired and
// dedup-filters that URL out of every later scan — indefinitely, unless
// scan_history.recheck_after_days is set — so a false positive here silently
// removes a real job forever, while a false negative costs one wasted check.
const SOFT_EXPIRED_PATTERNS = [
  /\bjob expired\b/i,
];

// Anti-bot interstitials (Cloudflare "Just a moment...", hCaptcha walls, etc.)
// render a tiny challenge page instead of the posting. Headless Playwright trips
// these on portals like pracuj.pl. They must NOT be read as expired: the body is
// short and lacks an apply control, so without this guard they fall through to
// `insufficient_content` → expired, and scan --verify would write live jobs to
// scan-history and permanently filter them out. Treat as uncertain instead.
const BOT_CHALLENGE_PATTERNS = [
  /just a moment/i,
  /performing security verification/i,
  /checking your browser before/i,
  /verify you are (a |not a )?human/i,
  /enable javascript and cookies to continue/i,
  /attention required.*cloudflare/i,
  /\bray id\b/i,
  /\bcf-ray\b/i,
  /please complete the security check/i,
];

// Cloudflare titles its own interstitials, whatever the site's branding in the
// body: "Just a moment..." for a managed challenge, "Attention Required! |
// Cloudflare" for a block. A site-branded challenge body can be long, and a
// reader that keeps a long page does not judge it by phrases a real posting may
// quote, so callers match the title of the page that settled instead (#6713).
// JD-fetch callers refuse on this regardless of the status band: a challenge a
// BROWSER passes reloads the real posting under its own title, but a static
// GET can never pass the wall — a page served under one of these titles is the
// wall itself, not the posting.
const CLOUDFLARE_INTERSTITIAL_TITLES = [
  { re: /^just a moment\.{0,3}(?:…)?$/i, kind: 'challenge page' },
  { re: /^attention required!?\s*\|\s*cloudflare$/i, kind: 'block page' },
];

/**
 * @param {string} title - the rendered page title
 * @returns {string|null} the interstitial kind, or null
 */
export function cloudflareInterstitial(title) {
  const text = String(title ?? '').trim();
  return CLOUDFLARE_INTERSTITIAL_TITLES.find(({ re }) => re.test(text))?.kind ?? null;
}

const EXPIRED_URL_PATTERNS = [
  /[?&]error=true/i,
];

const APPLY_PATTERNS = [
  /\bapply\b/i,
  /\bsolicitar\b/i,
  /\bbewerben\b/i,
  /\bpostuler\b/i,
  /submit application/i,
  /easy apply/i,
  /start application/i,
  /ich bewerbe mich/i,
  // Polish (pracuj.pl, justjoin.it, bulldogjob.pl): "Aplikuj" / "Aplikuj teraz" /
  // "Wyślij CV" / "Przejdź do panelu aplikowania". Without these, a fully-loaded
  // Polish posting has no recognized apply control and falls to no_apply_control.
  /\baplikuj\b/i,
  /panelu aplikowania/i,
  // Accent-free: apply controls go through normalizeForMatch too ("wyślij" → "wyslij").
  /wyslij (cv|aplikacj)/i,
  // Vietnamese (CareerViet): "NỘP ĐƠN ỨNG TUYỂN". NFD leaves Đ/đ as is, so the
  // first letter of "đơn" is matched explicitly; everything else is
  // accent-free, because apply controls go through normalizeForMatch. The
  // label alone proves nothing — a closed CareerViet posting keeps its whole
  // page and this button (upstream #4832 reads the posting's deadline before
  // this control for exactly that reason).
  /\bnop [dđ]on ung tuyen\b/i,
  // Bulgarian (#6192): "Кандидатствай" / "Кандидатствайте" — the imperative
  // "apply", singular and plural — and the noun "Кандидатстване" /
  // "Външно кандидатстване" (an external application). normalizeForMatch
  // strips the breve from Й ("Кандидатствай" normalizes to "…ваи"), so the
  // class covers both й and its normalized и. \b is ASCII-only and treats
  // Cyrillic as non-word, so the guards are Unicode letter/mark lookarounds
  // instead. The noun form is anchored to the START of the label: advice copy
  // like "Писмо за кандидатстване" (a cover-letter how-to) is not an Apply
  // button, and the lookahead keeps longer forms ("кандидатстването") out.
  /^кандидатства[ий](?:те)?(?![\p{L}\p{M}])/iu,
  /^(?:външно )?кандидатстване(?![\p{L}\p{M}])/iu,
  // Dutch (VDAB, Recruitee career sites in Dutch): "Solliciteer nu", "Solliciteren".
  /\bsollicit(?:eer|eren)\b/i,
  // Spanish (getManfred): "¡Apúntame!", "sign me up". Not the verb "aplicar":
  // most getManfred postings, closed ones too, have an FAQ button such as
  // "¿Puedo aplicar si vivo fuera de España?".
  /\bapuntame\b/i,
  // Spanish (HiringRoom): "Postularse". The label, not the verb: every HiringRoom
  // posting also links a help article, "¿Cómo me postulo?" ("how do I apply?").
  /\bpostularse\b/i,
  // Chinese MokaHR and Feishu Jobs detail pages use these exact control texts.
  // Keep them narrow: bare “申请” appears in descriptive prose, while longer
  // labels containing “投递” can be status/history controls rather than Apply.
  /^申请职位$/,
  /^投递$/,
  // Norwegian (arbeidsplassen.no, Jobbnorge, employer career sites): "Gå til
  // søknad", "Send søknad", "Søk på stillingen", "Søk nå". normalizeForMatch
  // turns "å" into "a" but leaves "ø" alone, so both are spelled here as they
  // arrive (parent #6620). Bare "Søk" is not Apply: it is also every Norwegian
  // site's search button ("Søk", "Søk etter stillinger"), so only the
  // qualified labels count, and only at the start of the label.
  /^(?:ga til|send) s[øo]knad(?:en)?(?![\p{L}\p{M}])/iu,
  /^s[øo]k (?:pa (?:denne |den )?(?:stillingen|jobben)|stillingen|her|na)(?![\p{L}\p{M}])/iu,
];

const MIN_CONTENT_CHARS = 300;

// A job-detail URL almost always carries the posting's identity: a numeric req id
// (Greenhouse, Workday pid, Microsoft) or a UUID (Lever, Ashby). If the requested
// URL had one and the final URL lost it, the browser landed somewhere else.
const JOB_ID_TOKEN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{5,}/gi;

function jobIdToken(url = '') {
  const matches = url.match(JOB_ID_TOKEN);
  return matches ? matches[matches.length - 1].toLowerCase() : null;
}

function firstMatch(patterns, text = '') {
  return patterns.find((pattern) => pattern.test(text));
}

// A hard pattern names a closure; it cannot tell whether the closure has
// happened. A live posting often says how it will end: "applications will be
// accepted until the position has been filled", "we will contact shortlisted
// candidates once applications have closed". Both read as banners, and hard
// patterns are checked before the apply control, so scan --verify recorded the
// live posting as skipped_expired and every later scan skipped it.
//
// So an occurrence counts only when no time or condition word opens its clause:
// none within ten words of the end of the match, with no clause punctuation and
// no line break in between. The line break matters because a banner sits on a
// line of its own, under page chrome that often ends without punctuation ("Sign
// in if you already have a profile"). With the lines joined, that "if" opened
// the banner's clause and the closed posting read as open. Every occurrence is
// checked, since a page can carry the closing line in its copy and a real
// banner above it.
//
// Words are separated by a single space because normalizeForMatch() leaves one
// character per run of whitespace; "\n" is not a space, so the clause stops there.
// The Norwegian openers are spelled as normalizeForMatch() leaves them (når →
// "nar", så → "sa"; ø is kept): public-sector postings routinely say "Når
// søknadsfristen er utløpt, blir søkerlisten offentliggjort", which describes
// what happens after the deadline, not a closed posting (parent #6620). "for"
// and "til" are left out because they are also prepositions in both languages.
// So is "etter" ("Søk etter stillinger"); see ETTER_BEFORE_MATCH for the one
// place a bare "etter" opens the clause.
const TIME_OR_CONDITION_CLAUSE =
  /(?:\b(?:until|till|once|when|whenever|after|before|unless|if|whether|as soon as|nar|etter at|inntil|hvis|dersom|sa snart)|(?<![\p{L}\p{N}])før) (?:[^\s.,;:!?…|•·]+ ){0,9}[^\s.,;:!?…|•·]+$/iu;

// A bare "etter" opens the clause only when the match itself starts at the
// deadline noun right after it: "Søknader behandles etter søknadsfristen er
// utløpt". A lookahead for the noun anywhere after "etter" also caught a sort
// control: "Sorter etter søknadsfrist Stillingen er besatt", with the control
// and the banner joined on one line, read the banner as part of a time clause
// and the filled position as active (parent #6788, CAR-259).
const ETTER_BEFORE_MATCH = /(?<![\p{L}\p{N}])etter $/iu;
const DEADLINE_NOUN_START = /^s[øo]knadsfrist/iu;

function opensTimeOrConditionClause(lines, match) {
  const end = match.index + match[0].length;
  if (TIME_OR_CONDITION_CLAUSE.test(lines.slice(0, end))) return true;
  return DEADLINE_NOUN_START.test(match[0]) && ETTER_BEFORE_MATCH.test(lines.slice(0, match.index));
}

// `lines` keeps its line breaks (normalizeForMatch with keepLineBreaks). The
// patterns match on the joined text, as every other check here does, so a
// banner broken over two lines still matches; only the clause test sees the
// breaks.
function firstStatedMatch(patterns, lines = '') {
  const text = lines.replace(/\n/g, ' ');
  return patterns.find((pattern) => {
    for (const match of text.matchAll(new RegExp(pattern, `${pattern.flags}g`))) {
      if (!opensTimeOrConditionClause(lines, match)) return true;
    }
    return false;
  });
}

function hasApplyControl(controls = []) {
  return controls.some((control) => APPLY_PATTERNS.some((pattern) => pattern.test(control)));
}

export function classifyLiveness({ status = 0, requestedUrl = '', finalUrl = '', bodyText: rawBodyText = '', applyControls: rawApplyControls = [] } = {}) {
  const bodyLines = normalizeForMatch(rawBodyText, { keepLineBreaks: true });
  const bodyText = bodyLines.replace(/\n/g, ' ');
  const applyControls = (Array.isArray(rawApplyControls) ? rawApplyControls : []).map((control) => normalizeForMatch(control));

  if (status === 404 || status === 410) {
    return { result: 'expired', code: 'http_gone', reason: `HTTP ${status}` };
  }

  // Bot/anti-scraping walls — never expired. Check before the content-length and
  // listing-page heuristics, which would otherwise misread the short challenge
  // body as a dead posting. 403/503 are access-blocked signals, not "gone"
  // (a genuinely removed posting returns 404/410 or a hard-expired banner).
  const botChallenge = firstMatch(BOT_CHALLENGE_PATTERNS, bodyText);
  if (botChallenge) {
    return { result: 'uncertain', code: 'bot_challenge', reason: `anti-bot challenge: ${botChallenge.source}` };
  }
  // 429 belongs with 403/503: rate limiting is the board throttling US, never
  // evidence the posting is gone. Its body is a short "Too Many Requests", well
  // under MIN_CONTENT_CHARS, so without this it fell through to
  // insufficient_content and read as `expired` — and an expired result is
  // written to scan-history as skipped_expired, whose URL every later scan
  // dedup-skips (indefinitely, unless scan_history.recheck_after_days is set).
  // Scanning harder is exactly what earns a 429, so this compounds.
  if (status === 403 || status === 429 || status === 503) {
    return { result: 'uncertain', code: 'access_blocked', reason: `HTTP ${status} (access blocked, likely anti-bot)` };
  }
  // Any other 5xx is a transient origin error (502/504 gateway hiccups, 500s
  // during deploys), not evidence the posting is gone. Without this guard the
  // short error body ("502 Bad Gateway / nginx") falls through to the
  // insufficient-content heuristic and reads as expired — and a false
  // "expired" permanently dedup-filters a real job out of future scans.
  if (status >= 500) {
    return { result: 'uncertain', code: 'server_error', reason: `HTTP ${status} (transient server error)` };
  }
  // Every other non-2xx (0 = no response, 401, 408, 451, …) says nothing about
  // the posting: the page was never read, so its short error body must not fall
  // through to the content heuristics below and read as `expired`.
  if (!(status >= 200 && status < 300)) {
    return { result: 'uncertain', code: 'http_status', reason: status ? `HTTP ${status}` : 'no HTTP response' };
  }

  const expiredUrl = firstMatch(EXPIRED_URL_PATTERNS, finalUrl);
  if (expiredUrl) {
    return { result: 'expired', code: 'expired_url', reason: `redirect to ${finalUrl}` };
  }

  const expiredBody = firstStatedMatch(HARD_EXPIRED_PATTERNS, bodyLines);
  if (expiredBody) {
    return { result: 'expired', code: 'expired_body', reason: `pattern matched: ${expiredBody.source}` };
  }

  // A dead permalink that 301s to a generic search/listing page still shows
  // "Apply" buttons — on OTHER jobs' cards (seen when jobs.careers.microsoft.com
  // permalinks migrated to apply.careers.microsoft.com). When the requested URL
  // carried a job identifier and the final URL lost it, the page being read is
  // not the posting, so apply controls are not evidence of liveness. Uncertain,
  // not expired: a portal migration can 301 live postings too, and a false
  // "expired" permanently filters a real job out of scans.
  const jobId = jobIdToken(requestedUrl);
  if (jobId && finalUrl && !finalUrl.toLowerCase().includes(jobId)) {
    return {
      result: 'uncertain',
      code: 'redirected_off_posting',
      reason: `redirected to ${finalUrl} — job id "${jobId}" missing from final URL`,
    };
  }

  if (hasApplyControl(applyControls)) {
    return { result: 'active', code: 'apply_control_visible', reason: 'visible apply control detected' };
  }

  // Weak expiry signals — see SOFT_EXPIRED_PATTERNS above for why these sit
  // below the apply-control check instead of in HARD_EXPIRED_PATTERNS.
  const softExpired = firstMatch(SOFT_EXPIRED_PATTERNS, bodyText);
  if (softExpired) {
    return { result: 'expired', code: 'expired_body_soft', reason: `pattern matched: ${softExpired.source}` };
  }

  const listingPage = firstMatch(LISTING_PAGE_PATTERNS, bodyText);
  if (listingPage) {
    return { result: 'expired', code: 'listing_page', reason: `pattern matched: ${listingPage.source}` };
  }

  if (bodyText.trim().length < MIN_CONTENT_CHARS) {
    return { result: 'expired', code: 'insufficient_content', reason: 'insufficient content — likely nav/footer only' };
  }

  return { result: 'uncertain', code: 'no_apply_control', reason: 'content present but no visible apply control found' };
}
