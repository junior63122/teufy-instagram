// Couvertures sans répétition dans la grille (18/11/2026, directeur : « ne pas utiliser tout le temps les mêmes images »).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { BANQUE, FENETRE, choisirPhoto, photosRecentes } from '../src/photos.mjs';

test('la banque existe vraiment et dépasse la fenêtre', () => {
  const dispo = readdirSync(new URL('../studio/public/decors/da/', import.meta.url)).map((f) => f.replace(/\.jpg$/, ''));
  for (const b of BANQUE) assert.ok(dispo.includes(b), b);
  assert.ok(BANQUE.length > FENETRE);
});

test('jamais une des 9 dernières couvertures', () => {
  const hist = [];
  for (let k = 0; k < 40; k++) {
    const pref = [['taxi', 'terrasse'], ['lasers', 'foule'], ['danse', 'foule', 'dj']][k % 3];
    const r = photosRecentes(hist);
    const p = choisirPhoto(pref, r);
    assert.ok(!r.includes(p), `publication ${k} : ${p} déjà dans ${r}`);
    hist.push({ id: `p${k}`, photo: p });
  }
});

test('la photo qui colle au sujet passe en premier quand elle est libre', () => {
  assert.equal(choisirPhoto(['taxi', 'terrasse'], ['lasers', 'foule']), 'taxi');
  assert.equal(choisirPhoto(['taxi', 'terrasse'], ['taxi', 'foule']), 'terrasse');
});

test('les reels hors grille ne comptent pas', () => {
  assert.deepEqual(photosRecentes([{ photo: 'taxi' }, { photo: 'foule', hors_grille: true }]), ['taxi']);
});

test('le module photos garde toutes ses fonctions (19/11/2026 : photoSource avait été effacée, Édition Tekno en échec)', async () => {
  const m = await import('../src/photos.mjs');
  for (const f of ['photoSource', 'choisirPhoto', 'photosRecentes']) assert.equal(typeof m[f], 'function', f);
});

test('run.mjs : pas de constante lue avant sa déclaration (AMORCE_PHOTOS en tête du fichier)', async () => {
  const { readFileSync } = await import('node:fs');
  const s = readFileSync(new URL('../src/run.mjs', import.meta.url), 'utf8');
  assert.ok(s.indexOf('const AMORCE_PHOTOS') < s.indexOf('async function prepare('), 'AMORCE_PHOTOS doit être déclarée avant prepare()');
});

// Mises en page qui tournent (19/11/2026, directeur : « tous les posts ont la même couverture… triste et monotone »).
import { MISES, MISE_FENETRE, choisirMise, misesRecentes } from '../src/photos.mjs';
import { readFileSync } from 'node:fs';

test('mises en page : jamais la même deux fois de suite, toutes servent sur un cycle', () => {
  let hist = [{ photo: 'dj' }, { photo: 'foule' }]; // anciennes couvertures sans mise = « bas »
  const suite = [];
  for (let i = 0; i < 15; i++) { const m = choisirMise(misesRecentes(hist)); suite.push(m); hist.push({ photo: 'x', mise: m }); }
  assert.notEqual(suite[0], 'bas');
  for (let i = 1; i < suite.length; i++) assert.ok(!suite.slice(Math.max(0, i - MISE_FENETRE), i).includes(suite[i]), suite.join(' '));
  assert.deepEqual(new Set(suite.slice(0, MISES.length)), new Set(MISES));
});

test('mises en page : stories et posts hors grille ne comptent pas', () => {
  const r = misesRecentes([{ photo: 'a', mise: 'haut' }, { photo: 'b', mise: 'cadre', hors_grille: true }, { id: 'story' }]);
  assert.deepEqual(r, ['haut']);
});

test('chaque mise existe dans le studio (posts et couvertures de reel)', () => {
  const tsx = readFileSync(new URL('../studio/src/da/Posts.tsx', import.meta.url), 'utf8');
  for (const m of MISES) assert.match(tsx, new RegExp(`'${m}'`), m);
  assert.match(tsx, /CouvertureReel[^\n]*mise\?: Mise/);
});
