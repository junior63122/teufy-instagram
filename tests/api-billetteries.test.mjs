// API officielles des billetteries : conversion au format commun, identifiants Eventbrite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idEventbrite, depuisEventbrite, depuisTicketmaster } from '../src/api-billetteries.mjs';

test('identifiant Eventbrite tiré de l\'adresse de la page', () => {
  assert.equal(idEventbrite('https://www.eventbrite.fr/e/nice-new-years-eve-tickets-2004295126678'), '2004295126678');
  assert.equal(idEventbrite('https://www.eventbrite.it/e/art1nder-cannes-tickets-2004357094024?aff=x'), '2004357094024');
  assert.equal(idEventbrite('https://shotgun.live/events/x'), null);
});

test('Eventbrite et Ticketmaster → format commun, prix et heure réels seulement', () => {
  const e = depuisEventbrite({ name: { text: 'Soirée' }, start: { utc: '2026-11-28T21:00:00Z' }, url: 'u', is_free: false,
    ticket_availability: { minimum_ticket_price: { major_value: '12.00' } }, venue: { name: 'High Club', address: { city: 'Nice', country: 'FR', localized_address_display: 'Promenade, Nice' } } });
  assert.equal(e.pays, 'FR');
  assert.deepEqual([e.name, e.start, e.price, e.city, e.venue], ['Soirée', '2026-11-28T21:00:00.000Z', 12, 'Nice', 'High Club']);
  const t = depuisTicketmaster({ name: 'Concert', url: 'u', dates: { start: { dateTime: '2026-12-05T19:30:00Z' } }, _embedded: { venues: [{ name: 'Palais Nikaïa', city: { name: 'Nice' } }] },
    classifications: [{ genre: { name: 'Hip-Hop/Rap' }, subGenre: { name: 'Undefined' } }], images: [{ url: 'a', width: 100 }, { url: 'b', width: 1000 }] });
  assert.deepEqual([t.start, t.venue, t.image, t.price, t.tags], ['2026-12-05T19:30:00.000Z', 'Palais Nikaïa', 'b', null, ['Hip-Hop/Rap']]);
});

test('rubrique d\'une soirée : Côte, Occitanie, grandes villes, ou rien', async () => {
  const { rubriqueDe } = await import('../src/sources.mjs');
  assert.equal(rubriqueDe({ city: 'Nice' }), 'cote');
  assert.equal(rubriqueDe({ city: 'Toulon' }), 'cote');
  assert.equal(rubriqueDe({ city: 'Montpellier' }), 'occitanie');
  assert.equal(rubriqueDe({ city: 'Lyon' }), 'france');
  assert.equal(rubriqueDe({ city: 'Aix-en-Provence' }), 'france');
  assert.equal(rubriqueDe({ city: 'Berlin' }), '');
});

test('agendas : lecture du CSV (guillemets, séparateur) et colonnes reconnues par leur nom', async () => {
  const { ligneCsv, colonnes } = await import('../src/agendas.mjs');
  assert.deepEqual(ligneCsv('a;"b; c";"d ""e"""', ';'), ['a', 'b; c', 'd "e"']);
  const C = colonnes(['Nom_du_POI', 'Date_debut', 'Date_fin', 'Commune', 'Code_postal', 'Adresse_postale', 'Site_web', 'Categories_de_POI', 'Description']);
  assert.deepEqual([C.nom, C.debut, C.fin, C.commune, C.cp, C.adresse, C.url, C.categories, C.description], [0, 1, 2, 3, 4, 5, 6, 7, 8]);
});

test('agendas : CSV avec un champ sur plusieurs lignes', async () => {
  const { lignesCsv } = await import('../src/agendas.mjs');
  assert.deepEqual([...lignesCsv('nom;desc\n"Soirée";"ligne 1\nligne 2"\nB;x\n', ';')], [['nom', 'desc'], ['Soirée', 'ligne 1\nligne 2'], ['B', 'x']]);
});

test('agendas : prochaine date lisible (plusieurs dates, format français)', async () => {
  const { prochaineDate } = await import('../src/agendas.mjs');
  const m = Date.parse('2026-11-23T10:00:00Z');
  assert.equal(new Date(prochaineDate('2026-11-20|2026-11-27', m)).toISOString().slice(0, 10), '2026-11-27');
  assert.equal(new Date(prochaineDate('28/11/2026', m)).toISOString().slice(0, 10), '2026-11-28');
  assert.equal(new Date(prochaineDate('2026-11-29T22:00:00+01:00', m)).toISOString(), '2026-11-29T21:00:00.000Z');
  assert.equal(prochaineDate('bientôt', m), null);
});
