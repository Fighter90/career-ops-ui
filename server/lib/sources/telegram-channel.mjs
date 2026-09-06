// @ts-check
/**
 * Telegram public channels — the STRICT reader (`provider: telegram-channel`).
 *
 *   GET https://t.me/s/<channel>[?before=<id>]
 *
 * web-ui already ships `telegram`, which reads the same preview pages. The two
 * are not duplicates and the parent ships both side by side: they draw the line
 * between "a post" and "a job posting" in different places.
 *
 *   telegram          — every post becomes a row; an unlabelled one is
 *                       attributed to the channel handle. High recall, and the
 *                       user's `title_filter` does the separating.
 *   telegram-channel  — a post becomes a row ONLY when it names an employer AND
 *                       links to a vacancy page. Low recall by design, but every
 *                       row carries a real employer and a real link.
 *
 * Measured upstream on HR-curated channels: 32-77% of posts pass. A community
 * channel of contact-only posts yields little here, on purpose — a wrong
 * employer entering the tracker as fact is worse than a missing row.
 *
 * Ported from parent career-ops v1.32.0 (`providers/telegram-channel.mjs`, #3668).
 */
import { fetchText, delay, BROWSER_LIKE_USER_AGENT } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';
import { htmlToText, DESCRIPTION_CAP } from '../html-to-text.mjs';

export const meta = {
  value: 'telegram-channel',
  label: 'Telegram (strict)',
  region: 'en',
};

const CHANNEL_RE = /^[a-z0-9_]{5,32}$/i;
const MAX_PAGES_CAP = 10;
const DEFAULT_SINCE_DAYS = 30;
const TITLE_CAP = 120;
const PAGE_DELAY_MS = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

// Hosts that are never an application target: Telegram itself, social, blogs,
// app stores. A link to one of these is a footer or a cross-post, not a job.
const NON_APPLY_HOSTS = /(^|\.)(t\.me|telegram\.me|telegram\.org|telegra\.ph|telega\.in|vk\.com|vk\.cc|max\.ru|ok\.ru|facebook\.com|fb\.com|instagram\.com|youtube\.com|youtu\.be|x\.com|twitter\.com|tiktok\.com|threads\.net|store\.steampowered\.com|play\.google\.com|apps\.apple\.com|substack\.com|medium\.com|habr\.com|github\.com)$/i;
const SHORTENER_HOSTS = /(^|\.)(goo\.gl|bit\.ly|t\.co|cjl\.ist|clck\.ru|tglink\.io|tinyurl\.com|cutt\.ly|is\.gd|ow\.ly|rb\.gy|surl\.li)$/i;
const FORM_HOSTS = /(^|\.)(forms\.gle|docs\.google\.com|forms\.yandex\.ru|typeform\.com|tally\.so|airtable\.com|notion\.site|notion\.so)$/i;
// Multi-employer boards: a per-vacancy page here is real, but the employer's
// own page beats it when a post carries both.
const BOARD_HOSTS = /(^|\.)(getmatch\.ru|finder\.work|geekjob\.ru|geeklink\.io|linkedin\.com|hh\.ru|career\.habr\.com|djinni\.co|indeed\.com|glassdoor\.com|weworkremotely\.com|remoteok\.com|arbeitnow\.com|cryptojobslist\.com|relocate\.me|lemon\.io)$/i;

