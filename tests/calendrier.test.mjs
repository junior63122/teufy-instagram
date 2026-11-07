import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { daysOfMonth, slotOfDay } from '../src/dates.mjs';
import { genreOf } from '../src/genres.mjs';
import { captionIncontournables, captionDebat, captionReel, captionBonPlan, rng } from '../src/captions.mjs';
import { chooser } from '../src/learn.mjs';
const outils = (s) => { const r = rng(s); return { r, ch: chooser({ arms: {}, feats: {} }, r) }; };

const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url)));
const debats = JSON.parse(readFileSync(new URL('../contenus/debats.json', import.meta.url)));

test('9 publications par mois, chaque mois de l\'année', () => {
  for (let m = 0; m < 12; m++) {
    const slots = daysOfMonth(new Date(Date.UTC(2027, m, 15, 12)))
      .map((d) => { const s = slotOfDay(d); return config.calendrier.find((c) => c.jour === s.jour && c.rang === s.rang); })
      .filter(Boolean);
    const n = (t, v) => slots.filter((s) => s.type === t && (!v || s.variante === v)).length;
    assert.equal(slots.length, 9, `mois ${m + 1}`);
    assert.equal(n('incontournables', 'commercial'), 1);
    assert.equal(n('incontournables', 'techno'), 1);
    assert.equal(n('bonplan'), 2);
    assert.equal(n('debat'), 2);
    assert.equal(n('reel'), 3);
  }
});

test('techno ou commercial', () => {
  assert.equal(genreOf({ name: 'Acid Rave 303' }), 'techno');
  assert.equal(genreOf({ name: 'Hardgroove Session' }), 'techno');
  assert.equal(genreOf({ name: 'Tech House Sunset' }), 'commercial');
  assert.equal(genreOf({ name: 'Shatta Fever' }), 'commercial');
  assert.equal(genreOf({ name: 'Club X', tags: ['techno'] }), 'techno');
  assert.equal(genreOf({ name: 'Soirée 2000' }), 'commercial');
});

test('banque de débats complète, identifiants uniques', () => {
  assert.ok(debats.length >= 24, 'au moins 12 mois de débats');
  assert.equal(new Set(debats.map((d) => d.id)).size, debats.length);
  for (const d of debats) assert.ok(d.id && d.q && d.legende, d.id);
});

test('légendes « humaines » : pas de tiret cadratin, ≤ 2200 caractères, peu de hashtags', () => {
  const ev = [{ name: 'Afro Night', start: '2026-11-14T22:00:00Z', venue: 'Le Ghost', city: 'Nice', price: 10 }];
  const from = new Date('2026-11-09T05:00:00Z'), to = new Date('2026-11-16T05:00:00Z');
  const all = [
    ...['commercial', 'techno'].map((v) => captionIncontournables({ variante: v, events: ev, from, to, ...outils(v) })),
    ...['petits-prix', 'a-reserver'].map((v) => captionBonPlan({ variante: v, events: ev, from, to, ...outils(v) })),
    ...['weekend', 'techno', 'petits-prix'].map((v) => captionReel({ variante: v, events: ev, ...outils(v) })),
    ...debats.map((d) => captionDebat({ debat: d, ...outils(d.id) })),
  ];
  for (const c of all) {
    assert.ok(!c.includes('—'), c);
    assert.ok(c.length <= 2200);
    assert.ok((c.match(/#[\p{L}\p{N}_]+/gu) || []).length <= 5, 'max 5 hashtags : ' + c);
    assert.ok(!/télécharg|lien en bio|sur l'app/i.test(c), 'pas d\'invitation à télécharger l\'app : ' + c);
  }
});
