/**
 * Minimal .env loader. Zero dependencies (we promise express + js-yaml only),
 * good enough for KEY=value, KEY="quoted value", # comments, blank lines,
 * `export KEY=…` — see parseEnvLine for the exact (dotenv-compatible) rules.
 * Existing process.env values win — env vars set on the command line aren't
 * silently shadowed by the file.
 *
 * The error messages in scanner code already point users at .env (e.g.
 * "set HH_USER_AGENT in .env or run from a Russian IP"); this module
 * makes that hint actually work.
 */
import { readFileSync, existsSync } from 'node:fs';

export function loadEnvFile(path) {
  if (!path || !existsSync(path)) return { loaded: 0 };
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return { loaded: 0 };
  }
  let loaded = 0;
  for (const raw of text.split(/\r?\n/)) {
    const entry = parseEnvLine(raw);
    if (entry && process.env[entry.key] === undefined) {
      process.env[entry.key] = entry.value;
      loaded++;
    }
  }
  return { loaded };
}

/**
 * Parse one .env line the way the parent's `dotenv` package does, so the
 * web-ui and the CLI read the same file identically:
 *   - blank lines and `# …` lines → null
 *   - an optional `export ` prefix
 *   - a value wrapped in "…", '…' or `…` is taken verbatim up to its closing
 *     quote (a `\"` inside double quotes does not close it and is KEPT, as in
 *     dotenv); anything after the closing quote — e.g. `# comment` — is ignored;
 *     double-quoted values expand `\n` / `\r`
 *   - an unquoted value ends at the first `#` and is trimmed
 * Returns null for a line with no key.
 * @param {string} raw
 * @returns {{ key: string, value: string } | null}
 */
export function parseEnvLine(raw) {
  const line = String(raw ?? '').trim();
  if (!line || line.startsWith('#')) return null;
  const body = line.replace(/^export\s+/, '');
  const eq = body.indexOf('=');
  if (eq <= 0) return null;
  const key = body.slice(0, eq).trim();
  if (!key) return null;
  const rest = body.slice(eq + 1).trim();
  const q = rest[0];
  if (q === '"' || q === "'" || q === '`') {
    for (let i = 1; i < rest.length; i += 1) {
      if (q === '"' && rest[i] === '\\') { i += 1; continue; }
      if (rest[i] === q) {
        let value = rest.slice(1, i);
        if (q === '"') value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
        return { key, value };
      }
    }
    // No closing quote: dotenv falls back to the unquoted reading.
  }
  const hash = rest.indexOf('#');
  return { key, value: (hash === -1 ? rest : rest.slice(0, hash)).trim() };
}
