/**
 * v1.179.0 — HTML-entity decoder consolidation guard.
 *
 * Every scraping scan source used to carry its own `decodeEntities` /
 * `decodeXmlEntities` (+ a `fromCodePoint` helper). Three of those copies could
 * throw a RangeError on a malformed numeric entity (fixed v1.172.0), and the
 * rest drifted (some admitted NUL/C0, some mis-parsed `&#1a2;`). v1.179.0
 * routed all of them through the single `server/lib/html-entities.mjs`. This
 * guard fails if a source re-grows a local decoder or the bare crash pattern,
 * so the duplication can't creep back.
 *
 * hh.mjs is exempt: it keeps its own decoder because it handles two named
 * entities (`&mdash;`/`&ndash;`) the shared 6-entity module (a mirror of the
 * parent's providers/_html-entities.mjs) deliberately does not.
 *
 * CI-isolated: reads repo source files only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'lib', 'sources');
const EXEMPT = new Set(['registry.mjs', 'hh.mjs']);

const LOCAL_DECODER = /function\s+(?:decodeEntities|decodeXmlEntities|fromCodePoint)\s*\(/;
const BARE_CRASH = /Number\.isFinite\(\s*\w+\s*\)\s*\?\s*String\.fromCodePoint/;

test('no scan source keeps a local HTML-entity decoder (all route through html-entities.mjs)', () => {
  const files = readdirSync(SRC).filter((f) => f.endsWith('.mjs') && !EXEMPT.has(f));
  assert.ok(files.length >= 70, `expected the full source registry, saw ${files.length}`);
  for (const f of files) {
    const src = readFileSync(resolve(SRC, f), 'utf8');
    assert.doesNotMatch(src, LOCAL_DECODER, `${f} defines a local entity decoder — import from ../html-entities.mjs instead`);
    assert.doesNotMatch(src, BARE_CRASH, `${f} has the bare Number.isFinite→fromCodePoint crash pattern (parent #2150)`);
    if (/decode(?:Xml)?Entities\(/.test(src)) {
      assert.match(src, /from ['"]\.\.\/html-entities\.mjs['"]/, `${f} decodes entities but does not import the shared module`);
    }
  }
});

test('the shared html-entities module is imported by every consolidated source', () => {
  // 20 consolidated in v1.179.0 + oraclecloud/gem/dassault migrated in v1.172.0.
  const CONSOLIDATED = [
    'agenticjobs', 'avature', 'deutschebahn', 'hecklerkoch', 'icims', 'radancy',
    'remotli', 'rheinmetall', 'softgarden', 'successfactors', 'rss', 'jobvite',
    'personio', 'cryptocurrencyjobs', 'higheredjobs', 'jobspresso', 'larajobs',
    'nodesk', 'teamtailor', 'weworkremotely', 'oraclecloud', 'gem', 'dassault',
  ];
  for (const name of CONSOLIDATED) {
    const src = readFileSync(resolve(SRC, `${name}.mjs`), 'utf8');
    assert.match(src, /from ['"]\.\.\/html-entities\.mjs['"]/, `${name}.mjs must import the shared decoder`);
  }
});
