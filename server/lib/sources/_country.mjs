// @ts-check

// Shared ISO 3166-1 country-code → English-name lookup for providers whose
// payload carries a country only as a code. location_filter matches on the
// names users write ("United Kingdom", "Germany"), so a bare code never reaches
// it. Names come from Intl.DisplayNames (CLDR via Node's ICU), so a few differ
// from everyday spelling (CZ → "Czechia", TR → "Türkiye") and can shift between
// Node versions — tests should not pin those exact strings.
//
// Parent-sync note (CAR-259 wave): the parent's `providers/_country.mjs` also
// carries the prose country matcher (`countries()`) and the workplace-policy
// gate (`buildWorkplacePolicy()`), and its recent USPS state-code work ("City,
// ST", "Remote Europe - DE", per-place matching) lives entirely inside those.
// That half is a documented web-ui no-port (see location-filter.mjs): web-ui
// has no workplace-policy machinery, and its location matching stays the
// substring idiom. This file mirrors only the name lookup and the exact
// country-keyword classifier — which that change does not touch.

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

/**
 * Resolve a two-letter ISO country code to an English name. Returns '' for
 * anything that isn't a resolvable two-letter code.
 * @param {unknown} code
 */
export function countryName(code) {
  if (typeof code !== 'string' || !/^[A-Za-z]{2}$/.test(code)) return '';
  try {
    const name = regionNames.of(code.toUpperCase());
    return name && name !== code.toUpperCase() ? name : '';
  } catch {
    return '';
  }
}

// ISO 3166-1 alpha-3 → alpha-2. Intl.DisplayNames only accepts alpha-2, and
// some payloads (Gem's `isoCountry`: "USA", "GBR") carry alpha-3. Generated
// from the ISO 3166-1 list (249 assigned codes).
/** @type {Readonly<Record<string, string>>} */
const ALPHA3_TO_ALPHA2 = Object.freeze({
  ABW: 'AW', AFG: 'AF', AGO: 'AO', AIA: 'AI', ALA: 'AX', ALB: 'AL', AND: 'AD', ARE: 'AE',
  ARG: 'AR', ARM: 'AM', ASM: 'AS', ATA: 'AQ', ATF: 'TF', ATG: 'AG', AUS: 'AU', AUT: 'AT',
  AZE: 'AZ', BDI: 'BI', BEL: 'BE', BEN: 'BJ', BES: 'BQ', BFA: 'BF', BGD: 'BD', BGR: 'BG',
  BHR: 'BH', BHS: 'BS', BIH: 'BA', BLM: 'BL', BLR: 'BY', BLZ: 'BZ', BMU: 'BM', BOL: 'BO',
  BRA: 'BR', BRB: 'BB', BRN: 'BN', BTN: 'BT', BVT: 'BV', BWA: 'BW', CAF: 'CF', CAN: 'CA',
  CCK: 'CC', CHE: 'CH', CHL: 'CL', CHN: 'CN', CIV: 'CI', CMR: 'CM', COD: 'CD', COG: 'CG',
  COK: 'CK', COL: 'CO', COM: 'KM', CPV: 'CV', CRI: 'CR', CUB: 'CU', CUW: 'CW', CXR: 'CX',
  CYM: 'KY', CYP: 'CY', CZE: 'CZ', DEU: 'DE', DJI: 'DJ', DMA: 'DM', DNK: 'DK', DOM: 'DO',
  DZA: 'DZ', ECU: 'EC', EGY: 'EG', ERI: 'ER', ESH: 'EH', ESP: 'ES', EST: 'EE', ETH: 'ET',
  FIN: 'FI', FJI: 'FJ', FLK: 'FK', FRA: 'FR', FRO: 'FO', FSM: 'FM', GAB: 'GA', GBR: 'GB',
  GEO: 'GE', GGY: 'GG', GHA: 'GH', GIB: 'GI', GIN: 'GN', GLP: 'GP', GMB: 'GM', GNB: 'GW',
  GNQ: 'GQ', GRC: 'GR', GRD: 'GD', GRL: 'GL', GTM: 'GT', GUF: 'GF', GUM: 'GU', GUY: 'GY',
  HKG: 'HK', HMD: 'HM', HND: 'HN', HRV: 'HR', HTI: 'HT', HUN: 'HU', IDN: 'ID', IMN: 'IM',
  IND: 'IN', IOT: 'IO', IRL: 'IE', IRN: 'IR', IRQ: 'IQ', ISL: 'IS', ISR: 'IL', ITA: 'IT',
  JAM: 'JM', JEY: 'JE', JOR: 'JO', JPN: 'JP', KAZ: 'KZ', KEN: 'KE', KGZ: 'KG', KHM: 'KH',
  KIR: 'KI', KNA: 'KN', KOR: 'KR', KWT: 'KW', LAO: 'LA', LBN: 'LB', LBR: 'LR', LBY: 'LY',
  LCA: 'LC', LIE: 'LI', LKA: 'LK', LSO: 'LS', LTU: 'LT', LUX: 'LU', LVA: 'LV', MAC: 'MO',
  MAF: 'MF', MAR: 'MA', MCO: 'MC', MDA: 'MD', MDG: 'MG', MDV: 'MV', MEX: 'MX', MHL: 'MH',
  MKD: 'MK', MLI: 'ML', MLT: 'MT', MMR: 'MM', MNE: 'ME', MNG: 'MN', MNP: 'MP', MOZ: 'MZ',
  MRT: 'MR', MSR: 'MS', MTQ: 'MQ', MUS: 'MU', MWI: 'MW', MYS: 'MY', MYT: 'YT', NAM: 'NA',
  NCL: 'NC', NER: 'NE', NFK: 'NF', NGA: 'NG', NIC: 'NI', NIU: 'NU', NLD: 'NL', NOR: 'NO',
  NPL: 'NP', NRU: 'NR', NZL: 'NZ', OMN: 'OM', PAK: 'PK', PAN: 'PA', PCN: 'PN', PER: 'PE',
  PHL: 'PH', PLW: 'PW', PNG: 'PG', POL: 'PL', PRI: 'PR', PRK: 'KP', PRT: 'PT', PRY: 'PY',
  PSE: 'PS', PYF: 'PF', QAT: 'QA', REU: 'RE', ROU: 'RO', RUS: 'RU', RWA: 'RW', SAU: 'SA',
  SDN: 'SD', SEN: 'SN', SGP: 'SG', SGS: 'GS', SHN: 'SH', SJM: 'SJ', SLB: 'SB', SLE: 'SL',
  SLV: 'SV', SMR: 'SM', SOM: 'SO', SPM: 'PM', SRB: 'RS', SSD: 'SS', STP: 'ST', SUR: 'SR',
  SVK: 'SK', SVN: 'SI', SWE: 'SE', SWZ: 'SZ', SXM: 'SX', SYC: 'SC', SYR: 'SY', TCA: 'TC',
  TCD: 'TD', TGO: 'TG', THA: 'TH', TJK: 'TJ', TKL: 'TK', TKM: 'TM', TLS: 'TL', TON: 'TO',
  TTO: 'TT', TUN: 'TN', TUR: 'TR', TUV: 'TV', TWN: 'TW', TZA: 'TZ', UGA: 'UG', UKR: 'UA',
  UMI: 'UM', URY: 'UY', USA: 'US', UZB: 'UZ', VAT: 'VA', VCT: 'VC', VEN: 'VE', VGB: 'VG',
  VIR: 'VI', VNM: 'VN', VUT: 'VU', WLF: 'WF', WSM: 'WS', YEM: 'YE', ZAF: 'ZA', ZMB: 'ZM',
  ZWE: 'ZW',
});

