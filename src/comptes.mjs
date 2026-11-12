// Vérification des comptes Instagram avant chaque publication (identifications sur les images, invitations
// en collaboration, @mentions de la légende). L'IA propose parfois un identifiant qui « ressemble » au bon
// (@jedistechno au lieu du vrai compte, deux versions du même lieu…) : on ne garde que les comptes dont
// l'existence est confirmée.
//   - confirmé : compte suivi par @teufy_official (liste des partenaires, relevée à la main), ou compte
//     professionnel trouvé par l'API Instagram (Business Discovery) ;
//   - identifiant approximatif : remplacé par le vrai compte (voir resoudre) ;
//   - sinon : testé par Instagram au moment de publier (refusé = retiré de l'image et de la légende).
// Résultats gardés dans contenus/comptes-verifies.json (confirmé : revérifié après 30 jours ; introuvable : après 7).
import { readFileSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'contenus', 'comptes-verifies.json');
const lire = (f, d) => { try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d; } catch { return d; } };
const propre = (h) => String(h || '').trim().replace(/^@/, '').toLowerCase();
const RE_MENTION = /(^|[^\w.@])@([A-Za-z0-9._]{2,30})(?![\w])/g;

function suivis() {
  const s = new Set();
  const c = lire(path.join(ROOT, 'contenus', 'partenaires-comptes.json'), []);
  for (const x of Array.isArray(c) ? c : c.comptes || []) if (x.instagram) s.add(propre(x.instagram));
  const o = lire(path.join(ROOT, 'contenus', 'organisateurs.json'), {});
  for (const h of o.partenaires || []) s.add(propre(typeof h === 'string' ? h : h.instagram));
  s.add('teufy_official');
  return s;
}

/** Renvoie l'ensemble des identifiants confirmés parmi `handles`. */
export async function verifierComptes(handles, { ig, businessDiscovery, now = Date.now(), log = console.log } = {}) {
  const cache = lire(CACHE, {});
  const ok = new Set();
  const confiance = suivis();
  let modifie = false;
  for (const h of [...new Set(handles.map(propre).filter(Boolean))]) {
    if (confiance.has(h)) { ok.add(h); continue; }
    const c = cache[h];
    const age = c ? now - Date.parse(c.le) : Infinity;
    if (c && ((c.ok && age < 30 * 864e5 && c.abonnes != null) || (!c.ok && age < 7 * 864e5))) { if (c.ok) ok.add(h); continue; }
    if (c?.ok && (!ig || !businessDiscovery)) { ok.add(h); continue; } // nombre d'abonnés à relever plus tard, compte déjà confirmé
    if (!ig || !businessDiscovery) continue; // impossible de vérifier : on ne prend pas le risque
    try {
      const bd = await businessDiscovery(h, ig);
      if (bd?.username && propre(bd.username) === h) { ok.add(h); cache[h] = { ok: true, nom: bd.name || '', abonnes: bd.followers_count ?? null, le: new Date(now).toISOString() }; modifie = true; }
    } catch (err) {
      // Compte inexistant ou personnel : l'API répond « utilisateur invalide ». Autre erreur (réseau, quota) : pas mis en cache.
      if (/invalid user|cannot be found|does not exist|110|2207013/i.test(err.message)) { cache[h] = { ok: false, le: new Date(now).toISOString() }; modifie = true; }
      else log(`Comptes : vérification de @${h} impossible (${err.message})`);
    }
  }
  if (modifie) await writeFile(CACHE, JSON.stringify(cache, null, 1) + '\n');
  return ok;
}

// --- Retrouver le vrai compte derrière un identifiant approximatif ---------------------------------------------
// Annuaire des comptes sûrs : suivis par @teufy_official, confirmés par l'API (cache), profils de partenaires lus
// par l'API (contenus/partenaires-infos.json). Les comptes cités dans leurs bios (ex. « Before : @lantretechno »)
// sont des candidats, vérifiés avant usage.
const n = (h) => propre(h).replace(/[^a-z0-9]/g, '');
const SUFFIXES = /(nice|cannes|monaco|antibes|toulon|frejus|cotedazur|official|officiel|events?|club|mc|06|83|fr)$/;
const coeur = (h) => { let c = n(h); for (let k = 0; k < 3; k++) { const d = c.replace(SUFFIXES, ''); if (d.length >= 5 && d !== c) c = d; else break; } return c; };
function annuaire() {
  const surs = new Set(suivis()), candidats = new Set();
  for (const [h, c] of Object.entries(lire(CACHE, {}))) if (c.ok) surs.add(h);
  for (const [k, v] of Object.entries(lire(path.join(ROOT, 'contenus', 'partenaires-infos.json'), {}))) {
    if (!k.startsWith('ig:') || !v.profil) continue;
    surs.add(propre(k.slice(3)));
    for (const m of String(v.profil.bio || '').matchAll(/@([A-Za-z0-9._]{2,30})/g)) candidats.add(propre(m[1]));
  }
  return { surs, candidats };
}
export function resoudre(h, { surs, candidats }) {
  const c = coeur(h);
  if (c.length < 5) return null;
  const trouve = (pool) => [...pool].filter((v) => { const nv = n(v), cv = coeur(v); return v !== propre(h) && (nv === n(h) || nv.startsWith(c) || (cv.length >= 5 && c.startsWith(cv))); });
  const a = trouve(surs);
  if (a.length === 1) return { compte: a[0], sur: true };
  if (a.length) return null; // plusieurs possibilités : on ne devine pas
  const b = trouve(candidats);
  return b.length === 1 ? { compte: b[0], sur: false } : null;
}