const VACANCY_EVIDENCE_RE = /\/(vacanc|job|position|opening|career|apply|hiring)|[-_/](?!(?:19|20)\d{2}(?=[/?#]|$))\d{4,}(?=[/?#]|$)|\/j\/[A-Z0-9]{6,}(?=[/?#]|$)|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const TRACKING_PARAM_RE = /^(utm_|ref$|referrer$|source$|src$|s$|from$|campaign$|fbclid$|gclid$|yclid$|mc_|_hs|igshid$|trk$)/i;
const LISTING_ROOT_RE = /^\/(jobs|vacancies|careers|career|vacancy|vakansii|job)$/i;
const LOCALE_ROOT_RE = /^(\/[a-z]{2}(-[a-z]{2})?)?$/i;

const EMPLOYER_LABEL_RE = /^[^\p{L}\p{N}]{0,3}\s*(?:компания|компанія|company|работодатель|employer|hiring company)\s*[:：]\s*(.{2,80})$/iu;
const ANONYMOUS_RE = /(?:название скрыто|компания скрыта|name hidden|undisclosed|confidential|\bour client\b|наш(?:его|им|ему)? клиент|для клиента)/i;
// Unicode boundaries, not `\b`. The parent's version used `\b`, which is
// ASCII-only and therefore never fires next to Cyrillic — every Russian
// alternative here (москва, спб, офис, удалёнк*) was unreachable, so
// `Senior Engineer | Москва` yielded "Москва" as the EMPLOYER. That is the
// wrong-field-as-fact this whole policy exists to prevent, and it landed on
// the provider's primary audience: a Russian-language channel writes the
// location in Cyrillic. `\w*` after удал[её]нк is ASCII-only for the same
// reason and cannot reach the ending, so it becomes \p{L}*.
const LOCATIONISH_RE = /(?<![\p{L}\p{N}])(remote|удал[её]нк\p{L}*|hybrid|onsite|office|офис|full[- ]?time|part[- ]?time|москва|спб|berlin|london|germany|europe|usa)(?![\p{L}\p{N}])/iu;
const DATE_LIKE_RE = /\b(19|20)\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\b/i;
const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;
const HASHTAG_LINE_RE = /^#\S+(?:\s+#\S+)*$/u;
const ROLE_WORD_RE = /(?<![\p{L}\p{N}])(senior|middle|junior|lead|principal|staff|head|chief|intern|trainee|engineer|developer|manager|analyst|designer|architect|specialist|consultant|director|recruiter|scientist|инженер|разработчик|менеджер|специалист|аналитик|директор|архитектор|рекрутер|стажер|стажёр)(?![\p{L}\p{N}])/iu;

/** First non-empty line of a post, cut at a word boundary under TITLE_CAP. */
function headline(lines) {
  const first = lines[0] || '';
  if (first.length <= TITLE_CAP) return first;
  const cut = first.slice(0, TITLE_CAP);
  const space = cut.lastIndexOf(' ');
  return `${space > TITLE_CAP / 3 ? cut.slice(0, space) : cut}…`;
}

/**
 * Does `name` read as an employer, rather than as the location, contract or
 * date the same title patterns also capture? Digits are allowed for a labelled
 * field (`X5 Tech`, `Т1`) and refused where the name came out of a title split
 * (`Title | September 02, 2026`).
 * @param {string} name
 * @param {boolean} fromTitle
 */
function plausibleEmployer(name, fromTitle) {
  const n = name.replace(ZERO_WIDTH_RE, '').trim();
  if (n.length < 2 || n.length > 60) return '';
  if (n.split(/\s+/).length > 4) return '';
  if (/[,:;!?]/.test(n) || /\.$/.test(n)) return '';
  if (LOCATIONISH_RE.test(n) || ANONYMOUS_RE.test(n)) return '';
  if (fromTitle && (DATE_LIKE_RE.test(n) || /\d/.test(n))) return '';
  if (!/\p{Lu}/u.test(n)) return '';
  return n;
}

/**
 * The employer a post names, or '' when it names none.
 *
 * Five shapes cover what public channels actually write: a labelled line
 * (`Компания: X`), `Title @ Employer`, `Title | Employer`, a second line
 * opening `в Employer —`, and a hashtag-only first line followed by the bare
 * employer name. The last has no marker pinning the line to "employer" at all,
 * so it additionally refuses a line that reads as a role. Nothing is guessed —
 * not the channel name, not the link's host, not free text.
 * @param {string[]} lines
 */
export function employerName(lines) {
  let m;
  for (const line of lines.slice(0, 40)) {
    if ((m = line.match(EMPLOYER_LABEL_RE))) return plausibleEmployer(m[1].replace(/\s*[|(].*$/, ''), false);
  }
  const first = lines[0] || '';
  const second = lines[1] || '';
  if ((m = first.match(/^.{3,140}?\s+@\s+(.{2,60})$/))) return plausibleEmployer(m[1], true);
  if ((m = first.match(/^.{3,140}?\s+\|\s+([^|]{2,60})$/))) return plausibleEmployer(m[1], true);
  if ((m = second.match(/^(?:в|at)\s+([^—–,(]{2,60}?)\s*(?:[—–]|$)/u))) return plausibleEmployer(m[1], true);
  if (HASHTAG_LINE_RE.test(first) && second) {
    const fromHashtagTemplate = plausibleEmployer(second, false);
    if (fromHashtagTemplate && !ROLE_WORD_RE.test(fromHashtagTemplate)) return fromHashtagTemplate;
  }
  return '';
}

/**
 * What a link in a post is: `employer` (a vacancy page on the employer's own
 * host), `board` (a known multi-employer board's per-vacancy page), or null
 * (Telegram, social, footer, shortener, form, homepage, locale root, listing
 * root, or a page with no vacancy evidence).
 * @param {string} href
 * @returns {'employer' | 'board' | null}
 */
export function classifyLink(href) {
  let u;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  if (!host || NON_APPLY_HOSTS.test(host) || SHORTENER_HOSTS.test(host) || FORM_HOSTS.test(host)) return null;
  const path = u.pathname.replace(/\/+$/, '');
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return /\/jobs\/view\//.test(path) ? 'board' : null;
  // A homepage or listing root stays one even with a tracking tail; only a
  // parameter that could identify a vacancy makes it a page.
  const identifying = [...u.searchParams.keys()].some((k) => !TRACKING_PARAM_RE.test(k));
  if (LOCALE_ROOT_RE.test(path) && !identifying) return null;
  if (LISTING_ROOT_RE.test(path) && !identifying) return null;
  if (!VACANCY_EVIDENCE_RE.test(path) && !identifying) return null;
  return BOARD_HOSTS.test(host) ? 'board' : 'employer';
}

/**
 * Identity of a vacancy link: host, path and the query keys that identify the
 * vacancy, minus tracking keys and the fragment. The same page linked twice
 * with different `utm_` tails is one vacancy.
 * @param {string} href already known to parse
 */
function vacancyKey(href) {
  const u = new URL(href);
  const keep = [...u.searchParams.entries()].filter(([k]) => !TRACKING_PARAM_RE.test(k)).sort();
  return `${u.hostname.replace(/^www\./, '').toLowerCase()}${u.pathname.replace(/\/+$/, '')}?${new URLSearchParams(keep)}`;
}

/**
 * The link a job should carry, or null.
 *
 * The employer's own page beats a board mirror of the same vacancy. A post
 * carrying two or more DISTINCT vacancy pages of one kind is a digest, not a
 * listing, and yields null — the scanner cannot split it into the jobs it
 * bundles. One board page plus the employer's own page is the same vacancy
 * mirrored, which is normal and must not count as a digest.
 * @param {string[]} hrefs
 */
export function applicationLink(hrefs) {
  const seen = new Set();
  const qualified = [];
  for (const href of hrefs) {
    const kind = classifyLink(href);
    if (!kind) continue;
    const key = vacancyKey(href);
    if (seen.has(key)) continue;
    seen.add(key);
    qualified.push({ url: href, kind });
  }
  if (qualified.length === 0) return null;
  for (const kind of ['employer', 'board']) {
    if (qualified.filter((q) => q.kind === kind).length > 1) return null;
  }
  return qualified.find((q) => q.kind === 'employer') || qualified[0];
}

/**
 * Parse one preview page.
 *
 * Links are read from the body's markup BEFORE it is flattened, because
 * `htmlToText` drops anchors. Service messages and media-only posts carry no
 * text a title could be made of and are skipped.
 * @param {unknown} html
 * @param {string} channel
 */
export function parseChannelPage(html, channel) {
  if (typeof html !== 'string' || !html) return { posts: [], noPreview: false, textPosts: 0 };
  const chunks = html.split(/<div class="tgme_widget_message_wrap/).slice(1);
  const posts = [];
  const seen = new Set();
  for (const chunk of chunks) {
    if (/\bservice_message\b/.test(chunk)) continue;
    const post = chunk.match(/data-post="([^"/]+)\/(\d+)"/);
    if (!post || post[1].toLowerCase() !== channel.toLowerCase()) continue;
    const id = Number(post[2]);
    if (!Number.isInteger(id) || seen.has(id)) continue;
    const textM = chunk.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    if (!textM) continue;
    const lines = textM[1].split(/<br\s*\/?>/i).map((l) => htmlToText(l).replace(ZERO_WIDTH_RE, '')).filter(Boolean);
    const title = headline(lines);
    if (!title) continue;
    // t.me double-encodes query ampersands in hrefs, so one decode leaves
    // `&amp;` inside the URL.
    const hrefs = [...textM[1].matchAll(/href="([^"]+)"/g)].map((h) => decodeEntities(decodeEntities(h[1])));
    const timeM = chunk.match(/<time datetime="([^"]+)"/);
    const postedAt = timeM ? Date.parse(timeM[1]) : NaN;
    seen.add(id);
    posts.push({
      id,
      url: `https://t.me/${channel}/${id}`,
      title,
      description: lines.join('\n'),
      lines,
      hrefs,
      postedAt: Number.isFinite(postedAt) ? postedAt : undefined,
    });
  }
  const noPreview = posts.length === 0 && /<meta property="og:title" content="Telegram: Contact @/i.test(html);
  // Counted independently of the split above, so a renamed wrapper class still
  // reads as "posts we failed to parse" rather than as an empty board.
  const own = Math.max(chunks.length, (html.match(new RegExp(`data-post="${channel}/`, 'gi')) || []).length);
  const withText = (html.match(/tgme_widget_message_text/g) || []).length;
  const service = (html.match(/\bservice_message\b/g) || []).length;
  const textPosts = Math.max(0, Math.min(own, withText) - service);
  return { posts, noPreview, textPosts };
}

/**
 * Turn one parsed post into a web-ui job, or null when the policy cannot
 * attribute it.
 * @param {any} post
 * @param {string} channel
 */
export function postToJob(post, channel) {
  const company = employerName(post.lines);
  if (!company) return null;
  if (ANONYMOUS_RE.test(post.lines.slice(0, 3).join('\n'))) return null;
  const link = applicationLink(post.hrefs);
  if (!link) return null;

  // On the hashtag-first template lines[0] is tags, not a title. The real title
  // is the first later line that is neither more tags, the employer just
  // matched, nor a bare link. With no such line the shape has no title to give,
  // and emitting the hashtag line would be the same wrong-field-as-fact the
  // rest of this policy exists to prevent — so the post is dropped.
  let title = post.title;
  if (HASHTAG_LINE_RE.test(post.lines[0] || '')) {
    const isLinkLine = (l) => post.hrefs.includes(l) || /^https?:\/\//i.test(l);
    const better = post.lines.slice(1).find((l) => l !== company && !HASHTAG_LINE_RE.test(l) && !isLinkLine(l));
    if (!better) return null;
    title = headline([better]);
  }

  const source = `\n\nSource: ${post.url}`;
  const description = post.description.slice(0, DESCRIPTION_CAP - source.length) + source;
  return {
    id: `telegram-channel-${channel}-${post.id}`,
    title,
    company,
    url: link.url,
    salary: '',
    location: '',
    isRemote: false,
    workplaceType: '',
    relocates: false,
    date: post.postedAt !== undefined ? new Date(post.postedAt).toISOString() : '',
    snippet: description.slice(0, 400),
    description,
    source: 'telegram-channel',
  };
}

/** @param {unknown} raw @param {number} fallback @param {number} cap */
function pageCount(raw, fallback, cap) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, cap);
}

/** @param {object} [company] */
export function resolveChannel(company = {}) {
  const channel = String(company.channel ?? '').replace(/^@/, '').trim();
  // The handle is the only value that reaches the URL, and the pattern pins it
  // to t.me/s/<handle>: no path separators, no query, no other host.
  if (!CHANNEL_RE.test(channel)) {
    throw new Error(`telegram-channel: "${company.name || '?'}" needs a channel handle (5-32 letters, digits or underscores, no @), got ${JSON.stringify(company.channel)}`);
  }
  return channel;
}

/** @param {object} [company] */
export function buildTelegramChannelUrl(company = {}) {
  return `https://t.me/s/${resolveChannel(company)}`;
}

/**
 * Fetch + normalize one public channel.
 * @param {string} _url from buildEndpoint (page URLs are built per page below)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchTelegramChannel(_url, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const channel = resolveChannel(company);
  const entryPages = pageCount(company.max_pages, MAX_PAGES_CAP, MAX_PAGES_CAP);
  const sinceDays = Number(company.since_days);
  const windowDays = Number.isFinite(sinceDays) && sinceDays > 0 ? sinceDays : DEFAULT_SINCE_DAYS;
  const cutoff = Date.now() - windowDays * DAY_MS;
  const label = company.name || `@${channel}`;

  const jobs = [];
  let before = null;
  let read = 0;
  let reachedCutoff = false;
  let page = 0;

  for (; page < entryPages; page++) {
    if (page > 0) await delay(PAGE_DELAY_MS, signal);
    const url = `https://t.me/s/${channel}${before === null ? '' : `?before=${before}`}`;
    let html;
    try {
      html = await fetchText(fetchImpl, url, {
        signal,
        headers: { 'user-agent': BROWSER_LIKE_USER_AGENT },
        redirect: 'error',
      });
    } catch (err) {
      // t.me answers a private or missing channel with a redirect, which
      // redirect:'error' turns into a throw. On page 0 that is the answer, not
      // a transport blip, and it must be named rather than reported as "fetch
      // failed" — a typo in the handle would otherwise look like an outage.
      if (page === 0) {
        throw new Error(`telegram-channel: @${channel} has no public preview — private channel, preview switched off, or no such channel. It cannot be read without an authenticated Telegram integration. (${err.message})`);
      }
      throw err;
    }

    const { posts, noPreview, textPosts } = parseChannelPage(html, channel);
    if (page === 0 && noPreview) {
      throw new Error(`telegram-channel: @${channel} has no public preview (private channel, or preview switched off) — it cannot be read without an authenticated Telegram integration`);
    }
    if (page === 0 && posts.length === 0 && textPosts > 0) {
      throw new Error(`telegram-channel: @${channel} served ${textPosts} text posts but none parsed — t.me markup changed`);
    }
    if (posts.length === 0) break;

    const oldest = Math.min(...posts.map((p) => p.id));
    if (before !== null && oldest >= before) break; // t.me re-served the same page
    read += posts.length;
    for (const post of posts) {
      if (post.postedAt !== undefined && post.postedAt < cutoff) { reachedCutoff = true; continue; }
      const job = postToJob(post, channel);
      if (job) jobs.push(job);
    }
    if (reachedCutoff) break;
    before = oldest;
  }

  // The window was not reached, so the inventory is a prefix of it.
  if (page >= entryPages && !reachedCutoff) {
    console.error(`⚠️  telegram-channel: ${label} truncated at max_pages=${entryPages} (${read} posts read, none older than since_days=${windowDays} yet) — raise max_pages on this entry for the full window`);
  }
  return jobs;
}
