// 23/11/2026 : erreurs relevées par le testeur « vérité » sur les soirées de la semaine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { corrigerNuit, corrigerRecurrence, estJourneeHorsSujet, fusionnerMemeNuit, nettoyerSoirees } from '../src/qualite-soirees.mjs';

test('« le vendredi 27, ouverture à minuit » = nuit du vendredi (samedi 0 h), pas la nuit du jeudi', () => {
  const e = { name: 'EUPHORIA', start: '2026-11-26T23:00:00.000Z', description: 'Le vendredi 27 novembre, le Naho Club accueille EUPHORIA' };
  assert.equal(corrigerNuit(e).start, '2026-11-27T23:00:00.000Z');
  const ok = { name: 'X', start: '2026-11-27T23:00:00.000Z', description: 'Le vendredi 27 novembre à minuit' }; // déjà juste (samedi 0 h)
  assert.equal(corrigerNuit(ok).start, ok.start);
  const tot = { name: 'Y', start: '2026-11-27T21:00:00.000Z', description: 'vendredi 27' };
  assert.equal(corrigerNuit(tot).start, tot.start);
});

test('« tous les vendredis » placé un jeudi : ramené au vendredi, même heure', () => {
  const e = { name: 'No Sleep Mode', start: '2026-11-26T21:00:00.000Z', description: 'Tous les vendredis au Bulldog Pub' };
  assert.equal(corrigerRecurrence(e).start, '2026-11-27T21:00:00.000Z');
  const ok = { name: 'Z', start: '2026-11-27T23:30:00.000Z', description: 'tous les vendredis' }; // samedi 0 h 30 = nuit du vendredi
  assert.equal(corrigerRecurrence(ok).start, ok.start);
});

test('journée sans rien d\'une sortie écartée ; day party et open air gardés ; soirée gardée', () => {
  assert.ok(estJourneeHorsSujet({ name: "Concert d'orgue du midi (entrée libre)", start: '2026-11-26T11:15:00.000Z' }));
  assert.ok(estJourneeHorsSujet({ name: 'Après-midi dansant avec Joël et Dédé', start: '2026-11-29T13:30:00.000Z' }));
  assert.ok(!estJourneeHorsSujet({ name: 'Open Air Techno', start: '2026-11-29T13:00:00.000Z' }));
  assert.ok(!estJourneeHorsSujet({ name: 'Blind test', start: '2026-11-29T19:00:00.000Z' }));
});

test('même club, même nuit, même artiste : une seule soirée, la billetterie l\'emporte', () => {
  const insta = { name: 'Marwa Loud Showcase', start: '2026-11-28T19:00:00.000Z', venue: 'High Club Nice', url: 'https://www.instagram.com/reel/x/', source: 'web' };
  const billet = { name: 'MARWA LOUD FAST PASS HIGH CLUB', start: '2026-11-28T22:59:00.000Z', venue: 'High Club', url: 'https://xceed.me/fr/nice/event/marwa-loud-fast-pass-high-club/252164', source: 'xceed' };
  const autre = { name: 'Techno Night', start: '2026-11-28T22:00:00.000Z', venue: 'High Club', url: 'https://a.b/c', source: 'x' };
  const r = fusionnerMemeNuit([insta, billet, autre]);
  assert.equal(r.length, 2);
  assert.equal(r.find((x) => /marwa/i.test(x.name)).url, billet.url);
  assert.equal(nettoyerSoirees([insta, billet, autre]).length, 2);
});
