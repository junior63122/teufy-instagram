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
