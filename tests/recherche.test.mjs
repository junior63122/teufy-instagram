import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { rechercherSoirees } from '../src/recherche.mjs';

const ORGAS = new URL('../contenus/organisateurs.json', import.meta.url);
const CACHE = new URL('../evenements-web.json', import.meta.url);

test('recherche web : tri 17-30 ans, fiabilité, comptes Instagram', async () => {
  const sauvegarde = readFileSync(ORGAS, 'utf8');
  const cacheAvant = existsSync(CACHE) ? readFileSync(CACHE) : null; // le vrai cache des soirées est remis après le test
  if (existsSync(CACHE)) unlinkSync(CACHE);
  const ev = (name, extra) => ({ name, start: '2026-11-14T23:00:00+01:00', venue: 'High Club', city: 'Nice', price: 15, styles: ['afro house'], image: 'https://x/a.jpg', url: 'https://x/e', source_site: 'nice.fr', public_17_30: 0.9, confiance: 0.9, ...extra });
  const reponses = ['liste des soirées…', JSON.stringify({
    evenements: [ev('Afro Night'), ev('Opéra Carmen', { public_17_30: 0.1 }), ev('Rumeur', { confiance: 0.3 }), ev('Sans date', { start: 'bientôt' })],
    comptes_instagram: ['@HighClubNice', 'pas valide !'],
  })];
  let i = 0;
  const ia = { rechercher: async () => reponses[i++], json: async () => JSON.parse(reponses[i++]) };
  try {
    const r = await rechercherSoirees({ config: { recherche_web: { actif: true } }, ia, force: true, now: new Date('2026-11-09T12:00:00Z'), log: () => {} });
    assert.deepEqual(r.evenements.map((e) => e.name), ['Afro Night']);
    assert.equal(r.evenements[0].public_cible, 0.9);
    assert.deepEqual(r.evenements[0].tags, ['afro house']);
    const o = JSON.parse(readFileSync(ORGAS, 'utf8'));
    assert.ok(o.suggeres.includes('highclubnice'));
    assert.ok(!o.suggeres.some((h) => h.includes(' ')));
  } finally {
    writeFileSync(ORGAS, sauvegarde);
    if (existsSync(CACHE)) unlinkSync(CACHE);
    if (cacheAvant) writeFileSync(CACHE, cacheAvant);
  }
});
