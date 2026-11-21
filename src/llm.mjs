// Accès aux modèles d'IA, en gratuit par défaut :
//  1. Gemini (Google AI Studio, offre gratuite, clé GEMINI_API_KEY) : texte, JSON, et recherche
//     Google intégrée (« grounding ») pour trouver les soirées et faire la veille.
//  2. GitHub Models (gratuit dans GitHub Actions avec le GITHUB_TOKEN, permission models: read) : Jamais en local (le jeton de la session n'est pas une clé Teufy).
//     texte et JSON, sans recherche web.
//  2 bis. Groq (offre gratuite sans carte bancaire, clé GROQ_API_KEY, 20/11/2026) : texte, JSON, et recherche web
//     (modèle « groq/compound »). Remplace GitHub Models, fermé par GitHub le 30/07/2026.
//  3. Claude (API Anthropic, payante) : seulement si config.llm.payant_autorise = true, et alors en premier.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

// --- Garde-fous budget (demande du directeur : budget mensuel limité) ------------------------------------------
// Compteur d'appels par IA, par jour et par mois, enregistré dans contenus/budget-ia.json (committé par les workflows).
// Au-delà des plafonds de config.llm (max_appels_<ia>_jour / _mois), l'IA n'est plus appelée jusqu'au lendemain / mois suivant.
const FICHIER_BUDGET = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'contenus', 'budget-ia.json');
const PLAFONDS = { gemini: [1500, 30000], anthropic: [120, 2500], groq: [900, 25000], tavily: [30, 950] }; // anti-emballement seulement (boucle, panne) : jamais atteints en usage normal
function lireBudget() {
  const j = new Date().toISOString().slice(0, 10), m = j.slice(0, 7);
  let b = {}; try { b = existsSync(FICHIER_BUDGET) ? JSON.parse(readFileSync(FICHIER_BUDGET, 'utf8')) : {}; } catch { b = {}; }
  if (b.mois !== m) b = { mois: m, jour: j, total: {}, aujourdhui: {}, euros_jour: 0, euros_mois: 0 };
  if (b.jour !== j) { b.jour = j; b.aujourdhui = {}; b.euros_jour = 0; for (const x of Object.values(b.euros_ia || {})) x.jour = 0; }
  b.total ||= {}; b.aujourdhui ||= {};
  // Ancien compteur commun : ce qui a déjà été dépensé est attribué à Claude (seule IA payante utilisée jusqu'ici).
  b.euros_ia ||= { anthropic: { jour: b.euros_jour || 0, mois: b.euros_mois || 0 } };
  return b;
}
// IA dont le compte est à sec (HTTP 402 / crédits épuisés) : plus appelée pendant ce passage (évite des centaines d'échecs).
const aSec = new Set();
export const marquerASec = (f, err) => {
  const m = String(err?.message || '');
  const credit = err?.status === 402 || /prepayment credits|credit balance is too low/i.test(m);
  const quota = !credit && (err?.status === 429 || /RESOURCE_EXHAUSTED/i.test(m)); // limite d'appels par minute ou par jour, PAS un manque de crédit
  if (quota) { if (!aQuota.has(f)) console.error(`IA ${f} : limite d'appels atteinte (HTTP ${err?.status || 429}, quota, pas un manque de crédit) : on continue, l'appel suivant passera.`); aQuota.add(f); return; }
  if (!credit) return;
  if (!aSec.has(f)) console.error(`Budget IA : ${f} sans crédit (HTTP 402), plus appelé pendant ce passage.`);
  aSec.add(f);
};
const aQuota = new Set();
// secondaire = tâche qui peut attendre (veille, horaires des lieux) : elle s'arrête à 75 % du budget du jour, pour que
// les tâches essentielles (soirées du site, publications) gardent toujours de quoi tourner.
// Règle du directeur (12/11/2026) : Gemini et Claude sont réservés aux robots automatiques. Un lancement manuel
// (TEUFY_IA_MANUEL=1, posé par les workflows lancés à la main sans « exception ») n'appelle jamais une IA payante.
export const iaPayanteInterdite = () => process.env.TEUFY_IA_MANUEL === '1';
// Publication (TEUFY_PUBLICATION=1) : le plafond DU JOUR ne doit jamais empêcher de poster ni de créer le post ;
// il est alors dépassé en exception (le plafond du mois et les garde-fous anti-emballement restent actifs).
const publication = () => process.env.TEUFY_PUBLICATION === '1';
export function budgetOk(f, L = {}, secondaire = false) { // L est réaffecté pour Gemini (budget propre)
  if (aSec.has(f)) return false;
  if (f === 'github') return true; // gratuit
  if (iaPayanteInterdite()) { if (!(budgetOk.manuel ||= new Set()).has(f)) console.error(`IA ${f} non utilisée : lancement manuel (réservée aux robots automatiques, sauf exception).`); budgetOk.manuel.add(f); return false; }
  const exception = publication() && !secondaire;
  const b = lireBudget(), [dj, dm] = PLAFONDS[f] || [Infinity, Infinity];
  const okJ = (b.aujourdhui[f] || 0) < (L[`max_appels_${f}_jour`] ?? dj), okM = (b.total[f] || 0) < (L[`max_appels_${f}_mois`] ?? dm);
  if (!okJ || !okM) console.error(`Budget IA : plafond ${okM ? 'du jour' : 'du mois'} atteint pour ${f}, appel évité.`);
  // Plafond en euros (estimation, toutes IA confondues) : config.llm.budget_jour_eur / budget_mois_eur.
  // Budgets séparés par IA (11/11/2026) : Claude ne peut plus consommer la part de Gemini (et inversement).
  // Gemini : config.llm.budget_gemini_jour_eur (par défaut 2 €) ; Claude : budget_jour_eur / budget_mois_eur.
  const eJ = (b.euros_ia?.[f]?.jour) || 0, eM = (b.euros_ia?.[f]?.mois) || 0;
  if (f === 'gemini') L = { ...L, budget_jour_eur: L.budget_gemini_jour_eur ?? 2, budget_mois_eur: L.budget_gemini_mois_eur ?? 40 };
  if (secondaire && L.budget_jour_eur != null && eJ >= 0.75 * L.budget_jour_eur) { console.error(`Budget IA : tâche secondaire reportée (≈ ${eJ.toFixed(2)} € dépensés, réserve gardée pour les soirées et les publications).`); return false; }
  const okEJ = L.budget_jour_eur == null || eJ < L.budget_jour_eur, okEM = L.budget_mois_eur == null || eM < L.budget_mois_eur;
  if (!okEJ || !okEM) { if (!(budgetOk.dit ||= new Set()).has(f)) console.error(`Budget IA (${f}) : ${okEM ? `budget du jour atteint (≈ ${eJ.toFixed(2)} € / ${L.budget_jour_eur} €)` : `budget du mois atteint (≈ ${eM.toFixed(2)} € / ${L.budget_mois_eur} €)`} : plus d'appel payant avant ${okEM ? 'demain' : 'le mois prochain'}.`); budgetOk.dit.add(f); }
  if (exception && okM && okEM && (!okJ || !okEJ)) { if (!budgetOk.exc) console.error(`Budget IA (${f}) : plafond du jour dépassé en exception pour publier.`); budgetOk.exc = true; return true; }
  return okJ && okM && okEJ && okEM;
}
// Coût estimé d'un appel (euros), réglable dans config.llm.cout_eur : une recherche web coûte bien plus qu'une rédaction.
const COUT_DEFAUT = { gemini_recherche: 0.04, gemini_appel: 0.004, gemini_image: 0.04, gemini_image_pro: 0.13, anthropic_recherche: 0.6, anthropic_appel: 0.12 };
let COUTS = COUT_DEFAUT;
export const reglerCouts = (L = {}) => { COUTS = { ...COUT_DEFAUT, ...(L.cout_eur || {}) }; };
export function compter(f, type = 'appel') {
  if (f === 'github') return;
  try { const b = lireBudget(); b.aujourdhui[f] = (b.aujourdhui[f] || 0) + 1; b.total[f] = (b.total[f] || 0) + 1;
    const c = COUTS[`${f}_${type}`] ?? 0; b.euros_jour = Math.round(((b.euros_jour || 0) + c) * 1000) / 1000; b.euros_mois = Math.round(((b.euros_mois || 0) + c) * 1000) / 1000; b.euros_ia ||= {}; const e = (b.euros_ia[f] ||= { jour: 0, mois: 0 }); e.jour = Math.round((e.jour + c) * 1000) / 1000; e.mois = Math.round((e.mois + c) * 1000) / 1000; mkdirSync(path.dirname(FICHIER_BUDGET), { recursive: true }); writeFileSync(FICHIER_BUDGET, JSON.stringify(b, null, 1) + '\n'); } catch { /* compteur indisponible : pas bloquant */ }
}
export function etatBudget() { return lireBudget(); }
const GH = 'https://models.github.ai/inference/chat/completions';

