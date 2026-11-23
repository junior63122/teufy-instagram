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

test('horaires : « fermé le dimanche » n\'ouvre pas le dimanche ; « mer » pas dans « confirmer » ; jours listés ; 24 h/24 ; « été : » n\'est pas une saison', () => {
  assert.equal(lireHoraires('18h–0h (jours à confirmer : fermé le dimanche)'), null);
  assert.deepEqual(lireHoraires('jeu, dim, lun 19h30–1h · ven–sam 19h30–3h (été : jeu–lun jusqu\'à 3h)').plages, [{ j: [1, 4, 7], de: '19:30', a: '01:00' }, { j: [5, 6], de: '19:30', a: '03:00' }]);
  assert.deepEqual(lireHoraires('mar–dim 0h–0h').plages, [{ j: [2, 3, 4, 5, 6, 7], de: '00:00', a: '24:00' }]);
  assert.equal(lireHoraires('lun–dim 9h–1h · ven–sam 9h–2h30 (été : jusqu\'à 3h tous les soirs)').saison, false);
  assert.deepEqual(lireHoraires('Mer–Dim · 23h30–5h · fermé lundi et mardi').plages, [{ j: [3, 4, 5, 6, 7], de: '23:30', a: '05:00' }]);
});
