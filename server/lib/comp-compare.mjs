/**
 * CAR-109 — canonical salary comparison for the evaluation prompt.
 *
 * The A–G evaluation compares the JD's salary against the candidate's
 * compensation minimum, but both figures used to reach the model RAW: the
 * profile block verbatim and the posting text verbatim. The model then did
 * the currency/period/suffix arithmetic itself — and a locale mis-read
 * flipped verdicts (zh-TW prod: «€80–100k» called "below minimum" against a
 * lower EUR floor).
 *
 * This module normalizes BOTH sides server-side, once, and hands the prompt
 * one canonical block: annual figures, one currency each, k/к/тыс/萬 suffixes
 * and monthly figures already resolved, European decimal commas and space
 * grouping already parsed. An unverifiable cross-currency conversion stays a
 * CAVEAT — the contract (mirrored in the prompt's static compensation rule)
 * forbids flipping the verdict on conversion alone.
 *
 * Pure functions except `readProfileCompensation()`, which reads
 * `config/profile.yml` when called without an argument (guarded; null on any
 * read/parse failure — the evaluation must proceed without the block).
 */
import { existsSync, readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { PATHS } from './paths.mjs';

// ── currency recognition ────────────────────────────────────────────────────
// Own-key lookups only. `kr` (SEK/NOK/DKK) is deliberately recognized but
// UNMAPPED — an ambiguous code must not produce an invented conversion; the
// block then says so explicitly instead. Same for `$` and `¥` (CAR-143):
// "$100k" in a Sydney posting is AUD, «¥30k/月» in a Shanghai one is CNY —
// hard-mapping them invented a ~20×-off JPY conversion and billed AU/CA/SG
// dollars as USD. They resolve only when an explicit ISO code shares the line
// (EXPLICIT_CCY_RE below).
const CCY_MAP = {
  '€': 'EUR', 'US$': 'USD', '£': 'GBP', '₽': 'RUB', '₴': 'UAH',
  USD: 'USD', EUR: 'EUR', GBP: 'GBP', CHF: 'CHF', RUB: 'RUB', RUR: 'RUB', UAH: 'UAH',
  PLN: 'PLN', CZK: 'CZK', SEK: 'SEK', NOK: 'NOK', DKK: 'DKK', INR: 'INR', BRL: 'BRL',
  SGD: 'SGD', AUD: 'AUD', CAD: 'CAD', CNY: 'CNY', JPY: 'JPY',
  'руб': 'RUB', 'руб.': 'RUB', 'рублей': 'RUB', 'рубля': 'RUB',
  'грн': 'UAH', 'грн.': 'UAH', 'zł': 'PLN', 'Kč': 'CZK',
};
const CCY_UNMAPPED = ['kr', '$', '¥']; // recognized as a currency token, no FX rate
const AMBIGUOUS_SYMBOLS = new Set(['$', '¥']);
const EXPLICIT_CCY_RE = /\b(USD|AUD|CAD|SGD|NZD|HKD|TWD|MXN|CNY|RMB|JPY)\b/i;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CCY_ALT = [...Object.keys(CCY_MAP), ...CCY_UNMAPPED]
  .sort((a, b) => b.length - a.length).map(escapeRe).join('|');

// k/к/К (×1000), тыс/тысяч (×1000), thousand, 千 (×1000), 萬/万 (×10000).
const SUFFIX_RE = '(?:тысяч[аи]?|тыс\\.?|thousand|[kKкК千]|[萬万])';
const SUFFIX_MULT = { k: 1000, K: 1000, 'к': 1000, 'К': 1000, 'тыс': 1000, 'тыс.': 1000, 'тысяча': 1000, 'тысячи': 1000, 'тысяч': 1000, thousand: 1000, '千': 1000, '萬': 10000, '万': 10000 };

// One money figure: optional currency before, a number (with European
// separators), optional suffix, optional currency after. Guards:
//   - lookbehind  — a figure never starts inside a word/number ("k8s", "v2.0");
//   - trailing lookahead — a suffix/currency never glues onto a following
//     word ("80 kudos", "рубленный"); the regex backtracks to the bare
//     number, which the qualification filter then rejects.
const FIG_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?<pre>${CCY_ALT})?[ \\u00A0\\u202F\\u2009]?`
  + `(?<num>\\d[\\d.,\\u00A0\\u202F\\u2009 ]*\\d|\\d)`
  + `[ \\u00A0\\u202F\\u2009]?(?<suf>${SUFFIX_RE})?`
  + `(?:[ \\u00A0\\u202F\\u2009]?(?<post>${CCY_ALT}))?(?![\\p{L}])`,
  'gu',
);

// Period markers matched only in the figure's own window and only in forms
// ATTACHED to the figure (CAR-143): the bare nouns month/year/Monat/Jahr and
// the bare RU/ES мес/год/mes are NOT markers («6 month contract, $120k»,
// «el mes pasado, $90k», «Контракт на 6 мес, 200 000 ₽» stay annual), and
// «anual»/«annual» are anchored so «manual»/«biannual» cannot match. Unicode
// endings use negative lookahead instead of `\b` — JS word boundaries are
// ASCII-only and never matched Cyrillic (a known web-ui pitfall). The /g flag
// feeds the nearest-marker scan below (lastIndex reset per use).
const MONTH_RE = /per\s+month|\/\s*month|\/\s*mo\b|monthly|pro\s+Monat|monatlich|mensal|mensual|al\s+mes|por\s+mes|\/\s*mes\b|\/\s*m[eę]s\b|par\s+mois|mensuel|в\s+месяц|за\s+месяц|\/\s*мес(?![а-яё])|月給|月薪|每月|\/月|aylık/gi;
const YEAR_RE = /per\s+(?:year|annum)|p\.\s?a\.|\/\s*(?:year|yr|annum|a[ñn]o|ano)|\bannum\b|(?<![a-z])annual(?:ly)?|yearly|pro\s+Jahr|j[aä]hrlich|(?<![a-z])anual|al\s+a[ñn]o|por\s+a[ñn]o|por\s+ano|par\s+an|annuel|в\s+год|за\s+год|\/\s*год(?![а-яё])|年薪|年給|每年|\/年|年俸|yıllık/gi;
const HOUR_RE = /per\s+hour|\/\s*hour\b|\/\s*hr\b|hourly|в\s+час|за\s+час|st[üu]ndlich|pro\s+Stunde|par\s+heure|\bhora\b|時給|saatlık/gi;

/** Resolve a currency token to a canonical code by OWN key (null otherwise). */
function resolveCcy(token) {
  if (!token) return null;
  for (const t of [token, token.toUpperCase(), token.toLowerCase()]) {
    if (Object.prototype.hasOwnProperty.call(CCY_MAP, t)) return CCY_MAP[t];
  }
  return null;
}

/**
 * Normalize one number token: European space grouping ("80 000",
 * "1 234 567"), thousands separators ("80,000", "1,234,567", "80.000"),
 * decimal comma/point with 1–2 fraction digits ("80,5", "1.5"), plain.
 */
function parseNumberToken(raw) {
  const s = String(raw).replace(/[\u00A0\u202F\u2009]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^\d{1,3}( \d{3})+$/.test(s)) return parseInt(s.replace(/ /g, ''), 10);
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return parseInt(s.replace(/[.,]/g, ''), 10);
  let m = s.match(/^(\d+)([.,])(\d{1,2})$/);
  if (m) return Number(`${m[1]}.${m[3]}`);
  m = s.match(/^(\d+)([.,])(\d{3,})$/); // "80,500"-shaped leftover — strip the separator
  if (m) return Number(`${m[1]}${m[3]}`);
  const n = Number(s.replace(/[.,\s]/g, ''));
  return Number.isFinite(n) && s !== '' ? n : null;
}

// A bare number is salary-shaped only when a salary word frames the line —
// a bare period word alone no longer qualifies it (CAR-143).
const SALARY_WORD_RE = /salary|salaries|compensation|remuneration|\bwages?\b|\bpay\b|зарпла|оклад|Gehalt|sal[áa]rio|salario|salaire|薪|給料|급여/i;

function looksLikeYear(n, qualified) {
  // CAR-143: ALWAYS reject a bare 19xx/20xx number, whatever period words the
  // line carries — «Founded 2019, yearly bonus» is a founding year, never a
  // salary. Currency- or suffix-qualified figures keep the old scope.
  return !qualified && n >= 1900 && n <= 2099;
}

// The period comes ONLY from markers ATTACHED to the figure (CAR-143 rev-2):
// the windows are clamped to the neighbouring figures — «$50/hr, $104k/yr»
// cannot read $50 through $104k's "/yr" — and among several markers the one
// NEAREST the figure edge wins, not a fixed year>month>hour order. A
// before-side word must sit within BEFORE_WINDOW chars of the figure (the
// CJK/adjective prefix zone — 月薪 8萬, "annual salary 90k"); further left it
// describes something else («Hourly staff welcome. $120k»).
const AFTER_WINDOW = 24;
const BEFORE_WINDOW = 16;
function periodOf(line, start, end, prevEnd, nextStart) {
  const after = line.slice(end, Math.min(nextStart, end + AFTER_WINDOW));
  const before = line.slice(Math.max(prevEnd, start - BEFORE_WINDOW), start);
  const cands = [];
  const scan = (re, s, isBefore) => {
    re.lastIndex = 0;
    for (let m = re.exec(s); m; m = re.exec(s)) {
      cands.push({
        dist: isBefore ? s.length - m.index - m[0].length : m.index,
        side: isBefore ? 1 : 0,
        period: re === YEAR_RE ? 'year' : re === MONTH_RE ? 'month' : 'hour',
      });
    }
  };
  scan(YEAR_RE, after, false);
  scan(MONTH_RE, after, false);
  scan(HOUR_RE, after, false);
  scan(HOUR_RE, before, true);
  scan(YEAR_RE, before, true);
  scan(MONTH_RE, before, true);
  cands.sort((a, b) => a.dist - b.dist || a.side - b.side);
  return cands.length ? cands[0].period : null;
}

/** Parse every qualifying money figure in `text`. Period: 'year'|'month'|null
 * ('hour' figures are dropped — an hourly rate never annualizes).
 * `opts.declaredCurrency` — when the caller already knows the currency (the
 * profile's `compensation.currency` field), bare values qualify and inherit
 * it. `opts.allowBare` — the caller vouches that bare numbers are salary
 * context (the profile's compensation fields); the JD path requires a salary
 * word on the line instead. */
export function parseMoneyFigures(text, opts = {}) {
  const declared = opts.declaredCurrency ?? null;
  const allowBare = opts.allowBare === true;
  const out = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const bareOk = allowBare || SALARY_WORD_RE.test(line);
    // Collect all figure matches first — the period windows are clamped to
    // the neighbouring figures so one figure's marker cannot bleed into
    // another's («$50/hr, $104k/yr»).
    const matches = [];
    FIG_RE.lastIndex = 0;
    for (let m = FIG_RE.exec(line); m; m = FIG_RE.exec(line)) matches.push(m);
    const hits = [];
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const n = parseNumberToken(m.groups.num);
      if (n == null) continue;
      const start = m.index;
      const end = m.index + m[0].length;
      const curToken = m.groups.pre ?? m.groups.post ?? null;
      const sufToken = m.groups.suf ?? null;
      const suffixMult = sufToken ? (SUFFIX_MULT[sufToken] ?? null) : null;
      const qualified = Boolean(curToken || sufToken || declared);
      const period = periodOf(
        line, start, end,
        i > 0 ? matches[i - 1].index + matches[i - 1][0].length : 0,
        i + 1 < matches.length ? matches[i + 1].index : line.length,
      );
      if (period === 'hour') continue; // hourly figure — drop the figure, not the whole line
      // Bare numbers (no currency, no suffix) qualify only on a line framed
      // by a salary word and only salary-shaped values ("Salary: 85,000 per
      // year") — never years, ids, head-counts or "Go, k8s". With a declared
      // currency (profile minimum) any value qualifies.
      if (!qualified) {
        if (!bareOk || n < 1000) continue;
        if (looksLikeYear(n, qualified)) continue;
      }
      let currency = resolveCcy(curToken) ?? declared;
      if (currency == null && AMBIGUOUS_SYMBOLS.has(curToken)) {
        const explicit = EXPLICIT_CCY_RE.exec(line);
        if (explicit) currency = resolveCcy(explicit[1]);
      }
      hits.push({
        start,
        end,
        raw: m[0].trim(),
        currencyRaw: curToken,
        currency,
        suffixMult,
        value: n,
        period,
      });
    }
    // Pair adjacent figures into ranges ("€80–100k", "$100k to $120k").
    for (let i = 0; i < hits.length; i++) {
      const a = hits[i];
      const b = hits[i + 1];
      const between = b ? line.slice(a.end, b.start) : null;
      if (b && /^[\s~–—−-]+$/.test(between)) {
        // A shared suffix ("80–100k") applies to both sides.
        const mult = a.suffixMult ?? b.suffixMult;
        out.push({
          low: a.value * (mult ?? 1),
          high: b.value * (mult ?? 1),
          currency: a.currency ?? b.currency,
          currencyRaw: a.currencyRaw ?? b.currencyRaw,
          period: a.period ?? b.period,
          raw: line.slice(a.start, b.end),
        });
        i++; // consumed both
      } else {
        out.push({
          low: a.value * (a.suffixMult ?? 1),
          high: null,
          currency: a.currency,
          currencyRaw: a.currencyRaw,
          period: a.period,
          raw: a.raw,
        });
      }
    }
  }
  return out;
}

/** Annualized {low, high}: a monthly figure is ×12; hourly never reaches here. */
export function annualLowHigh(fig) {
  const mult = fig.period === 'month' ? 12 : 1;
  const r = (v) => (v == null ? null : Math.round(v * mult));
  return { low: r(fig.low), high: r(fig.high) };
}

// ── profile compensation ────────────────────────────────────────────────────

/**
 * The candidate minimum from `config/profile.yml` — `compensation.minimum`,
 * falling back to `compensation.target_range` ONLY when minimum is absent
 * (CAR-143: the two fields are never spliced into one range — a `high` never
 * crosses fields). Currency comes from `compensation.currency` (code or
 * symbol) or the value's own symbol. Returns {low, high, currency, period,
 * raw} or null.
 */
export function readProfileCompensation(profileText) {
  let text = profileText;
  if (typeof text !== 'string') {
    try {
      if (!existsSync(PATHS.profile)) return null;
      text = readFileSync(PATHS.profile, 'utf8');
    } catch {
      return null;
    }
  }
  let comp = null;
  try {
    const doc = yaml.load(text);
    if (doc && typeof doc === 'object' && doc.compensation && typeof doc.compensation === 'object') {
      comp = doc.compensation;
    }
  } catch {
    return null; // a malformed profile must not break the evaluation prompt
  }
  if (!comp) return null;

  const declared = resolveCcy(typeof comp.currency === 'string' ? comp.currency.trim() : '');
  const minNum = typeof comp.minimum === 'number' && Number.isFinite(comp.minimum) ? comp.minimum : null;
  const minStr = typeof comp.minimum === 'string' && comp.minimum.trim() ? comp.minimum : null;
  const rangeStr = typeof comp.target_range === 'string' && comp.target_range.trim() ? comp.target_range : null;
  // The profile's compensation fields ARE salary context — bare numbers
  // qualify without a salary word on the line.
  const figures = minNum != null
    ? [{ low: minNum, high: null, currency: declared, currencyRaw: null, period: null, raw: String(minNum) }]
    : parseMoneyFigures(minStr ?? rangeStr ?? '', { declaredCurrency: declared, allowBare: true });
  if (!figures.length) return null;
  const fig = figures[0];
  return {
    low: fig.low,
    high: fig.high ?? null,
    currency: fig.currency ?? declared ?? null,
    currencyRaw: fig.currencyRaw,
    period: fig.period ?? 'year', // an unstated profile minimum is annual by convention
    raw: minStr ?? (minNum != null ? String(minNum) : rangeStr) ?? fig.raw,
  };
}

// ── the canonical prompt block ──────────────────────────────────────────────

// Approximate USD rates (static, human-editable, INDICATIVE ONLY — the block
// says so; rates drift, the verdict must never hinge on them). Anchored on
// USD: 1 unit of CCY = USD_PER[CCY] dollars.
const USD_PER = {
  USD: 1, EUR: 1.08, GBP: 1.27, CHF: 1.12, PLN: 0.25, CZK: 0.043, SEK: 0.095,
  NOK: 0.092, DKK: 0.145, RUB: 0.011, UAH: 0.024, INR: 0.012, BRL: 0.18,
  SGD: 0.74, AUD: 0.66, CAD: 0.73, CNY: 0.14, JPY: 0.0067,
};

function convertValue(v, from, to) {
  if (v == null || !from || !to || !USD_PER[from] || !USD_PER[to]) return null;
  return Math.round((v * USD_PER[from]) / USD_PER[to]);
}

const fmtRange = ({ low, high }) => (high != null ? `${low}-${high}` : `${low}`);

// The JD-derived raw echo carries only the matched figure span (digits,
// separators, currency symbol, suffix) — never free posting text — and is
// additionally fence-neutralized so nothing can pose as prompt structure.
function safeEcho(s) {
  return String(s ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/["`]{2,}/g, '"')
    .replace(/-{3,}/g, '–')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