// `gratuit: true` : les IA gratuites passent devant Claude (veille horaire, tâches fréquentes et peu coûteuses).
// Crédit Gemini épuisé jusqu'à une date (config.llm.gemini_pause_jusqu_au, « AAAA-MM-JJ ») : Gemini n'est plus appelé
// (pas d'appels en échec ni d'attente inutile) ; les secours prennent le relais. (13/11/2026, directeur : plus de crédit
// Gemini avant le mois prochain.)
export const geminiEnPause = (config = {}, now = Date.now()) => { const d = config.llm?.gemini_pause_jusqu_au; return !!d && now < Date.parse(`${d}T00:00:00+01:00`); };
export function fournisseurs(config = {}, { gratuit = false } = {}) {
  const L = config.llm || {};
  const out = [];
  if (process.env.GEMINI_API_KEY && !geminiEnPause(config)) out.push('gemini');
  if (process.env.GROQ_API_KEY && L.groq !== false) out.push('groq');
  // GitHub Models : fermé par GitHub le 30/07/2026 (répond « OK » à tout) ; gardé seulement si la config le réactive.
  if (process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_TOKEN && L.github_models === true) out.push('github');
  // Claude passe en premier quand le payant est autorisé (meilleure qualité), les IA gratuites restent en secours.
  // Continuité : si Gemini est à sec, Claude prend le relais des tâches fréquentes (secours_payant, actif par défaut),
  // dans la limite des plafonds anti-emballement ; et inversement. GitHub Models (gratuit) reste le dernier secours.
  if (L.payant_autorise && (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) && (!gratuit || L.secours_payant !== false)) {
    if (gratuit) out.splice(out.indexOf('github') === -1 ? out.length : out.indexOf('github'), 0, 'anthropic'); else out.unshift('anthropic');
  }
  return out;
}
export const rechercheWebDisponible = (config) => fournisseurs(config).some((f) => ['gemini', 'anthropic', 'groq'].includes(f));

