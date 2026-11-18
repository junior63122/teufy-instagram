import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ouvertApresBoite, adressesGuide } from '../src/guide.mjs';

test('« après la boîte » : ouvert au cœur de la nuit, jamais un restaurant qui ferme à 23 h ou minuit (directeur 18/11/2026)', () => {
  for (const h of ['lun–dim 7h–0h', 'lun–jeu 11h30–23h · ven–sam 11h30–0h · dim 11h30–23h', 'lun–dim 7h–23h', 'lun–dim 8h–0h30', 'mar–dim 18h30–1h']) assert.equal(ouvertApresBoite(h, 'Restaurant'), false, h);
  for (const h of ['lun–dim 12h–4h', 'lun–sam 17h30–3h', 'lun–ven 19h–2h · sam–dim 10h30–2h']) assert.equal(ouvertApresBoite(h, 'Restaurant'), true, h);
  assert.equal(ouvertApresBoite('mar–sam 4h–19h', 'Boulangerie'), true);
  assert.equal(ouvertApresBoite('ven–sam 19h30–11h30', 'Restaurant'), false, 'horaire douteux');
  assert.equal(ouvertApresBoite('lun–dim 5h–22h', 'Snack'), false, 'chaîne de gare / aéroport, pas une adresse d\'après-boîte');
});

test('le guide « manger » des vraies données ne contient que des adresses ouvertes après la boîte', () => {
  const A = adressesGuide();
  for (const [ville, l] of Object.entries(A.manger)) for (const x of l) assert.ok(ouvertApresBoite(x.horaires, x.quoi), `${ville} : ${x.nom} (${x.horaires})`);
  assert.ok((A.manger.Nice || []).length >= 3, 'Nice garde au moins 3 adresses');
});
