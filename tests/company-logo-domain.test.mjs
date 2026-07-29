/**
 * company-logo.js — the pure name→domain resolver (domainFromName) + initials.
 * Loaded in a synthetic window (same pattern as cv-diagnostics.test.mjs). The
 * IIFE only touches document/localStorage inside call-time functions, so a bare
 * {} window is enough to evaluate the module and exercise the pure logic.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const w = {};
new Function('window', readFileSync(resolve(ROOT, 'public/js/lib/company-logo.js'), 'utf8'))(w); // eslint-disable-line no-new-func
const CL = w.CompanyLogo;

test('domainFromName resolves curated overrides (brand ≠ slug)', () => {
  assert.equal(CL.domainFromName('Anthropic'), 'anthropic.com');
  assert.equal(CL.domainFromName('Hugging Face'), 'huggingface.co');
  assert.equal(CL.domainFromName('Notion'), 'notion.so');
  assert.equal(CL.domainFromName('X'), 'x.com');
  assert.equal(CL.domainFromName('Red Hat'), 'redhat.com');
});

test('domainFromName strips legal suffixes then re-checks overrides', () => {
  assert.equal(CL.domainFromName('Stripe, Inc.'), 'stripe.com');
  assert.equal(CL.domainFromName('Mistral AI'), 'mistral.ai');
});

test('domainFromName falls back to slug + .com', () => {
  assert.equal(CL.domainFromName('Acme Rockets'), 'acmerockets.com');
  assert.equal(CL.domainFromName('Contoso GmbH'), 'contoso.com');
});

test('domainFromName returns null on empty / unusable input', () => {
  assert.equal(CL.domainFromName(''), null);
  assert.equal(CL.domainFromName('   '), null);
  assert.equal(CL.domainFromName(null), null);
  assert.equal(CL.domainFromName(undefined), null);
  assert.equal(CL.domainFromName('a'), null); // slug shorter than 2 chars
});

test('initial produces 1–2 uppercase initials', () => {
  assert.equal(CL.initial('Anthropic'), 'AN');
  assert.equal(CL.initial('Hugging Face'), 'HF');
  assert.equal(CL.initial(''), '?');
});
