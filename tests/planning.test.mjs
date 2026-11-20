// Planning cohérent (18/11/2026, directeur : « réarrange le planning pour le rendre plus cohérent sans enlever de contenu »).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { choixLibre } from '../src/coherence.mjs';

const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const famille = (c) => (c.type === 'guide' || (c.type === 'reel' && ['viral', 'guide'].includes(c.variante)) ? 'guide' : c.type === 'bonplan' ? 'bonplan' : c.type);

// 20/11/2026 : planning confié à Claude (directeur : « à toi de gérer le planning ; minimum 1 réel de promotion par semaine ;
// les soirées tekno fonctionnent »). Règles qui restent : au moins 4 posts et 3 reels, 1 promo minimum, la techno chaque semaine.
test('planning : au moins 4 posts et 3 reels par semaine, 1 promo minimum, techno chaque jeudi', () => {
  const R = config.calendrier_reels;
  assert.ok(R.length >= 3);
  assert.ok(R.filter((r) => r.variante === 'promo').length >= 1);
  assert.ok(new Set(config.calendrier.map((c) => c.jour)).size >= 4);
  for (let rang = 1; rang <= 5; rang++) assert.match(config.calendrier.find((c) => c.jour === 4 && c.rang === rang)?.variante || '', /^(tekno|techno)$/, `jeudi rang ${rang}`);
  assert.ok(!R.some((r) => r.variante === 'grand-debat'), 'Grand Débat retiré (0 like)');
});

const J = (s) => new Date(`${s}T12:00:00Z`);
const jourDe = (d) => d.toISOString().slice(0, 10);
test('post libre : pas de guide le jour du reel guide', () => {
  const slots = (d) => (jourDe(d) === '2026-11-26' ? [{ type: 'libre' }, { type: 'reel', variante: 'viral' }] : []);
  assert.deepEqual(choixLibre({ now: J('2026-11-26'), slots, jourDe }), ['a-reserver', 'petits-prix']);
});
test('post libre : pas de bon plan la veille du bon plan', () => {
  const slots = (d) => (jourDe(d) === '2026-11-24' ? [{ type: 'bonplan', variante: 'petits-prix' }] : [{ type: 'libre' }]);
  assert.deepEqual(choixLibre({ now: J('2026-11-23'), slots, jourDe }), ['a-reserver', 'petits-prix']); // plus de guide « où manger » (20/11/2026) : on retombe sur les bons plans
});
test('post libre : pas de guide le lendemain d\'un guide publié', () => {
  const slots = () => [];
  assert.deepEqual(choixLibre({ now: J('2026-11-23'), historique: [{ id: 'guide', date: '2026-11-22' }], slots, jourDe }), ['a-reserver', 'petits-prix']);
});
test('post libre : si tout est pris, il reste un choix', () => {
  const slots = () => [{ type: 'guide' }, { type: 'bonplan' }];
  assert.equal(choixLibre({ now: J('2026-11-23'), slots, jourDe }).length, 2);
});

import { serieEnEchec } from '../src/reactif.mjs';
const R = (variante, note, j) => ({ source: 'bot', type: 'reel', variante, note, publie_le: `2026-11-${String(j).padStart(2, '0')}T18:00:00Z` });
test('Grand Débat : remplacé seulement après 3 épisodes mesurés et nettement sous les autres reels', () => {
  const now = new Date('2026-11-23T12:00:00Z');
  const base = [R('flash', 14, 9), R('tendance', 41, 13), R('promo', 30, 18)];
  assert.equal(serieEnEchec([...base, R('grand-debat', 3, 14), R('grand-debat', 19, 16)], 'grand-debat', { now }), null, '2 épisodes : trop tôt');
  assert.ok(serieEnEchec([...base, R('grand-debat', 3, 14), R('grand-debat', 19, 16), R('grand-debat', 10, 21)], 'grand-debat', { now }));
  assert.equal(serieEnEchec([...base, R('grand-debat', 30, 14), R('grand-debat', 25, 16), R('grand-debat', 28, 21)], 'grand-debat', { now }), null, 'il marche : on garde');
});

