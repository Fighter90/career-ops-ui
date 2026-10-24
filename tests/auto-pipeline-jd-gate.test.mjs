/**
 * v1.248.2 — the auto-pipeline JD floor is 200 chars, not 50.
 *
 * The prod eval timer fed pipeline placeholder entries
 * (https://example.com/qa-v167-…) to the evaluation; the short model
 * answers ("Insufficient JD…") were still saved as
 * reports/<date>-t-role-<ts>.md and the dashboard showed the newest one
 * as "Last evaluation". The gate now stops BEFORE the LLM call: SSE
 * error event (never a 500), a server-console warning carrying the URL
 * and the reason, and NO report file / tracker row.
 *
 * CI-isolated: mkdtemp CAREER_OPS_ROOT, page fetch via _setTransport +
 * a DNS stub, provider HTTP mocked on global fetch, 127.0.0.1 only.
 * Without the fix the short-body run reaches the mocked provider and
 * writes a report — every assertion here goes red on the old code.
 */
import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promises as dns } from 'node:dns';

const KEYS = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'QWEN_API_KEY',
  'OPENROUTER_API_KEY', 'GITHUB_MODELS_API_KEY', 'GITHUB_MODELS_TOKEN', 'LLM_PROVIDER', 'HUGGINGFACE_API_KEY'];
const OAI = 'sk-fakeopenai0123456789abcdefghijklmn';
const savedEnv = {};
let server; let baseUrl; let ROOT; let restoreTransport = null;
const realFetch = globalThis.fetch;
const realLookup = dns.lookup;

before(async () => {
  ROOT = mkdtempSync(resolve(tmpdir(), 'auto-pipe-jd-gate-'));
  for (const d of ['config', 'data', 'modes', 'output', 'reports']) mkdirSync(resolve(ROOT, d), { recursive: true });
  writeFileSync(resolve(ROOT, 'cv.md'), '# CV\n\nSenior backend engineer, 10 years.\n');
  writeFileSync(resolve(ROOT, 'config', 'profile.yml'), 'candidate:\n  full_name: T\n');
  writeFileSync(resolve(ROOT, 'portals.yml'), 'tracked_companies: []\n');
  writeFileSync(resolve(ROOT, 'data', 'applications.md'), '# Applications Tracker\n');
  writeFileSync(resolve(ROOT, 'modes', 'oferta.md'), '# Oferta\n');
  writeFileSync(resolve(ROOT, 'modes', '_shared.md'), '# Shared\n');
  for (const k of KEYS) { savedEnv[k] = process.env[k]; delete process.env[k]; }
  savedEnv.LLM_RATE_LIMIT = process.env.LLM_RATE_LIMIT;
  process.env.LLM_RATE_LIMIT = '1000/60s'; // v1.248.3 — the suite fires more POSTs than the default window allows
  process.env.CAREER_OPS_ROOT = ROOT;
  const { createApp } = await import('../server/index.mjs');
  ({ _setTransport } = await import('../server/lib/safe-fetch.mjs'));
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; r(); }); });
});

after(async () => {
  globalThis.fetch = realFetch;
  dns.lookup = realLookup;
  if (restoreTransport) restoreTransport();
  for (const k of [...KEYS, 'LLM_RATE_LIMIT']) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
  delete process.env.CAREER_OPS_ROOT;
  await new Promise((r) => server.close(r));
  try { rmSync(ROOT, { recursive: true, force: true }); } catch {}
});

let _setTransport;

beforeEach(() => {
  globalThis.fetch = realFetch;
  // Start each case from an empty reports/ so "no report was written" is meaningful.
  for (const f of readdirSync(resolve(ROOT, 'reports'))) rmSync(resolve(ROOT, 'reports', f));
});

afterEach(() => {
  globalThis.fetch = realFetch;
  dns.lookup = realLookup;
  if (restoreTransport) { restoreTransport(); restoreTransport = null; }
});

