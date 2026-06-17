/**
 * Prompt builders for LLM-bound payloads.
 *
 * Centralizes every string the server can hand to Anthropic / Gemini.
 * Helpers in here are PURE — no I/O — except `bundleProjectContext`,
 * which reads parent-project files synchronously when called.
 *
 * Used by routes /api/evaluate, /api/deep, /api/mode/:slug, /api/apply-helper.
 */
import { existsSync, readFileSync } from 'node:fs';
import { PATHS, path as projPath } from './paths.mjs';
import { slugify } from './parsers.mjs';

// Locale code → English language name. Used by buildLocaleDirective so
// every LLM call honors the user's UI locale (PR-2 / F-012). Codes match
// the SPA's i18n bundle in public/js/lib/i18n.js.
const LOCALE_NAMES = {
  en: 'English',
  es: 'Spanish',
  'pt-BR': 'Brazilian Portuguese',
  ko: 'Korean',
  ja: 'Japanese',
  ru: 'Russian',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  fr: 'French',
  pl: 'Polish',
  uk: 'Ukrainian',
  ar: 'Arabic',
};

/**
 * Resolve and normalize a locale code from request inputs (body.lang,
 * body.locale, Accept-Language header). Returns one of the known SPA
 * locales, defaulting to 'en' if nothing matches.
 */
export function resolveLocale(req) {
  const candidates = [
    req?.body?.lang,
    req?.body?.locale,
    req?.headers?.['accept-language'],
  ].filter((s) => typeof s === 'string' && s.trim());
  for (const raw of candidates) {
    const code = raw.split(',')[0].trim();
    if (LOCALE_NAMES[code]) return code;
    const base = code.split('-')[0];
    if (LOCALE_NAMES[base]) return base;
  }
  return 'en';
}

/**
 * One-line directive prepended to every LLM prompt so the response
 * matches the UI locale. Code/identifiers stay English; prose is
 * localized. Empty string for English (no directive needed).
 */
export function buildLocaleDirective(lang) {
  if (!lang || lang === 'en' || !LOCALE_NAMES[lang]) return '';
  return [
    '# Output language',
    `Respond in ${LOCALE_NAMES[lang]} (locale: ${lang}). Keep code and identifiers in English; translate prose, headings, and bullet points.`,
    '',
    '',
  ].join('\n');
}

/**
 * v1.13.0 — Locale-aware scaffolding strings the prompt builders wrap
 * around the parent's English mode templates. Parent files
 * (`modes/<slug>.md`) are read-only per CLAUDE.md hard rule #1, so the
 * raw body stays English. What CAN be localized is the career-ops-ui
 * scaffolding that wraps the body: the "Read these files first" preamble,
 * the "User-supplied context" label, and the section separator before
 * the inlined template body. All translations are mine, original to
 * this file, and live alongside the buildLocaleDirective output above.
 */
