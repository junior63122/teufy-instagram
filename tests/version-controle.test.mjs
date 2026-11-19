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
