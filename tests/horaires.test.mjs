import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireHoraires } from '../src/horaires.mjs';

test('horaires des lieux : texte officiel → jours et heures', () => {
  assert.deepEqual(lireHoraires('Mer–Dim · 23h30–5h'), { plages: [{ j: [3, 4, 5, 6, 7], de: '23:30', a: '05:00' }], saison: false });
  assert.deepEqual(lireHoraires('Jeu–Sam · 23h30–5h/6h').plages, [{ j: [4, 5, 6], de: '23:30', a: '05:00' }]);
  assert.deepEqual(lireHoraires('Mar–Jeu 17h30–03h · Ven 17h30–04h · Sam 19h–04h').plages,
    [{ j: [2, 3, 4], de: '17:30', a: '03:00' }, { j: [5], de: '17:30', a: '04:00' }, { j: [6], de: '19:00', a: '04:00' }]);
  assert.deepEqual(lireHoraires('Lun–Dim · 10h/12h–2h').plages, [{ j: [1, 2, 3, 4, 5, 6, 7], de: '10:00', a: '02:00' }]);
  assert.equal(lireHoraires('Lun–Dim · 11h–23h30 (en saison)').saison, true);
  assert.deepEqual(lireHoraires('Du jeudi au samedi de 23h à 5h').plages, [{ j: [4, 5, 6], de: '23:00', a: '05:00' }]);
  assert.deepEqual(lireHoraires('Ven, Sam · 23h–5h').plages, [{ j: [5, 6], de: '23:00', a: '05:00' }]);
  assert.deepEqual(lireHoraires('Tous les jours 18h-2h').plages, [{ j: [1, 2, 3, 4, 5, 6, 7], de: '18:00', a: '02:00' }]);
  // Rien de compris : pas d'horaires inventés.
  assert.equal(lireHoraires('Sur réservation'), null);
  assert.equal(lireHoraires('23h–5h'), null);
  assert.equal(lireHoraires(null), null);
});
