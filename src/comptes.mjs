// Vérification des comptes Instagram avant chaque publication (identifications sur les images, invitations
// en collaboration, @mentions de la légende). L'IA propose parfois un identifiant qui « ressemble » au bon
// (@jedistechno au lieu du vrai compte, deux versions du même lieu…) : on ne garde que les comptes dont
// l'existence est confirmée.
//   - confirmé : compte suivi par @teufy_official (liste des partenaires, relevée à la main), ou compte
//     professionnel trouvé par l'API Instagram (Business Discovery) ;
//   - sinon (introuvable, ou compte personnel que l'API ne peut pas vérifier) : retiré.
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
    if (c && ((c.ok && age < 30 * 864e5) || (!c.ok && age < 7 * 864e5))) { if (c.ok) ok.add(h); continue; }
    if (!ig || !businessDiscovery) continue; // impossible de vérifier : on ne prend pas le risque
    try {
      const bd = await businessDiscovery(h, ig);
      if (bd?.username && propre(bd.username) === h) { ok.add(h); cache[h] = { ok: true, nom: bd.name || '', le: new Date(now).toISOString() }; modifie = true; }
    } catch (err) {
      // Compte inexistant ou personnel : l'API répond « utilisateur invalide ». Autre erreur (réseau, quota) : pas mis en cache.
      if (/invalid user|cannot be found|does not exist|110|2207013/i.test(err.message)) { cache[h] = { ok: false, le: new Date(now).toISOString() }; modifie = true; }
      else log(`Comptes : vérification de @${h} impossible (${err.message})`);
    }
  }
  if (modifie) await writeFile(CACHE, JSON.stringify(cache, null, 1) + '\n');
  return ok;
}

/** Retire d'une publication tous les comptes non confirmés (identifications, collaborations, @mentions). */
export async function nettoyerComptes(p, opts = {}) {
  const mentions = [...String(p.legende || '').matchAll(RE_MENTION)].map((m) => m[2]);
  const tous = [...(p.tags || []).flat(), ...(p.collabs || []), ...mentions].map(propre).filter((h) => h && h !== 'teufy_official');
  const ok = await verifierComptes(tous, opts);
  const retires = [...new Set(tous.filter((h) => !ok.has(h)))];
  if (p.tags) p.tags = p.tags.map((l) => [...new Set((l || []).map(propre).filter((h) => ok.has(h)))]);
  if (p.collabs) p.collabs = [...new Set(p.collabs.map(propre).filter((h) => ok.has(h)))];
  if (p.legende) {
    p.legende = p.legende.replace(RE_MENTION, (m, avant, h) => (propre(h) === 'teufy_official' || ok.has(propre(h)) ? m : avant))
      .replace(/[ \t]+$/gm, '').replace(/(\S) {2,}/g, '$1 ');
  }
  if (retires.length) (opts.log || console.log)(`Comptes non confirmés retirés : ${retires.map((h) => `@${h}`).join(', ')}`);
  return { retires, gardes: [...ok] };
}
