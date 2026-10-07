/**
 * "Is this answer written in the locale's language?" — a heuristic for the
 * live remote QA. It never prints the text; `describe()` gives numbers only.
 *
 * Code, inline code and URLs are dropped first: they are English by nature
 * and a single stack of them outweighed a paragraph of Hindi when letters
 * were counted (Devanagari vowel signs are not even \p{L}). Scripts with
 * spaces are measured in words, CJK in characters.
 */
const SCRIPT = {
  ar: /[؀-ۿ]/u, hi: /[ऀ-ॿ]/u, ko: /[가-힯]/u,
  ru: /[Ѐ-ӿ]/u, uk: /[Ѐ-ӿ]/u,
};
const WORDS = {
  en: ['the', 'and', 'with', 'for', 'you', 'your', 'this', 'that', 'are', 'is'],
  es: ['el', 'la', 'de', 'que', 'y', 'con', 'para', 'los', 'las', 'una'],
  fr: ['le', 'la', 'les', 'de', 'des', 'et', 'pour', 'avec', 'une', 'est'],
  'pt-BR': ['de', 'que', 'com', 'para', 'uma', 'não', 'os', 'as', 'do', 'da'],
  pl: ['i', 'w', 'na', 'się', 'nie', 'z', 'do', 'jest', 'to', 'dla'],
  de: ['der', 'die', 'das', 'und', 'mit', 'für', 'ist', 'nicht', 'ein', 'eine'],
  it: ['il', 'la', 'di', 'che', 'e', 'per', 'con', 'una', 'non', 'del'],
  tr: ['ve', 'bir', 'bu', 'için', 'ile', 'olarak', 'daha', 'de', 'da', 'değil'],
  da: ['og', 'at', 'det', 'en', 'til', 'med', 'for', 'er', 'ikke', 'af'],
};

export function prose(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/\bhttps?:\/\/\S+/g, ' ')
    // Word-for-word quotes from the English CV / JD stay English by design
    // (an evaluation cites requirements); they say nothing about the prose.
    .replace(/["“«„]([^"”»“\n]{1,400})["”»“]/g, ' ')
    .replace(/[「『]([^」』\n]{1,400})[」』]/g, ' ');
}

/** Share of words (or CJK characters) in the locale's own script, 0..1. */
export function scriptShare(text, locale) {
  const t = prose(text);
  if (locale === 'ja' || locale === 'zh-CN' || locale === 'zh-TW') {
    const letters = (t.match(/\p{L}/gu) || []).length || 1;
    const kana = (t.match(/[぀-ヿ]/g) || []).length;
    const han = (t.match(/[一-鿿]/g) || []).length;
    return { own: (kana + han) / letters, kana: kana / letters };
  }
  const words = t.match(/[\p{L}\p{M}]+/gu) || [];
  const own = SCRIPT[locale] ? words.filter((w) => SCRIPT[locale].test(w)).length : 0;
  return { own: own / (words.length || 1), words: words.length };
}

export function languageOk(text, locale) {
  const t = prose(text);
  if (locale === 'ja') {
    const s = scriptShare(t, locale);
    return s.kana > 0.05 && s.own > 0.3; // kana marks Japanese, not Chinese
  }
  if (locale === 'zh-CN' || locale === 'zh-TW') return scriptShare(t, locale).own > 0.3;
  if (SCRIPT[locale]) {
    if (locale === 'uk' && !/[іїєґ]/i.test(t)) return false; // Ukrainian, not Russian
    if (locale === 'ru' && /[іїєґ]/i.test(t) && !/[ыэъё]/i.test(t)) return false;
    return scriptShare(t, locale).own > 0.3; // tech terms (Kubernetes, AWS) stay Latin
  }
  const words = t.toLowerCase().match(/\p{L}+/gu) || [];
  const hits = (list) => words.filter((w) => list.includes(w)).length;
  const mine = hits(WORDS[locale] || WORDS.en);
  if (locale === 'en') return mine >= 5;
  const en = hits(WORDS.en);
  // A short, list-shaped answer can hold few stop words; with no English ones
  // at all, three of the locale's are enough (de docs answer, v1.239.3 run).
  return (mine >= 5 && mine >= en) || (mine >= 3 && en === 0);
}

/** Numbers only — safe for a public log. */
export function describe(text, locale) {
  const script = SCRIPT[locale] || ['ja', 'zh-CN', 'zh-TW'].includes(locale);
  if (!script) {
    const words = prose(text).toLowerCase().match(/\p{L}+/gu) || [];
    const hits = (list) => words.filter((w) => list.includes(w)).length;
    return `${locale} stop words ${hits(WORDS[locale] || WORDS.en)}, en ${hits(WORDS.en)}`;
  }
  const s = scriptShare(text, locale);
  return `${locale} script ${Math.round(s.own * 100)}%${'kana' in s ? `, kana ${Math.round(s.kana * 100)}%` : ''}`;
}

/**
 * The shape of a report's headings with every word masked — safe for a public
 * log, and enough to see why the A–G check missed (a translated letter, the
 * letter after the 24th character, bold lines instead of `##`). A lone Latin
 * capital A–G is kept; any other Latin word becomes `w`, any other word `ʷ`.
 */
export function headingSkeleton(text, max = 10) {
  const lines = String(text || '').split('\n');
  const heads = lines.filter((l) => /^#{1,6}\s/.test(l)).slice(0, max).map((l) => l
    .replace(/[\p{L}\p{M}]+/gu, (w) => (/^[A-G]$/.test(w) ? w : /^[A-Za-z]+$/.test(w) ? 'w' : 'ʷ'))
    .slice(0, 48));
  const bold = lines.filter((l) => /^\*\*/.test(l.trim())).length;
  return `${heads.length} headings, ${bold} bold lines: ${heads.map((h) => JSON.stringify(h)).join(' ')}`;
}
