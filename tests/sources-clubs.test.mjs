import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comptesALire } from '../src/recherche.mjs';
import { liensAgenda, soireesDuLieu } from '../src/sites-clubs.mjs';

test('Instagram : les clubs passent avant les autres comptes, puis le moins récemment lu', () => {
  const now = new Date('2026-11-20T16:00:00Z');
  const orgas = { partenaires: ['dj1', 'dj2', 'dj3'], suggeres: ['highclubnice'], lus: { dj1: '2026-11-18T10:00:00Z', jimmyzmc: '2026-11-20T10:00:00Z' } };
  const l = comptesALire({ orgas, lieux: ['highclubnice', 'jimmyzmc'], now, max: 3 });
  assert.equal(l[0], 'highclubnice'); // club jamais lu
  assert.ok(!l.includes('jimmyzmc')); // club lu il y a 6 h : pas encore
  assert.equal(l.length, 3);
  // Rotation : un compte lu à l'instant n'est pas relu au passage suivant.
  const l2 = comptesALire({ orgas: { ...orgas, lus: { ...orgas.lus, ...Object.fromEntries(l.map((h) => [h, now.toISOString()])) } }, lieux: ['highclubnice', 'jimmyzmc'], now, max: 3 });
  assert.ok(l.every((h) => !l2.includes(h)));
});

test('Sites des clubs : liens agenda du même site et soirées schema.org', () => {
  const html = `<a href="/event/good-times/">x</a><a href="https://www.highclub.fr/agenda">a</a><a href="https://autre.fr/events">b</a><a href="/contact">c</a>
  <script type="application/ld+json">{"@type":"Event","name":"GTA 6 au High","startDate":"2026-11-21T23:30:00+01:00"}</script>`;
  const liens = liensAgenda(html, 'https://www.highclub.fr/');
  assert.deepEqual(liens, ['https://www.highclub.fr/agenda', 'https://www.highclub.fr/event/good-times/']);
  const ev = soireesDuLieu([{ html, url: 'https://www.highclub.fr/' }], { nom: 'High Club', ville: 'Nice', instagram: 'highclubnice' }, new Date('2026-11-20T12:00:00Z'));
  assert.equal(ev.length, 1);
  assert.equal(ev[0].venue, 'High Club');
  assert.equal(ev[0].city, 'Nice');
  assert.deepEqual(ev[0].instagram, ['highclubnice']);
});

test("Fusion : l'annonce du club sur son Instagram donne le nom et l'affiche, l'autre source complète", async () => {
  const { fusionner } = await import('../src/recherche.mjs');
  const site = { name: 'Good Times', start: '2026-11-21T22:59:00.000Z', venue: 'High Club', city: 'Nice', url: 'https://www.highclub.fr/event/good-times/', price: 20, confiance: 0.9, source_site: 'highclub.fr', instagram: [] };
  const insta = { name: 'GTA 6 au High', start: '2026-11-21T22:30:00.000Z', venue: 'High Club', city: 'Nice', url: '', image: 'https://x/affiche.jpg', price: null, confiance: 0.8, source_site: 'Instagram highclubnice', instagram: ['highclubnice'], par_le_lieu: true };
  const [e, ...reste] = fusionner([site, insta]);
  assert.equal(reste.length, 0);
  assert.equal(e.name, 'GTA 6 au High');
  assert.equal(e.image, 'https://x/affiche.jpg');
  assert.equal(e.price, 20);
});

test('lieu écrit comme un pseudo Instagram : nom lisible, pseudo gardé, doublon fusionné', async () => {
  const { fusionner, assainir } = await import('../src/recherche.mjs');
  const a = assainir({ name: 'Inside à leservan_valbonne', venue: 'leservan_valbonne', city: 'Valbonne', start: '2026-11-20T18:00:00.000Z', instagram: [] });
  assert.equal(a.venue, 'Leservan');
  assert.equal(a.name, 'Inside à Leservan');
  assert.deepEqual(a.instagram, ['leservan_valbonne']);
  const b = { name: 'Soirée Inside - Binôme', venue: 'Le Servan', city: 'Valbonne', start: '2026-11-20T18:00:00.000Z', image: 'https://x/a.jpg', confiance: 0.9, instagram: [] };
  const f = fusionner([a, b]);
  assert.equal(f.length, 1);
  assert.equal(f[0].image, 'https://x/a.jpg');
  assert.equal(assainir({ name: 'X', venue: 'Le 109', city: 'Nice' }).venue, 'Le 109');
});

test("sans IA pour lire l'affiche : on garde celle de la billetterie ou du post qui annonce la soirée, jamais une image d'ailleurs", async () => {
  const { imageDeLaSource } = await import('../src/site.mjs');
  assert.equal(imageDeLaSource({ image: 'https://assets.shotgun.live/a.jpg', source_site: 'Shotgun', url: 'https://shotgun.live/fr/events/x' }), true);
  assert.equal(imageDeLaSource({ image: 'https://scontent.cdninstagram.com/a.jpg', source_site: 'Instagram highclubnice', instagram: ['highclubnice'] }), true);
  assert.equal(imageDeLaSource({ image: 'https://assets.tmassets.fr/a.jpg', source_site: 'ticketmaster.fr', url: 'https://www.ticketmaster.fr/x' }), true);
  assert.equal(imageDeLaSource({ image: 'https://scontent.cdninstagram.com/a.jpg', source_site: 'shotgun.live', url: 'https://shotgun.live/x' }), false);
  assert.equal(imageDeLaSource({ image: 'https://blog-quelconque.fr/a.jpg', source_site: 'Shotgun', url: 'https://shotgun.live/e' }), false);
});

test('pseudo Instagram dans le nom de la soirée : écrit lisiblement', async () => {
  const { assainir } = await import('../src/recherche.mjs');
  const a = assainir({ name: 'Naya Cannes - rudboy_music x djaymoune', venue: 'Naya', city: 'Cannes', instagram: [] });
  assert.equal(a.name, 'Naya Cannes - Rudboy Music x djaymoune');
  assert.ok(a.instagram.includes('rudboy_music'));
  assert.equal(assainir({ name: 'Soirée Vol.2 @ Le 109', venue: 'Le 109' }).name, 'Soirée Vol.2 @ Le 109');
  assert.equal(assainir({ name: 'B2B Techno', venue: 'X' }).name, 'B2B Techno');
});

test('Instagram : un compte introuvable (code 110) est mis de côté 30 jours', async () => {
  const { comptesALire } = await import('../src/recherche.mjs');
  const now = new Date('2026-11-21T18:00:00Z');
  const orgas = { partenaires: ['inconnu', 'dj1'], introuvables: { inconnu: '2026-11-21T10:00:00Z' } };
  assert.deepEqual(comptesALire({ orgas, lieux: [], now, max: 5 }), ['dj1']);
  assert.ok(comptesALire({ orgas, lieux: [], now: new Date('2026-12-25T00:00:00Z'), max: 5 }).includes('inconnu'));
});
