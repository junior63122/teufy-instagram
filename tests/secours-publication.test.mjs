// 23/11/2026 : « Cannot access 'SECOURS' before initialization » : la liste des formats de secours était déclarée après la
// boucle principale de src/run.mjs ; le post du jour n'a pas pu partir en secours (17 h, 18 h, 19 h).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('formats de secours disponibles dès la boucle principale (pas de constante déclarée après son usage)', () => {
  const s = readFileSync(new URL('../src/run.mjs', import.meta.url), 'utf8');
  const fn = s.indexOf('async function prepareSecours');
  assert.ok(fn > 0);
  const corps = s.slice(fn, s.indexOf('\n}\n', fn));
  assert.match(corps, /const SECOURS = \[/, 'la liste doit être déclarée dans la fonction');
  assert.ok(!/^const SECOURS\b/m.test(s), 'aucune constante SECOURS au niveau du module');
});

// 27/11/2026 : jamais un format arrêté (spots promo, « Tague ton pote ») en secours.
test('secours : aucun format arrêté par le directeur', () => {
  const s = readFileSync(new URL('../src/run.mjs', import.meta.url), 'utf8');
  const ligne = s.match(/const SECOURS = \[[^\n]*\];/)[0];
  assert.doesNotMatch(ligne, /spot-promo|tague-ton-pote|promo'/);
});
