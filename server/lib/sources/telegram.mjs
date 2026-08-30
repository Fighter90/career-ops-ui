// @ts-check
/**
 * Telegram channel source — reads a PUBLIC channel's web preview at
 * `https://t.me/s/<channel>`. A tracked_companies entry selects it with
 * `provider: telegram` and names the channel in `channel:`.
 *
 * WHY THIS SHAPE. Telegram publishes no RSS, and the Bot API cannot read a
 * channel a bot does not administer — so neither of the obvious routes works
 * for someone else's job channel. What IS public is the `/s/` preview: plain
 * server-rendered HTML, no auth, no JS, no cookie. Verified 2026-08-29 across
 * 16 channels: 15 returned 20 posts each on a bare GET; the sixteenth
 * (`jobGeeks`) 302s, which is how t.me answers for a channel that is private
 * or absent — hence the explicit "no posts parsed" error rather than a silent
 * empty result.
 *
 * PARSING CONTRACT. Markup rots, so the anchors are the things a Telegram
 * redesign is least likely to move, all of them semantic rather than cosmetic:
 *
 *   1. `data-post="<channel>/<id>"` — splits the page into per-post windows AND
 *      carries the permalink, which is the only stable URL a post ever has;
 *   2. `<div class="tgme_widget_message_text">` — the body;
 *   3. `<time datetime="…">` — an ISO timestamp, not a localized "2h ago".
 *
 * WHAT A POST IS NOT. Every other source in this registry reads a structured
 * job record. A channel post is free prose written by a human, and a job
 * channel also carries ads, digests and chatter. So this source does NOT
 * pretend to extract a clean vacancy: it lifts a title from the first
 * meaningful line, best-effort company/location/salary from common Russian and
 * English patterns, and leaves the rest in `snippet`. The scanner's existing
 * `title_filter` is what separates real postings from noise — the same filter
 * the user already tuned — so a channel that is 50% ads costs precision, not
 * correctness. Treat the numbers this source reports as leads, not listings.
 */
import { fetchText } from '../http-json.mjs';
import { decodeEntities } from '../html-entities.mjs';

export const meta = {
  value: 'telegram',
  label: 'Telegram',
  region: 'en',
};

const TELEGRAM_HOST_RE = /^t\.me$/i;
const DEFAULT_MAX_POSTS = 100;
const HARD_MAX_POSTS = 300;

/** A channel handle: what Telegram itself allows, nothing more. */
const CHANNEL_RE = /^[A-Za-z][A-Za-z0-9_]{3,31}$/;

/**
 * Validate a t.me URL. HTTPS-only, host pinned to t.me exactly — a subdomain
 * or lookalike (`t.me.evil.test`) must not pass, which `endsWith` would allow.
 * @param {string} url
 */
export function assertTelegramUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`telegram: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`telegram: URL must use HTTPS: ${url}`);
  if (!TELEGRAM_HOST_RE.test(parsed.hostname)) {
    throw new Error(`telegram: untrusted hostname "${parsed.hostname}" — must be t.me`);
  }
  return url;
}

/**
 * Normalize whatever the user wrote in `channel:` to a bare handle. People
 * paste the full link far more often than the handle, so accept
 * `https://t.me/name`, `t.me/name`, `@name` and `name` alike rather than
 * failing on the most natural thing to type.
 * @param {unknown} raw
 * @returns {string} the handle, or '' when it cannot be read as one
 */
