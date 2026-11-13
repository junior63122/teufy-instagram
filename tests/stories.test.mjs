// Stories du jour : programme, pas de doublon, contenus encore utiles seulement (jamais Halloween ni « ce week-end » passé).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDuJour, storiesDues, soireesDuSoir, offreDuJour, questionDuJour, repostDuJour, coupDeCoeur } from '../src/stories.mjs';

const ven20h = new Date('2026-11-13T19:10:00Z'); // vendredi 20h10 à Paris
test('programme : 3 à 4 stories par jour, chacune une seule fois, jamais 3 h après son heure', () => {
  assert.deepEqual(planDuJour(ven20h).map((s) => s.type), ['soirees', 'offre', 'question', 'coeur']);
  assert.deepEqual(storiesDues(ven20h, []).map((s) => s.type), ['offre', 'question']);
  assert.deepEqual(storiesDues(ven20h, [{ jour: '2026-11-13', type: 'question' }]).map((s) => s.type), ['offre']);
  const lundi = planDuJour(new Date('2026-11-16T12:00:00Z')).map((s) => s.type);
  assert.ok(!lundi.includes('coeur'), 'lundi : pas de coup de cœur');
  assert.ok(lundi.includes('videos'), 'lundi : appel aux vidéos de soirée (WeTransfer)');
});
test('soirées de ce soir avec affiche vérifiée, sinon demain', () => {
  const evts = [{ name: 'A', start: '2026-11-13T22:00:00Z', image: 'x' }, { name: 'B', start: '2026-11-14T22:00:00Z', image: 'y' }, { name: 'C', start: '2026-11-13T23:00:00Z' }];
  assert.deepEqual(soireesDuSoir(evts, +ven20h).soirees.map((e) => e.name), ['A']);
  assert.equal(soireesDuSoir(evts.slice(1), +ven20h).quand, 'Demain');
});
test('offre : seulement si encore valable, une différente à chaque fois', () => {
  const config = { site: { avantages: [{ partenaire_nom: 'Bar', titre: 'Shooter offert', jusqu_au: '2027-01-01' }, { partenaire_nom: 'Vieux', titre: 'Fini', jusqu_au: '2026-01-01' }] }, codes_promo: [{ code: 'TEUFY20', remise: '-20 %', jusqu_au: '2027-01-01' }] };
  const o1 = offreDuJour(config, +ven20h, []);
  const o2 = offreDuJour(config, +ven20h, [{ type: 'offre', cles: [o1.cle], le: ven20h.toISOString() }]);
  assert.notEqual(o1.cle, o2.cle);
  assert.ok(![o1.cle, o2.cle].some((c) => /Vieux/.test(c)));
});
test('question : jamais deux fois en 30 jours', () => {
  const questions = [{ id: 'a', q: 'Q1 ?' }, { id: 'b', q: 'Q2 ?' }];
  const q1 = questionDuJour(+ven20h, [], { questions, debats: [] });
  const q2 = questionDuJour(+ven20h, [{ type: 'question', cles: [q1.cle], le: ven20h.toISOString() }], { questions, debats: [] });
  assert.notEqual(q1.cle, q2.cle);
});
test('repost : seulement un reel encore utile, publié depuis 7 jours, jamais Halloween ni le week-end passé', () => {
  const vieux = '2026-10-20T18:00:00Z';
  const hist = [
    { id: 'reel-flash', media: '1', titre: 'Passer le videur', le: vieux, publication: { type: 'reel', variante: 'flash' } },
    { id: 'reel-weekend', media: '2', titre: 'Ce week-end', le: vieux, publication: { type: 'reel', variante: 'weekend' } },
    { id: 'fete-halloween', media: '3', titre: 'Halloween', le: vieux, publication: { type: 'reel', variante: 'halloween' } },
    { id: 'reel-flash', media: '4', titre: 'Trop récent', le: '2026-11-12T18:00:00Z', publication: { type: 'reel', variante: 'flash' } },
  ];
  const medias = ['1', '2', '3', '4'].map((id) => ({ id, media_type: 'VIDEO', media_url: `https://cdn/${id}.mp4`, like_count: +id * 10 }));
  assert.equal(repostDuJour(hist, medias, +ven20h, []).cle, 'r-1');
  assert.equal(repostDuJour(hist, medias, +ven20h, [{ type: 'repost', cles: ['r-1'], le: ven20h.toISOString() }]), null);
});
test('coup de cœur : soirée des 7 prochains jours d\'un compte vérifié', () => {
  const evts = [{ name: 'Sans compte', start: '2026-11-14T22:00:00Z', image: 'x' }, { name: 'Avec compte', start: '2026-11-15T22:00:00Z', image: 'y' }];
  const x = coupDeCoeur(evts, +ven20h, [], { comptes: (e) => (e.name === 'Avec compte' ? ['orga'] : []) });
  assert.equal(x.soiree.name, 'Avec compte');
  assert.equal(x.compte, 'orga');
});
