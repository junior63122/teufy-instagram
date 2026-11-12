// Fiche cible (fêtards de la Côte d'Azur) : présente, lue par les robots qui écrivent, sans chiffre inventé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lireCible, texteCible } from '../src/cible.mjs';

test('fiche cible : profils, situations vécues, test du partage, lue par le scénariste et la veille', () => {
  const c = lireCible();
  assert.ok(c.profils.length >= 5 && c.situations.length >= 10 && /message privé/.test(c.test_du_partage));
  assert.ok(!/\d+ ?%/.test(JSON.stringify(c.situations)), 'pas de statistique dans les situations');
  assert.match(texteCible(c), /TEST|test|partage/);
  assert.match(readFileSync('studio/scripts/ecrire-flash.mjs', 'utf8'), /texteCible\(\)/);
  assert.match(readFileSync('src/cerveau.mjs', 'utf8'), /texteCible\(\)/);
});