export function normalizeChannel(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  s = s.replace(/^https?:\/\//i, '').replace(/^t\.me\//i, '').replace(/^s\//i, '').replace(/^@/, '');
  s = s.split(/[/?#]/)[0].trim();
  return CHANNEL_RE.test(s) ? s : '';
}

/** @param {object} entry a tracked_companies entry */
export function buildChannelUrl(entry) {
  const handle = normalizeChannel(entry?.channel ?? entry?.telegram ?? entry?.name);
  if (!handle) throw new Error('telegram: no usable channel handle (set `channel:` to e.g. rabotaphp)');
  return `https://t.me/s/${handle}`;
}

/**
 * Strip tags, decode entities, collapse whitespace — the body is prose.
 *
 * Two things a one-line `replace(/<[^>]+>/g, '')` gets wrong here:
 *
 *   1. it eats real text. A post reading "зарплата < 300k, опыт > 3 лет" has
 *      `< 300k, опыт >` matched as a tag and deleted. Requiring a letter after
 *      the `<` keeps prose intact and still catches every real tag;
 *   2. it is an incomplete sanitizer — removing `<b>` from `<scr<b>ipt>`
 *      re-forms `<script>` out of the text on either side. Nothing here reaches
 *      an HTML sink today (`UI.md()` escapes every byte before rendering), but
 *      a stripper that can be talked into emitting a tag is one refactor away
 *      from mattering, so the strip runs to a fixed point.
 *
 * The loop is bounded: each pass strictly shortens the string, but an
 * adversarial `<<<<<a>>>>>` could cost a pass per character. Eight clear any
 * nesting real markup produces.
 */
export function visibleText(fragment) {
  const finish = (s) => decodeEntities(s)
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  let s = String(fragment || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n');

  for (let i = 0; i < 8; i++) {
    const next = s.replace(/<\/?[a-zA-Z][^>]*>/g, '');
    if (next === s) return finish(s);
    s = next;
  }
  // Not converged in eight passes: this is not prose, it is a nesting attack.
  // One more strip could still leave a reassembled tag, so drop the angle
  // brackets outright — the result provably carries no `<` at all.
  return finish(s.replace(/[<>]/g, ''));
}

/**
 * The post's title: its first line that looks like a heading rather than a
 * greeting or an emoji divider. Job posts overwhelmingly lead with the role,
 * which is why the first substantive line beats any keyword heuristic here.
 * @param {string} text
 */
export function titleFromText(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    // Drop pure-emoji / punctuation dividers and one-word interjections.
    const letters = line.replace(/[^\p{L}\p{N}]/gu, '');
    if (letters.length < 4) continue;
    return line.replace(/^[#>*\-–—•·\s]+/, '').slice(0, 160).trim();
  }
  return '';
}

// Deliberately conservative: a wrong company is worse than none, because it
// shows up in the tracker as fact. Only patterns that name the field outright.
const COMPANY_RE = /(?:^|\n)\s*(?:компания|company|работодатель|employer)\s*[:\-–—]\s*([^\n]{2,200})/iu;
const LOCATION_RE = /(?:^|\n)\s*(?:локация|город|location|office|формат)\s*[:\-–—]\s*([^\n]{2,200})/iu;

/**
 * A labelled line gives a NAME followed, more often than not, by what the
 * company does: "Birmarket - крупнейший маркетплейс Азербайджана, работает
 * с 2019" or "FinCore Technology (продуктовая разработка, высоконагруженные
 * системы)". Keeping the whole line and capping it produced tracker rows like
 * `FinCore Technology (продуктовая разработка, высоконагруженны` — cut
 * mid-word, and no longer a company name at all.
 *
 * That matters because this source attributes a company as FACT. A truncated
 * sentence is as wrong as a guessed name, just less obviously so.
 *
 * The name ends at the first separator that introduces a description: a SPACED
 * dash (so `Coca-Cola` survives — the hyphen there has no spaces), a comma, a
 * semicolon, a pipe, or an opening parenthesis. What remains is capped on a
 * word boundary, never inside a word.
 * @param {string} raw
 * @returns {string}
 */
export function companyName(raw) {
  let name = String(raw ?? '').trim().split(/\s[—–-]\s|[,;|(]/)[0].trim();
  if (name.length > 60) name = name.slice(0, 60).replace(/\s+\S*$/, '').trim();
  // Punctuation the split can leave hanging on the end of a name.
  return name.replace(/[\s.,;:–—-]+$/, '').trim();
}
// Unicode-aware left boundary, NOT \b: \b is ASCII-only, so a space before a
// Cyrillic word is not a boundary at all and `\bудал` never matched
// "Go dev, удалёнка". Same trap the title filter hit in v1.227.3.
const REMOTE_RE = /(?<![\p{L}\p{M}\p{N}_])(?:remote|удал[её]н|from\s+home|релокац)/iu;
// "от 200 000 ₽", "150000-250000 руб", "$4000", "€60k" — currency or an explicit "от".
const SALARY_RE = /(?:(?:от|from)\s*)?(?:[$€£]\s?\d[\d\s.,]{2,}|\d[\d\s.,]{2,}\s*(?:₽|руб|rub|usd|eur|k\b))(?:\s*[-–—]\s*[\d\s.,]+\s*(?:₽|руб|rub|usd|eur|k\b)?)?/iu;

/**
 * Parse one `/s/` page into job-shaped records.
 *
 * Splits on `data-post` windows rather than on any layout container: the
 * attribute is what Telegram needs for permalinks, so it survives restyling.
 * @param {string} html
 * @param {string} channel handle, used for the fallback company name
 * @returns {Array<object>}
 */
export function parseChannelPage(html, channel) {
  const src = String(html || '');
  const out = [];
  // Window from one data-post to the next; the last runs to end-of-document.
  const anchors = [...src.matchAll(/data-post="([^"/]+)\/(\d+)"/g)];
  for (let i = 0; i < anchors.length; i++) {
    const [, chan, id] = anchors[i];
    const start = anchors[i].index ?? 0;
    const end = i + 1 < anchors.length ? (anchors[i + 1].index ?? src.length) : src.length;
    const win = src.slice(start, end);

    const bodyMatch = win.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    if (!bodyMatch) continue;                        // service message / media-only post
    const text = visibleText(bodyMatch[1]);
    const title = titleFromText(text);
    if (!title) continue;                            // nothing a human could read as a role

    const timeMatch = win.match(/<time[^>]+datetime="([^"]+)"/);
    const posted = timeMatch ? Date.parse(timeMatch[1]) : NaN;
    const company = companyName(text.match(COMPANY_RE)?.[1] || '');
    const location = companyName(text.match(LOCATION_RE)?.[1] || '');
    const isRemote = REMOTE_RE.test(text);
    const salary = (text.match(SALARY_RE)?.[0] || '').trim();

    out.push({
      id: `telegram-${chan}-${id}`,
      title,
      // No company named → the channel is the honest attribution, not a guess.
      company: company || `@${chan}`,
      url: `https://t.me/${chan}/${id}`,
      salary,
      location: location || (isRemote ? 'Remote' : ''),
      isRemote,
      workplaceType: isRemote ? 'Remote' : '',
      relocates: false,
      date: Number.isFinite(posted) ? new Date(posted).toISOString() : '',
      // The full post: content_filter reads this, and it is what the user
      // actually needs to judge a lead that carries no structured fields.
      snippet: text.slice(0, 1200),
      description: text,
      source: 'telegram',
    });
  }
  return out;
}

/**
 * Fetch + normalize one public Telegram channel.
 * @param {string} url `https://t.me/s/<channel>` (from buildEndpoint)
 * @param {{ fetchImpl?: Function, signal?: AbortSignal, company?: object }} [opts]
 */
export async function fetchTelegram(url, opts = {}) {
  const { fetchImpl = fetch, signal, company = {} } = opts;
  const target = url || buildChannelUrl(company);
  assertTelegramUrl(target);
  const handle = normalizeChannel(target.split('/s/')[1] || company.channel || '');

  const html = await fetchText(fetchImpl, target, { signal });
  const posts = parseChannelPage(html, handle);

  // A public channel always renders posts. Zero means the handle is wrong, the
  // channel is private, or t.me redirected — all worth surfacing, because a
  // silent empty result reads as "no vacancies today" and hides a typo forever.
  if (posts.length === 0) {
    throw new Error(`telegram: no posts parsed from ${target} — channel may be private, empty or misspelled`);
  }

  const cap = Math.min(
    HARD_MAX_POSTS,
    Math.max(1, Number(company.max_posts) || DEFAULT_MAX_POSTS),
  );
  return posts.slice(0, cap);
}
