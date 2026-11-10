// Accès aux modèles d'IA, en gratuit par défaut :
//  1. Gemini (Google AI Studio, offre gratuite, clé GEMINI_API_KEY) : texte, JSON, et recherche
//     Google intégrée (« grounding ») pour trouver les soirées et faire la veille.
//  2. GitHub Models (gratuit dans GitHub Actions avec le GITHUB_TOKEN, permission models: read) :
//     texte et JSON, sans recherche web.
//  3. Claude (API Anthropic, payante) : seulement si config.llm.payant_autorise = true, et alors en premier.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

// --- Garde-fous budget (demande du directeur : budget mensuel limité) ------------------------------------------
// Compteur d'appels par IA, par jour et par mois, enregistré dans contenus/budget-ia.json (committé par les workflows).
// Au-delà des plafonds de config.llm (max_appels_<ia>_jour / _mois), l'IA n'est plus appelée jusqu'au lendemain / mois suivant.
const FICHIER_BUDGET = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'contenus', 'budget-ia.json');
const PLAFONDS = { gemini: [300, 6000], anthropic: [15, 250] }; // [par jour, par mois] si la config n'en donne pas
function lireBudget() {
  const j = new Date().toISOString().slice(0, 10), m = j.slice(0, 7);
  let b = {}; try { b = existsSync(FICHIER_BUDGET) ? JSON.parse(readFileSync(FICHIER_BUDGET, 'utf8')) : {}; } catch { b = {}; }
  if (b.mois !== m) b = { mois: m, jour: j, total: {}, aujourdhui: {} };
  if (b.jour !== j) { b.jour = j; b.aujourdhui = {}; }
  b.total ||= {}; b.aujourdhui ||= {};
  return b;
}
// IA dont le compte est à sec (HTTP 402 / crédits épuisés) : plus appelée pendant ce passage (évite des centaines d'échecs).
const aSec = new Set();
export const marquerASec = (f, err) => { if (err?.status === 402 || /prepayment credits|credit balance is too low|RESOURCE_EXHAUSTED/i.test(String(err?.message || ''))) { if (!aSec.has(f)) console.error(`Budget IA : ${f} sans crédit, plus appelé pendant ce passage.`); aSec.add(f); } };
export function budgetOk(f, L = {}) {
  if (aSec.has(f)) return false;
  if (f === 'github') return true; // gratuit
  const b = lireBudget(), [dj, dm] = PLAFONDS[f] || [Infinity, Infinity];
  const okJ = (b.aujourdhui[f] || 0) < (L[`max_appels_${f}_jour`] ?? dj), okM = (b.total[f] || 0) < (L[`max_appels_${f}_mois`] ?? dm);
  if (!okJ || !okM) console.error(`Budget IA : plafond ${okM ? 'du jour' : 'du mois'} atteint pour ${f}, appel évité.`);
  return okJ && okM;
}
export function compter(f) {
  if (f === 'github') return;
  try { const b = lireBudget(); b.aujourdhui[f] = (b.aujourdhui[f] || 0) + 1; b.total[f] = (b.total[f] || 0) + 1; mkdirSync(path.dirname(FICHIER_BUDGET), { recursive: true }); writeFileSync(FICHIER_BUDGET, JSON.stringify(b, null, 1) + '\n'); } catch { /* compteur indisponible : pas bloquant */ }
}
export function etatBudget() { return lireBudget(); }
const GH = 'https://models.github.ai/inference/chat/completions';

// `gratuit: true` : les IA gratuites passent devant Claude (veille horaire, tâches fréquentes et peu coûteuses).
export function fournisseurs(config = {}, { gratuit = false } = {}) {
  const L = config.llm || {};
  const out = [];
  if (process.env.GEMINI_API_KEY) out.push('gemini');
  if (process.env.GITHUB_TOKEN && L.github_models !== false) out.push('github');
  // Claude passe en premier quand le payant est autorisé (meilleure qualité), les IA gratuites restent en secours.
  // Tâches fréquentes (« gratuit ») : jamais de bascule vers Claude, sauf si config.llm.secours_payant = true
  // (sinon une panne de Gemini fait tout passer sur l'IA payante et vide le budget, ce qui est arrivé le 9/11).
  if (L.payant_autorise && (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) && (!gratuit || L.secours_payant === true)) out[gratuit ? 'push' : 'unshift']('anthropic');
  return out;
}
export const rechercheWebDisponible = (config) => fournisseurs(config).some((f) => f === 'gemini' || f === 'anthropic');

async function post(url, body, headers = {}) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  const txt = await res.text();
  if (!res.ok) { const e = new Error(`HTTP ${res.status} ${txt.slice(0, 300)}`); e.status = res.status; throw e; }
  return JSON.parse(txt);
}

