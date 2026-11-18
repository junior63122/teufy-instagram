import { test } from 'node:test';
import assert from 'node:assert/strict';
import { problemesSoiree, filtrerCoherentes, controlePost } from '../src/coherence.mjs';

const now = new Date('2026-11-18T12:00:00Z');
const fenetre = { from: new Date('2026-11-20T00:00:00Z'), to: new Date('2026-11-22T23:00:00Z') };
const ev = (o) => ({ name: 'Soirée', start: '2026-11-21T22:00:00Z', tags: ['house'], ...o });

test('soirée hors de la période annoncée, passée, annulée : retirée', () => {
  assert.ok(problemesSoiree(ev({ start: '2026-11-28T22:00:00Z' }), { format: 'commercial', fenetre, now }).includes('hors de la période annoncée'));
  assert.ok(problemesSoiree(ev({ start: '2026-11-10T22:00:00Z' }), { format: 'commercial', now }).includes('soirée passée'));
  assert.ok(problemesSoiree(ev({ name: 'ANNULÉ - Soirée' }), { format: 'commercial', now }).includes('annulée ou reportée'));
  assert.deepEqual(problemesSoiree(ev({}), { format: 'commercial', fenetre, now }), []);
});

test('petits prix : prix connu et sous le plafond ; à réserver : pas complet', () => {
  assert.ok(problemesSoiree(ev({ price: 25 }), { format: 'petits-prix', now, prixMax: 10 }).length);
  assert.ok(problemesSoiree(ev({ price: null }), { format: 'petits-prix', now, prixMax: 10 }).length);
  assert.deepEqual(problemesSoiree(ev({ price: 8 }), { format: 'petits-prix', now, prixMax: 10 }), []);
  assert.ok(problemesSoiree(ev({ name: 'Soirée — SOLD OUT' }), { format: 'a-reserver', now }).includes('déjà complet'));
});

test('genre : pas de techno dans le commercial, pas de house dans l\'Édition Tekno', () => {
  assert.ok(problemesSoiree(ev({ name: 'Rave techno', tags: ['techno', 'hard techno'] }), { format: 'commercial', now }).length);
  assert.ok(problemesSoiree(ev({ tags: ['house'] }), { format: 'tekno', now }).length);
});

test('doublons retirés et signalés', () => {
  const l = [ev({}), ev({})];
  assert.equal(filtrerCoherentes(l, { format: 'commercial', now }).length, 1);
  assert.ok(controlePost({ soirees: l, format: 'commercial', now }).some((x) => /double/.test(x)));
});

test('soirée démentie par le lieu (Club Sonore au Mama Shelter le 26/11) : retirée, quelle que soit la langue du lien', async () => {
  const { estRetiree } = await import('../src/coherence.mjs');
  assert.ok(estRetiree({ name: 'The Show Club Sonore - Nice', start: '2026-11-26T18:00:00.000Z', url: 'https://shotgun.live/en/events/the-show-club-sonore-nice-novembre-2026' }));
  assert.ok(estRetiree({ name: 'THE SHOW CLUB SONORE – NICE', start: '2026-11-26T19:00:00Z' }));
  assert.ok(!estRetiree({ name: 'The Show Club Sonore - Nice', start: '2026-12-26T18:00:00Z' }));
});