const SCAFFOLD_STRINGS = {
  readFiles: {
    en: 'Read these files first (they exist in the project root):',
    es: 'Lee primero estos archivos (existen en la raíz del proyecto):',
    'pt-BR': 'Leia primeiro estes arquivos (existem na raiz do projeto):',
    ko: '먼저 이 파일들을 읽으세요 (프로젝트 루트에 있습니다):',
    ja: 'まずこれらのファイルを読んでください (プロジェクトルートに存在):',
    ru: 'Сначала прочти эти файлы (они в корне проекта):',
    'zh-CN': '请先阅读这些文件 (它们位于项目根目录):',
    'zh-TW': '請先閱讀這些檔案 (位於專案根目錄):',
    fr: 'Lisez d\'abord ces fichiers (ils existent à la racine du projet) :',
    pl: 'Najpierw przeczytaj te pliki (znajdują się w katalogu głównym projektu):',
    uk: 'Спочатку прочитай ці файли (вони в корені проєкту):',
    ar: 'اقرأ هذه الملفات أولاً (توجد في جذر المشروع):',
  },
  userContext: {
    en: 'User-supplied context:',
    es: 'Contexto del usuario:',
    'pt-BR': 'Contexto do usuário:',
    ko: '사용자 제공 컨텍스트:',
    ja: 'ユーザー提供コンテキスト:',
    ru: 'Контекст от пользователя:',
    'zh-CN': '用户提供的上下文:',
    'zh-TW': '使用者提供的內容:',
    fr: 'Contexte fourni par l\'utilisateur :',
    pl: 'Kontekst od użytkownika:',
    uk: 'Контекст від користувача:',
    ar: 'السياق المقدَّم من المستخدم:',
  },
  modeTemplate: {
    en: 'mode template',
    es: 'plantilla del modo',
    'pt-BR': 'template do modo',
    ko: '모드 템플릿',
    ja: 'モードテンプレート',
    ru: 'шаблон режима',
    'zh-CN': '模式模板',
    'zh-TW': '模式模板',
    fr: 'modèle de mode',
    pl: 'szablon trybu',
    uk: 'шаблон режиму',
    ar: 'قالب الوضع',
  },
  modeRoleLine: {
    en: (slug) => `You are career-ops in ${slug} mode.`,
    es: (slug) => `Eres career-ops en modo ${slug}.`,
    'pt-BR': (slug) => `Você é career-ops em modo ${slug}.`,
    ko: (slug) => `당신은 ${slug} 모드의 career-ops 입니다.`,
    ja: (slug) => `あなたは ${slug} モードの career-ops です。`,
    ru: (slug) => `Ты — career-ops в режиме ${slug}.`,
    'zh-CN': (slug) => `你是 ${slug} 模式下的 career-ops。`,
    'zh-TW': (slug) => `你是 ${slug} 模式下的 career-ops。`,
    fr: (slug) => `Vous êtes career-ops en mode ${slug}.`,
    pl: (slug) => `Jesteś career-ops w trybie ${slug}.`,
    uk: (slug) => `Ти — career-ops у режимі ${slug}.`,
    ar: (slug) => `أنت career-ops في وضع ${slug}.`,
  },
  evalRoleLine: {
    en: 'You are career-ops. Evaluate this Job Description against the user\'s CV.',
    es: 'Eres career-ops. Evalúa este Job Description contra el CV del usuario.',
    'pt-BR': 'Você é career-ops. Avalie este Job Description contra o CV do usuário.',
    ko: '당신은 career-ops 입니다. 이 Job Description을 사용자의 CV와 비교 평가하세요.',
    ja: 'あなたは career-ops です。この Job Description をユーザーの CV と照らして評価してください。',
    ru: 'Ты — career-ops. Оцени этот Job Description относительно CV пользователя.',
    'zh-CN': '你是 career-ops。请将此 Job Description 与用户的 CV 进行评估。',
    'zh-TW': '你是 career-ops。請將此 Job Description 與使用者的 CV 進行評估。',
    fr: 'Vous êtes career-ops. Évaluez cette Job Description par rapport au CV de l\'utilisateur.',
    pl: 'Jesteś career-ops. Oceń ten Job Description względem CV użytkownika.',
    uk: 'Ти — career-ops. Оціни цей Job Description відносно CV користувача.',
    ar: 'أنت career-ops. قيّم هذا الـ Job Description مقابل سيرة المستخدم الذاتية (CV).',
  },
};

/** Resolve a scaffolding string for the active locale, fall back to en. */
export function scaffold(key, lang) {
  const bag = SCAFFOLD_STRINGS[key];
  if (!bag) return '';
  return bag[lang] || bag.en;
}

/**
 * Bundle parent-project files into a single `<project_context>` block
 * for Anthropic SDK calls (which have no filesystem). Each file is read
 * defensively (missing → skipped, oversized → truncated) and labeled
 * with its origin path so the model can cite it back.
 *
 * Used by /api/deep and /api/mode/:slug Anthropic branches (REVIEW-A1).
 *
 * @param {{ modeSlugs?: string[], maxBytesPerFile?: number }} opts
 * @returns {string} A delimited block ending with two newlines, ready to
 *   prepend to the user-facing prompt.
 */
export function bundleProjectContext(opts = {}) {
  const maxBytes = opts.maxBytesPerFile ?? 16 * 1024;
  const modeSlugs = opts.modeSlugs ?? [];
  const files = [
    { label: 'cv.md', path: PATHS.cv },
    { label: 'config/profile.yml', path: PATHS.profile },
    ...modeSlugs.map((slug) => ({
      label: `modes/${slug}.md`,
      path: projPath('modes', `${slug}.md`),
    })),
  ];
  const blocks = [];
  for (const f of files) {
    if (!existsSync(f.path)) continue;
    let text;
    try { text = readFileSync(f.path, 'utf8'); } catch { continue; }
    if (text.length > maxBytes) {
      text = text.slice(0, maxBytes) + `\n\n[…truncated at ${maxBytes} bytes…]`;
    }
    blocks.push(`--- ${f.label} ---\n${text}`);
  }
  if (!blocks.length) return '';
  return [
    '<project_context>',
    'You are running outside Claude Code, so the files referenced below',
    'are inlined here. Treat them as authoritative.',
    '',
    blocks.join('\n\n'),
    '</project_context>',
    '',
    '',
  ].join('\n');
}

/**
 * Glue the user-supplied context onto a parent-project mode template.
 * The mode file is the canonical prompt; we just decorate it with the
 * fields the user filled in. Strips any { run: ... } toggle so it
 * doesn't leak into the rendered prompt.
 */
// Per-mode name of the final artifact, used in the single-shot reminder so the
// model knows exactly what to emit. Falls back to "the final result".
const MODE_ARTIFACT = {
  cover: 'the cover letter',
  contacto: 'the outreach message(s)',
  'interview-prep': 'the interview-prep brief',
  project: 'the project evaluation',
  training: 'the course/certification evaluation',
  followup: 'the follow-up message',
  patterns: 'the rejection-pattern analysis',
  batch: 'the result',
};

