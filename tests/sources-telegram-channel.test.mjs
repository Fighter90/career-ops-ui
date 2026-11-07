// tests/sources-telegram-channel.test.mjs — the STRICT Telegram reader.
//
// CI-isolated: every fetch is a fake, no network.
//
// web-ui also ships `telegram`, which reads the same t.me preview pages and
// keeps every post. This source exists for the opposite trade: a post becomes a
// row ONLY when it names an employer AND links to a vacancy page. So the tests
// that matter here are the REFUSALS — the cases where a looser reader would
// emit a row and this one must not, because a wrong employer entering the
// tracker as fact is worse than a missing row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  employerName,
  classifyLink,
  applicationLink,
  parseChannelPage,
  postToJob,
  resolveChannel,
  buildTelegramChannelUrl,
  fetchTelegramChannel,
} from '../server/lib/sources/telegram-channel.mjs';
import { telegramChannelAdapter } from '../server/lib/portals/adapters/telegram-channel.mjs';

// ── the handle is the only value that reaches the URL ───────────────────────

test('telegram-channel refuses a handle that could reshape the URL', () => {
  for (const bad of ['a/b', 'chan?x=1', 'chan.evil', 'ab', 'x'.repeat(33), '', undefined]) {
    assert.throws(() => resolveChannel({ channel: bad }), /needs a channel handle/, `accepted ${JSON.stringify(bad)}`);
  }
  assert.equal(resolveChannel({ channel: '@job_python' }), 'job_python', 'a leading @ is stripped');
  assert.equal(buildTelegramChannelUrl({ channel: 'job_python' }), 'https://t.me/s/job_python');
});

// ── employer: five shapes, and nothing guessed ─────────────────────────────

test('telegram-channel reads the employer from each shape it claims to support', () => {
  assert.equal(employerName(['Компания: Контур']), 'Контур');
  assert.equal(employerName(['Senior Go Developer @ Ozon']), 'Ozon');
  assert.equal(employerName(['Data Analyst | Wildberries']), 'Wildberries');
  assert.equal(employerName(['Backend Engineer', 'в Авито — Москва']), 'Авито');
});

test('telegram-channel never guesses an employer from free text', () => {
  // The looser `telegram` source attributes an unlabelled post to the channel
  // handle. This one returns nothing, which drops the post entirely.
  assert.equal(employerName(['Ищем разработчика', 'Хорошие условия']), '');
  assert.equal(employerName([]), '');
});

test('telegram-channel rejects a hidden employer rather than recording the euphemism', () => {
  assert.equal(employerName(['Компания: название скрыто']), '');
  assert.equal(employerName(['Компания: our client']), '');
  assert.equal(employerName(['Компания: Confidential']), '');
});

test('telegram-channel rejects a location or a date captured by the title shapes', () => {
  // `Title | Remote` and `Title | September 02, 2026` match the same pattern as
  // `Title | Employer`; only the employer reading survives.
  assert.equal(employerName(['Senior Engineer | Remote']), '');
  assert.equal(employerName(['Senior Engineer | September 2026']), '');
  assert.equal(employerName(['Senior Engineer | Москва']), '');
});

test('telegram-channel allows digits in a LABELLED employer but not in one split from a title', () => {
  // `Компания: X5 Tech` is a real name; `Title | 2026` is a date.
  assert.equal(employerName(['Компания: X5 Tech']), 'X5 Tech');
  assert.equal(employerName(['Role | X5 Tech']), '', 'a title split with digits is not trusted');
});

test('telegram-channel reads the hashtag-first template but refuses a role on that line', () => {
  // This shape has no marker pinning the line to "employer" at all, so a line
  // that reads as a role must not be taken as a company.
  assert.equal(employerName(['#вакансия #python', 'Контур']), 'Контур');
  assert.equal(employerName(['#вакансия #python', 'Senior Engineer']), '');
});

// ── link classification ────────────────────────────────────────────────────

test('telegram-channel refuses links that are never an application target', () => {
  for (const href of [
    'https://t.me/somechannel/5',
    'https://vk.com/wall-1_2',
    'https://bit.ly/abc',
    'https://forms.gle/xyz',
    'http://acme.test/jobs/123',
  ]) {
    assert.equal(classifyLink(href), null, `accepted ${href}`);
  }
});

