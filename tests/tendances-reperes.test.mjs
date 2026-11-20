// Repères concurrents (20/11/2026) : rythme, likes, commentaires, taux, part de reels, meilleurs posts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reperes } from '../src/tendances.mjs';

test('repères par compte calculés sur les posts gardés', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  const posts = [
    { ts: '2026-11-06T18:00:00Z', format: 'reel', likes: 40, comm: 2, accroche: 'A', lien: 'a' },
    { ts: '2026-11-13T18:00:00Z', format: 'carrousel', likes: 120, comm: 10, accroche: 'B', lien: 'b' },
    { ts: '2026-11-19T18:00:00Z', format: 'image', likes: 60, comm: 1, accroche: 'C', lien: 'c' },
  ];
  const r = reperes({ club: { abonnes: 5000, posts } }, now).club;
  assert.equal(r.likes, 60);
  assert.equal(r.commentaires, 2);
  assert.equal(r.posts_par_semaine, 1.5);
  assert.equal(r.part_reels, 0.33);
  assert.equal(r.meilleurs[0].accroche, 'B');
  assert.equal(r.taux_pour_cent, 1.22);
});
