#!/usr/bin/env node
// Paiements Stripe → partenaires Teufy, automatiquement (workflow « Teufy - Paiements », toutes les heures).
//
//  1. Lit les paiements réussis (liens de paiement Teufy) et l'état des abonnements dans Stripe.
//  2. Met à jour contenus/partenaires-payants.json (PUBLIC : nom de l'établissement, Instagram, ville, formule, actif ;
//     jamais d'e-mail ni de montant). Le site s'en sert : badge « Partenaire », logo dans la vitrine, mise en avant.
//     Abonnement résilié ou impayé → le partenaire redevient gratuit tout seul.
//  3. Nouveau paiement → e-mail de bienvenue au client (prochaines étapes selon la formule) + e-mail à l'équipe
//     (ce qu'il faut produire : stories, post, collab). Résiliation → e-mail à l'équipe.
//  Les factures et reçus sont envoyés par Stripe lui-même (réglages Stripe : e-mails clients).
// Secrets : STRIPE_API_KEY (clé restreinte, lecture suffit), BREVO_API_KEY (e-mails).
import { readFileSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f, d) => { try { return JSON.parse(readFileSync(path.join(ROOT, f), 'utf8')); } catch { return d; } };
const config = lire('config.json', {});
const STRIPE = (process.env.STRIPE_API_KEY || '').trim();
const BREVO = (process.env.BREVO_API_KEY || '').trim();
const DRY = process.argv.includes('--dry-run');
const FICHIER = path.join(ROOT, 'contenus', 'partenaires-payants.json');
const EQUIPE = config.site?.email;
const EXPEDITEUR = config.prospection?.expediteur || EQUIPE;
const NOMS = { visibilite: 'Visibilité', premium: 'Premium', post: 'Post dédié', story: 'Story dédiée' };