test('telegram-channel refuses a homepage or a listing root, even with a tracking tail', () => {
  // A channel footer links the company homepage with ?utm_source=telegram.
  assert.equal(classifyLink('https://acme.test/'), null);
  assert.equal(classifyLink('https://acme.test/?utm_source=telegram'), null);
  assert.equal(classifyLink('https://acme.test/jobs'), null);
  assert.equal(classifyLink('https://acme.test/jobs?utm_medium=post'), null);
  // But a parameter that could identify a vacancy makes it a page.
  assert.equal(classifyLink('https://acme.test/jobs?gh_jid=123'), 'employer');
});

test('telegram-channel tells an employer page from a board mirror', () => {
  assert.equal(classifyLink('https://acme.test/vacancy/senior-go'), 'employer');
  assert.equal(classifyLink('https://hh.ru/vacancy/12345678'), 'board');
  assert.equal(classifyLink('https://linkedin.com/jobs/view/12345'), 'board');
  assert.equal(classifyLink('https://linkedin.com/posts/someone_hiring'), null, 'a LinkedIn post is not a job');
});

test('telegram-channel prefers the employer page over a board mirror of the same vacancy', () => {
  const link = applicationLink(['https://hh.ru/vacancy/1', 'https://acme.test/vacancy/go']);
  assert.deepEqual(link, { url: 'https://acme.test/vacancy/go', kind: 'employer' });
});

test('telegram-channel treats a post with several distinct vacancies as a digest and drops it', () => {
  // The scanner has no way to split one post into the jobs it bundles.
  assert.equal(applicationLink(['https://hh.ru/vacancy/1', 'https://hh.ru/vacancy/2']), null);
  assert.equal(applicationLink(['https://a.test/vacancy/1', 'https://b.test/vacancy/2']), null);
});

test('telegram-channel counts the same vacancy linked twice with different tracking as one', () => {
  const link = applicationLink([
    'https://acme.test/vacancy/go?utm_source=tg',
    'https://acme.test/vacancy/go?utm_source=vk',
  ]);
  assert.equal(link.url, 'https://acme.test/vacancy/go?utm_source=tg', 'not a digest — one vacancy');
});

// ── page parsing ───────────────────────────────────────────────────────────

const post = (id, text, opts = {}) =>
  `<div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="chan/${id}">` +
  `<div class="tgme_widget_message_text">${text}</div>` +
  (opts.time ? `<time datetime="${opts.time}"></time>` : '') +
  `</div></div>`;

test('telegram-channel parses posts, skips service messages, and reads hrefs before flattening', () => {
  const html =
    post(10, 'Компания: Acme<br>Senior Go<br><a href="https://acme.test/vacancy/go">apply</a>', { time: '2026-09-01T10:00:00+00:00' }) +
    `<div class="tgme_widget_message_wrap"><div class="tgme_widget_message service_message" data-post="chan/11"><div class="tgme_widget_message_text">Channel created</div></div></div>`;
  const { posts } = parseChannelPage(html, 'chan');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].id, 10);
  assert.deepEqual(posts[0].hrefs, ['https://acme.test/vacancy/go'], 'anchors survive the flatten');
  assert.equal(posts[0].url, 'https://t.me/chan/10');
});

test('telegram-channel decodes a double-encoded href, as t.me serves them', () => {
  const html = post(12, 'Компания: Acme<br><a href="https://acme.test/vacancy/go?a=1&amp;amp;utm_source=tg">x</a>');
  const { posts } = parseChannelPage(html, 'chan');
  assert.equal(posts[0].hrefs[0], 'https://acme.test/vacancy/go?a=1&utm_source=tg');
});

test('telegram-channel ignores posts belonging to another channel', () => {
  const { posts } = parseChannelPage(post(13, 'x').replace('chan/13', 'other/13'), 'chan');
  assert.equal(posts.length, 0);
});

test('telegram-channel recognizes the no-preview page', () => {
  const { noPreview } = parseChannelPage('<meta property="og:title" content="Telegram: Contact @chan">', 'chan');
  assert.equal(noPreview, true);
});

// ── the policy, end to end ─────────────────────────────────────────────────

