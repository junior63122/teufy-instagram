import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fournisseurs, json, rechercher, budgetOk } from '../src/llm.mjs';

const env = (vars, fn) => async () => {
  const avant = { ...process.env };
  for (const k of ['GEMINI_API_KEY', 'GROQ_API_KEY', 'TAVILY_API_KEY', 'GITHUB_TOKEN', 'GITHUB_ACTIONS', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'TEUFY_IA_MANUEL', 'TEUFY_PUBLICATION']) delete process.env[k]; // y compris les vraies clés des robots (le 20/11, GROQ_API_KEY présente sur GitHub faisait échouer ce test et bloquait les publications)
  // Compteur de dépense vide pour chaque test (jamais le vrai compteur du jour, dont le plafond peut être atteint).
  process.env.TEUFY_BUDGET_FICHIER = path.join(os.tmpdir(), `teufy-budget-test-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  Object.assign(process.env, vars);
  const f = globalThis.fetch;
  try { await fn(); } finally { process.env = avant; globalThis.fetch = f; }
};

test('gratuit par défaut : Claude seulement si payant autorisé ; GitHub Models (fermé le 30/07/2026) n\'est plus proposé', env({ GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q', GITHUB_TOKEN: 't', GITHUB_ACTIONS: 'true', ANTHROPIC_API_KEY: 'a' }, async () => {
  assert.deepEqual(fournisseurs({}), ['gemini', 'groq']);
  assert.deepEqual(fournisseurs({ llm: { payant_autorise: true } }), ['anthropic', 'gemini', 'groq']);
}));

test('JSON : Gemini en panne → Groq (gratuit) prend le relais', env({ GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q' }, async () => {
  const appels = [];
  globalThis.fetch = async (url, o) => {
    appels.push(String(url));
    if (String(url).includes('generativelanguage')) return new Response('quota', { status: 429 });
    assert.match(String(url), /api\.groq\.com/);
    assert.match((o?.headers || {}).authorization, /^Bearer q$/);
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }));
  };
  const r = await json({ config: {}, system: 's', prompt: 'p', schema: { type: 'object' } });
  assert.deepEqual(r, { ok: true });
  assert.equal(appels.filter((u) => !u.includes('pageSize') && !u.endsWith('/models')).length, 2); // (+ les listes de modèles Gemini et Groq)
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

test('GitHub Models jamais par défaut (fermé par GitHub le 30/07/2026)', env({ GEMINI_API_KEY: 'g', GITHUB_TOKEN: 't', GITHUB_ACTIONS: 'true' }, async () => {
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

test('lancement manuel : Groq (gratuit) reste permis, Gemini non', env({ GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q', TEUFY_IA_MANUEL: '1' }, async () => {
  const { budgetOk } = await import('../src/llm.mjs');
  assert.equal(budgetOk('gemini', {}), false);
  assert.equal(budgetOk('groq', {}), true);
}));

test('marketing (24/11) : scénarios et légendes des réels → Gemini d\'abord, puis Claude, puis Groq', async () => {
  const { ORDRE_MARKETING } = await import('../src/llm.mjs');
  assert.deepEqual(ORDRE_MARKETING.slice(0, 3), ['gemini', 'anthropic', 'groq']);
  const fs = await import('node:fs');
  for (const f of ['studio/scripts/ecrire.mjs', 'studio/scripts/ecrire-flash.mjs']) {
    const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.ok(!/json\(\{config, system,/.test(src), `${f} : appel sans marketing`);
  }
});

test('API Instagram (24/11) : v26 par défaut, étiquette IA sur le conteneur principal seulement, jamais de métrique supprimée', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../src/instagram.mjs', import.meta.url), 'utf8');
  assert.match(src, /IG_API_VERSION \|\| 'v26\.0'/);
  assert.match(src, /media_type: 'CAROUSEL', children: children\.join\(','\), caption, \.\.\.etiquetteIA\(ia\)/);
  assert.ok(!/is_carousel_item: 'true', \.\.\.etiquetteIA/.test(src), 'jamais sur les enfants');
  for (const m of ['impressions', "'plays'", 'clips_replays_count', 'ig_reels_aggregated_all_plays_count']) assert.ok(!src.includes(`'${m.replace(/'/g, '')}'`) || m === "'plays'" && !/'plays'/.test(src), m);
  const run = fs.readFileSync(new URL('../src/run.mjs', import.meta.url), 'utf8');
  assert.match(run, /const ia = p\.ia \?\? \(!!p\.photo/);
  assert.ok(!/v21\.0/.test(fs.readFileSync(new URL('../src/prospection.mjs', import.meta.url), 'utf8')));
});