/** Stub the page fetch + provider HTTP; drain the SSE stream into events. */
async function run(body, providerBody, pageBody = PAGE_BODY) {
  const { _setTransport: set } = await import('../server/lib/safe-fetch.mjs');
  dns.lookup = async () => ({ address: '93.184.216.34', family: 4 });
  restoreTransport = set(async () => ({ status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(pageBody) }));
  globalThis.fetch = async (u, o = {}) => {
  const host = (() => { try { return new URL(String(u)).hostname; } catch { return ''; } })();
  if (host === 'api.openai.com') {
      return new Response(JSON.stringify({ choices: [{ message: { content: providerBody }, finish_reason: 'stop' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(u, o);
  };
  process.env.OPENAI_API_KEY = OAI;
  const resp = await fetch(baseUrl + '/api/auto-pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  const events = text.split('\n\n').filter(Boolean).map((b) => ({
    event: (b.match(/^event: (.+)$/m) || [])[1],
    data: JSON.parse((b.match(/^data: (.+)$/m) || [, 'null'])[1]),
  }));
  return { status: resp.status, events, text };
}

// What a placeholder page yields after HTML stripping: more than the old
// 50-char floor, far below any real JD (~1 KB+).
const PAGE_BODY = '<html><body>Example Domain. This domain is for use in illustrative examples in documents.</body></html>';
// The junk the timer used to persist (what the model answers to a non-JD page).
const JUNK_ANSWER = 'Insufficient JD information to evaluate.';

const SANITIZED_LEN = 'Example Domain. This domain is for use in illustrative examples in documents.'.length;

test('placeholder page (<200 chars): SSE error at fetch, NO report file, console warning with the host', async () => {
  assert.ok(SANITIZED_LEN >= 50 && SANITIZED_LEN < 200, `fixture must sit between the old and new gates, got ${SANITIZED_LEN}`);
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...a) => warnings.push(a.join(' '));
  let out;
  try { out = await run({ url: 'https://example.com/qa-v167-t-role' }, JUNK_ANSWER); }
  finally { console.warn = origWarn; }

  // Meaningful API answer: SSE error event for the fetch step — never a 500.
  assert.equal(out.status, 200);
  const err = out.events.find((e) => e.event === 'error');
  assert.ok(err, 'expected an SSE error event');
  assert.equal(err.data.step, 'fetch');
  assert.equal(err.data.message, 'JD too short');
  assert.ok(!out.events.some((e) => e.event === 'done'), 'no done event');

  // The core regression: no report file at all.
  const reports = readdirSync(resolve(ROOT, 'reports'));
  assert.deepEqual(reports, [], `no report may be written for a placeholder JD, got ${reports.join(', ')}`);
  // And no tracker row either (the tracker still holds only its header).
  const apps = readFileSync(resolve(ROOT, 'data', 'applications.md'), 'utf8');
  assert.ok(!apps.includes('Example'), 'no tracker row for the placeholder run');

  // Server-console warning carries the URL + the reason, nothing else.
  const hit = warnings.find((w) => w.includes('host: example.com'));
  assert.ok(hit, `expected a console warning naming the host, got: ${warnings.join(' | ')}`);
  assert.match(hit, /JD too short|200/);
  // Never the page text or the model answer.
  assert.ok(!warnings.join(' ').includes('illustrative examples'));
  assert.ok(!warnings.join(' ').includes(JUNK_ANSWER));
});

test('control: a real-size JD passes the gate (reaches the evaluate step)', async () => {
  const long = ('We are looking for a Senior Platform Engineer to own our Kubernetes platform. '
    + 'You will design CI/CD pipelines, run AWS infrastructure with Terraform and improve observability. ').repeat(4);
  const { _setTransport: set } = await import('../server/lib/safe-fetch.mjs');
  dns.lookup = async () => ({ address: '93.184.216.34', family: 4 });
  restoreTransport = set(async () => ({ status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(`<p>${long}</p>`) }));
  // No provider key at all: the run must get PAST the fetch gate and fail at
  // the evaluate step with the no-key message — proving the gate is not over-blocking.
  globalThis.fetch = realFetch;
  delete process.env.OPENAI_API_KEY;
  const resp = await fetch(baseUrl + '/api/auto-pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://jobs.example.com/real-1' }),
  });
  const text = await resp.text();
  const err = text.split('\n\n').map((b) => ({
    event: (b.match(/^event: (.+)$/m) || [])[1],
    data: JSON.parse((b.match(/^data: (.+)$/m) || [, 'null'])[1]),
  })).find((e) => e.event === 'error');
  assert.ok(err, 'expected an error event');
  assert.equal(err.data.step, 'evaluate', 'a real-size JD must clear the fetch gate');
  assert.equal(err.data.message, 'no LLM key');
});

