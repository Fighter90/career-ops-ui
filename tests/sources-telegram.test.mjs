/**
 * Telegram channel source — public `t.me/s/<channel>` web preview.
 *
 * CI-isolated: a fake fetchImpl serves a fixture shaped like the real page.
 * The fixture keeps only the three anchors the parser depends on — `data-post`,
 * `tgme_widget_message_text`, `<time datetime>` — because pinning cosmetic
 * markup would make this test fail on every Telegram restyle without telling
 * us anything true.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meta, assertTelegramUrl, normalizeChannel, buildChannelUrl,
  titleFromText, parseChannelPage, fetchTelegram, visibleText, companyName,
} from '../server/lib/sources/telegram.mjs';
import { telegramAdapter } from '../server/lib/portals/adapters/telegram.mjs';

const post = (chan, id, when, body) => `
  <div class="tgme_widget_message" data-post="${chan}/${id}">
    <div class="tgme_widget_message_text js-message_text">${body}</div>
    <time datetime="${when}"></time>
  </div>`;

const page = (chan, ...posts) => `<html><body>${posts.join('')}</body></html>`;
const okText = (html) => async () => ({ ok: true, status: 200, text: async () => html });

test('meta is registry-shaped', () => {
  assert.deepEqual(meta, { value: 'telegram', label: 'Telegram', region: 'en' });
});

test('assertTelegramUrl pins the host exactly — a lookalike must not pass', () => {
  assert.equal(assertTelegramUrl('https://t.me/s/rabotaphp'), 'https://t.me/s/rabotaphp');
  assert.throws(() => assertTelegramUrl('https://t.me.evil.test/s/x'), /untrusted hostname/);
  assert.throws(() => assertTelegramUrl('https://evil.test/t.me/s/x'), /untrusted hostname/);
  assert.throws(() => assertTelegramUrl('http://t.me/s/x'), /must use HTTPS/);
  assert.throws(() => assertTelegramUrl('not a url'), /invalid URL/);
});

test('normalizeChannel accepts every way a person writes a channel', () => {
  for (const input of ['rabotaphp', '@rabotaphp', 'https://t.me/rabotaphp',
    't.me/s/rabotaphp', 'https://t.me/rabotaphp/639', 'https://t.me/s/rabotaphp?x=1']) {
    assert.equal(normalizeChannel(input), 'rabotaphp', `failed on ${input}`);
  }
});

test('normalizeChannel rejects what Telegram itself would reject', () => {
  // Too short, illegal characters, leading digit, empty — all must yield ''
  // rather than a handle that would 404 or, worse, hit an unintended path.
  for (const bad of ['ab', 'bad!', '1channel', '', null, undefined, 'a'.repeat(40)]) {
    assert.equal(normalizeChannel(bad), '', `should reject ${JSON.stringify(bad)}`);
  }
});

test('buildChannelUrl targets the /s/ preview and refuses a junk handle', () => {
  assert.equal(buildChannelUrl({ channel: '@rabota_golang' }), 'https://t.me/s/rabota_golang');
  assert.throws(() => buildChannelUrl({ channel: '!!' }), /no usable channel handle/);
});

test('visibleText keeps prose that looks like markup but is not', () => {
  // The one-pass `/<[^>]+>/g` this replaced ate the whole span between the two
  // angle brackets, so a salary range vanished from the post body.
  assert.equal(visibleText('\u0437\u0430\u0440\u043f\u043b\u0430\u0442\u0430 < 300k, \u043e\u043f\u044b\u0442 > 3 \u043b\u0435\u0442'),
    '\u0437\u0430\u0440\u043f\u043b\u0430\u0442\u0430 < 300k, \u043e\u043f\u044b\u0442 > 3 \u043b\u0435\u0442');
  assert.equal(visibleText('Role <b>Dev</b><br/>Next'), 'Role Dev\nNext');
  assert.equal(visibleText('Senior <!-- ad --> Dev'), 'Senior Dev');
});

test('visibleText strips to a fixed point — a tag cannot be reassembled', () => {
  // Removing the inner <b> from `<<b>script>` re-forms `<script>`; one pass
  // would emit it. Nothing renders this unescaped today, but a stripper that
  // can be talked into emitting a tag is one refactor from mattering.
  assert.equal(visibleText('<<b>script>alert(1)<<b>/script>'), 'alert(1)');
  assert.equal(visibleText('a<<b>img src=x onerror=1>b'), 'ab');
  // Whatever survives the bounded loop must carry no tag: text, not markup.
  const pathological = visibleText('<'.repeat(40) + 'a' + '>'.repeat(40));
  assert.equal(/<\/?[a-zA-Z]/.test(pathological), false);

  // Deep nesting needs more passes than the loop allows — each pass strips only
  // the innermost tag. The fallback must not leave a reassembled tag behind, so
  // it drops the angle brackets outright rather than stripping one more time.
  let deep = 'script>alert(1)';
  for (let i = 0; i < 12; i++) deep = '<a' + deep;
  const exhausted = visibleText(deep);
  assert.equal(exhausted.includes('<'), false, 'the bounded fallback must emit no `<` at all');
  assert.equal(exhausted, 'alert(1)');
});

test('titleFromText takes the first substantive line, not an emoji divider', () => {
  assert.equal(titleFromText('⚡️\n\nSenior Go Developer в Яндекс\nОпыт от 3 лет'),
    'Senior Go Developer в Яндекс');
  assert.equal(titleFromText('— — —\n🔥\nPHP разработчик'), 'PHP разработчик');
  assert.equal(titleFromText('   \n\n'), '');
});

test('parseChannelPage lifts title, permalink, date and salary from a real-shaped post', () => {
  const html = page('salary_pm',
    post('salary_pm', 331, '2026-07-31T16:00:14+00:00',
      'Junior Продакт Менеджер в VK<br>Компания: VK<br>Локация: Москва<br>Вилка: 135 000 ₽'));
  const [job] = parseChannelPage(html, 'salary_pm');
  assert.equal(job.title, 'Junior Продакт Менеджер в VK');
  assert.equal(job.url, 'https://t.me/salary_pm/331', 'the permalink is the only stable URL a post has');
  assert.equal(job.company, 'VK', 'a named company beats the channel fallback');
  assert.equal(job.location, 'Москва');
  assert.equal(job.salary, '135 000 ₽');
  assert.equal(job.date, '2026-07-31T16:00:14.000Z');
  assert.equal(job.source, 'telegram');
  assert.match(job.id, /^telegram-salary_pm-331$/);
});

test('a labelled company yields the NAME, not the sentence after it', () => {
  // Capping the whole line at 60 chars put rows like
  // `FinCore Technology (продуктовая разработка, высоконагруженны` into the
  // tracker — cut mid-word, and no longer a company name. This source
  // attributes a company as fact, so a truncated sentence is as wrong as a
  // guessed name, only less obviously so.
  assert.equal(companyName('Fora Soft (Фора Софт) (Санкт-Петербург, Россия), мы делаем видео'), 'Fora Soft');
  assert.equal(companyName('FinCore Technology (продуктовая разработка, высоконагруженные системы)'), 'FinCore Technology');
  assert.equal(companyName('Birmarket - крупнейший маркетплейс Азербайджана, работает с 2019'), 'Birmarket');
});

test('a hyphen inside a name is not a separator — only a spaced dash is', () => {
  assert.equal(companyName('Coca-Cola'), 'Coca-Cola');
  assert.equal(companyName('Hewlett-Packard — enterprise hardware'), 'Hewlett-Packard');
  assert.equal(companyName('ООО «Ромашка»'), 'ООО «Ромашка»');
});

test('a name with no separator is capped on a word boundary, never mid-word', () => {
  const long = companyName('Международная производственная корпорация специального машиностроения имени Кого-то');
  assert.ok(long.length <= 60);
  assert.equal(/\s$/.test(long), false, 'no trailing space');
  assert.ok(!long.endsWith('специальн'), 'must not cut inside a word');
  assert.ok('Международная производственная корпорация специального машиностроения имени Кого-то'.startsWith(long));
});

test('an unnamed company falls back to the channel, never to a guess', () => {
  // Attributing a post to the wrong employer is worse than admitting we do not
  // know: the value ends up in the tracker as fact.
  const html = page('forproducts', post('forproducts', 7, '2026-08-01T00:00:00+00:00', 'Product Manager, финтех'));
  const [job] = parseChannelPage(html, 'forproducts');
  assert.equal(job.company, '@forproducts');
});

test('remote is inferred from either language', () => {
  // The negative matters as much as the positives: "Отдалённый регион" is a
  // remote REGION, not remote work, and an ASCII \b would have matched inside
  // it — the same boundary bug the title filter hit in v1.227.3.
  for (const [body, want] of [['Go dev, удалёнка', true], ['Go dev, удалённо', true],
    ['Go dev, remote', true], ['Go dev, релокация', true],
    ['Go dev, офис Москва', false], ['Вакансия в Отдалённый регион', false]]) {
    const html = page('c', post('c', 1, '2026-08-01T00:00:00+00:00', body));
    assert.equal(parseChannelPage(html, 'c')[0].isRemote, want, body);
  }
});

test('media-only and service posts are skipped, not emitted as blanks', () => {
  const html = `<div class="tgme_widget_message" data-post="c/1"><time datetime="2026-08-01T00:00:00+00:00"></time></div>`
    + page('c', post('c', 2, '2026-08-01T00:00:00+00:00', 'PHP разработчик'));
  const jobs = parseChannelPage(html, 'c');
  assert.equal(jobs.length, 1, 'the text-less post must not become an empty row');
  assert.equal(jobs[0].url, 'https://t.me/c/2');
});

test('fetchTelegram normalizes a page through an injected fetch', async () => {
  const html = page('rabotaphp',
    post('rabotaphp', 1, '2026-08-01T00:00:00+00:00', 'PHP Symfony разработчик'),
    post('rabotaphp', 2, '2026-08-02T00:00:00+00:00', 'Go разработчик'));
  const jobs = await fetchTelegram('https://t.me/s/rabotaphp', { fetchImpl: okText(html) });
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs.map((j) => j.url),
    ['https://t.me/rabotaphp/1', 'https://t.me/rabotaphp/2']);
});

test('a page with no parseable posts throws instead of reporting "no vacancies"', async () => {
  // t.me answers a private or missing channel with a redirect/landing page.
  // Returning [] there would read as "nothing new today" and hide a typo in
  // the config forever — exactly what happened with a mistyped handle.
  await assert.rejects(
    () => fetchTelegram('https://t.me/s/nope', { fetchImpl: okText('<html><body>nothing</body></html>') }),
    /no posts parsed/,
  );
});

test('max_posts caps the result and is itself bounded', async () => {
  const many = page('c', ...Array.from({ length: 40 }, (_, i) =>
    post('c', i + 1, '2026-08-01T00:00:00+00:00', `Роль номер ${i + 1}`)));
  const capped = await fetchTelegram('https://t.me/s/c', { fetchImpl: okText(many), company: { max_posts: 5 } });
  assert.equal(capped.length, 5);
  const huge = await fetchTelegram('https://t.me/s/c', { fetchImpl: okText(many), company: { max_posts: 99999 } });
  assert.equal(huge.length, 40, 'the ceiling clamps, it does not invent rows');
});

test('adapter matches only on an explicit provider and host-pins any override', () => {
  assert.equal(telegramAdapter.matches({ provider: 'telegram' }), true);
  assert.equal(telegramAdapter.matches({ careers_url: 'https://t.me/rabotaphp' }), false,
    'a t.me link in a config must not silently become a scan target');
  assert.equal(telegramAdapter.buildEndpoint({ channel: 'godevjob' }), 'https://t.me/s/godevjob');
  assert.equal(telegramAdapter.buildEndpoint({ channel: 'godevjob', api: 'https://evil.test/x' }),
    'https://t.me/s/godevjob', 'an off-host override is ignored, not fetched');
});

// ── telegram_channels: config block (v1.228.0) ───────────────────────
//
// Channels started life as fifteen `tracked_companies` entries. That was four
// lines each of boilerplate for something that is not a company, and it buried
// the actual employers in the middle of the list. They now live in their own
// top-level block, expanded at load time into ordinary adapter-selected
// entries — so quarantine, filters, dedup and the per-source cap keep working
// through exactly one scan path rather than two.

test('expandTelegramChannels accepts a bare handle, an @handle and a full object', async () => {
  const { expandTelegramChannels } = await import('../server/lib/en-scanner.mjs');
  const out = expandTelegramChannels({
    channels: ['rabotaphp', '@salary_pm', { name: 'Go работа', channel: 'rabota_golang' }],
  });
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((e) => e.channel), ['rabotaphp', '@salary_pm', 'rabota_golang']);
  assert.ok(out.every((e) => e.provider === 'telegram'), 'every entry must route to the adapter');
  // The handle doubles as the display name when none is given: it is what the
  // user typed and what they will recognise in the results table.
  assert.equal(out[0].name, 'rabotaphp');
  assert.equal(out[2].name, 'Go работа');
});

test('the block-level switch silences every channel at once', async () => {
  const { expandTelegramChannels } = await import('../server/lib/en-scanner.mjs');
  assert.deepEqual(expandTelegramChannels({ enabled: false, channels: ['a', 'b'] }), [],
    'one flag must turn all of them off without editing fifteen lines');
  // A per-channel flag still works independently.
  const one = expandTelegramChannels({ channels: [{ channel: 'a', enabled: false }, 'b'] });
  assert.deepEqual(one.map((e) => e.enabled), [false, true]);
});

test('max_posts cascades from the block and is overridable per channel', async () => {
  const { expandTelegramChannels } = await import('../server/lib/en-scanner.mjs');
  const out = expandTelegramChannels({
    max_posts: 100,
    channels: ['a', { channel: 'b', max_posts: 20 }],
  });
  assert.equal(out[0].max_posts, 100);
  assert.equal(out[1].max_posts, 20);
});

test('an absent or malformed block costs nothing', async () => {
  const { expandTelegramChannels } = await import('../server/lib/en-scanner.mjs');
  for (const input of [undefined, null, {}, { channels: [] }, 'nonsense', 42, { channels: 'nope' }]) {
    assert.deepEqual(expandTelegramChannels(input), [], `should be empty for ${JSON.stringify(input)}`);
  }
  // A junk entry is skipped, not turned into a nameless scan target.
  assert.deepEqual(expandTelegramChannels({ channels: [null, '', { name: 'x' }] }), []);
});
