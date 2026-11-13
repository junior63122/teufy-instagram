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

test('chaque semaine : au moins 4 posts et 3 reels, jamais de reel de soirées ni d\'explicatif (directeur 13/11/2026)', () => {
  const FORMATS_REELS = ['viral', 'guide', 'humour', 'histoire'];
  for (let m = 0; m < 12; m++) {
    const jours = daysOfMonth(new Date(Date.UTC(2027, m, 15, 12)));
    for (let i = 0; i + 7 <= jours.length; i += 7) {
      let posts = 0, reels = 0;
      for (const d of jours.slice(i, i + 7)) {
        const s = slotOfDay(d);
        const c = config.calendrier.find((x) => x.jour === s.jour && x.rang === s.rang);
        if (c) {
          posts++;
          assert.notEqual(c.type, 'reel', `${s.date} : le calendrier des posts ne contient plus de reels`);
          assert.notEqual(c.type, 'debat', `${s.date} : plus de débat en post`);
        }
        for (const r of config.calendrier_reels.filter((x) => x.jour === s.jour)) { reels++; assert.ok(FORMATS_REELS.includes(r.variante), `${s.date} : reel ${r.variante} interdit`); }
      }
      assert.ok(posts >= 4, `semaine du ${jours[i]} : ${posts} posts`);
      assert.ok(reels >= 3, `semaine du ${jours[i]} : ${reels} reels`);
    }
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
