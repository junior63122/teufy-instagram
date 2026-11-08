import { test } from 'node:test';
import assert from 'node:assert/strict';
import { associer } from '../src/cles.mjs';

test('clés retrouvées quel que soit le nom du secret', () => {
  const s = { ELEVEN_LABS: 'a', CLE_GEMINI: 'b', IG_ACCESS_TOKEN: 'c', IG_USER_ID: 'd', claude_key: 'e', github_token: 'x', VIDE: '' };
  const r = Object.fromEntries(associer(s, {}).map((a) => [a.cible, a.source]));
  assert.equal(r.ELEVENLABS_API_KEY, 'ELEVEN_LABS');
  assert.equal(r.GEMINI_API_KEY, 'CLE_GEMINI');
  assert.equal(r.ANTHROPIC_API_KEY, 'claude_key');
  assert.equal(r.IG_ACCESS_TOKEN, 'IG_ACCESS_TOKEN');
  assert.equal(r.IG_USER_ID, 'IG_USER_ID');
  assert.equal(r.PEXELS_API_KEY, undefined);
});
