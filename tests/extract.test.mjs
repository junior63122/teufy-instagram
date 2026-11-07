import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { extractEvents, dedupe } from '../src/extract.mjs';
import { filterEvents, isCoteAzur } from '../src/sources.mjs';
import { windowFor, jourCourt, plage } from '../src/dates.mjs';

execSync('node tests/make-fixtures.mjs');
const fx = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
const villes = JSON.parse(readFileSync(new URL('../config.json', import.meta.url))).villes;

test('schema.org + flux RSC (Shotgun)', () => {
  const ev = extractEvents(fx('shotgun-shotgun-live-fr-cities-nice.html'), { source: 'shotgun', baseUrl: 'https://shotgun.live/fr/cities/nice' });
  const bunker = ev.find((e) => e.name.startsWith('Techno Bunker'));
  assert.equal(bunker.venue, 'Le Bunker');
  assert.equal(bunker.city, 'Nice');
  assert.equal(bunker.price, 15);
  assert.match(bunker.url, /^https:\/\/shotgun\.live\/fr\/events\//);
  const cannes = ev.find((e) => e.name === 'Hard Techno Cannes');
  assert.equal(cannes.url, 'https://shotgun.live/fr/events/hard-techno-cannes');
});

test('__NEXT_DATA__ (DICE), prix en centimes', () => {
  const ev = extractEvents(fx('dice-dice-fm-browse-nice.html'), { source: 'dice', baseUrl: 'https://dice.fm/browse/nice' });
  const jazz = ev.find((e) => e.name.startsWith('Jazz'));
  assert.equal(jazz.city, 'Monaco');
  assert.equal(jazz.price, 25);
  assert.equal(jazz.url, 'https://dice.fm/event/jazz-monaco');
});

test('doublons Shotgun/DICE fusionnés, Paris exclu', () => {
  const a = extractEvents(fx('shotgun-shotgun-live-fr-cities-nice.html'), { source: 'shotgun', baseUrl: 'https://shotgun.live' });
  const b = extractEvents(fx('dice-dice-fm-browse-nice.html'), { source: 'dice', baseUrl: 'https://dice.fm' });
  const all = dedupe([...a, ...b]);
  assert.equal(all.filter((e) => e.name === 'Afro Vibes Night').length, 1);
  assert.equal(isCoteAzur({ city: 'Paris' }, villes), false);
  assert.equal(isCoteAzur({ city: 'Juan-les-Pins' }, villes), true);
  assert.equal(isCoteAzur({ address: '12 rue X 06000 Nice' }, villes), true);
  const { from, to } = windowFor([5, 6, 0], new Date('2026-11-09T10:00:00Z'));
  const we = filterEvents(all, { from, to, villes });
  assert.ok(we.every((e) => e.city !== 'Paris'));
  assert.equal(we.length, 5);
});

test('fenêtres et libellés en heure de Paris', () => {
  const { from, to } = windowFor([1, 2, 3, 4], new Date('2026-11-12T22:00:00Z'));
  assert.equal(from.toISOString(), '2026-11-09T05:00:00.000Z');
  assert.equal(to.toISOString(), '2026-11-13T05:00:00.000Z');
  assert.equal(jourCourt('2026-11-14T23:30:00Z'), 'Sam'); // 00h30 dimanche = nuit de samedi
  assert.equal(plage(from, to), 'du 9 au 12 novembre');
  const ete = windowFor([5, 6, 0], new Date('2026-07-01T10:00:00Z'));
  assert.equal(ete.from.toISOString(), '2026-07-03T04:00:00.000Z');
});
