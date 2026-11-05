/**
 * P3.4 (CAR-132 tail) — the cvstart.org fixed-header backdrop contract.
 *
 * The site header is position:fixed over the page; when scrolled it paints a
 * translucent rgba fill. Without a backdrop-filter that fill reads as a flat
 * color slab with page content bleeding through it. The contract:
 *
 *   1. The scrolled header carries BOTH the standard and the Safari-prefixed
 *      backdrop-filter, and both are `saturate(1.4) blur(10px)` — the
 *      saturate bump keeps the page color alive behind the frosted glass.
 *   2. Browsers without backdrop-filter fall back to an opaque header
 *      (@supports not block) — the translucent fill alone would show content
 *      through the chrome.
 *   3. prefers-reduced-transparency users get the solid header, no blur.
 *   4. The header markup actually opts into the contract (.site-header on
 *      the fixed <header> in Header.astro).
 *
 * CI-isolated: reads site source files only; no server / network / browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(__dirname, '..', 'site');

const css = readFileSync(resolve(SITE, 'src', 'styles', 'global.css'), 'utf8');
const scrolledBlock = css.match(/\.site-header\.scrolled\s*\{[^}]*\}/)?.[0] ?? '';

test('the scrolled header saturates + blurs, standard and Safari-prefixed', () => {
  assert.notEqual(scrolledBlock, '', '.site-header.scrolled block missing from global.css');
  // (?<!-) so the plain property cannot be satisfied by the -webkit- alias.
  assert.match(
    scrolledBlock,
    /(?<!-)backdrop-filter:\s*saturate\(1\.4\)\s*blur\(10px\)/,
    '.site-header.scrolled must set backdrop-filter: saturate(1.4) blur(10px)'
  );
  assert.match(
    scrolledBlock,
    /-webkit-backdrop-filter:\s*saturate\(1\.4\)\s*blur\(10px\)/,
    '.site-header.scrolled must set -webkit-backdrop-filter: saturate(1.4) blur(10px) (Safari)'
  );
});

test('no-backdrop-filter browsers fall back to an opaque header', () => {
  const fallback = css.match(/@supports not [^{]*backdrop-filter[^{]*\{\s*\.site-header\.scrolled\s*\{[^}]*\}/)?.[0] ?? '';
  assert.notEqual(fallback, '', 'the @supports-not fallback block is missing');
  assert.match(fallback, /background:\s*var\(--color-paper\)/,
    'the fallback must paint the header opaque (--color-paper), not translucent');
});

test('prefers-reduced-transparency users get the solid header, no blur', () => {
  const block = css.match(/@media \(prefers-reduced-transparency: reduce\)\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.notEqual(block, '', 'the prefers-reduced-transparency block is missing');
  assert.match(block, /backdrop-filter:\s*none/, 'reduced-transparency must disable the blur');
});

test('the fixed header markup opts into the .site-header contract', () => {
  const header = readFileSync(resolve(SITE, 'src', 'components', 'Header.astro'), 'utf8');
  assert.match(header, /<header class="site-header[^"]*fixed/, 'Header.astro must carry .site-header + fixed on the <header>');
});
