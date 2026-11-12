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

test('reel Guide : seulement de vraies adresses, au moins 3 par ville, pas deux fois de suite la même ville', async () => {
  const { adressesGuide, choisirGuide } = await import('../src/guide.mjs');
  const tard = [1, 2, 3].map((i) => ({ nom: `Snack ${i}`, type: 'manger-tard', categorie: 'Kebab', ville: 'Cannes', horaires: 'lun–dim 18h–4h', source: 'https://www.openstreetmap.org/node/' + i }))
    .concat([1, 2, 3].map((i) => ({ nom: `Pizza ${i}`, type: 'manger-tard', categorie: 'Pizzeria', ville: 'Nice', horaires: 'ven–sam 19h–5h', source: 'x' })));
  const lieux = [{ nom: 'Club Tôt', ville: 'Nice', type: 'club', details: { horaires: 'Ven–Sam · 23h45–5h30' } }];
  const A = adressesGuide({ tard, lieux, soirees: [] });
  assert.equal(A.manger.Cannes.length, 3);
  assert.equal(A.after.Nice, undefined, 'un club qui ferme à 5h30 n\'est pas un after');
  const g1 = choisirGuide({ tard, lieux, soirees: [], deja: [] });
  const g2 = choisirGuide({ tard, lieux, soirees: [], deja: [`${g1.theme}|${g1.ville}`] });
  assert.notEqual(`${g1.theme}|${g1.ville}`, `${g2.theme}|${g2.ville}`);
  assert.equal(choisirGuide({ tard: [], lieux: [], soirees: [] }), null, 'sans données : pas de guide');
});