test('telegram-channel emits a row only when it has both an employer and a vacancy link', () => {
  const withBoth = parseChannelPage(post(20, 'Компания: Acme<br>Senior Go<br><a href="https://acme.test/vacancy/go">x</a>'), 'chan').posts[0];
  assert.ok(postToJob(withBoth, 'chan'), 'employer + link → a row');

  const noEmployer = parseChannelPage(post(21, 'Senior Go<br><a href="https://acme.test/vacancy/go">x</a>'), 'chan').posts[0];
  assert.equal(postToJob(noEmployer, 'chan'), null, 'no employer → no row');

  const noLink = parseChannelPage(post(22, 'Компания: Acme<br>Senior Go<br>пишите в личку'), 'chan').posts[0];
  assert.equal(postToJob(noLink, 'chan'), null, 'no vacancy link → no row');
});

test('telegram-channel carries the post permalink in the description, not as the job URL', () => {
  // The job URL must be where you apply; the t.me post is provenance.
  const p = parseChannelPage(post(23, 'Компания: Acme<br>Senior Go<br><a href="https://acme.test/vacancy/go">x</a>'), 'chan').posts[0];
  const job = postToJob(p, 'chan');
  assert.equal(job.url, 'https://acme.test/vacancy/go');
  assert.match(job.description, /Source: https:\/\/t\.me\/chan\/23/);
  assert.equal(job.source, 'telegram-channel');
});

test('telegram-channel drops a hashtag-first post that has no title line to give', () => {
  // Emitting the hashtag line itself as the title would be the same
  // wrong-field-as-fact the employer and link rules exist to prevent.
  const p = parseChannelPage(post(24, '#вакансия #python<br>Acme<br><a href="https://acme.test/vacancy/go">https://acme.test/vacancy/go</a>'), 'chan').posts[0];
  assert.equal(postToJob(p, 'chan'), null);
});

test('telegram-channel names a private channel instead of reporting a fetch failure', async () => {
  // t.me answers a private or missing channel with a redirect. A typo in the
  // handle must not look like an outage.
  await assert.rejects(
    fetchTelegramChannel('', {
      fetchImpl: async () => { throw new Error('redirect not allowed'); },
      company: { name: 'X', channel: 'privatechan' },
    }),
    /has no public preview/,
  );
});

test('telegram-channel reports changed markup instead of an empty board', async () => {
  // A page that clearly carries posts but parses to none is a parser failure,
  // and reporting zero rows would hide it forever.
  // The channel in the markup must match the one being fetched, or textPosts
  // is legitimately 0 and the page reads as an empty board rather than a
  // parser failure — which is exactly the distinction under test.
  const html = '<div class="tgme_widget_message_wrap"><div data-post="somechan/1"><div class="tgme_widget_message_text">x</div></div></div>'
    .replace('tgme_widget_message_wrap', 'tgme_widget_message_RENAMED');
  await assert.rejects(
    fetchTelegramChannel('', {
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => html }),
      company: { name: 'X', channel: 'somechan' },
    }),
    /markup changed/,
  );
});

test('telegram-channel adapter is provider-selected only', () => {
  // A bare t.me URL is ambiguous between this source and `telegram`, so it must
  // never auto-select either one.
  assert.equal(telegramChannelAdapter.matches({ provider: 'telegram-channel' }), true);
  assert.equal(telegramChannelAdapter.matches({ careers_url: 'https://t.me/s/chan' }), false);
  assert.equal(telegramChannelAdapter.matches({ provider: 'telegram' }), false);
});

test('telegram-channel rejects a Cyrillic location, not just an ASCII one', () => {
  // The parent used `\\b` here, which is ASCII-only and never fires next to
  // Cyrillic — so every Russian alternative in LOCATIONISH_RE was unreachable
  // and `Senior Engineer | Москва` returned "Москва" as the EMPLOYER. That is
  // the wrong-field-as-fact this policy exists to prevent, and it landed on
  // the provider's primary audience: a Russian-language channel writes the
  // location in Cyrillic. Unicode lookarounds fix it.
  assert.equal(employerName(['Senior Engineer | Москва']), '');
  assert.equal(employerName(['Senior Engineer | спб']), '');
  assert.equal(employerName(['Senior Engineer | Офис']), '');
  assert.equal(employerName(['Senior Engineer | удалёнка']), '');
  // A real employer with Cyrillic letters still passes — the fix narrows the
  // location list, not the alphabet.
  assert.equal(employerName(['Senior Engineer | Контур']), 'Контур');
});

// ── parent parity: multi-pipe tag (#4479/#4455) + hashtag template (#3928) ──

