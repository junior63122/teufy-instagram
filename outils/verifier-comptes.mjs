#!/usr/bin/env node
// Vérification des comptes Instagram des lieux, organisateurs et artistes — SANS IA (12/11/2026).
// Le directeur : « Il faut vraiment vérifier les @, tu ne dois pas mettre n'importe quoi ! » (@le109nice n'existait pas,
// le vrai compte du 109 est @le109_officiel ; 37 comptes de lieux sur 81 étaient introuvables).
//
// 1. Chaque compte proposé (soirées des 40 prochains jours, lieux) est lu par l'API officielle d'Instagram
//    (Business Discovery, gratuite) : il doit EXISTER et CORRESPONDRE (pseudo, nom ou bio qui reprend le lieu,
//    l'organisateur, la soirée ou l'artiste).
// 2. Lieu sans compte confirmé : le robot cherche le vrai compte — liens Instagram du site officiel du lieu, recherche
//    web gratuite (DuckDuckGo), noms officiels courants (« _officiel », « _nice »…) — et chaque candidat est vérifié
//    de la même façon. Rien n'est gardé sans vérification.
// 3. Résultats : contenus/comptes-verifies.json (faits lus sur Instagram), contenus/comptes-lieux.json (lieu → compte),
//    contenus/comptes-corrections.json (faux pseudo → vrai compte), contenus/lieux-nuit.json (compte du lieu corrigé).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { igConfig, businessDiscovery } from '../src/instagram.mjs';
import { correspond, cleLieu } from '../src/comptes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f, d) => { try { return JSON.parse(readFileSync(path.join(ROOT, f), 'utf8')); } catch { return d; } };
const ecrire = (f, x) => writeFileSync(path.join(ROOT, f), `${JSON.stringify(x, null, 1)}\n`);
const propre = (h) => String(h || '').trim().replace(/^@/, '').replace(/[/?].*$/, '').toLowerCase();
const sansAccent = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const VIDES = /\b(le|la|les|l|de|du|des|the|club|bar|restaurant|hotel|nice|cannes|monaco|antibes|toulon)\b/g;
const MAX = Number(process.env.MAX_COMPTES || 140); // appels API par passage (limite Instagram : 200 / heure)
const ig = igConfig();
if (!ig) { console.log('Pas de secrets Instagram : vérification impossible (rien n\'est confirmé).'); process.exit(0); }

const now = Date.now();
const cache = lire('contenus/comptes-verifies.json', {});
const corr = lire('contenus/comptes-corrections.json', { comptes: {} }); corr.comptes ||= {};
const lieuxComptes = lire('contenus/comptes-lieux.json', {});
const LN = lire('contenus/lieux-nuit.json', { lieux: [], insta: {} });
const soirees = [...(lire('evenements-web.json', {}).evenements || []), ...lire('evenements-manuels.json', [])]
  .filter((e) => e.start && Date.parse(e.start) > now - 6 * 3600e3 && Date.parse(e.start) < now + 40 * 864e5);

