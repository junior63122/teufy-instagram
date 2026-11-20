// Planning TikTok (20/11/2026) : 2 créneaux espacés, pas deux fois la même vidéo en 14 jours, page non référencée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planifier, legendeTiktok, pageTiktok, CRENEAUX } from '../src/tiktok.mjs';

const stock = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ id, video: `media/x/${id}.mp4`, type: ['tague', 'spot', 'reel'][i % 3], legende: id }));

test('deux créneaux différents par jour, jamais la même vidéo deux fois en 14 jours, jours déjà prévus inchangés', () => {
  const p = planifier({}, stock, '2026-11-21', 7);
  for (const l of Object.values(p)) { assert.ok(l.length <= 2); if (l.length === 2) assert.notEqual(l[0].heure, l[1].heure); }
  const ids = Object.values(p).flat().map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 5); // stock épuisé : on ne repasse pas une vidéo trop tôt
  const p2 = planifier(p, [...stock, { id: 'f', video: 'f.mp4', type: 'spot', legende: 'f' }], '2026-11-22', 7);
  assert.deepEqual(p2['2026-11-22'], p['2026-11-22']);
});

test('créneau du jour déjà passé : sauté', () => {
  const p = planifier({}, stock, '2026-11-21', 1, '15:00');
  assert.deepEqual(p['2026-11-21'].map((x) => x.heure), [CRENEAUX.at(-1)]);
});

test('légende TikTok sans emoji ni compte Instagram, avec le site et 5 hashtags ; page non référencée', () => {
  const l = legendeTiktok('Les 4 potes 😭\n1. Celui qui @machin\nAbonne-toi à @teufy_official\n#TeufyParty', 'tague');
  assert.doesNotMatch(l, /\p{Extended_Pictographic}|@|Abonne-toi/u);
  assert.match(l, /teufyparty\.com/);
  assert.equal((l.match(/#\w+/g) || []).length, 5);
  assert.match(pageTiktok({ '2026-11-21': [{ ...stock[0], heure: '19:30' }] }, '2026-11-21'), /noindex/);
});

test('page TikTok protégée : sans code rien n\'est publié, avec code le contenu est chiffré', () => {
  const plan = { '2026-11-23': [{ ...stock[0], heure: '19:30', legende: 'Légende secrète' }] };
  const ferme = pageTiktok(plan, '2026-11-23', '');
  assert.doesNotMatch(ferme, /Légende secrète|media\/x\/a\.mp4/);
  const chiffre = pageTiktok(plan, '2026-11-23', 'un-code');
  assert.doesNotMatch(chiffre, /Légende secrète|media\/x\/a\.mp4/);
  assert.match(chiffre, /data-d="[A-Za-z0-9+/=]{40,}"/);
});