test('telegram-channel refuses a multi-pipe metadata tag as the employer (#4455)', () => {
  // Measured live upstream on @revacancy: every post came back as "IC"/"Senior".
  assert.equal(employerName(['🟥 Ten Square Games - Mid/ Senior UI/UX Designer | 3 year(s) | Senior | IC', '▫️ Ten Square Games | Gaming']), '');
  assert.equal(employerName(['🟥 Senior Backend Developer | 5 year(s) | Senior | IC', '▫️ Financial technology']), '');
});

test('telegram-channel refuses a bare role word after a single pipe, but not an employer containing one', () => {
  assert.equal(employerName(['Some Role Title | Senior']), '');
  assert.equal(employerName(['Engineer | Senior Labs']), 'Senior Labs');
  assert.equal(employerName(['Game Designer | Nexters', 'text']), 'Nexters', 'ordinary single-pipe shape untouched');
});

test('telegram-channel still reads the second-line shape when the pipe shape is rejected', () => {
  assert.equal(employerName(['Backend | 3 years | Senior', 'в Авито — Москва']), 'Авито');
});

test('telegram-channel hashtag template accepts real employer names (#3928)', () => {
  assert.equal(employerName(['#middle #офис', 'ПАО Сбербанк', 'Java-разработчик']), 'ПАО Сбербанк');
  assert.equal(employerName(['#senior #удаленка', 'Лаборатория Касперского', 'Инженер по безопасности']), 'Лаборатория Касперского');
  assert.equal(employerName(['#middle', 'Product Hunt', 'Backend Engineer']), 'Product Hunt');
});

test('telegram-channel hashtag template refuses every extended role token (#3928)', () => {
  assert.equal(employerName(['#job #python', 'Product Owner', 'Senior Python Developer']), '');
  assert.equal(employerName(['#senior #удаленка', 'QA Engineer']), '');
  assert.equal(employerName(['#middle #гибрид', 'Тестировщик']), '');
  assert.equal(employerName(['#lead', 'Руководитель отдела']), '');
  for (const token of ['Product Owner', 'QA', 'Tester', 'DevOps', 'SRE', 'Тестировщик', 'Тимлид', 'Владелец продукта', 'Руководитель', 'Маркетолог', 'Программист']) {
    assert.equal(employerName(['#middle #удаленка', token, 'Описание']), '', `accepted role token ${token}`);
  }
});

test('telegram-channel drops a hashtag-first post whose employer line is a role', () => {
  const p = parseChannelPage(post(30, '#middle #удаленка<br>Product Owner<br>Senior Python Developer<br><a href="https://acme.test/vacancy/go">apply</a>'), 'chan').posts[0];
  assert.equal(postToJob(p, 'chan'), null);
});

test('telegram-channel hashtag title skips the recognised employer metadata line (#3928)', () => {
  const apply = 'https://example.com/jobs/12345';
  const cases = [
    ['RU company field', '<b>🏢 Компания:</b> Контур', 'Контур', 'MLOps-инженер'],
    ['EN company field', 'Company: Picnic', 'Picnic', 'Backend Developer'],
    ['RU second-line employer', 'в Kaspi — fintech-экосистема.', 'Kaspi', 'Backend Developer'],
    ['EN second-line employer', 'at Picnic — grocery delivery.', 'Picnic', 'Backend Developer'],
    ['mixed-case EN employer metadata', 'Company: Picnic<br>at PICNIC — Backend Developer', 'Picnic', 'Platform Engineer'],
    ['mixed-case RU employer metadata', 'Компания: Контур<br>в КОНТУР — разработка сервисов.', 'Контур', 'MLOps-инженер'],
    ['mixed-case bare employer', 'Company: Picnic<br>PICNIC', 'Picnic', 'Platform Engineer'],
  ];
  for (const [label, employerHtml, company, role] of cases) {
    const p = parseChannelPage(post(31, `#middle #удаленка<br>${employerHtml}<br>${role}<br><a href="${apply}">${apply}</a>`, { time: '2026-09-04T10:00:00+00:00' }), 'chan').posts[0];
    const job = postToJob(p, 'chan');
    assert.equal(job?.title, role, `${label}: title`);
    assert.equal(job.company, company, `${label}: company`);
    assert.equal(job.url, apply, `${label}: url`);
    assert.match(job.description, /Source: https:\/\/t\.me\/chan\/31$/, `${label}: source`);

    const noTitle = parseChannelPage(post(32, `#middle #удаленка<br>${employerHtml}<br>#remote<br><a href="${apply}">${apply}</a>`), 'chan').posts[0];
    assert.equal(postToJob(noTitle, 'chan'), null, `${label}: no title → dropped`);
  }
});

