import type { ImageMetadata } from 'astro';

// Synced from the repo's images/dashboard-<locale>.png by scripts/sync-assets.mjs.
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
