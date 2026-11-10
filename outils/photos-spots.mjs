// Photos des « spots pour un date » : la photo principale de l'article Wikipédia de chaque lieu, uniquement sous
// licence libre (CC0, CC BY, CC BY-SA, domaine public), avec auteur et licence enregistrés pour les créditer.
// Usage : node outils/photos-spots.mjs   → site/img/spots/*.jpg + contenus/spots-photos.json (à committer)
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPOTS_DATE } from '../src/site-contenus.mjs';
import { VILLES_OCCITANIE, VILLES_FRANCE } from '../src/recherche.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = path.join(ROOT, 'site', 'img', 'spots');
const CACHE = path.join(ROOT, 'contenus', 'spots-photos.json');
const UA = { 'User-Agent': 'TeufySite/1.0 (https://teufyparty.com; teufy.app@gmail.com) photos-spots' };
const pause = (ms) => new Promise((r) => setTimeout(r, ms)); // Wikimedia : requêtes espacées
const LIBRE = /^(cc0|cc[ -]by(-sa)?[ -]?[\d.]*|public domain|domaine public|pd)/i;
const slug = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const texte = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
// curl (passe par le proxy de l'environnement et respecte l'identification demandée par Wikimedia).
const curl = (u, sortie) => spawnSync('curl', ['-sS', '-L', '-m', '40', '-A', UA['User-Agent'], ...(sortie ? ['-o', sortie] : []), u], { encoding: sortie ? 'buffer' : 'utf8', maxBuffer: 50e6 });
const json = async (u) => { await pause(1500); const t = String(curl(u).stdout || ''); try { return JSON.parse(t); } catch { throw new Error(t.slice(0, 60)); } };