test('telegram-channel hashtag metadata skipping preserves real role headlines', () => {
  const apply = 'https://example.com/jobs/12345';
  for (const role of ['Backend Developer @ Picnic', 'Backend Developer @ PICNIC', 'Backend Developer | Picnic', 'at-scale Backend Developer', 'внутренний IT-аналитик']) {
    const p = parseChannelPage(post(33, `#middle #remote<br>Company: Picnic<br>${role}<br><a href="${apply}">${apply}</a>`), 'chan').posts[0];
    const job = postToJob(p, 'chan');
    assert.equal(job?.title, role);
    assert.equal(job.company, 'Picnic');
    assert.equal(job.url, apply);
  }
});

// ── parent #6363: Habr Career links + positional employer shapes ────────────

test('telegram-channel reads a Habr Career vacancy (a habr.com subdomain), not as a blog link', () => {
  // career.habr.com sits under habr.com, a NON_APPLY_HOST; the board list is
  // now checked first. Only "/vacancies/<id>" is a vacancy page — a company
  // profile, a company's vacancy list and a search all carry a vacancy word
  // in the path and used to read as a board posting.
  assert.equal(classifyLink('https://career.habr.com/vacancies/1000169492'), 'board');
  assert.equal(classifyLink('https://career.habr.com/vacancies/1000169492/?utm_source=tg'), 'board');
  assert.equal(classifyLink('https://career.habr.com/companies/job'), null, 'a company profile whose slug is a vacancy word');
  assert.equal(classifyLink('https://career.habr.com/companies/yandex/vacancies'), null, "a company's vacancy list");
  assert.equal(classifyLink('https://career.habr.com/vacancies?q=go'), null, 'a search');
  assert.equal(classifyLink('https://habr.com/ru/articles/912345/'), null, 'a Habr article stays refused');
});

test('telegram-channel refuses mirrors whose operator is not declared, and reads ingamejob.com', () => {
  assert.equal(classifyLink('https://www.vseti.app/vakansii/3474384343943943943434343'), null, 'vseti.app: an aggregator page the posts carry in place of the employer link');
  assert.equal(classifyLink('https://www.remocate.app/jobs/staff-software-engineer-backend-recoveries-affirm'), null, 'remocate.app: operator not declared yet');
  assert.equal(classifyLink('https://offerclaw.app/vacancy/chief-technology-officer-tekhnicheskiy-direktor-83351aab'), null, 'offerclaw.app: operator not declared yet');
  assert.equal(classifyLink('https://hellowehire.com/jobs/middle-business-analyst-t24-vietnam-company-fdcfb8fcb5'), null, 'hellowehire.com: a shared freelance-recruiter ATS, employer often blank');
  assert.equal(classifyLink('https://ingamejob.com/en/job/qa-game-tester'), 'board', 'ingamejob.com: operator declared');
});

