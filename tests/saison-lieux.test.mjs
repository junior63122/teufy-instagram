// 23/11/2026 (directeur : le Bâoli, saisonnier, annoncé « ouvre ce soir » en novembre ; Gotha fermé définitivement).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireHoraires, periodeSaison, enSaison } from '../src/horaires.mjs';

test('horaires de saison : la période publiée est lue, hors saison le lieu n\'est pas ouvert', () => {
  const h = lireHoraires("lun–dim 20h–5h (1er mai–31 oct. 2026 ; hors saison selon l'affluence)");
  assert.deepEqual(h.saison, { de: '05-01', a: '10-31' });
  assert.equal(enSaison(h.saison, '11-23'), false);
  assert.equal(enSaison(h.saison, '07-14'), true);
  assert.deepEqual(periodeSaison("ouvert d'avril à octobre"), { de: '04-01', a: '10-31' });
  assert.deepEqual(periodeSaison('saison : mai - septembre'), { de: '05-01', a: '09-30' });
  assert.equal(enSaison(true, '11-23'), null); // saisonnier sans dates : on ne sait pas, rien n'est annoncé
  assert.equal(lireHoraires('Mer–Dim · 23h30–5h').saison, false);
  assert.equal(lireHoraires('Ven–Sam 23h–5h · soirée complète').saison, false); // « complete » ne veut pas dire « été »
});

test('lieu fermé définitivement retiré de l\'annuaire (Gotha, Cannes)', async () => {
  const { readFileSync } = await import('node:fs');
  const m = JSON.parse(readFileSync(new URL('../contenus/lieux-manuels.json', import.meta.url), 'utf8')).lieux;
  assert.equal(m.find((x) => x.nom === 'Gotha' && x.ville === 'Cannes')?.retirer, true);
});
