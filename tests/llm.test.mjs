import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fournisseurs, json, rechercher } from '../src/llm.mjs';

const env = (vars, fn) => async () => {
  const avant = { ...process.env };
  for (const k of ['GEMINI_API_KEY', 'GITHUB_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN']) delete process.env[k];
  Object.assign(process.env, vars);
  const f = globalThis.fetch;
  try { await fn(); } finally { process.env = avant; globalThis.fetch = f; }
};

test('gratuit par défaut : Claude seulement si payant autorisé', env({ GEMINI_API_KEY: 'g', GITHUB_TOKEN: 't', ANTHROPIC_API_KEY: 'a' }, async () => {
  assert.deepEqual(fournisseurs({}), ['gemini', 'github']);
  assert.deepEqual(fournisseurs({ llm: { payant_autorise: true } }), ['anthropic', 'gemini', 'github']);
}));

test('JSON : Gemini en panne → GitHub Models prend le relais', env({ GEMINI_API_KEY: 'g', GITHUB_TOKEN: 't' }, async () => {
  const appels = [];
  globalThis.fetch = async (url, o) => {
    appels.push(String(url));
    if (String(url).includes('generativelanguage')) return new Response('quota', { status: 429 });
    assert.match(o.headers.authorization, /^Bearer t$/);
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }));
  };
  const r = await json({ config: {}, system: 's', prompt: 'p', schema: { type: 'object' } });
  assert.deepEqual(r, { ok: true });
  assert.equal(appels.filter((u) => !u.includes('pageSize')).length, 2); // (+ la liste des modèles Gemini)
}));

test('recherche Gemini : texte et sources citées', env({ GEMINI_API_KEY: 'g' }, async () => {
  globalThis.fetch = async (url, o) => {
    assert.ok(JSON.parse(o.body).tools[0].google_search);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Soirée X' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://a' } }] } }] }));
  };
  const t = await rechercher({ config: {}, system: 's', prompt: 'p' });
  assert.match(t, /Soirée X/);
  assert.match(t, /https:\/\/a/);
}));
