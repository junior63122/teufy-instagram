// Numéro de version au format 1.13.02 (directeur, 19/11/2026) et auto-contrôle des publications.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const V = JSON.parse(readFileSync(new URL('../contenus/version.json', import.meta.url), 'utf8')).versions;
const n = (x) => String(x).split('.').map(Number);

test('versions : format X.YY.ZZ, la plus récente en premier, toujours croissantes', () => {
  for (const v of V) assert.match(String(v.numero), /^\d+\.\d{2}\.\d{2}$/, v.numero);
  for (let i = 1; i < V.length; i++) {
    const [a, b] = [n(V[i - 1].numero), n(V[i].numero)];
    assert.ok(a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2]))), `${V[i - 1].numero} après ${V[i].numero}`);
  }
  assert.ok(n(V.at(-1).numero) >= n('1.13.01'));
});

test('auto-contrôle : relecture sur Instagram, stories reprises, contrôle à chaque passage', () => {
  const run = readFileSync(new URL('../src/run.mjs', import.meta.url), 'utf8');
  const wf = readFileSync(new URL('../.github/workflows/teufy-instagram.yml', import.meta.url), 'utf8');
  assert.match(run, /verifierMedia\(res\.id/); // après chaque publication
  assert.match(run, /cible === 'controle'/);
  assert.match(run, /entree\.manquantes/); // une story ratée n'est pas notée faite
  assert.match(wf, /node src\/run\.mjs controle/);
});

test('quota Instagram : les analyses de comptes s\'arrêtent avant d\'épuiser les publications', async () => {
  process.env.IG_API_HOST = '127.0.0.1:9'; // aucun vrai appel
  const ig = await import('../src/instagram.mjs?quota');
  const fauxIg = { user: '1', token: 'x' };
  const B = ig.quotaInstagram().budget;
  assert.ok(B > 0 && B <= 30);
  // au-delà du budget : refus immédiat, sans appel réseau
  for (let i = 0; i < B; i++) await ig.businessDiscovery('a', fauxIg).catch(() => {});
  await assert.rejects(ig.businessDiscovery('a', fauxIg), /quota Instagram gardé/);
});

test('publication : déjà en ligne malgré une erreur de l\'API = pas de second envoi ; historique écrit tout de suite', async () => {
  const { correspondPublication } = await import('../src/instagram.mjs?double');
  const t0 = Date.parse('2026-11-20T18:00:00Z');
  const medias = [{ id: '9', caption: 'Ton week-end est réglé\n\n#TeufyParty', timestamp: '2026-11-20T18:01:00+0000' }, { id: '8', caption: 'Autre', timestamp: '2026-11-19T18:00:00+0000' }];
  assert.equal(correspondPublication(medias, 'Ton week-end   est réglé\n\n#TeufyParty', t0)?.id, '9');
  assert.equal(correspondPublication(medias, 'Autre', t0), null, 'trop ancien : un autre post');
  assert.equal(correspondPublication(medias, '', t0), null);
  const run = readFileSync(new URL('../src/run.mjs', import.meta.url), 'utf8');
  const i = run.indexOf('hist.push(entreeHist)'), j = run.indexOf('verifierMedia(res.id');
  assert.ok(i > 0 && i < j, 'historique écrit avant la relecture et les stories');
  assert.match(run, /confirmerPublicationVeille/);
});

test('quota Instagram atteint : les statistiques ne repartent pas en 8 appels d\'une métrique', async () => {
  const ig = await import('../src/instagram.mjs?insights');
  const vrai = globalThis.fetch; let n = 0;
  try {
    globalThis.fetch = async () => { n++; return { ok: false, status: 400, json: async () => ({ error: { code: 4, message: 'Application request limit reached' } }) }; };
    assert.equal(await ig.insights('1', false, { user: '1', token: 'x' }), null);
    assert.equal(n, 1);
  } finally { globalThis.fetch = vrai; }
});
