/**
 * Hero video underlay — cvstart.org landing hero (aixle-style bg video).
 *
 * The hero gains a muted looping background video (self-hosted, no hotlinking)
 * under a paper-white wash overlay so the existing light palette and AA
 * contrast survive. Contract pinned here:
 *   - assets exist on disk (real MP4 + JPEG poster, self-hosted);
 *   - <video> markup carries autoplay/muted/loop/playsinline + poster,
 *     is aria-hidden and untabbable (purely decorative);
 *   - the overlay + video never trap pointer events;
 *   - the DEFAULT rendering is the static end-state (poster): the video only
 *     displays inside `@media (min-width: 640px) and
 *     (prefers-reduced-motion: no-preference)` — mobile and reduce-motion
 *     users get the poster + overlay, never the video;
 *   - the video cross-fades in (its own animation is gated the same way);
 *   - NO new palette hues: the hero-video CSS uses only rgba(255,255,255,α)
 *     washes + the existing var(--color-paper) token, and the @theme token
 *     hex set is byte-identical to the pinned baseline;
 *   - scroll-reveal below the hero stays on the pre-existing .reveal/.in
 *     IntersectionObserver system (site.js) — no parallel reveal machinery.
 *
 * Source-assert style (site/src/** + site/public/assets/**) — no network,
 * no build, Node 18 compatible (plain fs reads), CI-isolated.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE = resolve(ROOT, 'site');

const VIDEO = resolve(SITE, 'public/assets/hero-swarm.mp4');
const POSTER = resolve(SITE, 'public/assets/hero-poster.jpg');
const HERO_SRC = readFileSync(resolve(SITE, 'src/components/Hero.astro'), 'utf8');
const CSS_SRC = readFileSync(resolve(SITE, 'src/styles/global.css'), 'utf8');
const SITEJS = readFileSync(resolve(SITE, 'src/scripts/site.js'), 'utf8');

/* ------------------------------------------------------------------ assets */

test('hero video + poster are self-hosted real media files on disk', () => {
  assert.ok(existsSync(VIDEO), 'site/public/assets/hero-swarm.mp4 must exist (no third-party hotlinking)');
  assert.ok(existsSync(POSTER), 'site/public/assets/hero-poster.jpg must exist (fallback for mobile/reduced-motion)');
  const vb = statSync(VIDEO).size;
  const pb = statSync(POSTER).size;
  assert.ok(vb > 100 * 1024, `video must be a real asset, got ${vb} bytes`);
  assert.ok(vb < 8 * 1024 * 1024, `video should stay under the 8MB budget, got ${vb} bytes`);
  assert.ok(pb > 10 * 1024, `poster must be a real image, got ${pb} bytes`);
  // magic bytes: MP4 box 'ftyp' at offset 4, JPEG SOI FFD8
  const vBuf = readFileSync(VIDEO);
  assert.equal(vBuf.subarray(4, 8).toString('latin1'), 'ftyp', 'hero-swarm.mp4 is not a real MP4');
  const pBuf = readFileSync(POSTER);
  assert.equal(pBuf[0], 0xff, 'hero-poster.jpg is not a real JPEG');
  assert.equal(pBuf[1], 0xd8, 'hero-poster.jpg is not a real JPEG');
});

/* ------------------------------------------------------------------ markup */

const VIDEO_TAG = HERO_SRC.match(/<video\b[^>]*>/);
const videoAttrs = VIDEO_TAG ? VIDEO_TAG[0] : '';

test('hero <video> underlay: autoplay muted loop playsinline + poster, decorative', () => {
  assert.ok(VIDEO_TAG, 'Hero.astro must contain a <video> element');
  for (const attr of ['autoplay', 'muted', 'loop', 'playsinline']) {
    assert.ok(
      new RegExp(`\\b${attr}\\b`).test(videoAttrs),
      `<video> must carry ${attr} (bg-video autoplay contract)`
    );
  }
  assert.ok(/poster="\/assets\/hero-poster\.jpg"/.test(videoAttrs), '<video> must reference the local poster');
  assert.match(videoAttrs, /aria-hidden="true"/, 'video is purely decorative');
  assert.match(videoAttrs, /tabindex="-1"/, 'video must be removed from tab order');
  assert.match(HERO_SRC, /\/assets\/hero-swarm\.mp4/, 'video source must be the self-hosted asset');
});

test('hero media layer + overlay: poster fallback behind, wash above, no pointer traps', () => {
  assert.match(HERO_SRC, /class="[^"]*hero-media/, 'a .hero-media absolute layer must wrap video+overlay');
  assert.match(HERO_SRC, /hero-video-overlay/, 'overlay div must exist above the video');
  // stacking: .hero-media must precede the content container in the section
  const mediaIdx = HERO_SRC.indexOf('hero-media');
  const contentIdx = HERO_SRC.indexOf('container-site');
  assert.ok(mediaIdx > -1 && contentIdx > mediaIdx, 'media layer must render before (under) the hero content');
  // pointer-events: none — video and overlay never trap clicks
  const mediaCss = CSS_SRC.match(/\.hero-media\s*\{[^}]*\}/)?.[0] || '';
  assert.match(mediaCss, /pointer-events:\s*none/, '.hero-media (video+overlay) must be pointer-events:none');
});

