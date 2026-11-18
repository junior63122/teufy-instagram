// Planning cohérent (18/11/2026, directeur : « réarrange le planning pour le rendre plus cohérent sans enlever de contenu »).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { choixLibre } from '../src/coherence.mjs';

const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const famille = (c) => (c.type === 'guide' || (c.type === 'reel' && ['viral', 'guide'].includes(c.variante)) ? 'guide' : c.type === 'bonplan' ? 'bonplan' : c.type);

test('rien n\'est enlevé : 7 reels (4 promo, 2 Grand Débat, 1 guide) et des posts 5 jours sur 7', () => {
  const R = config.calendrier_reels;
  assert.equal(R.length, 7);
  assert.equal(R.filter((r) => r.variante === 'promo').length, 4);
  assert.equal(R.filter((r) => r.variante === 'grand-debat').length, 2);
  assert.equal(R.filter((r) => r.variante === 'viral').length, 1);
  const joursPost = new Set(config.calendrier.map((c) => c.jour));
  assert.equal(joursPost.size, 5);
  for (const t of ['libre', 'bonplan', 'incontournables', 'guide']) assert.ok(config.calendrier.some((c) => c.type === t), t);
});

test('jamais 2 fois la même famille le même jour (secours compris) et jamais plus de 2 publications', () => {
  for (let j = 1; j <= 7; j++) for (let rang = 1; rang <= 5; rang++) {
    const post = config.calendrier.find((c) => c.jour === j && c.rang === rang);
    const reels = config.calendrier_reels.filter((r) => r.jour === j);
    assert.ok((post ? 1 : 0) + reels.length <= 2, `jour ${j}`);
    for (const r of reels) for (const v of [r.variante, r.secours].filter(Boolean)) {
      if (post && post.type !== 'libre') assert.notEqual(famille({ type: 'reel', variante: v }), famille(post), `jour ${j} rang ${rang} : ${post.type} + reel ${v}`);
    }
  }
});

test('promo tous les 2 jours (lun, mer, ven, dim)', () => {
  assert.deepEqual(config.calendrier_reels.filter((r) => r.variante === 'promo').map((r) => r.jour), [1, 3, 5, 7]);
});

const J = (s) => new Date(`${s}T12:00:00Z`);
const jourDe = (d) => d.toISOString().slice(0, 10);
test('post libre : pas de guide le jour du reel guide', () => {
  const slots = (d) => (jourDe(d) === '2026-11-26' ? [{ type: 'libre' }, { type: 'reel', variante: 'viral' }] : []);
  assert.deepEqual(choixLibre({ now: J('2026-11-26'), slots, jourDe }), ['a-reserver', 'petits-prix']);
});
test('post libre : pas de bon plan la veille du bon plan', () => {
  const slots = (d) => (jourDe(d) === '2026-11-24' ? [{ type: 'bonplan', variante: 'petits-prix' }] : [{ type: 'libre' }]);
  assert.deepEqual(choixLibre({ now: J('2026-11-23'), slots, jourDe }), ['guide']);
});
test('post libre : pas de guide le lendemain d\'un guide publié', () => {
  const slots = () => [];
  assert.deepEqual(choixLibre({ now: J('2026-11-23'), historique: [{ id: 'guide', date: '2026-11-22' }], slots, jourDe }), ['a-reserver', 'petits-prix']);
});
test('post libre : si tout est pris, il reste un choix', () => {
  const slots = () => [{ type: 'guide' }, { type: 'bonplan' }];
  assert.equal(choixLibre({ now: J('2026-11-23'), slots, jourDe }).length, 3);
});
