import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * The help collection is populated by scripts/sync-assets.mjs from the
 * repo's canonical docs/help/<locale>.md guides. Never edit files in
 * src/content/help/ by hand — they are overwritten on every build.
 */
const help = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/help' }),
  schema: z.object({}).passthrough(),
});

/**
 * The changelog collection is populated the same way from the repo's
 * CHANGELOG.md (en) + CHANGELOG.<locale>.md files. Never edit by hand.
 */
const changelog = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/changelog' }),
  schema: z.object({}).passthrough(),
});

export const collections = { help, changelog };
