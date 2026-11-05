/**
 * Help-bundle markdown ingress (v1.228.0).
 *
 * `docs/help/<lang>.md` serves two very different readers:
 *
 *   1. GitHub, which renders the file as a page and shows raw HTML blocks —
 *      that is why the provider-logo banner (`<p align="center"><img …></p>`)
 *      lives at the top of every bundle since v1.225.0;
 *   2. the app, where the SAME bytes go through `UI.md()` and, separately,
 *      into the "Ask the docs" retrieval corpus.
 *
 * `UI.md()` is escape-first by construction: step 2 of its pipeline escapes
 * every byte of the source before any markdown transform runs, so raw HTML
 * can never reach innerHTML. That is the correct XSS boundary — but escaping
 * is not removal. The banner was therefore PRINTED, and `#/help` opened with
 * a 268-character line of literal `<p align="center"><img src="https://…`
 * as its first visible content, in all 17 locales.
 *
 * v1.225.0/v1.225.1 recorded the belief that the renderer's lack of image
 * support meant the banner was "stripped in-app". It never was; nothing
 * removed it, because no code ever tried to.
 *
 * So the removal happens here, at the single ingress both consumers share.
 * Keeping the banner in the file preserves the GitHub showcase; stripping it
 * on read keeps it out of the rendered page and out of the retrieval corpus,
 * where 268 bytes of markup are pure noise for keyword matching.
 *
 * CAR-107 (P2.1) — this module also owns the {{t:key}} UI-label placeholder
 * resolution (see the section below stripGithubOnlyBlocks): the bundles
 * reference labels from the i18n dict instead of hard-coding EN strings.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

/**
 * Drop standalone HTML blocks that exist purely for GitHub's renderer.
 *
 * Deliberately narrow: only a whole line that is ONE html element containing
 * an `<img>` is removed. Prose is never touched, an inline `<img>` inside a
 * sentence is left alone, and a markdown image (`![alt](src)`) is untouched
 * because `UI.md()` may learn to render those later.
 *
 * @param {string} markdown raw bundle text
 * @returns {string} the same text with GitHub-only image blocks removed
 */
export function stripGithubOnlyBlocks(markdown) {
  if (!markdown) return '';
  return markdown
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t.startsWith('<')) return true;
      // A single HTML element on its own line that carries an <img>.
      return !(/^<([a-z]+)\b[^>]*>.*<img\b[^>]*>.*<\/\1>$/i.test(t) || /^<img\b[^>]*\/?>$/i.test(t));
    })
    .join('\n')
    // Collapse the blank-line pair the removed block leaves behind so the
    // first heading is not followed by three newlines.
    .replace(/\n{3,}/g, '\n\n');
}

// ── CAR-107 (P2.1): {{t:key}} UI-label placeholders ──────────────────────────
//
// The bundles no longer hard-code EN button/tab labels ('▶ Generate prompt',
// 'API keys & runtime', …). They reference the i18n dict instead:
//
//   Click **{{t:deep.run}}** …
//
// Each consumer resolves the placeholder for its own audience:
//
//   • the app (#/help) — the ACTIVE locale's label, via I18n.t in
//     public/js/views/help.js, before UI.md();
//   • cvstart.org — the site's own i18n value when it has one, else the EN
//     dict value, at sync time (site/scripts/sync-assets.mjs);
//   • server-side readers (the "Ask the docs" retrieval corpus) — the EN
//     dict value, here: the assistant answers in the request language, and
//     a raw {{t:…}} in an excerpt would leak into its answer.
//
// Global flag is intentional for .replace() (which resets lastIndex per
// call). If you ever use it with .test()/.exec(), copy it first.

export const HELP_PLACEHOLDER_RE = /\{\{t:([A-Za-z0-9_.-]+)\}\}/g;

/**
 * Replace every {{t:key}} with whatever `resolveKey` returns for it.
 * Return the raw placeholder when the resolver has no value — a missing
 * key must stay visible, never silently disappear.
 *
 * @param {string} markdown bundle text
 * @param {(key: string) => string|null|undefined} resolveKey label lookup
 * @returns {string}
 */
export function substituteHelpPlaceholders(markdown, resolveKey) {
  if (!markdown) return '';
  return String(markdown).replace(HELP_PLACEHOLDER_RE, (raw, key) => {
    const v = resolveKey(key);
    return (typeof v === 'string' && v.length > 0) ? v : raw;
  });
}

// EN dict values for server-side readers. Loaded lazily (first corpus read)
// by executing the real per-locale table + alias map in a vm context — the
// same faithful parse tests/helpers/i18n-vm.mjs uses, so the values are
// exactly what the browser would show, not a regex re-implementation.
let EN_TABLE = null;
function englishLabelLookup() {
  if (EN_TABLE) return EN_TABLE;
  const localesDir = resolve(
    dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'js', 'lib', 'locales',
  );
  const ctx = createContext({ window: {} });
  runInContext(readFileSync(resolve(localesDir, 'i18n-dict.en.js'), 'utf8'), ctx);
  runInContext(readFileSync(resolve(localesDir, 'i18n-dict.aliases.js'), 'utf8'), ctx);
  const en = ctx.window.__I18N_DICT_EN || {};
  const aliases = ctx.window.__I18N_ALIASES || {};
  EN_TABLE = (key) => en[key] ?? en[aliases[key]] ?? null;
  return EN_TABLE;
}

/**
 * Server-side reader variant: {{t:key}} → the EN dict value (the label the
 * EN app UI shows). Used by the docs-assistant corpus; the /api/help route
 * deliberately does NOT call this — it serves raw markdown and the client
 * localizes.
 *
 * @param {string} markdown bundle text
 * @returns {string}
 */
export function substituteHelpPlaceholdersEn(markdown) {
  if (!markdown) return '';
  const lookup = englishLabelLookup();
  return substituteHelpPlaceholders(markdown, lookup);
}
