/**
 * CSS test helper (v1.131.2).
 *
 * `app.css` was split into ordered concern stylesheets — `app.css`,
 * `components.css`, `overlays.css`, `map.css` — to satisfy the < 800-LOC file-size
 * contract (no bundler; they load as ordered `<link>`s in index.html, and
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

/** The app stylesheets, in index.html `<link>` (cascade) order. tokens-v3.css
 *  joined LAST (v3 design phase 2): app.css token values are now `var(--cv3-*)`
 *  indirections, so any test that resolves token values needs the sheet in the
 *  concatenation — same reason it loads last for the browser cascade. */
export const APP_CSS_FILES = ['app.css', 'components.css', 'overlays.css', 'map.css', 'tokens-v3.css'];

/** Concatenated CSS of all app stylesheets, in load order. */
export function loadAppCss() {
  return APP_CSS_FILES.map((f) => readFileSync(resolve(CSS_DIR, f), 'utf8')).join('\n');
}
