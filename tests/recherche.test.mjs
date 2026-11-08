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
  // plusieurs passes de recherche : chaque passe renvoie le même texte et la même mise en forme (doublons à fusionner)
  const ia = { rechercher: async () => reponses[0], json: async () => JSON.parse(reponses[1]) };
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

test('doublons : la même soirée vue sur plusieurs billetteries est fusionnée', async () => {
  const { fusionner } = await import('../src/recherche.mjs');
  const r = fusionner([
    { name: 'La Wicked - Vice Club Nice (Afro Heat Festival)', start: '2026-11-13T22:50:00Z', venue: '305 Vice Club', city: 'Nice', confiance: 0.9, source_site: 'shotgun', instagram: ['viceclubnice'] },
    { name: 'La Wicked x Afro Heat', start: '2026-11-13T23:00:00Z', venue: 'Vice Club Nice', city: 'Nice', confiance: 0.8, source_site: 'dice', image: 'https://x/a.jpg', instagram: ['afroheatfestival'] },
    { name: 'La Wicked', start: '2026-11-20T22:50:00Z', venue: '305 Vice Club', city: 'Nice', confiance: 0.9 }, // autre date : autre soirée
    { name: 'Rétro Party', start: '2026-11-13T22:00:00Z', venue: 'Down Town Club', city: 'Nice', confiance: 0.9 },
  ]);
  assert.equal(r.length, 3);
  const w = r.find((e) => e.start === '2026-11-13T22:50:00Z');
  assert.equal(w.image, 'https://x/a.jpg'); // champ complété depuis l'autre source
  assert.deepEqual(w.instagram, ['viceclubnice', 'afroheatfestival']);
});
