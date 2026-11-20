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

test('secours des appels directs du site : image envoyée à un modèle qui lit les images, JSON relu, rien de faux', async () => {
  const vrai = globalThis.fetch; let corps;
  try {
    globalThis.fetch = async (url, o) => { corps = JSON.parse(o.body); return reponse(200, JSON.stringify({ choices: [{ message: { content: 'Voici : {"titre":"TEKNO","dates":["2026-11-28"]}' } }] })); };
    const r = await LLM.groqParties([{ inline_data: { mime_type: 'image/jpeg', data: 'AAAA' } }, { text: 'Lis cette affiche.' }], { config });
    assert.deepEqual(r, { titre: 'TEKNO', dates: ['2026-11-28'] });
    assert.match(corps.model, /scout|vision|llama-4/);
    assert.equal(corps.messages[1].content[1].type, 'image_url');
    globalThis.fetch = async () => reponse(200, JSON.stringify({ choices: [{ message: { content: 'pas de json' } }] }));
    assert.equal(await LLM.groqParties([{ text: 'x' }], { config }), null);
  } finally { globalThis.fetch = vrai; }
});

test('recherche web sans Gemini : Groq écrit la requête, Tavily cherche, Groq répond à partir des résultats seulement', async () => {
  const vrai = globalThis.fetch; const appels = [];
  const reponse = (status, corps) => ({ ok: status < 400, status, text: async () => corps, json: async () => JSON.parse(corps), headers: new Map() });
  process.env.TAVILY_API_KEY = 'tvly-test';
  const LLM = await import('../src/llm.mjs?tavily'); // module neuf : le test précédent a marqué Groq « à sec »
  try {
    globalThis.fetch = async (url, o = {}) => {
      appels.push(String(url));
      if (/models$/.test(url)) return reponse(200, JSON.stringify({ data: [{ id: 'openai/gpt-oss-120b' }] }));
      if (/tavily/.test(url)) return reponse(200, JSON.stringify({ results: [{ title: 'GTA 6 au High', url: 'https://www.instagram.com/p/x/', content: 'Samedi 21 novembre au High Club' }] }));
      const b = JSON.parse(o.body);
      if (/moteur de recherche/.test(b.messages[0].content)) return reponse(200, JSON.stringify({ choices: [{ message: { content: '{"requetes":["High Club Nice soirée 21 novembre 2026"]}' } }] }));
      assert.match(b.messages[1].content, /Samedi 21 novembre au High Club/);
      assert.match(b.messages[0].content, /qu'à partir des résultats/);
      return reponse(200, JSON.stringify({ choices: [{ message: { content: 'GTA 6 au High le 21/11 (https://www.instagram.com/p/x/)' } }] }));
    };
    const r = await LLM.rechercher({ config, system: 's', prompt: 'Soirées du High ce week-end ?', gratuit: true });
    assert.match(r, /GTA 6 au High/);
    assert.match(r, /Sources consultées :\nhttps:\/\/www\.instagram\.com\/p\/x\//);
    assert.ok(appels.some((u) => /api\.tavily\.com/.test(u)));
    // Aucun résultat : erreur, jamais une réponse inventée.
    globalThis.fetch = async (url, o = {}) => /models$/.test(url) ? reponse(200, JSON.stringify({ data: [{ id: 'openai/gpt-oss-120b' }] })) : /tavily/.test(url) ? reponse(200, '{"results":[]}') : reponse(200, JSON.stringify({ choices: [{ message: { content: '{"requetes":["x"]}' } }] }));
    const LLM2 = await import('../src/llm.mjs?tavily-vide');
    assert.equal(await LLM2.rechercher({ config, system: 's', prompt: 'p', gratuit: true }), '');
  } finally { globalThis.fetch = vrai; delete process.env.TAVILY_API_KEY; }
});

// 20/11/2026 : réponses « vides de sens » jamais prises pour un succès.
test('JSON : réponse sans le champ obligatoire du schéma ou coupée par la limite de longueur = échec, jamais un succès', async () => {
  const LLM = await import('../src/llm.mjs?schema');
  const schema = { type: 'object', required: ['evenements'], properties: { evenements: { type: 'array' } } };
  assert.deepEqual(LLM.ecartsSchema(schema, { evenements: [] }), []);
  assert.ok(LLM.ecartsSchema(schema, {}).length);
  assert.ok(LLM.ecartsSchema(schema, { evenements: 'aucune' }).length);
  assert.ok(LLM.ecartsSchema(schema, []).length);
  const vrai = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => /models$/.test(url) ? reponse(200, JSON.stringify({ data: [{ id: 'openai/gpt-oss-120b' }] })) : reponse(200, JSON.stringify({ choices: [{ message: { content: '{}' } }] }));
    await assert.rejects(LLM.json({ config, system: 's', prompt: 'p', schema, gratuit: true }), /Aucune IA/);
    globalThis.fetch = async (url) => /models$/.test(url) ? reponse(200, JSON.stringify({ data: [{ id: 'openai/gpt-oss-120b' }] })) : reponse(200, JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '{"evenements":[{"name":"A"}]}' } }] }));
    await assert.rejects(LLM.json({ config, system: 's', prompt: 'p', schema, gratuit: true }), /Aucune IA/);
  } finally { globalThis.fetch = vrai; }
});
