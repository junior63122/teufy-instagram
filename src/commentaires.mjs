// Réponses aux commentaires des publications récentes (14 jours), dans le ton de Teufy.
//   node src/commentaires.mjs [--dry-run]
// - Ne répond jamais deux fois au même commentaire, ni à nos propres commentaires.
// - L'IA ne répond qu'à partir des infos du post (jamais de prix, date ou lieu inventés) ; sinon renvoie vers la
//   billetterie, le lien de l'organisateur ou les messages privés.
// - Ignore spam, insultes et commentaires sans réponse utile. 25 réponses au plus par passage.
// Suivi : contenus/commentaires.json. Nécessite la permission instagram_manage_comments sur le jeton.
import { readFileSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { igConfig, monCompte, commentaires, repondre } from './instagram.mjs';
import { json } from './llm.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
const config = lire(path.join(ROOT, 'config.json'), {});
const hist = lire(path.join(ROOT, 'historique.json'), []);
const SUIVI = path.join(ROOT, 'contenus', 'commentaires.json');
const suivi = lire(SUIVI, { traites: {} });
const DRY = process.argv.includes('--dry-run');
const MAX = 25;

const ig = igConfig();
if (!ig) { console.log('Commentaires : IG_ACCESS_TOKEN / IG_USER_ID absents.'); process.exit(0); }
if (config.commentaires?.actif === false) { console.log('Commentaires : désactivé (config.commentaires.actif).'); process.exit(0); }

let moi = '';
try { moi = (await monCompte(ig)).toLowerCase(); } catch (err) { console.error(`Commentaires : compte illisible (${err.message})`); }
const recents = hist.filter((h) => h.media && Date.now() - new Date(h.le || h.date) < 14 * 864e5).slice(-20);

const aTraiter = [];
for (const h of recents) {
  let liste;
  try { liste = await commentaires(h.media, ig); } catch (err) {
    console.error(`Commentaires de ${h.id} illisibles : ${err.message}`);
    if (/permission|scope|#10\b|code 10|code 200/i.test(err.message)) { console.error('→ Le jeton Instagram n\'a pas la permission instagram_manage_comments.'); break; }
    continue;
  }
  for (const c of liste) {
    if (suivi.traites[c.id]) continue;
    if ((c.username || '').toLowerCase() === moi) continue;
    if ((c.replies?.data || []).some((r) => (r.username || '').toLowerCase() === moi)) { suivi.traites[c.id] = { deja: true }; continue; }
    aTraiter.push({ id: c.id, auteur: c.username, texte: String(c.text || '').slice(0, 500), post: h.id, contexte: h.publication });
  }
}
console.log(`Commentaires : ${aTraiter.length} nouveau(x) sur ${recents.length} publication(s) récente(s).`);
if (!aTraiter.length) { await writeFile(SUIVI, JSON.stringify(suivi, null, 1) + '\n'); process.exit(0); }

const posts = Object.fromEntries(recents.map((h) => [h.id, { type: h.publication?.type, titre: h.publication?.titre, legende: String(h.publication?.legende || '').slice(0, 1500) }]));
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['reponses'],
  properties: { reponses: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'repondre', 'reponse'], properties: {
    id: { type: 'string' }, repondre: { type: 'boolean', description: 'false pour spam, insulte, pub, bot, ou commentaire qui ne demande rien et où une réponse serait forcée.' },
    reponse: { type: 'string', description: 'Réponse (≤ 160 caractères), vide si repondre = false.' },
  } } } },
};
const system = `Tu gères les commentaires Instagram de Teufy (@teufy_official), le guide des soirées de la Côte d'Azur, public 17-30 ans.
Ton : tutoiement, chaleureux, drôle quand ça s'y prête, court (1 phrase, 160 caractères max), 1 emoji max, jamais commercial ni robotique, jamais de hashtag.
Règles strictes :
- Réponds UNIQUEMENT avec les infos présentes dans le post (légende). N'invente jamais un prix, une date, un horaire, un lieu, une règle d'entrée.
- Question dont la réponse n'est pas dans le post : renvoie vers la billetterie ou le compte de l'organisateur cité dans la légende, ou propose d'écrire en message privé.
- Débat (réponse A/B, avis) : réagis à son choix avec complicité, relance la conversation.
- Un pote tagué ou un « on y va ? » : réponse courte et fun qui encourage à venir.
- Compliment : remercie simplement.
- Critique polie : remercie, prends en compte, sans te justifier longuement.
- Spam, pub, insulte, propos haineux ou sexuels, demande de drogue : repondre = false.
- Ne mentionne jamais que tu es une IA ou un bot, ne promets rien au nom des organisateurs.`;
const prompt = `Posts concernés :\n${JSON.stringify(posts)}\n\nCommentaires à traiter :\n${JSON.stringify(aTraiter.slice(0, 40).map(({ id, auteur, texte, post }) => ({ id, auteur, texte, post })))}\n\nRéponds selon le schéma, un élément par commentaire.`;

let res;
try { res = await json({ config, system, prompt, schema: SCHEMA, nom: 'reponses_commentaires', gratuit: true }); } catch (err) { console.error(`Commentaires : IA indisponible (${err.message})`); process.exit(0); }

let n = 0;
for (const r of res.reponses || []) {
  const c = aTraiter.find((x) => x.id === r.id);
  if (!c) continue;
  const texte = String(r.reponse || '').trim().slice(0, 300);
  if (!r.repondre || !texte) { suivi.traites[c.id] = { ignore: true, le: new Date().toISOString() }; continue; }
  if (n >= MAX) break;
  if (DRY) { console.log(`(aperçu) @${c.auteur} « ${c.texte} » → ${texte}`); continue; }
  try {
    await repondre(c.id, texte, ig);
    suivi.traites[c.id] = { reponse: texte, le: new Date().toISOString(), post: c.post };
    n++;
    console.log(`Répondu à @${c.auteur} : ${texte}`);
  } catch (err) { console.error(`Réponse impossible à ${c.id} : ${err.message}`); }
}
// On garde les 3000 derniers suivis.
suivi.traites = Object.fromEntries(Object.entries(suivi.traites).slice(-3000));
await writeFile(SUIVI, JSON.stringify(suivi, null, 1) + '\n');
console.log(`Commentaires : ${n} réponse(s) publiée(s).`);
