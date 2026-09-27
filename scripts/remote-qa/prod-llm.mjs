#!/usr/bin/env node
/**
 * prod-llm.mjs — live LLM regression of a DEPLOYED web-ui, in every UI locale.
 *
 *   BASE_URL=https://<prod-host> BASIC_USER=… BASIC_PASS=… node scripts/remote-qa/prod-llm.mjs
 *
 * First one real scan via #/scan (SCAN=0 skips it). Then, per locale, driven
 * through the UI exactly as a user would:
 *   1. #/docs-assistant — click the first suggested question (already in that
 *      language) → POST /api/docs-assistant/ask {run:true}.
 *   2. #/evaluate — paste a fixed sample JD, leave "save" unchecked, click
 *      Evaluate → POST /api/evaluate {save:false}.
 * Each answer must come from a live provider (not manual mode), be non-trivial,
 * be written in the locale's language, and the evaluation must pass the
 * server's own A–G shape check (no `warnings`). The UI must render it.
 *
 * Nothing is written to the instance's data: the only POSTs allowed out of the
 * browser are those two, /api/evaluate must carry save:false, and every other
 * non-GET /api call and /api/stream/* is aborted. (The server's usage counter
 * does tick — that is what a real run does.) LLM calls are paced under the
 * server's 10/min limit and a 429 is waited out once.
 *
 * Output: locale, provider, timings, lengths, verdicts. Never answer text —
 * evaluations quote the CV and this log is public.
 */
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { makeRedactor } from './redact.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(ROOT + '/package.json');
const { chromium } = require('playwright');

const BASE = (process.env.BASE_URL || '').replace(/\/+$/, '');
if (!BASE) { console.error('BASE_URL is required'); process.exit(2); }
const httpCredentials = process.env.BASIC_USER ? { username: process.env.BASIC_USER, password: process.env.BASIC_PASS || '' } : undefined;
const ONLY = (process.env.LOCALES || '').split(',').filter(Boolean);
const LOCALES = readdirSync(resolve(ROOT, 'public/js/lib/locales'))
  .map((f) => f.match(/^i18n-dict\.([A-Za-z-]+)\.js$/)?.[1]).filter((l) => l && l !== 'aliases')
  .filter((l) => !ONLY.length || ONLY.includes(l)).sort();

const SAMPLE_JD = `Senior Platform Engineer — Example Corp (remote, EU)
We are looking for a Senior Platform Engineer to own our Kubernetes-based internal
developer platform. You will design CI/CD pipelines, run AWS infrastructure with
Terraform, improve observability (Prometheus, Grafana, OpenTelemetry) and mentor
engineers. Requirements: 5+ years in SRE/platform roles, strong Go or Python,
Kubernetes in production, infrastructure as code, on-call experience. Nice to have:
service mesh, cost optimisation, PostgreSQL operations. Salary 90–120k EUR.`;

// ── language check ────────────────────────────────────────────────────────────
const SCRIPT = {
  ar: /[\u0600-\u06FF]/g, hi: /[\u0900-\u097F]/g, ja: /[\u3040-\u30FF]/g, ko: /[\uAC00-\uD7AF]/g,
  'zh-CN': /[\u4E00-\u9FFF]/g, 'zh-TW': /[\u4E00-\u9FFF]/g, ru: /[\u0400-\u04FF]/g, uk: /[\u0400-\u04FF]/g,
};
const WORDS = {
  en: ['the', 'and', 'with', 'for', 'you', 'your', 'this', 'that', 'are', 'is'],
  es: ['el', 'la', 'de', 'que', 'y', 'con', 'para', 'los', 'las', 'una'],
  fr: ['le', 'la', 'les', 'de', 'des', 'et', 'pour', 'avec', 'une', 'est'],
  'pt-BR': ['de', 'que', 'com', 'para', 'uma', 'não', 'os', 'as', 'do', 'da'],
  pl: ['i', 'w', 'na', 'się', 'nie', 'z', 'do', 'jest', 'to', 'dla'],
  de: ['der', 'die', 'das', 'und', 'mit', 'für', 'ist', 'nicht', 'ein', 'eine'],
  it: ['il', 'la', 'di', 'che', 'e', 'per', 'con', 'una', 'non', 'del'],
  tr: ['ve', 'bir', 'bu', 'için', 'ile', 'olarak', 'daha', 'de', 'da', 'değil'],
  da: ['og', 'at', 'det', 'en', 'til', 'med', 'for', 'er', 'ikke', 'af'],
};
function languageOk(text, locale) {
  const t = String(text || '');
  if (locale === 'ja') {
    // Japanese technical prose is mostly kanji plus Latin terms; kana alone can
    // fall under 30 %. Require some kana (not Chinese) and a CJK majority.
    const letters = (t.match(/\p{L}/gu) || []).length || 1;
    const kana = (t.match(/[\u3040-\u30FF]/g) || []).length;
    const han = (t.match(/[\u4E00-\u9FFF]/g) || []).length;
    return kana / letters > 0.05 && (kana + han) / letters > 0.3;
  }
  if (SCRIPT[locale]) {
    const letters = (t.match(/\p{L}/gu) || []).length || 1;
    const own = (t.match(SCRIPT[locale]) || []).length;
    if (locale === 'uk' && !/[іїєґ]/i.test(t)) return false; // Ukrainian, not Russian
    if (locale === 'ru' && /[іїєґ]/i.test(t) && !/[ыэъё]/i.test(t)) return false;
    return own / letters > 0.3; // tech terms (Kubernetes, AWS) stay Latin
  }
  const words = t.toLowerCase().match(/\p{L}+/gu) || [];
  const hits = (list) => words.filter((w) => list.includes(w)).length;
  const mine = hits(WORDS[locale] || WORDS.en);
  if (locale === 'en') return mine >= 5;
  return mine >= 5 && mine >= hits(WORDS.en);
}

