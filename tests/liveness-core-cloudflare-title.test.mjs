/**
 * CAR-262 (parent-sync #8, upstream #6798) — the shared Cloudflare
 * interstitial title check on liveness-core.
 *
 * The parent moved archive-posting's Cloudflare-title recognition INTO
 * liveness-core (beside BOT_CHALLENGE_PATTERNS) so the JD fetch path can read
 * pages the same way: Cloudflare titles its own interstitials whatever the
 * site's branding in the body — "Just a moment..." for a managed challenge,
 * "Attention Required! | Cloudflare" for a block — while a site-branded
 * challenge body can run long and use none of the phrases the body patterns
 * know (#6713).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { cloudflareInterstitial } = await import('../server/lib/liveness-core.mjs');

test('the managed-challenge title is recognized', () => {
  assert.equal(cloudflareInterstitial('Just a moment...'), 'challenge page');
  assert.equal(cloudflareInterstitial('Just a moment…'), 'challenge page');
  assert.equal(cloudflareInterstitial('just a moment'), 'challenge page');
});

test('the block-page title is recognized', () => {
  assert.equal(cloudflareInterstitial('Attention Required! | Cloudflare'), 'block page');
  assert.equal(cloudflareInterstitial('Attention Required | Cloudflare'), 'block page');
  assert.equal(cloudflareInterstitial('attention required!|cloudflare'), 'block page');
});

test('whitespace is trimmed before matching', () => {
  assert.equal(cloudflareInterstitial('  Just a moment...  '), 'challenge page');
});

test('a real posting title is never refused', () => {
  assert.equal(cloudflareInterstitial('Senior Platform Engineer at Acme'), null);
  assert.equal(cloudflareInterstitial('Just a moment and then the jobs — Acme Careers'), null, 'the anchors are title-exact');
  assert.equal(cloudflareInterstitial(''), null);
  assert.equal(cloudflareInterstitial(null), null);
  assert.equal(cloudflareInterstitial(undefined), null);
});
