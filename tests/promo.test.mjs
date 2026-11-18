import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../studio/scripts/concepts/', import.meta.url);
const promos = readdirSync(dir).filter((f) => f.startsWith('promo-')).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url)));
const PAGES = ['accueil', 'ce-soir', 'pres-de-moi', 'manger-tard', 'avantages', 'clubs-bars'];

test('promo de Teufy tous les 2 jours environ (lun, mer, ven, dim), directeur 20/11/2026', () => {
  const jours = config.calendrier_reels.filter((r) => r.variante === 'promo').map((r) => r.jour);
  assert.deepEqual(jours, [1, 3, 5, 7]);
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
