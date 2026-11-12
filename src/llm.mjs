// Accès aux modèles d'IA, en gratuit par défaut :
//  1. Gemini (Google AI Studio, offre gratuite, clé GEMINI_API_KEY) : texte, JSON, et recherche
//     Google intégrée (« grounding ») pour trouver les soirées et faire la veille.
//  2. GitHub Models (gratuit dans GitHub Actions avec le GITHUB_TOKEN, permission models: read) : Jamais en local (le jeton de la session n'est pas une clé Teufy).
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
const PLAFONDS = { gemini: [1500, 30000], anthropic: [120, 2500] }; // anti-emballement seulement (boucle, panne) : jamais atteints en usage normal
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
export function fournisseurs(config = {}, { gratuit = false } = {}) {
  const L = config.llm || {};
  const out = [];
  if (process.env.GEMINI_API_KEY) out.push('gemini');
  if (process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_TOKEN && L.github_models !== false) out.push('github');
  // Claude passe en premier quand le payant est autorisé (meilleure qualité), les IA gratuites restent en secours.
  // Continuité : si Gemini est à sec, Claude prend le relais des tâches fréquentes (secours_payant, actif par défaut),
  // dans la limite des plafonds anti-emballement ; et inversement. GitHub Models (gratuit) reste le dernier secours.
  if (L.payant_autorise && (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) && (!gratuit || L.secours_payant !== false)) {
    if (gratuit) out.splice(out.indexOf('github') === -1 ? out.length : out.indexOf('github'), 0, 'anthropic'); else out.unshift('anthropic');
  }
  return out;
}
export const rechercheWebDisponible = (config) => fournisseurs(config).some((f) => f === 'gemini' || f === 'anthropic');

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
        const sources = (j.candidates?.[0]?.groundingMetadata?.groundingChunks || []).map((c) => c.web?.uri).filter(Boolean);
        return `${texteGemini(j)}\n\nSources consultées :\n${sources.slice(0, 40).join('\n')}`;
      }
      if (f === 'anthropic') { const r = await claude({ system, prompt, outils: true, L }); compter(f, 'recherche'); return r; }
    } catch (err) { marquerASec(f, err); console.error(`Recherche ${f} impossible : ${err.message.slice(0, 160)}`); }
  }
  return '';
}

// --- Réponse JSON contrôlée par un schéma -----------------------------------------

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
        return JSON.parse(texteGemini(j));
      }
      if (f === 'github') return await githubModels({ L, system, prompt, schema, nom });
      if (f === 'anthropic') { const r = JSON.parse(await claude({ system, prompt, schema, L })); compter(f); return r; }
    } catch (err) { marquerASec(f, err); console.error(`IA ${f} impossible : ${err.message.slice(0, 160)}`); }
  }
  throw new Error('Aucune IA disponible (ajoute le secret gratuit GEMINI_API_KEY)');
}

// --- GitHub Models (gratuit, dernier secours quand Gemini et Claude n'ont plus de crédit) ----------------------------
// Deux points d'accès (le nouveau, puis l'ancien) et une sortie JSON tolérante : le 10/11, une réponse « OK » non JSON
// faisait échouer ce secours.
async function githubModels({ L, system, prompt, schema, nom }) {
  const modele = L.modele_github || 'openai/gpt-4.1-mini';
  const h = { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${process.env.GITHUB_TOKEN.trim()}`, 'x-github-api-version': '2022-11-28' };
  const formats = [{ type: 'json_schema', json_schema: { name: nom, strict: true, schema } }, { type: 'json_object' }, null];
  const journal = [];
  for (const format of formats) {
    try {
      const res = await fetch(GH, { method: 'POST', signal: AbortSignal.timeout(180000), headers: h,
        body: JSON.stringify({ model: modele, stream: false, messages: [{ role: 'system', content: `${system}\nRéponds uniquement en JSON valide${format?.type === 'json_schema' ? '' : ` selon ce schéma : ${JSON.stringify(schema)}`}.` }, { role: 'user', content: prompt.slice(0, 60000) }], ...(format ? { response_format: format } : {}) }) });
      const txt = await res.text();
      if (!res.ok) { journal.push(`${format?.type || 'texte'} : HTTP ${res.status} ${txt.slice(0, 120)}`); continue; }
      let j; try { j = JSON.parse(txt); } catch { journal.push(`${format?.type || 'texte'} : HTTP ${res.status} ${res.headers.get('content-type')} « ${txt.slice(0, 40).trim()} »`); continue; }
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
  throw new Error(`GitHub Models indisponible — ${journal.join(' | ')}`);
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
