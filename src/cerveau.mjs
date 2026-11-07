// Le « cerveau » hebdomadaire du bot (Claude, via l'API Anthropic) :
//  1. Veille : cherche sur le web les nouveautés Instagram / Meta des 14 derniers jours
//     (sources officielles en priorité) et leur impact pour un compte de soirées.
//  2. Analyse : lit les notes /100 de tous les posts (bot et équipe), les traits qui font
//     monter ou baisser la note et les tendances des autres comptes, explique pourquoi.
//  3. Décide : propose de nouvelles accroches, intros et débats à tester, ajuste les règles
//     (hashtags max, durée des reels…) si une source officielle le confirme, fixe l'objectif.
// Tout passe par des garde-fous dans le code avant d'être appliqué, et est journalisé
// dans ANALYSE.md (repris dans RAPPORT.md) et veille/AAAA-MM-JJ.md.
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, scorePosts, note, effets, objectif, buildModel, hash } from './learn.mjs';
import { tendancesAuto } from './tendances.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TENDANCES_FILE = path.join(ROOT, 'contenus', 'tendances.json');
const DEBATS_FILE = path.join(ROOT, 'contenus', 'debats.json');
const ANALYSE_FILE = path.join(ROOT, 'ANALYSE.md');
const MODEL = 'claude-opus-5-5';

const STYLE = `Ton de @teufy_official : français, phrases courtes et sensorielles, proche du public des soirées de la Côte d'Azur.
Exemples réels du compte : « Cette semaine, la Côte d'Azur ne dort pas. Nice, Cannes, Monaco… des ambiances, des styles, des vibes pour tous. »,
« Les soirées du Nouvel An arrivent. Pas juste une soirée. Des ambiances complètement différentes… », « Vous organisez une soirée pour le Nouvel An ? Postez-la ici 👇 ».
Interdits : tiret cadratin (—), « lien en bio », toute invitation à télécharger l'app Teufy (pas encore sortie), promesses que le compte ne peut pas tenir, ton publicitaire ou « IA ».`;

// --- Garde-fous ---------------------------------------------------------------

const texteOk = (s, max) => typeof s === 'string' && s.trim().length > 2 && s.length <= max && !/—|lien en bio|t[ée]l[ée]charg/i.test(s);
const hashtagOk = (h) => /^#[\p{L}\p{N}_]{2,40}$/u.test(h);

