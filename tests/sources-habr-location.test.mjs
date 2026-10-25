/**
 * CAR-105 — Habr Career cards carry the CITY as a meta chip
 * («chip-with-icon__text">Пермь»), but the parser discarded it and emitted the
 * country string 'Russia' as `location`. A country centroid is exactly what
 * the #/map geocoder refuses (place_rank ≥ 12), so every Habr row landed in
 * the map's "without a location" bucket (92 % of vacancies had no dot).
 * The city chip feeds `location` now; the old fallbacks ('Remote' / 'Russia')
 * survive only when the card names no city. CI-isolated: pure parser tests.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let parseHabrCards;
before(async () => {
  ({ parseHabrCards } = await import('../server/lib/sources/habr.mjs'));
});

// Meta row = qualification · remote marker · CITY; skills live in their own
// section AFTER the meta row and must never read as a city.
const card = ({ city, remote = false, qual = 'Middle', skills = ['PHP'] }) =>
  `<section class="vacancies-list"><div class="vacancy-card">`
  + `<a class="vacancy-card__backdrop-link" href="/vacancies/1001"></a>`
  + `<div class="vacancy-card__inner"><div class="vacancy-card__info">`
  + `<div class="vacancy-card__company"><a class="link-comp" href="/c/x">Acme</a></div>`
  + `<div class="vacancy-card__title"><a class="vacancy-card__title-link" href="/vacancies/1001">Dev</a></div>`
  + `<div class="vacancy-card__meta">`
  + (qual ? `<div class="chip-with-icon__text">${qual}</div>` : '')
  + (remote ? `<div class="chip-with-icon__text">Можно удалённо</div>` : '')
  + (city ? `<div class="chip-with-icon__text">${city}</div>` : '')
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