// ── run ───────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const rows = [];
const findings = [];
// Redact the prod host before truncating: a cut mid-host would dodge the secret mask.
const redact = makeRedactor(BASE);
const add = (locale, step, msg) => findings.push({ locale, step, msg: redact(msg).slice(0, 160) });
let lastLlm = 0;
async function pace() {
  const wait = lastLlm + 7000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastLlm = Date.now();
}

async function llmStep(page, locale, step, path, trigger) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await pace();
    const t0 = Date.now();
    const [resp] = await Promise.all([
      page.waitForResponse((r) => new URL(r.url()).pathname === path && r.request().method() === 'POST', { timeout: 300_000 }),
      trigger(),
    ]);
    const ms = Date.now() - t0;
    let body = {};
    try { body = await resp.json(); } catch { /* non-JSON */ }
    if (resp.status() === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, (Number(body.retryAfter) || 60) * 1000 + 1000));
      continue;
    }
    return { status: resp.status(), ms, body };
  }
  return { status: 429, ms: 0, body: {} };
}

// ── 0. one real scan through #/scan (the same run the hourly timer does) ──────
let scan = null;
if (process.env.SCAN !== '0') {
  const ctx = await browser.newContext({ httpCredentials, viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('career-ops-ui:lang', 'en'); } catch {} });
  const page = await ctx.newPage();
  const blocked = [];
  await page.route('**/api/**', (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === 'GET') return route.continue(); // includes /api/stream/scan
    blocked.push(`${req.method()} ${path}`);
    return route.abort('blockedbyclient');
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(`${BASE}/#/scan`, { waitUntil: 'domcontentloaded' });
    const btn = page.locator('.scan-run-btn');
    await btn.waitFor({ timeout: 20000 });
    const before = await page.locator('#scan-results table tbody tr').count().catch(() => 0);
    const t0 = Date.now();
    await btn.click();
    await page.waitForFunction(() => document.querySelector('.scan-run-btn')?.getAttribute('aria-busy') === 'true', null, { timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('.scan-run-btn')?.getAttribute('aria-busy') === 'false', null, { timeout: 40 * 60_000, polling: 2000 });
    await page.waitForTimeout(3000);
    const text = await page.locator('#scan-console').innerText();
    const phases = [...text.matchAll(/✓ (ATS|Regional) done · NEW=(\d+)/g)].map((m) => `${m[1]} NEW=${m[2]}`);
    const failed = [...text.matchAll(/✗ (\w+) error/g)].map((m) => m[1]);
    const errLines = await page.locator('#scan-console span.err').count();
    const after = await page.locator('#scan-results table tbody tr').count().catch(() => 0);
    scan = { secs: Math.round((Date.now() - t0) / 1000), phases, failed, errLines, before, after };
    if (!phases.some((p) => p.startsWith('ATS'))) add('en', 'scan', 'ATS phase did not report done');
    if (!phases.some((p) => p.startsWith('Regional'))) add('en', 'scan', 'Regional phase did not report done');
    for (const f of failed) add('en', 'scan', `${f} phase ended in error`);
    if (after === 0) add('en', 'scan', 'results table empty after the scan');
  } catch (err) {
    add('en', 'scan', err.message.split('\n')[0]);
  }
  for (const b of blocked) add('en', 'scan-write-blocked', b);
  for (const m of errors) add('en', 'scan-js-exception', m);
  await ctx.close();
}