/**
 * Resolve a two- or three-letter ISO 3166-1 country code to an English name.
 * Returns '' for anything else, including an unassigned code.
 * @param {unknown} code
 */
export function countryNameFromIso(code) {
  if (typeof code !== 'string') return '';
  const c = code.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(c)) return Object.hasOwn(ALPHA3_TO_ALPHA2, c) ? countryName(ALPHA3_TO_ALPHA2[c]) : '';
  return countryName(c);
}

// ── Exact country-keyword classifier (parent #6553 / #6413) ─────────────────
// location_filter's country-only fallback (see location-filter.mjs) needs to
// know whether a portals.yml keyword is a COUNTRY ("Germany", "DEU", "U.K.")
// and not a city or a region. CLDR also names subdivisions, aggregates and
// pseudo-regions ("Outlying Oceania", "European Union", "Pseudo-Accents") —
// this classifier is limited to the assigned ISO countries/territories plus
// Kosovo (XK), reusing the same Intl.DisplayNames vocabulary the name lookup
// above serves, so the two can never drift.

/** NFKD-fold + combining-mark strip + dash/whitespace normalisation. Parent `_country.mjs` `fold`. */
function fold(v) {
  return typeof v === 'string'
    ? v.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[–—−]/g, '-').replace(/\s+/g, ' ').trim()
    : '';
}

// Same construction as the parent's: every resolvable two-letter code, minus
// the aggregate/pseudo entries the workplace vocabulary skips. `match` regexes
// (prose matching) are deliberately absent — the classifier compares folded
// names exactly.
const COUNTRY_NAMES = [];
for (let a = 65; a <= 90; a++) {
  for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b);
    const name = countryName(code);
    if (name && name !== 'Unknown Region' && !['EU', 'EZ', 'UN'].includes(code)) {
      COUNTRY_NAMES.push({ code, name: fold(name) });
    }
  }
}

// The parent's shared alias table (the country-level spellings users actually
// write in portals.yml that CLDR does not carry verbatim).
const COUNTRY_ALIASES = [
  ['US', 'usa'], ['US', 'u.s.'], ['US', 'u.s.a.'], ['US', 'united states of america'],
  ['GB', 'uk'], ['GB', 'u.k.'], ['GB', 'great britain'], ['GB', 'england'],
  ['ES', 'espana'], ['ES', 'esp'],
].map(([code, name]) => ({ code, name: fold(name) }));

/** Config-list country token → folded name, so "DEU"/"DE"/"USA" compare equal to the CLDR name. */
const countryValue = (value) => fold(countryNameFromIso(value)) || value;

// Assigned ISO alpha-2 codes (the values of the alpha-3 table) plus Kosovo.
const COUNTRY_KEYWORD_CODES = new Set([...Object.values(ALPHA3_TO_ALPHA2), 'XK']);

/**
 * Whether `value` — a portals.yml `allow`/`always_allow` entry — is an exact
 * country name, alias or ISO code, not a city or region. Exact names only: a
 * substring classifier would admit region compounds into the worldwide-label
 * fallback (location-filter.mjs) and widen configs the user wrote narrowly.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCountryKeyword(value) {
  const name = countryValue(fold(value));
  return COUNTRY_NAMES.some((country) => COUNTRY_KEYWORD_CODES.has(country.code) && country.name === name)
    || COUNTRY_ALIASES.some((country) => country.name === name);
}
