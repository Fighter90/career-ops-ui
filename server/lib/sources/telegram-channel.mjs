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
 * Parent #6363 re-measured on 2,973 posts from 51 public RU/CIS channels
 * after the positional employer shapes and the Habr Career fix: 284 → 621
 * posts pass; of the 284 the earlier rules emitted, 271 come out identical
 * and 13 are refused (12 named no employer, one linked a mirror whose
 * operator is not declared — UNDECLARED_HOSTS).
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
// Checked before NON_APPLY_HOSTS: career.habr.com is a board, but it is also a
// subdomain of habr.com, which is a long-read host — tested the other way
// round, every Habr Career vacancy link (all the Proglib channels link there)
// was dropped as a blog link.
const BOARD_HOSTS = /(^|\.)(getmatch\.ru|finder\.work|geekjob\.ru|geeklink\.io|linkedin\.com|hh\.ru|career\.habr\.com|djinni\.co|indeed\.com|glassdoor\.com|weworkremotely\.com|remoteok\.com|arbeitnow\.com|cryptojobslist\.com|relocate\.me|lemon\.io|ingamejob\.com)$/i;
// Hosts channels link instead of the employer that career-ops does not read:
// mirrors whose operator is not declared under the source policy yet
// (remocate.app, offerclaw.app), a vacancy aggregator whose page the posts
// carry in place of the employer's link (vseti.app), and a shared ATS for
// freelance recruiters, where the employer is often left blank
// (hellowehire.com). Refused outright: left off BOARD_HOSTS alone, their
// vacancy pages would pass as the employer's own site. A mirror moves to
// BOARD_HOSTS once its operator is declared (parent: docs/SOURCE_INDEXING_LOG.md).
const UNDECLARED_HOSTS = /(^|\.)(remocate\.app|offerclaw\.app|vseti\.app|hellowehire\.com)$/i;