// SINGLE-SHOT OUTPUT CONTRACT. The parent `modes/<slug>.md` templates are
// written for interactive Claude Code sessions — several (cover, contacto, …)
// pause to ask the user clarifying questions before producing the artifact.
// In the web-ui the runner is single-shot: the model's reply is shown verbatim
// as the result and there is no way to answer follow-ups. This directive makes
// every "Run live" do the analysis silently and emit ONLY the final artifact.
function singleShotContract() {
  return [
    '# Output contract — single-shot, non-interactive',
    'You are running via a web UI, NOT an interactive chat. Your reply is shown',
    'to the user verbatim as the FINAL result; there is no chance to ask a',
    'follow-up question or receive an answer.',
    '- Do NOT ask the user any questions and do NOT wait for input.',
    '- Do the mode\'s analysis (job/vacancy breakdown, company notes, keywords,',
    '  profile↔JD gaps, etc.) SILENTLY/internally — do not print it as numbered',
    '  steps or a questionnaire.',
    '- Wherever the mode template would normally pause to ask the user (tone,',
    '  angle, how to handle gaps, which option to pick), choose the most',
    '  reasonable default yourself from cv.md / config/profile.yml + the supplied',
    '  context, and proceed.',
    '- Output ONLY the final artifact — no preamble, no analysis dump, no questions.',
    '',
    '',
  ].join('\n');
}

export function buildModePrompt(template, slug, context, lang) {
  const ctx = { ...context };
  delete ctx.run;
  delete ctx.lang;
  delete ctx.locale;
  const roleLineFn = SCAFFOLD_STRINGS.modeRoleLine[lang] || SCAFFOLD_STRINGS.modeRoleLine.en;
  const artifact = MODE_ARTIFACT[slug] || 'the final result';
  const parts = [
    buildLocaleDirective(lang),
    roleLineFn(slug),
    '',
    singleShotContract(),
    scaffold('readFiles', lang),
    '  • cv.md',
    '  • config/profile.yml',
    '  • modes/_shared.md',
    `  • modes/${slug}.md`,
    '',
    scaffold('userContext', lang),
    '```json',
    JSON.stringify(ctx, null, 2),
    '```',
    '',
    '─── modes/' + slug + '.md ───',
    '',
    template,
    '',
    '─── Output now ───',
    `Per the single-shot output contract above: skip every interactive question in`,
    `the mode template, assume sensible defaults from cv.md / config/profile.yml,`,
    `and output ONLY ${artifact}. Begin now.`,
  ];
  return parts.join('\n');
}

export function buildEvaluationPrompt(jd, lang) {
  return `${buildLocaleDirective(lang)}${scaffold('evalRoleLine', lang)}

${scaffold('readFiles', lang)}
  • cv.md
  • config/profile.yml
  • modes/_shared.md
  • modes/oferta.md

Then output the full A-G evaluation per modes/oferta.md (Role Summary, CV Match, Risks, Compensation,
Application Strategy, Verdict, Posting Legitimacy) and a 0-5 score.

JD:
"""
${jd}
"""
`;
}

export function buildDeepPrompt(company, role, lang) {
  return `${buildLocaleDirective(lang)}You are career-ops in deep-research mode. Produce a full company brief on ${company}${role ? ` for the role of ${role}` : ''}.

Read modes/deep.md for structure. Use WebFetch / WebSearch. Cover:
  1. Company snapshot (size, funding, runway, leadership)
  2. Engineering culture (stack, blogs, GitHub, conference talks)
  3. Recent news, layoffs, acquisitions, controversies
  4. Glassdoor/Levels.fyi/Blind sentiment
  5. Interview process intel
  6. Negotiation leverage points
  7. Three smart questions for the recruiter

Save the output to interview-prep/${slugify(company)}-${role ? slugify(role) : 'general'}.md
`;
}

export function buildApplyChecklist(url, jd) {
  return [
    `URL: ${url}`,
    '',
    '0. Run /career-ops apply in Claude Code with this URL — it will read the form via Playwright.',
    '1. Verify the posting is still live (check footer/navbar vs JD presence).',
    '2. Confirm CV is the latest (run sync-check, then PDF if score ≥ 4.0).',
    '3. Tailor the cover letter / "Why us?" answer using STAR+R proof points from cv.md.',
    '4. Answer EEO / sponsorship / start-date questions truthfully.',
    '5. Save filled answers to interview-prep/{company}-{role}.md before submitting.',
    '6. NEVER auto-submit — you (the human) click the final button.',
    '7. After submit: add row to data/applications.md (or write TSV to batch/tracker-additions/).',
    jd ? '\n--- JD excerpt ---\n' + jd.slice(0, 600) + (jd.length > 600 ? '\n…' : '') : '',
  ].join('\n');
}