// Modèles Gemini texte, du préféré au secours : celui de config.llm.modele_gemini, puis les « flash » les plus récents
// disponibles pour cette clé (Google retire régulièrement d'anciens modèles aux nouveaux comptes : un 404 passe au suivant).
let geminiListe;
const geminiRetires = new Set();
async function modelesGemini(L = {}) {
  if (!geminiListe) {
    let noms = [];
    try {
      const r = await fetch(`${GEMINI}?pageSize=200&key=${process.env.GEMINI_API_KEY.trim()}`, { signal: AbortSignal.timeout(20000) });
      noms = ((await r.json()).models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace('models/', ''));
    } catch { /* liste indisponible : modèle de la config seulement */ }
    const version = (n) => parseFloat(n.match(/^gemini-([\d.]+)/)?.[1] || 0);
    const flash = noms.filter((n) => /^gemini-[\d.]+-(flash|pro)/.test(n) && !/image|tts|audio|live|lite|embedding|thinking-exp|computer/.test(n))
      .sort((a, b) => (/-pro/.test(a) ? 1 : 0) - (/-pro/.test(b) ? 1 : 0) || version(b) - version(a) || (/preview|exp/.test(a) ? 1 : 0) - (/preview|exp/.test(b) ? 1 : 0) || a.length - b.length);
    geminiListe = [...new Set([...(L.modele_gemini ? [L.modele_gemini] : []), ...flash, 'gemini-2.5-flash'])].slice(0, 6);
  }
  return geminiListe.filter((m) => !geminiRetires.has(m));
}
async function postGemini(L, body) {
  let derniere;
  for (const m of await modelesGemini(L)) {
    try { return await post(`${GEMINI}/${m}:generateContent?key=${process.env.GEMINI_API_KEY.trim()}`, body); }
    catch (err) { derniere = err; if (err.status !== 404) throw err; geminiRetires.add(m); console.error(`Gemini : ${m} indisponible, modèle suivant.`); }
  }
  throw derniere || new Error('aucun modèle Gemini');
}

const texteGemini = (j) => (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();

// --- Recherche web (texte libre, sources citées) ----------------------------------

export async function rechercher({ config, system, prompt, gratuit = false }) {
  const L = config.llm || {};
  for (const f of fournisseurs(config, { gratuit })) {
    if (!budgetOk(f, L)) continue;
    try {
      if (f === 'gemini') {
        const j = await postGemini(L, {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        });
        compter(f);
        const sources = (j.candidates?.[0]?.groundingMetadata?.groundingChunks || []).map((c) => c.web?.uri).filter(Boolean);
        return `${texteGemini(j)}\n\nSources consultées :\n${sources.slice(0, 40).join('\n')}`;
      }
      if (f === 'anthropic') { const r = await claude({ system, prompt, outils: true, L }); compter(f); return r; }
    } catch (err) { marquerASec(f, err); console.error(`Recherche ${f} impossible : ${err.message.slice(0, 160)}`); }
  }
  return '';
}

// --- Réponse JSON contrôlée par un schéma -----------------------------------------

export async function json({ config, system, prompt, schema, nom = 'reponse', gratuit = false }) {
  const L = config.llm || {};
  for (const f of fournisseurs(config, { gratuit })) {
    if (!budgetOk(f, L)) continue;
    try {
      if (f === 'gemini') {
        const base = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }] };
        let j;
        try {
          j = await postGemini(L, { ...base, generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema } });
        } catch (err) {
          if (err.status !== 400) throw err;
          // Ancien format : schéma dans la consigne, sortie JSON simple.
          j = await postGemini(L, { ...base, contents: [{ role: 'user', parts: [{ text: `${prompt}\n\nRéponds uniquement en JSON valide selon ce schéma :\n${JSON.stringify(schema)}` }] }], generationConfig: { responseMimeType: 'application/json' } });
        }
        compter(f);
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
      if (f === 'anthropic') { const r = JSON.parse(await claude({ system, prompt, schema, L })); compter(f); return r; }
    } catch (err) { marquerASec(f, err); console.error(`IA ${f} impossible : ${err.message.slice(0, 160)}`); }
  }
  throw new Error('Aucune IA disponible (ajoute le secret gratuit GEMINI_API_KEY)');
}

// --- Claude (optionnel, payant) ---------------------------------------------------

async function claude({ system, prompt, schema, outils = false, L = {} }) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  const messages = [{ role: 'user', content: prompt }];
  for (let tour = 0; tour < 6; tour++) {
    const res = await client.beta.messages.stream({
      model: L.modele_claude || 'claude-sonnet-5-5', max_tokens: 16000, // Sonnet par défaut : bien moins cher qu'Opus betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', thinking: { type: 'adaptive' }, system, messages,
      ...(outils ? { tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: L.max_recherches_claude ?? 6 }, { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 8 }] } : {}),
      ...(schema ? { output_config: { effort: 'medium', format: { type: 'json_schema', schema } } } : {}),
    }).finalMessage();
    if (res.stop_reason === 'refusal') throw new Error('refus');
    if (res.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: res.content }); continue; }
    return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  }
  throw new Error('pas de réponse');
}
