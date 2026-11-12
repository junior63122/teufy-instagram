import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fournisseurs, json, rechercher, budgetOk } from '../src/llm.mjs';

const env = (vars, fn) => async () => {
  const avant = { ...process.env };
  for (const k of ['GEMINI_API_KEY', 'GITHUB_TOKEN', 'GITHUB_ACTIONS', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'TEUFY_IA_MANUEL', 'TEUFY_PUBLICATION']) delete process.env[k];
  Object.assign(process.env, vars);
  const f = globalThis.fetch;
  try { await fn(); } finally { process.env = avant; globalThis.fetch = f; }
};

test('gratuit par défaut : Claude seulement si payant autorisé', env({ GEMINI_API_KEY: 'g', GITHUB_TOKEN: 't', GITHUB_ACTIONS: 'true', ANTHROPIC_API_KEY: 'a' }, async () => {
  assert.deepEqual(fournisseurs({}), ['gemini', 'github']);
  assert.deepEqual(fournisseurs({ llm: { payant_autorise: true } }), ['anthropic', 'gemini', 'github']);
}));

test('JSON : Gemini en panne → GitHub Models prend le relais', env({ GEMINI_API_KEY: 'g', GITHUB_TOKEN: 't', GITHUB_ACTIONS: 'true' }, async () => {
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

test('GitHub Models jamais hors de GitHub Actions (le jeton d\'une session locale n\'est pas une clé Teufy)', env({ GEMINI_API_KEY: 'g', GITHUB_TOKEN: 't' }, async () => {
  assert.deepEqual(fournisseurs({}), ['gemini']);
}));

test('lancement manuel : jamais d\'IA payante (réservée aux robots automatiques)', env({ GEMINI_API_KEY: 'g', TEUFY_IA_MANUEL: '1' }, async () => {
  assert.equal(budgetOk('gemini', {}), false);
  assert.equal(budgetOk('anthropic', {}), false);
}));

test('publication : le plafond du jour est dépassé en exception, jamais pour une tâche secondaire', env({ GEMINI_API_KEY: 'g' }, async () => {
  const L = { budget_gemini_jour_eur: 0 }; // plafond du jour déjà atteint
  assert.equal(budgetOk('gemini', L), false);
  process.env.TEUFY_PUBLICATION = '1';
  assert.equal(budgetOk('gemini', L), true);
  assert.equal(budgetOk('gemini', L, true), false);
  assert.equal(budgetOk('gemini', { budget_gemini_jour_eur: 0, budget_gemini_mois_eur: 0 }), false); // le plafond du mois reste actif
}));
