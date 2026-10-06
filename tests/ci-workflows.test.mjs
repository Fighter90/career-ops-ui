/**
 * Static guards on .github/workflows/*.yml — the properties a code review
 * found missing once (v1.241.0 hardening). Parses the YAML with js-yaml;
 * runs nothing, needs no network and no parent project.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WF = join(ROOT, '.github', 'workflows');
let yaml;
const wf = {};
const raw = {};

before(async () => {
  yaml = (await import('js-yaml')).default;
  for (const f of readdirSync(WF).filter((x) => x.endsWith('.yml'))) {
    raw[f] = readFileSync(join(WF, f), 'utf8');
    wf[f] = yaml.load(raw[f]);
  }
});

const runs = (job) => (job.steps || []).map((s) => s.run || '').join('\n');
const stepRun = (file, job, name) => (wf[file].jobs[job].steps.find((s) => (s.name || '').startsWith(name)) || {}).run || '';

test('every job declares least-privilege permissions', () => {
  const missing = [];
  for (const [f, d] of Object.entries(wf)) {
    for (const [jn, j] of Object.entries(d.jobs)) if (!j.permissions) missing.push(`${f}:${jn}`);
  }
  assert.deepEqual(missing, []);
});

test('no ${{ }} expression is spliced into a run: script (pass via env)', () => {
  const hits = [];
  for (const [f, d] of Object.entries(wf)) {
    for (const [jn, j] of Object.entries(d.jobs)) {
      for (const m of runs(j).matchAll(/\$\{\{[^}]*\}\}/g)) hits.push(`${f}:${jn} ${m[0]}`);
    }
  }
  assert.deepEqual(hits, []);
});

test('ci.yml runs the full release gate and the workflow evals', () => {
  const unit = runs(wf['ci.yml'].jobs.unit);
  assert.match(unit, /npm run test:ci/);
  assert.match(unit, /node evals\/workflow\/run\.mjs/);
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  for (const gate of ['npm test', 'check-no-also-leftovers', 'check-changelog-parity', 'i18n-audit']) {
    assert.ok(pkg.scripts['test:ci'].includes(gate), `test:ci lost ${gate}`);
  }
});

test('ai-review: write scopes only on the job that needs them', () => {
  const d = wf['ai-review.yml'];
  assert.deepEqual(d.permissions, { contents: 'read' });
  assert.equal(d.jobs['push-review'].permissions.contents, 'write');
  assert.equal(d.jobs['pr-review'].permissions['pull-requests'], 'write');
  assert.notEqual(d.jobs['pr-review'].permissions.contents, 'write');
});

test('deploy-pages: the OIDC token and pages:write never reach the build job', () => {
  const d = wf['deploy-pages.yml'];
  assert.ok(!d.permissions['id-token'] && !d.permissions.pages);
  assert.ok(!d.jobs.build.permissions['id-token'] && !d.jobs.build.permissions.pages);
  assert.equal(d.jobs.deploy.permissions['id-token'], 'write');
});

test('remote-qa: production secrets only in jobs bound to the production environment', () => {
  const d = wf['remote-qa.yml'];
  for (const [jn, j] of Object.entries(d.jobs)) {
    const usesSecrets = /secrets\./.test(JSON.stringify(j));
    if (usesSecrets) assert.equal(j.environment, 'production', `${jn} reads secrets without environment: production`);
  }
  assert.match(d.jobs.prod.if, /github\.event_name != 'push'/);
  assert.match(d.jobs['prod-live'].if, /workflow_dispatch/);
});

test('release: tag arrives via env, is validated, and an empty body fails', () => {
  const notes = stepRun('release.yml', 'release', 'Extract release notes');
  const step = wf['release.yml'].jobs.release.steps.find((s) => (s.name || '').startsWith('Extract release notes'));
  assert.match(step.env.TAG, /inputs\.tag/);
  assert.match(notes, /\[\[ "\$TAG" =~ \^v\[0-9\]/);
  assert.match(notes, /no CHANGELOG\.md entry body/);
  assert.equal(wf['release.yml'].permissions.contents, 'read');
});

test('deploy: rollback restores deps, files deleted upstream are removed after backup', () => {
  const dep = stepRun('deploy.yml', 'deploy', 'Deploy');
  assert.match(dep, /install_deps rollback/);
  assert.match(dep, /reinstalled\[\$d\]=1/);
  assert.match(dep, /--no-renames --diff-filter=D/);
  // the deleted list is added to the backup BEFORE the tarball is written
  assert.ok(dep.indexOf('cat "$BK/$n.deleted" >> "$BK/$n.existing"') < dep.indexOf('tar -C "$d" -czf'));
  assert.match(dep, /hosts\.conf/, 'ALLOWED_HOSTS drop-in must stay');
});

test('deploy recon: the hourly-scan script is summarised, never printed', () => {
  const recon = stepRun('deploy.yml', 'deploy', 'Recon');
  const block = recon.slice(recon.indexOf('sec hourly-scan'), recon.indexOf('sec node-heap'));
  assert.ok(block.length > 0);
  assert.doesNotMatch(block, /grep -n|sed /, 'line contents (even masked) must not reach the public log');
  assert.match(block, /carries credentials/);
});

test('wiki-sync decodes the patch subject; publish 409 only from npm error lines', () => {
  assert.match(stepRun('wiki-sync.yml', 'apply', 'Apply and push'), /git mailinfo/);
  const pub = stepRun('publish-package.yml', 'publish', 'Publish');
  assert.match(pub, /grep -E '\^npm \(error\|ERR!\)'/);
  assert.doesNotMatch(pub, /\|409\|/);
});
