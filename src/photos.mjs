// Photos d'ambiance (foule, club, scène, feux d'artifice…) pour les fonds des visuels,
// comme sur le compte Teufy. Par ordre de priorité :
//   1. tes photos dans assets/photos/ (sous-dossiers facultatifs : techno/, club/, hiver/,
//      printemps/, ete/, automne/, fetes/) ;
//   2. Pexels (photos libres, gratuites) si le secret PEXELS_API_KEY est défini ;
//   3. à défaut, un fond « faisceaux de lumière de club » teinté de la couleur de saison.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'assets', 'photos');
const IMG = /\.(jpe?g|png|webp)$/i;

// Requêtes Pexels par ambiance ; le sélecteur d'apprentissage choisit celles qui marchent.
export const REQUETES = {
  club: ['nightclub crowd lights', 'club party dancing', 'dj party crowd hands', 'concert crowd confetti', 'disco ball party'],
  techno: ['techno rave crowd', 'rave dark strobe', 'warehouse party dj', 'underground club lights', 'dj booth dark'],
  fetes: ['new year party fireworks', 'christmas party night lights', 'champagne party celebration'],
  ete: ['beach party sunset', 'rooftop party night', 'pool party night', 'summer festival crowd'],
  hiver: ['nightclub red lights', 'party crowd night', 'concert crowd'],
  printemps: ['open air party', 'festival crowd sunset', 'party crowd dancing'],
  automne: ['nightclub purple lights', 'concert crowd stage', 'party crowd night'],
  debat: ['friends party night', 'nightlife friends laughing', 'bar friends night'],
};

// Toutes les photos des dossiers pertinents (le plus précis d'abord, sans doublon).
function local(sousDossiers) {
  const out = [];
  for (const d of sousDossiers) {
    const dir = path.join(DIR, d);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) if (IMG.test(f) && !out.includes(path.join(dir, f))) out.push(path.join(dir, f));
  }
  return out;
}

const asDataUri = (f) => `data:image/${/png$/i.test(f) ? 'png' : /webp$/i.test(f) ? 'webp' : 'jpeg'};base64,${readFileSync(f).toString('base64')}`;

const cache = new Map();
async function pexels(query) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  if (cache.has(query)) return cache.get(query);
  let urls = [];
  try {
    const u = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=40`;
    const res = await fetch(u, { headers: { Authorization: key }, signal: AbortSignal.timeout(20000) });
    if (res.ok) {
      const j = await res.json();
      urls = (j.photos || []).map((p) => `${p.src?.original}?auto=compress&cs=tinysrgb&w=1600`).filter((x) => x.startsWith('http'));
    }
  } catch { /* pas de photos : repli sur les affiches */ }
  cache.set(query, urls);
  return urls;
}

// Renvoie un « fournisseur » de photos distinctes pour un visuel donné.
export async function photoSource({ univers, saison, fetes = false, debat = false, ch, r }) {
  // Dossiers selon le contenu : la techno a ses photos, les fêtes de fin d'année aussi,
  // l'été mélange plages et clubs, les débats mélangent soirées entre amis et clubs.
  const dossiers = univers === 'techno' ? ['techno']
    : fetes ? ['fetes', saison]
      : debat ? ['debat', 'club', saison]
        : ['club', saison, ...(saison === 'ete' ? ['ete'] : [])];
  let pool = local(dossiers).map(asDataUri);
  let requete = null;
  if (pool.length < 4) {
    const cle = debat ? 'debat' : fetes ? 'fetes' : univers === 'techno' ? 'techno' : saison === 'ete' ? 'ete' : 'club';
    const choix = [...REQUETES[cle], ...(cle === 'club' ? REQUETES[saison] || [] : [])];
    requete = ch ? ch.pick('photos', choix) : choix[0];
    pool = [...pool, ...(await pexels(requete))];
  }
  // Mélange déterministe (même date → mêmes photos dans l'aperçu et la publication).
  pool = pool.map((p) => [r(), p]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  let i = 0;
  return {
    requete,
    disponibles: pool.length,
    // Photo suivante ; sans photo, fond « faisceaux de lumière » teinté (dessiné au rendu).
    next() { return pool.length ? { url: pool[i++ % pool.length], photo: true } : { url: '', photo: false }; },
  };
}
