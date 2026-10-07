/**
 * What the remote QA scripts visit, and where they may send credentials.
 * Pure helpers shared by prod-regression.mjs / prod-llm.mjs, tested in
 * tests/ci-remote-qa-routes.test.mjs.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Hash routes registered in the given view sources. Two shapes exist:
 * literal `register('name', …)`, and mode-page.js's config loop
 * `Router.register(cfg.slug, …)` over `{ slug: '…' }` entries — the second
 * used to be invisible to a literal-only scan, so 8 routes were never visited.
 */
export function routesFromSources(sources) {
  const out = new Set();
  for (const src of sources) {
    for (const m of src.matchAll(/register\('([a-z0-9_-]+)'/g)) out.add(m[1]);
    if (/register\(\s*\w+\.slug\b/.test(src)) {
      for (const m of src.matchAll(/\bslug:\s*'([a-z0-9_-]+)'/g)) out.add(m[1]);
    }
  }
  out.delete('__not_found__');
  return [...out].sort();
}

/** Routes of the SPA checked out at `root` (public/js, recursively). */
export function discoverRoutes(root) {
  const dir = resolve(root, 'public/js');
  const files = readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('.js'));
  return routesFromSources(files.map((f) => readFileSync(resolve(dir, String(f)), 'utf8')));
}

/** UI locales with a dictionary file, optionally narrowed to `only`. */
export function discoverLocales(root, only = []) {
  return readdirSync(resolve(root, 'public/js/lib/locales'))
    .map((f) => f.match(/^i18n-dict\.([A-Za-z-]+)\.js$/)?.[1])
    .filter((l) => l && l !== 'aliases')
    .filter((l) => !only.length || only.includes(l))
    .sort();
}

/** An empty target list must fail the run, never report "No findings." */
export function requireNonEmpty(what, list) {
  if (!list.length) throw new Error(`no ${what} to check — refusing to report a vacuous pass`);
  return list;
}

/**
 * Playwright basic-auth credentials, pinned to the BASE_URL origin: without
 * `origin` they are offered to any host that answers 401 (a redirect, a
 * third-party asset), and `send: 'unauthorized'` keeps them off requests that
 * do not ask.
 */
export function httpCredentialsFor(baseUrl, user, pass) {
  if (!user) return undefined;
  let origin;
  try { origin = new URL(baseUrl).origin; } catch { throw new Error('BASE_URL is not a valid URL'); }
  return { username: user, password: pass || '', origin, send: 'unauthorized' };
}
