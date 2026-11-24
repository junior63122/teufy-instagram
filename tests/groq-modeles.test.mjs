// Groq : les modèles sont choisis parmi ceux réellement ouverts au compte (20/11/2026 : deux modèles répondaient 404).
import { test } from 'node:test';
import assert from 'node:assert/strict';
// Compteur de dépense IA de test (24/11/2026) : jamais le vrai compteur du jour (contenus/budget-ia.json).
process.env.TEUFY_BUDGET_FICHIER = (await import('node:path')).join((await import('node:os')).tmpdir(), `teufy-budget-test-${process.pid}.json`);

process.env.GROQ_API_KEY = 'cle-de-test';
delete process.env.GEMINI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
const LLM = await import('../src/llm.mjs?modeles');
const rep = (corps) => ({ ok: true, status: 200, text: async () => JSON.stringify(corps), json: async () => corps });

test('JSON : modèle ouvert au compte, raisonnement court ; recherche web sautée si aucun modèle de recherche', async () => {
  const vrai = globalThis.fetch; const modeles = [];
  try {
    globalThis.fetch = async (url, o) => {
      if (String(url).endsWith('/models')) return rep({ data: [{ id: 'openai/gpt-oss-20b' }, { id: 'whisper-large-v3' }] });
      const b = JSON.parse(o.body); modeles.push(b.model);
      return rep({ choices: [{ message: { content: '{"ok":true}' } }] });
    };
    assert.deepEqual(await LLM.json({ config: {}, system: 's', prompt: 'p', schema: { type: 'object' }, gratuit: true }), { ok: true });
    assert.deepEqual(modeles, ['openai/gpt-oss-20b']);
    assert.equal(await LLM.rechercher({ config: {}, system: 's', prompt: 'p', gratuit: true }), '');
  } finally { globalThis.fetch = vrai; }
});
