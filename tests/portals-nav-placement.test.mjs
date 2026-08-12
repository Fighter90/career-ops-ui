/**
 * #/portals lives under the Setup (settings) nav group (v1.149.0, Phase 4).
 *
 * v1.144.0 turned #/portals into a settings surface (enable/disable tracked
 * companies + an ATS health probe), so the roadmap moved it out of "Sourcing"
 * and into the "Setup" group next to App settings. This source-static canary
 * locks that placement so a future nav edit can't silently drift it back.
 *
 * CI-isolated: reads only public/index.html, no parent dependency, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(ROOT, 'public/index.html'), 'utf8');

test('#/portals nav item sits in the Setup group, after App settings', () => {
  const iSourcing = html.indexOf('nav.group.sourcing');
  const iSetup = html.indexOf('nav.group.setup');
  const iConfig = html.indexOf('data-route="config"');
  const iPortals = html.indexOf('data-route="portals"');
  assert.ok(iSourcing >= 0 && iSetup >= 0 && iConfig >= 0 && iPortals >= 0, 'all nav anchors present');
  assert.ok(iSourcing < iSetup, 'Sourcing group precedes Setup group');
  // Portals is inside the Setup group (after its header) and after App settings.
  assert.ok(iPortals > iSetup, '#/portals is under the Setup group');
  assert.ok(iPortals > iConfig, '#/portals follows App settings (config)');
});

test('#/portals is no longer inside the Sourcing group', () => {
  const iSourcing = html.indexOf('nav.group.sourcing');
  const iDecision = html.indexOf('nav.group.decision'); // the group right after Sourcing
  assert.ok(iSourcing >= 0 && iDecision > iSourcing, 'Sourcing then Decision groups exist');
  const sourcingBlock = html.slice(iSourcing, iDecision);
  assert.doesNotMatch(sourcingBlock, /data-route="portals"/, 'Sourcing group must not contain #/portals');
});