// Positional shapes (parent #6363): the employer is read from where the
// channel template puts it, with no label. Each first line below is a real
// shape from the channels the parent measured.
test('telegram-channel reads each positional employer shape', () => {
  const cases = [
    [['Chief Technology Officer в MadOut Games', 'РФ или удаленно'], 'MadOut Games', '"Title в Employer" on the title line'],
    [['✈️ Product Analyst в Авиасейлс (команда SERP)'], 'Авиасейлс', '"Title в Employer (team)" behind an emoji'],
    [['Senior Product Manager, Core Platform в Tabby : https://www.remocate.example/jobs/senior-product-manager'], 'Tabby', '"Title в Employer : link"'],
    [['🛰 Go-разработчик в TATLIN.UNIFIED — YADRO'], 'YADRO', '"Title в Team — Company" keeps the company'],
    [['🛰 Golang-разработчик в БЮРО 1440'], 'БЮРО 1440', 'a positional employer may carry digits'],
    [['💻 Wildberries ищет iOS-разработчика для мессенджера WB Chat'], 'Wildberries', '"Employer ищет …"'],
    [['💻 МТС Банк ищет iOS-разработчика для кредитных продуктов в «Мой МТС»'], 'МТС Банк', '"Employer ищет …" ahead of a later `в`'],
    [['Требуется « Full-stack разработчик на Go» (от 256 000 до 280 000 ₽)', 'Компания «Top Selection» ищет хорошего специалиста'], 'Top Selection', '"Компания «Employer» ищет" on the second line'],
    [['📑 Вакансия Senior Frontend Developer', 'Удалённо · Полная занятость', '💎 Plus8Soft ищет Senior Frontend Developer'], 'Plus8Soft', '"Employer ищет" on the third line'],
    [['#backend', 'YLAB Development', 'Python Backend Developer'], 'YLAB Development', 'a brand token keeps a name ending in a department word'],
    [['Senior Python Developer в Moscow Exchange'], 'Moscow Exchange', 'a name that only starts with a place keeps it'],
    [['Backend Developer', 'Компания: NDA Group'], 'NDA Group', 'a name that only starts with NDA keeps it'],
    [['#remote', 'Relocation Today', 'Backend Engineer'], 'Relocation Today', 'a name that holds a format word keeps it on the hashtag template'],
    [['Backend Developer в Relocation Today'], 'Relocation Today', 'a name that holds a format word keeps it after `в`'],
    [['Backend Engineer', 'The Trade Desk is a global advertising technology company.'], 'The Trade Desk', 'a three-word name opening with "The" before "is a"'],
    [['iOS Engineer – Creative App', 'ElevenLabs is an AI research and product company.'], 'ElevenLabs', '"Employer is a …" on the second line'],
    [['Data Engineer (со знанием Java или Groovy)', 'от 200 000 до 230 000 ₽', 'WILIX', 'WILIX - аккредитованная IT - компания.'], 'WILIX', "a finder.work mirror's employer after the salary line"],
  ];
  for (const [lines, want, label] of cases) {
    assert.equal(employerName(lines), want, label);
  }
});

test('telegram-channel refuses every measured non-employer in a positional slot', () => {
  const refused = [
    [['🇦🇪 Вакансия Executive Assistant / Chief of Staff с переездом в Дубай'], 'a destination after "с переездом в"'],
    [['🇨🇿 🇪🇸 Вакансия Senior Commercial Manager в Чехии или Испании'], 'a phrase of places after `в`'],
    [['🇵🇹 Вакансия для парфюмера в Лиссабоне'], 'one declined Cyrillic word after `в` (a city)'],
    [['💻 Golang-разработчик в команду CDP, 2ГИС'], 'a team after `в`'],
    [['Sales Manager в FinTech'], 'a sector after `в`'],
    [['Требуется «ML Engineer в Поиск»'], 'a `в` inside a quoted title'],
    [['Крупная российская ИТ-компания ищет сильного Head of Mobile Engineering'], 'an unnamed company that "ищет"'],
    [['Рекрутер Vital Partners ищет архитектора для неназванной финтех-организации'], 'a recruiter that "ищет"'],
    [['😀 Senior JavaScript Developer', 'от 250 000 ₽ в месяц', 'Удаленно (Москва)'], 'a work format after the salary line'],
    [['Golang-разработчик (Middle+), продуктовая команда', 'от 350 000 ₽', 'Иванова Мария Петровна'], 'a person after the salary line (fictional name, real shape)'],
    [['Backend Engineer', 'This is a full-time role.'], 'a pronoun before "is a"'],
    [['Backend Engineer', 'This role is a full-time position.'], 'a determiner and one word before "is a"'],
    [['Go Developer в Алматы'], 'an undeclined city after `в`'],
    [['Data Engineer', 'от 200 000 до 230 000 ₽', 'Москва'], 'a city after the salary line'],
    [['Data Engineer', 'от 200 000 до 230 000 ₽', 'Relocation available'], 'a relocation phrase after the salary line'],
    [['Go Developer в Relocation available'], 'a relocation phrase after `в`'],
    [['#remote', 'Релокация', 'Senior Engineer'], 'a relocation term on the hashtag template'],
    [['#remote', 'Relocation to Serbia', 'Senior Engineer'], 'a relocation phrase on the hashtag template'],
    [['#remote', 'Гибрид Москва', 'Senior Engineer'], 'a work format and a city on the hashtag template'],
    [['#remote', 'Гибрид (Москва)', 'Senior Engineer'], 'a work format and a parenthesised city on the hashtag template'],
    [['#Develpment', 'Custom Software Development', 'Worldwide 🌏'], 'a line of business on the hashtag template'],
    [['#Marketing', 'Worldwide 🌏', 'SEO / AI, Affiliate iGaming', 'remote'], 'a reach on the hashtag template'],
    [['AI-разработчик (Python/Go) — автоматизация в AdTech', 'Локация: Удалённо', 'Компания: NDA'], 'an NDA after the `Компания:` label'],
  ];
  for (const [lines, label] of refused) {
    assert.equal(employerName(lines), '', label);
  }
});

