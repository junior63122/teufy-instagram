import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engouements, planifierSuite, jourSource, replanifier, extrasDu } from '../src/reactif.mjs';

const ref = Array.from({ length: 8 }, (_, i) => ({ media: `r${i}`, source: 'bot', type: 'reel', metrics: { views: 500, reach: 400, shares: 1, saved: 1 } }));
const vide = () => ({ extras: [], jours: { post: {}, reel: {} }, journal: [] });
const NOW = new Date('2026-11-16T17:00:00Z'); // lundi

test('engouement : un reel à 3× les vues habituelles est repéré, un reel normal non', () => {
  const r = engouements([{ media: 'x', type: 'reel', metrics: { views: 1600, shares: 2, saved: 0 } }, { media: 'y', type: 'reel', metrics: { views: 520, shares: 1, saved: 1 } }], ref);
  assert.deepEqual(r.map((e) => e.p.media), ['x']);
  assert.match(r[0].raison, /×3\.2/);
});

test('suite : programmée le lendemain, une seule fois par publication, 3 au plus par semaine', () => {
  const plan = vide();
  const e = { p: { media: 'x', type: 'reel', variante: 'humour', titre: 'POV' }, raison: 'test' };
  const s = planifierSuite(plan, e, NOW);
  assert.equal(s.date, '2026-11-17');
  assert.equal(s.variante, 'humour');
  assert.equal(planifierSuite(plan, e, NOW), null); // pas deux fois
  planifierSuite(plan, { ...e, p: { ...e.p, media: 'y' } }, NOW); // 18/11
  assert.equal(extrasDu(plan, '2026-11-18').length, 1);
  plan.extras.push({ date: '2026-11-19' });
  const refus = planifierSuite(plan, { ...e, p: { ...e.p, media: 'z' } }, NOW);
  assert.equal(refus.quoi, 'suite-refusee');
});

test('série sans épisode prêt : alerte « à produire en urgence », pas de créneau vide', () => {
  const plan = vide();
  const r = planifierSuite(plan, { p: { media: 'g', type: 'reel', variante: 'serie-nuit' }, raison: 'test' }, NOW, { episodeDispo: () => false });
  assert.equal(r.quoi, 'a-produire');
  assert.equal(plan.extras.length, 0);
});

test('les soirées du week-end n\'ont pas de suite (pas de 2e liste)', () => {
  assert.equal(planifierSuite(vide(), { p: { media: 'w', type: 'incontournables', variante: 'commercial' }, raison: 't' }, NOW), null);
});

test('jours : un post déplaçable passe sur un jour libre qui marche nettement mieux, jamais les soirées du week-end', () => {
  const config = { calendrier: [{ jour: 3, rang: 1, type: 'bonplan' }, { jour: 5, rang: 1, type: 'incontournables' }], calendrier_reels: [] };
  const posts = [];
  const jour = (j, note, k) => ({ source: 'bot', note, publie_le: new Date(Date.UTC(2026, 10, 2 + (j - 1) + 7 * k, 17)).toISOString() });
  for (let k = 0; k < 4; k++) posts.push(jour(3, 20, k), jour(2, 60, k), jour(5, 10, k));
  const plan = vide();
  const ch = replanifier(plan, { posts }, config, NOW);
  assert.equal(ch.length, 1);
  assert.deepEqual([ch[0].de, ch[0].vers], [3, 2]);
  assert.equal(jourSource(plan, 'post', 2), 3); // le mardi sert le post du mercredi
  assert.equal(jourSource(plan, 'post', 3), null);
  assert.equal(jourSource(plan, 'post', 5), 5); // vendredi fixe
  assert.deepEqual(replanifier(plan, { posts }, config, NOW), []); // une fois par semaine
});
