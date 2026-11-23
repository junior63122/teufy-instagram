// 23/11/2026 (directeur, capture du spot « Défi gratuit » : « attention à ne plus cropper le logo ! ») : le logo n'est pas carré ;
// arrondi directement, il devient une ellipse qui coupe les lettres. Et jamais d'emoji dans les vidéos (règle du 19/11/2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

const DIR = new URL('../studio/generateur-gsap/', import.meta.url);
const modeles = readdirSync(DIR, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== 'node_modules' && !d.name.startsWith('exemple')) // exemple-monaco : ancienne démonstration, jamais publiée
  .flatMap((d) => [`${d.name}/index.html`, `${d.name}/modele/index.html`]).filter((f) => existsSync(new URL(f, DIR)));

test('vidéos motion : le logo n\'est jamais arrondi directement (toujours dans un cercle, en entier)', () => {
  assert.ok(modeles.length >= 3);
  for (const f of modeles) {
    const h = readFileSync(new URL(f, DIR), 'utf8');
    for (const m of h.matchAll(/<img[^>]*logo[^>]*>/g)) assert.ok(!/border-radius/.test(m[0]), `${f} : logo arrondi directement (${m[0].slice(0, 90)})`);
  }
});

test('vidéos motion : aucun emoji dans les textes affichés', () => {
  for (const f of modeles) {
    const corps = readFileSync(new URL(f, DIR), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
    const e = corps.match(/\p{Extended_Pictographic}/u);
    assert.ok(!e, `${f} : emoji « ${e?.[0]} » dans la vidéo`);
  }
});
