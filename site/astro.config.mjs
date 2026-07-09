// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Locale registry lives in src/i18n/locales.ts — keep the sitemap i18n
// map below in sync with it (checked by scripts/check-i18n.mjs).
export default defineConfig({
  site: 'https://cvstart.org',
  base: '/',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en',
          es: 'es',
          fr: 'fr',
          'pt-br': 'pt-BR',
          ko: 'ko',
          ja: 'ja',
          ru: 'ru',
          'zh-cn': 'zh-CN',
          'zh-tw': 'zh-TW',
          pl: 'pl',
          uk: 'uk',
          da: 'da',
          ar: 'ar',
          de: 'de',
          it: 'it',
          tr: 'tr',
        },
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