test('telegram-channel drops a post whose employer name is disclosed as withheld (DISCLOSED_HIDDEN)', () => {
  const HABR = 'https://career.habr.com/vacancies/1000168612';
  const agencyPost = (id, withheld) => post(id,
    `💻 Top Selection ищет Angular-разработчика<br/>Удалённо · зарплата не указана<br/>Подбор ведёт агентство Top Selection, ${withheld}.<br/><a href="${HABR}">Откликнуться</a>`,
    { time: '2026-09-04T10:00:00+00:00' });
  for (const withheld of [
    'название компании-заказчика не раскрыто',
    'название компании заказчика не раскрыто', // spaced variant (measured)
    'наименование компании не раскрывается',
  ]) {
    const p = parseChannelPage(agencyPost(40, withheld), 'chan').posts[0];
    assert.equal(postToJob(p, 'chan'), null, `withheld as "${withheld}" → the agency is not the employer, dropped`);
  }
  // A post that only withholds the salary keeps its employer and link.
  const salaryHidden = parseChannelPage(post(41,
    `💻 YADRO ищет C++ разработчика для серверных прошивок<br/>Нижний Новгород. Зарплата не раскрыта.<br/><a href="${HABR}">Откликнуться</a>`,
    { time: '2026-09-04T10:00:00+00:00' }), 'chan').posts[0];
  const kept = postToJob(salaryHidden, 'chan');
  assert.equal(kept?.company, 'YADRO', '"Зарплата не раскрыта" withholds the salary, not the employer');
  assert.equal(kept?.url, HABR);
});

test('telegram-channel strips a pasted link from the title line and skips work-format lines on the hashtag template', () => {
  // "Title в Tabby : https://…" — the link is the url; cut at TITLE_CAP the
  // title would end in "… :…".
  const linkUrl = 'https://tabby.example/careers/senior-product-manager-core-platform-with-a-long-slug';
  const withLink = parseChannelPage(post(42,
    `Senior Product Manager, Core Platform в Tabby : <a href="${linkUrl}">${linkUrl}</a><br/>Помогают с релокацией (Сербия).`,
    { time: '2026-09-04T10:00:00+00:00' }), 'chan').posts[0];
  const linked = postToJob(withLink, 'chan');
  assert.equal(linked?.title, 'Senior Product Manager, Core Platform в Tabby');
  assert.equal(linked?.company, 'Tabby');
  assert.equal(linked?.url, linkUrl);

  // On the hashtag template a "Worldwide 🌏" / "Full-time" / "Релокация" line
  // is not the title.
  const apply = 'https://example.com/jobs/12345';
  for (const term of ['Worldwide 🌏', 'Full-time', 'Part-time', 'Релокация']) {
    const p = parseChannelPage(post(43,
      `#Analytics<br/>Plurio<br/>${term}<br/>Senior Marketing Analyst<br/><a href="${apply}">${apply}</a>`,
      { time: '2026-09-04T10:00:00+00:00' }), 'chan').posts[0];
    const job = postToJob(p, 'chan');
    assert.equal(job?.title, 'Senior Marketing Analyst', `the hashtag template skips a "${term}" line when choosing the title`);
    assert.equal(job?.company, 'Plurio');
  }
});

test('telegram-channel FORMAT_ONLY_RE does not backtrack exponentially on a word run', () => {
  // The separator in FORMAT_ONLY_RE may be empty, so without a word-end guard
  // "офисофис…1" could split between the \p{L}* tails in exponentially many
  // ways before the match failed: at 60 words the scan never returned.
  const apply = 'https://example.com/jobs/12345';
  const started = performance.now();
  const p = parseChannelPage(post(44,
    `#Analytics<br/>Plurio<br/>${'офис'.repeat(60)}1<br/><a href="${apply}">${apply}</a>`,
    { time: '2026-09-04T10:00:00+00:00' }), 'chan').posts[0];
  const job = postToJob(p, 'chan');
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 1000, `a run of 60 work-format words ending in a digit parsed in ${elapsed.toFixed(0)}ms`);
  assert.equal(job?.title.startsWith('офисофис'), true, 'the run line still becomes the title when nothing better exists');
});
