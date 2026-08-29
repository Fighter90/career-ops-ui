/**
 * BUG-B guard (v1.228.0) — the GitHub-only provider banner must never reach
 * the app's help ingress.
 *
 * `docs/help/<lang>.md` opens with a raw HTML block so GitHub renders the
 * provider-logo showcase:
 *
 *     <p align="center"><img src="…/images/providers.png" …></p>
 *
 * v1.225.0/v1.225.1 recorded this as harmless in-app on the grounds that
 * "UI.md() has no image support, so it is stripped". That conflated two
 * different things. `UI.md()` is escape-first: it HTML-escapes every byte of
 * the source before any markdown transform, which is the right XSS boundary
 * but is the opposite of removal. The banner was rendered as escaped text, so
 * `#/help` opened with 268 characters of literal `<p align="center"><img …` as
 * its first visible line, in every locale.
 *
 * The fix strips such blocks at the shared read path (`stripGithubOnlyBlocks`),
 * so the file keeps its GitHub showcase while the app and the "Ask the docs"
 * retrieval corpus never see it. These tests pin BOTH halves of that contract:
 * the bundles keep the banner on disk, and no consumer ever serves it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripGithubOnlyBlocks } from '../server/lib/help-markdown.mjs';
import { createApp } from '../server/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const HELP_LOCALES = ['en', 'es', 'pt-BR', 'ko-KR', 'ja', 'ru', 'zh-CN', 'zh-TW',
  'fr', 'pl', 'uk', 'da', 'ar', 'de', 'it', 'tr', 'hi'];

const bundle = (lang) => readFileSync(resolve(ROOT, 'docs', 'help', `${lang}.md`), 'utf8');

test('the banner stays in the bundles on disk (GitHub renders it)', () => {
  for (const lang of HELP_LOCALES) {
    assert.match(
      bundle(lang), /<img\b/,
      `${lang}.md lost its provider banner — GitHub's rendering of this file depends on it`,
    );
  }
});

test('stripping leaves no HTML image block in any locale', () => {
  for (const lang of HELP_LOCALES) {
    const out = stripGithubOnlyBlocks(bundle(lang));
    assert.doesNotMatch(
      out, /<img\b/,
      `${lang}.md still carries an <img> after stripping — it would print as escaped text in #/help`,
    );
  }
});

test('the first rendered line of every bundle is its heading, not markup', () => {
  for (const lang of HELP_LOCALES) {
    const first = stripGithubOnlyBlocks(bundle(lang)).split('\n').find((l) => l.trim());
    assert.ok(first.startsWith('#'), `${lang}.md now opens with ${JSON.stringify(first.slice(0, 60))}`);
  }
});

test('stripping is narrow — prose, inline images and markdown images survive', () => {
  // Only a standalone one-element HTML block carrying an <img> is removed.
  assert.equal(stripGithubOnlyBlocks('# H\n\n<p align="center"><img src="a.png"></p>\n\nBody'), '# H\n\nBody');
  assert.ok(stripGithubOnlyBlocks('A photo <img src=x> mid-sentence.').includes('<img'));
  assert.ok(stripGithubOnlyBlocks('![alt](pic.png)').includes('!['));
  assert.ok(stripGithubOnlyBlocks('Text with <b>bold</b> inside.').includes('<b>'));
  assert.equal(stripGithubOnlyBlocks(''), '');
  assert.equal(stripGithubOnlyBlocks(null), '');
});

test('both help consumers route their reads through the stripper', () => {
  // A future route that reads the bundles directly would reintroduce the bug,
  // so pin the wiring rather than only the helper's behaviour.
  for (const f of ['server/lib/routes/help.mjs', 'server/lib/routes/docs-assistant.mjs']) {
    const src = readFileSync(resolve(ROOT, f), 'utf8');
    assert.match(src, /stripGithubOnlyBlocks\s*\(/, `${f} reads help markdown without stripping it`);
  }
});

/**
 * Path-traversal guard on the help route (CodeQL js/path-injection, PR #309).
 *
 * `:lang` is stripped to [a-zA-Z0-9_-] before use, so no '.', '/' or '\\' can
 * reach a candidate filename and traversal was already impossible. The route
 * now ALSO asserts containment on the resolved path, so the guarantee is local
 * and checked instead of argued from a regex several lines away. These cases
 * pin the behaviour either way: a traversal attempt must never read outside
 * docs/help — it falls through to the en.md default.
 */
test('the help route cannot be walked out of docs/help', async () => {
  const app = createApp();
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const attack of [
      '..%2f..%2f..%2fpackage', '....//....//package', '%2e%2e%2fpackage',
      '../../../etc/passwd', 'en/../../../package',
    ]) {
      const res = await fetch(`${base}/api/help/${attack}`);
      const text = await res.text();
      // Three safe outcomes, depending on how far the payload gets:
      //   404            — Express never matched the route;
      //   200 + HTML     — the SPA history fallback served index.html;
      //   200 + JSON     — the route matched, and the sanitizer + containment
      //                    check landed it on a real bundle.
      // All three are fine. What must NEVER happen is a file from outside
      // docs/help coming back, so that is what every branch asserts.
      assert.doesNotMatch(text, /"dependencies"\s*:|root:x:0:0/, `${attack} leaked a non-help file`);
      if (res.status === 404) continue;
      if ((res.headers.get('content-type') || '').includes('application/json')) {
        const body = JSON.parse(text);
        assert.match(body.lang, /^[a-zA-Z0-9_-]+$/, `${attack} resolved to ${body.lang}`);
        assert.ok(body.markdown.startsWith('#'), `${attack} returned non-help content`);
      } else {
        assert.match(text, /^<!DOCTYPE html>/i, `${attack} returned neither JSON nor the SPA shell`);
      }
    }
  } finally {
    server.close();
  }
});