const VACANCY_EVIDENCE_RE = /\/(vacanc|job|position|opening|career|apply|hiring)|[-_/](?!(?:19|20)\d{2}(?=[/?#]|$))\d{4,}(?=[/?#]|$)|\/j\/[A-Z0-9]{6,}(?=[/?#]|$)|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const TRACKING_PARAM_RE = /^(utm_|ref$|referrer$|source$|src$|s$|from$|campaign$|fbclid$|gclid$|yclid$|mc_|_hs|igshid$|trk$)/i;
const LISTING_ROOT_RE = /^\/(jobs|vacancies|careers|career|vacancy|vakansii|job)$/i;
const LOCALE_ROOT_RE = /^(\/[a-z]{2}(-[a-z]{2})?)?$/i;

const EMPLOYER_LABEL_RE = /^[^\p{L}\p{N}]{0,3}\s*(?:компания|компанія|company|работодатель|employer|hiring company)\s*[:：]\s*(.{2,80})$/iu;
const ANONYMOUS_RE = /(?:название скрыто|компания скрыта|name hidden|undisclosed|confidential|\bour client\b|наш(?:его|им|ему)? клиент|для клиента)/i;
// The same, said further down the post: "Подбор ведёт агентство Top
// Selection, название компании-заказчика не раскрыто" follows a first line
// "Top Selection ищет …", which names the agency, not the employer. Matched
// over the whole post: unlike "наш клиент", none of these phrases appears in
// an employer's own description of itself. Each one names the employer as
// what is withheld: "Зарплата не раскрыта" and "Оценка компании не
// раскрывается" (both measured) withhold something else. "компании
// заказчика" with a space and "наименование" say the same; "не указано" is
// left out: it is the salary's phrase, and "название заказчика проекта не
// указано" (measured) follows an employer that is named.
const DISCLOSED_HIDDEN_RE = /((?:назван|наименован)\p{L}*\s+(?:компании|работодателя|заказчика|клиента)(?:[-\s]+заказчика)?\s+не\s+(?:раскры|называ)|компани[яию]-заказчик|неназванн\p{L}*\s+(?:\p{L}+\s+){0,2}(?:компани|организаци|фирм|финтех|клиент|заказчик|работодател))/iu;
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
// Role vocabulary extended in parent #3928 (product owner, qa, tester, devops,
// sre, тестировщик, тимлид, владелец, руководитель, маркетолог, программист) —
// replayed upstream against the saved 809-post corpus with no attribution lost.
const ROLE_WORD_RE = /(?<![\p{L}\p{N}])(senior|middle|junior|lead|principal|staff|head|chief|intern|trainee|engineer|developer|manager|analyst|designer|architect|specialist|consultant|director|recruiter|scientist|product\s+owner|qa|tester|devops|sre|инженер|разработчик|менеджер|специалист|аналитик|директор|архитектор|рекрутер|стажер|стажёр|тестировщик|тимлид|владелец|руководитель|маркетолог|программист)(?![\p{L}\p{N}])/iu;
// The same vocabulary anchored to a WHOLE string — rejects a bare role word
// ("Senior") without rejecting an employer that merely contains one ("Senior Labs").
const BARE_ROLE_WORD_RE = new RegExp(`^${ROLE_WORD_RE.source}$`, ROLE_WORD_RE.flags);
// The positional shapes added in parent #6363 (see employerName()) capture a
// phrase whose position, not a label, says "employer", so they also refuse
// what that position holds when it is not one. A sector or a unit rather than
// a company ("в FinTech", "в команду CDP", "Крупная ИТ-компания ищет");
// Cyrillic stems are matched as substrings, Latin words whole.
const GENERIC_ORG_RE = /(компани|команд|стартап|проект|продукт|отдел|направлени|подразделени|агентств|заказчик|работодател|финтех|геймдев|ритейл|индустри|отрасл|маркетплейс|поиск)|(?<![\p{L}\p{N}])(team|company|startup|client|agency|fintech|edtech|gamedev|igaming|e-?commerce|it|ит)(?![\p{L}\p{N}])/iu;
// A work format where the employer would be: Proglib's third line is
// "Удаленно (Москва)" / "Офис/гибрид (Москва)". LOCATIONISH_RE cannot catch
// these: its boundaries never fire next to a Cyrillic letter in the parent's
// original form, and a whole-word test is too narrow for the endings.
const WORK_FORMAT_RE = /(?<![\p{L}])(удал[её]н\p{L}*|гибрид\p{L}*|офис\p{L}*|релокац\p{L}*|remote|hybrid|onsite|on-site|office)(?![\p{L}])/iu;
// A line that is nothing but a work format, a reach or an employment term
// ("Worldwide 🌏", "remote", "Релокация", "Full-time"; "Удалённо · Москва"
// is not: it names a city) — never a title.
// Each word must end where its letters do: the separator may be empty, and
// without that, "офисофис…1" can be split between the \p{L}* tails in
// exponentially many ways before the match fails.
const FORMAT_ONLY_RE = /^(?:(?:worldwide|anywhere|global|remote|hybrid|on-?site|office|relocation|full[- ]?time|part[- ]?time|удал[её]нн?\p{L}*|гибрид\p{L}*|офис\p{L}*|релокац\p{L}*|(?:полная|частичная)\s+занятость)(?![\p{L}])[\s,/()·|-]*)+$/iu;
// A phrase, not a name: "в Чехии или Испании", "Автотестировщик на Java".
const FUNCTION_WORD_RE = /(?<![\p{L}])(или|и|на|в|во|с|со|для|по|от|до|из|за|к|у|о|об|при|and|or|of|the|to|in|for|with)(?![\p{L}])/u;
// What precedes `в` when the `в` phrase is a destination: "с переездом в
// Дубай", "работа в офисе в …".
const DESTINATION_LEAD_RE = /(?<![\p{L}])(переезд\p{L}*|релокац\p{L}*|офис\p{L}*|работ\p{L}*|проживани\p{L}*|relocation|relocate|based|office)$/iu;
// A department, not a company: "Senior Director, Product Design – Ecosystem"
// (Slack, measured), "… – Payments Platform".
const DEPARTMENT_RE = /(?<![\p{L}])(development|design|engineering|platform|infrastructure|ecosystem|marketing|analytics|operations|payments|growth|security|core|research)$/iu;

/**
 * A department rather than a company: ends in a DEPARTMENT_RE word and is
 * made only of ordinary capitalised words. A brand token (`YLAB
 * Development`, `X5 Platform`) keeps it a name.
 *
 * @param {string} name
 */
function isDepartment(name) {
  return DEPARTMENT_RE.test(name) && name.split(/\s+/).every((w) => /^\p{Lu}\p{Ll}+$/u.test(w));
}
// What opens "… is a …" when it is not the employer: "This is a full-time
// role", "The role is a …", "This role is a …", "Our mission is a …". A
// determiner and one word: "The Trade Desk is a …" is three and stays.
const PRONOUN_RE = /^(this|it|we|our|you|your|he|she|they|that|there|here|(?:the|this|that|these|those|our|your|my|its|their)\s+\p{L}+|candidate|salary|position|role|job)$/iu;
// A stack word opening the right-hand side of "Title / X" names the
// technology, not the employer ("Android-разработчик / Kotlin Multiplatform").
const STACK_WORD_RE = /^(kotlin|swift|java|javascript|typescript|react|vue|angular|node(?:\.js)?|python|go|golang|php|ruby|rust|scala|flutter|unity|unreal|c\+\+|c#|\.net|ios|android|backend|frontend|fullstack|full-stack|mobile|web|devops|qa|ml|data|sql|graphql|kmp|1с|1c)(?![\p{L}\p{N}])/iu;
// A contract or employment term where the employer would be ("Title / B2B").
const CONTRACT_RE = /(?<![\p{L}\p{N}])(b2b|гпх|тк\s+рф|contract|contractor|freelance|фриланс|gross|net|usdt)(?![\p{L}\p{N}])/iu;
// A person, not a company: a Russian patronymic ("Мария Петровна" — finder.work
// shows the individual who posted) or a sole trader ("ИП Иванов").
const PERSON_RE = /(?:ович|евич|овна|евна|ична|инична)(?![\p{L}])|^ИП(?![\p{L}])/u;
// "в Москве", "в Сербии": one declined Cyrillic word after `в` is a place far
// more often than a company. Declined company names ("в Яндексе") are lost
// with it; a missing row beats a wrong employer.
const LOCATIVE_RE = /^[\p{Script=Cyrillic}-]+[еиу]$/u;
const YEAR_RE = /(?<!\d)(19|20)\d{2}(?!\d)/;
// A place alone where the employer would be: "Python Developer / Москва",
// "Go Developer в Алматы", "QA Engineer / LATAM". Whole candidate only, so
// "Moscow Exchange" keeps its name. LOCATIONISH_RE misses these: its list is
// short, and a whole-candidate test is what keeps compound names. Closed on
// purpose: the cities, countries and regions RU/CIS channels post for.
const PLACE_RE = /^(?:москва|мск|санкт-петербург|петербург|спб|питер|новосибирск|екатеринбург|казань|нижний новгород|краснодар|ростов-на-дону|самара|пермь|воронеж|уфа|омск|томск|иннополис|калининград|минск|киев|київ|львов|алматы|астана|ташкент|бишкек|тбилиси|батуми|ереван|баку|белград|нови-сад|лимассол|кипр|дубай|оаэ|стамбул|анталья|варшава|берлин|лиссабон|бали|таиланд|россия|рф|беларусь|казахстан|узбекистан|кыргызстан|армения|грузия|азербайджан|сербия|черногория|турция|польша|германия|португалия|испания|европа|снг|moscow|saint petersburg|st petersburg|minsk|kyiv|kiev|almaty|astana|tashkent|bishkek|tbilisi|batumi|yerevan|baku|belgrade|novi sad|limassol|cyprus|dubai|uae|istanbul|warsaw|berlin|london|lisbon|amsterdam|prague|bali|thailand|russia|belarus|kazakhstan|uzbekistan|kyrgyzstan|armenia|georgia|azerbaijan|serbia|montenegro|turkey|türkiye|poland|germany|portugal|spain|netherlands|uk|usa|us|eu|europe|emea|apac|latam|cis|mena|asia)$/iu;
// The employer withheld under an NDA, given where the name would be
// ("Компания: NDA"); "NDA Group" is a name and keeps it.
const NDA_RE = /^(?:под\s+|under\s+)?nda$/iu;
// The employer phrase "X ищет …" opens a line (Proglib channels: "💻
// Wildberries ищет iOS-разработчика"; POSTER channels: "💎 Plus8Soft ищет
// Senior Frontend Developer"; "Компания «Top Selection» ищет …"). Singular
// verb only: "Ищут Head of Frontend" names nobody.
const SEEKS_RE = /^(?:(?:компания|студия|стартап)\s+)?[«"]?([^«»"]{2,60}?)[»"]?\s+(?:ищет|нанимает|is hiring|is looking for)(?![\p{L}\p{N}])/iu;
// "от 200 000 до 230 000 ₽", "$2000–2700 на руки": a salary line.
const SALARY_LINE_RE = /^(?:от|до|from|up to|~)?\s*[$€]?\s*\d[\d\s.,]*(?:\s*(?:[-–—]|до)\s*[$€]?\s*\d[\d\s.,]*)?\s*(?:₽|руб|\$|€|usd|eur|rub|тыс)/iu;

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
  // Where every shape puts the employer, a place, a reach or an NDA is not
  // one: the hashtag template's second line "Worldwide 🌏" and "Компания:
  // NDA" (@remote_jobs_relocate, @backend_frontend_jobs, measured
  // 2026-11-03) were emitted as employers.
  const bare = n.replace(/[^\p{L}\p{N}]+$/u, '');
  if (PLACE_RE.test(bare) || FORMAT_ONLY_RE.test(bare) || NDA_RE.test(bare)) return '';
  return n;
}

/**
 * A title line without its decoration: the leading emoji or bullet, a
 * trailing pasted link (`Title в Tabby : https://…`), trailing emoji, and
 * trailing parenthesised or bracketed notes (`в Авиасейлс (команда SERP)`).
 *
 * @param {string} line
 */
function bareLine(line) {
  let s = line.replace(ZERO_WIDTH_RE, '').replace(/^[^\p{L}\p{N}«"]+/u, '');
  s = s.replace(/\s*[:—–-]?\s*https?:\/\/\S+\s*$/u, '');
  for (let prev = ''; prev !== s;) {
    prev = s;
    s = s.replace(/[^\p{L}\p{N})\]»"]+$/u, '').replace(/\s*[([][^()[\]]*[)\]]$/u, '');
  }
  return s.trim();
}

/**
 * A work format leading a phrase about the work rather than a name: a format
 * word, then a function word, a place, another format or a lower-case word
 * ("Релокация в Сербию", "Relocation to Serbia", "Гибрид (Москва)",
 * "Relocation available"). "Relocation Today" is not one: a name's next word
 * is capitalised.
 *
 * @param {string} name
 */
function isFormatPhrase(name) {
  const m = name.match(/^(\S+?)(?:\s*[,·|/]\s*|\s+)(.+)$/u);
  if (!m || !FORMAT_ONLY_RE.test(m[1].replace(/[^\p{L}\p{N}]+$/u, ''))) return false;
  const rest = m[2].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  return FUNCTION_WORD_RE.test(rest) || PLACE_RE.test(rest) || FORMAT_ONLY_RE.test(rest) || /^\p{Ll}/u.test(rest);
}

/**
 * plausibleEmployer() for the shapes that take the employer from its position
 * in a line rather than from a marker: also refuses a sector, a unit, a
 * contract term, a role, a person, a year, a place, and a name that does not
 * start the way a name does. Digits are allowed (`БЮРО 1440`, `01.tech`).
 *
 * @param {string} raw
 */
function positionalEmployer(raw) {
  // "Social — 2ГИС", "TATLIN.UNIFIED — YADRO": a team, then its company.
  const tail = raw.split(/\s[—–]\s/).pop() || '';
  const n = plausibleEmployer(tail.replace(/[\s—–-]+$/u, ''), false).replace(/^[«"]|[»"]$/g, '');
  if (!n || !/^[\p{Lu}\p{N}]/u.test(n) || /[()[\]«»]/.test(n)) return '';
  if (YEAR_RE.test(n) || ROLE_WORD_RE.test(n) || GENERIC_ORG_RE.test(n) || CONTRACT_RE.test(n) || PERSON_RE.test(n)) return '';
  if (WORK_FORMAT_RE.test(n) || FUNCTION_WORD_RE.test(n) || isDepartment(n) || isFormatPhrase(n)) return '';
  return n;
}

/**
 * The employer a post names, or '' when it names none.
 *
 * Five marked shapes cover what public channels actually write: a labelled line
 * (`Компания: X`), `Title @ Employer`, `Title | Employer`, a second line
 * opening `в Employer —`, and a hashtag-only first line followed by the bare
 * employer name. The last has no marker pinning the line to "employer" at all,
 * so it additionally refuses a line that reads as a role, a line of business,
 * a department, or a work-format phrase. Nothing is guessed — not the channel
 * name, not the link's host, not free text.
 *
 * Four positional shapes follow, tried only when the marked shapes found
 * nothing (parent #6363, measured on 2,973 posts from 51 channels):
 * `Employer ищет …`, `Title в Employer` on the title line, a second line
 * `Employer is a …`, and a finder.work mirror's employer on the line after
 * the salary. positionalEmployer() refuses a role, a sector or unit, a
 * department, a work format, a contract term, a person, a year, a place, a
 * reach and a phrase there.
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
  // "Title | Company" assumes exactly one `|`. A template packing several
  // pipe-delimited tags into the title (`Title | 5 year(s) | Senior | IC`) would
  // make `[^|]` land on the LAST tag, which passes plausibleEmployer() as a
  // short capitalised word — every post on such a channel got company "IC" /
  // "Senior" (parent #4479). Reject that shape outright rather than guess, and
  // refuse a bare seniority/role word even in the single-pipe case. On
  // rejection the remaining shapes below still get their turn.
  if (!/\|.*\|/.test(first) && (m = first.match(/^.{3,140}?\s+\|\s+([^|]{2,60})$/))) {
    const pipeEmployer = plausibleEmployer(m[1], true);
    if (pipeEmployer && !BARE_ROLE_WORD_RE.test(pipeEmployer)) return pipeEmployer;
  }
  if ((m = second.match(/^(?:в|at)\s+([^—–,(]{2,60}?)\s*(?:[—–]|$)/u))) return plausibleEmployer(m[1], true);
  if (HASHTAG_LINE_RE.test(first) && second) {
    const hashtagEmployer = plausibleEmployer(second, false);
    // A line of business is not a name either: "#Develpment\nCustom Software
    // Development" (@remote_jobs_relocate, measured 2026-10-31).
    // Nor is a work format followed by a destination ("Релокация в Сербию",
    // "Relocation to Serbia"), which FORMAT_ONLY_RE in plausibleEmployer()
    // lets through. A name that merely holds a format word stays one:
    // "Relocation Today".
    if (hashtagEmployer && !ROLE_WORD_RE.test(hashtagEmployer) && !isDepartment(hashtagEmployer)
        && !isFormatPhrase(hashtagEmployer)) return hashtagEmployer;
  }
  // The four positional shapes below run only when every marked shape above
  // found nothing, so no post those attribute changes. Measured in parent
  // #6363 on 2,973 posts from 51 public RU/CIS channels (3 pages each).
  //
  // "Employer ищет …" opening one of the first four lines. First, because it
  // is the most explicit of the four: "МТС Банк ищет iOS-разработчика для
  // продуктов в «Мой МТС»" also reads as a `в` title.
  for (const line of lines.slice(0, 4)) {
    if ((m = bareLine(line).match(SEEKS_RE))) {
      const name = positionalEmployer(m[1]);
      if (name) return name;
    }
  }
  const head = lines.find((l) => !HASHTAG_LINE_RE.test(l)) || '';
  const title = bareLine(head);
  // A `в` inside a quoted title belongs to the title: «ML Engineer в Поиск».
  const quoted = (s) => (s.match(/«/g) || []).length > (s.match(/»/g) || []).length;
  // "Title в Employer" / "Title at Employer" on the title line (offerclaw,
  // Remocate and Sparkles mirrors, Proglib's Go channel). The LAST `в` wins —
  // "Разработчик на Go в Server Infrastructure Yandex Cloud" would otherwise
  // read "Go в …" — and the employer is at most three words, so a team name
  // in front of the company fails closed.
  if ((m = title.match(/^(.{3,140})\s(?:в|at)\s(.{2,60})$/u)) && !quoted(m[1]) && !DESTINATION_LEAD_RE.test(m[1])) {
    const name = positionalEmployer(m[2]);
    if (name && name.split(/\s+/).length <= 3 && !LOCATIVE_RE.test(name)) return name;
  }
  // "Title\nEmployer is a …" — the EN template of @geekjobs and its siblings
  // ("iOS Engineer – Creative App\nElevenLabs is an AI research…").
  if ((m = (lines[1] || '').match(/^([\p{Lu}\p{N}][^,.;:!?]{0,40}?)\s+(?:is|are)\s+(?:a|an|the|one of)\s/u)) && !PRONOUN_RE.test(m[1]) && !STACK_WORD_RE.test(m[1])) {
    const name = positionalEmployer(m[1]);
    if (name) return name;
  }
  // finder.work mirrors: title, salary, then the employer alone on the third
  // line ("Data Engineer / от 200 000 до 230 000 ₽ / WILIX").
  if (lines.length >= 3 && SALARY_LINE_RE.test(lines[1])) {
    const name = positionalEmployer(lines[2]);
    if (name && !LOCATIVE_RE.test(name)) return name;
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
  const board = BOARD_HOSTS.test(host);
  if (!host || (!board && NON_APPLY_HOSTS.test(host)) || UNDECLARED_HOSTS.test(host) || SHORTENER_HOSTS.test(host) || FORM_HOSTS.test(host)) return null;
  const path = u.pathname.replace(/\/+$/, '');
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return /\/jobs\/view\//.test(path) ? 'board' : null;
  // Only a vacancy page: "/companies/job", "/companies/<slug>/vacancies" and
  // "/vacancies?q=…" carry a vacancy word but are a profile and listings.
  if (host === 'career.habr.com') return /^\/vacancies\/\d+$/.test(path) ? 'board' : null;
  // A homepage or listing root stays one even with a tracking tail; only a
  // parameter that could identify a vacancy makes it a page.
  const identifying = [...u.searchParams.keys()].some((k) => !TRACKING_PARAM_RE.test(k));
  if (LOCALE_ROOT_RE.test(path) && !identifying) return null;
  if (LISTING_ROOT_RE.test(path) && !identifying) return null;
  if (!VACANCY_EVIDENCE_RE.test(path) && !identifying) return null;
  return board ? 'board' : 'employer';
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
  if (DISCLOSED_HIDDEN_RE.test(post.description)) return null;
  const link = applicationLink(post.hrefs);
  if (!link) return null;

  // On the hashtag-first template lines[0] is tags, not a title. The real title
  // is the first later line that is neither more tags, the employer just
  // matched, nor a bare link. With no such line the shape has no title to give,
  // and emitting the hashtag line would be the same wrong-field-as-fact the
  // rest of this policy exists to prevent — so the post is dropped.
  let title = post.title;
  if (HASHTAG_LINE_RE.test(post.lines[0] || '')) {
    // The matched employer can be a labelled field (`Компания: Контур`) or a
    // second-line `в/at Employer —` phrase, not only the bare name, and its case
    // can differ from the match — so a line is skipped when it IS the employer
    // (case-insensitive) or when employerName's metadata rules, run on that line
    // alone as a second line, resolve to it (parent #3928). An empty first line
    // keeps `Title @ Employer` / `Title | Employer` candidates as real titles.
    const companyLower = company.toLowerCase();
    const isLinkLine = (l) => post.hrefs.includes(l) || /^https?:\/\//i.test(l);
    const better = post.lines.slice(1).find((l) => l.toLowerCase() !== companyLower
      && employerName(['', l]).toLowerCase() !== companyLower
      && !HASHTAG_LINE_RE.test(l) && !isLinkLine(l) && !FORMAT_ONLY_RE.test(bareLine(l)));
    if (!better) return null;
    title = headline([better]);
  }
  // "Title в Tabby : https://tabby.ai/careers/…" — the link is the url,
  // and cut by headline() it would leave "Title в Tabby :…".
  else if (/https?:\/\/\S+$/u.test(post.lines[0] || '')) {
    title = headline([post.lines[0].replace(/\s*[:—–-]?\s*https?:\/\/\S+$/u, '')]) || title;
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
