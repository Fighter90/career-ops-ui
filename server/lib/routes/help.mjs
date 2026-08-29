/**
 * Help-center route — serves the in-app Markdown user guide.
 *
 *   GET /api/help/:lang → { lang, markdown }
 *
 * Locales live in web-ui/docs/help/<lang>.md. The SPA i18n module sends
 * BCP-47-ish bare codes (ko, ja, en, ru) but the disk filenames are a
 * mix of bare and region-tagged (ko-KR.md, pt-BR.md, zh-CN.md). The
 * resolver below tries: exact match, region-tag alias, language-only
 * fallback, then en.md (F-002).
 *
 * `:lang` is sanitized to [a-zA-Z0-9_-]+ so path-traversal can't escape
 * the help directory.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { WEB_UI_ROOT } from '../paths.mjs';
import { stripGithubOnlyBlocks } from '../help-markdown.mjs';

// SPA-code → on-disk filename when they don't match. Add new entries here
// rather than renaming bundles; tests/help-ui.test.mjs pins file names.
const FILE_ALIASES = {
  ko: 'ko-KR',
};

export function registerHelpRoutes(app) {
  app.get('/api/help/:lang', (req, res) => {
    const safeLang = req.params.lang.replace(/[^a-zA-Z0-9_-]/g, '');
    const helpDir = resolve(WEB_UI_ROOT, 'docs', 'help');
    const baseLang = safeLang.split('-')[0];
    const candidates = [
      `${safeLang}.md`,
      FILE_ALIASES[safeLang] ? `${FILE_ALIASES[safeLang]}.md` : null,
      `${baseLang}.md`,
      'en.md',
    ].filter(Boolean);
    for (const fname of candidates) {
      const full = resolve(helpDir, fname);
      if (existsSync(full)) {
        // The provider-logo banner is a GitHub-only HTML block. UI.md() is
        // escape-first, so leaving it in PRINTS it as the page's first line
        // rather than dropping it — strip it at the ingress instead.
        res.json({ lang: fname.replace(/\.md$/, ''), markdown: stripGithubOnlyBlocks(readFileSync(full, 'utf8')) });
        return;
      }
    }
    res.status(404).json({ error: 'help docs not found' });
  });
}
