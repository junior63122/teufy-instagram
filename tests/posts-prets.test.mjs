// Posts et stories prêts (media/posts-prets/, contenus/stories-pretes.json) : complets, légendes propres, fichiers présents.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const D = path.join(ROOT, 'media', 'posts-prets');
const dossiers = existsSync(D) ? readdirSync(D).filter((x) => /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(x)) : [];

test('chaque post prêt a 1 à 10 images, une légende propre et au plus 5 hashtags', () => {
  for (const d of dossiers) {
    const imgs = readdirSync(path.join(D, d)).filter((x) => /^\d+[^/]*\.jpe?g$/i.test(x));
    assert.ok(imgs.length >= 1 && imgs.length <= 10, `${d} : ${imgs.length} images`);
    const l = readFileSync(path.join(D, d, 'legende.txt'), 'utf8');
    assert.ok(l.length <= 2200, `${d} : légende trop longue`);
    assert.ok((l.match(/#[\p{L}\p{N}_]+/gu) || []).length <= 5, `${d} : plus de 5 hashtags`);
    assert.doesNotMatch(l, /plus que \d+|dernières? places?|places? limitées/i, `${d} : fausse rareté`);
    assert.doesNotMatch(l, /—/, `${d} : tiret cadratin`);
    assert.doesNotMatch(l, /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}]/u, `${d} : emoji dans la légende (directeur : « ça fait IA »)`);
    const html = path.join(D, d, 'sources', 'visuels.html');
    if (existsSync(html)) assert.doesNotMatch(readFileSync(html, 'utf8'), /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u, `${d} : emoji dans les visuels`);
  }
});

test('les stories prêtes pointent vers des fichiers présents dans media/', () => {
  const S = JSON.parse(readFileSync(path.join(ROOT, 'contenus', 'stories-pretes.json'), 'utf8'));
  for (const s of S) {
    assert.match(s.jour, /^\d{4}-\d{2}-\d{2}$/); assert.ok(s.h >= 8 && s.h <= 23, `${s.cle} : heure ${s.h}`);
    for (const f of s.fichiers) { assert.ok(f.startsWith('media/'), f); assert.ok(existsSync(path.join(ROOT, f)), `${f} absent`); }
  }
});