for (const locale of LOCALES) {
  const ctx = await browser.newContext({ httpCredentials, viewport: { width: 1366, height: 900 }, locale });
  await ctx.addInitScript((l) => { try { localStorage.setItem('career-ops-ui:lang', l); } catch {} }, locale);
  const page = await ctx.newPage();
  const blocked = [];
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === 'GET' && !path.startsWith('/api/stream/')) return route.continue();
    if (req.method() === 'POST' && path === '/api/docs-assistant/ask') return route.continue();
    if (req.method() === 'POST' && path === '/api/evaluate') {
      let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch {}
      if (b.save === false) return route.continue();
      blocked.push('POST /api/evaluate with save=' + b.save);
      return route.abort('blockedbyclient');
    }
    blocked.push(`${req.method()} ${path}`);
    return route.abort('blockedbyclient');
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const row = { locale };
  try {
    // 1 — docs assistant
    await page.goto(`${BASE}/#/docs-assistant`, { waitUntil: 'domcontentloaded' });
    const chip = page.locator('main button.btn-ghost.btn-sm, #app button.btn-ghost.btn-sm').first();
    await chip.waitFor({ timeout: 20000 });
    const d = await llmStep(page, locale, 'docs', '/api/docs-assistant/ask', () => chip.click());
    const answer = d.body.answer || '';
    row.docs = { status: d.status, mode: d.body.mode, ms: d.ms, len: answer.length, lang: languageOk(answer, locale) };
    if (d.status !== 200) add(locale, 'docs', `HTTP ${d.status} ${d.body.error || ''}`);
    else if (!d.body.mode || d.body.mode === 'manual') add(locale, 'docs', `no live provider (mode=${d.body.mode})`);
    else if (answer.length < 80) add(locale, 'docs', `answer only ${answer.length} chars`);
    else if (!row.docs.lang) add(locale, 'docs', `answer not in ${locale}`);
    if (d.status === 200) {
      const rendered = await page.locator('.chat-log .md').last().innerText({ timeout: 10000 }).catch(() => '');
      if (!rendered.trim()) add(locale, 'docs', 'answer not rendered in the chat log');
    }

    // 2 — evaluate (save unchecked)
    await page.goto('about:blank');
    await page.goto(`${BASE}/#/evaluate`, { waitUntil: 'domcontentloaded' });
    await page.locator('#eval-jd').waitFor({ timeout: 20000 });
    await page.fill('#eval-jd', SAMPLE_JD);
    if (await page.isChecked('#save-jd')) await page.uncheck('#save-jd');
    const btn = page.locator('#eval-jd').locator('xpath=ancestor::*[.//button[contains(@class,"btn-primary")]][1]').locator('button.btn-primary').first();
    const e = await llmStep(page, locale, 'evaluate', '/api/evaluate', () => btn.click());
    const md = e.body.markdown || '';
    row.eval = { status: e.status, mode: e.body.mode, ms: e.ms, len: md.length, shape: !(e.body.warnings || []).length, lang: languageOk(md, locale) };
    if (e.status !== 200) add(locale, 'evaluate', `HTTP ${e.status} ${e.body.error || ''}`);
    else if (!e.body.mode || e.body.mode === 'manual') add(locale, 'evaluate', `no live provider (mode=${e.body.mode})`);
    else if (md.length < 800) add(locale, 'evaluate', `report only ${md.length} chars`);
    else {
      // The server's warnings are fixed strings ("missing Block C", "SCORE_SUMMARY ROLE is required"),
      // never report text, so they can be printed as they are.
      if (!row.eval.shape) add(locale, 'evaluate', `A–G shape: ${(e.body.warnings || []).map(String).join('; ')}`);
      if (!row.eval.lang) add(locale, 'evaluate', `report not in ${locale}`);
    }
    if (e.status === 200) {
      const shown = await page.locator('#eval-out').innerText({ timeout: 15000 }).catch(() => '');
      if (shown.trim().length < 200) add(locale, 'evaluate', 'report not rendered in #eval-out');
    }
  } catch (err) {
    add(locale, 'crash', err.message.split('\n')[0]);
  }
  for (const b of blocked) add(locale, 'write-blocked', b);
  for (const m of errors) add(locale, 'js-exception', m);
  rows.push(row);
  await ctx.close();
}
await browser.close();

const md = (v) => String(v).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
const cell = (x) => (x ? `${x.status} · ${x.mode || '-'} · ${Math.round(x.ms / 1000)}s · ${x.len} ch · ${x.lang ? 'lang ✓' : 'lang ✗'}${'shape' in x ? (x.shape ? ' · A–G ✓' : ' · A–G ✗') : ''}` : '—');
const lines = [
  '## Live LLM regression', '',
  scan ? `**Scan (#/scan, all sources):** ${scan.secs}s · ${scan.phases.join(' · ') || 'no phase finished'}${scan.failed.length ? ' · failed: ' + scan.failed.join(',') : ''} · stderr lines ${scan.errLines} · result rows ${scan.before} → ${scan.after}` : '_Scan skipped (SCAN=0)._', '',
  `${rows.length} locales × (docs assistant + evaluate, driven through the UI).`, '',
  '| locale | docs assistant | evaluate (save=false) |', '|---|---|---|',
  ...rows.map((r) => `| ${md(r.locale)} | ${md(cell(r.docs))} | ${md(cell(r.eval))} |`), '',
  findings.length ? '| locale | step | finding |\n|---|---|---|\n' + findings.map((f) => `| ${md(f.locale)} | ${md(f.step)} | ${md(f.msg)} |`).join('\n') : '**No findings.**',
];
console.log(redact(lines.join('\n')));
process.exit(findings.length ? 1 : 0);