/** Prefer currency-bearing ranges, then currency-bearing singles, then bare. */
function pickOfferFigure(figures) {
  const rank = (f) => (f.currency ? 0 : 1) * 2 + (f.high != null ? 0 : 1);
  let best = null;
  for (const f of figures) {
    if (f.period === 'hour') continue;
    if (!best || rank(f) < rank(best)) best = f;
  }
  return best;
}

/**
 * The canonical comparison block for the evaluation prompt — both figures
 * per YEAR, like-for-like, with the verdict-protection sentence. Empty when
 * neither side states a figure (the static rule in the prompt still applies).
 */
export function buildCompensationBlock(jdText, profile = readProfileCompensation()) {
  const offer = pickOfferFigure(parseMoneyFigures(String(jdText ?? '')));
  if (!offer && !profile) return '';

  const lines = ['COMPENSATION COMPARISON — canonical figures (server-normalized; do not re-multiply or re-convert):'];

  if (profile) {
    const p = annualLowHigh(profile);
    const ccy = profile.currency ?? 'currency not set';
    lines.push(
      `- Candidate minimum: ${fmtRange(p)} ${ccy} per YEAR (config/profile.yml compensation.minimum; raw: "${safeEcho(profile.raw)}")`
        + `${profile.period === 'month' ? ' — stated per month, ×12 applied' : ''}.`,
    );
  } else {
    lines.push('- Candidate minimum: not set in config/profile.yml — take it from the compensation block there and normalize it the same way (k/тыс ×1000, monthly ×12).');
  }

  if (offer) {
    const o = annualLowHigh(offer);
    const ccy = offer.currency ?? offer.currencyRaw ?? 'unknown currency';
    lines.push(
      `- JD offer: ${fmtRange(o)} ${ccy} per YEAR (raw: "${safeEcho(offer.raw)}")`
        + `${offer.period === 'month' ? ' — stated per month, ×12 applied' : offer.period == null ? ' — no period stated, assumed per year' : ''}.`,
    );
  } else {
    lines.push('- JD offer: no salary figure detected in the posting text — check the JD above and normalize any figure the same way (k/тыс ×1000, monthly ×12).');
  }

  if (profile && offer) {
    const o = annualLowHigh(offer);
    const p = annualLowHigh(profile);
    const oCcy = offer.currency ?? offer.currencyRaw ?? 'unknown currency';
    const pCcy = profile.currency ?? 'unknown currency';
    lines.push(`- Compare like-for-like: per-year vs per-year, one currency: ${fmtRange(o)} ${oCcy} vs ${fmtRange(p)} ${pCcy}.`);
    if (oCcy !== pCcy) {
      const conv = {
        low: convertValue(o.low, offer.currency, profile.currency),
        high: o.high == null ? null : convertValue(o.high, offer.currency, profile.currency),
      };
      if (conv.low != null) {
        lines.push(`- Cross-currency reference only (static table, indicative only): ${fmtRange(o)} ${oCcy} ≈ ${fmtRange(conv)} ${pCcy} per year.`);
      } else {
        lines.push(`- No reliable conversion from ${oCcy} to ${pCcy}: compare the raw annual figures and treat the currency mismatch as an explicit caveat.`);
      }
    }
  }

  lines.push('If a conversion is uncertain, state both raw figures and reason from them — an uncertain conversion is a caveat and must NOT by itself flip the verdict to "below minimum".');
  return lines.join('\n');
}
