// Groq, IA gratuite de secours (20/11/2026) : GitHub Models a fermé le 30/07/2026 et répondait « OK » à tout.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.GROQ_API_KEY = 'cle-de-test';
delete process.env.GEMINI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
const LLM = await import('../src/llm.mjs?groq');
const config = { llm: {} };
const reponse = (status, corps) => ({ ok: status < 400, status, text: async () => corps, headers: new Map() });

test('Groq est proposé dès que la clé existe, GitHub Models n\'est plus utilisé', () => {
  assert.deepEqual(LLM.fournisseurs(config, { gratuit: true }), ['groq']);
  assert.ok(LLM.rechercheWebDisponible(config));
});

test('Groq : la réponse JSON est lue ; un « OK » non JSON n\'est jamais pris pour un succès', async () => {
  const vrai = globalThis.fetch;
  try {
    globalThis.fetch = async () => reponse(200, JSON.stringify({ choices: [{ message: { content: '{"sujets":[]}' } }] }));
    assert.deepEqual(await LLM.json({ config, system: 's', prompt: 'p', schema: { type: 'object' }, gratuit: true }), { sujets: [] });
    globalThis.fetch = async () => reponse(200, 'OK');
    await assert.rejects(LLM.json({ config, system: 's', prompt: 'p', schema: { type: 'object' }, gratuit: true }), /Aucune IA/);
  } finally { globalThis.fetch = vrai; }
});
