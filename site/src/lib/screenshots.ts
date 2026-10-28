import type { ImageMetadata } from 'astro';

// Synced from the repo's images/*.png by scripts/sync-assets.mjs (fresh v2
// captures: dashboard ×19, job-map ×19, scan/pipeline/tracker/reports EN).
const shots = import.meta.glob<{ default: ImageMetadata }>('../assets/screenshots/*.png', {
  eager: true,
});

/** Localized dashboard screenshot for a locale file key (e.g. 'en', 'ko-KR'). */
export function screenshotFor(fileKey: string): ImageMetadata {
  const key = `../assets/screenshots/dashboard-${fileKey}.png`;
  const mod = shots[key];
  if (!mod) throw new Error(`[screenshots] missing ${key} — run scripts/sync-assets.mjs`);
  return mod.default;
}

/**
 * Localized job-map screenshot (synced from images/job-map-<locale>.png by
 * scripts/sync-assets.mjs). A missing locale file falls back to the English
 * shot — the section renders in every locale, never throws.
 */
export function jobMapShotFor(fileKey: string): ImageMetadata {
  const key = `../assets/screenshots/job-map-${fileKey}.png`;
  return (shots[key] ?? shots['../assets/screenshots/job-map-en.png']).default;
}
