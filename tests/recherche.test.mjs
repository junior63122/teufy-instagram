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

// 20/11/2026 : une recherche web complète sans aucune réponse ne rend plus le cache « frais » pour des jours.
test('recherche web en échec : la date de mise à jour n\'avance pas, nouvel essai 6 h plus tard', async () => {
  const sauvegarde = readFileSync(ORGAS, 'utf8');
  const cacheAvant = existsSync(CACHE) ? readFileSync(CACHE) : null;
  writeFileSync(CACHE, JSON.stringify({ maj: '2026-11-01T10:00:00Z', evenements: [] }));
  let appels = 0;
  const ia = { rechercher: async () => { appels++; return ''; }, json: async () => { throw new Error('ne doit pas être appelée'); } };
  try {
    const now = new Date('2026-11-09T12:00:00Z');
    const r = await rechercherSoirees({ config: { recherche_web: { actif: true } }, ia, now, log: () => {} });
    assert.equal(r.maj, '2026-11-01T10:00:00Z', 'pas noté à jour');
    assert.ok(r.echec_web);
    assert.ok(appels > 0);
    const n = appels;
    await rechercherSoirees({ config: { recherche_web: { actif: true } }, ia, now: new Date('2026-11-09T14:00:00Z'), log: () => {} });
    assert.equal(appels, n, 'pas de nouvel essai avant 6 h');
    await rechercherSoirees({ config: { recherche_web: { actif: true } }, ia, now: new Date('2026-11-09T19:00:00Z'), log: () => {} });
    assert.ok(appels > n, 'nouvel essai après 6 h');
  } finally {
    writeFileSync(ORGAS, sauvegarde);
    if (existsSync(CACHE)) unlinkSync(CACHE);
    if (cacheAvant) writeFileSync(CACHE, cacheAvant);
  }
});

test('billetteries : une source en panne garde ses soirées du relevé précédent', async () => {
  const { reprendreEnPanne } = await import('../src/sources.mjs');
  const now = Date.parse('2026-11-20T12:00:00Z');
  const anciennes = [{ source: 'shotgun', name: 'A', start: '2026-11-21T22:00:00Z' }, { source: 'shotgun', name: 'Passée', start: '2026-11-19T22:00:00Z' }, { source: 'dice', name: 'B', start: '2026-11-21T22:00:00Z' }];
  const report = [{ source: 'shotgun', url: 'https://shotgun.live/x', erreur: 'HTTP 503' }, { source: 'dice', url: 'https://dice.fm/x', evenements: 4 }];
  assert.deepEqual(reprendreEnPanne(report, anciennes, now).map((e) => e.name), ['A']);
});
