// 23/11/2026 (directeur : « tout se ressemble, même les photos ») : la banque de la DA grandit (variantes « danse-2 »…) et les
// couvertures prennent la variante la moins vue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choisirPhoto } from '../src/photos.mjs';

test('couverture : variante d\'un thème prise quand le thème vient de servir ; banque lue sur le disque', () => {
  const banque = ['danse', 'danse-2', 'foule', 'foule-2', 'dj'];
  assert.equal(choisirPhoto(['danse'], ['danse'], banque), 'danse-2');
  assert.equal(choisirPhoto(['danse'], [], banque), 'danse');
  assert.equal(choisirPhoto(['danse'], ['danse', 'danse-2'], banque), 'foule');
});