/**
 * Corrige les comptes d'une publication (identifications, collaborations, @mentions) :
 *   confirmé → gardé ; approximatif → remplacé par le vrai compte ; inconnu → « à tester » (p.a_tester) :
 *   Instagram le teste à la publication (un compte personnel existant est accepté, un compte inexistant refusé),
 *   et il n'apparaît dans la légende que s'il a été accepté.
 */
export async function nettoyerComptes(p, opts = {}) {
  const log = opts.log || console.log;
  const mentions = [...String(p.legende || '').matchAll(RE_MENTION)].map((m) => m[2]);
  const tous = [...new Set([...(p.tags || []).flat(), ...(p.collabs || []), ...mentions].map(propre).filter((h) => h && h !== 'teufy_official'))];
  const ann = annuaire();
  for (const h of await verifierComptes(tous, opts)) ann.surs.add(h); // d'abord les comptes confirmés tels quels
  const remplace = {};
  for (const h of tous) {
    if (ann.surs.has(h)) continue;
    const r = resoudre(h, ann);
    if (r) remplace[h] = r.compte;
  }
  const apres = [...new Set(tous.map((h) => remplace[h] || h))];
  const ok = await verifierComptes(apres, opts);
  const aTester = apres.filter((h) => !ok.has(h));
  const map = (h) => remplace[propre(h)] || propre(h);
  if (p.tags) p.tags = p.tags.map((l) => [...new Set((l || []).map(map))].slice(0, 5));
  if (p.collabs) p.collabs = [...new Set(p.collabs.map(map))].filter((h) => ok.has(h)).slice(0, 3); // invitations : comptes confirmés seulement, les 3 plus suivis (liste déjà triée)
  if (p.legende) p.legende = p.legende.replace(RE_MENTION, (m, avant, h) => (propre(h) === 'teufy_official' ? m : `${avant}@${map(h)}`))
    .replace(/(@[\w.]+)(\s+\1)+(?!\w|\.\w)/g, '$1'); // deux comptes corrigés vers le même : une seule mention
  p.a_tester = aTester;
  if (Object.keys(remplace).length) log(`Comptes corrigés : ${Object.entries(remplace).map(([a, b]) => `@${a} → @${b}`).join(', ')}`);
  if (aTester.length) log(`Comptes à confirmer par Instagram à la publication : ${aTester.map((h) => `@${h}`).join(', ')}`);
  return { remplace, aTester, confirmes: [...ok] };
}

/** Légende finale : retire les @mentions des comptes « à tester » qu'Instagram a refusés. */
export function legendeFinale(legende, aTester = [], acceptes = []) {
  const refuses = new Set(aTester.map(propre).filter((h) => !acceptes.map(propre).includes(h)));
  if (!refuses.size) return legende;
  return legende.replace(RE_MENTION, (m, avant, h) => (refuses.has(propre(h)) ? avant : m)).replace(/[ \t]+$/gm, '').replace(/(\S) {2,}/g, '$1 ');
}

// Audience connue d'un compte Instagram (abonnés), toutes sources gratuites confondues : vérification des comptes,
// fiches des lieux, infos des partenaires. Sert à choisir les soirées et les collaborations au plus fort potentiel.
let AUDIENCE;
export function abonnesDe(handle) {
  if (!AUDIENCE) {
    AUDIENCE = {};
    const lire = (f) => { try { return JSON.parse(readFileSync(path.join(ROOT, 'contenus', f), 'utf8')); } catch { return {}; } };
    for (const [h, x] of Object.entries(lire('lieux-nuit.json').insta || {})) if (x?.abonnes) AUDIENCE[propre(h)] = x.abonnes;
    for (const [k, x] of Object.entries(lire('partenaires-infos.json'))) { const h = propre(k.startsWith('ig:') ? k.slice(3) : x?.fiche?.instagram || ''); if (h && x?.profil?.abonnes) AUDIENCE[h] = Math.max(AUDIENCE[h] || 0, x.profil.abonnes); }
    for (const [h, x] of Object.entries(lire('comptes-verifies.json'))) if (x?.abonnes) AUDIENCE[propre(h)] = Math.max(AUDIENCE[propre(h)] || 0, x.abonnes);
  }
  return AUDIENCE[propre(handle)] || 0;
}