// Titres Wikipédia à essayer dans l'ordre quand le nom affiché ne suffit pas (le premier qui a une photo libre gagne).
const TITRES = {
  'Sentier du littoral de Saint-Jean-Cap-Ferrat': ['Saint-Jean-Cap-Ferrat'], "Sentier de Tire-Poil, Cap d'Antibes": ["Cap d'Antibes"],
  'Rade de Villefranche-sur-Mer': ['Rade de Villefranche', 'Villefranche-sur-Mer'], 'Jardins de la Villa Ephrussi de Rothschild': ['Villa Ephrussi de Rothschild'],
  'Musée Picasso, château Grimaldi': ['Musée Picasso (Antibes)', 'Château Grimaldi (Antibes)'],
  'Île Sainte-Marguerite, îles de Lérins': ['Île Sainte-Marguerite', 'Îles de Lérins', "Fort royal de l'île Sainte-Marguerite"],
  "Village d'Èze": ['Èze'], 'MAMAC': ["Musée d'Art moderne et d'Art contemporain de Nice", "Musée d'art moderne et d'art contemporain (Nice)", "Musée d'Art moderne et d'Art contemporain"],
  'Musée océanographique': ['Musée océanographique de Monaco'], 'Musée Matisse': ['Musée Matisse (Nice)', 'Musée Matisse'],
  'Colline du Château': ['Colline du Château (Nice)', 'Colline du Château', 'Château de Nice'], 'Le Suquet': ['Le Suquet'], 'Mont Faron': ['Mont Faron'],
};
// Dernier recours : recherche de fichiers sur Wikimedia Commons (« nom ville »), mêmes règles de licence et de taille.
async function chercherCommons(q) {
  const c = await json(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=8&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=1200`);
  const l = Object.values(c.query?.pages || {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map((p) => p.imageinfo?.[0]).filter(Boolean);
  return l.find((i) => /jpe?g/i.test(i.mime || '') && (i.width || 0) >= 800 && (i.width || 0) >= (i.height || 0) && LIBRE.test(texte(i.extmetadata?.LicenseShortName?.value))) || null;
}
async function infoWikipedia(titre) {
  const w = await json(`https://fr.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=name&titles=${encodeURIComponent(titre)}`);
  const fichierWiki = Object.values(w.query?.pages || {})[0]?.pageimage;
  if (!fichierWiki) return null;
  const c = await json(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1200&titles=${encodeURIComponent(`File:${fichierWiki}`)}`);
  const i = Object.values(c.query?.pages || {})[0]?.imageinfo?.[0];
  return i && (i.width || 0) >= 800 && LIBRE.test(texte(i.extmetadata?.LicenseShortName?.value)) ? i : null;
}

// Téléchargement + versions WebP, avec auteur et licence pour le crédit.
async function enregistrer(info, f) {
  const m = info.extmetadata || {};
  await pause(1500);
  if (curl(info.thumburl || info.url, `${f}.src`).status !== 0 || !existsSync(`${f}.src`)) return null;
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', `${f}.src`, '-vf', "scale='min(1200,iw)':-2", '-q:v', '3', f]);
  spawnSync('rm', ['-f', `${f}.src`]);
  if (!existsSync(f)) return null;
  for (const l of [480, 800]) spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-vf', `scale='min(${l},iw)':-2`, '-c:v', 'libwebp', '-quality', '78', f.replace(/\.jpg$/, `-${l}.webp`)]);
  return { fichier: path.relative(ROOT, f), auteur: texte(m.Artist?.value).slice(0, 80) || 'Auteur inconnu', licence: texte(m.LicenseShortName?.value), licence_url: texte(m.LicenseUrl?.value), source: info.descriptionurl };
}
const VILLES_PHOTOS = ['Nice', 'Cannes', 'Monaco', 'Antibes', 'Juan-les-Pins', 'Menton', 'Cagnes-sur-Mer', 'Saint-Laurent-du-Var', 'Villefranche-sur-Mer', 'Grasse', 'Vallauris',
  'Mandelieu-la-Napoule', 'Saint-Tropez', 'Fréjus', 'Saint-Raphaël (Var)', 'Sainte-Maxime', 'Toulon', 'Hyères', 'La Seyne-sur-Mer', 'Puget-sur-Argens', 'Roquebrune-sur-Argens', 'Draguignan',
  ...VILLES_OCCITANIE, ...VILLES_FRANCE];
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
await mkdir(DOSSIER, { recursive: true });
for (const g of SPOTS_DATE) for (const [nom, ville] of g.lieux) {
  if (cache[nom]?.fichier && existsSync(path.join(ROOT, cache[nom].fichier))) continue;
  try {
    let info = null;
    for (const titre of [...(TITRES[nom] || []), nom]) { info = await infoWikipedia(titre).catch(() => null); if (info) break; }
    if (!info) info = await chercherCommons(`${nom} ${ville || ''}`.trim()).catch(() => null);
    if (!info) { console.log(`✗ ${nom} : aucune photo libre trouvée (Wikipédia et Commons)`); continue; }
    const r = await enregistrer(info, path.join(DOSSIER, `${slug(nom)}.jpg`));
    if (!r) { console.log(`✗ ${nom} : téléchargement impossible`); continue; }
    cache[nom] = r;
    console.log(`✓ ${nom} : ${r.licence} · ${r.auteur}`);
  } catch (err) { console.log(`✗ ${nom} : ${err.message}`); }
}
await writeFile(CACHE, JSON.stringify(cache, null, 1) + '\n');

// Photos des villes : dernier recours pour une soirée sans affiche, sans logo du lieu ni de l'organisateur
// (une vraie photo de la ville où elle a lieu, sous licence libre et créditée). → contenus/villes-photos.json
const CACHE_V = path.join(ROOT, 'contenus', 'villes-photos.json'), DOSSIER_V = path.join(ROOT, 'site', 'img', 'villes');
const cacheV = existsSync(CACHE_V) ? JSON.parse(readFileSync(CACHE_V, 'utf8')) : {};
await mkdir(DOSSIER_V, { recursive: true });
for (const v of VILLES_PHOTOS) {
  if (cacheV[v]?.fichier && existsSync(path.join(ROOT, cacheV[v].fichier))) continue;
  try {
    let info = await infoWikipedia(v).catch(() => null);
    if (!info) info = await chercherCommons(`${v} vue`).catch(() => null);
    if (!info) { console.log(`✗ ville ${v} : aucune photo libre`); continue; }
    const r = await enregistrer(info, path.join(DOSSIER_V, `${slug(v)}.jpg`));
    if (r) { cacheV[v] = r; console.log(`✓ ville ${v} : ${r.licence} · ${r.auteur}`); }
  } catch (err) { console.log(`✗ ville ${v} : ${err.message}`); }
}
await writeFile(CACHE_V, JSON.stringify(cacheV, null, 1) + '\n');
