/**
 * FIX-9 / D-2 (v1.168.0) — WCAG 2.5.8 Target Size (Minimum). A <label> wrapping
 * a checkbox/radio is the clickable target; native/18px boxes left the row band
 * ~22px, 2px under the 24px floor, on #/scan, #/config, #/evaluate, #/cv-studio.
 * A scoped `:has()` rule now guarantees a ≥24px band (min-height only, so the
 * already-flex labels only grow and nothing shifts).
 *
 * CSS-static assertion (same approach as help-hint-target-size/dark-theme).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSS = readFileSync(resolve(ROOT, 'public', 'css', 'app.css'), 'utf8');

test('D-2: a checkbox/radio-wrapping label guarantees a ≥24px target band', () => {
  // The rule selects labels that :has() a direct checkbox/radio child…
  const rule = CSS.match(
    /label:has\(>\s*input\[type="checkbox"\]\)\s*,\s*\n?\s*label:has\(>\s*input\[type="radio"\]\)\s*\{[\s\S]*?\}/,
  );
  assert.ok(rule, 'the checkbox/radio label target-size rule must exist');
  const px = rule[0].match(/min-height:\s*(\d+)px/);
  assert.ok(px, 'the rule sets a min-height');
  assert.ok(Number(px[1]) >= 24, `min-height must be ≥24px, got ${px[1]}`);
});
