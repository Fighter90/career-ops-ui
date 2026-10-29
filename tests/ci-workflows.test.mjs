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

test('v1.241.1: deploy waits for a running scan/eval before restarting, and always resumes the timers', () => {
  const src = readFileSync(join(WF, 'deploy.yml'), 'utf8');
  const hold = src.indexOf('hold_timers\n');
  const restart = src.indexOf('systemctl restart "$SERVICE"\n          healthy "$UI_REF"');
  const resume = src.indexOf('resume_timers\n          trap - ERR');
  assert.ok(hold > 0 && restart > hold && resume > restart, 'hold → restart → healthy → resume');
  const rollback = src.slice(src.indexOf('rollback() {'), src.indexOf('rollback() {') + 400);
  assert.match(rollback, /resume_timers/, 'a failed deploy still restarts the timers');
  // A running oneshot is "activating" — `is-active` would say it is not running.
  assert.match(src, /ActiveState --value "\$u"/);
  assert.match(src, /activating\|deactivating\)/);
  const wait = Number(src.match(/SCAN_WAIT_S:-(\d+)/)[1]);
  const jobMin = Number(src.match(/timeout-minutes: (\d+)/)[1]);
  assert.ok(wait / 60 + 15 <= jobMin, `scan wait ${wait}s leaves room in the ${jobMin}-min job`);
});

test('deploy: the anti-downgrade guard is executable — no ref defaults, guard precedes Deploy', () => {
  const d = wf['deploy.yml'];
  // (а) a bare Run-workflow click must leave both refs empty so the guard's -z fires
  const inputs = d.on.workflow_dispatch.inputs;
  assert.ok(!inputs.ui_ref.default, 'ui_ref must have no default (a bare click must not downgrade prod)');
  assert.ok(!inputs.parent_ref.default, 'parent_ref must have no default');
  const steps = d.jobs.deploy.steps;
  // (б) a guard step exists and is gated on mode=deploy
  const gi = steps.findIndex(
    (s) => (s.name || '').startsWith('Guard') && s.if === "inputs.mode == 'deploy'",
  );
  assert.ok(gi >= 0, 'guard step with if: inputs.mode == deploy is missing');
  const guard = steps[gi];
  assert.equal(guard.env.GUARD_UI_REF, '${{ inputs.ui_ref }}', 'guard must read the ui_ref input');
  assert.equal(guard.env.GUARD_PARENT_REF, '${{ inputs.parent_ref }}', 'guard must read the parent_ref input');
  // (в) guard runs BEFORE the Deploy step in the jobs sequence
  const di = steps.findIndex((s) => s.name === 'Deploy');
  assert.ok(di > gi, 'the guard must precede the Deploy step');
  // (г) empty-checks on BOTH refs + a ::error, so a partial fill cannot pass
  assert.match(guard.run, /if \[ -z "\$GUARD_UI_REF" \] \|\| \[ -z "\$GUARD_PARENT_REF" \]/);
  assert.match(guard.run, /::error::/);
});

test('deploy provider mode: NEW_PROVIDER is charset-validated before it reaches the remote shell', () => {
  const steps = wf['deploy.yml'].jobs.deploy.steps;
  const prov = steps.find((s) => (s.name || '').startsWith('Switch LLM_PROVIDER'));
  assert.ok(prov, 'provider step missing');
  const run = prov.run || '';
  // strict non-empty charset gate with a ::error (input.provider is the only
  // input spliced raw into a remote shell command line: a value containing a
  // quote would break out of it and run arbitrary code on prod)
  assert.match(run, /\[\[ "\$NEW_PROVIDER" =~ \^\[A-Za-z0-9_-\]\+\$ \]\]/, 'charset gate missing');
  assert.match(run, /::error::provider must match/, 'the gate must fail loudly');
  // the gate precedes BOTH the ssh splice and the derived key-guard grep
  const gate = run.indexOf('NEW_PROVIDER" =~');
  assert.ok(gate < run.indexOf('ssh prod'), 'gate must run before the remote shell splice');
  assert.ok(gate < run.indexOf('_API_KEY='), 'gate must run before the derived key-guard grep');
  // the key guard must derive its pattern from the validated name only
  assert.match(run, /grep -qE "\^\$\{NEW_PROVIDER\^\^\}_API_KEY=\.\+"/);
  // defence in depth: the Configure ssh whitelist loop covers it too
  const ssh = steps.find((s) => (s.name || '') === 'Configure ssh');
  assert.match(ssh.run, /for v in APP_DIR PARENT_REF UI_REF SERVICE NEW_PROVIDER; do/);
  assert.equal(ssh.env.NEW_PROVIDER, '${{ inputs.provider }}', 'Configure ssh must receive the provider input');
});

test('deploy hermes mode: journal/unit output is case-insensitively filtered and value-masked', () => {
  const hermes = stepRun('deploy.yml', 'deploy', 'Hermes');
  // (а) the old case-sensitive filter is gone — it let api_key=… / ApiKey=… through
  assert.doesNotMatch(hermes, /grep -vE "Key\|TOKEN\|SECRET\|PASSWORD"/, 'case-sensitive filter must go');
  // the replacement is case-insensitive and covers the api_key family
  assert.match(hermes, /grep -viE '\(api\[_-\]\?key\|token\|secret\|password\|authorization\)'/);
  // (б) values after '=' are masked and lines truncated — one shared redact() helper
  assert.match(hermes, /sed -E 's\/\(=\[\^ \]\{4\}\)\[\^ \]\*\/\\1…\/g; s\/\(\.\{80\}\)\.\*\/\\1…\/'/);
  // every public sink in the step pipes through it
  assert.match(hermes, /printf '%s\\n' "\$unit" \| redact/, 'unit-file dump unfiltered');
  assert.match(hermes, /echo "journal unreadable"; \} \| redact/, 'hermes-gateway journal unfiltered');
  assert.match(hermes, /journalctl -u claude-bridge -n 15[^\n]*\| redact \| tail -8/, 'claude-bridge journal unfiltered');
});

test('deploy hermes mode: HERMES_BASE_URL masks the query string like recon does', () => {
  const hermes = stepRun('deploy.yml', 'deploy', 'Hermes');
  // the app-view line carries both masks: basic-auth creds AND a ?token=… query
  assert.match(
    hermes,
    /sed -E 's#:\/\/\[\^\/@\]\+@#:\/\/…@#; s#\[\?\]\.\*\$#\?…#'/,
    'the hermes BASE_URL line must mask basic-auth and the query string',
  );
});
