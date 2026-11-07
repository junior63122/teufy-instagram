// Accès aux modèles d'IA, en gratuit par défaut :
//  1. Gemini (Google AI Studio, offre gratuite, clé GEMINI_API_KEY) : texte, JSON, et recherche
//     Google intégrée (« grounding ») pour trouver les soirées et faire la veille.
//  2. GitHub Models (gratuit dans GitHub Actions avec le GITHUB_TOKEN, permission models: read) :
//     texte et JSON, sans recherche web.
//  3. Claude (API Anthropic, payante) : seulement si config.llm.payant_autorise = true, et alors en premier.

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
const GH = 'https://models.github.ai/inference/chat/completions';

// `gratuit: true` : les IA gratuites passent devant Claude (veille horaire, tâches fréquentes et peu coûteuses).
export function fournisseurs(config = {}, { gratuit = false } = {}) {
  const L = config.llm || {};
  const out = [];
  if (process.env.GEMINI_API_KEY) out.push('gemini');
  if (process.env.GITHUB_TOKEN && L.github_models !== false) out.push('github');
  // Claude passe en premier quand le payant est autorisé (meilleure qualité), les IA gratuites restent en secours.
  if (L.payant_autorise && (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)) out[gratuit ? 'push' : 'unshift']('anthropic');
  return out;
}
export const rechercheWebDisponible = (config) => fournisseurs(config).some((f) => f === 'gemini' || f === 'anthropic');

async function post(url, body, headers = {}) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  const txt = await res.text();
  if (!res.ok) { const e = new Error(`HTTP ${res.status} ${txt.slice(0, 300)}`); e.status = res.status; throw e; }
  return JSON.parse(txt);
}

const texteGemini = (j) => (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();

// --- Recherche web (texte libre, sources citées) ----------------------------------

export async function rechercher({ config, system, prompt, gratuit = false }) {
  const L = config.llm || {};
  for (const f of fournisseurs(config, { gratuit })) {
    try {
      if (f === 'gemini') {
        const j = await post(`${GEMINI}/${L.modele_gemini || 'gemini-2.5-flash'}:generateContent?key=${process.env.GEMINI_API_KEY.trim()}`, {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        });
        const sources = (j.candidates?.[0]?.groundingMetadata?.groundingChunks || []).map((c) => c.web?.uri).filter(Boolean);
        return `${texteGemini(j)}\n\nSources consultées :\n${sources.slice(0, 40).join('\n')}`;
      }
      if (f === 'anthropic') return await claude({ system, prompt, outils: true });
    } catch (err) { console.error(`Recherche ${f} impossible : ${err.message}`); }
  }
  return '';
}

// --- Réponse JSON contrôlée par un schéma -----------------------------------------

export async function json({ config, system, prompt, schema, nom = 'reponse', gratuit = false }) {
  const L = config.llm || {};
  for (const f of fournisseurs(config, { gratuit })) {
    try {
      if (f === 'gemini') {
        const base = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }] };
        let j;
        try {
          j = await post(`${GEMINI}/${L.modele_gemini || 'gemini-2.5-flash'}:generateContent?key=${process.env.GEMINI_API_KEY.trim()}`, { ...base, generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema } });
        } catch (err) {
          if (err.status !== 400) throw err;
          // Ancien format : schéma dans la consigne, sortie JSON simple.
          j = await post(`${GEMINI}/${L.modele_gemini || 'gemini-2.5-flash'}:generateContent?key=${process.env.GEMINI_API_KEY.trim()}`, { ...base, contents: [{ role: 'user', parts: [{ text: `${prompt}\n\nRéponds uniquement en JSON valide selon ce schéma :\n${JSON.stringify(schema)}` }] }], generationConfig: { responseMimeType: 'application/json' } });
        }
        return JSON.parse(texteGemini(j));
      }
      if (f === 'github') {
        const j = await post(GH, {
          model: L.modele_github || 'openai/gpt-4.1-mini',
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt.slice(0, 60000) }],
          response_format: { type: 'json_schema', json_schema: { name: nom, strict: true, schema } },
        }, { authorization: `Bearer ${process.env.GITHUB_TOKEN.trim()}` });
        return JSON.parse(j.choices?.[0]?.message?.content || '{}');
      }
      if (f === 'anthropic') return JSON.parse(await claude({ system, prompt, schema }));
    } catch (err) { console.error(`IA ${f} impossible : ${err.message}`); }
  }
  throw new Error('Aucune IA disponible (ajoute le secret gratuit GEMINI_API_KEY)');
}

// --- Claude (optionnel, payant) ---------------------------------------------------

async function claude({ system, prompt, schema, outils = false }) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  const messages = [{ role: 'user', content: prompt }];
  for (let tour = 0; tour < 6; tour++) {
    const res = await client.beta.messages.stream({
      model: 'claude-opus-5-5', max_tokens: 32000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', thinking: { type: 'adaptive' }, system, messages,
      ...(outils ? { tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 20 }, { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 25 }] } : {}),
      ...(schema ? { output_config: { effort: 'medium', format: { type: 'json_schema', schema } } } : {}),
    }).finalMessage();
    if (res.stop_reason === 'refusal') throw new Error('refus');
    if (res.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: res.content }); continue; }
    return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  }
  throw new Error('pas de réponse');
}
