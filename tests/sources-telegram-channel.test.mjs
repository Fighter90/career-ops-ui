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
