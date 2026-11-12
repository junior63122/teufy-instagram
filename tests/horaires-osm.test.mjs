import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireOSM, fermeturesDeNuit, texteHorairesSoir } from '../src/horaires-osm.mjs';
import { lireHoraires } from '../src/horaires.mjs';

test('Horaires OSM : fermeture de nuit par jour, texte lisible compris par le site', () => {
  const p = lireOSM('Mo-Th 11:00-14:00,18:00-02:00; Fr,Sa 18:00-05:00; Su off');
  const f = fermeturesDeNuit(p);
  assert.equal(f[1], 120); assert.equal(f[5], 300); assert.equal(f[7], 0);
  const t = texteHorairesSoir(p);
  assert.equal(t, 'lun–jeu 18h–2h · ven–sam 18h–5h');
  assert.ok(lireHoraires(t)?.plages.length === 2);
});
test('Horaires OSM : 24/7 et plage qui commence après minuit', () => {
  assert.equal(fermeturesDeNuit(lireOSM('24/7'))[3], 1440);
  const f = fermeturesDeNuit(lireOSM('Mo-Su 11:00-23:00; Sa 00:00-04:00'));
  assert.equal(f[5], 240); // nuit du vendredi au samedi
  assert.equal(f[2], 0);
});
test('Horaires OSM : rien de deviné (jours fériés, mois, texte libre → rejet)', () => {
  assert.equal(lireOSM('Jun-Sep Mo-Su 18:00-04:00'), null);
  assert.equal(lireOSM('sur rendez-vous'), null);
  assert.equal(lireOSM(''), null);
  assert.ok(lireOSM('Mo-Su 18:00-03:00; PH off'));
});
test('Nuit tardive (OpenStreetMap) : manger après 2 h, afters après 5 h, ville la plus proche ou adresse', async () => {
  const { lieuxTardifs } = await import('../outils/nuit-tardive.mjs');
  const l = lieuxTardifs({ elements: [
    { type: 'node', id: 1, lat: 43.7, lon: 7.26, tags: { name: 'Kebab de nuit', amenity: 'fast_food', cuisine: 'kebab', opening_hours: 'Mo-Su 18:00-05:00' } },
    { type: 'node', id: 2, lat: 43.7, lon: 7.26, tags: { name: 'Resto sage', amenity: 'restaurant', opening_hours: 'Mo-Su 12:00-14:00,19:00-23:00' } },
    { type: 'node', id: 3, lat: 43.70, lon: 7.27, tags: { name: 'Club tôt', amenity: 'nightclub', opening_hours: 'Fr,Sa 23:00-07:00' } },
    { type: 'node', id: 4, lat: 43.7, lon: 7.26, tags: { name: 'Bar 2h', amenity: 'bar', opening_hours: 'Mo-Su 18:00-02:00' } },
    { type: 'node', id: 5, tags: { name: 'Pizza été', amenity: 'fast_food', opening_hours: 'Jun-Aug Mo-Su 18:00-04:00' } },
  ] });
  assert.deepEqual(l.map((x) => [x.nom, x.type, x.ville, x.categorie]), [['Kebab de nuit', 'manger-tard', 'Nice', 'Kebab'], ['Club tôt', 'after', 'Nice', 'Club']]);
  assert.equal(l[0].horaires, 'lun–dim 18h–5h');
  assert.match(l[0].source, /^https:\/\/www\.openstreetmap\.org\/node\/1$/);
});
