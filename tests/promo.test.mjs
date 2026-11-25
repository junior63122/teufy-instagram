import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../studio/scripts/concepts/', import.meta.url);
const promos = readdirSync(dir).filter((f) => f.startsWith('promo-')).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url)));
const PAGES = ['accueil', 'ce-soir', 'pres-de-moi', 'manger-tard', 'avantages', 'clubs-bars'];

// 25/11/2026 : la règle « au moins 1 réel promo par semaine » (20/11) est levée par le directeur (« on avait dit qu'on
// arrêtait les réels comme ça ») : plus aucun réel promo de l'appli sur Instagram.
test('promo de Teufy : plus aucun réel promo sur Instagram (directeur, 25/11/2026)', () => {
  assert.ok(!config.calendrier_reels.some((r) => ['promo', 'spot-promo'].includes(r.variante)));
});

test('chaque promo : renvoie vers le site et le compte, montre de vraies pages, répliques courtes', () => {
  assert.ok(promos.length >= 6);
  for (const c of promos) {
    assert.equal(c.promo, true, c.id);
    assert.match(c.legende, /teufyparty\.com/, `${c.id} : lien du site`);
    assert.match(c.legende, /@teufy_official|abonne/i, `${c.id} : abonnement`);
    assert.equal(c.scenes.length, c.extra.plans.length, c.id);
    for (const s of c.scenes) assert.ok(s.texte.replace(/\[[^\]]+\]/g, '').trim().split(/\s+/).length <= 12, `${c.id} : réplique trop longue : ${s.texte}`);
    for (const p of c.extra.plans) if (p.capture) assert.ok(PAGES.includes(p.capture.split('@')[0]), `${c.id} : page inconnue ${p.capture}`);
    assert.ok(c.extra.plans.some((p) => p.capture), `${c.id} : au moins une vraie page du site`);
  }
});