// ── v1.248.3 — t.me entries: validation gate + company/role guessing ──────
test('v1.248.3: guessCompanyRole never returns «T» for a t.me URL (channel fallback)', async () => {
  const { guessCompanyRole } = await import('../server/lib/routes/auto-pipeline.mjs');
  const g = guessCompanyRole('Какой-то длинный текст поста из телеграм-канала о вакансии инженера.', 'https://t.me/somechannel/123');
  assert.notEqual(g.company, 'T', 'the domain slug must not become the company');
  assert.equal(g.company, 'Somechannel', 'the channel name is the closest thing to a company');
});

test('v1.248.3: guessCompanyRole returns empty for example.com (no nonsense company)', async () => {
  const { guessCompanyRole } = await import('../server/lib/routes/auto-pipeline.mjs');
  const g = guessCompanyRole('Placeholder body text.', 'https://example.com/qa-v167-t-role');
  assert.equal(g.company, '', 'example.com is an EMPTY_DOMAINS host');
});

test('v1.248.3: a long t.me post + a scoreless model answer → NO report, NO tracker row', async () => {
  // v1.248.5 — the t.me page fetches as the EMBED form; the widget text is
  // a long Cyrillic post (the length gate passes it), but the model answers
  // «insufficient data» without A–G or a score — rejected BEFORE saving.
  const longPage = '<html><body><div class="tgme_widget_message_text js-message_text" dir="auto">'
    + '<p>Телеграм-пост о вакансии инженера в распределённой команде, стек и условия внутри. </p>'.repeat(6)
    + '</div></body></html>';
  const { events } = await run({ url: 'https://t.me/somejobschannel/4567' }, 'Недостаточно данных для оценки вакансии. Извините.', longPage);
  assert.ok(events.some((e) => e.event === 'error' && /evaluation incomplete/.test(e.data?.message || '')),
    'an SSE error with «evaluation incomplete» must arrive');
  assert.ok(events.some((e) => e.event === 'error' && e.data?.rejected === true),
    'the error payload carries rejected: true');
  const reports = readdirSync(resolve(ROOT, 'reports')).filter((f) => f.includes('t-role'));
  assert.equal(reports.length, 0, 'no t-role report file');
});

test('v1.248.3: a REAL report (A–G + SCORE) still saves as before', async () => {
  const good = ['## A) Контекст', '## B) Соответствие', '## C) Риски', '## D) Зарплата',
    '## E) Вопросы работодателю', '## F) Легитимность', '## G) Рекомендация',
    '---SCORE_SUMMARY---', 'COMPANY: Acme', 'ROLE: Engineer', 'ARCHETYPE: backend',
    'LEGITIMACY: high', 'SCORE: 4,2/5', '---END_SUMMARY---'].join('\n');
  // Plain text (the transport returns it as-is; sanitize passes it through).
  const longGreenhouse = 'Acme — Senior Backend Engineer\n' + 'Berlin, Germany. Hybrid. Acme builds developer tools. '.repeat(20);
  const { events } = await run({ url: 'https://boards.greenhouse.io/acme/jobs/1' }, good, longGreenhouse);
  if (!events.some((e) => e.event === 'done'))   assert.ok(events.some((e) => e.event === 'done'), 'the pipeline completes');
  const reports = readdirSync(resolve(ROOT, 'reports')).filter((f) => f.includes('acme'));
  assert.equal(reports.length, 1, 'the report is saved');
});

// ── v1.248.4 — role resolution chain for t.me entries ──────────────────────
test('v1.248.4: guessCompanyRole — RU role keywords + «Компания: X» + channel', async () => {
  const { guessCompanyRole } = await import('../server/lib/routes/auto-pipeline.mjs');
  const g = guessCompanyRole(
    ['Компания: Somejobschannel', 'Вакансия: Инженер по данным', 'Мы ищем инженера в команду данных. Berlin.'].join('\n'),
    'https://t.me/somejobschannel/4567');
  assert.equal(g.company, 'Somejobschannel', 'the self-label wins');
  assert.match(g.role, /инженер|Инженер|данные/i, 'the RU keyword line becomes the role');
});