async function post(url, body, headers = {}) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(body?.tools ? 150000 : 180000) });
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
    catch (err) {
      derniere = err; if (err.status !== 404) throw err; geminiRetires.add(m); console.error(`Gemini : ${m} indisponible, modèle suivant.`);
      // Google indique souvent le remplaçant (« use models/gemini-x-flash ») : on l'essaie aussitôt.
      const conseil = String(err.message).match(/use models\/([\w.-]+)/)?.[1];
      if (conseil && !geminiRetires.has(conseil) && !geminiListe.includes(conseil)) { geminiListe.unshift(conseil); return postGemini(L, body); }
    }
  }
  throw derniere || new Error('aucun modèle Gemini');
}

const texteGemini = (j) => (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();

// --- Recherche web (texte libre, sources citées) ----------------------------------

export async function rechercher({ config, system, prompt, gratuit = false, secondaire = false }) {
  const L = config.llm || {}; reglerCouts(L);
  // Recherche web : Gemini d'abord (recherche Google native, bien moins chère), Claude en relais s'il est indisponible.
  // Claude Opus reste en premier pour la rédaction (json / textes non « gratuits »). Réglable : llm.recherche_claude_en_premier.
  for (const f of fournisseurs(config, { gratuit: gratuit || L.recherche_claude_en_premier !== true })) {
    if (!budgetOk(f, L, secondaire)) continue;
    try {
      if (f === 'gemini') {
        const j = await postGemini(L, {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        });
        compter(f, 'recherche');
        // Réponse vide (blocage, quota) : jamais un succès (avant : « Sources consultées : » seul passait pour un résultat).
        if (!texteGemini(j)) throw new Error('Gemini : recherche sans réponse');
        const sources = (j.candidates?.[0]?.groundingMetadata?.groundingChunks || []).map((c) => c.web?.uri).filter(Boolean);
        return `${texteGemini(j)}\n\nSources consultées :\n${sources.slice(0, 40).join('\n')}`;
      }
      if (f === 'anthropic') { const r = await claude({ system, prompt, outils: true, L }); compter(f, 'recherche'); return r; }
      if (f === 'groq') { const r = await groqRecherche({ L, system, prompt, secondaire }); compter(f, 'recherche'); return r; }
    } catch (err) { marquerASec(f, err); console.error(`Recherche ${f} impossible : ${err.message.slice(0, 160)}`); }
  }
  return '';
}

// --- Réponse JSON contrôlée par un schéma -----------------------------------------

/** Écarts d'une réponse au schéma demandé (champs obligatoires du premier niveau, listes). Vide = conforme.
 *  20/11/2026 : un « {} » ou une réponse sans la liste attendue était pris pour un succès (lot compté « fait »). */
export function ecartsSchema(schema, obj) {
  if (!schema || schema.type !== 'object') return [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['la réponse n\'est pas un objet JSON'];
  const pb = [];
  for (const k of schema.required || []) {
    if (!(k in obj) || obj[k] === undefined) { pb.push(`champ « ${k} » absent`); continue; }
    const t = schema.properties?.[k]?.type;
    if (t === 'array' && !Array.isArray(obj[k])) pb.push(`« ${k} » n'est pas une liste`);
  }
  return pb;
}
const conforme = (schema, r, qui) => { const pb = ecartsSchema(schema, r); if (pb.length) throw new Error(`${qui} : réponse non conforme au schéma (${pb.join(', ')})`); return r; };

export async function json({ config, system, prompt, schema, nom = 'reponse', gratuit = false, secondaire = false }) {
  const L = config.llm || {}; reglerCouts(L);
  for (const f of fournisseurs(config, { gratuit })) {
    if (!budgetOk(f, L, secondaire)) continue;
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
        return conforme(schema, JSON.parse(texteGemini(j)), 'Gemini');
      }
      if (f === 'github') return conforme(schema, await githubModels({ L, system, prompt, schema, nom }), 'GitHub Models');
      if (f === 'groq') { const r = await groqJson({ L, system, prompt, schema, nom }); compter(f); return conforme(schema, r, 'Groq'); }
      if (f === 'anthropic') { const r = JSON.parse(await claude({ system, prompt, schema, L })); compter(f); return conforme(schema, r, 'Claude'); }
    } catch (err) { marquerASec(f, err); console.error(`IA ${f} impossible : ${err.message.slice(0, 160)}`); }
  }
  throw new Error('Aucune IA disponible (secret gratuit GROQ_API_KEY ou GEMINI_API_KEY)');
}

