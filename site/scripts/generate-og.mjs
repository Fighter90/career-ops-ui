#!/usr/bin/env node
/**
 * generate-og.mjs — builds public/og-default.png (1200×630) with sharp.
 * White background, repo logo + wordmark, tagline, and the angled EN
 * dashboard screenshot. All assets come from this repo (synced copies).
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(SITE, 'public', 'og-default.png');
const LOGO = join(SITE, 'src', 'assets', 'logo', 'apple-touch-icon.png');
const SHOT = join(SITE, 'src', 'assets', 'screenshots', 'dashboard-en.png');

if (!existsSync(LOGO) || !existsSync(SHOT)) {
  console.error('[og] run scripts/sync-assets.mjs first');
  process.exit(1);
}

const W = 1200;
const H = 630;

// 1. Screenshot: resize, round corners, rotate slightly.
const shotW = 640;
const shotRaw = await sharp(SHOT).resize({ width: shotW }).png().toBuffer();
const shotMeta = await sharp(shotRaw).metadata();
const rounded = Buffer.from(
  `<svg width="${shotMeta.width}" height="${shotMeta.height}"><rect x="0" y="0" width="${shotMeta.width}" height="${shotMeta.height}" rx="14" ry="14"/></svg>`
);
const shotRoundedBuf = await sharp(shotRaw)
  .composite([{ input: rounded, blend: 'dest-in' }])
  .png()
  .toBuffer();
const shotAngled = await sharp(shotRoundedBuf)
  .rotate(-4, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

// 2. Base canvas with text (system sans in CI is fine for an OG card).
const baseSvg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect width="${W}" height="8" y="${H - 8}" fill="#FF385C"/>
  <text x="72" y="248" font-family="Figtree, Helvetica, Arial, sans-serif" font-size="58" font-weight="800" fill="#222222">career-ops-ui</text>
  <text x="72" y="316" font-family="Figtree, Helvetica, Arial, sans-serif" font-size="30" font-weight="600" fill="#C41E3D">Free · Open source · Local-first job search</text>
  <text x="72" y="372" font-family="Figtree, Helvetica, Arial, sans-serif" font-size="24" fill="#6A6A6A">Scan job boards · AI fit scores · tailored CVs · tracker</text>
  <text x="72" y="560" font-family="Figtree, Helvetica, Arial, sans-serif" font-size="22" font-weight="600" fill="#222222">cvstart.org</text>
  <text x="72" y="592" font-family="Figtree, Helvetica, Arial, sans-serif" font-size="18" fill="#B0B0B0">github.com/Fighter90/career-ops-ui</text>
</svg>`;

const logo = await sharp(readFileSync(LOGO)).resize(96, 96).png().toBuffer();
const shotFinalMeta = await sharp(shotAngled).metadata();

await sharp(Buffer.from(baseSvg))
  .composite([
    { input: logo, left: 72, top: 96 },
    {
      input: shotAngled,
      left: W - shotFinalMeta.width + 120,
      top: Math.round((H - shotFinalMeta.height) / 2) + 30,
    },
  ])
  .png({ compressionLevel: 9 })
  .toFile(OUT);

console.log(`[og] wrote ${OUT}`);
