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
  const FORMATS_REELS = ['viral', 'guide', 'humour', 'histoire', 'teufy', 'grand-debat', 'serie-nuit', 'promo', 'tendance', 'tague-ton-pote'];
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

test('Édition Tekno : toutes les 2 semaines, 1er et 3e jeudi (directeur 18/11/2026 : « 2 posts par mois »)', () => {
  for (let m = 0; m < 12; m++) {
    const jours = daysOfMonth(new Date(Date.UTC(2027, m, 15, 12)));
    const tekno = jours.map((d) => slotOfDay(d)).filter((s) => config.calendrier.some((x) => x.jour === s.jour && x.rang === s.rang && x.variante === 'tekno'));
    assert.equal(tekno.length, 2, `mois ${m + 1} : ${tekno.length} Édition(s) Tekno`);
    const j = tekno.map((s) => +s.date.slice(8, 10));
    assert.ok(j[0] <= 7 && j[1] >= 15 && j[1] <= 21, `mois ${m + 1} : Tekno les ${j.join(' et ')}`);
    assert.equal(j[1] - j[0], 14);
  }
});

// 20/11/2026 : une heure sans fuseau est l'heure de Paris (serveurs GitHub en UTC).
test('dates des sources : heure sans fuseau = heure de Paris ; date seule = minuit des billetteries (23h59)', async () => {
  const { dateParis, heure, jourLong } = await import('../src/dates.mjs');
  assert.equal(dateParis('2026-11-21T23:00:00').toISOString(), '2026-11-21T22:00:00.000Z'); // hiver : UTC+1
  assert.equal(dateParis('2026-07-11T23:30').toISOString(), '2026-07-11T21:30:00.000Z'); // été : UTC+2
  assert.equal(dateParis('2026-11-21T23:00:00+01:00').toISOString(), '2026-11-21T22:00:00.000Z');
  assert.equal(dateParis('2026-11-21T22:00:00Z').toISOString(), '2026-11-21T22:00:00.000Z');
  const d = dateParis('2026-11-21', { dateSeule: 'minuit' });
  assert.equal(heure(d), 'minuit');
  assert.equal(jourLong(d), 'Samedi', 'reste dans la nuit du samedi (avant : 1 h dimanche = nuit du vendredi)');
  assert.ok(isNaN(dateParis('')));
  const { extractEvents } = await import('../src/extract.mjs');
  const html = '<script type="application/ld+json">{"@type":"MusicEvent","name":"Techno Night","startDate":"2026-11-21T23:30:00","location":{"name":"Club","address":"Nice"}}</script>';
  assert.equal(extractEvents(html, { source: 'site-club', baseUrl: 'https://x.fr/' })[0].start, '2026-11-21T22:30:00.000Z');
});
