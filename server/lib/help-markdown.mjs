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
 */

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
