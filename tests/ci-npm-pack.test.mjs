/**
 * The published tarball carries what the server reads at runtime and not
 * the ~8 MB of translated CHANGELOGs. Asks npm itself
 * (`npm pack --dry-run --json`), so `files`, .npmignore and npm's own
 * always-include rules are all accounted for.
 *
 * npm 10 runs `prepare` (install-hooks.mjs) on pack EVEN WITH
 * --ignore-scripts, and that script writes core.hooksPath. GIT_DIR points
 * at a path that does not exist, so its `git rev-parse` fails and it
 * no-ops: no git config is touched. --dry-run builds no tarball. No network.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let files;

before(() => {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      GIT_DIR: join(tmpdir(), 'ci-npm-pack-no-such-git-dir'),
      npm_config_update_notifier: 'false', npm_config_fund: 'false', npm_config_audit: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Lifecycle output can precede the JSON on old npms; take the array.
  const json = JSON.parse(out.slice(out.indexOf('[')));
  files = new Set(json[0].files.map((f) => f.path));
});

test('runtime files are in the package', () => {
  for (const f of ['server/index.mjs', 'docs/help/en.md', 'docs/help/ru.md', 'public/index.html', 'bin/career-ops-ui.sh', 'package.json']) {
    assert.ok(files.has(f), `missing ${f}`);
  }
});

test('every Help locale ships (GET /api/help/:lang reads docs/help at runtime)', () => {
  const help = [...files].filter((f) => /^docs\/help\/[^/]+\.md$/.test(f));
  assert.ok(help.length >= 16, `only ${help.length} help files`);
});

test('the English README / CHANGELOG / LICENSE ship, translated CHANGELOGs do not', () => {
  for (const f of ['README.md', 'CHANGELOG.md', 'LICENSE']) assert.ok(files.has(f), `missing ${f}`);
  // ~8 MB of translated changelogs. (Translated READMEs, ~1 MB, are added by
  // npm's own always-include-README rule whatever `files` says.)
  const translated = [...files].filter((f) => /^CHANGELOG\.[^/]+\.md$/.test(f));
  assert.deepEqual(translated, []);
});

test('repo-only material stays out', () => {
  const leaked = [...files].filter((f) => /^(tests|\.github|qa|site|evals|docs\/(?!help\/))\//.test(f));
  assert.deepEqual(leaked, []);
});
