import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annonceLaDate } from '../src/site.mjs';

test('affiche Instagram : la légende annonce bien la date de la soirée', () => {
  assert.equal(annonceLaDate('Samedi 14 novembre on remet ça au club 🔥', '2026-11-14'), true);
  assert.equal(annonceLaDate('RDV le 14/11 dès 23h', '2026-11-14'), true);
  assert.equal(annonceLaDate('Save the date : 14.11', '2026-11-14'), true);
  assert.equal(annonceLaDate('Friday Nov 13 at Frigo 16', '2026-11-13'), true);
  assert.equal(annonceLaDate('Merci pour hier soir !', '2026-11-14'), false);
  assert.equal(annonceLaDate('le 114/11 ou 24/11', '2026-11-14'), false); // pas un faux positif sur 24/11 ou 114/11
  assert.equal(annonceLaDate('Rendez-vous le 4/11', '2026-11-14'), false);
});
