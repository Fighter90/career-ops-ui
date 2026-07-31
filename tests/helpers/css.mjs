/**
 * CSS test helper (v1.131.2).
 *
 * `app.css` was split into three ordered stylesheets — `app.css`,
 * `components.css`, `overlays.css` — to satisfy the < 800-LOC file-size
 * contract (no bundler; they load as three ordered `<link>`s in index.html, and
 * the cascade is byte-for-byte identical to the pre-split file).
 *
 * Any test that asserts on a CSS rule reads the CONCATENATION via `loadAppCss()`
 * so a rule that moved between files is still found — the assertion is agnostic
 * to which physical file now holds it. Keep `APP_CSS_FILES` in sync with the
 * `<link>` order in `public/index.html`.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CSS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'css');

/** The three app stylesheets, in index.html `<link>` (cascade) order. */
export const APP_CSS_FILES = ['app.css', 'components.css', 'overlays.css'];

/** Concatenated CSS of all app stylesheets, in load order. */
export function loadAppCss() {
  return APP_CSS_FILES.map((f) => readFileSync(resolve(CSS_DIR, f), 'utf8')).join('\n');
}