test('v1.248.4: t.me/s/<channel>/<id> skips the «s» segment (both forms give the channel)', async () => {
  const { guessCompanyRole } = await import('../server/lib/routes/auto-pipeline.mjs');
  const scanForm = guessCompanyRole('Инженер в Берлине.', 'https://t.me/somejobschannel/4567');
  const previewForm = guessCompanyRole('Инженер в Берлине.', 'https://t.me/s/somejobschannel/4567');
  assert.equal(scanForm.company, 'Somejobschannel');
  assert.equal(previewForm.company, 'Somejobschannel', 'the /s/ preview prefix is skipped');
  assert.notEqual(previewForm.company, 'S', 'the «s» segment must not become the company');
});

test('v1.248.4: entry with no company and no role hint fails BEFORE the LLM call', async () => {
  // A page with neither a company self-label, nor a channel fallback
  // (non-messenger host with an ATS-domain slug), nor any role keyword.
  const noHintPage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.'.repeat(6);
  let providerCalls = 0;
  const { _setTransport: set } = await import('../server/lib/safe-fetch.mjs');
  const { _setLookup: setLookup } = await import('../server/lib/safe-fetch.mjs');
  const restore = set(async () => ({ status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(noHintPage) }));
  // v1.248.5 — resolve offline (CI may have no network).
  const restoreLookup = setLookup(async (hostname) => {
    if (hostname === 'example.com') return { address: '93.184.216.34', family: 4 };
    throw new Error(`offline resolver: unexpected host ${hostname}`);
  });
  const realFetchSave = globalThis.fetch;
  globalThis.fetch = async (u, o = {}) => {
    const host = (() => { try { return new URL(String(u)).hostname; } catch { return ''; } })();
    if (host === 'api.openai.com') { providerCalls += 1; return new Response(JSON.stringify({ choices: [{ message: { content: 'x' } }] }), { status: 200 }); }
    return realFetchSave(u, o);
  };
  try {
    const resp = await fetch(baseUrl + '/api/auto-pipeline', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/no-hints' }),
    });
    const text = await resp.text();
    const ev = text.split('\n\n').filter(Boolean).map((b) => ({
      event: (b.match(/^event: (.+)$/m) || [])[1],
      data: JSON.parse((b.match(/^data: (.+)$/m) || [, 'null'])[1]),
    }));
    assert.ok(ev.some((e) => e.event === 'error' && /no company\/role hints/.test(e.data?.message || '')),
      'fails at step fetch with the skip reason');
    assert.equal(providerCalls, 0, 'the LLM stub is never called');
    assert.ok(!ev.some((e) => e.event === 'step' && e.data.key === 'evaluate'), 'no evaluate step');
  } finally {
    restore(); restoreLookup(); globalThis.fetch = realFetchSave;
  }
});

