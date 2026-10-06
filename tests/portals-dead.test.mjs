/**
 * FIX-C3 — guard against the 9 dead portal slugs (Ada, Factorial,
 * Tinybird, Weights & Biases, Travelperk, Clarity AI, Forto, Vinted,
 * Runway) silently flipping back to enabled:true in a future PR.
 *
 * If a slug genuinely comes back to life, REMOVE it from this list AND
 * verify the URL responds < 400 first.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
// We test the SHIPPED template (templates/portals.example.yml) because the
// runtime portals.yml is gitignored user data — its state varies per user.
// Anyone cloning fresh gets the template's defaults, so disabling the dead
// slugs there is what actually fixes the bug for new installs.
const PORTALS = resolve(__dirname, '..', '..', 'templates', 'portals.example.yml');

const KNOWN_DEAD = [
  'Ada', 'Factorial', 'Tinybird', 'Weights & Biases',
  'Travelperk', 'Clarity AI', 'Forto', 'Vinted', 'Runway',
];

test('parent portals.yml exists (skipped on standalone web-ui CI)', { skip: !existsSync(PORTALS) }, () => {
  // When web-ui is checked out without the parent project alongside,
  // there is no template to inspect — that's fine, the script and
  // KNOWN_DEAD list are still committed. Skip rather than fail.
  assert.ok(existsSync(PORTALS), `expected ${PORTALS}`);
});

test('FIX-C3: known-dead slugs drift warning (never blocks release)', (t) => {
  if (!existsSync(PORTALS)) {
    // Parent isn't checked out alongside web-ui (e.g. standalone CI of
    // career-ops-ui). Report a skip — not a silent pass.
    t.skip('parent templates/portals.example.yml not present');
    return;
  }
  // v1.12.0 — was assertion, now a warning. Rationale: the parent's
  // `templates/portals.example.yml` is owned by the upstream maintainer,
  // not by web-ui. If they re-enable a slug we flagged as dead, it's
  // their call — releasing should not be blocked. We surface a warning
  // via stderr so it's visible in CI output and developers can decide
  // whether to (a) remove from KNOWN_DEAD here, or (b) open a PR
  // upstream to disable. Either way: not a release blocker.
  const portals = yaml.load(readFileSync(PORTALS, 'utf8')) || {};
  const tracked = portals.tracked_companies || portals.companies || [];
  // The one thing this test DOES assert: the template still has the shape
  // the drift check reads. A renamed key would otherwise turn the whole
  // check into a silent no-op.
  assert.ok(Array.isArray(tracked) && tracked.length > 0,
    'portals.example.yml must list tracked_companies for the drift check to mean anything');
  const drifted = [];
  for (const name of KNOWN_DEAD) {
    const c = tracked.find((x) => x.name === name);
    if (!c) continue;
    if (c.enabled === true) drifted.push(name);
  }
  if (drifted.length) {
    t.diagnostic(`known-dead slugs re-enabled upstream: ${drifted.join(', ')}`);
    // eslint-disable-next-line no-console
    console.warn(
      `[portals-dead drift] parent template re-enabled known-dead slugs: ${drifted.join(', ')}. ` +
      `Verify URLs manually and either remove from KNOWN_DEAD or open a PR upstream.`,
    );
  }
  // No assertion on `drifted` — the warning is the signal; release
  // decisions stay manual.
});

test('FIX-C3: portals-health-check.mjs script exists and is executable', () => {
  const path = resolve(__dirname, '..', 'scripts', 'portals-health-check.mjs');
  assert.ok(existsSync(path), 'scripts/portals-health-check.mjs missing');
  const text = readFileSync(path, 'utf8');
  assert.match(text, /^#!\/usr\/bin\/env node/);
  assert.match(text, /tracked_companies/);
  assert.match(text, /process\.exit\(/);
});
