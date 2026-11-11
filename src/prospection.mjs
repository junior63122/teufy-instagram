#!/usr/bin/env node
// Prospection des partenaires Teufy (bars, clubs, organisateurs, activités, boutiques de soirée, beauté, restauration).
//
// Usage :  node src/prospection.mjs            → recherche de contacts, envois du jour, relances, rapport
//          node src/prospection.mjs --dry-run  → rien n'est envoyé : affiche les messages qui partiraient
//
// Règles (non négociables) :
//  - Seulement des contacts PROFESSIONNELS PUBLIÉS par l'établissement (site officiel), vérifiés sur la page source.
//    Jamais de numéro ou d'e-mail personnel, jamais de connexion à LinkedIn / Instagram pour aspirer des données.
//  - Chaque e-mail dit qui écrit (Teufy, société de droit monégasque), pourquoi, et comment ne plus être contacté
//    (réponse « STOP » ou en-tête List-Unsubscribe ; les adresses bloquées dans Brevo sont respectées).
//  - Au plus 2 relances (J+7, J+14), jamais le week-end, et un nombre limité d'envois par jour.
//  - Le fichier de suivi est CHIFFRÉ (le dépôt est public) : contenus/prospection.enc, clé = secret PROSPECTION_CLE.
//    Sans clé, rien n'est écrit en clair.
// Secrets : BREVO_API_KEY (envoi), PROSPECTION_CLE (chiffrement), GEMINI_API_KEY (recherche des nouveaux lieux).
import { readFileSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as LLM from './llm.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const lire = (f, d) => { try { return JSON.parse(readFileSync(path.join(ROOT, f), 'utf8')); } catch { return d; } };
const config = lire('config.json', {});
const P = { actif: false, nouveaux_par_jour: 40, relances_jours: [7, 14], recherches_par_jour: 8, ...(config.prospection || {}) };
const FICHIER = process.env.PROSPECTION_FICHIER || path.join(ROOT, 'contenus', 'prospection.enc');
const CLE = (process.env.PROSPECTION_CLE || '').trim();
const BREVO = (process.env.BREVO_API_KEY || '').trim();
const now = new Date();
const jour = now.toISOString().slice(0, 10);
const log = (...a) => console.log(...a); // jamais d'adresse e-mail dans les journaux (dépôt public, Actions publiques)

// --- Stockage chiffré (AES-256-GCM) ------------------------------------------------------------------------
const cle = () => createHash('sha256').update(CLE).digest();
export function chiffrer(obj) { const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', cle(), iv); const d = Buffer.concat([c.update(JSON.stringify(obj)), c.final()]); return Buffer.concat([iv, c.getAuthTag(), d]).toString('base64'); }
export function dechiffrer(txt) { const b = Buffer.from(txt, 'base64'); const d = createDecipheriv('aes-256-gcm', cle(), b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')); }
const charger = () => (existsSync(FICHIER) ? dechiffrer(readFileSync(FICHIER, 'utf8').trim()) : { prospects: {}, journal: [] });
const sauver = async (etat) => { if (!CLE) throw new Error('PROSPECTION_CLE absente : rien n\'est écrit (le dépôt est public).'); await writeFile(FICHIER, chiffrer(etat) + '\n'); };

// --- Catégories et pitch ---------------------------------------------------------------------------------------
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const FAMILLE = (cat) => (/club|bar|rooftop|beach|lounge|pub|salle|organisateur|festival|artiste|collectif/.test(cat || '') ? 'nuit'
  : /activite|laser|bowling|karting|escape|karaok|jeux|billard/.test(cat || '') ? 'activite'
    : /boutique|deguis|deco|beaute|maquillage|parfum/.test(cat || '') ? 'boutique'
      : /restaurant|fast|snack|pizza|burger|kebab|manger/.test(cat || '') ? 'manger' : 'nuit');
const IDEES = {
  nuit: 'un verre offert pour un acheté, l\'entrée offerte avant minuit, ou un code promo sur la billetterie',
  activite: 'une partie offerte pour un groupe de 6, ou -15 % sur la session du jeudi soir',
  boutique: '-10 % sur un déguisement ou un look de soirée sur présentation de Teufy',
  manger: 'une boisson offerte après 23 h, ou -10 % sur la commande de fin de soirée',
};
// Catégories cherchées sur le web (en plus des lieux déjà connus de Teufy).
export const RECHERCHES = [
  ['activite', 'laser game, bowling, karting, escape game, karaoké, salles de jeux, billards'],
  ['boutique', 'magasins de déguisements, de décoration et d\'accessoires de fête'],
  ['boutique', 'magasins de maquillage et de beauté (parfumeries, instituts, enseignes)'],
  ['manger', 'fast-foods, snacks, kebabs, pizzerias et burgers ouverts tard'],
  ['nuit', 'bars de nuit, boîtes de nuit, beach clubs et organisateurs de soirées'],
];
export const ZONES = ['Nice et alentours', 'Cannes, Antibes, Juan-les-Pins', 'Monaco, Menton, Beausoleil', 'Toulon, Hyères, La Seyne-sur-Mer', 'Fréjus, Saint-Raphaël, Saint-Tropez'];

// --- Base de prospects : ce que Teufy connaît déjà ------------------------------------------------------------
export function prospectsConnus() {
  const out = new Map();
  const ajoute = (x) => { if (!x.nom) return; const id = slug(`${x.nom}-${x.ville || ''}`) || slug(x.instagram); const p = out.get(id) || { id }; out.set(id, { ...x, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v)) }); };
  const infos = lire('contenus/partenaires-infos.json', {});
  for (const v of Object.values(infos)) if (v.nom && v.fiche && !['personne', 'media', 'service'].includes(v.fiche.categorie)) ajoute({ nom: v.nom, categorie: v.fiche.categorie || 'nuit', ville: v.fiche.ville || '', instagram: v.fiche.instagram || '', site: v.fiche.site || '', ancien: true });
  for (const c of lire('contenus/partenaires-comptes.json', {}).comptes || []) if (c.nom) ajoute({ nom: c.nom, categorie: 'nuit', instagram: c.instagram || '', ancien: true });
  const L = lire('contenus/lieux-nuit.json', {});
  for (const l of L.lieux || []) ajoute({ nom: l.nom, categorie: l.type, ville: l.ville, instagram: l.instagram || '', site: l.site || '', soirees: (l.soirees || []).length, ancien: !!l.partenaire });
  for (const l of lire('contenus/nuit-tardive.json', {}).lieux || []) ajoute({ nom: l.nom, categorie: l.type === 'after' ? 'nuit' : 'manger', ville: l.ville, instagram: l.instagram || '', site: l.site || '' });
  return [...out.values()];
}

// --- Recherche des contacts publiés (site officiel) -----------------------------------------------------------
const RE_MAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const INTERDITS = /(sentry|wixpress|example|domain|email\.com|exemple|\.png|\.jpg|\.webp|noreply|no-reply)/i;
async function page(url) { try { const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; TeufyBot/1.0; +https://teufyparty.com)' } }); return r.ok ? (await r.text()).slice(0, 600000) : ''; } catch { return ''; } }
export function emailsDe(html, site) {
  const dom = (() => { try { return new URL(site).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const l = [...new Set((html.replace(/&#64;|\[at\]|\(at\)/gi, '@').match(RE_MAIL) || []).map((e) => e.toLowerCase()))].filter((e) => !INTERDITS.test(e));
  // Priorité : adresse du domaine officiel, puis adresses génériques (contact@, info@, booking@…).
  return l.sort((a, b) => (b.endsWith(dom) - a.endsWith(dom)) || (/^(contact|info|hello|bonjour|booking|reservation|events?)@/.test(b) - /^(contact|info|hello|bonjour|booking|reservation|events?)@/.test(a)));
}
async function contactSite(p) {
  if (!p.site) return null;
  const base = p.site.replace(/\/$/, '');
  for (const u of [base, `${base}/contact`, `${base}/contact/`, `${base}/mentions-legales`, `${base}/nous-contacter`]) {
    const e = emailsDe(await page(u), base)[0];
    if (e) return { email: e, source: u };
  }
  return null;
}
// Nouveaux lieux par recherche web (catégorie × zone), contacts vérifiés sur la page source.
async function decouvrir(etat, max) {
  const SCHEMA = { type: 'object', additionalProperties: false, required: ['lieux'], properties: { lieux: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['nom', 'ville', 'site', 'instagram'], properties: { nom: { type: 'string' }, ville: { type: 'string' }, site: { type: 'string' }, instagram: { type: 'string' } } } } } };
  let n = 0;
  etat.recherches ||= {};
  const a_faire = RECHERCHES.flatMap(([fam, quoi]) => ZONES.map((z) => ({ fam, quoi, z, k: `${fam}|${quoi}|${z}` }))).filter((r) => !etat.recherches[r.k] || now - Date.parse(etat.recherches[r.k]) > 30 * 864e5);
  for (const r of a_faire.slice(0, max)) {
    const web = await LLM.rechercher({ config, gratuit: true, system: 'Tu fais une liste d\'établissements réels avec leurs liens officiels. Tu ne cites que ce que tu as trouvé.', prompt: `${r.quoi} à ${r.z} (Côte d'Azur / Var) qui intéresseraient les 18-30 ans qui sortent. Pour chacun : nom exact, ville, site officiel, compte Instagram.` });
    etat.recherches[r.k] = now.toISOString();
    if (!web) continue;
    const j = await LLM.json({ config, gratuit: true, nom: 'lieux', schema: SCHEMA, system: 'Tu extrais des données sans rien inventer.', prompt: `Liste :\n${web}\n\nExtrais les établissements (nom, ville, site officiel en URL complète ou vide, Instagram sans @ ou vide).` }).catch(() => null);
    for (const l of j?.lieux || []) {
      const id = slug(`${l.nom}-${l.ville}`); if (!id || etat.prospects[id]) continue;
      etat.prospects[id] = { id, nom: l.nom, ville: l.ville, categorie: r.fam, famille: r.fam, site: /^https?:\/\//.test(l.site) ? l.site : '', instagram: String(l.instagram || '').replace(/^@/, ''), statut: 'a_contacter', ajout: jour };
      n++;
    }
  }
  return n;
}

// --- Messages -----------------------------------------------------------------------------------------------------
const A = lire('apprentissage.json', {});
const ABONNES = A.abonnes?.at(-1)?.n;
const PORTEES = (A.posts || []).map((x) => x.metrics?.reach).filter(Number.isFinite).sort((a, b) => a - b);
const MEDIANE = PORTEES.length >= 10 ? Math.round(PORTEES[Math.floor(PORTEES.length / 2)] / 100) * 100 : null;
const nf = (n) => new Intl.NumberFormat('fr-FR').format(n);
// Nombre réel de soirées à venir recensées (fait vérifiable, jamais une audience inventée).
const SOIREES = (() => { const e = lire('evenements-web.json', []); const l = Array.isArray(e) ? e : Object.values(e).find(Array.isArray) || []; return l.filter((x) => Date.parse(x.start) > Date.now()).length; })();
const T = config.site?.tarifs?.formules || [];
const prix = (k) => T.find((f) => f.cle === k)?.prix;
const SIGNATURE = `Junior Joyant\nDirecteur de Teufy · teufyparty.com · Instagram @teufy_official\nTeufy, société de droit monégasque.\n\nVous ne souhaitez plus recevoir de message de Teufy ? Répondez simplement « STOP ».`;
export function message(p, etape = 0) {
  const fam = p.famille || FAMILLE(p.categorie);
  const chiffres = [ABONNES && `${nf(Math.round(ABONNES / 100) * 100)} abonnés sur Instagram`, MEDIANE && `environ ${nf(MEDIANE)} personnes touchées par post`].filter(Boolean).join(', ');
  const ou = p.ville ? ` à ${p.ville}` : ' sur la Côte d\'Azur';
  if (etape === 1) return { sujet: `Re : ${p.nom} x Teufy`, texte: `Bonjour,\n\nJe me permets de revenir vers vous : est-ce qu'un avantage pour les lecteurs de Teufy chez ${p.nom} vous intéresserait (par exemple ${IDEES[fam]}) ? C'est gratuit, on le met en avant sur le site et en story.\n\nIl suffit de répondre à ce mail avec l'offre, ou de remplir le formulaire en 1 minute : https://teufyparty.com/partenaires/#avantage\n\nSi vous nous avez déjà répondu, ne tenez pas compte de ce message.\n\n${SIGNATURE}` };
  if (etape === 2) return { sujet: `Dernier message : ${p.nom} sur Teufy`, texte: `Bonjour,\n\nDernier petit message de ma part : la page Avantages de Teufy se remplit ce mois-ci, et j'aurais aimé y voir ${p.nom}. Si ce n'est pas le bon moment, aucun souci, je ne vous relancerai plus.\n\nLe formulaire, au cas où : https://teufyparty.com/partenaires/#avantage\n\n${SIGNATURE}` };
  const intro = p.ancien
    ? `Vous faisiez partie des partenaires de Teufy : merci encore. Teufy revient plus fort que jamais, avec un nouveau site (teufyparty.com, en 6 langues) et un compte Instagram qui publie chaque jour.`
    : `Je dirige Teufy, le guide des soirées de la Côte d'Azur et du Var : un site (teufyparty.com, en 6 langues) et un compte Instagram suivi par les 17-30 ans qui sortent${ou}.`;
  const pourquoi = {
    nuit: `Teufy recense chaque jour toutes les soirées de la Côte${SOIREES ? ` (${SOIREES} à venir en ce moment)` : ''}, vérifiées sur leur billetterie, pour ceux qui se demandent où sortir ce soir${ou}.${p.soirees ? ` ${p.nom} y a déjà ${p.soirees} soirée(s) à venir.` : ''} Notre objectif : remplir vos soirées.`,
    activite: `Avant et après la soirée, nos lecteurs cherchent quoi faire entre potes${ou} : ${p.nom} a toute sa place dans notre rubrique Activités.`,
    boutique: `Nos lecteurs préparent leurs soirées (Halloween, Nouvel an, soirées à thème…) : ${p.nom} peut devenir leur adresse pour le look et la déco.`,
    manger: `En fin de soirée, nos lecteurs cherchent où manger${ou} : nous lançons une rubrique « Manger après la soirée » et ${p.nom} y serait bien placé.`,
  }[fam];
  const texte = `Bonjour,

${intro}

${pourquoi}

Ce que je vous propose :
• Gratuit : ${fam === 'nuit' ? 'vos soirées dans notre agenda (site en 6 langues, page de votre ville et de votre style)' : 'votre établissement dans la rubrique adaptée du site'}.
• Un avantage Teufy, gratuit lui aussi : par exemple ${IDEES[fam]}. On le met en avant sur notre page Avantages et dans nos stories : c'est ce qui donne envie de venir chez vous plutôt qu'ailleurs.
• Pour aller plus loin, nos formules : Visibilité à ${prix('visibilite') ?? 20} € HT/mois (stories dédiées avec votre lien, badge Partenaire, votre logo sur le site, votre avantage mis en avant) ou Premium à ${prix('premium') ?? 50} € HT/mois (un post ou reel en collaboration avec votre compte, 4 stories, un bilan chiffré chaque mois). Sans engagement.${chiffres ? `\n\nAujourd'hui : ${chiffres}. Plus Teufy grandit, plus il peut vous amener de clients : nous réinvestissons les abonnements en publicité pour faire connaître Teufy, et vos offres, dans toute la région.` : ''}

Pour répondre, deux options :
→ répondez simplement à ce mail avec votre avantage ;
→ ou remplissez le formulaire en 1 minute : https://teufyparty.com/partenaires/#avantage

Les formules et les prix : https://teufyparty.com/partenaires/#tarifs

${SIGNATURE}`;
  return { sujet: p.ancien ? `${p.nom} : Teufy revient, on vous garde une place ?` : `${p.nom} x Teufy : un avantage pour nos lecteurs${ou} ?`, texte };
}
export const messageInstagram = (p) => `Hello ${p.nom} ! Ici Teufy (@teufy_official), le guide des soirées de la Côte d'Azur. ${p.ancien ? 'Teufy revient plus fort que jamais et on aimerait vous garder parmi nos partenaires.' : 'On aimerait vous mettre en avant.'} Ça vous dirait de proposer un avantage à nos lecteurs (ex. ${IDEES[p.famille || FAMILLE(p.categorie)]}) ? C'est gratuit, on le met en avant sur le site et en story. Le formulaire prend 1 minute : teufyparty.com/partenaires/#avantage 🙌`;

// --- Envoi (Brevo) -------------------------------------------------------------------------------------------
async function brevo(chemin, corps, methode = 'POST') {
  const r = await fetch(`https://api.brevo.com/v3/${chemin}`, { method: methode, headers: { 'api-key': BREVO, 'content-type': 'application/json', accept: 'application/json' }, body: corps ? JSON.stringify(corps) : undefined, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Brevo ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? {} : r.json();
}
const html = (t) => `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#111">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/(https:\/\/[^\s]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>')}</div>`;
async function envoyer(p, m) {
  const exp = P.expediteur || config.site?.email;
  return brevo('smtp/email', { sender: { name: 'Junior · Teufy', email: exp }, to: [{ email: p.email, name: p.nom }], replyTo: { email: config.site?.email || exp, name: 'Teufy' },
    subject: m.sujet, textContent: m.texte, htmlContent: html(m.texte), headers: { 'List-Unsubscribe': `<mailto:${config.site?.email || exp}?subject=STOP>` }, tags: ['prospection'] });
}
const ouvre = () => { const d = now.getUTCDay(); return d >= 1 && d <= 5; };

// --- Passage quotidien -------------------------------------------------------------------------------------------
export async function passer() {
  if (!CLE && !DRY) { log('Prospection : secret PROSPECTION_CLE absent, rien n\'est fait (le suivi doit rester chiffré).'); return; }
  const etat = CLE && existsSync(FICHIER) ? charger() : { prospects: {}, journal: [] };
  // 1. Base : lieux connus + recherche de nouveaux lieux (catégories × zones).
  for (const p of prospectsConnus()) if (!etat.prospects[p.id]) etat.prospects[p.id] = { ...p, famille: FAMILLE(p.categorie), statut: 'a_contacter', ajout: jour };
  const nouveaux = DRY ? 0 : await decouvrir(etat, P.recherches_par_jour);
  // 2. Contacts publiés (site officiel), 30 lieux par passage.
  let trouves = 0;
  for (const p of Object.values(etat.prospects).filter((x) => x.site && !x.email && !x.email_cherche).slice(0, DRY ? 5 : 30)) {
    const c = await contactSite(p); p.email_cherche = jour;
    if (c) { p.email = c.email; p.email_source = c.source; trouves++; }
  }
  // 3. Adresses bloquées (désinscriptions, rebonds) : jamais recontactées.
  const bloques = new Set();
  if (BREVO && !DRY) { try { const b = await brevo('smtp/blockedContacts?limit=100', null, 'GET'); for (const c of b.contacts || []) bloques.add(String(c.email).toLowerCase()); } catch (e) { log(`Prospection : liste de blocage illisible (${e.message.slice(0, 80)})`); } }
  for (const p of Object.values(etat.prospects)) if (p.email && bloques.has(p.email)) p.statut = 'stop';
  // 4. Envois : relances dues d'abord, puis nouveaux contacts (anciens partenaires en premier).
  const jours = (d) => (now - Date.parse(d)) / 864e5;
  const dues = Object.values(etat.prospects).filter((p) => p.email && ['contacte', 'relance1'].includes(p.statut) && jours(p.dernier) >= (p.statut === 'contacte' ? P.relances_jours[0] : P.relances_jours[1] - P.relances_jours[0]));
  const neufs = Object.values(etat.prospects).filter((p) => p.email && p.statut === 'a_contacter').sort((a, b) => (b.ancien - a.ancien) || ((b.soirees || 0) - (a.soirees || 0)));
  const lot = [...dues, ...neufs].slice(0, P.nouveaux_par_jour);
  let envoyes = 0;
  const peutEnvoyer = P.actif && BREVO && !DRY && ouvre();
  for (const p of lot) {
    const etape = p.statut === 'contacte' ? 1 : p.statut === 'relance1' ? 2 : 0;
    const m = message(p, etape);
    if (!peutEnvoyer) { if (DRY && envoyes < 2) log(`\n--- ${m.sujet}\n${m.texte}\n`); envoyes++; continue; }
    try { await envoyer(p, m); p.statut = ['contacte', 'relance1', 'relance2'][etape]; p.dernier = now.toISOString(); envoyes++; } catch (e) { log(`Prospection : envoi refusé (${e.message.slice(0, 120)})`); if (/40[13]/.test(e.message)) break; }
  }
  for (const p of Object.values(etat.prospects)) if (p.statut === 'relance2' && jours(p.dernier) > 14) p.statut = 'sans_reponse';
  // 5. Rapport (sans adresse dans les journaux publics) + e-mail récapitulatif au directeur.
  const s = Object.values(etat.prospects).reduce((m, p) => ((m[p.statut] = (m[p.statut] || 0) + 1), m), {});
  const avecEmail = Object.values(etat.prospects).filter((p) => p.email).length;
  const resume = `Prospection ${jour} : ${Object.keys(etat.prospects).length} prospects (${avecEmail} avec e-mail publié), ${nouveaux} nouveaux lieux, ${trouves} contacts trouvés, ${peutEnvoyer ? envoyes : 0} e-mails envoyés${peutEnvoyer ? '' : ` (envoi inactif${!P.actif ? ' : prospection.actif = false' : !BREVO ? ' : secret BREVO_API_KEY absent' : DRY ? ' : essai' : ' : week-end'})`}. Statuts : ${JSON.stringify(s)}`;
  log(resume);
  etat.journal = [...(etat.journal || []), { jour, resume }].slice(-120);
  if (peutEnvoyer && config.site?.email) {
    const sansMail = Object.values(etat.prospects).filter((p) => !p.email && p.instagram && p.statut === 'a_contacter' && !p.dm).slice(0, 15);
    const corps = `${resume}\n\nÀ envoyer à la main sur Instagram aujourd'hui (pas d'e-mail publié) : ouvre le lien, colle le message.\n\n${sansMail.map((p) => `• ${p.nom}${p.ville ? ` (${p.ville})` : ''} → https://ig.me/m/${p.instagram}\n${messageInstagram(p)}\n`).join('\n')}`;
    try { await brevo('smtp/email', { sender: { name: 'Robot Teufy', email: P.expediteur || config.site.email }, to: [{ email: config.site.email }], subject: `Prospection Teufy du ${jour}`, textContent: corps }); sansMail.forEach((p) => { p.dm = jour; }); } catch (e) { log(`Prospection : rapport non envoyé (${e.message.slice(0, 80)})`); }
  }
  if (CLE) await sauver(etat);
  return { etat, resume };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await passer();