// --- GitHub Models (gratuit, dernier secours quand Gemini et Claude n'ont plus de crédit) ----------------------------
// Deux points d'accès (le nouveau, puis l'ancien) et une sortie JSON tolérante : le 10/11, une réponse « OK » non JSON
// faisait échouer ce secours.
async function githubModels({ L, system, prompt, schema, nom }) {
  const modele = L.modele_github || 'openai/gpt-4.1-mini';
  const h = { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${process.env.GITHUB_TOKEN.trim()}`, 'x-github-api-version': '2022-11-28' };
  const formats = [{ type: 'json_schema', json_schema: { name: nom, strict: true, schema } }, { type: 'json_object' }, null];
  const journal = [];
  // 19/11/2026 : depuis la pause de Gemini, le point d'accès models.github.ai répond « OK » (texte) au lieu de JSON ; on
  // essaie aussi l'ancien point d'accès (Azure, mêmes jetons GitHub, nom de modèle sans éditeur) avant d'abandonner.
  const acces = [[GH, modele], ['https://models.inference.ai.azure.com/chat/completions', modele.split('/').pop()]];
  for (const [url, mod] of acces) for (const format of formats) {
    try {
      const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(180000), headers: h,
        body: JSON.stringify({ model: mod, stream: false, messages: [{ role: 'system', content: `${system}\nRéponds uniquement en JSON valide${format?.type === 'json_schema' ? '' : ` selon ce schéma : ${JSON.stringify(schema)}`}.` }, { role: 'user', content: prompt.slice(0, 60000) }], ...(format ? { response_format: format } : {}) }) });
      const txt = await res.text();
      if (!res.ok) { journal.push(`${format?.type || 'texte'} : HTTP ${res.status} ${txt.slice(0, 120)}`); continue; }
      let j; try { j = JSON.parse(txt); } catch { journal.push(`${new URL(url).host} ${format?.type || 'texte'} : HTTP ${res.status} ${res.headers.get('content-type')} « ${txt.slice(0, 40).trim()} » (serveur ${res.headers.get('server') || '?'}, ${res.redirected ? `redirigé vers ${res.url}` : 'sans redirection'})`); continue; }
      const c = j.choices?.[0]?.message?.content || '';
      const m = c.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      journal.push(`${format?.type || 'texte'} : réponse vide`);
    } catch (err) { journal.push(`${format?.type || 'texte'} : ${err.message}${err.cause ? ` (${err.cause.code || err.cause.message})` : ''}`); }
  }
  // Diagnostic une fois par passage : modèles réellement disponibles pour ce jeton (pour corriger llm.modele_github).
  if (!githubModels.diag) {
    githubModels.diag = true;
    try { const r = await fetch('https://models.github.ai/catalog/models', { headers: h, signal: AbortSignal.timeout(20000) }); const t = await r.text(); console.error(`GitHub Models : catalogue HTTP ${r.status} — ${(() => { try { return JSON.parse(t).map((x) => x.id).slice(0, 12).join(', '); } catch { return t.slice(0, 120); } })()}`); } catch (err) { console.error(`GitHub Models : catalogue illisible (${err.message})`); }
  }
  for (const j of journal) console.error(`GitHub Models · ${j}`); // une ligne par essai (les journaux coupent les lignes longues)
  throw new Error(`GitHub Models indisponible (${journal.length} essais, détail ci-dessus)`);
}

// --- Claude (optionnel, payant) ---------------------------------------------------

async function claude({ system, prompt, schema, outils = false, L = {} }) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  const messages = [{ role: 'user', content: prompt }];
  for (let tour = 0; tour < 6; tour++) {
    const res = await client.beta.messages.stream({
      model: L.modele_claude || 'claude-opus-5-5', max_tokens: 32000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', thinking: { type: 'adaptive' }, system, messages,
      ...(outils ? { tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: L.max_recherches_claude ?? 20 }, { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 25 }] } : {}),
      ...(schema ? { output_config: { effort: 'medium', format: { type: 'json_schema', schema } } } : {}),
    }).finalMessage();
    if (res.stop_reason === 'refusal') throw new Error('refus');
    if (res.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: res.content }); continue; }
    return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  }
  throw new Error('pas de réponse');
}

// --- Groq (gratuit, sans carte bancaire ; API compatible OpenAI) -----------------------------------------------
// Une clé Grok (xAI, « xai-… ») mise par erreur sous ce nom marche aussi : même format d'API, autre adresse.
const estXai = () => process.env.GROQ_API_KEY.trim().startsWith('xai-');
const GROQ = () => (estXai() ? 'https://api.x.ai/v1/chat/completions' : 'https://api.groq.com/openai/v1/chat/completions');
const groqEntetes = () => ({ 'content-type': 'application/json', authorization: `Bearer ${process.env.GROQ_API_KEY.trim()}` });
// Modèles réellement ouverts à ce compte Groq (20/11/2026 : « llama-3.3-70b-versatile » et « groq/compound » répondaient
// 404 pour ce compte) : lus une fois par passage sur /models, puis choisis dans l'ordre de préférence.
let groqDispo;
async function modelesGroq() {
  if (!groqDispo) {
    try {
      const j = await (await fetch('https://api.groq.com/openai/v1/models', { headers: groqEntetes(), signal: AbortSignal.timeout(20000) })).json();
      groqDispo = (j.data || []).filter((m) => m.active !== false).map((m) => m.id);
      console.error(`Groq : ${groqDispo.length} modèle(s) ouverts (${groqDispo.slice(0, 15).join(', ')})`);
    } catch (err) { groqDispo = []; console.error(`Groq : liste des modèles illisible (${err.message})`); }
  }
  return groqDispo;
}
const PREF_JSON = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'meta-llama/llama-4-maverick-17b-128e-instruct', 'moonshotai/kimi-k2-instruct', 'qwen/qwen3-32b', 'meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.3-70b-versatile'];
const PREF_RECHERCHE = ['groq/compound', 'groq/compound-mini', 'compound-beta', 'compound-beta-mini'];
const PREF_VISION = ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct'];
async function choisirGroq(pref, voulu) {
  const dispo = await modelesGroq();
  const l = [...new Set([voulu, ...pref].filter(Boolean))];
  if (!dispo.length) return l.slice(0, 2); // liste illisible : on essaie les préférés
  const ok = l.filter((m) => dispo.includes(m));
  if (ok.length || pref === PREF_RECHERCHE || pref === PREF_VISION) return ok;
  return dispo.filter((m) => !/whisper|tts|guard|orpheus|playai|distil|prompt-guard|safeguard|compound/i.test(m)).slice(0, 2);
}
let xaiModeles;
async function modelesXai() {
  if (!xaiModeles) {
    try { const j = await (await fetch('https://api.x.ai/v1/models', { headers: groqEntetes(), signal: AbortSignal.timeout(20000) })).json();
      xaiModeles = (j.data || []).map((m) => m.id).filter((id) => /grok/.test(id) && !/image|vision|imagine|video/.test(id)).sort((a, b) => (/fast|mini/.test(b) ? 1 : 0) - (/fast|mini/.test(a) ? 1 : 0)).slice(0, 2);
    } catch { xaiModeles = []; }
  }
  return xaiModeles;
}
// Réponse coupée par la limite de longueur (finish_reason « length ») : jamais prise telle quelle. JSON → erreur (modèle
// suivant) ; texte de recherche (`tronqueOk`) → gardé sans sa dernière ligne, coupée (URL ou date à moitié écrite).
// Échéance globale (21/11/2026) : la mise à jour du site dépassait 30 min (appels Groq de 3 min + attentes 429 en série)
// et le passage de la veille était coupé avant d'enregistrer le site. Passé l'échéance, plus aucun appel n'est lancé.
let ECHEANCE = Infinity;
export const echeanceIA = (t = Infinity) => { ECHEANCE = t; };
const resteIA = () => { const r = ECHEANCE - Date.now(); if (r < 5000) { const e = new Error('IA : temps du passage écoulé'); e.status = 408; throw e; } return r; };
async function groqAppel(body, essai = 0, { tronqueOk = false } = {}) {
  const reste = resteIA();
  const res = await fetch(GROQ(), { method: 'POST', headers: groqEntetes(), body: JSON.stringify(body), signal: AbortSignal.timeout(Math.min(180000, reste)) });
  // Limite par minute de l'offre gratuite (HTTP 429) : on attend le délai indiqué par Groq (au plus 30 s), deux fois au plus.
  if (res.status === 429 && essai < 2 && ECHEANCE - Date.now() > 60000) {
    const attente = Math.min(30, parseFloat(res.headers?.get?.('retry-after')) || 12);
    await new Promise((ok) => setTimeout(ok, attente * 1000));
    return groqAppel(body, essai + 1, { tronqueOk });
  }
  const txt = await res.text();
  if (!res.ok) { const e = new Error(`Groq HTTP ${res.status} ${txt.slice(0, 200)}`); e.status = res.status; throw e; }
  const j = JSON.parse(txt); // une réponse non JSON (comme le « OK » de GitHub Models) lève une erreur : jamais pris pour un succès
  const c = j.choices?.[0]?.message?.content;
  if (!c || !String(c).trim()) throw new Error('Groq : réponse vide');
  if (j.choices[0].finish_reason === 'length') {
    if (!tronqueOk) throw new Error('Groq : réponse tronquée (limite de longueur)');
    const sans = String(c).replace(/\n[^\n]*$/, '').trim();
    if (!sans) throw new Error('Groq : réponse tronquée (limite de longueur)');
    console.error('Groq : réponse coupée par la limite de longueur, dernière ligne retirée.');
    return sans;
  }
  return c;
}
// JSON : sortie structurée stricte si le modèle la prend, sinon mode JSON, sinon texte ; toujours relu et vérifié.
async function groqJson({ L, system, prompt, schema, nom }) {
  const modeles = estXai() ? await modelesXai() : (await choisirGroq(PREF_JSON, L.modele_groq)).slice(0, 3);
  const formats = [{ type: 'json_schema', json_schema: { name: nom, strict: true, schema } }, { type: 'json_object' }, null];
  const journal = [];
  for (const model of modeles) for (const format of formats) {
    try {
      const c = await groqAppel({ model, temperature: 0.4, max_completion_tokens: 5000, ...(/gpt-oss/.test(model) ? { reasoning_effort: 'low' } : {}), messages: [{ role: 'system', content: `${system}\nRéponds uniquement en JSON valide${format?.type === 'json_schema' ? '' : ` selon ce schéma : ${JSON.stringify(schema)}`}.` }, { role: 'user', content: prompt }], ...(format ? { response_format: format } : {}) });
      const m = c.match(/\{[\s\S]*\}/);
      if (m) { const r = JSON.parse(m[0]); const pb = ecartsSchema(schema, r); if (!pb.length) return r; journal.push(`${model} ${format?.type || 'texte'} : non conforme (${pb.join(', ')})`); continue; }
      journal.push(`${model} ${format?.type || 'texte'} : pas de JSON`);
    } catch (err) {
      journal.push(`${model} ${format?.type || 'texte'} : ${err.message.slice(0, 120)}`);
      if (err.status === 429 || err.status === 401 || err.status === 404 || err.status === 413 || /max completion tokens|too large|tronqu/i.test(err.message)) break; // modèle absent, quota, trop long : modèle suivant
    }
  }
  for (const l of journal) console.error(`Groq · ${l}`);
  throw new Error(`Groq indisponible (${journal.length} essais, détail ci-dessus)`);
}
// Recherche web : modèle « groq/compound » (recherche intégrée), sources citées dans la réponse.
async function groqRecherche({ L, system, prompt, secondaire = false }) {
  if (estXai()) throw new Error('recherche web non branchée pour une clé xAI');
  const [model] = await choisirGroq(PREF_RECHERCHE, L.modele_groq_recherche);
  if (model) return groqAppel({ model, messages: [{ role: 'system', content: `${system}\nCite l'adresse (URL) de chaque source.` }, { role: 'user', content: prompt }] }, 0, { tronqueOk: true });
  // Pas de modèle de recherche chez Groq (20/11/2026, directeur : « il faut aller sur le net sans attendre Google ») :
  // moteur de recherche gratuit Tavily (1 000 recherches par mois, sans carte bancaire, secret TAVILY_API_KEY), puis
  // Groq lit les résultats et répond en citant les pages. Aucun résultat : erreur (jamais une réponse inventée).
  if (!process.env.TAVILY_API_KEY) throw new Error('aucun modèle Groq de recherche web ouvert et pas de clé TAVILY_API_KEY (moteur de recherche gratuit)');
  return rechercheTavily({ L, system, prompt, secondaire });
}
// Offre gratuite : 1 000 recherches par mois → 30 par jour au plus ; les tâches secondaires (prospection, fiches de lieux)
// s'arrêtent à 15 pour garder la veille des actus et la recherche des soirées.
export const avecTavily = (config = {}) => !!process.env.TAVILY_API_KEY && !fournisseurs(config).includes('gemini');
export async function tavily(requete, { max = 8, secondaire = false } = {}) {
  if (!budgetOk('tavily', {})) throw new Error('Tavily : plafond de recherches atteint');
  resteIA();
  if (secondaire && (lireBudget().aujourdhui.tavily || 0) >= 15) throw new Error('Tavily : recherches du jour gardées pour la veille et les soirées');
  const r = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.TAVILY_API_KEY}` }, body: JSON.stringify({ query: requete, search_depth: 'basic', max_results: max, topic: 'general' }), signal: AbortSignal.timeout(30000) });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Tavily HTTP ${r.status} ${txt.slice(0, 160)}`);
  compter('tavily', 'recherche');
  return (JSON.parse(txt).results || []).filter((x) => /^https?:\/\//.test(x.url || ''));
}
// 21/11/2026 : une limite d'appels (429) sur un modèle faisait perdre une recherche Tavily déjà payée → modèle suivant.
async function groqSuivant(modeles, corps, opts) {
  let derniere;
  for (const model of modeles) {
    try { return await groqAppel({ model, ...(/gpt-oss/.test(model) ? { reasoning_effort: 'low' } : {}), ...corps }, 0, opts); } catch (err) { derniere = err; if (![429, 404, 413, 503].includes(err.status)) throw err; }
  }
  throw derniere || new Error('aucun modèle Groq ouvert');
}
async function rechercheTavily({ L, system, prompt, secondaire = false }) {
  const modeles = (await choisirGroq(PREF_JSON, L.modele_groq)).slice(0, 3);
  if (!modeles.length) throw new Error('aucun modèle Groq ouvert');
  let requetes = [];
  try {
    const q = await groqSuivant(modeles, { max_completion_tokens: 800, messages: [{ role: 'system', content: 'Tu écris des requêtes pour un moteur de recherche web. Réponds uniquement en JSON : {"requetes": ["...", "..."]}, 1 ou 2 requêtes courtes et précises (mots-clés, lieux, mois, année), la meilleure en premier, en français.' }, { role: 'user', content: prompt.slice(0, 4000) }] });
    requetes = (JSON.parse(q.match(/\{[\s\S]*\}/)?.[0] || '{}').requetes || []).filter((x) => typeof x === 'string' && x.trim()).slice(0, L.tavily_requetes ?? 1);
  } catch {}
  if (!requetes.length) requetes = [prompt.replace(/\s+/g, ' ').slice(0, 300)];
  const vus = new Set(), res = [];
  for (const q of requetes) for (const x of await tavily(q, { secondaire })) if (!vus.has(x.url)) { vus.add(x.url); res.push(x); }
  if (!res.length) throw new Error('Tavily : aucun résultat');
  const pages = res.slice(0, 14).map((x, i) => `[${i + 1}] ${x.title || ''}\n${x.url}\n${String(x.content || '').slice(0, 1200)}`).join('\n\n');
  const c = await groqSuivant(modeles, { max_completion_tokens: 5000, messages: [{ role: 'system', content: `${system}\nTu ne réponds qu'à partir des résultats de recherche fournis ; rien d'autre. Cite l'adresse (URL) de chaque information. Si les résultats ne contiennent pas la réponse, dis-le.` }, { role: 'user', content: `${prompt}\n\nRésultats de recherche web (${new Date().toISOString().slice(0, 10)}) :\n${pages}` }] }, 0, { tronqueOk: true });
  return `${c}\n\nSources consultées :\n${res.slice(0, 14).map((x) => x.url).join('\n')}`;
}

