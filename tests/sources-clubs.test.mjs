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
