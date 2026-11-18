// Spots promo (media/spot-promo/) : chaque vidéo a sa légende, sa couverture et son type d'accroche (pour que
// l'apprentissage compare les accroches) ; pas de fausse rareté dans les légendes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const DIR = path.join(import.meta.dirname, '..', 'media', 'spot-promo');
const ACCROCHES = ['question', 'pov', 'defi', 'provocation', 'liste', 'mystere', 'chiffre', 'humour', 'avant-apres', 'autre'];
const spots = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.mp4')).map((f) => f.replace(/\.mp4$/, '')) : [];

test('chaque spot promo est complet', () => {
  for (const b of spots) {
    for (const ext of ['.txt', '.couverture.txt', '.json']) assert.ok(existsSync(path.join(DIR, b + ext)), `${b}${ext} manquant`);
    const m = JSON.parse(readFileSync(path.join(DIR, `${b}.json`), 'utf8'));
    assert.ok(ACCROCHES.includes(m.accroche), `${b} : accroche « ${m.accroche} » inconnue (${ACCROCHES.join(', ')})`);
    assert.ok(Array.isArray(m.fonctionnalites) && m.fonctionnalites.length, `${b} : fonctionnalites vides`);
    const [titre] = readFileSync(path.join(DIR, `${b}.couverture.txt`), 'utf8').split('\n');
    assert.ok(titre.trim().length > 3 && titre.length <= 70, `${b} : titre de couverture absent ou trop long`);
  }
});

test('légendes des spots : pas de fausse rareté', () => {
  for (const b of spots) {
    const l = readFileSync(path.join(DIR, `${b}.txt`), 'utf8');
    assert.doesNotMatch(l, /plus que \d+|dernières? places?|places? limitées/i, b);
  }
});

test('« Tague ton pote » : chaque épisode a sa légende (avec l'appel à taguer) et sa couverture', () => {
  const D = path.join(import.meta.dirname, '..', 'media', 'tague-ton-pote');
  if (!existsSync(D)) return;
  for (const b of readdirSync(D).filter((f) => f.endsWith('.mp4')).map((f) => f.replace(/\.mp4$/, ''))) {
    assert.match(readFileSync(path.join(D, `${b}.txt`), 'utf8'), /tague/i, b);
    assert.ok(existsSync(path.join(D, `${b}.couverture.txt`)), b);
  }
});