async function stripe(chemin) {
  const r = await fetch(`https://api.stripe.com/v1/${chemin}`, { headers: { authorization: `Bearer ${STRIPE}` }, signal: AbortSignal.timeout(20000) });
  const j = await r.json(); if (!r.ok) throw new Error(`Stripe ${r.status} ${j.error?.message || ''}`); return j;
}
async function tout(chemin) { const out = []; let apres = ''; for (let i = 0; i < 20; i++) { const j = await stripe(`${chemin}${chemin.includes('?') ? '&' : '?'}limit=100${apres ? `&starting_after=${apres}` : ''}`); out.push(...j.data); if (!j.has_more) break; apres = j.data.at(-1).id; } return out; }
async function mail(a, sujet, texte) {
  if (DRY || !BREVO || !a) { console.log(`[e-mail ${DRY ? 'non envoyé (essai)' : 'impossible'}] ${sujet}`); return; }
  const r = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': BREVO, 'content-type': 'application/json' }, signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ sender: { name: 'Junior · Teufy', email: EXPEDITEUR }, to: [{ email: a }], replyTo: { email: EQUIPE }, subject: sujet, textContent: texte, tags: ['paiement'] }) });
  if (!r.ok) console.log(`E-mail refusé par Brevo (${r.status})`);
}
const champ = (s, k) => (s.custom_fields || []).find((c) => c.key === k)?.text?.value?.trim() || '';
const propre = (ig) => String(ig || '').replace(/^.*instagram\.com\//, '').replace(/[/?].*$/, '').replace(/^@/, '').toLowerCase().replace(/[^a-z0-9._]/g, '');

export function bienvenue(p) {
  const etapes = {
    visibilite: `1. Réponds à ce mail avec ton avantage pour les lecteurs de Teufy (verre offert, code promo, entrée offerte…) : il sera en vedette sur teufyparty.com/avantages et dans notre story à la une.\n2. Envoie-nous tes prochaines dates et tes affiches : on cale tes 2 stories du mois avec ton lien de billetterie.\n3. Ton badge « Partenaire » et ton logo apparaissent sur le site automatiquement dans l'heure.`,
    premium: `1. Réponds à ce mail avec ton avantage pour nos lecteurs : il sera en vedette sur teufyparty.com/avantages et en story à la une.\n2. Envoie-nous tes dates et tes affiches : on prépare ton post ou reel du mois en collaboration (tu recevras une invitation de collaboration sur Instagram, il suffira d'accepter) et tes 4 stories.\n3. Ton badge « Partenaire » et ton logo apparaissent sur le site automatiquement dans l'heure. Ton bilan chiffré arrive à la fin du mois.`,
    post: `Envoie-nous en réponse à ce mail l'affiche, la date de la soirée et le jour où tu veux que le post sorte : on te confirme le créneau sous 24 h.`,
    story: `Envoie-nous en réponse à ce mail l'affiche ou le visuel, ton lien de billetterie et le jour voulu : on te confirme sous 24 h.`,
  }[p.formule] || 'Réponds à ce mail avec tes informations : on revient vers toi sous 24 h.';
  return { sujet: `Bienvenue chez Teufy, ${p.etablissement} ! (${NOMS[p.formule] || p.formule})`, texte: `Bonjour,\n\nMerci pour ta confiance : ta formule ${NOMS[p.formule] || p.formule} est active.\n\nLa suite :\n${etapes}\n\nTa facture t'est envoyée par Stripe. Pour gérer ton abonnement (résiliation, factures, carte) : ${config.site?.tarifs?.portail || 'teufyparty.com/partenaires'}\n\nÀ très vite,\nJunior Joyant\nDirecteur de Teufy · teufyparty.com · @teufy_official` };
}

export async function synchroniser() {
  if (!STRIPE) { console.log('Paiements : secret STRIPE_API_KEY absent, rien à faire.'); return null; }
  const avant = existsSync(FICHIER) ? JSON.parse(readFileSync(FICHIER, 'utf8')) : { partenaires: [], vus: [] };
  const liens = new Map((await tout('payment_links')).filter((l) => l.metadata?.teufy_formule).map((l) => [l.id, l.metadata.teufy_formule]));
  const sessions = (await tout(`checkout/sessions?status=complete&created[gte]=${Math.floor(Date.now() / 1000) - 400 * 864e2}`)).filter((s) => liens.has(s.payment_link) && ['paid', 'no_payment_required'].includes(s.payment_status));
  const abos = new Map((await tout('subscriptions?status=all')).map((a) => [a.id, a]));
  const vus = new Set(avant.vus || []);
  const partenaires = [];
  for (const s of sessions) {
    const id = createHash('sha256').update(s.id).digest('hex').slice(0, 16); // identifiant public sans donnée personnelle
    const formule = liens.get(s.payment_link);
    const abo = s.subscription ? abos.get(s.subscription) : null;
    const actif = abo ? ['active', 'trialing'].includes(abo.status) : (Date.now() / 1000 - s.created) < 31 * 864e2; // achat à l'unité : visible 1 mois
    const p = { id, etablissement: champ(s, 'etablissement') || s.customer_details?.name || 'Partenaire', instagram: propre(champ(s, 'instagram')), ville: champ(s, 'ville'), formule, depuis: new Date(s.created * 1000).toISOString().slice(0, 10), actif, ...(abo?.cancel_at_period_end ? { fin: new Date(abo.current_period_end * 1000).toISOString().slice(0, 10) } : {}) };
    partenaires.push(p);
    if (!vus.has(id)) {
      vus.add(id);
      const m = bienvenue(p);
      await mail(s.customer_details?.email, m.sujet, m.texte);
      await mail(EQUIPE, `💶 Nouveau paiement : ${p.etablissement} · ${NOMS[formule] || formule}`, `${p.etablissement}${p.ville ? ` (${p.ville})` : ''}${p.instagram ? ` · https://instagram.com/${p.instagram}` : ''}\nFormule : ${NOMS[formule] || formule}\nContact client : ${s.customer_details?.email || '?'}\n\nÀ faire : ${formule === 'premium' ? '1 post/reel en collab + 4 stories ce mois-ci, bilan en fin de mois' : formule === 'visibilite' ? '2 stories ce mois-ci, avantage à mettre dans config.site.avantages' : formule === 'post' ? '1 post dédié' : '1 story dédiée'}.\nLe badge et le logo sont mis en ligne automatiquement.`);
    }
    const ancien = (avant.partenaires || []).find((x) => x.id === id);
    if (ancien?.actif && !actif) await mail(EQUIPE, `Fin d'abonnement : ${p.etablissement}`, `${p.etablissement} n'est plus abonné (${NOMS[formule] || formule}). Le badge et le logo ont été retirés du site automatiquement.`);
  }
  const etat = { _explication: 'Généré par src/paiements.mjs depuis Stripe (aucune donnée personnelle ni montant). actif = abonnement en cours, ou achat à l\'unité de moins d\'un mois.', maj: new Date().toISOString(), partenaires, vus: [...vus] };
  const change = JSON.stringify(etat.partenaires) !== JSON.stringify(avant.partenaires || []) || etat.vus.length !== (avant.vus || []).length;
  if (change && !DRY) await writeFile(FICHIER, JSON.stringify(etat, null, 1) + '\n');
  console.log(`Paiements : ${sessions.length} paiement(s) Teufy, ${partenaires.filter((p) => p.actif).length} partenaire(s) actif(s)${change ? ' — mis à jour' : ''}.`);
  return { change, etat };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const r = await synchroniser();
  if (process.env.GITHUB_OUTPUT && r) await writeFile(process.env.GITHUB_OUTPUT, `change=${r.change}\n`, { flag: 'a' });
}