test('v1.248.6: a real t.me post («Компания : X», <br>, hashtags) → company from the label, clean role in the tracker', async () => {
  // The user-reported live shape: <br>-separated post, «Компания : X» with a
  // space before the colon, hashtags and emoji in the role line. Before the
  // fix the whole post glued into one line: company fell back to the channel
  // name and the tracker role cell carried the full post text.
  const tmeEmbed = '<html><body><div class="tgme_widget_message_text js-message_text" dir="auto">'
    + '<p>PHP-разработчик (middle) #удаленка 🚀</p><br>'
    + 'Компания : Nordwind<br>'
    + 'Удалённо, Европа. Опыт PHP от 3 лет, Laravel, MySQL, Docker. Зарплата 3500–4500 € net, оформление по контракту, гибкий график, код-ревью и наставник в команде. Пишите в личку.</div></body></html>';
  const fullReport = ['# Middle PHP Developer — Nordwind', '## A) Контекст', '## B) Соответствие',
    '## C) Риски', '## D) Зарплата', '## E) Вопросы', '## F) Легитимность: high', '## G) Вердикт: proceeding',
    '---SCORE_SUMMARY---', 'COMPANY: Nordwind', 'ROLE: Middle PHP Developer', 'ARCHETYPE: backend',
    'LEGITIMACY: high', 'SCORE: 4/5', '---END_SUMMARY---'].join('\n');
  const out = await run({ url: 'https://t.me/jobsfeed/123' }, fullReport, tmeEmbed);
  assert.ok(out.events.some((e) => e.event === 'done'), 'the pipeline completes: ' + JSON.stringify(out.events).slice(-300));
  // Item 1: the company comes from the «Компания : X» label — not the channel.
  assert.equal(out.events.find((e) => e.event === 'done')?.data?.company, 'Nordwind', 'company from the self-label, not the channel');
  // Item 2: the tracker role cell — from the report header, no hashtags, no emoji.
  const row = readFileSync(resolve(ROOT, 'data', 'applications.md'), 'utf8').split('\n').find((l) => l.includes('Nordwind'));
  assert.ok(row, 'a tracker row exists');
  const roleCell = row.split('|')[4].trim();
  assert.equal(roleCell, 'Middle PHP Developer', 'the tracker role comes from the report header');
  assert.ok(!/#/.test(roleCell), 'no hashtags in the tracker role');
  assert.ok(!/\p{Extended_Pictographic}/u.test(roleCell), 'no emoji in the tracker role');
  // The report slug carries the header role (Cyrillic is dropped by the slug,
  // the ASCII company remains — pre-existing slug behaviour).
  const reports = readdirSync(resolve(ROOT, 'reports'));
  assert.equal(reports.length, 1, 'one report saved');
  assert.match(reports[0], /nordwind/i, 'the company lands in the filename');
});

test('v1.248.8: a looping answer (Block B repeated, no D–G) → warning + rejection, never a silent save', async () => {
  const looping = ['# Evaluation: Acme — Backend Engineer', '## A) Контекст', 'Текст анализа блока A, достаточно длинный для валидного вида отчёта и проверки структуры. Ещё немного содержимого блока, чтобы выглядело как настоящий ответ модели на русском языке.',
    '## B) Соответствие', 'Текст анализа блока B. Опыт кандидата соответствует требованиям позиции, стек совпадает, философия команды близка. Здесь тоже достаточно содержимого.',
    '## B) Соответствие', 'Повтор блока B — модель зациклилась: тот же анализ снова и снова, бесконечный хвост повторов без новых блоков.',
    '---SCORE_SUMMARY---', 'COMPANY: Acme', 'ROLE: Backend Engineer', 'ARCHETYPE: backend', 'LEGITIMACY: high', 'SCORE: 4/5', '---END_SUMMARY---'].join('\n');
  const page = '<html><body><div class="tgme_widget_message_text js-message_text" dir="auto">'
    + '<p>Backend Engineer в платформенной команде. Компания : Acme. Полностью удалённо, Европа. Опыт Go от 4 лет, Kubernetes, Postgres, Prometheus. Оформление по контракту, опционы, ежегодные бонусы, обучение за счёт компании. Откликайтесь в личку.</p></div></body></html>';
  const out = await run({ url: 'https://t.me/jobsfeed/128' }, looping, page);
  assert.ok(out.events.some((e) => e.event === 'error' && /evaluation incomplete/.test(e.data?.message || '')),
    'the cut prefix fails validation (missing C–G) — the loop is NOT filed');
  assert.ok(out.events.some((e) => (e.event === 'step' || e.event === 'error') && /report looping/.test(e.data?.detail || e.data?.message || '')),
    'the looping note reaches the step detail / error message');
  const reports = readdirSync(resolve(ROOT, 'reports'));
  assert.equal(reports.length, 0, 'nothing saved');
});

test('v1.248.7: H1 «Evaluation: Sveak — PHP-разработчик (senior)» → the role is the RIGHT side', async () => {
  // The parent's report format is `# Evaluation: {Company} — {Role}`
  // (modes/oferta.md); v1.248.6 read the left side and named the role
  // «Evaluation: Sveak» on every auto-pipeline tracker row.
  const tmeEmbed = '<html><body><div class="tgme_widget_message_text js-message_text" dir="auto">'
    + '<p>PHP-разработчик (senior) #удаленка 🚀</p><br>'
    + 'Компания : Sveak<br>'
    + 'Удалённо, Европа. Опыт PHP от 5 лет, Laravel, MySQL, Docker. Зарплата 4500–5500 € net, оформление по контракту, код-ревью и наставник в команде. Пишите в личку.</div></body></html>';
  const report = ['# Evaluation: Sveak — PHP-разработчик (senior)', '## A) Контекст', '## B) Соответствие',
    '## C) Риски', '## D) Зарплата', '## E) Вопросы', '## F) Легитимность: high', '## G) Вердикт: proceeding',
    '---SCORE_SUMMARY---', 'COMPANY: Sveak', 'ROLE: PHP-разработчик (senior)', 'ARCHETYPE: backend',
    'LEGITIMACY: high', 'SCORE: 4/5', '---END_SUMMARY---'].join('\n');
  const out = await run({ url: 'https://t.me/jobsfeed/123' }, report, tmeEmbed);
  const done = out.events.find((e) => e.event === 'done');
  assert.ok(done, 'the pipeline completes');
  assert.equal(done.data.role, 'PHP-разработчик (senior)', 'the role is the RIGHT side after the label');
  assert.equal(done.data.company, 'Sveak', 'the company comes from the self-label');
  const file = readdirSync(resolve(ROOT, 'reports'))[0] || '';
  assert.ok(!/evaluation/i.test(file), 'no «evaluation» in the slug: ' + file);
  assert.match(file, /sveak/i, 'the company lands in the slug');
  const row = readFileSync(resolve(ROOT, 'data', 'applications.md'), 'utf8').split('\n').find((l) => l.includes('Sveak'));
  assert.ok(row && !/Evaluation:/i.test(row), 'the tracker row carries no «Evaluation:» prefix');
});

test('v1.248.7: H1 «Оценка вакансии: Acme — Backend Engineer» → «Backend Engineer»', async () => {
  const page = '<html><body><div class="tgme_widget_message_text js-message_text" dir="auto">'
    + '<p>Backend Engineer в продуктовой команде. Компания : Acme. Полностью удалённо, Европа. Опыт Go от 4 лет, Kubernetes, Postgres, Prometheus. Оформление по контракту, опционы, ежегодные бонусы, обучение за счёт компании, код-ревью и наставник. Откликайтесь в личку.</p></div></body></html>';
  const report = ['# Оценка вакансии: Acme — Backend Engineer', '## A) Контекст', '## B) Соответствие',
    '## C) Риски', '## D) Зарплата', '## E) Вопросы', '## F) Легитимность: high', '## G) Вердикт: proceeding',
    '---SCORE_SUMMARY---', 'COMPANY: Acme', 'ROLE: Backend Engineer', 'ARCHETYPE: backend',
    'LEGITIMACY: high', 'SCORE: 4/5', '---END_SUMMARY---'].join('\n');
  const out = await run({ url: 'https://t.me/jobsfeed/124' }, report, page);
  const done = out.events.find((e) => e.event === 'done');
  assert.ok(done, 'the pipeline completes');
  assert.equal(done.data.role, 'Backend Engineer', 'the localized label is stripped, the role is the right side');
});

test('v1.248.7: H1 «Backend Engineer — Acme» (no label) → the LEFT side is the role', async () => {
  const page = '<html><body><div class="tgme_widget_message_text js-message_text" dir="auto">'
    + '<p>Backend Engineer в платформенной команде. Компания : Acme. Полностью удалённо, Европа. Опыт Go от 4 лет, Kubernetes, Postgres, Prometheus. Оформление по контракту, опционы, ежегодные бонусы, обучение за счёт компании. Откликайтесь в личку.</p></div></body></html>';
  const report = ['# Backend Engineer — Acme', '## A) Контекст', '## B) Соответствие',
    '## C) Риски', '## D) Зарплата', '## E) Вопросы', '## F) Легитимность: high', '## G) Вердикт: proceeding',
    '---SCORE_SUMMARY---', 'COMPANY: Acme', 'ROLE: Backend Engineer', 'ARCHETYPE: backend',
    'LEGITIMACY: high', 'SCORE: 4/5', '---END_SUMMARY---'].join('\n');
  const out = await run({ url: 'https://t.me/jobsfeed/125' }, report, page);
  const done = out.events.find((e) => e.event === 'done');
  assert.ok(done, 'the pipeline completes');
  assert.equal(done.data.role, 'Backend Engineer', 'without a label the left side is the role');
});

test('v1.248.7: H1 «Evaluation: Acme» (no role) → the cleaned post line is the fallback', async () => {
  const page = '<html><body><div class="tgme_widget_message_text js-message_text" dir="auto">'
    + '<p>Backend Engineer (Go) #удаленка 🚀</p><br>'
    + 'Компания : Acme<br>'
    + 'Полностью удалённо. Опыт Go от 4 лет, Kubernetes, Postgres, Prometheus. Оформление по контракту, опционы, ежегодный бонус, обучение за счёт компании. Откликайтесь в личку.</div></body></html>';
  const report = ['# Evaluation: Acme', '## A) Контекст', '## B) Соответствие',
    '## C) Риски', '## D) Зарплата', '## E) Вопросы', '## F) Легитимность: high', '## G) Вердикт: proceeding',
    '---SCORE_SUMMARY---', 'COMPANY: Acme', 'ROLE: Backend Engineer (Go)', 'ARCHETYPE: backend',
    'LEGITIMACY: high', 'SCORE: 4/5', '---END_SUMMARY---'].join('\n');
  const out = await run({ url: 'https://t.me/jobsfeed/126' }, report, page);
  const done = out.events.find((e) => e.event === 'done');
  assert.ok(done, 'the pipeline completes');
  assert.ok(!/evaluation/i.test(done.data.role || ''), 'the role is never a bare label');
  assert.match(done.data.role || '', /Backend Engineer/, 'the fallback comes from the post line (cleaned)');
  assert.ok(!/#/.test(done.data.role || ''), 'no hashtags in the fallback');
});

test('v1.248.7: an English answer at lang=ta saves with a «report not in ta» warning', async () => {
  const page = '<html><body><div class="tgme_widget_message_text js-message_text" dir="auto">'
    + '<p>Backend Engineer в платформенной команде. Компания : Acme. Полностью удалённо, Европа. Опыт Go от 4 лет, Kubernetes, Postgres, Prometheus. Оформление по контракту, опционы, ежегодные бонусы, обучение за счёт компании. Откликайтесь в личку.</p></div></body></html>';
  const report = ['# Evaluation: Acme — Backend Engineer', '## A) Context', '## B) Match',
    '## C) Risks', '## D) Compensation', '## E) Questions', '## F) Legitimacy: high', '## G) Verdict: proceeding',
    '---SCORE_SUMMARY---', 'COMPANY: Acme', 'ROLE: Backend Engineer', 'ARCHETYPE: backend',
    'LEGITIMACY: high', 'SCORE: 4/5', '---END_SUMMARY---'].join('\n');
  const out = await run({ url: 'https://t.me/jobsfeed/127', lang: 'ta' }, report, page);
  const done = out.events.find((e) => e.event === 'done');
  assert.ok(done, 'the pipeline completes — a wrong-language report is NOT a rejection');
  assert.ok((done.data.warnings || []).some((w) => /report not in ta/.test(w)), 'the warning names the requested locale');
});

test('v1.248.6: two rejections in a row → ONE «## Rejected» header, two lines', async () => {
  // The section must not grow a new heading per rejection: the second call
  // appends its line INTO the existing section.
  writeFileSync(resolve(ROOT, 'data', 'pipeline.md'),
    '# Pipeline\n\n```\nhttps://t.me/somejobschannel/4567\n```\n');
  const scoreless = 'Недостаточно данных для оценки вакансии. Извините.';
  const longPage = '<html><body><div class="tgme_widget_message_text js-message_text" dir="auto">'
    + '<p>Телеграм-пост о вакансии инженера в распределённой команде, стек и условия внутри. </p>'.repeat(6)
    + '</div></body></html>';
  await run({ url: 'https://t.me/somejobschannel/4567' }, scoreless, longPage);
  await run({ url: 'https://t.me/somejobschannel/4567' }, scoreless, longPage);
  const pipe = readFileSync(resolve(ROOT, 'data', 'pipeline.md'), 'utf8');
  const headers = pipe.split('\n').filter((l) => /^## Rejected\s*$/i.test(l.trim())).length;
  const marks = pipe.split('\n').filter((l) => /^- .*rejected:/i.test(l)).length;
  assert.equal(headers, 1, 'exactly one «## Rejected» header');
  assert.equal(marks, 2, 'two mark lines (the URL left the fence, so the idempotence check does not swallow the second)');
});

test('v1.248.6: a domain root is rejected BEFORE the fetch', async () => {
  let pageFetches = 0;
  const { _setTransport: set } = await import('../server/lib/safe-fetch.mjs');
  const restore = set(async () => { pageFetches += 1; return { status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from('<p>' + 'x'.repeat(400) + '</p>') }; });
  const realFetchSave = globalThis.fetch;
  globalThis.fetch = async (u, o = {}) => {
    const host = (() => { try { return new URL(String(u)).hostname; } catch { return ''; } })();
    if (host === 'api.openai.com') return new Response(JSON.stringify({ choices: [{ message: { content: 'x' } }] }), { status: 200 });
    return realFetchSave(u, o);
  };
  try {
    let providerCalls = 0;
    const prevFetch = globalThis.fetch;
    globalThis.fetch = async (u, o = {}) => {
      const host = (() => { try { return new URL(String(u)).hostname; } catch { return ''; } })();
      if (host === 'api.openai.com') { providerCalls += 1; return prevFetch(u, o); }
      return prevFetch(u, o);
    };
    const { events } = await run({ url: 'https://linkedin.com/' }, 'x', '<p>y</p>');
    assert.equal(providerCalls, 0, 'the LLM stub is never called');
    const fetchStep = events.filter((e) => e.event === 'step' && e.data?.key === 'fetch');
    assert.ok(!fetchStep.some((e) => e.data?.status === 'done'), 'no fetch:done — the root check fires before the request');
    assert.ok(events.some((e) => e.event === 'error' && e.data?.rejected === true && /domain root/.test(e.data?.message || '')), 'rejected with the root reason');
  } finally {
    restore(); globalThis.fetch = realFetchSave;
  }
});

// ── CAR-127 / CAR-128 (v1.256.0) — identity: the role is never filed as
// the company, and a job board's domain slug is never filed as the
// employer. ──────────────────────────────────────────────────────────────

test('CAR-128: a "Role - Company" header line never files the role as the company', async () => {
  const { guessCompanyRole } = await import('../server/lib/routes/auto-pipeline.mjs');
  const g = guessCompanyRole(
    'Senior Frontend Engineer - Grafana Labs\n\nAbout the team\nWe build dashboards.',
    'https://jobs.lever.co/grafana/11111111',
  );
  assert.equal(g.company, 'Grafana Labs');
  assert.match(g.role, /Senior Frontend Engineer/);
});

test('CAR-128: "Company — Role" keeps the company on the left (regression)', async () => {
  const { guessCompanyRole } = await import('../server/lib/routes/auto-pipeline.mjs');
  const g = guessCompanyRole(
    'Grafana Labs — Senior Frontend Engineer\n\nAbout the team',
    'https://jobs.lever.co/grafana/22222222',
  );
  assert.equal(g.company, 'Grafana Labs');
  assert.match(g.role, /Senior Frontend Engineer/);
});

test('CAR-127: an hh.ru URL never becomes the company «hh» — employer-less JD yields empty', async () => {
  const { guessCompanyRole } = await import('../server/lib/routes/auto-pipeline.mjs');
  const g = guessCompanyRole('Текст вакансии без названия работодателя.', 'https://hh.ru/vacancy/91827364');
  assert.equal(g.company, '');
});

test('CAR-127: sentence-initial «В Сбер. IT ищут…» yields the employer (capital В, P2)', async () => {
  const { guessCompanyRole } = await import('../server/lib/routes/auto-pipeline.mjs');
  const g = guessCompanyRole('В Сбер. IT ищут опытного инженера.', 'https://hh.ru/vacancy/91827365');
  assert.equal(g.company, 'Сбер. IT');
});

test('CAR-127: «В компании X ищут…» yields the employer (capital В, P1)', async () => {
  const { guessCompanyRole } = await import('../server/lib/routes/auto-pipeline.mjs');
  const g = guessCompanyRole('В компании Сбер. IT ищут инженера.', 'https://hh.ru/vacancy/91827366');
  assert.equal(g.company, 'Сбер. IT');
});

test('CAR-127 review: no bare «X ищет» fabrication — «Мы активно ищем» files nothing', async () => {
  const { guessCompanyRole } = await import('../server/lib/routes/auto-pipeline.mjs');
  const g = guessCompanyRole('Мы активно ищем инженера в команду.', 'https://hh.ru/vacancy/91827367');
  assert.equal(g.company, '');
});

test('CAR-128 review: an employment type never becomes the employer', async () => {
  const { guessCompanyRole } = await import('../server/lib/routes/auto-pipeline.mjs');
  const g = guessCompanyRole('Senior Engineer - Remote (EU)\n\nWe build things.', 'https://jobs.lever.co/grafana/33333333');
  assert.equal(g.company, '');
  assert.match(g.role, /Senior Engineer/);
});