// Secours Groq pour les appels « façon Gemini » (parties texte et images) faits directement par le site (src/site.mjs)
// quand Gemini est en pause (20/11/2026) : lecture d'images (affiches, photos de lieux), recherche web, JSON libre.
// Renvoie le JSON lu (objet ou tableau), ou le texte pour une recherche ; null si rien d'exploitable (jamais un faux « ok »).
export async function groqParties(parts, { recherche = false, config = {}, secondaire = true } = {}) {
  if (!process.env.GROQ_API_KEY || estXai() || !budgetOk('groq', config.llm || {}, secondaire)) return null;
  const L = config.llm || {};
  const texte = parts.filter((p) => p.text).map((p) => p.text).join('\n\n');
  const images = parts.filter((p) => p.inline_data || p.inlineData).map((p) => p.inline_data || p.inlineData);
  try {
    if (recherche) { const r = await groqRecherche({ L, system: 'Tu réponds en français, avec des faits sourcés.', prompt: texte, secondaire }); compter('groq', 'recherche'); return r; }
    const content = images.length
      ? [{ type: 'text', text: texte }, ...images.slice(0, 5).map((d) => ({ type: 'image_url', image_url: { url: `data:${d.mime_type || d.mimeType || 'image/jpeg'};base64,${d.data}` } }))]
      : texte;
    const [model] = images.length ? await choisirGroq(PREF_VISION, L.modele_groq_vision) : await choisirGroq(PREF_JSON, L.modele_groq);
    if (!model) return null;
    const c = await groqAppel({ model, temperature: 0.2, max_completion_tokens: 5000, ...(/gpt-oss/.test(model) ? { reasoning_effort: 'low' } : {}), messages: [{ role: 'system', content: 'Réponds uniquement en JSON valide, sans texte autour.' }, { role: 'user', content }] });
    compter('groq');
    const m = c.match(/[[{][\s\S]*[\]}]/);
    return m ? JSON.parse(m[0]) : null;
  } catch (err) { marquerASec('groq', err); return null; }
}
