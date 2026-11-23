// 23/11/2026 (directeur : « ça met que c'est ce soir alors que c'est durant la journée, ça prête à confusion ») :
// « Ce soir » ne montre que ce qui commence entre 17 h et 6 h (heure de Paris) ; les dégustations ne sont pas des soirées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { duSoir } = await import('../src/site.mjs');
const { PAS_SOIREE } = await import('../src/recherche.mjs');

test('ce soir : une dégustation à midi n\'est pas « ce soir », une soirée à 23 h ou à 1 h du matin oui', () => {
  assert.equal(duSoir({ debut: '2026-11-23T12:00:00+01:00' }), false);
  assert.equal(duSoir({ debut: '2026-11-23T16:30:00+01:00' }), false);
  assert.equal(duSoir({ debut: '2026-11-23T17:00:00+01:00' }), true);
  assert.equal(duSoir({ debut: '2026-11-23T23:30:00+01:00' }), true);
  assert.equal(duSoir({ debut: '2026-11-24T01:00:00+01:00' }), true);
  assert.equal(duSoir({ debut: '2026-07-10T18:00:00+02:00' }), true); // heure d'été
});

test('dégustations de vin écartées, en français comme en anglais ; une vraie soirée passe', () => {
  assert.ok(PAS_SOIREE.test('French Riviera: 3 Local Wines & French Cheese Tasting'));
  assert.ok(PAS_SOIREE.test('Wine tasting in Nice old town'));
  assert.ok(PAS_SOIREE.test('Dégustation de vins au domaine'));
  assert.ok(!PAS_SOIREE.test('Techno Night au Frigo 16'));
  assert.ok(!PAS_SOIREE.test('Wine Bar Party · DJ set house'));
});

test('événement en ligne sans lieu (webinaire Eventbrite) jamais pris pour une soirée de la Côte ; page ville sans lieu gardée', async () => {
  const { isCoteAzur } = await import('../src/sources.mjs');
  const villes = ['Nice', 'Cannes'];
  assert.equal(isCoteAzur({ source: 'eventbrite', name: 'HBR Book Webinar: Unspeakable', city: '', address: '', venue: '' }, villes), false);
  assert.equal(isCoteAzur({ source: 'eventbrite', name: 'Une conférence sans lieu', city: '', address: '', venue: '' }, villes), false);
  assert.equal(isCoteAzur({ source: 'shotgun', name: 'Techno Night', city: '', address: '' }, villes), true);
  assert.equal(isCoteAzur({ source: 'eventbrite', name: 'Online Party Nice', city: 'Nice', address: '' }, villes), false);
  assert.equal(isCoteAzur({ source: 'eventbrite', name: 'Techno Night', city: 'Nice', address: '' }, villes), true);
});

test('même annonce sous deux titres (même heure, même image) : un seul événement', async () => {
  const { dedupe } = await import('../src/extract.mjs');
  const a = { name: 'Soirée A', start: '2026-11-28T22:00:00.000Z', image: 'https://img.x/a.jpg?w=1080', source: 'eventbrite' };
  const b = { name: 'Soirée A (Club)', start: '2026-11-28T22:00:00.000Z', image: 'https://img.x/a.jpg?w=600', source: 'eventbrite', venue: 'Club' };
  const c = { name: 'Autre', start: '2026-11-28T23:00:00.000Z', image: 'https://img.x/a.jpg', source: 'eventbrite' };
  const r = dedupe([a, b, c]);
  assert.equal(r.length, 2);
  assert.equal(r[0].venue, 'Club');
});
