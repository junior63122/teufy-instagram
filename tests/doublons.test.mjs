import test from 'node:test';
import assert from 'node:assert/strict';
import { memeSoiree, fusionner } from '../src/recherche.mjs';

const a = { name: 'Honey Club - Saturday Bee Crazy', start: '2026-11-14T22:59:00.000Z', venue: 'Honey Club', url: 'https://shotgun.live/events/honey-club-saturday-bee-crazy', confiance: 0.95 };
const b = { ...a, start: '2026-11-13T23:00:00.000Z', url: 'https://shotgun.live/fr/events/honey-club-saturday-bee-crazy' };

test('même page de billetterie (langue près) = même soirée', () => assert.ok(memeSoiree(a, b)));
test('heure bouche-trou (00:00 / 23:59) le même jour = même soirée', () => assert.ok(memeSoiree(a, { ...b, url: '' })));
test('deux soirées différentes du même lieu restent séparées', () => {
  assert.ok(!memeSoiree({ name: 'Techno Night', start: '2026-11-13T23:00:00Z', venue: 'High Club', url: 'https://shotgun.live/events/a' }, { name: 'Afro Vibes', start: '2026-11-14T22:59:00Z', venue: 'High Club', url: 'https://shotgun.live/events/b' }));
});
test('soirée hebdomadaire : semaines différentes restent séparées', () => assert.ok(!memeSoiree(a, { ...a, start: '2026-11-21T22:59:00Z' })));
test('fusionner garde une seule fiche', () => assert.equal(fusionner([a, b]).length, 1));
test('page commune à plusieurs nuits (festival) : soirées différentes restent séparées', () => {
  const u = 'https://shotgun.live/festivals/xyz-festival';
  assert.ok(!memeSoiree({ name: 'Mouchki / Dhermo — Forest / Psytrance', start: '2026-11-20T20:00:00Z', venue: 'Forêt', url: u }, { name: 'Alienduch — House / Techno / Acid / Rave', start: '2026-11-21T20:00:00Z', venue: 'Forêt', url: u }));
});
