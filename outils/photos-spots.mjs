// Photos des « spots pour un date » : la photo principale de l'article Wikipédia de chaque lieu, uniquement sous
// licence libre (CC0, CC BY, CC BY-SA, domaine public), avec auteur et licence enregistrés pour les créditer.
// Usage : node outils/photos-spots.mjs   → site/img/spots/*.jpg + contenus/spots-photos.json (à committer)
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPOTS_DATE } from '../src/site-contenus.mjs';

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

// Titres Wikipédia quand le nom affiché ne suffit pas.
const TITRES = {
  'Sentier du littoral de Saint-Jean-Cap-Ferrat': 'Saint-Jean-Cap-Ferrat', "Sentier de Tire-Poil, Cap d'Antibes": "Cap d'Antibes",
  'Rade de Villefranche-sur-Mer': 'Rade de Villefranche', 'Jardins de la Villa Ephrussi de Rothschild': 'Villa Ephrussi de Rothschild',
  'Musée Picasso, château Grimaldi': "Musée Picasso (Antibes)", 'Île Sainte-Marguerite, îles de Lérins': 'Île Sainte-Marguerite',
  "Village d'Èze": 'Èze', 'MAMAC': "Musée d'Art moderne et d'Art contemporain", 'Musée océanographique': 'Musée océanographique de Monaco',
  'Colline du Château': 'Colline du Château (Nice)', 'Le Suquet': 'Le Suquet', 'Mont Faron': 'Mont Faron',
};

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
await mkdir(DOSSIER, { recursive: true });
for (const g of SPOTS_DATE) for (const [nom] of g.lieux) {
  if (cache[nom]?.fichier && existsSync(path.join(ROOT, cache[nom].fichier))) continue;
  const titre = TITRES[nom] || nom;
  try {
    const w = await json(`https://fr.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=name&titles=${encodeURIComponent(titre)}`);
    const page = Object.values(w.query?.pages || {})[0];
    const fichierWiki = page?.pageimage;
    if (!fichierWiki) { console.log(`✗ ${nom} : pas de photo sur Wikipédia (${titre})`); continue; }
    const c = await json(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1200&titles=${encodeURIComponent(`File:${fichierWiki}`)}`);
    const info = Object.values(c.query?.pages || {})[0]?.imageinfo?.[0];
    const m = info?.extmetadata || {};
    const licence = texte(m.LicenseShortName?.value);
    if (!info || !LIBRE.test(licence)) { console.log(`✗ ${nom} : licence non libre (${licence || 'inconnue'})`); continue; }
    if ((info.width || 0) < 800) { console.log(`✗ ${nom} : photo trop petite (${info.width}px)`); continue; }
    const f = path.join(DOSSIER, `${slug(nom)}.jpg`);
    await pause(1500);
    if (curl(info.thumburl || info.url, `${f}.src`).status !== 0 || !existsSync(`${f}.src`)) { console.log(`✗ ${nom} : téléchargement impossible`); continue; }
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', `${f}.src`, '-vf', "scale='min(1200,iw)':-2", '-q:v', '3', f]);
    spawnSync('rm', ['-f', `${f}.src`]);
    for (const l of [480, 800]) spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-vf', `scale='min(${l},iw)':-2`, '-c:v', 'libwebp', '-quality', '78', f.replace(/\.jpg$/, `-${l}.webp`)]);
    cache[nom] = { fichier: path.relative(ROOT, f), auteur: texte(m.Artist?.value).slice(0, 80) || 'Auteur inconnu', licence, licence_url: texte(m.LicenseUrl?.value), source: info.descriptionurl };
    console.log(`✓ ${nom} : ${licence} · ${cache[nom].auteur}`);
  } catch (err) { console.log(`✗ ${nom} : ${err.message}`); }
}
await writeFile(CACHE, JSON.stringify(cache, null, 1) + '\n');