export async function analyserSemaine({ now = new Date(), dryRun = false, log = console.log, client } = {}) {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      log('ANTHROPIC_API_KEY absent : pas d\'analyse hebdomadaire.');
      return null;
    }
    client = new Anthropic();
  }
  const today = now.toISOString().slice(0, 10);
  const tendances = JSON.parse(readFileSync(TENDANCES_FILE, 'utf8'));
  const data = loadData();
  const posts = scorePosts(data).sort((a, b) => String(b.publie_le).localeCompare(String(a.publie_le)));
  const model = buildModel(data);

  // 1. Veille web ---------------------------------------------------------------
  const veille = await appel(client, {
    max_tokens: 16000,
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }],
    system: 'Tu fais la veille Instagram d\'un compte de soirées (Côte d\'Azur, France). Tu ne rapportes que des faits vérifiables, avec source et date.',
    messages: [{
      role: 'user',
      content: `Nous sommes le ${today}. Cherche les nouveautés Instagram et Meta des 14 derniers jours qui peuvent changer ce qu'un compte de soirées doit publier : algorithme, règles (hashtags, formats, durée des reels, originalité), nouvelles fonctions (carrousels, reels, trial reels, musique), API de publication (Graph API, changelog développeurs), tendances de formats et de sons. Priorité aux sources officielles (about.instagram.com, creators.instagram.com, about.fb.com, developers.facebook.com, déclarations d'Adam Mosseri), puis médias spécialisés. Pour chaque point : date, source (URL), si c'est officiel ou non, et l'impact concret pour nous. Dis clairement s'il n'y a rien de nouveau.`,
    }],
  });
  log('Veille faite.');

  // 2 et 3. Analyse et décisions (sortie JSON contrôlée par un schéma) -----------
  const resumePosts = posts.slice(0, 40).map((p) => ({
    date: p.date, par: p.source === 'manuel' ? 'équipe' : 'bot', type: [p.type, p.variante].filter(Boolean).join('-'),
    titre: p.titre || null, accroche: (p.legende || p.caption || '').split('\n')[0].slice(0, 120), note: note(p),
    portee: p.metrics.reach, likes: p.metrics.likes, commentaires: p.metrics.comments, enregistrements: p.metrics.saved,
    partages: p.metrics.shares, abonnes_gagnes: p.metrics.follows ?? null, choix: p.choix || null,
  }));
  const armsTestes = Object.entries(model.arms).filter(([, s]) => s.n >= 2).map(([k, s]) => ({ option: k, posts: s.n, note_moy: Math.round(50 * s.sum / s.n) }));
  const t = tendancesAuto();
  const contexte = {
    date: today,
    objectif_actuel: objectif(data),
    posts_notes: resumePosts,
    traits_effet_sur_note: effets(data).slice(0, 25).concat(effets(data).slice(-15)),
    options_deja_testees: armsTestes.slice(0, 60),
    accroches_reels_actuelles: tendances.accroches_reels,
    intros_ajoutees: tendances.intros_ajoutees || {},
    regles_actuelles: tendances.regles_instagram,
    tendances_autres_comptes: { formats: t.formats, heures: t.heures, hashtags: Object.keys(t.hashtags || {}).slice(0, 20), accroches: (t.accroches || []).slice(0, 10) },
  };
  const schema = {
    type: 'object', additionalProperties: false,
    required: ['resume', 'nouveautes', 'analyse', 'regles', 'nouvelles_accroches', 'nouvelles_intros', 'nouveaux_debats', 'hashtags_a_tester', 'objectif_prochaine_semaine'],
    properties: {
      resume: { type: 'string', description: 'Résumé de la semaine en 3 à 6 phrases, en français, pour le fondateur.' },
      nouveautes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['titre', 'date', 'source', 'officiel', 'impact'], properties: { titre: { type: 'string' }, date: { type: 'string' }, source: { type: 'string' }, officiel: { type: 'boolean' }, impact: { type: 'string' } } } },
      analyse: { type: 'array', description: 'Pourquoi certains posts marchent mieux : constat, preuve chiffrée, action.', items: { type: 'object', additionalProperties: false, required: ['constat', 'preuve', 'action'], properties: { constat: { type: 'string' }, preuve: { type: 'string' }, action: { type: 'string' } } } },
      regles: { type: 'object', additionalProperties: false, required: ['hashtags_max', 'reel_duree_min_s', 'reel_duree_max_s', 'accroche_max_s', 'source_officielle'], description: 'Valeurs à appliquer. Ne change une valeur que si une source officielle récente le justifie, sinon recopie la valeur actuelle.', properties: { hashtags_max: { type: 'integer' }, reel_duree_min_s: { type: 'integer' }, reel_duree_max_s: { type: 'integer' }, accroche_max_s: { type: 'number' }, source_officielle: { type: 'string', description: 'URL officielle justifiant un changement, ou chaîne vide.' } } },
      nouvelles_accroches: { type: 'array', description: 'Au plus 4 accroches de reels à tester (texte court, lisible sans le son).', items: { type: 'object', additionalProperties: false, required: ['variante', 'titre', 'sous'], properties: { variante: { type: 'string', enum: ['weekend', 'techno', 'petits-prix'] }, titre: { type: 'string' }, sous: { type: 'string' } } } },
      nouvelles_intros: { type: 'array', description: 'Au plus 4 débuts de légende à tester pour les incontournables.', items: { type: 'object', additionalProperties: false, required: ['variante', 'texte'], properties: { variante: { type: 'string', enum: ['commercial', 'techno'] }, texte: { type: 'string' } } } },
      nouveaux_debats: { type: 'array', description: 'Au plus 2 sujets de débat (A ou B) qui font commenter, sans polémique blessante.', items: { type: 'object', additionalProperties: false, required: ['q', 'a', 'b', 'legende'], properties: { q: { type: 'string' }, a: { type: 'string' }, b: { type: 'string' }, legende: { type: 'string' } } } },
      hashtags_a_tester: { type: 'array', description: 'Au plus 5 hashtags pertinents (Côte d\'Azur, nightlife, styles) à tester.', items: { type: 'string' } },
      objectif_prochaine_semaine: { type: 'integer', description: 'Note /100 visée pour les posts de la semaine prochaine.' },
    },
  };
  const brut = await appel(client, {
    max_tokens: 16000,
    system: `Tu es le directeur de la stratégie Instagram de Teufy (soirées de la Côte d'Azur). Ton but : faire monter la note /100 des posts (engagement, enregistrements, partages, abonnés gagnés) à chaque fois. Tu raisonnes à partir des chiffres fournis, tu expliques pourquoi un post a mieux marché (heure, jour, sujet, titre, photo, lieu, nom et source de l'événement, styles, hashtags, forme de la légende) et tu proposes des tests précis.\n\n${STYLE}`,
    messages: [{
      role: 'user',
      content: `Veille de la semaine :\n${veille}\n\nDonnées du compte (JSON) :\n${JSON.stringify(contexte)}\n\nRends ta décision selon le schéma. Peu de données (moins de 8 posts notés) : dis-le dans le résumé et privilégie des tests variés.`,
    }],
    output_config: { effort: 'high', format: { type: 'json_schema', schema } },
  });
  let d;
  try { d = JSON.parse(brut); } catch { log('Réponse non lisible, rien n\'est appliqué.'); return null; }

  // 4. Application avec garde-fous ----------------------------------------------
  const appliques = [];
  const r = d.regles || {};
  const R = tendances.regles_instagram;
  const officiel = typeof r.source_officielle === 'string' && /^https:\/\/(about\.instagram\.com|creators\.instagram\.com|about\.fb\.com|developers\.facebook\.com|help\.instagram\.com|www\.facebook\.com\/business)/.test(r.source_officielle);
  if (officiel) {
    if (Number.isInteger(r.hashtags_max) && r.hashtags_max >= 1 && r.hashtags_max <= 30 && r.hashtags_max !== R.hashtags_max) { appliques.push(`hashtags max ${R.hashtags_max} → ${r.hashtags_max}`); R.hashtags_max = r.hashtags_max; }
    if (r.reel_duree_min_s >= 3 && r.reel_duree_max_s <= 180 && r.reel_duree_min_s < r.reel_duree_max_s && `${r.reel_duree_min_s},${r.reel_duree_max_s}` !== String(R.reel_duree_cible_s)) { appliques.push(`durée reels → ${r.reel_duree_min_s}-${r.reel_duree_max_s} s`); R.reel_duree_cible_s = [r.reel_duree_min_s, r.reel_duree_max_s]; }
    if (r.accroche_max_s >= 0.8 && r.accroche_max_s <= 3 && r.accroche_max_s !== R.accroche_max_s) { appliques.push(`accroche → ${r.accroche_max_s} s`); R.accroche_max_s = r.accroche_max_s; }
    if (appliques.length) R._derniere_maj = `${today} (${r.source_officielle})`;
  }
  for (const a of (d.nouvelles_accroches || []).slice(0, 4)) {
    const liste = tendances.accroches_reels[a.variante];
    if (liste && texteOk(a.titre, 70) && texteOk(a.sous, 30) && !liste.some((x) => x.titre === a.titre)) { liste.push({ titre: a.titre, sous: a.sous, ajout: today }); appliques.push(`accroche ${a.variante} : « ${a.titre} »`); }
  }
  tendances.intros_ajoutees ||= { commercial: [], techno: [] };
  for (const i of (d.nouvelles_intros || []).slice(0, 4)) {
    const liste = tendances.intros_ajoutees[i.variante];
    if (liste && texteOk(i.texte, 260) && !liste.includes(i.texte)) { liste.push(i.texte); appliques.push(`intro ${i.variante} : « ${i.texte.split('\n')[0]} »`); }
  }
  const H = tendances.hashtags_candidats;
  for (const h of (d.hashtags_a_tester || []).slice(0, 5).map((x) => String(x).toLowerCase())) {
    const cible = /nice|cannes|monaco|antibes|azur|riviera|juan/.test(h) ? H.local : /techno|rave|underground/.test(h) ? H.techno : H.commercial;
    if (hashtagOk(h) && !cible.includes(h) && h !== H.marque.toLowerCase()) { cible.push(h); appliques.push(`hashtag ${h}`); }
  }
  // Élagage : une option testée au moins 4 fois et nettement sous la moyenne est retirée.
  const faible = (pool, id) => { const s = model.arms[`${pool}:${id}`]; return s && s.n >= 4 && s.sum / s.n < 0.75; };
  for (const [v, liste] of Object.entries(tendances.accroches_reels)) {
    if (!Array.isArray(liste)) continue;
    const garde = liste.filter((h) => !faible(`hook-${v}`, hash(h.titre)));
    if (garde.length >= 2 && garde.length < liste.length) { appliques.push(`accroches ${v} retirées : ${liste.length - garde.length}`); tendances.accroches_reels[v] = garde; }
  }
  const debats = JSON.parse(readFileSync(DEBATS_FILE, 'utf8'));
  for (const db of (d.nouveaux_debats || []).slice(0, 2)) {
    if ([db.q, db.a, db.b].every((x) => texteOk(x, 160)) && texteOk(db.legende, 500)) {
      const id = `ia-${today}-${hash(db.q)}`;
      if (!debats.some((x) => x.q === db.q)) { debats.push({ id, q: db.q, a: db.a, b: db.b, legende: db.legende, ajout: today }); appliques.push(`débat « ${db.q} »`); }
    }
  }
  tendances.objectif_semaine = Math.max(objectif(data), Math.min(100, Number(d.objectif_prochaine_semaine) || 0));

  const md = `## Analyse de la semaine du ${today}

${d.resume}

**Objectif des prochains posts : ${tendances.objectif_semaine}/100**

### Nouveautés Instagram / Meta
${(d.nouveautes || []).map((n) => `- ${n.officiel ? '🟢 officiel' : '🟡 non officiel'} · ${n.date} · **${n.titre}** : ${n.impact} ([source](${n.source}))`).join('\n') || '- Rien de nouveau cette semaine.'}

### Pourquoi certains posts marchent mieux
${(d.analyse || []).map((a) => `- **${a.constat}** (${a.preuve}) → ${a.action}`).join('\n') || '-'}

### Ce que le bot a changé
${appliques.map((x) => `- ${x}`).join('\n') || '- Rien.'}
`;
  if (dryRun) { log(md); return { decision: d, appliques, md }; }
  await writeFile(TENDANCES_FILE, JSON.stringify(tendances, null, 2) + '\n');
  await writeFile(DEBATS_FILE, JSON.stringify(debats, null, 2) + '\n');
  await writeFile(ANALYSE_FILE, md);
  await mkdir(path.join(ROOT, 'veille'), { recursive: true });
  await writeFile(path.join(ROOT, 'veille', `${today}.md`), `${md}\n### Veille brute\n\n${veille}\n`);
  log(md);
  return { decision: d, appliques, md };
}

export function derniereAnalyse() {
  return existsSync(ANALYSE_FILE) ? readFileSync(ANALYSE_FILE, 'utf8') : '';
}

// Appel Claude (Opus 5.5, réflexion adaptative) avec repli serveur en cas de refus,
// reprise des tours mis en pause par la recherche web, et texte final concaténé.
async function appel(client, params) {
  const messages = [...params.messages];
  for (let tour = 0; tour < 4; tour++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      ...params,
      messages,
    });
    const res = await stream.finalMessage();
    if (res.stop_reason === 'refusal') throw new Error('Claude a refusé la demande.');
    if (res.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: res.content }); continue; }
    return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  }
  throw new Error('La recherche web n\'a pas abouti.');
}
