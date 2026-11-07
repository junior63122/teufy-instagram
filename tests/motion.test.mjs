import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ressort } from '../src/motion.mjs';

test('ressort : easing CSS linear() qui part de 0, dépasse puis se pose à 1', () => {
  const pop = ressort({ damping: 11, stiffness: 170, mass: 0.7 });
  const vals = pop.ease.slice(7, -1).split(',').map(Number);
  assert.equal(vals[0], 0);
  assert.equal(vals.at(-1), 1);
  assert.ok(Math.max(...vals) > 1.05, 'le ressort « pop » dépasse');
  assert.ok(pop.dur > 0.3 && pop.dur < 3);
  const doux = ressort({ damping: 26, stiffness: 90, mass: 1 });
  assert.ok(Math.max(...doux.ease.slice(7, -1).split(',').map(Number)) < 1.03, 'un ressort amorti ne rebondit presque pas');
});
