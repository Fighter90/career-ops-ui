#!/usr/bin/env node
/**
 * link-check.mjs — every link in the READMEs (all locales) and in the wiki.
 *
 *   WIKI_DIR=/path/to/career-ops-ui.wiki node scripts/remote-qa/link-check.mjs
 *
 * Relative links must resolve to a file in this repo (READMEs) or to a wiki
 * page (wiki). External links get a GET with a 20 s timeout; 404/410/5xx and
 * DNS/connection failures are errors, 401/403/429 are reported as "unverified"
 * (bot walls on LinkedIn, npm, etc.), not as broken.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WIKI = process.env.WIKI_DIR || '';
const SKIP_EXTERNAL = process.env.SKIP_EXTERNAL === '1';

const sources = readdirSync(ROOT).filter((f) => /^README(\.[A-Za-z-]+)?\.md$/.test(f)).map((f) => ({ file: f, abs: join(ROOT, f), kind: 'repo' }));
if (WIKI) for (const f of readdirSync(WIKI).filter((f) => f.endsWith('.md'))) sources.push({ file: 'wiki/' + f, abs: join(WIKI, f), kind: 'wiki' });
const wikiPages = WIKI ? new Set(readdirSync(WIKI).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '').toLowerCase())) : new Set();

const findings = [];
const external = new Map();
const add = (file, kind, msg) => findings.push({ file, kind, msg: String(msg).slice(0, 200) });

for (const src of sources) {
  const text = readFileSync(src.abs, 'utf8').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const targets = [
    // Balanced parentheses: wiki page names look like Home-(Español).
    ...[...text.matchAll(/\]\(\s*<?((?:[^()\s<>]|\([^()\s]*\))+)>?(?:\s+"[^"]*")?\s*\)/g)].map((m) => m[1]),
    ...[...text.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]),
  ];
  for (const wl of text.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
    const page = (wl[2] || wl[1]).trim().replace(/ /g, '-').toLowerCase();
    if (src.kind === 'wiki' && !wikiPages.has(page)) add(src.file, 'wiki-link', `[[${wl[0].slice(2, -2)}]] → no page`);
  }
  for (const raw of targets) {
    if (/^(mailto:|tel:|#|data:)/.test(raw)) continue;
    if (/^https?:\/\//.test(raw)) {
      const u = raw.replace(/#.*$/, '');
      const wikiPrefix = 'https://github.com/Fighter90/career-ops-ui/wiki/';
      if (WIKI && u.toLowerCase().startsWith(wikiPrefix.toLowerCase())) {
        const page = decodeURIComponent(u.slice(wikiPrefix.length)).toLowerCase();
        if (page && !wikiPages.has(page)) add(src.file, 'wiki-link', `${u} → no such wiki page`);
        continue;
      }
      if (!external.has(u)) external.set(u, new Set());
      external.get(u).add(src.file);
      continue;
    }
    const path = decodeURIComponent(raw.replace(/[#?].*$/, ''));
    if (!path) continue;
    if (src.kind === 'repo') {
      if (!existsSync(resolve(ROOT, path))) add(src.file, 'relative-link', `${raw} → no such file`);
    } else if (!wikiPages.has(path.replace(/\.md$/, '').toLowerCase()) && !existsSync(resolve(WIKI, path))) {
      add(src.file, 'wiki-link', `${raw} → no page`);
    }
  }
}

let unverified = 0;
if (!SKIP_EXTERNAL) {
  const list = [...external.keys()];
  let i = 0;
  async function worker() {
    while (i < list.length) {
      const u = list[i++];
      let status;
      try {
        const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Mozilla/5.0 (link-check; career-ops-ui)' } });
        status = r.status;
        r.body?.cancel().catch(() => {});
      } catch (e) { status = e.cause?.code || e.name; }
      const files = [...external.get(u)].slice(0, 3).join(', ');
      // 999 is LinkedIn's bot-wall status.
      if (status === 401 || status === 403 || status === 429 || status === 999) { unverified++; continue; }
      if (typeof status !== 'number' || status >= 400) add(files, 'external-link', `${status} ${u}`);
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
}

// Markdown table cell: escape backslashes first, then pipes and newlines.
const md = (v) => String(v).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
const byKind = {};
for (const f of findings) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
const lines = [
  '## Link check — READMEs + wiki', '',
  `${sources.length} files (${sources.filter((s) => s.kind === 'wiki').length} wiki pages), ${external.size} distinct external links${SKIP_EXTERNAL ? ' (not fetched)' : `, ${unverified} behind a bot wall (401/403/429, not counted as broken)`}.`, '',
  findings.length ? '| kind | count |\n|---|---|\n' + Object.entries(byKind).map(([k, n]) => `| ${k} | ${n} |`).join('\n') : '**No broken links.**', '',
];
if (findings.length) {
  lines.push('| file | kind | detail |', '|---|---|---|');
  for (const f of findings.slice(0, 300)) lines.push(`| ${md(f.file)} | ${md(f.kind)} | ${md(f.msg)} |`);
}
const out = lines.join('\n');
console.log(out);
process.exit(findings.length ? 1 : 0);
