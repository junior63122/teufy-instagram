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
    .concat([1, 2, 3].map((i) => ({ nom: `Pizza ${i}`, type: 'manger-tard', categorie: 'Pizzeria', ville: 'Nice', horaires: 'ven–sam 19h–5h', source: 'https://www.openstreetmap.org/node/9' })));
  const lieux = [{ nom: 'Club Tôt', ville: 'Nice', type: 'club', details: { horaires: 'Ven–Sam · 23h45–5h30' } }];
  const A = adressesGuide({ tard, lieux, soirees: [] });
  assert.equal(A.manger.Cannes.length, 3);
  assert.equal(A.after.Nice, undefined, 'un club qui ferme à 5h30 n\'est pas un after');
  const g1 = choisirGuide({ tard, lieux, soirees: [], deja: [] });
  const g2 = choisirGuide({ tard, lieux, soirees: [], deja: [`${g1.theme}|${g1.ville}`] });
  assert.notEqual(`${g1.theme}|${g1.ville}`, `${g2.theme}|${g2.ville}`);
  assert.equal(choisirGuide({ tard: [], lieux: [], soirees: [] }), null, 'sans données : pas de guide');
});

test('contrôle des textes avant publication : texte cassé refusé, noms de soirée avec « @ » acceptés', async () => {
  const { fautesTexte, controlerPublication } = await import('../src/controle-texte.mjs');
  assert.deepEqual(fautesTexte('Les [afters] à Nice 👇\n1. Malive @ Twiga · Ven 0h–6h\n#TeufyParty #nice'), []);
  assert.ok(fautesTexte('Soirée undefined à 23h59').length >= 2);
  assert.ok(fautesTexte('le le kebab').length);
  assert.throws(() => controlerPublication({ legende: 'OK', titre: 'Les [afters à Nice' }), /Texte refusé/);
});
test('Guide : une adresse sans source vérifiable ou une soirée annulée n\'entre pas', async () => {
  const { adressesGuide } = await import('../src/guide.mjs');
  const now = new Date('2026-11-13T12:00:00Z');
  const soirees = [{ name: 'After A', start: '2026-11-14T04:00:00Z', city: 'Nice', url: 'https://shotgun.live/a' }, { name: 'After B annulé', start: '2026-11-14T04:00:00Z', city: 'Nice', url: 'https://x.fr' }, { name: 'After C', start: '2026-11-14T04:00:00Z', city: 'Nice' }];
  const A = adressesGuide({ now, tard: [{ nom: 'Sans source', type: 'manger-tard', ville: 'Nice', horaires: 'lun–dim 18h–4h' }], lieux: [], soirees });
  assert.deepEqual((A.after.Nice || []).map((x) => x.nom), ['After A']);
  assert.equal(A.manger.Nice, undefined);
});
