/**
 * CAR-105 — Habr Career cards carry the CITY as a meta chip
 * («chip-with-icon__text">Пермь»), but the parser discarded it and emitted the
 * country string 'Russia' as `location`. A country centroid is exactly what
 * the #/map geocoder refuses (place_rank ≥ 12), so every Habr row landed in
 * the map's "without a location" bucket (92 % of vacancies had no dot).
 * The city chip feeds `location` now; the old fallbacks ('Remote' / 'Russia')
 * survive only when the card names no city. CI-isolated: pure parser tests.
 *
 * CAR-142 — "the first chip that is not the remote marker or a qualification"
 * is not a city selector: a city-less card whose meta row ends with
 * «Возможна релокация» wore that text as its location, and employment-type
 * chips («Полный рабочий день», «Полная занятость», «Стажировка») leak into
 * `location` the same way. The real city chip is structurally marked (Habr
 * links it to the city-filtered board via ?city_id=…), so that chip wins when
 * present and relocation/employment chips are never candidates at all.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let parseHabrCards;
before(async () => {
  ({ parseHabrCards } = await import('../server/lib/sources/habr.mjs'));
});

// Meta row = qualification · remote marker · CITY; skills live in their own
// section AFTER the meta row and must never read as a city. `extra` adds a
// further meta chip (relocation notice, employment type …) and `linked`
// wraps the city chip the way Habr does — in a link to the city-filtered
// board (?city_id=…).
const chipEl = (text) => `<div class="chip-with-icon__text">${text}</div>`;
const card = ({ city, remote = false, qual = 'Middle', skills = ['PHP'], extra = null, linked = false }) =>
  `<section class="vacancies-list"><div class="vacancy-card">`
  + `<a class="vacancy-card__backdrop-link" href="/vacancies/1001"></a>`
  + `<div class="vacancy-card__inner"><div class="vacancy-card__info">`
  + `<div class="vacancy-card__company"><a class="link-comp" href="/c/x">Acme</a></div>`
  + `<div class="vacancy-card__title"><a class="vacancy-card__title-link" href="/vacancies/1001">Dev</a></div>`
  + `<div class="vacancy-card__meta">`
  + (qual ? chipEl(qual) : '')
  + (extra ? chipEl(extra) : '')
  + (remote ? chipEl('Можно удалённо') : '')
  + (city ? (linked
      ? `<a class="link-comp" href="/companies/acme/vacancies?city_id=437">${chipEl(city)}</a>`
      : chipEl(city)) : '')
  + `</div>`
  + `<div class="vacancy-card__skills">`
  + skills.map((s) => `<a class="basic-chip vacancy-card__skills-chip" href="/s"><div class="chip-with-icon__text">${s}</div></a>`).join('')
  + `</div></div></div></div></section>`;

test('parseHabrCards: the meta city chip becomes the location (was: Russia)', () => {
  const [j] = parseHabrCards(card({ city: 'Пермь' }));
  assert.equal(j.location, 'Пермь');
  assert.equal(j.isRemote, false);
});

test('parseHabrCards: a remote posting keeps its city (the map can pin it)', () => {
  const [j] = parseHabrCards(card({ city: 'Москва', remote: true }));
  assert.equal(j.location, 'Москва');
  assert.equal(j.isRemote, true);
});

test('parseHabrCards: skill chips are never read as a city', () => {
  const [j] = parseHabrCards(card({ city: 'Новосибирск', skills: ['PHP', 'PostgreSQL'] }));
  assert.equal(j.location, 'Новосибирск');
});

test('parseHabrCards: no city chip keeps the old fallbacks (Remote / Russia)', () => {
  const [remote] = parseHabrCards(card({ remote: true, city: null }));
  assert.equal(remote.location, 'Remote');
  const [office] = parseHabrCards(card({ remote: false, city: null }));
  assert.equal(office.location, 'Russia');
});

test('parseHabrCards: qualification chips are not cities (Cyrillic + Latin levels)', () => {
  for (const qual of ['Senior', 'Ведущий (Lead)', 'Стажёр (Intern)']) {
    const [j] = parseHabrCards(card({ qual, city: null }));
    assert.equal(j.location, 'Russia', qual);
  }
});

test('parseHabrCards: entity-encoded city decodes', () => {
  const [j] = parseHabrCards(card({ city: 'Ростов-на-Дону &amp; область' }));
  assert.equal(j.location, 'Ростов-на-Дону & область');
});

// CAR-142 — the relocation chip is detected as `relocates` but must never be
// picked as the location of a card that names no city.
test('CAR-142: the relocation chip never becomes the location', () => {
  const [j] = parseHabrCards(card({ qual: 'Middle', city: null, extra: 'Возможна релокация' }));
  assert.equal(j.relocates, true, 'the relocation signal itself is kept');
  assert.equal(j.location, 'Russia', 'the fallback survives — the chip text is not a place');
});

test('CAR-142: employment-type chips never become the location', () => {
  for (const chip of ['Полный рабочий день', 'Неполный рабочий день', 'Полная занятость', 'Стажировка', 'Сменный график']) {
    const [j] = parseHabrCards(card({ city: null, extra: chip }));
    assert.equal(j.location, 'Russia', chip);
  }
});

test('CAR-142: relocation and employment chips next to a real city keep the city', () => {
  const [a] = parseHabrCards(card({ city: 'Казань', extra: 'Возможна релокация' }));
  assert.equal(a.location, 'Казань');
  const [b] = parseHabrCards(card({ city: 'Москва', extra: 'Полный рабочий день' }));
  assert.equal(b.location, 'Москва');
});

test('CAR-142: a structurally marked city chip wins over an earlier plain chip', () => {
  // «Оформление по ТК» passes every text filter but is no city; the linked
  // (?city_id=…) chip is picked instead.
  const [j] = parseHabrCards(card({ city: 'Пермь', linked: true, extra: 'Оформление по ТК' }));
  assert.equal(j.location, 'Пермь');
});