/* ------------------------------------------------------------------- CSS */

test('default rendering is the static poster; video only displays on ≥640px + motion-ok', () => {
  // base rule: video hidden, poster background visible on the media layer
  const videoBase = CSS_SRC.match(/\.hero-video\s*\{[^}]*\}/)?.[0] || '';
  assert.match(videoBase, /display:\s*none/, 'the <video> must be display:none by default (static end-state)');
  const mediaBase = CSS_SRC.match(/\.hero-media\s*\{[^}]*\}/)?.[0] || '';
  assert.match(mediaBase, /background-image:\s*url\(['"]?\/assets\/hero-poster\.jpg/, 'poster must be the media layer background');
  assert.match(mediaBase, /background-size:\s*cover/, 'poster must cover the hero');
  // opt-IN rule for the moving video
  const gate = CSS_SRC.indexOf('@media (min-width: 640px) and (prefers-reduced-motion: no-preference)');
  assert.ok(gate > -1, 'a (min-width: 640px) + (prefers-reduced-motion: no-preference) gate must exist');
  const gateBody = CSS_SRC.slice(gate, CSS_SRC.indexOf('}', CSS_SRC.indexOf('.hero-video', gate)));
  assert.match(gateBody, /display:\s*block/, 'inside the gate the video must display:block');
});

test('video cross-fade animation exists and lives inside the motion-ok gate', () => {
  assert.match(CSS_SRC, /@keyframes hero-video-in/, 'video fade-in keyframes must exist');
  const gateStart = CSS_SRC.indexOf('@media (min-width: 640px) and (prefers-reduced-motion: no-preference)');
  const gateEnd = CSS_SRC.indexOf('\n}', CSS_SRC.indexOf('@keyframes hero-video-in', gateStart));
  const gateBody = CSS_SRC.slice(gateStart, gateEnd);
  assert.match(gateBody, /animation:[^;]*hero-video-in/, 'the fade-in must be applied inside the gate only');
});

test('overlay recipe: paper-white wash, vertical melt into the next section, no new hues', () => {
  const overlayCss = CSS_SRC.match(/\.hero-video-overlay\s*\{[^}]*\}/)?.[0] || '';
  assert.ok(overlayCss, '.hero-video-overlay rule must exist');
  assert.match(overlayCss, /linear-gradient\(/, 'overlay must be a gradient wash');
  assert.match(overlayCss, /var\(--color-paper\)/, 'overlay must melt into the existing paper token');
  // every rgba in the overlay is the paper channels (255,255,255) — no new hue
  for (const m of overlayCss.matchAll(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
    assert.equal(`${m[1]},${m[2]},${m[3]}`, '255,255,255', 'overlay wash must only use paper-white rgba channels');
  }
  assert.doesNotMatch(overlayCss, /#[0-9a-fA-F]{3,8}\b/, 'overlay must not introduce raw hex colors');
});

test('palette untouched: @theme token hex set is byte-identical to the baseline', () => {
  const BASELINE = {
    '--color-ink': '#222222',
    '--color-ink-soft': '#6a6a6a',
    '--color-ink-faint': '#b0b0b0',
    '--color-paper': '#ffffff',
    '--color-paper-alt': '#f7f7f7',
    '--color-line': '#ebebeb',
    '--color-line-strong': '#dddddd',
    '--color-rausch': '#ff385c',
    '--color-rausch-deep': '#c41e3d',
    '--color-ok': '#008a05',
    '--color-warn': '#c13515',
    '--color-night': '#1a1a1a',
  };
  const theme = CSS_SRC.match(/@theme\s*\{[\s\S]*?\n\}/)?.[0] || '';
  for (const [token, hex] of Object.entries(BASELINE)) {
    assert.match(theme, new RegExp(`${token.replace(/-/g, '\\-')}:\\s*${hex.replace('#', '#')}[;,]`), `${token} must stay ${hex}`);
  }
});

/* ------------------------------------------- animation requirements (req 4) */

test('hero entrance stagger + scroll-reveal: pre-existing system still wired', () => {
  // entrance: hero-seq stagger (0/80/160ms) — gated by html.js + reduce-motion opt-out
  assert.match(CSS_SRC, /hero-seq-2[^{]*\{[^}]*80ms/, 'hero stagger must keep its 80ms step');
  assert.match(CSS_SRC, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?hero-seq[\s\S]*?animation:\s*none/, 'reduce-motion must disable the stagger');
  // scroll reveal: .reveal → .in via IntersectionObserver in site.js (one-shot)
  assert.match(CSS_SRC, /html\.js \.reveal\.in/, 'reveal-on-scroll CSS contract intact');
  assert.match(SITEJS, /IntersectionObserver/, 'site.js must keep the IntersectionObserver reveal');
  assert.match(SITEJS, /querySelectorAll\('\.reveal/, 'site.js must keep observing .reveal');
});
