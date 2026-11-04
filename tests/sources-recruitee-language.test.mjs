/**
 * Recruitee language versions — CAR-223, the parent's preferred_languages
 * stack ported to the web-ui recruitee source (career-ops #5285 ff092313,
 * built on the languageVersions machinery of #5264 a0317de3).
 *
 * The contract under test:
 *   - every row may carry an OPTIONAL `language` ('en' | 'de' | …) naming the
 *     language version it serves; a tagged row carries the same code as
 *     `?lang=` on its URL, so the language versions of one offer share a
 *     dedup key once the scanner strips language params;
 *   - `preferred_languages` reaches the source either as an explicit
 *     `preferredLanguageRank` (scan-wide, threaded by the scanner) or as the
 *     portals entry's own `preferred_languages` list (via opts.company);
 *   - a `?lang=` on the entry's careers_url asks for that language for that
 *     entry, and wins over the preferred list;
 *   - `dedupIncludeLanguage` returns every version, the default one first.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecruiteeResponse, fetchRecruitee } from '../server/lib/sources/recruitee.mjs';
import { preferredLanguageRanker } from '../server/lib/language-preferences.mjs';

// ── Fixtures (parent tests/providers/recruitee.test.mjs shapes) ─────
// Default language de: the top-level fields equal the `de` translation,
// whatever its key order in `translations`.
const bilingual = {
  title: 'Senior QA Engineer (m/w/d)',
  careers_url: 'https://acme.recruitee.com/o/senior-qa',
  description: '<p>Acme baut Software.</p>',
  requirements: '<p>Playwright</p>',
  location: 'Berlin, Germany',
  translations: {
    en: { title: 'Senior QA Engineer (m/f/d)', description: '<p>Acme builds software.</p>', requirements: '<p>Playwright. German is not required.</p>' },
    de: { title: 'Senior QA Engineer (m/w/d)', description: '<p>Acme baut Software.</p>', requirements: '<p>Playwright</p>' },
  },
};

// No translation equals the top-level fields → the default language is
// unknown.
const unknownDefaultOffer = {
  title: 'Backend Engineer (m/w/d)',
  careers_url: 'https://acme.recruitee.com/o/backend',
  description: '<p>Top level</p>',
  translations: {
    de: { title: 'Backend Engineer (m/w/d)', description: '<p>Top level, edited</p>' },
    en: { title: 'Backend Engineer (m/f/d)', description: '<p>English</p>' },
  },
};

// ── Default-language detection and tagging ──────────────────────────
test('recruitee: the default version only, tagged with its language in `language` and ?lang=', () => {
  const jobs = parseRecruiteeResponse({ offers: [bilingual] }, 'Acme');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].language, 'de');
  assert.equal(jobs[0].url, 'https://acme.recruitee.com/o/senior-qa?lang=de');
  assert.equal(jobs[0].title, 'Senior QA Engineer (m/w/d)');
});

test('recruite: a translation is the default when its whole text matches, key order irrelevant', () => {
  // The `de` key comes second in `translations`; it still wins as the default.
  const jobs = parseRecruiteeResponse({ offers: [bilingual] }, 'Acme');
  assert.equal(jobs[0].language, 'de');
});

test('recruitee: web-ui row shape survives — shared fields on every version, language optional', () => {
  const jobs = parseRecruiteeResponse({ offers: [bilingual] }, 'Acme', { allLanguages: true });
  for (const row of jobs) {
    assert.equal(row.company, 'Acme');
    assert.equal(row.location, 'Berlin, Germany');
    assert.equal(row.source, 'recruitee');
    assert.equal(row.salary, '');
    assert.equal(row.date, '');
    assert.equal(row.id, `recruitee-${row.url}`);
    assert.equal(row.isRemote, false);
  }
});

// ── allLanguages (scan_history.dedup_include_language) ──────────────
test('recruitee: allLanguages returns every version, default first though its key comes second', () => {
  const jobs = parseRecruiteeResponse({ offers: [bilingual] }, 'Acme', { allLanguages: true });
  assert.deepEqual(jobs.map((j) => j.language), ['de', 'en']);
  assert.equal(jobs[1].title, 'Senior QA Engineer (m/f/d)');
  assert.equal(jobs[1].description, 'Acme builds software. Playwright. German is not required.');
  assert.equal(jobs[1].url, 'https://acme.recruitee.com/o/senior-qa?lang=en');
});

test('recruitee: allLanguages with no matching default → every translation, tagged, in API order', () => {
  const jobs = parseRecruiteeResponse({ offers: [unknownDefaultOffer] }, 'Acme', { allLanguages: true });
  assert.deepEqual(jobs.map((j) => [j.language, j.url, j.description]), [
    ['de', 'https://acme.recruitee.com/o/backend?lang=de', 'Top level, edited'],
    ['en', 'https://acme.recruitee.com/o/backend?lang=en', 'English'],
  ]);
});

test('recruitee: a copy under another label, an untitled translation and a malformed key are no versions', () => {
  const jobs = parseRecruiteeResponse({ offers: [{
    title: 'Founder Associate (m/w/d)',
    careers_url: 'https://acme.recruitee.com/o/founder-associate',
    description: '<p>Same text</p>',
    requirements: '<p>Same list</p>',
    translations: {
      de: { title: 'Founder Associate (m/w/d)', description: '<p>Same text</p>', requirements: '<p>Same list</p>' },
      en: { title: 'Founder Associate (m/w/d)', description: '<p>Same text</p>', requirements: '<p>Same list</p>' },
      fr: { title: '  ', description: '<p>Texte</p>', requirements: '<p>Liste</p>' },
      'en US/../x': { title: 'Bad key', description: '<p>x</p>', requirements: '<p>y</p>' },
    },
  }] }, 'Acme', { allLanguages: true });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].language, 'de');
});

test('recruitee: a translation differing only in markup and whitespace is a copy, skipped', () => {
  const jobs = parseRecruiteeResponse({ offers: [{
    title: 'Founder Associate (m/w/d)',
    careers_url: 'https://acme.recruitee.com/o/founder-associate',
    description: '<p>Same text</p>',
    requirements: '<p>Same list</p>',
    translations: {
      de: { title: 'Founder Associate (m/w/d)', description: '<p>Same text</p>', requirements: '<p>Same list</p>' },
      en: { title: ' Founder Associate (m/w/d) ', description: '<div>Same   text</div>', requirements: '<ul><li>Same list</li></ul>' },
    },
  }] }, 'Acme', { allLanguages: true });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].language, 'de');
});

test('recruitee: the default is matched by title, description AND requirements together', () => {
  const jobs = parseRecruiteeResponse({ offers: [{
    title: 'Data Engineer (m/w/d)',
    careers_url: 'https://acme.recruitee.com/o/data',
    description: '<p>Acme</p>',
    requirements: null,
    translations: {
      en: { title: 'Data Engineer (m/w/d)', description: '<p>Acme</p>', requirements: '<p>English is enough.</p>' },
      de: { title: 'Data Engineer (m/w/d)', description: '<p>Acme</p>', requirements: '' },
    },
  }] }, 'Acme', { allLanguages: true });
  assert.deepEqual(jobs.map((j) => [j.language, j.description]), [
    ['de', 'Acme'],
    ['en', 'Acme English is enough.'],
  ]);
});

test('recruitee: an offer with no usable translation comes back once, untagged', () => {
  const jobs = parseRecruiteeResponse({ offers: [{
    title: 'Plain Offer', careers_url: 'https://acme.recruitee.com/o/plain',
    translations: { fr: { title: '  ', description: '<p>x</p>' } },
  }] }, 'Acme', { allLanguages: true });
  assert.equal(jobs.length, 1);
  assert.equal('language' in jobs[0], false);
  assert.equal(jobs[0].url, 'https://acme.recruitee.com/o/plain');
});

// ── preferred_languages ─────────────────────────────────────────────
test('recruitee: preferredLanguageRank adds the preferred translation next to the default, and no other', () => {
  const trilingual = {
    ...bilingual,
    translations: {
      ...bilingual.translations,
      fr: { title: 'Ingénieur QA senior (h/f)', description: '<p>Acme crée des logiciels.</p>', requirements: '<p>Playwright</p>' },
    },
  };
  const jobs = parseRecruiteeResponse({ offers: [trilingual] }, 'Acme', { preferredLanguageRank: preferredLanguageRanker(['fr']) });
  assert.deepEqual(jobs.map((j) => j.language), ['de', 'fr']);
  assert.equal(jobs[1].url, 'https://acme.recruitee.com/o/senior-qa?lang=fr');
});

test('recruitee: no translation in a preferred language → the default version alone', () => {
  const jobs = parseRecruiteeResponse({ offers: [bilingual] }, 'Acme', { preferredLanguageRank: preferredLanguageRanker(['fr']) });
  assert.deepEqual(jobs.map((j) => j.language), ['de']);
});

test('recruitee: no rank function (or no preferred list) behaves as before', () => {
  const jobs = parseRecruiteeResponse({ offers: [bilingual] }, 'Acme');
  assert.deepEqual(jobs.map((j) => j.language), ['de']);
});

test('recruitee: with no default version, the best-ranked translation comes back alone', () => {
  const trilingualUnknownDefault = {
    ...unknownDefaultOffer,
    translations: {
      ...unknownDefaultOffer.translations,
      fr: { title: 'Ingénieur backend (h/f)', description: '<p>Français</p>' },
    },
  };
  const cases = [
    ['de, en preferred → de', ['de', 'en'], ['de']],
    ['en, de preferred → en', ['en', 'de'], ['en']],
    ['es, fr, en preferred → fr, the best-ranked the offer has', ['es', 'fr', 'en'], ['fr']],
    ['only languages the offer lacks → top-level fields, no language', ['es'], [undefined]],
  ];
  for (const [label, preferred, expected] of cases) {
    const jobs = parseRecruiteeResponse({ offers: [trilingualUnknownDefault] }, 'Acme', { preferredLanguageRank: preferredLanguageRanker(preferred) });
    assert.deepEqual(jobs.map((j) => j.language), expected, label);
  }
});

test('recruitee: fetchRecruitee threads ctx.preferredLanguageRank through', async () => {
  const trilingual = {
    ...bilingual,
    translations: {
      ...bilingual.translations,
      en: bilingual.translations.en,
    },
  };
  const jobs = await fetchRecruitee('https://acme.recruitee.com/api/offers/', {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ offers: [trilingual] }) }),
    company: { name: 'Acme' },
    preferredLanguageRank: preferredLanguageRanker(['en']),
  });
  assert.deepEqual(jobs.map((j) => j.language), ['de', 'en']);
});

test('recruitee: the portals entry\'s own preferred_languages list ranks too', async () => {
  const jobs = await fetchRecruitee('https://acme.recruitee.com/api/offers/', {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ offers: [bilingual] }) }),
    company: { name: 'Acme', preferred_languages: ['en'] },
  });
  assert.deepEqual(jobs.map((j) => j.language), ['de', 'en']);
});

test('recruitee: an explicit rank wins over the entry-level preferred_languages list', async () => {
  const jobs = await fetchRecruitee('https://acme.recruitee.com/api/offers/', {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ offers: [bilingual] }) }),
    company: { name: 'Acme', preferred_languages: ['fr'] },
    preferredLanguageRank: preferredLanguageRanker(['en']),
  });
  assert.deepEqual(jobs.map((j) => j.language), ['de', 'en']);
});

test('recruitee: a junk preferred_languages entry list behaves as no preference', async () => {
  const jobs = await fetchRecruitee('https://acme.recruitee.com/api/offers/', {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ offers: [bilingual] }) }),
    company: { name: 'Acme', preferred_languages: { en: true } },
  });
  assert.deepEqual(jobs.map((j) => j.language), ['de']);
});

// ── dedupIncludeLanguage threading ──────────────────────────────────
test('recruitee: fetchRecruitee returns further versions only when dedupIncludeLanguage is set', async () => {
  const stub = async () => ({ ok: true, status: 200, json: async () => ({ offers: [bilingual] }) });
  const fetchedDefault = await fetchRecruitee('https://acme.recruitee.com/api/offers/', { fetchImpl: stub, company: { name: 'Acme' } });
  const fetchedAll = await fetchRecruitee('https://acme.recruitee.com/api/offers/', { fetchImpl: stub, company: { name: 'Acme' }, dedupIncludeLanguage: true });
  assert.equal(fetchedDefault.length, 1);
  assert.equal(fetchedAll.length, 2);
});

test('recruitee: the entry\'s own dedup_include_language also turns allLanguages on', async () => {
  const jobs = await fetchRecruitee('https://acme.recruitee.com/api/offers/', {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ offers: [bilingual] }) }),
    company: { name: 'Acme', dedup_include_language: true },
  });
  assert.equal(jobs.length, 2);
});

// ── A ?lang= on the entry's careers_url ─────────────────────────────
const fetchLanguages = async (offer, careersUrl, extra = {}) => (await fetchRecruitee(
  'https://acme.recruitee.com/api/offers/',
  {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ offers: [offer] }) }),
    company: { name: 'Acme', careers_url: careersUrl },
    ...extra,
  },
)).map((v) => `${v.language}|${v.url.replace(/^https:\/\/acme\.recruitee\.com\/o\/[a-z-]+/, '')}`);

test('recruitee: ?lang=en on careers_url → the English version alone', async () => {
  assert.deepEqual(
    await fetchLanguages(bilingual, 'https://acme.recruitee.com/?lang=en'),
    ['en|?lang=en'],
  );
});

test('recruitee: ?lang= naming a language the offer lacks → the default version', async () => {
  assert.deepEqual(
    await fetchLanguages(bilingual, 'https://acme.recruitee.com/?lang=es'),
    ['de|?lang=de'],
  );
});

test('recruitee: ?lang= wins over the preferred languages', async () => {
  assert.deepEqual(
    await fetchLanguages(bilingual, 'https://acme.recruitee.com/?lang=EN', { preferredLanguageRank: preferredLanguageRanker(['fr']) }),
    ['en|?lang=en'],
  );
});

test('recruitee: a malformed ?lang= is ignored', async () => {
  assert.deepEqual(
    await fetchLanguages(bilingual, 'https://acme.recruitee.com/?lang=en%20US'),
    ['de|?lang=de'],
  );
});

test('recruitee: with dedupIncludeLanguage every version comes back regardless of ?lang=', async () => {
  const trilingual = {
    ...bilingual,
    translations: {
      ...bilingual.translations,
      fr: { title: 'Ingénieur QA senior (h/f)', description: '<p>Acme crée des logiciels.</p>', requirements: '<p>Playwright</p>' },
    },
  };
  assert.deepEqual(
    await fetchLanguages(trilingual, 'https://acme.recruitee.com/?lang=en', { dedupIncludeLanguage: true }),
    ['de|?lang=de', 'en|?lang=en', 'fr|?lang=fr'],
  );
});

test('recruitee: no default version, ?lang=en → the English translation', async () => {
  assert.deepEqual(
    await fetchLanguages(unknownDefaultOffer, 'https://acme.recruitee.com/?lang=en'),
    ['en|?lang=en'],
  );
});

test('recruitee: no default version, ?lang= the offer lacks → top-level fields, no language', async () => {
  assert.deepEqual(
    await fetchLanguages(unknownDefaultOffer, 'https://acme.recruitee.com/?lang=es', { preferredLanguageRank: preferredLanguageRanker(['fr']) }),
    ['undefined|'],
  );
});

test('recruitee: a careers_url off the recruitee host names no entry language', async () => {
  const jobs = await fetchRecruitee('https://acme.recruitee.com/api/offers/', {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ offers: [bilingual] }) }),
    company: { name: 'Acme', careers_url: 'https://careers.acme.com/?lang=en' },
  });
  assert.deepEqual(jobs.map((j) => j.language), ['de']);
});

// ── Offers without translations are untouched ───────────────────────
test('recruitee: an offer without translations is one untagged row, unchanged', () => {
  const jobs = parseRecruiteeResponse({
    offers: [{ title: 'Frontend', careers_url: 'https://careers.acme.com/1', city: 'Lisbon', country: 'PT', remote: true }],
  }, 'Acme');
  assert.equal(jobs.length, 1);
  assert.equal('language' in jobs[0], false);
  assert.equal(jobs[0].url, 'https://careers.acme.com/1');
  assert.equal(jobs[0].isRemote, true);
  assert.equal(jobs[0].description, '');
});
