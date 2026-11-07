import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel, chooser, selectBest, scorePosts, eventFeatures } from '../src/learn.mjs';
import { rng } from '../src/captions.mjs';
import { saison, theme } from '../src/theme.mjs';

// 12 publications simulées : l'accroche « A » fait 3 fois plus d'interactions que « B »,
// et les soirées au « Bunker » marchent mieux que celles du « Ghost ».
function donnees() {
  const posts = [];
  for (let i = 0; i < 12; i++) {
    const a = i % 2 === 0;
    posts.push({
      media: String(i), type: 'incontournables', nb_images: 9, choix: { hook: a ? 'A' : 'B' },
      features: [a ? 'lieu:le-bunker' : 'lieu:le-ghost'],
      metrics: { reach: 1000, likes: a ? 90 : 30, comments: a ? 12 : 4, saved: a ? 15 : 5, shares: 3, follows: a ? 6 : 1 },
    });
  }
  return { posts, abonnes: [] };
}

test('le score compare chaque post à la médiane de son format', () => {
  const p = scorePosts(donnees());
  assert.ok(p.find((x) => x.choix.hook === 'A').score > p.find((x) => x.choix.hook === 'B').score);
});

test('le sélecteur favorise ce qui marche, sans arrêter de tester', () => {
  const model = buildModel(donnees());
  let a = 0;
  for (let i = 0; i < 200; i++) if (chooser(model, rng('t' + i)).pick('hook', ['A', 'B'], (x) => x) === 'A') a++;
  assert.ok(a > 150, `A choisi ${a}/200`);
  assert.ok(a < 200, 'B reste testé de temps en temps');
});

test('les soirées des lieux qui marchent passent devant', () => {
  const model = buildModel(donnees());
  const ev = (venue, i) => ({ name: `Soirée ${i}`, venue, city: 'Nice', start: '2026-11-14T22:00:00Z', source: 'shotgun', image: 'https://x/y.jpg' });
  const list = [ev('Le Ghost', 1), ev('Le Ghost', 2), ev('Le Bunker', 3), ev('Le Bunker', 4)];
  const top = selectBest(list, 2, model, rng('s'));
  assert.deepEqual(top.map((e) => e.venue), ['Le Bunker', 'Le Bunker']);
  assert.ok(eventFeatures(list[0]).includes('lieu:le-ghost'));
});

test('couleurs de saison', () => {
  assert.equal(saison(new Date('2026-07-14T12:00:00Z')), 'ete');
  assert.equal(saison(new Date('2026-12-24T12:00:00Z')), 'hiver');
  assert.equal(saison(new Date('2026-11-07T12:00:00Z')), 'automne');
  assert.notEqual(theme(new Date('2026-07-14'), 'club').css, theme(new Date('2026-01-14'), 'club').css);
});
