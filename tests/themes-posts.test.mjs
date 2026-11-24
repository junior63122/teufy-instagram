// Analyse des publications du 24/11/2026 : titres concrets et carrousel « Nouvel An » en décembre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TITRES_COMMERCIAL, fenetreNouvelAn } from '../src/themes-posts.mjs';

test('titres « commercial » : plus de « coups de cœur », jamais « week-end » (la fenêtre est la semaine)', () => {
  assert.ok(TITRES_COMMERCIAL.length >= 2);
  for (const t of TITRES_COMMERCIAL) { assert.ok(!/coups? de c/i.test(t), t); assert.ok(!/week-?end/i.test(t), t); assert.ok(t.length <= 45, t); }
});

test('Nouvel An : du 1er au 30 décembre seulement, nuit du 31, une fois par semaine', () => {
  const w = fenetreNouvelAn(new Date('2026-12-10T12:00:00Z'));
  assert.equal(w.from.toISOString(), '2026-12-31T16:00:00.000Z');
  assert.equal(w.to.toISOString(), '2027-01-01T05:00:00.000Z');
  assert.equal(fenetreNouvelAn(new Date('2026-11-28T12:00:00Z')), null);
  assert.equal(fenetreNouvelAn(new Date('2026-12-31T12:00:00Z')), null);
  const hist = [{ le: '2026-12-08T17:00:00Z', publication: { theme: 'nouvel-an' } }];
  assert.equal(fenetreNouvelAn(new Date('2026-12-10T12:00:00Z'), hist), null);
  assert.ok(fenetreNouvelAn(new Date('2026-12-15T12:00:00Z'), hist));
});