let appels = 0, limite = false;
async function lireCompte(h) {
  h = propre(h);
  if (!/^[a-z0-9._]{2,30}$/.test(h)) return null;
  const c = cache[h];
  const age = c ? now - Date.parse(c.le) : Infinity;
  if (c && ((c.ok && c.bio != null && age < 30 * 864e5) || (!c.ok && age < 7 * 864e5))) return c;
  if (limite || appels >= MAX) return c || null;
  appels++;
  try {
    const bd = await businessDiscovery(h, ig);
    cache[h] = bd?.username ? { ok: true, nom: bd.name || '', bio: String(bd.biography || '').slice(0, 300), site: bd.website || '', abonnes: bd.followers_count ?? null, le: new Date().toISOString() } : { ok: false, le: new Date().toISOString() };
  } catch (err) {
    if (/rate|limit|\(#4\)|\(#32\)|\(#17\)/i.test(err.message)) { limite = true; console.log(`Limite Instagram atteinte après ${appels} lecture(s).`); return c || null; }
    // Compte inexistant, ou compte personnel (illisible par l'API, donc invérifiable) : jamais utilisé.
    cache[h] = { ok: false, le: new Date().toISOString() };
  }
  return cache[h];
}
const confirme = async (h, textes) => { const c = await lireCompte(h); return !!(c?.ok && correspond(h, c, textes)); };
// Un LIEU doit en plus être localisé : sa ville, la Côte d'Azur ou le Var dans son pseudo, son nom, sa bio ou son site
// (sinon « Honey Club » → @honey, une marque mondiale).
const LOCAL = /(nice|cannes|antibes|juan|monaco|monte.?carlo|menton|cagnes|grasse|frejus|saint.?raphael|st.?raphael|toulon|hyeres|bandol|sanary|mandelieu|villefranche|beaulieu|vence|sophia|valbonne|cote.?d.?azur|riviera|french.?riviera|alpes.?maritimes|var\b|provence|06\d{3}|83\d{3}|\b06\b|\b83\b|98000|\.fr\b|\.mc\b)/;
const local = (h, c, ville) => { const t = sansAccent(`${h} ${c?.nom} ${c?.bio} ${c?.site}`); const v = sansAccent(ville || '').replace(/[^a-z]/g, ''); return LOCAL.test(t) || (v.length >= 4 && t.replace(/[^a-z]/g, '').includes(v)); };
const confirmeLieu = async (h, l) => { const c = await lireCompte(h); return !!(c?.ok && correspond(h, c, [l.nom]) && local(h, c, l.ville)); };

// --- Candidats pour un lieu sans compte confirmé (gratuit, sans IA) -----------------------------------------------
async function page(url) {
  try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TeufyBot/1.0; +https://teufyparty.com)', 'Accept-Language': 'fr' }, signal: AbortSignal.timeout(15000) }); return r.ok ? (await r.text()).slice(0, 400000) : ''; } catch { return ''; }
}
const liensInsta = (html) => [...String(html).matchAll(/instagram\.com\/([A-Za-z0-9._]{2,30})(?=[/"'?\s<&]|$)/g)].map((m) => propre(m[1])).filter((h) => !/^(p|reel|reels|explore|accounts|stories|tv|about|developer|legal|direct)$/.test(h));
async function candidats(nom, ville, site) {
  const out = [];
  if (/^https?:\/\//.test(site || '')) out.push(...liensInsta(await page(site)));
  // Recherche web gratuite (sans clé) ; si le moteur refuse les robots, on n'insiste pas.
  const q = encodeURIComponent(`${nom} ${ville || ''} instagram`);
  out.push(...liensInsta(decodeURIComponent(await page(`https://html.duckduckgo.com/html/?q=${q}`))));
  // Noms officiels courants, construits à partir du nom du lieu (chacun vérifié par l'API et par correspondance).
  const base = sansAccent(nom).replace(/\([^)]*\)/g, ' ').replace(VIDES, ' ').replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const avecLe = sansAccent(nom).replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const v = sansAccent(ville || '').replace(/[^a-z]/g, '');
  for (const mots of [base, avecLe]) {
    if (!mots.length || mots.join('').length < 3) continue;
    const j = mots.join(''), s = mots.join('_'), p = mots.join('.');
    out.push(j, s, p, `${j}_officiel`, `${j}officiel`, `${s}_officiel`, `${j}_official`, `${j}${v}`, `${j}_${v}`, `${s}_${v}`, `${j}.${v}`);
  }
  return [...new Set(out.map(propre))].filter((h) => /^[a-z0-9._]{3,30}$/.test(h));
}

// --- 0. D'abord les comptes des soirées des 10 prochains jours (ce qui sera publié en premier) -----------------------
let ok = 0, ko = 0;
async function comptesSoirees(liste) {
  for (const e of liste) {
    const textes = [e.venue, e.name, e.organisateur, ...(e.artistes || [])].filter(Boolean);
    for (const brut of e.instagram || []) {
      if (limite || appels >= MAX) return;
      const h = propre(corr.comptes[propre(brut)] || brut);
      if (await confirme(h, textes)) ok++; else ko++;
    }
  }
}
const proches = soirees.filter((e) => Date.parse(e.start) < now + 10 * 864e5).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
await comptesSoirees(proches);

// --- 1. Lieux : compte confirmé, sinon recherche du vrai compte ---------------------------------------------------
const lieux = new Map();
for (const l of LN.lieux || []) lieux.set(cleLieu(l.nom), { nom: l.nom, ville: l.ville, site: l.site, propose: [l.instagram, l.instagram_non_verifie].filter(Boolean), ref: l });
for (const e of soirees) { const k = cleLieu(e.venue); if (!k) continue; const x = lieux.get(k) || { nom: e.venue, ville: e.city, propose: [] }; x.propose.push(...(e.instagram || [])); x.aVenir = true; lieux.set(k, x); }
const ordre = [...lieux.entries()].sort(([, a], [, b]) => (b.aVenir ? 1 : 0) - (a.aVenir ? 1 : 0));
let trouves = 0, corriges = 0;
for (const [k, l] of ordre) {
  if (limite || appels >= MAX) break;
  const textes = [l.nom];
  const deja = lieuxComptes[k];
  if (deja && await confirmeLieu(deja, l)) { if (l.ref) l.ref.instagram = deja; continue; }
  if (deja) delete lieuxComptes[k]; // compte qui ne passe plus le contrôle (ex. @honey) : retiré
  let vrai = null;
  for (const h of [...new Set(l.propose.map((x) => propre(corr.comptes[propre(x)] || x)))]) if (await confirmeLieu(h, l)) { vrai = h; break; }
  if (!vrai && l.aVenir) for (const h of await candidats(l.nom, l.ville, l.site)) { if (limite || appels >= MAX) break; if (await confirmeLieu(h, l)) { vrai = h; break; } }
  if (!vrai) continue;
  lieuxComptes[k] = vrai; trouves++;
  // Seuls les pseudos qui désignaient CE lieu (ex. @le109nice pour « Le 109 ») sont corrigés, jamais ceux d'un organisateur.
  for (const faux of l.propose.map(propre)) if (faux !== vrai && !cache[faux]?.ok && correspond(faux, { nom: '' }, [l.nom])) { corr.comptes[faux] = vrai; corriges++; }
  if (l.ref && l.ref.instagram !== vrai) { console.log(`Lieu « ${l.nom} » : @${l.ref.instagram || '—'} → @${vrai}`); l.ref.instagram = vrai; }
}
// Lieux dont aucun compte n'a pu être confirmé : plus de pseudo deviné sur le site.
for (const l of LN.lieux || []) if (l.instagram && cache[propre(l.instagram)] && !(cache[propre(l.instagram)]?.ok && correspond(l.instagram, cache[propre(l.instagram)], [l.nom]) && local(l.instagram, cache[propre(l.instagram)], l.ville))) { l.instagram_non_verifie = l.instagram; delete l.instagram; }

// --- 2. Comptes des autres soirées (organisateurs, artistes) --------------------------------------------------
await comptesSoirees(soirees.filter((e) => !proches.includes(e)));

ecrire('contenus/comptes-verifies.json', cache);
ecrire('contenus/comptes-lieux.json', lieuxComptes);
ecrire('contenus/comptes-corrections.json', corr);
ecrire('contenus/lieux-nuit.json', LN);
console.log(`Comptes : ${appels} lecture(s) Instagram, ${trouves} lieu(x) avec compte confirmé, ${corriges} pseudo(s) corrigé(s), comptes des soirées : ${ok} confirmé(s), ${ko} rejeté(s) (inexistant, personnel ou ne correspondant pas).`);
