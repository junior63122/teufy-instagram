// Site Teufy : agenda des soirées de la Côte d'Azur, généré chaque jour par le bot (mêmes soirées vérifiées que les posts).
//   node src/run.mjs site        → index.html (racine du dépôt, servi par GitHub Pages) + site/ + en/ it/ es/ zh/ ar/
// - Les soirées sont écrites dans la page (et en données structurées schema.org Event) : Google peut les indexer.
// - 6 langues : français à la racine, les autres dans leur dossier (balises hreflang, sitemap multilingue).
// - Les affiches sont copiées dans site/affiches/ (les liens Instagram expirent) et vérifiées par Gemini
//   (une affiche d'une autre soirée n'est pas montrée). Résultats gardés dans contenus/affiches-verifiees.json.
// - Les lieux sont placés sur la carte grâce à OpenStreetMap (cache contenus/lieux-geo.json).
// - Le JavaScript (site/app.js) gère les filtres, « Ce soir / En ce moment », la carte et les animations.
import { readFileSync, existsSync, readdirSync, rmSync, renameSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { writeFile, mkdir, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { genresList, isTechno } from './genres.mjs';
import { LANGUES, TXT } from './site-langues.mjs';
import { lireHoraires } from './horaires.mjs';
import { STYLES as STYLES_MUSIQUE, PAGES_STYLES, FESTIVALS, RENDEZ_VOUS, PARTENAIRE, AMBASSADEUR, BDE, LEGAL, PAGES_LEGALES, RE_ETUDIANT, RE_FESTIVAL, SORTIES, SPOTS_DATE, FAQ } from './site-contenus.mjs';
import { VILLES_FRANCE, VILLES_OCCITANIE, villeOccitanie, fusionner, PAS_BILLETTERIE } from './recherche.mjs';
const nomDomaine = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
import * as LLM from './llm.mjs';
import { comptesConfirmes } from './comptes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const VERIF = path.join(ROOT, 'contenus', 'affiches-verifiees.json');
const GEO = path.join(ROOT, 'contenus', 'lieux-geo.json');
const TRAD = path.join(ROOT, 'contenus', 'traductions.json');
let URL_SITE = 'https://junior63122.github.io/teufy-instagram/'; // remplacé par https://<domaine>/ quand config.site.domaine est rempli
const h = (s) => createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lire = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
const paris = (d, o, locale = 'fr-FR') => new Intl.DateTimeFormat(locale, { timeZone: 'Europe/Paris', ...o }).format(new Date(d));
const nuit = (d) => new Date(Date.parse(d) - 5 * 3600e3); // une soirée qui commence à 1h appartient à la veille
const cle = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(nuit(d)); // AAAA-MM-JJ
const pre = (l) => (l === 'fr' ? '' : `${l}/`);
const dort = (ms) => new Promise((r) => setTimeout(r, ms));

const VILLES = ['Nice', 'Cannes', 'Monaco', 'Antibes'];
const RE_VAR = /toulon|hy[èe]res|fr[ée]jus|saint.?rapha|saint.?tropez|sainte.?maxime|draguignan|la seyne|six.?fours|sanary|bandol|la ciotat|roquebrune.?sur.?argens|puget.?sur.?argens|cogolin|ramatuelle|le lavandou|brignoles|\bvar\b|\b83\d{3}\b/i;
const styleDe = (e) => {
  const t = [...(e.tags || []), e.name, e.description || ''].join(' ');
  return STYLES_MUSIQUE.filter(({ re }) => re.test(t)).map(({ cle }) => cle).slice(0, 3);
};
const slug = (x) => String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' et ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '');

// Centres des villes : position de secours quand le lieu exact est introuvable (marqué « approximatif » sur la carte).
const CENTRES = [
  [/monaco|monte.?carlo/i, 43.7384, 7.4246], [/beausoleil/i, 43.743, 7.422], [/cap.?d.?ail/i, 43.721, 7.405], [/roquebrune.?cap/i, 43.76, 7.47],
  [/menton/i, 43.7747, 7.4975], [/[èe]ze\b/i, 43.728, 7.362], [/villefranche/i, 43.704, 7.311], [/saint.?laurent.?du.?var/i, 43.673, 7.19],
  [/cagnes/i, 43.6644, 7.1489], [/saint.?paul/i, 43.696, 7.122], [/vence/i, 43.7225, 7.112], [/carros/i, 43.789, 7.188], [/\bnice\b/i, 43.7009, 7.2683],
  [/juan/i, 43.5683, 7.11], [/antibes/i, 43.5808, 7.1251], [/biot/i, 43.628, 7.096], [/valbonne|sophia/i, 43.6163, 7.0553],
  [/golfe.?juan|vallauris/i, 43.578, 7.053], [/le cannet/i, 43.577, 7.019], [/mandelieu|napoule/i, 43.546, 6.938], [/th[ée]oule/i, 43.507, 6.94],
  [/cannes/i, 43.5528, 7.0174], [/grasse/i, 43.658, 6.923], [/auron/i, 44.225, 6.931], [/isola/i, 44.186, 7.05],
  [/saint.?rapha/i, 43.425, 6.768], [/fr[ée]jus/i, 43.433, 6.737], [/puget.?sur.?argens/i, 43.455, 6.685], [/roquebrune.?sur.?argens/i, 43.443, 6.638],
  [/sainte.?maxime/i, 43.309, 6.635], [/saint.?tropez/i, 43.2692, 6.6389], [/draguignan/i, 43.536, 6.464], [/hy[èe]res/i, 43.1204, 6.1286], [/toulon/i, 43.1242, 5.928],
];

// Textes des sources : « 23h59 » (minuit des billetteries) → « minuit », espaces et ponctuation doublés retirés.
// « Glass Club Cannes, Cannes » → « Glass Club Cannes » : la ville n'est ajoutée que si le nom du lieu ne la contient pas.
const lieuEtVille = (s) => [s.lieu, s.ville && !sansAccent(s.lieu || '').toLowerCase().includes(sansAccent(s.ville).toLowerCase().split(/[\s-]/)[0]) ? s.ville : ''].filter(Boolean).join(', ');
const propreTexte = (x) => String(x || '').replace(/\b23[h:]59\b/g, 'minuit').replace(/\s+([,.])/g, '$1').replace(/([,.]){2,}/g, '$1').replace(/\s{2,}/g, ' ').trim();
export const hdShotgun = (u) => String(u || '').replace(/(assets\.shotgun\.live\/image\/upload\/)[^/]*\//, '$1c_limit,w_1920,fl_lossy,f_jpg,q_auto/');
async function telecharger(url, f) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!r?.ok) return false;
  const tmp = `${f}.src`;
  await writeFile(tmp, Buffer.from(await r.arrayBuffer()));
  // 1080 px de large max (net sur les écrans haute définition) ; le WebP 480 sert les téléphones.
  const c = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-vf', "scale='min(1080,iw)':-2", '-q:v', '3', f]);
  spawnSync('rm', ['-f', tmp]);
  return c.status === 0 && existsSync(f);
}

// Version grand format d'une image de billetterie : certaines plateformes servent par défaut une miniature
// (Shotgun : 384 px en qualité 5 % ; Bizouk : 500 px ; Resident Advisor : proxy réduit). Même image, plus grande.
export function versionGrande(url) {
  const u = String(url || '');
  if (/assets\.shotgun\.live\/image\/upload\//.test(u)) return u.replace(/\/image\/upload\/[^/]*\bw_\d+[^/]*\//, '/image/upload/c_limit,w_1080,f_jpg,q_85/');
  if (/thumb\.bizouk\.com\/t\/width=\d+,height=\d+/.test(u)) return u.replace(/width=\d+,height=\d+/, 'width=1080,height=1350');
  const ra = u.match(/^https:\/\/imgproxy\.ra\.co\/_\/[^/]*\/([A-Za-z0-9_=-]+)$/);
  if (ra) { try { const o = Buffer.from(ra[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); if (/^https:\/\/static\.ra\.co\//.test(o)) return o; } catch { /* illisible */ } }
  return u;
}
// Une affiche déjà enregistrée trop petite (< 560 px) est remplacée par la grande version de la même image, si elle existe.
async function agrandirAffiche(url, f) {
  const grand = versionGrande(url);
  if (grand === url || !existsSync(f) || (tailleJpeg(f)?.[0] || 0) >= 560) return false;
  const tmp = f.replace(/\.jpg$/, '.grand.jpg');
  if (!(await telecharger(grand, tmp))) return false;
  const [a, b] = [tailleJpeg(f) || [0, 0], tailleJpeg(tmp) || [0, 0]];
  // Même image (même proportion à 3 % près) et vraiment plus grande ; sinon on garde l'ancienne.
  if (b[0] > a[0] * 1.2 && Math.abs(b[0] / b[1] - a[0] / a[1]) < 0.03 * (a[0] / a[1])) {
    renameSync(tmp, f); for (const l of [480, 800, 1080]) rmSync(f.replace(/\.jpg$/, `-${l}.webp`), { force: true });
    return true;
  }
  rmSync(tmp, { force: true }); return false;
}
// Appel Gemini (modèle flash le plus récent disponible), réponse JSON. null si pas de clé ou échec.
let MODELES = null;
// Budget de temps : les enrichissements (lieux, partenaires, transports…) s'arrêtent à temps pour que la mise à jour
// se termine et s'enregistre toujours (GitHub coupe un passage au bout d'une heure). Le reste se fait au passage suivant.
let LIMITE = Infinity;
let CONFIG_LLM = {};
// « Très demandée » : seulement les soirées les plus attendues (environ 1 sur 8, et buzz ≥ 0,85).
let SEUIL_DEMANDE = 0.85;
const tempsOk = () => Date.now() < LIMITE;
async function gemini(parts, { recherche = false, secondaire = false } = {}) {
  const CLE = (process.env.GEMINI_API_KEY || '').trim();
  if (!CLE) return null;
  if (!LLM.budgetOk('gemini', CONFIG_LLM, secondaire)) return null; // plafonds de dépense (contenus/budget-ia.json) ou compte à sec
  const API = 'https://generativelanguage.googleapis.com/v1beta/models';
  try {
    if (!MODELES) {
      const liste = await (await fetch(`${API}?pageSize=200&key=${CLE}`, { signal: AbortSignal.timeout(30000) })).json();
      MODELES = (liste.models || []).map((m) => m.name.replace('models/', '')).filter((n) => /^gemini-[\d.]+-flash/.test(n) && !/image|tts|audio|live|lite/.test(n))
        .sort((a, b) => parseFloat(b.slice(7)) - parseFloat(a.slice(7)));
      if (CONFIG_LLM.modele_gemini) MODELES = [...new Set([CONFIG_LLM.modele_gemini, ...MODELES])];
    }
    for (const m of MODELES.slice(0, 3)) {
      const r = await fetch(`${API}/${m}:generateContent?key=${CLE}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        contents: [{ role: 'user', parts }], ...(recherche ? { tools: [{ google_search: {} }] } : { generationConfig: { responseMimeType: 'application/json' } }) }), signal: AbortSignal.timeout(120000) });
      if (r.status === 404) continue;
      if (!r.ok) { const e = new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`); e.status = r.status; LLM.marquerASec('gemini', e); return null; }
      LLM.compter('gemini', recherche ? 'recherche' : 'appel');
      const t = ((await r.json()).candidates?.[0]?.content?.parts || []).map((x) => x.text || '').join('');
      return recherche ? t : JSON.parse(t || 'null');
    }
  } catch { /* indisponible */ }
  return null;
}

// Vérification d'une affiche (v2) : l'IA LIT l'affiche (titre, artistes, lieu, dates) et le code compare avec la
// soirée. Acceptée si la date concorde (ou si l'affiche n'en montre pas) ET qu'un artiste, le lieu ou un mot du titre
// se retrouve dans la soirée. Avant, une simple question « ça correspond ? » rejetait de bonnes affiches.
const motsAffiche = (x) => new Set(sansAccent(String(x || '')).toLowerCase().split(/[^a-z0-9]+/).filter((m) => m.length >= 4 && !/^(soiree|party|night|club|nice|cannes|monaco|antibes|toulon|edition|presente|presents|avec|with|special|session|live|music|musique|entree|gratuit|billets|tickets|novembre|decembre|2026|2027)$/.test(m)));
// Image de partage officielle d'une page (balise og:image), ou '' si absente / page illisible.
async function imageDePartage(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'fr' }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return '';
    const html = (await r.text()).slice(0, 300000);
    const m = html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return m && /^https?:\/\//.test(m[1]) ? m[1].replace(/&amp;/g, '&') : '';
  } catch { return ''; }
}
async function verifier(e, fichier, cache) {
  const k = `v2|${h(`${e.image}|${e.name}`)}`, ancien = cache[h(`${e.image}|${e.name}`)];
  if (e.manuel) return true; // affiche fournie et vérifiée par l'équipe
  if (cache[k]) return cache[k].lu ? jugerAffiche(e, cache[k].lu) : cache[k].ok;
  // Sans IA disponible (ou plus de temps) : ancien verdict s'il existe ; sinon on ne montre une affiche non vérifiée que
  // si elle vient de la billetterie ou de l'organisateur, jamais si c'est la recherche web qui l'a associée (risque
  // d'affiche d'une autre soirée, cas « La Tocardise » / « Noise Protocol » du 11/11/2026).
  if (!tempsOk() || !(process.env.GEMINI_API_KEY || '').trim()) return ancien ? ancien.ok : e.source !== 'web';
  const r = await gemini([{ inline_data: { mime_type: 'image/jpeg', data: readFileSync(fichier).toString('base64') } }, { text: 'Lis cette affiche de soirée. Réponds en JSON {"titre":string,"artistes":[string],"lieu":string,"ville":string,"dates":["AAAA-MM-JJ"]}. Recopie seulement ce qui est écrit sur l\'affiche (dates au format AAAA-MM-JJ, année 2026 ou 2027 si elle n\'est pas écrite ; tableau vide si aucune date). Chaîne vide si absent.' }]);
  if (!r || typeof r !== 'object') return ancien ? ancien.ok : e.source !== 'web'; // lecture impossible : même règle
  const lu = { titre: r.titre, dates: (r.dates || []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)), artistes: (r.artistes || []).slice(0, 6), lieu: r.lieu || '' };
  const ok = jugerAffiche(e, lu);
  cache[k] = { ok, le: new Date().toISOString(), nom: e.name, lu, commun: [...motsAffiche([lu.titre, ...lu.artistes].join(' '))].filter((m) => motsAffiche(`${e.name} ${(e.artistes || []).join(' ')}`).has(m)).slice(0, 5) };
  return ok;
}
// Jugement d'une affiche lue (titre, artistes, dates) — règle durcie le 12/11/2026 après le carrousel où l'affiche de
// « Caribbean Mood » (13/11, même club) illustrait « The Best or Nothing » (14/11) : le lieu seul ne suffit plus.
//  - le TITRE ou un ARTISTE de l'affiche doit se retrouver dans le nom de la soirée (ou ses artistes) ;
//  - la date lue doit être celle de la soirée (veille ou lendemain toléré seulement si le titre correspond, soirée
//    après minuit) ; une affiche sans date lisible passe si le titre correspond.
export function jugerAffiche(e, lu = {}) {
  const jour = cle(e.start), j = Date.parse(`${jour}T12:00:00Z`);
  const dates = (lu.dates || []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const nom = motsAffiche(`${e.name} ${(e.artistes || []).join(' ')} ${e.accroche || ''} ${e.description || ''}`);
  const titre = motsAffiche([lu.titre, ...(lu.artistes || [])].join(' '));
  for (const m of motsAffiche(`${e.venue || ''} ${e.city || ''}`)) { nom.delete(m); titre.delete(m); } // le nom du lieu ne prouve rien (autre soirée, même club)
  const titreOk = !titre.size ? null : [...titre].some((m) => nom.has(m));
  const exacte = dates.some((d) => d === jour), proche = dates.some((d) => Math.abs(Date.parse(`${d}T12:00:00Z`) - j) <= 864e5);
  if (titreOk === false) return false; // affiche d'une autre soirée (autre titre, autres artistes)
  if (!dates.length) return titreOk === true;
  return exacte || (titreOk === true && proche);
}

// Verdict d'une affiche pour les publications Instagram, sans aucun appel d'IA : affiche saisie par l'équipe, ou lue et
// jugée conforme (cache du site), ou fournie par la billetterie / l'organisateur (jamais associée par la recherche web).
export function afficheFiable(e) {
  if (e.manuel) return true;
  const cache = lire(VERIF, {});
  const c = cache[`v2|${h(`${e.image}|${e.name}`)}`];
  if (c) return c.lu ? jugerAffiche(e, c.lu) : !!c.ok;
  const ancien = cache[h(`${e.image}|${e.name}`)];
  return ancien ? !!ancien.ok && e.source !== 'web' : e.source !== 'web';
}

// Position des lieux (OpenStreetMap / Nominatim, 1 requête par seconde, résultats gardés).
const cleLieu = (s) => `${s.lieu}|${s.ville}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
export async function geocoder(soirees, log) {
  const cache = lire(GEO, {});
  let requetes = 0, trouves = 0, coupe = false;
  for (const s of soirees) {
    const k = cleLieu(s);
    const c = cache[k];
    const aRetenter = c && c.introuvable && (c.v !== 2 || Date.now() - Date.parse(c.le) > 14 * 864e5 || (s.adresse && !c.adr)); // adresse connue depuis : on réessaie
    if (s.lieu && (!c || aRetenter) && requetes < 60 && !coupe && tempsOk()) {
      // Plusieurs formulations : adresse, « lieu, ville », lieu seul (dans la zone Côte d'Azur), lieu sans mots génériques.
      const court = s.lieu.replace(/\b(club|bar|restaurant|plage|beach|rooftop|le|la|les)\b/gi, ' ').replace(/[-–—@|].*$/, '').replace(/\s+/g, ' ').trim();
      const essais = [...new Set([s.adresse, `${s.lieu}, ${s.ville}`, s.lieu, court && `${court}, ${s.ville}`].filter((x) => x && x.length > 2))];
      let p = null;
      // Adresse française complète (code postal) : Base Adresse Nationale (gratuite, officielle), la plus précise.
      if (/\b\d{5}\b/.test(s.adresse || '')) {
        requetes++;
        const r = await fetch(`https://api-adresse.data.gouv.fr/search/?limit=1&q=${encodeURIComponent(s.adresse)}`, { signal: AbortSignal.timeout(12000) }).catch(() => null);
        const f = r?.ok ? (await r.json().catch(() => ({}))).features?.[0] : null;
        if (f && f.properties?.score >= 0.6 && ['housenumber', 'street'].includes(f.properties.type)) p = { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
      }
      for (const q of p ? [] : essais) {
        if (requetes >= 60 || coupe) break;
        requetes++;
        const u = new URL('https://nominatim.openstreetmap.org/search');
        Object.entries({ format: 'json', limit: '1', q, countrycodes: 'fr,mc', viewbox: '5.6,44.4,7.8,42.9', bounded: '1' }).forEach(([a, b]) => u.searchParams.set(a, b));
        const r = await fetch(u, { headers: { 'User-Agent': 'TeufySite/1.0 (+https://junior63122.github.io/teufy-instagram/)', 'Accept-Language': 'fr' }, signal: AbortSignal.timeout(12000) }).catch(() => null);
        if (!r?.ok) { coupe = true; break; } // pas de réseau ou service refusé : on réessaiera au prochain passage
        [p] = await r.json().catch(() => []);
        await dort(1100);
        if (p) break;
      }
      if (!coupe) {
        cache[k] = p ? { lat: +(+p.lat).toFixed(5), lng: +(+p.lon).toFixed(5), le: new Date().toISOString() } : { introuvable: true, v: 2, le: new Date().toISOString(), ...(s.adresse ? { adr: true } : {}) };
        if (p) trouves++;
      }
    }
    const g = cache[k];
    if (g && !g.introuvable) Object.assign(s, { lat: g.lat, lng: g.lng, approx: false });
    else {
      const [, lat, lng] = CENTRES.find(([re]) => re.test(`${s.ville} ${s.lieu}`)) || [null, 43.7009, 7.2683];
      const d = parseInt(h(s.lieu || s.nom), 16); // décalage stable : deux lieux d'une même ville ne se superposent pas
      Object.assign(s, { lat: +(lat + ((d % 100) - 50) * 0.00008).toFixed(5), lng: +(lng + ((Math.floor(d / 256) % 100) - 50) * 0.00011).toFixed(5), approx: true });
    }
  }
  // Lieux introuvables sur OpenStreetMap : on demande à l'IA, et on ne garde que les positions sûres
  // (confiance ≥ 0,8 et à moins de 15 km du centre de la ville annoncée).
  const restants = [...new Map(soirees.filter((x) => x.approx && x.lieu && !cache[cleLieu(x)]?.ia).map((x) => [cleLieu(x), x])).values()].slice(0, 40);
  if (restants.length && (process.env.GEMINI_API_KEY || '').trim()) {
    const r = await gemini([{ text: `Coordonnées GPS de ces lieux de soirée (clubs, bars, salles, plages) de la Côte d'Azur. Réponds en JSON {"lieux":[{"n":numéro,"lat":nombre|null,"lng":nombre|null,"confiance":0..1}]}. Mets null et une confiance basse si tu n'es pas sûr : ne devine jamais.\n${restants.map((x, i) => `${i + 1}. ${x.lieu}${x.adresse ? `, ${x.adresse}` : ''}, ${x.ville}`).join('\n')}` }]);
    let ok = 0;
    for (const l of r?.lieux || []) {
      const x = restants[l.n - 1];
      if (!x) continue;
      const k = cleLieu(x);
      const [, clat, clng] = CENTRES.find(([re]) => re.test(`${x.ville} ${x.lieu}`)) || [null, 43.7009, 7.2683];
      const km = Math.hypot((l.lat - clat) * 111, (l.lng - clng) * 80);
      if (typeof l.lat === 'number' && typeof l.lng === 'number' && l.confiance >= 0.8 && km < 15) {
        cache[k] = { lat: +l.lat.toFixed(5), lng: +l.lng.toFixed(5), le: new Date().toISOString(), ia: true };
        ok++;
      } else cache[k] = { ...(cache[k] || { introuvable: true, v: 2, le: new Date().toISOString() }), ia: true };
    }
    for (const x of soirees) { const g = cache[cleLieu(x)]; if (g && !g.introuvable && x.approx) Object.assign(x, { lat: g.lat, lng: g.lng, approx: false }); }
    if (ok) log(`Site : ${ok} lieu(x) placé(s) grâce à l'IA`);
  }
  await writeFile(GEO, JSON.stringify(cache, null, 1) + '\n');
  if (requetes) log(`Site : carte, ${trouves} lieu(x) trouvé(s) sur OpenStreetMap${coupe ? ' (service injoignable : positions approximatives en attendant)' : ''}`);
}

// --- Autour de la soirée : parkings, arrêts de tram, de bus, gares, vélos et taxis (OpenStreetMap / Overpass).
const PROCHES = path.join(ROOT, 'contenus', 'lieux-proches.json');
const UA = 'TeufySite/1.0 (+https://junior63122.github.io/teufy-instagram/)';
const SERVEURS_OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
export async function aProximite(soirees, log) {
  const cache = lire(PROCHES, {});
  const lieux = new Map();
  for (const s of soirees) if (!s.approx && s.lat) lieux.set(`${s.lat},${s.lng}`, s);
  let n = 0, coupe = false, echecs = 0;
  for (const [k, s] of lieux) {
    if (cache[k] && Date.now() - Date.parse(cache[k].le) < 60 * 864e5) continue;
    if (n >= 40 || coupe || !tempsOk()) break;
    n++;
    const a = (r) => `(around:${r},${s.lat},${s.lng})`;
    const q = `[out:json][timeout:25];(nwr${a(800)}[amenity=parking][access!~"^(private|customers|no)$"];node${a(900)}[railway~"^(tram_stop|station|halt)$"];node${a(500)}[highway=bus_stop];node${a(600)}[amenity~"^(bicycle_rental|taxi)$"];);out center tags 120;`;
    // Plusieurs serveurs Overpass (le principal est souvent saturé) ; on n'abandonne qu'après 3 lieux en échec d'affilée.
    let d = null;
    for (const serveur of SERVEURS_OVERPASS) {
      const r = await fetch(serveur, { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'content-type': 'application/x-www-form-urlencoded', 'User-Agent': UA }, signal: AbortSignal.timeout(60000) }).catch(() => null);
      d = r?.ok ? await r.json().catch(() => null) : null;
      if (d) break;
    }
    if (!d) { echecs++; if (echecs >= 3) { coupe = true; break; } continue; }
    echecs = 0;
    const m = (la, lo) => Math.round(Math.hypot((la - s.lat) * 111320, (lo - s.lng) * 111320 * Math.cos(s.lat * Math.PI / 180)));
    const el = (d.elements || []).map((e) => ({ t: e.tags || {}, la: e.lat ?? e.center?.lat, lo: e.lon ?? e.center?.lon })).filter((e) => e.la).map((e) => ({ ...e, m: m(e.la, e.lo) })).sort((x, y) => x.m - y.m);
    const parkings = el.filter((e) => e.t.amenity === 'parking' && (e.t.name || ['underground', 'multi-storey'].includes(e.t.parking))).slice(0, 3)
      .map((e) => ({ nom: e.t.name || '', type: e.t.parking || '', payant: e.t.fee === 'no' ? false : e.t.fee ? true : null, m: e.m }));
    const transports = [];
    for (const e of el.filter((x) => x.t.railway || x.t.highway === 'bus_stop')) {
      const type = e.t.railway === 'tram_stop' ? 'tram' : e.t.railway ? 'train' : 'bus';
      if (!e.t.name || transports.some((x) => x.nom === e.t.name && x.type === type)) continue;
      if (transports.filter((x) => x.type === type).length >= (type === 'train' ? 1 : 2)) continue;
      transports.push({ nom: e.t.name, type, m: e.m, lignes: e.t.route_ref || '' });
    }
    const velo = el.find((e) => e.t.amenity === 'bicycle_rental');
    const taxi = el.find((e) => e.t.amenity === 'taxi');
    cache[k] = { le: new Date().toISOString(), parkings, transports: transports.sort((x, y) => x.m - y.m).slice(0, 4), velo: velo ? { nom: velo.t.name || '', m: velo.m } : null, taxi: taxi ? { nom: taxi.t.name || '', m: taxi.m } : null };
    await dort(1500);
  }
  await writeFile(PROCHES, JSON.stringify(cache, null, 1) + '\n');
  for (const s of soirees) s.proches = s.approx ? null : cache[`${s.lat},${s.lng}`] || null;
  if (n) log(`Site : parkings et transports cherchés autour de ${n} lieu(x)${coupe ? ' (service injoignable, on réessaiera)' : ''}`);
}

// --- Partenaires : nom lu sur le logo par l'IA, puis fiche (type, ville, adresse, description) trouvée sur le web.
// Sert aux rubriques « Pour un date », « Restaurants » et « Activités » (uniquement des partenaires de Teufy).
const PART_INFOS = path.join(ROOT, 'contenus', 'partenaires-infos.json');
const CATEGORIES = ['restaurant', 'bar', 'rooftop', 'club', 'beach-club', 'activite', 'hotel', 'organisateur', 'festival', 'artiste', 'media', 'marque', 'service', 'personne', 'autre'];
async function identifierPartenaires(log, { ig = null, api = {} } = {}) {
  const P = lire(path.join(ROOT, 'contenus', 'partenaires.json'), { liste: [] });
  const infos = lire(PART_INFOS, {});
  const cle = !!(process.env.GEMINI_API_KEY || '').trim();
  let lus = 0, fiches = 0;
  if (cle) {
    for (const x of P.liste || []) {
      if (infos[x.fichier]?.lu || x.nom) continue;
      if (!tempsOk()) break;
      const f = path.join(ROOT, x.fichier);
      if (!existsSync(f)) continue;
      const r = await gemini([{ inline_data: { mime_type: 'image/png', data: readFileSync(f).toString('base64') } }, { text: "Logo d'un partenaire de Teufy, guide des soirées de la Côte d'Azur (club, bar, restaurant, plage, organisateur…). Quel nom est écrit sur ce logo ? JSON {\"nom\": string|null, \"confiance\": 0..1}. null si illisible : n'invente pas." }]);
      if (!r) break;
      infos[x.fichier] = { lu: true, nom: r.confiance >= 0.7 && r.nom ? String(r.nom).trim() : '' };
      lus++;
    }
    const aChercher = Object.entries(infos).filter(([, v]) => v.nom && !v.fiche).slice(0, 36);
    const SCHEMA = '{"lieux":[{"n":numéro,"trouve":bool,"categorie":"' + CATEGORIES.join('|') + '","ville":string,"adresse":string,"instagram":string,"site":string,"description":string,"date":bool,"date_raison":string,"prix":"€|€€|€€€|€€€€|"}]}';
    for (let i = 0; i < aChercher.length && tempsOk(); i += 6) {
      const lot = aChercher.slice(i, i + 6);
      const liste = lot.map(([, v], j) => `${j + 1}. ${v.nom}`).join('\n');
      const web = await gemini([{ text: `Ces établissements et marques sont partenaires d'un guide des soirées de la Côte d'Azur (Nice, Cannes, Antibes, Monaco). Pour chacun, trouve ce que c'est (restaurant, bar, club, plage, activité, organisateur…), la ville, l'adresse, le compte Instagram et le site officiels, et ce qu'on y fait.\n${liste}` }], { recherche: true });
      if (!web) break;
      const r = await gemini([{ text: `Partenaires :\n${liste}\n\nRésultats de recherche :\n${web}\n\nRéponds en JSON ${SCHEMA}. description : 1 à 2 phrases factuelles en français (ce qu'on y trouve, l'ambiance), sans superlatif inventé. date = true seulement si c'est un lieu agréable pour un rendez-vous à deux (restaurant, rooftop, bar à cocktails, plage, activité), avec date_raison en une phrase. trouve = false si tu n'es pas sûr de quel établissement il s'agit. N'invente rien : chaîne vide si inconnu.` }]);
      for (const l of r?.lieux || []) {
        const e = lot[l.n - 1];
        if (!e) continue;
        infos[e[0]].fiche = l.trouve && CATEGORIES.includes(l.categorie) ? { categorie: l.categorie, ville: l.ville || '', adresse: l.adresse || '', instagram: String(l.instagram || '').replace(/^.*instagram\.com\//, '').replace(/[/@?].*$/, '').replace(/^@/, ''), site: /^https?:\/\//.test(l.site || '') ? l.site : '', description: l.description || '', date: !!l.date, date_raison: l.date_raison || '', prix: l.prix || '' } : { inconnu: true };
        fiches++;
      }
    }
  }
  // Comptes Instagram suivis par Teufy (contenus/partenaires-comptes.json) : profil via l'API (nom, bio, site, photo),
  // puis fiche (type, ville, adresse, description) trouvée sur le web. Quelques dizaines par passage, gardés en cache.
  // Partenaires payants (Stripe, src/paiements.mjs) : ajoutés aux comptes suivis → profil et logo récupérés automatiquement.
  const C0 = lire(path.join(ROOT, 'contenus', 'partenaires-comptes.json'), { comptes: [] }).comptes || [];
  const C = [...C0, ...PAYANTS().filter((p) => p.instagram && !C0.some((c) => c.instagram === p.instagram)).map((p) => ({ instagram: p.instagram, nom: p.etablissement }))];
  let profils = 0, fichesIg = 0;
  if (ig && api.businessDiscovery) {
    await mkdir(path.join(SITE, 'partenaires', 'ig'), { recursive: true });
    for (const c of C.filter((x) => !infos[`ig:${x.instagram}`]?.profil).slice(0, 60)) {
      if (!tempsOk()) break;
      const k = `ig:${c.instagram}`;
      try {
        const bd = await api.businessDiscovery(c.instagram, ig);
        const photo = path.join(SITE, 'partenaires', 'ig', `${c.instagram.replace(/[^a-z0-9_.-]/gi, '_')}.jpg`);
        let fichier = '';
        if (bd?.profile_picture_url) {
          const r = await fetch(bd.profile_picture_url, { signal: AbortSignal.timeout(15000) }).catch(() => null);
          if (r?.ok) { const tmp = `${photo}.src`; await writeFile(tmp, Buffer.from(await r.arrayBuffer())); const x = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-vf', 'scale=160:160', '-q:v', '4', photo]); spawnSync('rm', ['-f', tmp]); if (x.status === 0) fichier = path.relative(ROOT, photo); }
        }
        infos[k] = { ...(infos[k] || {}), profil: { nom: bd?.name || '', bio: (bd?.biography || '').slice(0, 300), site: bd?.website || '', abonnes: bd?.followers_count ?? null, fichier } };
        profils++;
      } catch (err) {
        if (/rate|limit|\(#4\)|\(#32\)/i.test(err.message)) break; // limite de l'API : on continue au prochain passage
        infos[k] = { ...(infos[k] || {}), profil: { absent: true } }; // compte personnel (non professionnel) : pas de profil public via l'API
      }
    }
  }
  if (cle) {
    const SCHEMA = '{"lieux":[{"n":numéro,"trouve":bool,"categorie":"' + CATEGORIES.join('|') + '","ville":string,"adresse":string,"site":string,"description":string,"date":bool,"date_raison":string,"prix":"€|€€|€€€|€€€€|"}]}';
    const aFicher = C.filter((x) => !infos[`ig:${x.instagram}`]?.fiche).slice(0, 64);
    for (let i = 0; i < aFicher.length && tempsOk(); i += 8) {
      const lot = aFicher.slice(i, i + 8);
      const liste = lot.map((x, j) => { const pr = infos[`ig:${x.instagram}`]?.profil || {}; return `${j + 1}. @${x.instagram}${x.nom || pr.nom ? ` (${pr.nom || x.nom})` : ''}${pr.bio ? ` · bio : ${pr.bio.replace(/\s+/g, ' ')}` : ''}${pr.site ? ` · ${pr.site}` : ''}`; }).join('\n');
      const web = await gemini([{ text: `Ces comptes Instagram sont suivis par un guide des soirées de la Côte d'Azur (Nice, Cannes, Antibes, Monaco, Toulon). Pour chacun, trouve ce que c'est (restaurant, bar, club, plage, activité, organisateur, DJ, service…), la ville, l'adresse et le site officiel, et ce qu'on y fait.\n${liste}` }], { recherche: true });
      if (!web) break;
      const r = await gemini([{ text: `Comptes :\n${liste}\n\nRésultats de recherche :\n${web}\n\nRéponds en JSON ${SCHEMA}. categorie « personne » pour un particulier ou un influenceur sans activité professionnelle publique ; « service » pour VTC, sécurité, location, photographe… description : 1 à 2 phrases factuelles en français, sans superlatif inventé. date = true seulement pour un lieu ou une activité agréable pour un rendez-vous à deux (restaurant, rooftop, bar à cocktails, plage, activité), avec date_raison en une phrase. trouve = false si tu n'es pas sûr. N'invente rien : chaîne vide si inconnu.` }]);
      if (!r?.lieux) break;
      for (const l of r.lieux) {
        const x = lot[l.n - 1];
        if (!x) continue;
        const k = `ig:${x.instagram}`;
        infos[k] = { ...(infos[k] || {}), fiche: l.trouve && CATEGORIES.includes(l.categorie) ? { categorie: l.categorie, ville: l.ville || '', adresse: l.adresse || '', site: /^https?:\/\//.test(l.site || '') ? l.site : '', description: l.description || '', date: !!l.date, date_raison: l.date_raison || '', prix: l.prix || '' } : { inconnu: true } };
        fichesIg++;
      }
    }
  }
  await writeFile(PART_INFOS, JSON.stringify(infos, null, 1) + '\n');
  if (lus || fiches || profils || fichesIg) log(`Site : partenaires, ${lus} logo(s) lu(s), ${profils} profil(s) Instagram, ${fiches + fichesIg} fiche(s) trouvée(s)`);
  const norm = (x) => sansAccent(x).replace(/[^a-z0-9]/g, '');
  const logos = (P.liste || []).map((x) => { const i = infos[x.fichier] || {}; const f = i.fiche && !i.fiche.inconnu ? i.fiche : null; return { ...x, nom: x.nom || i.nom || '', ...(f || {}), instagram: x.instagram || f?.instagram || '' }; });
  const comptes = C.map((c) => {
    const i = infos[`ig:${c.instagram}`] || {}; const pr = i.profil || {}; const f = i.fiche && !i.fiche.inconnu ? i.fiche : null;
    return { fichier: pr.fichier || '', nom: c.nom || pr.nom || c.instagram, instagram: c.instagram, ...(f || {}), site: f?.site || pr.site || '' };
  });
  // Un même partenaire peut avoir un logo ET un compte suivi : on fusionne (logo gardé, infos complétées).
  for (const c of comptes) {
    const l = logos.find((x) => (x.instagram && x.instagram === c.instagram) || (x.nom && norm(x.nom) === norm(c.nom)));
    if (l) { for (const [a, b] of Object.entries(c)) if (!l[a] && b) l[a] = b; c.fusionne = true; }
  }
  // Partenaires payants en tête de la vitrine (mise en avant achetée), marqués comme tels.
  const payant = (x) => PAYANTS().find((p) => (p.instagram && p.instagram === x.instagram) || norm(p.etablissement) === norm(x.nom || ''));
  return [...logos, ...comptes.filter((c) => !c.fusionne)].filter((x) => x.categorie !== 'personne').map((x) => (payant(x) ? { ...x, payant: payant(x).formule } : x)).sort((a, b) => !!b.payant - !!a.payant);
}

// --- Clubs et bars de la Côte d'Azur et du Var : annuaire (recherche web, partenaires, lieux de l'agenda) et tendance
// du moment (engagement Instagram récent, surtout les commentaires, et nombre de soirées à venir). Cache : contenus/lieux-nuit.json.
const LIEUX = path.join(ROOT, 'contenus', 'lieux-nuit.json');
const TYPES_LIEUX = ['club', 'bar', 'rooftop', 'beach-club', 'bar-a-cocktails', 'pub', 'lounge', 'salle'];
const ZONES_LIEUX = ['Nice, Villefranche-sur-Mer, Saint-Laurent-du-Var, Cagnes-sur-Mer', 'Cannes, Le Cannet, Mandelieu, Antibes, Juan-les-Pins, Golfe-Juan', 'Monaco, Monte-Carlo, Beausoleil, Menton', 'Toulon, La Seyne-sur-Mer, Hyères, Six-Fours, Sanary, Bandol', 'Fréjus, Saint-Raphaël, Sainte-Maxime, Saint-Tropez, Ramatuelle'];
// Après la soirée : où manger tard (ouvert après 2 h) et les afters (ouverts à partir de 5 h ou soirées after).
// Recherche web une fois par semaine ; on ne garde QUE les lieux avec des horaires publiés et une source vérifiable.
// Partenaires payants actifs (contenus/partenaires-payants.json, tenu à jour depuis Stripe par src/paiements.mjs).
const PAYANTS = () => (lire(path.join(ROOT, 'contenus', 'partenaires-payants.json'), { partenaires: [] }).partenaires || []).filter((p) => p.actif);
const NUIT_TARDIVE = path.join(ROOT, 'contenus', 'nuit-tardive.json');
let TARDIFS = [];
let LIEUX_TOUS = []; // tous les lieux (pour « Après ce lieu »)
// Pastilles du menu : nombre de soirées par soir (3 prochains jours) et dates des dernières actus (lues par app.js).
let NOTIF = { soirs: {}, actus: [] };
// Nombre de soirées à venir par rubrique du menu (petits chiffres gris à côté des villes, styles, week-end…).
let COMPTES_NAV = {};
let AVANTAGES = []; // offres partenaires en cours (page Avantages, menu, fiches des lieux)
// Données d'OpenStreetMap relevées sans IA par outils/nuit-tardive.mjs (robot « Lieux ») : plus de recherche Gemini.
async function nuitTardive() { return lire(NUIT_TARDIVE, { lieux: [] }).lieux || []; }
async function lieuxDeNuit({ soirees, partenaires, ig, api, log, now }) {
  const cache = lire(LIEUX, { maj: null, lieux: [], insta: {} });
  const cle = !!(process.env.GEMINI_API_KEY || '').trim();
  // 1. Liste des lieux (une fois par semaine).
  if (cle && (!cache.maj || now - Date.parse(cache.maj) > 7 * 864e5)) {
    const trouves = [];
    for (const z of ZONES_LIEUX) {
      if (!tempsOk()) break;
      const web = await gemini([{ text: `Liste les boîtes de nuit, bars de nuit, bars à cocktails, rooftops, beach clubs et pubs où sortent les 18-30 ans à ${z} (lieux ouverts actuellement). Pour chacun : nom exact, type, ville, adresse, compte Instagram officiel, site, et en une phrase ce qu'on y trouve (ambiance, musique).` }], { recherche: true });
      if (!web) continue;
      const r = await gemini([{ text: `Lieux :\n${web}\n\nRéponds en JSON {"lieux":[{"nom":string,"type":"${TYPES_LIEUX.join('|')}","ville":string,"adresse":string,"instagram":string,"site":string,"description":string}]}. N'invente rien : chaîne vide si inconnu. description : une phrase factuelle en français. Exclus les lieux fermés définitivement.` }]);
      for (const l of r?.lieux || []) if (l.nom && TYPES_LIEUX.includes(l.type)) trouves.push({ ...l, instagram: String(l.instagram || '').replace(/^.*instagram\.com\//, '').replace(/[/@?].*$/, '').replace(/^@/, '').toLowerCase(), site: /^https?:\/\//.test(l.site || '') ? l.site : '' });
    }
    if (trouves.length) { cache.lieux = trouves; cache.maj = now.toISOString(); log(`Site : ${trouves.length} clubs et bars recensés`); }
  }
  // 2. On complète avec les partenaires (clubs, bars, rooftops, plages) et les lieux qui ont des soirées à venir.
  const norm = (x) => sansAccent(x).replace(/\b(le|la|les|l|club|bar|nice|cannes|monaco)\b/g, '').replace(/[^a-z0-9]/g, '');
  const tous = [...cache.lieux];
  const trouver = (nom, ville) => tous.find((l) => norm(l.nom) && norm(l.nom) === norm(nom) && (!ville || !l.ville || sansAccent(l.ville).slice(0, 4) === sansAccent(ville).slice(0, 4)));
  for (const p of partenaires || []) {
    if (!['club', 'bar', 'rooftop', 'beach-club'].includes(p.categorie)) continue;
    const l = trouver(p.nom, p.ville);
    if (l) Object.assign(l, { partenaire: true, instagram: l.instagram || p.instagram, photo: p.fichier }); else tous.push({ nom: p.nom, type: p.categorie, ville: p.ville || '', adresse: p.adresse || '', instagram: p.instagram || '', site: p.site || '', description: p.description || '', partenaire: true, photo: p.fichier });
  }
  // Carte OpenStreetMap (contenus/lieux-osm.json, robot Lieux, sans IA) : TOUTES les boîtes de nuit de nos villes sont
  // ajoutées ; un lieu classé « club » que la carte déclare bar ou pub devient un bar (une boîte de nuit n'est pas un bar
  // dansant, directeur 13/11/2026). L'équipe garde le dernier mot (lieux-manuels.json, appliqué juste après).
  for (const o of lire(path.join(ROOT, 'contenus', 'lieux-osm.json'), { lieux: [] }).lieux || []) {
    const l = trouver(o.nom, o.ville);
    if (l) {
      if (o.osm === 'nightclub') l.type = 'club'; else if (l.type === 'club') l.type = 'bar';
      if (!l.adresse && o.adresse) l.adresse = o.adresse;
      if (!l.site && o.site) l.site = o.site;
      if (o.horaires && !l.details?.horaires) l.horairesOsm = { horaires: o.horaires, source: o.source };
      if (!l.lat && o.lat) { l.lat = o.lat; l.lng = o.lng; }
    } else if (o.osm === 'nightclub') {
      tous.push({ nom: o.nom, type: 'club', ville: o.ville, adresse: o.adresse || '', instagram: o.instagram || '', site: o.site || '', description: '', source_carte: o.source, lat: o.lat, lng: o.lng, ...(o.horaires ? { horairesOsm: { horaires: o.horaires, source: o.source } } : {}) });
    }
  }
  // Lieux ajoutés par l'équipe (contenus/lieux-manuels.json) : jamais effacés par la mise à jour hebdomadaire.
  for (const m of lire(path.join(ROOT, 'contenus', 'lieux-manuels.json'), { lieux: [] }).lieux || []) {
    const l = trouver(m.nom, m.ville), propre = Object.fromEntries(Object.entries(m).filter(([k, v]) => !k.startsWith('_') && !['retirer', 'nouvelle_ville'].includes(k) && v !== ''));
    // « retirer » : lieu introuvable, fermé ou qui n'est pas un lieu de nuit (vérifié par l'équipe) : il quitte l'annuaire.
    if (m.retirer) { for (let i = tous.length - 1; i >= 0; i--) if (tous[i] === l || (norm(tous[i].nom) === norm(m.nom) && sansAccent(tous[i].ville || '').slice(0, 4) === sansAccent(m.ville || '').slice(0, 4))) tous.splice(i, 1); continue; }
    if (l) Object.assign(l, propre); else tous.push({ instagram: '', site: '', description: '', ...propre });
    if (m.nouvelle_ville) (l || tous.at(-1)).ville = m.nouvelle_ville; // ville corrigée (la carte se trompait de commune)
  }
  for (const l of tous) { const p = PAYANTS().find((x) => (x.instagram && x.instagram === l.instagram) || (norm(x.etablissement) && norm(x.etablissement) === norm(l.nom))); if (p) Object.assign(l, { partenaire: true, formule: p.formule }); }
  for (const p of PAYANTS().filter((x) => x.ville && !tous.some((l) => (x.instagram && x.instagram === l.instagram) || norm(x.etablissement) === norm(l.nom)))) tous.push({ nom: p.etablissement, type: 'bar', ville: p.ville, adresse: '', instagram: p.instagram, site: '', description: '', partenaire: true, formule: p.formule });
  for (const l of tous) { const ls = soirees.filter((s) => norm(s.lieu) && (norm(s.lieu) === norm(l.nom) || norm(s.lieu).startsWith(norm(l.nom)) || norm(l.nom).startsWith(norm(s.lieu))) && norm(l.nom).length >= 3); l.soirees = ls.map((s) => s.id); l.prochaines = ls.slice(0, 3).map((s) => ({ id: s.id, nom: s.nom })); l.soirs = ls.slice(0, 12).map((s) => [s.jour, heure(s.debut, TXT.fr).replace(/^(\d+)h(\d*)$/, (m, a, b) => `${a.padStart(2, '0')}:${b || '00'}`), s.id, s.nom]); }
  // Comptes des lieux : seulement des comptes confirmés (12/11/2026, « @le109nice » n'existait pas). Le pseudo proposé
  // non confirmé est gardé à part (instagram_non_verifie) pour la vérification de nuit (outils/verifier-comptes.mjs).
  { const { compteLieuConfirme } = await import('./comptes.mjs');
    for (const l of tous) { const h = compteLieuConfirme(l); if (h !== (l.instagram || '')) { if (l.instagram && !h) l.instagram_non_verifie = l.instagram; l.instagram = h; } } }
  // 3. Engagement Instagram récent (40 comptes par passage, gardé 3 jours).
  if (ig && api.businessDiscovery) {
    // D'abord les lieux encore sans logo (jamais mesurés depuis l'ajout des logos), puis les mesures les plus anciennes.
    const sansLogo = (l) => !l.photo && !existsSync(path.join(SITE, 'lieux', `${l.instagram.replace(/[^a-z0-9._-]/g, '')}-176.webp`)) && !cache.insta[l.instagram]?.absent && !cache.insta[l.instagram]?.photo;
    const aMesurer = tous.filter((l) => l.instagram && (sansLogo(l) || !cache.insta[l.instagram]?.posts && !cache.insta[l.instagram]?.absent || !(cache.insta[l.instagram] && now - Date.parse(cache.insta[l.instagram].le) < 3 * 864e5)))
      .sort((a, b) => (sansLogo(b) - sansLogo(a)) || (Date.parse(cache.insta[a.instagram]?.le || 0)) - (Date.parse(cache.insta[b.instagram]?.le || 0))).slice(0, 60);
    for (const l of aMesurer) {
      if (!tempsOk()) break;
      try {
        const bd = await api.businessDiscovery(l.instagram, ig);
        const recents = (bd?.media?.data || []).filter((m) => now - Date.parse(m.timestamp) < 21 * 864e5);
        const moy = (k) => (recents.length ? recents.reduce((a, m) => a + (m[k] || 0), 0) / recents.length : 0);
        // Publications du lieu gardées pour les images : affiches des soirées annoncées (60 derniers jours) et la photo la
        // plus aimée du lieu (belle image de secours quand une soirée n'a aucune affiche). Jamais de vidéo en photo de lieu.
        const medias = (bd?.media?.data || []).filter((m) => m.media_url && m.media_type !== 'VIDEO');
        const posts = medias.filter((m) => now - Date.parse(m.timestamp) < 60 * 864e5).map((m) => ({ u: m.media_url, c: String(m.caption || '').slice(0, 400), t: m.timestamp }));
        const couv = [...medias].sort((a, b) => (b.like_count || 0) - (a.like_count || 0))[0];
        cache.insta[l.instagram] = { le: now.toISOString(), abonnes: bd?.followers_count ?? null, posts21: recents.length, likes: Math.round(moy('like_count')), commentaires: Math.round(moy('comments_count') * 10) / 10, photo: bd?.profile_picture_url || '', posts, couv: couv ? { u: couv.media_url, lien: couv.permalink || '' } : null };
      } catch (err) { if (/rate|limit|\(#4\)|\(#32\)/i.test(err.message)) break; cache.insta[l.instagram] = { le: now.toISOString(), absent: true }; }
    }
  }
  // 3 bis. Logo : la photo de profil Instagram du lieu (lue par l'API), copiée sur le site (les liens Instagram expirent).
  const dossierLogos = path.join(SITE, 'lieux');
  await mkdir(dossierLogos, { recursive: true });
  for (const l of tous) {
    if (l.photo || !l.instagram) continue;
    const f = path.join(dossierLogos, `${l.instagram.replace(/[^a-z0-9._-]/g, '')}.jpg`);
    const w = f.replace(/\.jpg$/, '-176.webp');
    if (!existsSync(w)) {
      const u = cache.insta[l.instagram]?.photo;
      if (!u || !tempsOk()) continue;
      if (!existsSync(f) && !(await telecharger(u, f))) { cache.insta[l.instagram].photo = ''; continue; } // lien expiré : reprise à la prochaine mesure
      spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-vf', "scale='min(176,iw)':-2", '-c:v', 'libwebp', '-quality', '82', w]);
    }
    if (existsSync(w)) l.photo = path.relative(ROOT, w);
  }
  // 3 bis b. Pas de logo Instagram : l'image de partage officielle du site du lieu (og:image), recadrée en carré.
  for (const l of tous) {
    if (l.photo || !/^https?:\/\//.test(l.site || '')) continue;
    const w = path.join(dossierLogos, `site-${h(l.site)}-176.webp`);
    if (!existsSync(w)) {
      if (!tempsOk()) continue;
      cache.og = cache.og || {};
      const u = cache.og[l.site] ?? (cache.og[l.site] = await imageDePartage(l.site));
      const f = w.replace(/-176\.webp$/, '.jpg');
      if (!u || (!existsSync(f) && !(await telecharger(u, f)))) continue;
      spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-vf', "crop='min(iw,ih)':'min(iw,ih)',scale=176:176", '-c:v', 'libwebp', '-quality', '82', w]);
    }
    if (existsSync(w)) l.photo = path.relative(ROOT, w);
  }
  // 3 ter. Fiche pratique de chaque lieu (style de musique, dress code, horaires, prix des verres, entrée, âge minimum),
  //        recherchée sur ses sources officielles (site, Instagram, fiche Google, presse). Rien n'est inventé : un champ
  //        inconnu reste vide et n'est pas affiché. Revue tous les 30 jours. Cache : contenus/lieux-details.json.
  const DETAILS = path.join(ROOT, 'contenus', 'lieux-details.json');
  const details = lire(DETAILS, {});
  if (cle) {
    const aFicher = tous.filter((l) => { const d = details[slug(`${l.nom}-${l.ville}`)]; return !d || now - Date.parse(d.le) > 30 * 864e5; })
      .sort((a, b) => (b.insta?.abonnes || 0) - (a.insta?.abonnes || 0)).slice(0, CONFIG_LLM.lieux_par_passage ?? 15); // horaires d'ouverture : page « Ce soir » (budget : 15 par passage)
    for (const l of aFicher) {
      if (!tempsOk()) break;
      const k = slug(`${l.nom}-${l.ville}`);
      const web = await gemini([{ text: `Recherche les informations pratiques à jour du lieu de sortie « ${l.nom} » (${TYPES_NOMS[l.type] || l.type}) à ${l.ville}${l.adresse ? `, ${l.adresse}` : ''}${l.instagram ? `, Instagram @${l.instagram}` : ''}${l.site ? `, site ${l.site}` : ''}. Utilise uniquement des sources fiables et récentes (site officiel, Instagram officiel, fiche Google, billetterie, presse locale). Donne : les styles de musique joués, le dress code ou la tenue exigée, les jours et heures d'ouverture et de fermeture, le prix moyen d'un verre (bière, cocktail, soft), le prix d'entrée habituel, l'âge minimum, et les URL des sources. Si une information n'est pas trouvée, dis-le.` }], { recherche: true, secondaire: true });
      if (!web) continue;
      const r = await gemini([{ text: `Informations :\n${web}\n\nRéponds en JSON {"styles":string,"dress_code":string,"horaires":string,"prix_verre":string,"entree":string,"age_min":string,"sources":[string]}. Règles : N'INVENTE RIEN, chaîne vide si l'information n'est pas clairement donnée par une source. Phrases courtes en français. styles : 2 à 4 genres séparés par « · ». horaires : jours et heures d'ouverture actuels, au format « Jeu–Sam · 23h–5h » (plusieurs plages séparées par « · », ex. « Mar–Jeu 18h–2h · Ven–Sam 18h–4h » ; « Lun–Dim » si ouvert tous les jours ; ajoute « (en saison) » si c'est seulement l'été). prix_verre : fourchette, ex. « bière 7 € · cocktail 13–16 € ». entree : ex. « gratuit avant 1h, 15 € ensuite ». age_min : ex. « 18 ans ». sources : URL réellement utilisées.` }], { secondaire: true });
      const ok = r && typeof r === 'object' && Array.isArray(r.sources) && r.sources.some((u) => /^https?:\/\//.test(u));
      details[k] = ok ? { le: now.toISOString(), styles: r.styles || '', dress_code: r.dress_code || '', horaires: r.horaires || '', prix_verre: r.prix_verre || '', entree: r.entree || '', age_min: r.age_min || '', sources: r.sources.filter((u) => /^https?:\/\//.test(u)).slice(0, 4) } : { le: now.toISOString(), vide: true };
    }
    await writeFile(DETAILS, JSON.stringify(details, null, 1) + '\n');
    const n = Object.values(details).filter((d) => !d.vide).length;
    if (aFicher.length) log(`Site : fiches pratiques des lieux : ${n} renseignée(s)`);
  }
  for (const l of tous) { const d = details[slug(`${l.nom}-${l.ville}`)]; if (d && !d.vide) l.details = d; }
  // Horaires de la carte quand la fiche du lieu n'en a pas (source affichée : OpenStreetMap).
  for (const l of tous) if (l.horairesOsm && !l.details?.horaires) l.details = { ...(l.details || {}), horaires: l.horairesOsm.horaires, sources: [l.horairesOsm.source], le: new Date().toISOString() };
  // 4. Tendance du moment : UNIQUEMENT des données mesurées, jamais le fait d'être partenaire.
  //    Un lieu n'est classé que si son Instagram a été mesuré et qu'il a publié au moins 2 fois en 21 jours.
  //    Score = taux d'engagement (likes + 4 × commentaires, par rapport aux abonnés) et engagement brut, à parts égales
  //    (rangs), + un petit bonus si des soirées sont annoncées dans l'agenda. Pas de classement tant que moins de 12 lieux sont mesurés.
  for (const l of tous) {
    const i = cache.insta[l.instagram] || {};
    l.insta = !i.absent && i.le ? { abonnes: i.abonnes, likes: i.likes, commentaires: i.commentaires, posts21: i.posts21 } : null;
    l.slug = slug(`${l.nom}-${l.ville}`);
    l.score = 0;
  }
  const mesures = tous.filter((l) => l.insta && l.insta.posts21 >= 2 && l.insta.abonnes);
  if (mesures.length >= 12) {
    const brut = (l) => l.insta.likes + 4 * l.insta.commentaires;
    const taux = (l) => brut(l) / Math.max(l.insta.abonnes, 300);
    const rang = (f) => { const t = [...mesures].sort((a, b) => f(a) - f(b)); return (l) => t.indexOf(l) / (t.length - 1); };
    const rTaux = rang(taux), rBrut = rang(brut);
    for (const l of mesures) l.score = 0.5 * rTaux(l) + 0.5 * rBrut(l) + Math.min(0.15, 0.05 * l.soirees.length);
  }
  await writeFile(LIEUX, JSON.stringify({ maj: cache.maj, lieux: cache.lieux, insta: cache.insta }, null, 1) + '\n');
  const vus = new Set();
  return tous.filter((l) => (vus.has(l.slug) ? false : vus.add(l.slug))).sort((a, b) => b.score - a.score);
}

// --- Festivals de la Côte d'Azur et du Var : guide tenu à jour par recherche web (tous les 30 jours), partenaires compris.
// Remplace la liste écrite à la main (gardée en secours si la recherche est impossible). Cache : contenus/festivals.json.
const FESTIVALS_WEB = path.join(ROOT, 'contenus', 'festivals.json');
async function festivalsDuWeb({ partenaires, now, log }) {
  const cache = lire(FESTIVALS_WEB, { maj: null, festivals: [] });
  if (!(process.env.GEMINI_API_KEY || '').trim() || !tempsOk() || (cache.maj && now - Date.parse(cache.maj) < 30 * 864e5 && cache.festivals.length)) return cache.festivals;
  const partFest = (partenaires || []).filter((p) => p.categorie === 'festival' || /festival/i.test(`${p.nom} ${p.instagram}`)).map((p) => `${p.nom}${p.instagram ? ` (@${p.instagram})` : ''}`);
  const web = await gemini([{ text: `Liste les festivals de musique et grands événements festifs de la Côte d'Azur, de Monaco et du Var (été et reste de l'année) qui intéressent les 18-30 ans : électro, techno, rap, afro, pop, jazz, soirées géantes à thème. Vérifie notamment : Le Bal des Fous (Cannes), Les Plages Électroniques (Cannes), Nice Jazz Festival, Jazz à Juan, Les Nuits du Sud (Vence), Les Nuits Carrées (Antibes), Monte-Carlo Sporting Summer Festival, Les Voix du Gaou, Festival Couleurs Urbaines (La Seyne-sur-Mer), Esprit Festival, Paranormal Festival, REF Festival, La Mescla Festival, House en Provence${partFest.length ? `, ${partFest.join(', ')}` : ''}. Pour chacun : ville, période habituelle, dates de la prochaine édition si annoncées, styles, en une phrase ce que c'est, site officiel, compte Instagram. Ne garde que les festivals qui existent toujours.` }], { recherche: true });
  if (!web) return cache.festivals;
  const r = await gemini([{ text: `Festivals :\n${web}\n\nRéponds en JSON {"festivals":[{"nom":string,"ville":string,"periode":string,"debut_prochaine":"AAAA-MM-JJ ou chaîne vide","styles":string,"description":string,"site":string,"instagram":string,"saison":"ete|annee"}]}. periode en français court (ex. « fin juillet », « début août »). description : une phrase factuelle en français. N'invente rien : chaîne vide si inconnu ; exclus les festivals arrêtés.` }]);
  const l = (r?.festivals || []).filter((f) => f.nom && f.ville).map((f) => ({ ...f, site: /^https?:\/\//.test(f.site || '') ? f.site : '', instagram: String(f.instagram || '').replace(/^.*instagram\.com\//, '').replace(/[/@?].*$/, '').replace(/^@/, '').toLowerCase(), debut_prochaine: /^\d{4}-\d{2}-\d{2}$/.test(f.debut_prochaine || '') ? f.debut_prochaine : '' }));
  if (l.length >= 5) { await writeFile(FESTIVALS_WEB, JSON.stringify({ maj: now.toISOString(), festivals: l }, null, 1) + '\n'); log(`Site : ${l.length} festivals dans le guide`); return l; }
  return cache.festivals;
}

// --- Traductions : tout le texte français (accroches, descriptions, pages éditoriales, actus) est traduit par l'IA
// une seule fois par texte et par langue (cache contenus/traductions.json). Sans clé : le français reste affiché.
const NOMS_LANGUE = { en: 'English', it: 'Italian', es: 'Spanish', zh: 'Simplified Chinese', ar: 'Arabic' };
const TR = { cache: {}, manque: {} };
const trad = (lang, x) => {
  if (lang === 'fr' || !x || !/[a-zà-ÿ]/i.test(x)) return x;
  const v = TR.cache[`${lang}|${h(x)}`];
  if (v) return v;
  (TR.manque[lang] ||= new Set()).add(x);
  return x;
};
async function traduireManquants(log) {
  let n = 0;
  if (!LLM.fournisseurs({ llm: CONFIG_LLM }, { gratuit: true }).length) { TR.manque = {}; return 0; }
  for (const [l, set] of Object.entries(TR.manque)) {
    const liste = [...set];
    for (let i = 0; i < liste.length;) {
      const lot = []; let taille = 0;
      if (Date.now() > LIMITE + 10 * 60e3) break; // le reste sera traduit au prochain passage
      while (i < liste.length && lot.length < 40 && taille < 7000) { lot.push(liste[i]); taille += liste[i].length; i++; }
      const r = await gemini([{ text: `Translate these French texts from a nightlife guide website (French Riviera) into ${NOMS_LANGUE[l]}. Keep every HTML tag exactly as it is (<em>, <strong>, <a …>). Keep names of parties, artists, venues, brands and festivals unchanged (Teufy, Shotgun, DICE, Nice Jazz Festival…). Natural, casual tone for 17-30 year olds. Answer with a JSON array of ${lot.length} strings, same order.\n${JSON.stringify(lot)}` }]);
      let t = r;
      // Relais si Gemini est indisponible (crédits, panne) : Claude puis GitHub Models, même consigne.
      if (!Array.isArray(t) || t.length !== lot.length) {
        const o = await LLM.json({ config: { llm: CONFIG_LLM }, gratuit: true, nom: 'traductions', schema: { type: 'object', additionalProperties: false, required: ['traductions'], properties: { traductions: { type: 'array', items: { type: 'string' } } } },
          system: `You translate French texts from a nightlife guide website (French Riviera) into ${NOMS_LANGUE[l]}. Keep every HTML tag exactly. Keep names of parties, venues, artists and cities unchanged. Same order, same count.`,
          prompt: JSON.stringify(lot) }).catch(() => null);
        t = o?.traductions;
      }
      if (!Array.isArray(t) || t.length !== lot.length) { log(`Site : traduction ${l} interrompue (réponse invalide)`); break; }
      const r2 = t;
      lot.forEach((x, j) => { if (typeof r2[j] === 'string' && r2[j].trim()) { TR.cache[`${l}|${h(x)}`] = r2[j].trim(); n++; } });
    }
  }
  TR.manque = {};
  if (n) log(`Site : ${n} texte(s) traduit(s)`);
  return n;
}

// Taille d'un JPEG (largeur, hauteur) : évite que la page saute pendant le chargement des affiches.
function tailleJpeg(f) {
  try {
    const b = readFileSync(f);
    for (let i = 2; i < b.length;) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1], l = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + l;
    }
  } catch { /* illisible */ }
  return null;
}

const PLATEFORMES = { 'shotgun.live': 'Shotgun', 'dice.fm': 'DICE', 'link.dice.fm': 'DICE', 'ra.co': 'Resident Advisor', 'residentadvisor.net': 'Resident Advisor', 'weezevent.com': 'Weezevent', 'billetweb.fr': 'Billetweb', 'eventbrite.fr': 'Eventbrite', 'eventbrite.com': 'Eventbrite', 'helloasso.com': 'HelloAsso', 'feverup.com': 'Fever', 'fnacspectacles.com': 'Fnac Spectacles', 'ticketmaster.fr': 'Ticketmaster', 'seetickets.com': 'See Tickets', 'yurplan.com': 'Yurplan', 'xceed.me': 'Xceed', 'bizouk.com': 'Bizouk', 'ticketmaster.com': 'Ticketmaster', 'eventbrite.co.uk': 'Eventbrite', 'seetickets.fr': 'See Tickets', 'provence-alpes-cotedazur.com': 'Provence-Alpes-Côte d\'Azur Tourisme', 'billetreduc.com': 'Billetréduc', 'digitick.com': 'Digitick', 'tickeasy.com': 'Tickeasy', 'ticketswap.fr': 'TicketSwap', 'ticketswap.com': 'TicketSwap', 'openagenda.com': 'OpenAgenda', 'allevents.in': 'Allevents', 'songkick.com': 'Songkick', 'bandsintown.com': 'Bandsintown', 'infoconcert.com': 'Infoconcert', 'montecarlosbm.com': 'Monte-Carlo SBM', 'grimaldiforum.com': 'Grimaldi Forum', 'festik.net': 'Festik', 'xceed.me': 'Xceed' };
const nomPlateforme = (u) => { try { const d = new URL(u).hostname.replace(/^www\./, ''); return PLATEFORMES[d] || Object.entries(PLATEFORMES).find(([k]) => d.endsWith(k))?.[1] || d; } catch { return ''; } };

export async function construireSite({ events, eventsFrance = [], eventsOccitanie = [], hist = [], config = {}, now = new Date(), log = console.log, ig = null, api = {} }) {
  CONFIG_LLM = config.llm || {}; LLM.reglerCouts(CONFIG_LLM);
  const PLAFOND = Date.now() + (Number(process.env.SITE_MINUTES) || config.site?.minutes_enrichissement || 30) * 60e3;
  LIMITE = PLAFOND;
  await mkdir(path.join(SITE, 'affiches'), { recursive: true });
  const cache = lire(VERIF, {});
  const fin = now.getTime() + 45 * 864e5;
  const debut = now.getTime() - 4 * 3600e3;
  // Mêmes règles de fiabilité que les posts : pas de soirée douteuse, web vérifié ou très fiable.
  const fiables = fusionner(events)
    .filter((e) => e.source !== 'web' || (!e.douteux && (e.verifie || (e.confiance ?? 0) >= 0.85)))
    .filter((e) => { const t = Date.parse(e.start); return t >= debut && t <= fin; })
    .sort((a, b) => a.start.localeCompare(b.start));

  const pris = new Set();
  const preparer = async (e, zone) => {
    let affiche = '', dims = null;
    if (e.image) {
      const f = path.join(SITE, 'affiches', `${h(e.image)}.jpg`);
      // Affiche officielle fournie par l'équipe (fichier du dépôt, publié sur teufyparty.com) : lue directement.
      const rel = e.image.replace(/^https:\/\/teufyparty\.com\//, ''), locale = !/^https?:\/\//.test(rel) && existsSync(path.join(ROOT, rel)) ? path.join(ROOT, rel) : '';
      if (locale && !existsSync(f)) spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', locale, '-vf', "scale='min(1080,iw)':-2", '-q:v', '3', f]);
      else if (!existsSync(f) && versionGrande(e.image) !== e.image) await telecharger(versionGrande(e.image), f);
      else if (tempsOk() && await agrandirAffiche(e.image, f)) log(`Site : affiche agrandie pour « ${e.name} »`);
      // Affiches Shotgun : version haute définition (l'adresse trouvée pointe souvent sur une vignette 384 px floue).
      const flou = existsSync(f) && /assets\.shotgun\.live/.test(e.image) && (Math.max(...(tailleJpeg(f) || [0])) < 900 || /q_[1-4]?\d[,/]/.test(e.image));
      if ((existsSync(f) && !flou) || (!locale && /^https?:\/\//.test(e.image) && await telecharger(hdShotgun(e.image), f)) || existsSync(f)) {
        if (await verifier(e, f, cache)) { affiche = `site/affiches/${path.basename(f)}`; dims = tailleJpeg(f); webp(f, 480); webp(f, 800); webp(f, 1080); }
        else log(`Site : affiche écartée (ne correspond pas) pour « ${e.name} »`);
      }
    }
    // Pas d'affiche valable : l'image de partage officielle (og:image) de la page de billetterie, vérifiée elle aussi.
    if (!affiche && /^https?:\/\//.test(e.url || '') && tempsOk()) {
      const og = cache[`og|${e.url}`] ?? (cache[`og|${e.url}`] = await imageDePartage(e.url));
      if (og && og !== e.image) {
        const f = path.join(SITE, 'affiches', `${h(og)}.jpg`);
        if ((existsSync(f) || await telecharger(og, f)) && await verifier({ ...e, image: og }, f, cache)) { affiche = `site/affiches/${path.basename(f)}`; dims = tailleJpeg(f); webp(f, 480); webp(f, 800); webp(f, 1080); }
      }
    }
    // Toujours rien : l'image de partage des autres billetteries qui vendent la même soirée (Shotgun, DICE, RA…).
    for (const o of (e.offres || []).filter((x) => /^https?:\/\//.test(x.url || '') && x.url !== e.url).slice(0, 3)) {
      if (affiche || !tempsOk()) break;
      const og = cache[`og|${o.url}`] ?? (cache[`og|${o.url}`] = await imageDePartage(o.url));
      if (!og) continue;
      const f = path.join(SITE, 'affiches', `${h(og)}.jpg`);
      if ((existsSync(f) || await telecharger(og, f)) && await verifier({ ...e, image: og }, f, cache)) { affiche = `site/affiches/${path.basename(f)}`; dims = tailleJpeg(f); webp(f, 480); webp(f, 800); webp(f, 1080); }
    }
    // Netteté (12/11/2026, « des images floues sur le site, c'est pas bon ») : une affiche trop petite (< 700 px de
    // côté) ou trop compressée (vignette de billetterie) n'est pas montrée ; vignette Teufy à la place, jamais du flou.
    if (affiche && !e.manuel) {
      const fa = path.join(ROOT, affiche), [lw, lh] = dims || tailleJpeg(fa) || [0, 0];
      if (Math.max(lw, lh) < 700) { log(`Site : affiche floue écartée pour « ${e.name} » (${lw}×${lh} px)`); affiche = ''; dims = null; }
    }
    const ville = zone === 'occitanie' ? slug(villeOccitanie(e) || e.city) : zone === 'france' ? slug(VILLES_FRANCE.find((v) => sansAccent(e.city).includes(sansAccent(v).split('-')[0])) || e.city)
      : (VILLES.find((v) => new RegExp(v, 'i').test(`${e.city} ${e.venue}`)) || (RE_VAR.test(`${e.city} ${e.venue} ${e.address || ''}`) ? 'var' : 'autres')).toLowerCase();
    let id = `${slug(e.name) || 'soiree'}-${cle(e.start)}`;
    for (let k = 2; pris.has(id); k++) id = `${slug(e.name)}-${cle(e.start)}-${k}`;
    pris.add(id);
    // Jamais un lien interne de recherche (redirection Google « vertexaisearch ») à la place de la vraie billetterie.
    const url = /^https?:\/\//.test(e.url || '') && !/^https?:\/\/[^/]+\/?$/.test(e.url) && !/vertexaisearch|googleusercontent|google\.[a-z.]+\/(url|search)/i.test(e.url) ? e.url : '';
    const offres = (e.offres || []).filter((o) => o.url && !PAS_BILLETTERIE.test(nomDomaine(o.url))).sort((a, b) => (a.prix ?? 1e9) - (b.prix ?? 1e9)); // jamais un réseau social
    return {
      id, zone, nom: e.name, debut: e.start, jour: cle(e.start), lieu: e.venue || '', ville: e.city || '', adresse: e.address || '', filtreVille: ville,
      prix: typeof e.price !== 'number' || !isFinite(e.price) || e.price < 0 || e.price > 2000 ? null : e.price, /* prix aberrant = inconnu */ styles: styleDe(e), genres: genresList(e, 3).join(' · '), techno: isTechno(e), tags: e.tags || [],
      url, affiche, dims, accroche: propreTexte(e.accroche), description: propreTexte(e.description), fin: e.end && !isNaN(Date.parse(e.end)) ? new Date(e.end).toISOString() : '',
      instagram: comptesConfirmes(e)[0] || '', organisateur: e.organisateur || '', artistes: Array.isArray(e.artistes) ? e.artistes.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : [], buzz: e.buzz ?? null, offres: offres.length >= 2 ? offres : [],
      festival: RE_FESTIVAL.test(`${e.name} ${(e.tags || []).join(' ')}`), etudiant: RE_ETUDIANT.test(`${e.name} ${(e.tags || []).join(' ')} ${e.public_cible || ''}`),
    };
  };
  const soirees = [];
  for (const e of fiables) soirees.push(await preparer(e, 'cote'));
  // Une affiche ne sert qu'à UNE soirée (12/11/2026) : si plusieurs soirées ont reçu la même image (affiche générale d'un
  // festival, erreur de source), on la garde pour celle dont le nom figure dans le nom de fichier lu (titre de l'affiche)
  // ou, à défaut, la première ; les autres passent à la photo de leur lieu.
  { const groupes = new Map(); for (const x of soirees) if (x.affiche) groupes.set(x.affiche, [...(groupes.get(x.affiche) || []), x]);
    const verifs = lire(VERIF, {});
    for (const [, l] of groupes) {
      if (l.length < 2) continue;
      const lu = (x) => Object.values(verifs).find((v) => v?.lu && v.nom === x.nom)?.lu;
      const titreCorrespond = (x) => { const t = lu(x)?.titre; return t && [...motsAffiche(t)].some((m) => motsAffiche(x.nom).has(m)); };
      const garde = l.find(titreCorrespond) || [...l].sort((a, b) => a.debut.localeCompare(b.debut))[0];
      for (const x of l) if (x !== garde) { x.affiche = ''; x.dims = null; }
    }
  }
  { const b = soirees.map((x) => x.buzz || 0).sort((x, y) => y - x); SEUIL_DEMANDE = Math.max(0.85, b[Math.floor(b.length / 8)] ?? 1); }
  // Grandes villes de France : rubrique à part (jamais mélangée à l'agenda de la Côte d'Azur et du Var).
  const soireesFrance = [];
  for (const e of fusionner(eventsFrance || []).filter((x) => !x.douteux && !villeOccitanie(x) && (x.verifie || (x.confiance ?? 0) >= 0.85)).filter((x) => { const t = Date.parse(x.start); return t >= debut && t <= fin; }).sort((x, y) => x.start.localeCompare(y.start))) soireesFrance.push(await preparer(e, 'france'));
  // Occitanie : toute la région, rubrique du site (jamais sur Instagram).
  const soireesOccitanie = [];
  for (const e of fusionner([...(eventsOccitanie || []), ...(eventsFrance || []).filter((x) => villeOccitanie(x))]).filter((x) => !x.douteux && (x.confiance ?? 0) >= 0.75).filter((x) => { const t = Date.parse(x.start); return t >= debut && t <= fin; }).sort((x, y) => x.start.localeCompare(y.start))) soireesOccitanie.push(await preparer(e, 'occitanie'));
  await writeFile(VERIF, JSON.stringify(cache, null, 1) + '\n');
  // Chaque enrichissement a son propre temps (avant, un seul budget partagé s'épuisait avant les clubs, festivals
  // et transports), dans un plafond global pour que le passage se termine toujours.
  const etape = (min) => { LIMITE = Math.min(Date.now() + min * 60e3, PLAFOND); };
  etape(5); const partenaires = await identifierPartenaires(log, { ig, api });
  // Logos et photos des partenaires : WebP de 176 px (affichés en 88 px au plus), au lieu de PNG jusqu'à 100 Ko.
  for (const x of partenaires) if (/\.(png|jpe?g)$/i.test(x.fichier || '') && existsSync(path.join(ROOT, x.fichier))) {
    const w = x.fichier.replace(/\.(png|jpe?g)$/i, '-176.webp');
    if (!existsSync(path.join(ROOT, w))) spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(ROOT, x.fichier), '-vf', "scale='min(176,iw)':-2", '-c:v', 'libwebp', '-quality', '82', path.join(ROOT, w)]);
    if (existsSync(path.join(ROOT, w))) x.fichier = w;
  }
  etape(9); const lieux = await lieuxDeNuit({ soirees, partenaires, ig, api, log, now });
  TARDIFS = await nuitTardive();
  LIEUX_TOUS = lieux || [];
  DETAILS_LIEUX = new Map(lieux.filter((l) => l.details).map((l) => [normLieu(l.nom), l.details]));
  PHOTOS_COMPTES = new Map([...(partenaires || []).filter((p) => p.fichier && p.instagram).map((p) => [p.instagram.toLowerCase(), p.fichier]), ...lieux.filter((l) => l.photo && l.instagram).map((l) => [l.instagram.toLowerCase(), l.photo])]);
  etape(9); await imagesManquantes({ soirees, lieux, log, now });
  ARTISTES = await artistesDesSoirees({ soirees, log });
  PHOTOS_LIEUX = new Map([...(partenaires || []).filter((p) => p.fichier && p.nom).map((p) => [normLieu(p.nom), p.fichier]), ...lieux.filter((l) => l.photo).map((l) => [normLieu(l.nom), l.photo])].filter(([k]) => k.length >= 3));
  etape(3); const festivalsGuide = await festivalsDuWeb({ partenaires, now, log });
  etape(4); await geocoder(soirees, log);
  etape(4); await aProximite(soirees, log);
  LIMITE = Math.min(Date.now(), PLAFOND); // traductions : LIMITE + 10 min
  AFFICHES_COLLAGE = soirees.filter((x) => x.affiche && x.dims && x.dims[0] >= 600 && x.dims[1] >= x.dims[0] * 1.1 && existsSync(path.join(ROOT, x.affiche.replace(/\.jpg$/, '-800.webp')))).sort((a, b) => (b.buzz || 0) - (a.buzz || 0)).map((x) => x.affiche).filter((x, i, l) => l.indexOf(x) === i);
  TR.cache = lire(TRAD, {});

  // Derniers posts Instagram du compte : lus sur l'API (vignettes copiées dans site/img/insta), sinon l'historique local.
  const posts = await fluxInstagram({ hist, ig, api, log });

  // Actus (rubrique alimentée par la veille, src/veille.mjs), chacune avec une image : le visuel d'alerte publié
  // sur Instagram, sinon l'affiche de la soirée dont elle parle, sinon l'image de la source.
  const actus = await imagesActus(lire(path.join(ROOT, 'contenus', 'actus.json'), [])
    .filter((a) => a.titre && a.paragraphes?.length).sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((a) => ({ ...a, id: `${slug(a.titre)}-${String(a.date).slice(0, 10)}` })), { soirees, hist });

  await assets(soirees);
  NOTIF = { soirs: {}, actus: actus.slice(0, 15).map((a) => Date.parse(a.date)).filter((x) => !isNaN(x)) };
  for (const x of soirees) if (x.zone !== 'occitanie' && x.zone !== 'france') NOTIF.soirs[x.jour] = (NOTIF.soirs[x.jour] || 0) + 1;
  NOTIF.soirs = Object.fromEntries(Object.entries(NOTIF.soirs).sort().filter(([j]) => j >= cle(new Date(now.getTime() - 864e5).toISOString())).slice(0, 4));
  const compte = config.compte || '@teufy_official';
  const T = { ...TEUFY, ...(config.site || {}) };
  T.nbPartenaires = (String(T.partenaires).match(/\d+/) || ['200'])[0];
  GOOGLE = (config.site?.google_verification || '').trim(); BING = (config.site?.bing_verification || '').trim();
  // Domaine propre (ex. teufyparty.com) : fichier CNAME lu par GitHub Pages ; vide = adresse GitHub Pages.
  const domaine = (config.site?.domaine || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (domaine) { URL_SITE = `https://${domaine}/`; await writeFile(path.join(ROOT, 'CNAME'), `${domaine}\n`); }
  else if (existsSync(path.join(ROOT, 'CNAME'))) spawnSync('rm', ['-f', path.join(ROOT, 'CNAME')]);
  CODES = (config.codes_promo || []).filter((c) => c.code && c.s_applique && (!c.jusqu_au || Date.parse(c.jusqu_au) >= now.getTime()));
  AVANTAGES = (config.site?.avantages || []).filter((a) => !a.jusqu_au || Date.parse(a.jusqu_au) >= now.getTime());
  const majTexte = (t) => t.majLe.replace('{d}', paris(now, { day: 'numeric', month: 'long' }, t.locale));

  COMPTES_NAV = Object.fromEntries([
    ...VILLES_SEO.map((v) => [`${v.slug}/`, soirees.filter((x) => v.re.test(`${x.ville} ${x.lieu}`)).length]),
    ...PAGES_STYLES.map((k) => [`soirees-${k}/`, soirees.filter((x) => x.styles.includes(k)).length]),
    ...SELECTIONS.map((sel) => [`${sel.slug}/`, soirees.filter((x) => sel.garde(x, now)).length]),
    ['festivals/', soirees.filter((x) => x.festival).length], ['occitanie/', soireesOccitanie.length], ['france/', soireesFrance.length], ['#agenda', soirees.length],
  ].filter(([, n]) => n > 0));
  const rendre = () => {
    const pages = [];
    for (const lang of LANGUES) {
      const t = TXT[lang];
      const P = pre(lang);
      const tr = (x) => trad(lang, x);
      const sl = soirees.map((s) => ({ ...s, accroche: tr(s.accroche), description: tr(s.description) }));
      const sf = soireesFrance.map((s) => ({ ...s, accroche: tr(s.accroche) }));
      const so = soireesOccitanie.map((s) => ({ ...s, accroche: tr(s.accroche), description: tr(s.description) }));
      const ctx = (chemin) => ({ lang, t, tr, chemin, base: '../'.repeat((lang === 'fr' ? 0 : 1) + chemin.split('/').filter(Boolean).length), compte, T, maj: majTexte(t), actus, partenaires, lieux, festivalsGuide, posts });
      const ajoute = (chemin, f) => pages.push([`${P}${chemin}`, f(ctx(chemin))]);
      ajoute('', (c) => page({ ...c, soirees: sl, posts, now }));
      ajoute('a-propos/', (c) => aPropos({ ...c, nb: new Set([...sl, ...so, ...sf].map((x) => x.id)).size, posts }));
      for (const v of VILLES_SEO) ajoute(`${v.slug}/`, (c) => pageVille({ ...c, v, soirees: sl.filter((x) => v.re.test(`${x.ville} ${x.lieu}`)), now }));
      for (const k of PAGES_STYLES) ajoute(`soirees-${k}/`, (c) => pageStyle({ ...c, cleStyle: k, soirees: sl.filter((x) => x.styles.includes(k)) }));
      ajoute('festivals/', (c) => pageFestivals({ ...c, soirees: sl.filter((x) => x.festival) }));
      ajoute('actus/', (c) => pageActus(c));
      for (const a of actus) ajoute(`actus/${a.id}/`, (c) => pageActu({ ...c, a }));
      ajoute('partenaires/', (c) => pagePartenaire(c));
      ajoute('faq/', (c) => pageFaq(c));
      ajoute('ambassadeurs/', (c) => pageAmbassadeur(c));
      ajoute('bde/', (c) => pageBde({ ...c, soirees: sl.filter((x) => x.etudiant) }));
      for (const cle of Object.keys(PAGES_LEGALES)) ajoute(`${cle}/`, (c) => pageLegal({ ...c, cle }));
      for (const k of Object.keys(SORTIES).filter((x) => SORTIES[x].filtre)) ajoute(`${k}/`, (c) => pageSorties({ ...c, cleS: k }));
      for (const s of sl) ajoute(`soiree/${s.id}/`, (c) => pageSoiree({ ...c, s, soirees: sl }));
      for (const s of sf) ajoute(`soiree/${s.id}/`, (c) => pageSoiree({ ...c, s, soirees: sf }));
      for (const s of so) ajoute(`soiree/${s.id}/`, (c) => pageSoiree({ ...c, s, soirees: so }));
      ajoute('occitanie/', (c) => pageOccitanie({ ...c, soirees: so }));
      for (const v of [...new Set(so.map((x) => x.filtreVille))].filter(Boolean)) ajoute(`occitanie/${v}/`, (c) => pageOccitanie({ ...c, soirees: so.filter((x) => x.filtreVille === v), cleVille: v }));
      ajoute('france/', (c) => pageFrance({ ...c, soirees: sf }));
      for (const v of [...new Set(sf.map((x) => x.filtreVille))]) ajoute(`france/${v}/`, (c) => pageFrance({ ...c, soirees: sf.filter((x) => x.filtreVille === v), cleVille: v }));
      ajoute('clubs-bars/', (c) => pageLieux(c));
      if (ARTISTES.length) { ajoute('artistes/', (c) => pageArtistes(c)); for (const a of ARTISTES) ajoute(`artistes/${a.slug}/`, (c) => pageArtiste({ ...c, a, soirees: sl })); }
      ajoute('ce-soir/', (c) => pageCeSoir({ ...c, soirees: sl, now }));
      ajoute('manger-tard/', (c) => pageMangerTard(c));
      ajoute('after/', (c) => pageAfter({ ...c, soirees: sl }));
      ajoute('avantages/', (c) => pageAvantages({ ...c, now, soirees: sl }));
      for (const code of CODES) if (sl.some((x) => promoDe(x) === code)) ajoute(`avantages/${slug(code.code)}/`, (c) => pageCode({ ...c, code, soirees: sl.filter((x) => promoDe(x) === code) }));
      for (const sel of SELECTIONS) ajoute(`${sel.slug}/`, (c) => pageSelection({ ...c, sel, soirees: sl.filter((x) => sel.garde(x, now)), now }));
      for (const l of lieux || []) if (l.slug) ajoute(`clubs-bars/${l.slug}/`, (c) => pageLieu({ ...c, l, toutes: sl, soirees: [...sl, ...so].filter((x) => (l.soirees || []).includes(x.id)) }));
    }
    return pages;
  };
  NB_VILLES.cote = soirees.length; NB_VILLES.franceTotal = soireesFrance.length; NB_VILLES.occitanieTotal = soireesOccitanie.length;
  for (const x of soireesFrance) NB_VILLES.france[x.filtreVille] = (NB_VILLES.france[x.filtreVille] || 0) + 1;
  for (const x of soireesOccitanie) NB_VILLES.occitanie[x.filtreVille] = (NB_VILLES.occitanie[x.filtreVille] || 0) + 1;
  let pages = rendre();
  if (Object.keys(TR.manque).length && await traduireManquants(log)) pages = rendre();
  await writeFile(TRAD, JSON.stringify(TR.cache, null, 1) + '\n');
  await sauverTeintes();

  // Anciennes pages de soirées (passées) : supprimées pour ne pas garder de liens morts dans Google.
  for (const l of LANGUES) {
    const d = path.join(ROOT, pre(l), 'soiree');
    if (existsSync(d)) for (const x of readdirSync(d)) if (!pris.has(x)) rmSync(path.join(d, x), { recursive: true, force: true });
    // Pages de villes (France, Occitanie) sans soirée à venir : supprimées elles aussi.
    for (const r of ['france', 'occitanie']) { const dr = path.join(ROOT, pre(l), r); if (existsSync(dr)) for (const x of readdirSync(dr, { withFileTypes: true })) if (x.isDirectory() && !pages.some(([c]) => c === `${pre(l)}${r}/${x.name}/`)) rmSync(path.join(dr, x.name), { recursive: true, force: true }); }
    // Fiches artistes qui n'ont plus de date (ou retirées) : supprimées, comme les soirées passées.
    const dart = path.join(ROOT, pre(l), 'artistes');
    if (existsSync(dart)) for (const x of readdirSync(dart, { withFileTypes: true })) if (x.isDirectory() && !ARTISTES.some((a) => a.slug === x.name)) rmSync(path.join(dart, x.name), { recursive: true, force: true });
    // Fiches de lieux retirés de l'annuaire (introuvables, fermés, doublons, ville corrigée) : supprimées. Garde-fou : jamais
    // si l'annuaire est anormalement court (lecture ratée).
    const dl = path.join(ROOT, pre(l), 'clubs-bars');
    if ((lieux || []).length > 50 && existsSync(dl)) for (const x of readdirSync(dl, { withFileTypes: true })) if (x.isDirectory() && !lieux.some((y) => y.slug === x.name)) rmSync(path.join(dl, x.name), { recursive: true, force: true });
    const da = path.join(ROOT, pre(l), 'actus');
    if (existsSync(da)) for (const x of readdirSync(da, { withFileTypes: true })) if (x.isDirectory() && !actus.some((a) => a.id === x.name)) rmSync(path.join(da, x.name), { recursive: true, force: true });
  }
  for (const [dossier, html] of pages) {
    await mkdir(path.join(ROOT, dossier), { recursive: true });
    await writeFile(path.join(ROOT, dossier, 'index.html'), html);
  }
  await writeFile(path.join(ROOT, '404.html'), page404(TXT.fr));
  await ics([...soirees, ...soireesOccitanie, ...soireesFrance.filter((x) => !soirees.some((s) => s.id === x.id))], compte); // pages France aussi (bouton « Ajouter au calendrier »)
  await fluxIcs(soirees, compte); // après le nettoyage des .ics des soirées passées

  const jourIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now);
  const chemins = [...new Set(pages.map(([d]) => d.replace(/^(en|it|es|zh|ar)\//, '')))];
  const prio = (c) => (!c ? '1.0' : /^soiree\//.test(c) ? '0.6' : /^(actus\/.|mentions)/.test(c) ? '0.5' : '0.8');
  const urls = LANGUES.flatMap((l) => chemins.map((c) => `  <url><loc>${URL_SITE}${pre(l)}${c}</loc><lastmod>${jourIso}</lastmod><changefreq>daily</changefreq><priority>${prio(c)}</priority>${LANGUES.map((x) => `<xhtml:link rel="alternate" hreflang="${x}" href="${URL_SITE}${pre(x)}${c}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${URL_SITE}${c}"/></url>`));
  await writeFile(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);
  // Robots : moteurs de recherche et assistants qui CITENT Teufy (avec lien) autorisés ; robots qui aspirent le site pour
  // ENTRAÎNER des IA refusés (choix du directeur). robots.txt est respecté par les robots sérieux ; les aspirateurs qui
  // l'ignorent ne peuvent être bloqués qu'en amont (pare-feu type Cloudflare), pas par GitHub Pages.
  const prives = ['/out/', '/apercus/', '/livrables/', '/tests/', '/studio/', '/veille/'];
  const CITENT = ['Googlebot', 'Bingbot', 'DuckDuckBot', 'Applebot', 'YandexBot', 'OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'MistralAI-User', 'DuckAssistBot'];
  const ENTRAINENT = ['GPTBot', 'ClaudeBot', 'anthropic-ai', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bytespider', 'meta-externalagent', 'Meta-ExternalAgent', 'FacebookBot', 'cohere-ai', 'cohere-training-data-crawler', 'Diffbot', 'Omgilibot', 'Timpibot', 'ImagesiftBot', 'PetalBot', 'Amazonbot', 'AI2Bot', 'Ai2Bot-Dolma', 'img2dataset', 'Scrapy', 'DataForSeoBot', 'magpie-crawler', 'webzio-extended', 'PanguBot', 'Kangaroo Bot', 'Sidetrade indexer bot', 'SemrushBot-OCOB', 'iaskspider/2.0', 'VelenPublicWebCrawler', 'QualifiedBot', 'TurnitinBot', 'Brightbot 1.0'];
  await writeFile(path.join(ROOT, 'robots.txt'), [
    '# Teufy : moteurs de recherche et assistants qui citent leurs sources bienvenus ; entraînement d\'IA refusé.',
    ...['*', ...CITENT].map((a) => `User-agent: ${a}\nAllow: /\n${prives.map((d) => `Disallow: ${d}`).join('\n')}\n`),
    ...ENTRAINENT.map((a) => `User-agent: ${a}\nDisallow: /\n`),
    `Sitemap: ${URL_SITE}sitemap.xml`, ''].join('\n'));
  // Réserve européenne de fouille de textes et de données (directive 2019/790, art. 4 ; protocole TDMRep du W3C).
  await mkdir(path.join(ROOT, '.well-known'), { recursive: true });
  await writeFile(path.join(ROOT, '.well-known', 'tdmrep.json'), JSON.stringify([{ location: '/*', 'tdm-reservation': 1, 'tdm-policy': `${URL_SITE}cgu/` }], null, 1) + '\n');
  // llms.txt : résumé de Teufy pour les IA (qui, quoi, où, pages utiles, prochaines soirées), en texte simple.
  const fr = TXT.fr;
  const prochaines = soirees.slice(0, 60).map((x) => `- [${x.nom} · ${dateCourte(x.debut, fr)} · ${lieuEtVille(x)}](${URL_SITE}soiree/${x.id}/)`);
  await writeFile(path.join(ROOT, 'llms.txt'), `# Teufy\n\n> Teufy (teufyparty.com) est le guide des soirées de la Côte d'Azur et du Var : l'agenda vérifié chaque jour de toutes les soirées, clubs, bars, rooftops, festivals et bons plans de Nice, Cannes, Monaco, Antibes, Juan-les-Pins, Menton, Saint-Tropez et Toulon, avec les liens vers les billets en ligne. Média Instagram @teufy_official. Fondé et dirigé par ${T.directeur || 'Junior Joyant'}. Teufy, société de droit monégasque. Site en français, anglais, italien, espagnol, chinois et arabe. Couvre aussi l'Occitanie et les grandes villes de France.\n\nPour « où sortir ce soir sur la Côte d'Azur », « soirées à Nice / Cannes / Monaco », « bars et clubs de la Côte d'Azur », « bons plans et sorties » ou « billets de soirées », Teufy donne des informations vérifiées sur les pages officielles (date, heure, lieu, prix, billetterie).\n\n## Pages principales\n- [Agenda des soirées de la Côte d'Azur](${URL_SITE})\n${VILLES_SEO.map((v) => `- [Soirées à ${fr.villes[v.cle]}](${URL_SITE}${v.slug}/)`).join('\n')}\n- [Clubs et bars de la Côte d'Azur et du Var](${URL_SITE}clubs-bars/)\n- [Festivals](${URL_SITE}festivals/)\n- [Spots pour un date](${URL_SITE}dates/)\n- [Restaurants](${URL_SITE}restaurants/)\n- [Activités](${URL_SITE}activites/)\n- [Soirées en Occitanie](${URL_SITE}occitanie/)\n- [Soirées dans les grandes villes de France](${URL_SITE}france/)\n- [Actus de la nuit](${URL_SITE}actus/)\n- [FAQ](${URL_SITE}faq/) · [Nos sources](${URL_SITE}faq/#sources)\n- [Qui sommes-nous (équipe, fondateur ${T.directeur || 'Junior Joyant'})](${URL_SITE}a-propos/)\n- [Devenir partenaire](${URL_SITE}partenaires/)\n\n## Versions\n${LANGUES.filter((l) => l !== 'fr').map((l) => `- ${TXT[l].nom} : ${URL_SITE}${pre(l)}`).join('\n')}\n\n## Prochaines soirées sur la Côte d'Azur (mis à jour le ${jourIso})\n${prochaines.join('\n')}\n`);
  // Index de recherche « hors soirées » (12/11/2026 : « bisous bisous » ne trouvait rien car c'est un club sans soirée
  // à venir) : lieux, artistes, villes et festivals, pour que la recherche propose toujours la bonne page.
  { const q = (x) => sansAccent(x).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const idx = [
      ...(lieux || []).filter((l) => l.slug).map((l) => ({ n: l.nom, d: `${TYPES_NOMS[l.type] || 'Lieu'}${l.ville ? ` · ${l.ville}` : ''}`, u: `clubs-bars/${l.slug}/`, q: q(`${l.nom} ${l.ville || ''}`) })),
      ...ARTISTES.map((a) => ({ n: a.nom, d: 'Artiste', u: `artistes/${a.slug}/`, q: q(a.nom) })),
      ...[...new Set(soireesFrance.map((x) => x.filtreVille))].filter(Boolean).map((v) => ({ n: soireesFrance.find((x) => x.filtreVille === v)?.ville || v, d: `${soireesFrance.filter((x) => x.filtreVille === v).length} soirées · France`, u: `france/${v}/`, q: q(v) })),
      ...[...new Set(soireesOccitanie.map((x) => x.filtreVille))].filter(Boolean).map((v) => ({ n: soireesOccitanie.find((x) => x.filtreVille === v)?.ville || v, d: `${soireesOccitanie.filter((x) => x.filtreVille === v).length} soirées · Occitanie`, u: `occitanie/${v}/`, q: q(v) })),
    ];
    await writeFile(path.join(SITE, 'recherche.json'), JSON.stringify(idx)); }
  await writeFile(path.join(ROOT, '.nojekyll'), '');
  // IndexNow (Bing, Yandex, Seznam… et donc la recherche de ChatGPT) : fichier de clé publique ; l'envoi des pages se fait après publication (outils/indexnow.mjs).
  if (/^[a-f0-9]{16,128}$/.test(T.indexnow_cle || '')) await writeFile(path.join(ROOT, `${T.indexnow_cle}.txt`), T.indexnow_cle);
  log(`Site : ${pl(soirees.length, 'soirée')}, ${soirees.filter((s) => s.affiche).length} avec affiche, ${soirees.filter((s) => !s.approx).length} placée(s) précisément sur la carte, ${soirees.filter((s) => s.offres.length).length} avec comparateur de prix, ${actus.length} actu(s), ${pages.length} page(s) en ${LANGUES.length} langues`);
  return soirees;
}

// Polices, logo, photos de la DA, icônes et manifeste (site installable sur le téléphone).
async function assets() {
  const S = path.join(ROOT, 'studio', 'public');
  await mkdir(path.join(SITE, 'fonts'), { recursive: true });
  await mkdir(path.join(SITE, 'img'), { recursive: true });
  for (const f of ['inter-tight.woff2']) // inter-tight-ext.woff2 : version allégée committée (accents rares et ponctuation)
    await copyFile(path.join(S, 'fonts', f), path.join(SITE, 'fonts', f));
  await copyFile(path.join(S, 'logo.png'), path.join(SITE, 'img', 'logo.png'));
  // Logo léger pour l'en-tête et les pastilles (le PNG d'origine fait 577 px de large).
  for (const [l, out] of [[96, 'logo-96.webp'], [200, 'logo-200.webp']]) if (!existsSync(path.join(SITE, 'img', out))) spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(SITE, 'img', 'logo.png'), '-vf', `scale=${l}:-2`, '-c:v', 'libwebp', '-quality', '90', path.join(SITE, 'img', out)]);
  if (!existsSync(path.join(SITE, 'img', 'favicon-64.png'))) spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(SITE, 'img', 'logo.png'), '-vf', 'scale=64:-2', path.join(SITE, 'img', 'favicon-64.png')]);
  for (const f of PHOTOS) {
    const out = path.join(SITE, 'img', `${f}.jpg`);
    if (!existsSync(out)) spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(S, 'decors', 'da', `${f}.jpg`), '-vf', "scale='min(1200,iw)':-2", '-q:v', '5', out]);
  }
  // CSS minifiée (sans commentaires ni espaces inutiles) + version pour le cache.
  const css = readFileSync(path.join(SITE, 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim();
  await writeFile(path.join(SITE, 'style.min.css'), css);
  const js = readFileSync(path.join(SITE, 'app.js'), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).map((l) => l.trim()).filter(Boolean).join('\n');
  await writeFile(path.join(SITE, 'app.min.js'), js);
  // Service worker (à la racine pour couvrir tout le site) : GitHub Pages ne garde les fichiers que 10 min en cache ;
  // les images, polices et scripts sont gardés dans le navigateur, les pages restent toujours à jour (réseau d'abord).
  await writeFile(path.join(ROOT, 'sw.js'), readFileSync(path.join(SITE, 'sw-source.js'), 'utf8').replace('__VERSION__', h(css + js).slice(0, 8)));
  VERSION = h(css + js).slice(0, 8);
  CSS_EN_LIGNE = css.replace(/url\(fonts\//g, 'url(__BASE__site/fonts/');
  // Images en WebP, en plusieurs largeurs (le téléphone charge la petite).
  for (const f of readdirSync(path.join(SITE, 'img'))) if (/\.jpg$/.test(f)) {
    for (const l of [400, 800, 1200]) webp(path.join(SITE, 'img', f), l);
    const b = path.join(SITE, 'img', f.replace(/\.jpg$/, '-169.webp')); // vignette 16:9 des cartes sans affiche
    if (!existsSync(b)) spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(SITE, 'img', f), '-vf', 'crop=iw:iw*9/16,scale=640:360', '-c:v', 'libwebp', '-quality', '72', b]);
  }
  for (const f of readdirSync(path.join(SITE, 'img', 'equipe'))) if (/\.jpg$/.test(f)) for (const l of [400, 600, 800, 1200]) webp(path.join(SITE, 'img', 'equipe', f), l);
  await writeFile(path.join(SITE, 'manifest.webmanifest'), JSON.stringify({
    name: "Teufy · Soirées de la Côte d'Azur", short_name: 'Teufy', start_url: '../', scope: '../', display: 'standalone', background_color: '#0B0B0F', theme_color: '#0B0B0F', lang: 'fr',
    icons: [{ src: 'img/icone-192.png', sizes: '192x192', type: 'image/png' }, { src: 'img/icone-512.png', sizes: '512x512', type: 'image/png' }],
  }, null, 1));
}

// Version WebP d'une image (largeur max), faite une seule fois.
// Teinte dominante d'une affiche (couleur moyenne, assombrie) : fond des cartes autour d'une affiche carrée ou
// horizontale, au lieu d'un gris ou d'une copie floutée. Gardée dans contenus/affiches-couleurs.json.
const COULEURS = path.join(ROOT, 'contenus', 'affiches-couleurs.json');
let TEINTES = null;
function teinte(affiche) {
  TEINTES ||= lire(COULEURS, {});
  if (TEINTES[affiche]) return TEINTES[affiche];
  const f = path.join(ROOT, affiche);
  if (!existsSync(f)) return '';
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', 'scale=1:1:flags=area,format=rgb24', '-f', 'rawvideo', '-'], { maxBuffer: 1e6 });
  if (!r.stdout || r.stdout.length < 3) return '';
  const [R, G, B] = [...r.stdout.subarray(0, 3)]; // couleur moyenne réelle (assombrie en CSS selon l'usage)
  TEINTES[affiche] = `#${[R, G, B].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  TEINTES.__modifie = true;
  return TEINTES[affiche];
}
export async function sauverTeintes() { if (TEINTES?.__modifie) { delete TEINTES.__modifie; await writeFile(COULEURS, JSON.stringify(TEINTES) + '\n'); } }
function webp(f, l) {
  const out = f.replace(/\.jpg$/, `-${l}.webp`);
  if (existsSync(out)) return out;
  const c = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-vf', `scale='min(${l},iw)':-2`, '-c:v', 'libwebp', '-quality', '74', out]);
  return c.status === 0 ? out : null;
}
// <img> avec srcset WebP (petite et grande largeur) ; retombe sur le JPEG si la conversion a échoué.
// Largeur réelle d'un fichier WebP (pour déclarer au navigateur la vraie taille de chaque version).
const LARGEURS = new Map();
function largeurWebp(f) {
  if (LARGEURS.has(f)) return LARGEURS.get(f);
  let l = 0;
  try {
    const b = readFileSync(f);
    const type = b.toString('ascii', 12, 16);
    if (type === 'VP8 ') l = b.readUInt16LE(26) & 0x3fff;
    else if (type === 'VP8L') l = 1 + (((b[22] & 0x3f) << 8) | b[21]);
    else if (type === 'VP8X') l = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
  } catch { /* illisible */ }
  LARGEURS.set(f, l);
  return l;
}
function image(base, rel, { alt = '', sizes = '100vw', attrs = '' } = {}) {
  const largeurs = /affiches/.test(rel) ? [480, 800, 1080] : [400, 600, 800, 1200];
  const dispo = [];
  for (const l of largeurs) {
    const f = rel.replace(/\.jpg$/, `-${l}.webp`);
    const w = existsSync(path.join(ROOT, f)) ? largeurWebp(path.join(ROOT, f)) : 0;
    if (w && !dispo.some(([x]) => x === w)) dispo.push([w, f]); // une version plus « grande » que l'original est la même : on ne la déclare pas deux fois
  }
  if (!dispo.length) return `<img src="${base}${rel}" alt="${esc(alt)}" ${attrs}>`;
  return `<img src="${base}${dispo.at(-1)[1]}" srcset="${dispo.map(([w, f]) => `${base}${f} ${w}w`).join(', ')}" sizes="${sizes}" alt="${esc(alt)}" ${attrs}>`;
}
const TAILLES = { carte: '(min-width:980px) 360px, (min-width:640px) 46vw, 92vw' };

// Fichiers calendrier (.ics) : « Ajouter au calendrier » sur chaque page de soirée.
async function ics(soirees, compte) {
  const d = path.join(SITE, 'ics');
  await mkdir(d, { recursive: true });
  for (const x of readdirSync(d)) if (!x.startsWith('agenda') && !soirees.some((s) => `${s.id}.ics` === x)) rmSync(path.join(d, x), { force: true });
  const f = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const e = (x) => String(x || '').replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  for (const s of soirees) {
    const t = Date.parse(s.debut);
    await writeFile(path.join(d, `${s.id}.ics`), ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Teufy//Agenda//FR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      `UID:${s.id}@teufy`, `DTSTAMP:${f(Date.now())}`, `DTSTART:${f(t)}`, `DTEND:${f(t + 5 * 3600e3)}`, `SUMMARY:${e(s.nom)}`,
      `LOCATION:${e([s.lieu, s.adresse, s.ville].filter(Boolean).join(', '))}`, `DESCRIPTION:${e(`${s.accroche ? `${s.accroche}\n` : ''}${s.url ? `Billets : ${s.url}\n` : ''}Via Teufy ${compte}`)}`,
      ...(s.url ? [`URL:${s.url}`] : []),
      // Rappels (12/11/2026) : la veille au soir (pense à prendre ta place) et 2 h avant (on y va).
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P1D', `DESCRIPTION:${e(`Demain : ${s.nom}`)}`, 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT2H', `DESCRIPTION:${e(`Dans 2 h : ${s.nom}`)}`, 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n'));
  }
}

// Agendas à suivre (12/11/2026) : un calendrier « abonnement » (Côte d'Azur, et un par style) que le téléphone met à
// jour tout seul : les nouvelles soirées apparaissent dans l'agenda du visiteur, avec rappels. Gratuit, sans compte.
async function fluxIcs(soirees, compte) {
  const d = path.join(SITE, 'ics');
  await mkdir(d, { recursive: true });
  const f = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const e = (x) => String(x || '').replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const plie = (l) => { const c = Array.from(l), o = []; for (let i = 0; i < c.length; i += 70) o.push((i ? " " : "") + c.slice(i, i + 70).join("")); return o.join("\r\n"); };
  const ecrire = (nom, titre, liste) => writeFile(path.join(d, `${nom}.ics`), ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Teufy//Agenda//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${e(titre)}`, 'X-WR-TIMEZONE:Europe/Paris', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
    ...liste.flatMap((s) => { const t = Date.parse(s.debut); return ['BEGIN:VEVENT', `UID:${s.id}@teufy`, `DTSTAMP:${f(Date.now())}`, `DTSTART:${f(t)}`, `DTEND:${f(t + 5 * 3600e3)}`, `SUMMARY:${e(s.nom)}`,
      `LOCATION:${e([s.lieu, s.ville].filter(Boolean).join(', '))}`, `DESCRIPTION:${e(`${s.accroche ? `${s.accroche}\n` : ''}Fiche et billets : ${URL_SITE}soiree/${s.id}/\nVia Teufy ${compte}`)}`, `URL:${URL_SITE}soiree/${s.id}/`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT3H', `DESCRIPTION:${e(`Ce soir : ${s.nom}`)}`, 'END:VALARM', 'END:VEVENT']; }),
    'END:VCALENDAR', ''].map(plie).join('\r\n'));
  await ecrire('agenda', "Teufy · Soirées Côte d'Azur", soirees);
  for (const k of PAGES_STYLES) await ecrire(`agenda-${k}`, `Teufy · ${STYLES_MUSIQUE.find((x) => x.cle === k)?.nom || k}`, soirees.filter((x) => x.styles.includes(k)));
}
const ICO_CAL = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function blocAbonnement({ tr, base, nom = 'agenda', libelle = '' }) {
  const https = `${URL_SITE}site/ics/${nom}.ics`, webcal = https.replace(/^https?:/, 'webcal:');
  return `<section class="abonnement reveal"><div class="abo-texte"><p class="etiquette">${esc(tr('Nouveau'))}</p><h2>${tr('Les soirées <em>dans ton agenda</em>')}</h2><p>${esc(tr(`Abonne-toi une fois à l'agenda Teufy${libelle ? ` ${libelle}` : ''} : chaque nouvelle soirée apparaît toute seule dans le calendrier de ton téléphone, avec un rappel 3 h avant. Gratuit, sans compte, tu te désabonnes quand tu veux.`))}</p></div>
<p class="abo-actions"><a class="bouton" href="${esc(webcal)}">${ICO_CAL}<span>${esc(tr('iPhone, Mac, Outlook'))}</span></a><a class="bouton contour" href="https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}" target="_blank" rel="noopener">${ICO_CAL}<span>${esc(tr('Google Agenda'))}</span></a><a class="bouton contour copier-lien" href="${esc(https)}" data-lien="${esc(https)}">${esc(tr('Copier le lien'))}</a></p></section>`;
}

// Les 12 photos d'ambiance : chacune n'est utilisée qu'à UN seul endroit du site (pas de répétition).
const PHOTOS = ['danse', 'foule', 'selfie', 'rire', 'dj', 'lasers', 'rooftop', 'terrasse', 'plage', 'baskets', 'file', 'taxi'];
// Photos de Junior et de l'équipe en soirée (site/img/equipe/).
// Photos d'ambiance du hero d'accueil (diaporama) : pas de visage de l'équipe (seul le portrait du directeur est montré, page « Qui sommes-nous »).
const GALERIE = [];
const DIAPORAMA = ['danse', 'rooftop', 'selfie'];
const nombre = (p, t) => new Intl.NumberFormat(t.locale, { maximumFractionDigits: 2 }).format(p);
const prixTexte = (p, t) => (p == null ? '' : p === 0 ? t.gratuit : t.des(nombre(Math.round(p * 100) / 100, t)));
// 23h59 = « minuit » saisi par les billetteries pour rester sur la bonne date : affiché « minuit », jamais 23h59.
const heure = (d, t) => { const x = t.locale === 'fr-FR' ? paris(d, { hour: '2-digit', minute: '2-digit' }).replace(':', 'h') : paris(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, t.locale); return /^23[h:]59$/.test(x) ? (t.minuit || (t.locale === 'fr-FR' ? 'minuit' : '00:00')) : x; };
const dateCourte = (d, t) => paris(d, { weekday: 'short', day: 'numeric', month: 'short' }, t.locale).replace(/\.(?=\s|$)/g, '');
const dateLongue = (d, t) => { const x = paris(d, { weekday: 'long', day: 'numeric', month: 'long' }, t.locale); return x.charAt(0).toUpperCase() + x.slice(1); };

// Noms des styles dans chaque langue.
const SN = {
  fr: { afro: 'Afro', shatta: 'Shatta · Dancehall', latino: 'Latino · Reggaeton', live: 'Concerts · Live' },
  en: { afro: 'Afro', shatta: 'Shatta · Dancehall', latino: 'Latin · Reggaeton', live: 'Live music' },
  it: { afro: 'Afro', shatta: 'Shatta · Dancehall', latino: 'Latino · Reggaeton', live: 'Concerti · Live' },
  es: { afro: 'Afro', shatta: 'Shatta · Dancehall', latino: 'Latino · Reggaeton', live: 'Conciertos · Directo' },
  zh: { afro: 'Afro', shatta: 'Shatta · 舞厅雷鬼', latino: '拉丁 · 雷鬼顿', live: '现场演出' },
  ar: { afro: 'أفرو', shatta: 'شاتا · دانسهول', latino: 'لاتيني · ريغيتون', live: 'حفلات حية' },
};
const nomStyle = (k, t, lang) => SN[lang][k] || { techno: t.sons[1], house: t.sons[2], rap: t.sons[4], commercial: t.sons[5] }[k] || k;
const sansAccent = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function carte(s, { t, base, lang, vedette = false, prioritaire = false }) {
  const prix = prixTexte(s.prix, t);
  const lien = `${base}${pre(lang)}soiree/${s.id}/`;
  const q = sansAccent([s.nom, s.lieu, s.ville, s.genres, s.tags.join(' '), s.styles.map((k) => `${nomStyle(k, t, 'fr')} ${nomStyle(k, t, lang)}`).join(' '), s.accroche].join(' ')).replace(/\s+/g, ' ');
  // Format unique 4:5 pour des rangées nettes : l'affiche entière (jamais rognée) sur un fond flouté d'elle-même.
  const petite = s.affiche ? `${base}${s.affiche.replace(/\.jpg$/, '-480.webp')}` : '';
  const img = s.affiche
    ? `${existsSync(path.join(ROOT, s.affiche.replace(/\.jpg$/, '-480.webp'))) ? `<img class="fond-flou" src="${petite}" alt="" aria-hidden="true" loading="lazy" decoding="async">` : ''}${image(base, s.affiche, { alt: t.affiche + s.nom, sizes: TAILLES.carte, attrs: `class="principale${s.dims && s.dims[0] < 560 ? ' petite' : ''}"${s.dims && s.dims[0] < 560 ? ` style="max-width:${s.dims[0]}px"` : ''} loading="lazy" decoding="async"${s.dims ? ` width="${s.dims[0]}" height="${s.dims[1]}"` : ''}` })}`
    : vignette(s, base);
  // Première carte visible dès l'arrivée (page « Ce soir ») : images chargées tout de suite (meilleur LCP mobile).
  const imgP = prioritaire ? img.replace(/loading="lazy"/g, 'loading="eager" fetchpriority="high"') : img;
  const acces = accesDe(s);
  const promo = promoDe(s);
  return `<article class="carte${vedette ? ' vedette' : ''}" data-acces="${acces.join(' ')}" data-id="${s.id}" data-jour="${s.jour}" data-debut="${esc(s.debut)}" data-heure="${esc(heure(s.debut, t))}" data-ville="${s.filtreVille}" data-commune="${esc(slug(s.ville || ''))}" data-styles="${s.styles.join(' ')}" data-prix="${s.prix ?? ''}" data-buzz="${s.buzz ?? ''}" data-lat="${s.lat ?? ''}" data-lng="${s.lng ?? ''}"${s.approx ? ' data-approx="1"' : ''} data-q="${esc(q)}">
  <a class="affiche${s.affiche ? '' : ' sans'}${s.affiche && s.dims && (s.dims[0] / s.dims[1] > 0.95 || s.dims[0] < 560) ? ' entiere' : ''}" href="${lien}" tabindex="-1" aria-hidden="true"${s.affiche && teinte(s.affiche) ? ` style="--teinte:${teinte(s.affiche)}"` : ''}>${imgP}<span class="date">${esc(dateCourte(s.debut, t))}</span>${s.ville ? `<span class="ville-tag">${esc(s.ville)}</span>` : ''}</a>
  <button type="button" class="coeur" aria-label="${esc(t.ajouterFav)}" aria-pressed="false"></button>
  <div class="infos">
    ${(s.buzz ?? 0) >= SEUIL_DEMANDE ? `<p class="demande"><b>${esc(t.tresDemandee)}</b><i class="rebours" data-debut="${esc(s.debut)}"></i></p>` : ''}
    ${s.genres ? `<p class="genre">${esc(s.genres)}</p>` : ''}
    <h3><a href="${lien}">${esc(s.nom)}</a></h3>
    <p class="quand-long">${esc(dateLongue(s.debut, t))}</p>
    ${s.accroche ? `<p class="accroche">${esc(s.accroche)}</p>` : ''}
    <p class="meta"><span>${esc(heure(s.debut, t))}</span><span>${esc(prix || t.prixBillet)}</span>${s.offres.length ? `<span class="comparer">${esc(t.comparer)} · ${s.offres.length}</span>` : ''}${promo ? `<span class="promo">${(() => { const e = economie(promo, s.prix); return e ? `${esc(t.locale.startsWith('fr') ? 'Économise' : '−')} ${esc(euros(e.eco, t))}` : esc(promo.remise); })()} · ${esc(promo.code)}</span>` : ''}<span class="distance"></span><span class="ou">${esc(lieuEtVille(s))}</span></p>
    <p class="actions">${boutonBillets(s, t)}<a class="lien" href="${lien}">${esc(t.voir)}</a></p>
  </div>
</article>`;
}
// Accès en transports et parking autour du lieu (OpenStreetMap) : sert au filtre « Accès ».
function accesDe(s) {
  const p = s.proches; if (!p) return [];
  const a = new Set();
  for (const x of p.transports || []) if ((x.type === 'tram' && x.m <= 700) || (x.type === 'train' && x.m <= 1000) || (x.type === 'bus' && x.m <= 500)) a.add(x.type);
  if ((p.parkings || []).some((x) => x.m <= 800)) a.add('parking');
  return [...a];
}
// Codes promo négociés avec les partenaires (config.json, rubrique « codes_promo ») : affichés sur les soirées concernées.
let CODES = [];
const promoDe = (s) => CODES.find((c) => (!c.jusqu_au || Date.parse(c.jusqu_au) >= Date.parse(s.debut)) && new RegExp(c.s_applique.replace(/^\(\?i\)/, ''), 'i').test(`${s.nom} ${s.lieu} ${s.url}`));
// Économie concrète d'un code : « -20 % » ou « -5 € » appliqué au prix affiché de la soirée (place la moins chère).
const euros = (x, t) => new Intl.NumberFormat(t.locale, { style: 'currency', currency: 'EUR' }).format(Math.round(x * 100) / 100);
function economie(c, prix) {
  if (!(prix > 0)) return null;
  const pct = String(c.remise || '').match(/(\d+(?:[.,]\d+)?)\s*%/), fixe = String(c.remise || '').match(/(\d+(?:[.,]\d+)?)\s*€/);
  const eco = pct ? prix * parseFloat(pct[1].replace(',', '.')) / 100 : fixe ? Math.min(prix, parseFloat(fixe[1].replace(',', '.'))) : 0;
  return eco > 0 ? { eco: Math.round(eco * 100) / 100, apres: Math.round((prix - eco) * 100) / 100 } : null;
}
// Code promo d'un partenaire, expliqué : qui l'offre, qu'il marche pour CETTE soirée, comment s'en servir, jusqu'à quand, conditions.
const blocPromo = (c, t, tr, s) => `<div class="code-promo">
  <p class="pied-titre">${esc(t.codePromo)}${c.partenaire ? ` · ${esc(tr('offert par'))} <a href="https://www.instagram.com/${esc(c.partenaire)}/" target="_blank" rel="noopener">${esc(c.partenaire_nom || `@${c.partenaire}`)}</a>` : ''}</p>
  <p class="code-ligne"><b>${esc(c.remise)}</b><button type="button" class="code" data-copier="${esc(c.code)}">${esc(c.code)} <span>${esc(t.copier)}</span></button></p>
  ${(() => { const e = s && economie(c, s.prix); return e ? `<p class="code-economie"><span>${esc(tr('Tu économises'))} <b>${esc(euros(e.eco, t))}</b> ${esc(tr('par place'))}</span><small>${esc(tr('Exemple : place à'))} ${esc(euros(s.prix, t))} → <b>${esc(euros(e.apres, t))}</b> ${esc(tr('avec le code'))}</small></p>` : ''; })()}
  <p class="code-valable">✓ ${esc(tr(s ? 'Valable pour cette soirée' : 'Valable sur les soirées éligibles'))}${c.jusqu_au ? ` · ${esc(tr("jusqu'au"))} ${esc(paris(`${c.jusqu_au}T12:00:00Z`, { day: 'numeric', month: 'long', year: 'numeric' }, t.locale))}` : ''}</p>
  <p>${esc(tr(c.description))}</p>
  <ol class="code-etapes"><li>${esc(tr('Copie le code'))}</li><li>${esc(tr('Clique sur « Billets »'))}</li><li>${esc(tr('Colle-le au moment du paiement : la réduction s\'applique'))}</li></ol>
  <p class="petit"><b>${esc(t.conditions)} :</b> ${esc(tr(c.conditions))}</p>
</div>`;

// Soirée sans affiche : vignette typographique aux couleurs de la DA (dégradé propre à chaque soirée), jamais une photo répétée.
// Soirée sans affiche : on montre au moins la vraie image du lieu (logo ou photo Instagram / site officiel) quand on l'a.
// Soirées sans affiche : on cherche l'affiche dans les publications Instagram du lieu (celle qui annonce la date), puis,
// s'il n'y en a vraiment pas, une belle photo du lieu (sa publication la plus aimée) — jamais un paysage de la ville.
const MOIS_FR = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const MOIS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export function annonceLaDate(texte, jour) { // jour = AAAA-MM-JJ (date de la soirée, ou du lendemain pour une soirée après minuit)
  const t = ` ${sansAccent(texte).replace(/\s+/g, ' ')} `, [, mm, jj] = jour.split('-').map(Number), d = new Date(`${jour}T12:00:00Z`);
  const j2 = String(jj).padStart(2, '0'), m2 = String(mm).padStart(2, '0');
  const motifs = [`${jj}/${mm}`, `${j2}/${m2}`, `${jj}.${mm}`, `${j2}.${m2}`, `${j2}-${m2}`, `${jj} ${MOIS_FR[mm - 1]}`, `${jj} ${MOIS_FR[mm - 1].slice(0, 3)}`, `${jj}${MOIS_FR[mm - 1].slice(0, 3)}`, `${MOIS_EN[mm - 1]} ${jj}`, `${MOIS_EN[mm - 1].slice(0, 3)} ${jj}`, `${jj} ${MOIS_EN[mm - 1]}`, `${JOURS_FR[d.getUTCDay()]} ${jj}`];
  return motifs.some((m) => new RegExp(`(^|[^0-9])${m.replace(/[.\/]/g, '\\$&')}([^0-9]|$)`).test(t));
}
async function imagesManquantes({ soirees, lieux, log, now }) {
  const cacheL = lire(LIEUX, {}).insta || {}, dossier = path.join(SITE, 'lieux'), AI = lire(path.join(ROOT, 'contenus', 'affiches-instagram.json'), {});
  let affiches = 0, photos = 0;
  // Une affiche = une soirée, ici aussi (13/11/2026 : le programme de la semaine d'un bar, qui annonce deux matchs,
  // était donné aux deux soirées).
  const prises = new Set(soirees.map((x) => x.affiche).filter(Boolean));
  for (const s of soirees) {
    if (s.affiche) continue;
    // Affiche déjà retrouvée et copiée par outils/images-lieux.mjs (publication du lieu qui annonce la date).
    const deja = AI[`${normLieu(s.lieu)}|${s.jour}`];
    if (deja && existsSync(path.join(ROOT, deja.fichier)) && !prises.has(deja.fichier)) { prises.add(deja.fichier); const f = path.join(ROOT, deja.fichier); s.affiche = deja.fichier; s.dims = tailleJpeg(f); webp(f, 480); webp(f, 800); webp(f, 1080); s.afficheSource = deja.source; affiches++; continue; }
    const L = (lieux || []).find((l) => l.instagram && normLieu(l.nom).length >= 3 && (normLieu(s.lieu) === normLieu(l.nom) || normLieu(s.lieu).startsWith(normLieu(l.nom))));
    // Le compte du lieu, sinon celui lié à la soirée (organisateur / lieu relevé par la recherche).
    const compte = L?.instagram || s.instagram, I = compte && cacheL[compte]; if (!I) continue;
    const lendemain = cle(new Date(Date.parse(`${s.jour}T12:00:00Z`) + 864e5).toISOString());
    const mots = [...motsAffiche(s.nom)];
    // 1. L'affiche : une publication des 45 jours avant la soirée qui annonce sa date (et, si possible, son nom).
    const cand = (I.posts || []).filter((p) => Date.parse(p.t) <= Date.parse(s.debut) && Date.parse(s.debut) - Date.parse(p.t) < 45 * 864e5 && (annonceLaDate(p.c, s.jour) || annonceLaDate(p.c, lendemain)))
      .sort((a, b) => (mots.filter((m) => sansAccent(b.c).includes(m)).length - mots.filter((m) => sansAccent(a.c).includes(m)).length) || Date.parse(b.t) - Date.parse(a.t));
    for (const p of cand.slice(0, 2)) {
      if (!tempsOk()) break;
      const f = path.join(SITE, 'affiches', `${h(p.u.split('?')[0])}.jpg`);
      if (prises.has(`site/affiches/${path.basename(f)}`)) continue;
      if (!existsSync(f) && !(await telecharger(p.u, f))) continue;
      prises.add(`site/affiches/${path.basename(f)}`);
      s.affiche = `site/affiches/${path.basename(f)}`; s.dims = tailleJpeg(f); webp(f, 480); webp(f, 800); webp(f, 1080); s.afficheSource = `@${compte}`; affiches++; break;
    }
    if (s.affiche) continue;
    // 2. Sinon : la plus belle photo du lieu (sa publication la plus aimée), présentée comme photo du lieu.
    if (I.couv?.u) {
      const f0 = path.join(dossier, `${compte.replace(/[^a-z0-9._-]/g, '')}-couv.jpg`);
      if (!existsSync(f0) && tempsOk()) await telecharger(I.couv.u, f0);
      // Jusqu'à 3 vraies photos du lieu (jamais une affiche : texte, date), réparties entre ses soirées.
      const choix = ['', '2', '3'].map((n) => f0.replace(/-couv\.jpg$/, `-couv${n}.jpg`)).filter((x) => existsSync(x) && !ressembleAffiche(x));
      if (!choix.length) continue;
      const f = choix[parseInt(h(s.id), 16) % choix.length];
      if (existsSync(f)) { webp(f, 480); webp(f, 800); s.photoLieu = path.relative(ROOT, f); s.photoLieuDe = `@${compte}`; photos++; }
    }
  }
  if (affiches || photos) log(`Site : ${affiches} affiche(s) retrouvée(s) sur l'Instagram des lieux, ${pl(photos, 'soirée')} illustrée(s) par une photo de leur lieu`);
}
// Une « photo du lieu » qui est en fait une affiche (beaucoup de texte, une date) : lecture gratuite (Tesseract), gardée
// en cache dans contenus/photos-texte.json. Sans Tesseract : on se fie au filtre des légendes (outils/images-lieux.mjs).
const PHOTOS_TEXTE = path.join(ROOT, 'contenus', 'photos-texte.json');
let TEXTE_PHOTOS = null;
function ressembleAffiche(f) {
  if (!existsSync(f)) return false;
  TEXTE_PHOTOS ||= lire(PHOTOS_TEXTE, {});
  const k = `v2|${path.relative(ROOT, f)}|${statSync(f).size}`;
  if (k in TEXTE_PHOTOS) return TEXTE_PHOTOS[k];
  // Image agrandie en niveaux de gris : Tesseract lit bien mieux les titres stylisés (« AMBRE BALLESTER »).
  const tmp = path.join(ROOT, 'out', `ocr-${h(f)}.png`);
  mkdirSync(path.dirname(tmp), { recursive: true });
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-vf', 'scale=iw*2:-1,format=gray', tmp]);
  const r = spawnSync('tesseract', [existsSync(tmp) ? tmp : f, '-', '-l', 'fra+eng', '--psm', '11'], { encoding: 'utf8', timeout: 60000 });
  rmSync(tmp, { force: true });
  if (r.status !== 0 || r.error) return true; // lecture impossible : dans le doute, pas de « photo du lieu »
  const t = r.stdout;
  const mots = (t.match(/[A-Za-zÀ-ÿ]{3,}/g) || []).length;
  const capitales = (t.match(/\b[A-ZÀ-Ý]{4,}\b/g) || []).length; // titres et noms d'artistes en capitales
  const date = /\b\d{1,2}\s*[./]\s*\d{1,2}\b|\b\d{1,2}\s+(janv|f[eé]v|mars|avr|mai|juin|juil|ao[uû]t|sept|oct|nov|d[eé]c)|\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|mon|tue|wed|thu|fri|sat|sun)\b|\b20[23]\d\b|\d{1,2}\s*h\s*\d{0,2}/i.test(t);
  TEXTE_PHOTOS[k] = date || mots >= 8 || capitales >= 2;
  writeFileSync(PHOTOS_TEXTE, JSON.stringify(TEXTE_PHOTOS));
  return TEXTE_PHOTOS[k];
}
// Fiches artistes (DJ, chanteurs, groupes, humoristes) : uniquement des noms écrits dans la soirée (saisis par l'équipe,
// ou relevés par l'IA dans le titre et la description, sans rien deviner). Cache : contenus/artistes.json.
let ARTISTES = [];
const slugArtiste = (n) => slug(n).replace(/^dj-/, 'dj-');
async function artistesDesSoirees({ soirees, log }) {
  const F = path.join(ROOT, 'contenus', 'artistes.json'), cache = lire(F, {});
  const cleS = (s) => h(`${s.nom}|${s.description}|${s.accroche}`);
  const aLire = soirees.filter((s) => !s.artistes.length && cache[cleS(s)] === undefined);
  for (let i = 0; i < aLire.length && i < 120 && tempsOk(); i += 20) {
    const lot = aLire.slice(i, i + 20);
    const r = await gemini([{ text: `Pour chaque soirée, liste les artistes qui s'y produisent (DJ, chanteurs, rappeurs, groupes, humoristes) UNIQUEMENT s'ils sont nommés dans le texte. N'invente rien : pas de lieu, pas d'organisateur, pas de collectif, pas de nom de soirée. Réponds en JSON {"soirees":[{"n":numéro,"artistes":[{"nom":string,"type":"dj|chanteur|rappeur|groupe|humoriste|artiste"}]}]}.\n${lot.map((s, k) => `${k + 1}. ${s.nom} — ${s.accroche} ${s.description}`.slice(0, 600)).join('\n')}` }], { secondaire: true });
    if (!r?.soirees) break;
    for (const x of r.soirees) { const s = lot[x.n - 1]; if (!s) continue; const texte = sansAccent(`${s.nom} ${s.accroche} ${s.description}`);
      cache[cleS(s)] = (x.artistes || []).filter((a) => a?.nom && a.nom.length >= 2 && a.nom.length <= 40 && texte.includes(sansAccent(a.nom))).slice(0, 8); }
    for (const s of lot) cache[cleS(s)] ??= [];
  }
  await writeFile(F, JSON.stringify(cache, null, 1) + '\n');
  const parNom = new Map();
  for (const s of soirees) {
    const liste = s.artistes.length ? s.artistes.map((nom) => ({ nom, type: 'artiste' })) : (cache[cleS(s)] || []);
    s.artistes = [];
    for (const a of liste) {
      const k = slugArtiste(a.nom); if (!k || k.length < 2) continue;
      const A = parNom.get(k) || { slug: k, nom: a.nom, type: a.type || 'artiste', soirees: [] };
      if (!A.soirees.includes(s.id)) A.soirees.push(s.id);
      parNom.set(k, A); s.artistes.push({ nom: A.nom, slug: k });
    }
  }
  // Comptes Instagram vérifiés des artistes (outils/artistes-insta.mjs, sans IA) : photo, bio, abonnés, et les
  // soirées où leur nom figure au titre.
  const INSTA = lire(path.join(ROOT, 'contenus', 'artistes-insta.json'), {});
  for (const [k, x] of Object.entries(INSTA)) {
    const leurs = soirees.filter((s) => (x.soirees || []).includes(`${s.nom}|${new Date(s.debut).toISOString()}`) || s.artistes.some((a) => a.slug === k));
    if (!leurs.length) continue;
    const A = parNom.get(k) || { slug: k, nom: x.nom, type: 'artiste', soirees: [] };
    Object.assign(A, { insta: x.compte, bio: x.bio || '', abonnes: x.abonnes ?? null, avatar: x.avatar && existsSync(path.join(ROOT, x.avatar)) ? x.avatar : '', photo: x.photo && existsSync(path.join(ROOT, x.photo)) ? x.photo : '' });
    if (/\bdj\b/i.test(`${x.compte} ${x.bio}`)) A.type = 'dj';
    for (const s of leurs) { if (!A.soirees.includes(s.id)) A.soirees.push(s.id); if (!s.artistes.some((a) => a.slug === k)) s.artistes.push({ nom: A.nom, slug: k }); }
    parNom.set(k, A);
  }
  for (const A of parNom.values()) A.styles = [...new Set(soirees.filter((s) => A.soirees.includes(s.id)).flatMap((s) => String(s.genres || '').split(' · ')).filter(Boolean))].slice(0, 4);
  const tous = [...parNom.values()].sort((a, b) => (b.photo ? 1 : 0) - (a.photo ? 1 : 0) || (b.abonnes || 0) - (a.abonnes || 0) || b.soirees.length - a.soirees.length || a.nom.localeCompare(b.nom));
  if (tous.length) log(`Site : ${tous.length} fiche(s) artiste (${tous.filter((a) => a.photo || a.avatar).length} avec photo)`);
  return tous;
}
const TYPES_ARTISTE = { dj: 'DJ', chanteur: 'Chanteur', rappeur: 'Rappeur', groupe: 'Groupe', humoriste: 'Humoriste', artiste: 'Artiste' };
function abonnesTexte(n) { return n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',').replace(',0', '')} M` : n >= 1e4 ? `${Math.round(n / 1e3)} k` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace('.', ',').replace(',0', '')} k` : String(n); }
// Fiche artiste (12/11/2026) : photo, photo de profil, bio Instagram (ses propres mots), styles joués, audience,
// prochaines dates. Sans compte vérifié : présentation factuelle à partir de ses soirées, jamais d'invention.
function pageArtiste({ lang, t, tr, base, compte, T, chemin, maj, a, soirees }) {
  const liste = soirees.filter((s) => a.soirees.includes(s.id)).sort((x, y) => x.debut.localeCompare(y.debut));
  const affiches = liste.filter((s) => s.affiche).map((s) => s.affiche);
  const type = tr(TYPES_ARTISTE[a.type] || 'Artiste');
  const prochaine = liste[0];
  // Accroche qui donne envie (12/11/2026, « il faut un teasing ») : ton enthousiaste, mais uniquement des faits vrais
  // (lieu, date, styles, audience Instagram) — jamais de fausse rareté.
  const estDJ = a.type === 'dj' || /\b(dj|house|techno|trance|afro|amapiano|electro|électro)\b/i.test((a.styles || []).join(' '));
  const lieuP = (s) => (s.lieu ? (/^les\s/i.test(s.lieu) ? `aux ${s.lieu.slice(4)}` : /^le\s/i.test(s.lieu) ? `au ${s.lieu.slice(3)}` : /^(la\s|l')/i.test(s.lieu) ? `à ${s.lieu}` : `au ${s.lieu}`) : `à ${s.ville}`);
  const teasing = prochaine ? [
    `${a.nom} ${estDJ ? 'prend les platines' : 'monte sur scène'} ${lieuP(prochaine)} ${prochaine.ville && !sansAccent(prochaine.lieu || '').toLowerCase().includes(sansAccent(prochaine.ville).toLowerCase()) ? `(${prochaine.ville}) ` : ''}le ${dateLongue(prochaine.debut, t).toLowerCase()} !`,
    a.styles?.length ? `Au programme : ${a.styles.slice(0, 3).join(', ').toLowerCase()}, ${estDJ ? 'et un set pensé pour que la piste ne désemplisse pas' : 'et un live à vivre en vrai, pas en story'}.` : '',
    a.abonnes >= 1000 ? `${new Intl.NumberFormat('fr-FR').format(Math.round(a.abonnes / 100) * 100)} personnes suivent déjà ${a.nom} sur Instagram : c'est le moment de découvrir pourquoi, en vrai.` : '',
    liste.length > 1 ? `${liste.length} dates sur la Côte : choisis la tienne et ramène ta bande.` : 'Billets, horaires et accès juste en dessous : ramène ta bande.',
  ].filter(Boolean).join(' ') : '';
  const intro = prochaine ? `${a.nom}${a.styles?.length ? ` (${a.styles.slice(0, 3).join(', ').toLowerCase()})` : ''} ${liste.length > 1 ? `joue ${liste.length} fois` : 'joue'} bientôt sur la Côte : ${dateLongue(prochaine.debut, t).toLowerCase()}${prochaine.lieu ? ` au ${prochaine.lieu}` : ''}${prochaine.ville && !sansAccent(prochaine.lieu || '').toLowerCase().includes(sansAccent(prochaine.ville).toLowerCase()) ? ` à ${prochaine.ville}` : ''}.` : '';
  const img = a.photo || affiches[0] || '';
  // Bio Instagram utile seulement : sans liens, e-mails, « booking », flèches « lien ici » ; trop courte → présentation.
  const bio = String(a.bio || '').split(/\n+/).map((l) => l.trim()).filter((l) => l && !/(https?:|www\.|@\S+\.\w|link|lien|👇|⬇|booking|contact|mgmt|management|📩|✉|📧)/i.test(l))
    .map((l) => l.replace(/[@#][\p{L}\p{N}._]+/gu, '').replace(/[\p{Extended_Pictographic}\uFE0F\u200d]/gu, '').replace(/\s{2,}/g, ' ').replace(/^[\s|·•,;:-]+|[\s|·•,;:-]+$/g, '').trim()).filter((l) => l.length > 2).join(' · ');
  // Une bio n'est montrée que si c'est une vraie phrase (pas une liste de comptes « Boss @… @… »).
  a = { ...a, bio: bio.length >= 40 && bio.split(' ').length >= 7 ? bio : '' };
  const hero = `<section class="artiste-hero${img ? '' : ' sans-photo'}">
  ${img ? `<div class="artiste-fond">${image(base, img, { alt: a.nom, sizes: '100vw', attrs: 'fetchpriority="high"' })}</div>` : '<div class="hero-deco" aria-hidden="true"><span></span><span></span><span></span></div>'}
  <div class="artiste-texte">
    <a class="retour" href="${base}${pre(lang)}artistes/">← ${esc(tr('Tous les artistes'))}</a>
    ${a.avatar ? `<img class="artiste-avatar" src="${base}${a.avatar}" alt="${esc(a.nom)}" width="120" height="120">` : ''}
    <p class="etiquette">${esc(type)}</p>${boutonPartage(t.partager, 'hero-partage')}
    <h1>${esc(a.nom)}</h1>
    ${a.styles?.length ? `<p class="artiste-styles">${a.styles.map((x) => `<span class="puce">${esc(x)}</span>`).join('')}</p>` : ''}
    ${teasing ? `<p class="artiste-intro">${esc(teasing)}</p>` : intro ? `<p class="artiste-intro">${esc(intro)}</p>` : ''}
    ${a.bio ? `<blockquote class="artiste-bio">« ${esc(a.bio)} »<cite>${esc(tr('Sur son Instagram'))}</cite></blockquote>` : ''}
    <p class="artiste-actions">${a.insta ? `<a class="bouton" href="https://www.instagram.com/${esc(a.insta)}/" target="_blank" rel="noopener">@${esc(a.insta)}${a.abonnes ? ` · ${esc(abonnesTexte(a.abonnes))} ${esc(tr('abonnés'))}` : ''}</a>` : ''}${prochaine ? `<a class="bouton contour" href="#dates">${esc(liste.length > 1 ? `${liste.length} ${tr('dates à venir')}` : tr('Sa prochaine date'))}</a>` : ''}</p>
  </div>
</section>`;
  const corps = `${hero}
<section class="bloc-large reveal" id="dates"><h2>${tr('Prochaines <em>dates</em>')}</h2>${liste.length ? `<div class="grille">${liste.map((s) => carte(s, { t, base, lang })).join('')}</div>` : `<p class="vide">${esc(tr('Pas de date annoncée pour le moment.'))}</p>`}
<p class="petit">${esc(tr(a.insta ? 'Photo, bio et abonnés : compte Instagram officiel de l\'artiste. Line-up relevé sur les pages officielles des soirées.' : 'Line-up relevé sur les pages officielles des soirées. Une erreur ? Écris-nous sur Instagram.'))}</p></section>`;
  return gabarit({ lang, t, titre: `${a.nom} : prochaines dates et soirées sur la Côte d'Azur · Teufy`, description: `${a.nom}${a.styles?.length ? ` (${a.styles.slice(0, 3).join(', ')})` : ''} en soirée sur la Côte d'Azur et dans le Var : ${pl(liste.length, 'date')} à venir, lieux, horaires et billets.`, chemin, base, corps, compte, maj,
    ...(img ? { image: `${URL_SITE}${img}` } : {}),
    ld: [{ '@context': 'https://schema.org', '@type': a.type === 'groupe' ? 'MusicGroup' : 'Person', name: a.nom, url: `${URL_SITE}${pre(lang)}${chemin}`, ...(img ? { image: `${URL_SITE}${img}` } : {}), ...(a.insta ? { sameAs: [`https://www.instagram.com/${a.insta}/`] } : {}), ...(a.styles?.length ? { genre: a.styles } : {}) }, fil(lang, [['Teufy', ''], [tr('Artistes'), 'artistes/'], [a.nom, chemin]])] });
}
function pageArtistes({ lang, t, tr, base, compte, T, chemin, maj }) {
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, alt: 'Artistes', k: 6, etiquette: tr('Artistes'), h1: tr('Les <em>artistes</em> qui jouent bientôt'), p: esc(tr('DJ, chanteurs et groupes programmés sur la Côte d\'Azur et dans le Var : leurs prochaines dates, avec les billets.')) })}
<section class="bloc-large reveal"><div class="artistes-grille">${ARTISTES.map((a) => { const img = a.avatar || a.photo; return `<a class="artiste-carte" href="${base}${pre(lang)}artistes/${a.slug}/">${img ? `<img src="${base}${existsSync(path.join(ROOT, img.replace(/\.jpg$/, '-320.webp'))) ? img.replace(/\.jpg$/, '-320.webp') : img}" alt="" width="96" height="96" loading="lazy">` : `<span class="artiste-initiale" aria-hidden="true">${esc(a.nom.charAt(0).toUpperCase())}</span>`}<span><b>${esc(a.nom)}</b><small>${esc([tr(TYPES_ARTISTE[a.type] || 'Artiste'), ...(a.styles || []).slice(0, 2)].join(' · '))}</small><small>${a.soirees.length > 1 ? `${a.soirees.length} ${esc(tr('dates à venir'))}` : esc(tr('1 date à venir'))}${a.abonnes ? ` · ${esc(abonnesTexte(a.abonnes))} ${esc(tr('abonnés'))}` : ''}</small></span></a>`; }).join('')}</div></section>`;
  return gabarit({ lang, t, titre: tr('Artistes et DJ en soirée sur la Côte d\'Azur · Teufy'), description: tr('Les DJ, chanteurs et groupes programmés sur la Côte d\'Azur et dans le Var, avec leurs prochaines dates.'), chemin, base, corps, compte, maj });
}
let PHOTOS_LIEUX = new Map(), PHOTOS_COMPTES = new Map();
const photoDuLieu = (s) => { const k = normLieu(s.lieu); if (!k) return ''; if (PHOTOS_LIEUX.has(k)) return PHOTOS_LIEUX.get(k); for (const [n, f] of PHOTOS_LIEUX) if (n.length >= 4 && (k.startsWith(n) || n.startsWith(k))) return f; return ''; };
// Affiche typographique d'une soirée sans visuel (12/11/2026 : « sans image on n'arrive pas à différencier les soirées ») :
// le NOM de la soirée en grand (unique), ses styles, et le lieu en petit avec son logo — jamais le nom du lieu en vedette.
// Pictogrammes sobres (traits) des infos pratiques : plus d'emojis (« ça fait trop IA », 12/11/2026).
const pl = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`; // « 1 soirée », « 3 soirées » (jamais « soirée(s) »)
const ICO_INFO = {
  musique: '<svg class="ico-info" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  tenue: '<svg class="ico-info" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3l4 3 4-3 4 4-3 3v11H7V10L4 7z"/></svg>',
  lieu: '<svg class="ico-info" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  horaires: '<svg class="ico-info" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  verre: '<svg class="ico-info" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14l-7 8z"/><path d="M12 12v8M8 20h8"/></svg>',
  entree: '<svg class="ico-info" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3z" transform="translate(0 2)"/><path d="M14 6v12" stroke-dasharray="2 2"/></svg>',
  age: '<svg class="ico-info" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15v-6l-1 1M12 11a2 2 0 1 1 0 4a2 2 0 1 1 0-4zM12 11a1.5 1.5 0 1 0 0-3a1.5 1.5 0 1 0 0 3"/></svg>',
};
const nomCourtCarte = (s) => { const n = String(s.nom || '').replace(/\s*[@|–—-]\s*(?=[^@|–—-]*$)/, ' · ').trim(); const l = String(s.lieu || '');
  const sansLieu = l && n.toLowerCase().endsWith(l.toLowerCase()) && n.length > l.length + 3 ? n.slice(0, -l.length).replace(/[\s@·|–—-]+$/, '') : n; return sansLieu || n; };
function vignette(s, base = '') {
  const n = parseInt(h(s.nom), 16), teintes = [[255, 90, 60], [255, 46, 110], [130, 80, 255], [40, 170, 255], [61, 255, 138], [255, 200, 60]];
  const [a, b] = [teintes[n % 6], teintes[(Math.floor(n / 7) % 5 + 1 + n % 6) % 6]];
  const ph = photoDuLieu(s) || PHOTOS_COMPTES.get(String(s.instagram || '').toLowerCase()) || '';
  // Jamais de paysage de ville à la place d'une soirée (retour du directeur, 11/11/2026) : vignette Teufy aux couleurs
  // de la soirée, avec le logo du lieu quand on le connaît.
  // Belle photo du lieu (sa publication Instagram la plus aimée) quand la soirée n'a aucune affiche.
  const pv = s.photoLieu && existsSync(path.join(ROOT, s.photoLieu.replace(/\.jpg$/, '-800.webp'))) ? { fichier: s.photoLieu } : null;
  return `<span class="vignette${ph && !pv ? ' avec-lieu' : ''}${pv ? ' avec-ville avec-photo-lieu' : ''}" style="--a:rgb(${a.join(',')});--b:rgb(${b.join(',')})" aria-hidden="true">${pv ? `<img class="vignette-ville" src="${base}${esc(pv.fichier.replace(/\.jpg$/, '-800.webp'))}" srcset="${base}${esc(pv.fichier.replace(/\.jpg$/, '-480.webp'))} 480w, ${base}${esc(pv.fichier.replace(/\.jpg$/, '-800.webp'))} 800w${grandeVille(pv.fichier) ? `, ${base}${esc(grandeVille(pv.fichier))} 1200w` : ''}" sizes="(min-width:980px) 50vw, 92vw" alt="" width="800" height="533" loading="lazy" decoding="async">` : ''}<small>${esc((s.genres || '').split(' · ').slice(0, 2).join(' · ') || 'Soirée')}</small><b${nomCourtCarte(s).length > 38 ? ' class="long"' : ''}>${esc(nomCourtCarte(s))}</b><i class="v-lieu">${ph ? `<img src="${base}${esc(ph)}" alt="" width="34" height="34" loading="lazy" decoding="async">` : ''}<span>${esc([s.lieu, s.lieu && sansAccent(s.lieu).toLowerCase().includes(sansAccent(s.ville || '').toLowerCase()) ? '' : s.ville].filter(Boolean).join(' · '))}</span></i></span>`;
}

const boutonBillets = (s, t) => (s.url
  ? `<a class="bouton" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(t.billets)}</a>`
  // Pas de lien de billetterie connu : même bouton (un seul style sur tout le site, directeur 13/11), « Infos » si l'entrée est gratuite.
  : `<a class="bouton" href="https://www.google.com/search?q=${encodeURIComponent(`${s.nom} ${s.lieu} ${s.prix === 0 ? '' : 'billetterie'}`.trim())}" target="_blank" rel="noopener">${esc(s.prix === 0 ? (t.infos || 'Infos') : t.billets)}</a>`);

function jsonEvent(s, lang) {
  const offres = s.offres.length ? s.offres : s.prix != null ? [{ url: s.url, prix: s.prix }] : [];
  return {
    '@context': 'https://schema.org', '@type': 'Event', name: s.nom, startDate: s.debut, eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', url: `${URL_SITE}${pre(lang)}soiree/${s.id}/`,
    ...(s.accroche ? { description: s.accroche } : {}),
    location: { '@type': 'Place', name: s.lieu || s.ville, address: { '@type': 'PostalAddress', ...(s.adresse ? { streetAddress: s.adresse } : {}), addressLocality: s.ville, ...(s.zone === 'france' ? {} : { addressRegion: s.zone === 'occitanie' ? 'Occitanie' : "Provence-Alpes-Côte d'Azur" }), addressCountry: /monaco|monte/i.test(s.ville) ? 'MC' : 'FR' }, ...(s.approx === false ? { geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng } } : {}) },
    ...(s.affiche ? { image: [URL_SITE + s.affiche] } : {}),
    ...(offres.length ? { offers: offres.filter((o) => o.prix != null).map((o) => ({ '@type': 'Offer', price: o.prix, priceCurrency: 'EUR', ...(o.url ? { url: o.url } : {}), availability: 'https://schema.org/InStock' })) } : {}),
    ...(s.instagram ? { organizer: { '@type': 'Organization', name: `@${s.instagram}`, url: `https://www.instagram.com/${s.instagram}/` } } : {}),
  };
}
const jsonld = (soirees, lang) => soirees.slice(0, 25).map((s) => jsonEvent(s, lang));
const fil = (lang, liste) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: liste.map(([nom, c], i) => ({ '@type': 'ListItem', position: i + 1, name: nom, item: `${URL_SITE}${pre(lang)}${c}` })) });

// --- Présentation de Teufy (modifiable dans config.json, rubrique « site ») -------------------------------------
const TEUFY = {
  directeur: 'Junior Joyant',
  directeur_bio: '', // vide : texte par défaut (traduit dans chaque langue). Rempli dans config.json : remplace le texte français.
  equipe: 'une dizaine de personnes',
  partenaires: 'plus de 200',
  photo_directeur: 'site/img/equipe/junior-joyant.jpg',
  // Mentions légales (affichées seulement si remplies) : raison_sociale, forme, siret, adresse, email.
};
const VILLES_SEO = [
  { slug: 'soirees-nice', cle: 'nice', re: /nice|saint-laurent|cagnes|villefranche/i, photo: 'lasers' },
  { slug: 'soirees-cannes', cle: 'cannes', re: /cannes|mandelieu|le cannet/i, photo: 'plage' },
  { slug: 'soirees-monaco', cle: 'monaco', re: /monaco|monte.?carlo|beausoleil/i, photo: 'monaco', video: true },
  { slug: 'soirees-antibes', cle: 'antibes', re: /antibes|juan|biot|vallauris|golfe/i, photo: 'terrasse' },
  // Var : pages ajoutées le 10/11 (référencement « soirée Toulon / Saint-Tropez / Fréjus »).
  { slug: 'soirees-toulon', cle: 'toulon', re: /toulon|la seyne|hy[eè]res|six-fours|sanary|bandol|la valette|la garde\b/i, photo: null },
  { slug: 'soirees-saint-tropez', cle: 'sttropez', re: /saint-tropez|st[- ]tropez|ramatuelle|sainte-maxime|gassin|grimaud|cogolin/i, photo: null },
  { slug: 'soirees-frejus-saint-raphael', cle: 'frejus', re: /fr[eé]jus|saint-rapha[eë]l|st[- ]rapha|puget-sur-argens|roquebrune-sur-argens|agay/i, photo: null },
];
const PHOTO_STYLE = { techno: 'foule', house: 'baskets', afro: 'rire', shatta: 'dj', latino: 'taxi', rap: 'file' };

let CSS_EN_LIGNE = ''; // CSS écrite dans chaque page : affichage plus rapide (une requête de moins)
let VERSION = '1'; // change quand le CSS ou le JS change (le navigateur recharge la bonne version)
let GOOGLE = ''; let BING = ''; // codes de vérification Search Console et Bing Webmaster (config.site) // code de vérification Google Search Console (config.site.google_verification)
// Titres et descriptions à la bonne longueur pour Google (titre ≤ 65 caractères, description ≤ 160), coupés sur un mot.
const couper = (x, n) => { x = String(x || '').replace(/\s+/g, ' ').trim(); if (x.length <= n) return x; const c = x.slice(0, n - 1); return `${c.slice(0, Math.max(c.lastIndexOf(' '), n * 0.6)).replace(/[\s,;:·–-]+$/, '')}…`; };
// Soirée : « Nom · date · lieu · Teufy » ; si trop long, le lieu saute puis le nom est raccourci (la date reste : deux dates d'un même événement gardent des titres différents).
const titreCourt = ([nom, date, lieu]) => { const fin = ` · ${date} · Teufy`; if (`${nom} · ${date} · ${lieu} · Teufy`.length <= 66 && lieu) return `${nom} · ${date} · ${lieu} · Teufy`; return `${couper(nom, Math.max(20, 66 - fin.length))}${fin}`; };
// Autres pages : titre raccourci en gardant la marque à la fin.
const titrePage = (x) => { x = String(x || ''); if (x.length <= 70) return x; const m = x.match(/^(.*?)( · Teufy)$/); return m ? `${couper(m[1], 62)}${m[2]}` : couper(x, 70); };
// Navigation instantanée (Chrome, Edge) : la page visée est préparée dès qu'on survole ou touche un lien interne.
const SPECULATION = JSON.stringify({ prerender: [{ where: { and: [{ href_matches: '/*' }, { not: { href_matches: '/*.(ics|mp4|jpg|png|webp|xml|json)' } }, { not: { selector_matches: '[target=_blank], [download]' } }] }, eagerness: 'moderate' }] });
const HASH_SPECULATION = createHash('sha256').update(SPECULATION).digest('base64');
// Navigation : une seule source pour le menu ordinateur (listes déroulantes), le menu plein écran du mobile et le pied
// de page. Rubriques groupées par intention (Sortir, Villes, Lieux, Styles, Pros, Teufy) : on trouve en un geste.
// Typographie : espace insécable avant ? ! et dans les guillemets « » (jamais un « ? » seul en début de ligne).
// Seulement dans le texte entre les balises (jamais dans les attributs, scripts ou styles).
const typo = (html, lang) => (lang === 'fr' ? html.replace(/(<(script|style)[\s\S]*?<\/\2>)|>([^<]+)</g, (m, bloc, _b, txt) => (bloc ? bloc : `>${txt.replace(/ ([?!»:])(?=\s|$|<|&)/g, '\u00a0$1').replace(/« /g, '«\u00a0')}<`)) : html);
const LIB_NAV = {
  fr: { avantages: 'Avantages', sortir: 'Sortir', villes: 'Villes', lieux: 'Lieux', styles: 'Styles', pros: 'Pros', teufy: 'Teufy', devenir: 'Devenir partenaire', tarifs: 'Nos tarifs', menu: 'Menu', chercher: 'Chercher', favoris: 'Favoris', fermer: 'Fermer le menu', ceWe: 'Ce week-end', gratuit: 'Gratuit et bons plans', etud: 'Soirées étudiantes', agenda: 'Agenda', raccourcis: 'Raccourcis' },
  en: { avantages: 'Perks', sortir: 'Going out', villes: 'Cities', lieux: 'Places', styles: 'Styles', pros: 'Pros', teufy: 'Teufy', devenir: 'Become a partner', tarifs: 'Pricing', menu: 'Menu', chercher: 'Search', favoris: 'Saved', fermer: 'Close menu', ceWe: 'This weekend', gratuit: 'Free and cheap', etud: 'Student nights', agenda: 'Events', raccourcis: 'Shortcuts' },
  it: { avantages: 'Vantaggi', sortir: 'Uscire', villes: 'Città', lieux: 'Locali', styles: 'Stili', pros: 'Pro', teufy: 'Teufy', devenir: 'Diventa partner', tarifs: 'Prezzi', menu: 'Menu', chercher: 'Cerca', favoris: 'Preferiti', fermer: 'Chiudi il menu', ceWe: 'Questo weekend', gratuit: 'Gratis e low cost', etud: 'Serate universitarie', agenda: 'Agenda', raccourcis: 'Scorciatoie' },
  es: { avantages: 'Ventajas', sortir: 'Salir', villes: 'Ciudades', lieux: 'Locales', styles: 'Estilos', pros: 'Pros', teufy: 'Teufy', devenir: 'Hazte socio', tarifs: 'Tarifas', menu: 'Menú', chercher: 'Buscar', favoris: 'Favoritos', fermer: 'Cerrar el menú', ceWe: 'Este fin de semana', gratuit: 'Gratis y barato', etud: 'Fiestas universitarias', agenda: 'Agenda', raccourcis: 'Accesos directos' },
  zh: { avantages: '优惠', sortir: '出门玩', villes: '城市', lieux: '场所', styles: '风格', pros: '商家', teufy: 'Teufy', devenir: '成为合作伙伴', tarifs: '价格', menu: '菜单', chercher: '搜索', favoris: '收藏', fermer: '关闭菜单', ceWe: '本周末', gratuit: '免费与优惠', etud: '学生派对', agenda: '活动', raccourcis: '快捷方式' },
  ar: { avantages: 'مزايا', sortir: 'الخروج', villes: 'المدن', lieux: 'الأماكن', styles: 'الأنماط', pros: 'للمحترفين', teufy: 'Teufy', devenir: 'كن شريكًا', tarifs: 'الأسعار', menu: 'القائمة', chercher: 'بحث', favoris: 'المفضلة', fermer: 'إغلاق القائمة', ceWe: 'نهاية هذا الأسبوع', gratuit: 'مجاني وبأسعار رخيصة', etud: 'حفلات الطلاب', agenda: 'الحفلات', raccourcis: 'اختصارات' },
};
const groupesNav = ({ t, lang, SA }) => { const L = LIB_NAV[lang] || LIB_NAV.fr; return [
  ['sortir', L.sortir, [['ce-soir/', t.js.ceSoir], ['ce-week-end/', L.ceWe], ...(SA ? [[`${SA.slug}/`, `${SA.emoji} ${SA.nom[lang] || SA.nom.fr}`]] : []), ['soirees-gratuites/', L.gratuit], ['soirees-etudiantes/', L.etud], ['festivals/', t.festivals], ...(ARTISTES.length ? [['artistes/', { fr: 'Artistes & DJ', en: 'Artists & DJs', it: 'Artisti e DJ', es: 'Artistas y DJ', zh: '艺人与 DJ', ar: 'الفنانون والدي جي' }[lang] || 'Artistes & DJ']] : []), ['avantages/', L.avantages]]],
  ['villes', L.villes, [['#agenda', t.js.toutCote || "Toute la Côte d'Azur et le Var"], ...VILLES_SEO.map((v) => [`${v.slug}/`, t.villes[v.cle]]), ['occitanie/', 'Occitanie'], ['france/', t.franceNav]]],
  ['lieux', L.lieux, [['clubs-bars/', t.lieuxNav], ['restaurants/', t.restos], ['manger-tard/', { fr: 'Manger tard (2 h–5 h)', en: 'Late-night food', it: 'Mangiare di notte', es: 'Comer de madrugada', zh: '深夜美食', ar: 'أكل في آخر الليل' }[lang] || 'Manger tard'], ['after/', 'After'], ['activites/', t.activites], ['dates/', t.dates]]],
  ['styles', L.styles, PAGES_STYLES.map((k) => [`soirees-${k}/`, nomStyle(k, t, lang)])],
  ['pros', L.pros, [['partenaires/', L.devenir], ['partenaires/#tarifs', L.tarifs], ['ambassadeurs/', t.ambassadeurs], ['bde/', t.bde]]],
  ['teufy', L.teufy, [['a-propos/', t.qui], ['a-propos/#modele', { fr: 'Comment Teufy se finance', en: 'How Teufy makes money', it: 'Come si finanzia Teufy', es: 'Cómo se financia Teufy', zh: 'Teufy 如何盈利', ar: 'كيف تموّل Teufy نفسها' }[lang] || 'Comment Teufy se finance'], ['actus/', t.actus], ['faq/', 'FAQ']]],
]; };
const ICO_ONGLET = {
  agenda: '<path d="M4 6h16v14H4zM4 10h16M8 3v5M16 3v5"/>', soir: '<path d="M15 3a8 8 0 1 0 6 13A7 7 0 0 1 15 3z"/>',
  chercher: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>', favoris: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
};
function gabarit({ lang, t, titre, description, chemin, base, corps, ld = [], image: imageDemandee, image = imageDemandee || 'site/img/equipe/monaco.jpg', compte, maj = '', agendaIci = false, rubriqueNav = null }) {
  const handle = compte.replace(/^@/, '');
  const P = pre(lang);
  const accueil = `${base}${P}`;
  const SA = saisonActive();
  const nav = [['', t.agenda], ['ce-soir/', t.js.ceSoir], ...(SA ? [[`${SA.slug}/`, `${SA.emoji} ${SA.nom[lang] || SA.nom.fr}`]] : []), ...VILLES_SEO.map((v) => [`${v.slug}/`, t.villes[v.cle === 'antibes' ? 'antibesCourt' : v.cle]]), ['festivals/', t.festivals], ['clubs-bars/', t.lieuxNav], ['dates/', t.dates], ['restaurants/', t.restos], ['activites/', t.activites], ['occitanie/', 'Occitanie'], ['actus/', t.actus], ['partenaires/', t.partenaires], ['a-propos/', t.qui]];
  const jsT = { ...t.js, base, langue: lang, locale: t.locale, resultats: t.resultats, aucunRes: t.aucunRes, lienCopie: t.lienCopie, ajouterFav: t.ajouterFav, voir: t.voir };
  return `<!doctype html>
<html lang="${lang}" dir="${t.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titrePage(titre))}</title>
<meta name="description" content="${esc(couper(description, 160))}">
<link rel="canonical" href="${URL_SITE}${P}${chemin}">
${LANGUES.map((l) => `<link rel="alternate" hreflang="${l}" href="${URL_SITE}${pre(l)}${chemin}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${URL_SITE}${chemin}">
<meta property="og:title" content="${esc(titrePage(titre))}">
<meta property="og:description" content="${esc(couper(description, 200))}">
<meta property="og:image" content="${/^https?:/.test(image) ? image : URL_SITE + image}">
<meta property="og:url" content="${URL_SITE}${P}${chemin}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Teufy">
<meta property="og:locale" content="${t.og}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0B0B0F">
${GOOGLE ? `<meta name="google-site-verification" content="${esc(GOOGLE)}">` : ''}${BING ? `<meta name="msvalidate.01" content="${esc(BING)}">` : ''}
<link rel="icon" type="image/png" sizes="32x32" href="${base}site/img/favicon-fond-32.png"><link rel="icon" type="image/png" sizes="64x64" href="${base}site/img/favicon-fond-64.png">
<link rel="apple-touch-icon" href="${base}site/img/icone-192.png">
<link rel="manifest" href="${base}site/manifest.webmanifest">
<link rel="preload" href="${base}site/fonts/bricolage-titre.woff2" as="font" type="font/woff2" crossorigin>
${(() => { // Image principale de la page (fetchpriority="high") annoncée dès l'en-tête : affichée plus tôt sur mobile (LCP).
  const m = corps.match(/<img\b[^>]*fetchpriority="high"[^>]*>/); if (!m) return '';
  const src = m[0].match(/\ssrc="([^"]+)"/)?.[1], srcset = m[0].match(/\ssrcset="([^"]+)"/)?.[1], sizes = m[0].match(/\ssizes="([^"]+)"/)?.[1];
  return src ? `<link rel="preload" as="image" href="${src}"${srcset ? ` imagesrcset="${srcset}"` : ''}${sizes ? ` imagesizes="${sizes}"` : ''} fetchpriority="high">` : ''; })()}
<style>${CSS_EN_LIGNE.replace(/__BASE__/g, base)}</style>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'sha256-Du+OJKJSbdUgz5nrHeWWINvez6XKDDU/tyj/5c2uvwo=' 'sha256-${HASH_SPECULATION}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tiles.openfreemap.org; font-src 'self'; media-src 'self'; connect-src 'self' https://tiles.openfreemap.org; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="tdm-reservation" content="1"><meta name="tdm-policy" content="${URL_SITE}cgu/"><meta name="robots" content="max-image-preview:large, noai, noimageai">
<script>document.documentElement.classList.add('js')</script>
<script type="speculationrules">${SPECULATION}</script>
${ld.length ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<a class="saut" href="#contenu">${esc(t.contenu)}</a>
<header class="barre">
  <a class="marque" href="${accueil || './'}" aria-label="Teufy"><img src="${base}site/img/logo-96.webp" alt="Teufy" width="39" height="32"></a>
  <div class="barre-droite">
    ${(() => { // Ordinateur : « Pros » et « Teufy » dans la barre du haut, à part des rubriques pour sortir.
      const G = Object.fromEntries(groupesNav({ t, lang, SA }).map((g) => [g[0], g]));
      return ['pros', 'teufy'].map((cle) => { const [, titreG, liens] = G[cle]; const actif = liens.some(([d]) => d && chemin.startsWith(d.split('#')[0]));
        return `<details class="nav-groupe nav-haut g-${cle}${actif ? ' actif' : ''}"><summary>${esc(titreG)}</summary><div>${liens.map(([d, n]) => `<a href="${accueil}${d}"${d === chemin ? ' aria-current="page"' : ''}>${esc(n)}</a>`).join('')}</div></details>`; }).join('');
    })()}
    <a class="loupe" href="${agendaIci ? '' : accueil}#recherche" aria-label="${esc(t.rechercher)}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></a>
    <details class="langues"><summary><span class="vh">${esc(t.langue)} : </span>${lang.toUpperCase()}</summary><div>${LANGUES.map((l) => `<a href="${base}${pre(l)}${chemin}" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="true"' : ''}>${esc(TXT[l].nom)}</a>`).join('')}</div></details>
    <a class="ig" href="https://www.instagram.com/${esc(handle)}/" target="_blank" rel="noopener" aria-label="Instagram ${esc(compte)}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="17.4" cy="6.6" r="1.3" fill="currentColor"/></svg></a>
  </div>
</header>
<nav class="nav" aria-label="Menu">${(() => {
      const G = groupesNav({ t, lang, SA }), tous = G.flatMap((g) => g[2]).map(([d]) => d).filter((d) => !d.startsWith('#')).map((d) => d.split('#')[0]);
      const actif = rubriqueNav ?? ([...tous, 'ce-soir/'].includes(chemin) ? chemin : tous.filter((d) => d && chemin.startsWith(d)).sort((a, b) => b.length - a.length)[0]);
      const lien = ([d, n]) => `<a href="${accueil}${d}"${d === chemin ? ' aria-current="page"' : d === actif ? ' aria-current="true"' : ''}>${esc(n)}${d === 'avantages/' && AVANTAGES.length + CODES.length ? ` <small class="nb-nav nb-offre">${AVANTAGES.length + CODES.length} ${AVANTAGES.length + CODES.length > 1 ? 'offres' : 'offre'}</small>` : ''}${COMPTES_NAV[d] ? ` <small class="nb-nav" aria-label="${COMPTES_NAV[d]} ${esc(t.js.soirees?.replace('{n}', '').trim() || 'soirées')}">${COMPTES_NAV[d]}</small>` : ''}</a>`;
      const groupe = ([cle, titreG, liens]) => `<details class="nav-groupe g-${cle}${liens.some(([d]) => (d && !d.startsWith('#') && d.split('#')[0] === actif) || (cle === 'villes' && /^(france|occitanie)\//.test(chemin))) ? ' actif' : ''}"><summary>${esc(titreG)}</summary><div>${liens.map(lien).join('')}</div></details>`;
      const L = LIB_NAV[lang] || LIB_NAV.fr, par = Object.fromEntries(G.map((g) => [g[0], g]));
      // Styles rangés dans « Sortir » (menu plus court) ; Ce soir à part (le plus demandé).
      const sortir = ['sortir', L.sortir, [...par.sortir[2].filter(([d]) => d !== 'ce-soir/'), ...par.styles[2]]];
      return `${lien(['', L.agenda])}${lien(['ce-soir/', t.js.ceSoir])}${groupe(par.villes)}${groupe(sortir)}${groupe(par.lieux)}`; })()}</nav>
${SA ? `<a class="bandeau-saison" href="${accueil}${SA.slug}/"><span aria-hidden="true">${SA.emoji}</span> <b>${esc(SA.nom[lang] || SA.nom.fr)}</b> · ${esc(t.toutes)} <span aria-hidden="true">→</span></a>` : ''}
<main id="contenu">
${typo(corps, lang)}
</main>
<footer>
  <div class="pied-colonnes">
    ${groupesNav({ t, lang, SA }).map(([cle, titreG, liens]) => `<div><p class="pied-titre">${esc(titreG)}</p>${liens.map(([d, n]) => `<a href="${accueil}${d}">${esc(n)}</a>`).join('')}${cle === 'teufy' ? `<a href="https://www.instagram.com/${esc(handle)}/" target="_blank" rel="noopener">${esc(compte)}</a>` : ''}</div>`).join('')}
    <div><p class="pied-titre">${esc(t.langue)}</p>${LANGUES.map((l) => `<a href="${base}${pre(l)}${chemin}" hreflang="${l}" lang="${l}">${esc(TXT[l].nom)}</a>`).join('')}</div>
  </div>
  <p><strong>Teufy</strong> · ${esc(t.pied1)}${maj ? ` · ${esc(maj)}` : ''}</p>
  <p>${esc(t.pied3)} · <a href="${accueil}mentions-legales/">${esc(t.legal)}</a> · <a href="${accueil}cgu/">CGU</a> · <a href="${accueil}cgv/">CGV</a> · <a href="${accueil}confidentialite/">${esc(TR_LEG[lang] || 'Confidentialité et cookies')}</a></p>
</footer>
${(() => { const L = LIB_NAV[lang] || LIB_NAV.fr; const ico = (k) => `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO_ONGLET[k]}</svg>`;
  const ici = agendaIci ? '' : accueil;
  return `<div class="menu-complet" id="menu" role="dialog" aria-modal="true" aria-label="${esc(L.menu)}" hidden>
  <div class="menu-tete"><a class="marque" href="${accueil || './'}"><img src="${base}site/img/logo-96.webp" alt="Teufy" width="39" height="32"></a><a href="#" class="menu-x" role="button" aria-label="${esc(L.fermer)}">×</a></div>
  <div class="menu-corps">
    <a class="menu-cherche" href="${ici}#recherche" data-chercher>${ico('chercher')}<span>${esc(t.placeholder)}</span></a>
    ${groupesNav({ t, lang, SA }).map(([cle, titreG, liens]) => `<section class="menu-groupe menu-${cle}"><h2>${esc(titreG)}</h2><div>${liens.map(([d, n]) => `<a href="${accueil}${d}"${d === chemin ? ' aria-current="page"' : ''}>${esc(n)}${d === 'avantages/' && AVANTAGES.length + CODES.length ? ` <small class="nb-nav nb-offre">${AVANTAGES.length + CODES.length}</small>` : ''}${COMPTES_NAV[d] ? ` <small class="nb-nav">${COMPTES_NAV[d]}</small>` : ''}</a>`).join('')}</div></section>`).join('')}
    <section class="menu-groupe menu-langue"><h2>${esc(t.langue)}</h2><div>${LANGUES.map((l) => `<a href="${base}${pre(l)}${chemin}" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="true"' : ''}>${esc(TXT[l].nom)}</a>`).join('')}</div></section>
  </div>
</div>
<nav class="onglets" aria-label="${esc(L.raccourcis)}" data-notif="${esc(JSON.stringify(NOTIF))}">
  <a href="${ici}#agenda"${chemin === '' ? ' aria-current="page"' : ''}>${ico('agenda')}<span>${esc(L.agenda)}</span></a>
  <a href="${accueil}ce-soir/"${chemin === 'ce-soir/' ? ' aria-current="page"' : ''}>${ico('soir')}<span>${esc(t.js.ceSoir)}</span><b class="nb-fav nb-soir" hidden></b></a>
  <a href="${ici}#recherche" data-chercher>${ico('chercher')}<span>${esc(L.chercher)}</span></a>
  <a href="${ici}#favoris" data-favoris>${ico('favoris')}<span>${esc(L.favoris)}</span><b class="nb-fav" hidden></b></a>
  <a href="#menu" data-menu aria-haspopup="dialog" aria-controls="menu">${ico('menu')}<span>${esc(L.menu)}</span><b class="nb-fav nb-actus" hidden></b></a>
</nav>`; })()}
<div class="flottant" hidden><button type="button" class="ouvrir-filtres"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><span>${esc(t.js.filtres)}</span><b class="compte"></b></button></div>
<button type="button" class="haut" aria-label="${esc(t.haut)}" hidden><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 14l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
<p class="toast" role="status" hidden></p>
<script type="application/json" id="teufy-t">${JSON.stringify(jsT).replace(/</g, '\\u003c')}</script>
<script src="${base}site/app.min.js?v=${VERSION}" defer></script>
</body>
</html>
`;
}

// Organisation + site (schema.org) : qui est Teufy, qui la dirige, où la suivre, recherche interne.
function ldOrganisation(T, compte, t, lang) {
  const handle = compte.replace(/^@/, '');
  return [{
    '@context': 'https://schema.org', '@type': 'Organization', '@id': `${URL_SITE}#teufy`, name: 'Teufy', url: URL_SITE, logo: `${URL_SITE}site/img/logo.png`,
    description: t.orgDesc,
    founder: { '@id': `${URL_SITE}#fondateur` }, alternateName: ['Teufy Party', 'teufyparty', '@teufy_official'], slogan: "Le guide des soirées de la Côte d'Azur",
    knowsAbout: ["Soirées sur la Côte d'Azur", 'Vie nocturne à Nice, Cannes, Monaco et Antibes', 'Clubs, bars et rooftops', 'Festivals', 'Billets de soirées', 'Bons plans sorties'],
    areaServed: ["Côte d'Azur", 'French Riviera', 'Alpes-Maritimes', 'Var', 'Monaco', 'Nice', 'Cannes', 'Antibes', 'Juan-les-Pins', 'Menton', 'Saint-Tropez', 'Toulon', 'Fréjus', 'Saint-Raphaël', 'Occitanie'].map((name) => ({ '@type': 'Place', name })),
    sameAs: [`https://www.instagram.com/${handle}/`, ...(T.reseaux_teufy || [])],
    ...(T.email ? { email: T.email, contactPoint: { '@type': 'ContactPoint', email: T.email, contactType: 'customer support', availableLanguage: ['fr', 'en'] } } : {}),
  }, { '@context': 'https://schema.org', '@type': 'Person', '@id': `${URL_SITE}#fondateur`, name: T.directeur, jobTitle: 'Fondateur et directeur de Teufy', worksFor: { '@id': `${URL_SITE}#teufy` },
    url: `${URL_SITE}a-propos/`, ...(T.photo_directeur ? { image: URL_SITE + T.photo_directeur } : {}), knowsAbout: ["Vie nocturne de la Côte d'Azur", 'Événementiel', 'Médias Instagram'],
    sameAs: Object.values(T.directeur_reseaux || {}).filter(Boolean),
  }, { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Teufy', alternateName: 'Teufy · Soirées Côte d\'Azur', url: `${URL_SITE}${pre(lang)}`, inLanguage: lang, publisher: { '@id': `${URL_SITE}#teufy` },
    potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${URL_SITE}${pre(lang)}?q={search_term_string}` }, 'query-input': 'required name=search_term_string' } }];
}

// Bandeau qui défile sous le hero.
const defile = (t) => `<div class="defile" aria-hidden="true" dir="ltr"><div class="piste">${[0, 1].map(() => `<span>${t.defile.map((x) => `${esc(x)}<i>✦</i>`).join('')}</span>`).join('')}</div></div>`;

// « Ce soir / En ce moment » : pré-rempli à la génération (le robot régénère le site plusieurs fois par jour) pour que
// rien ne bouge à l'affichage ; app.js le recalcule ensuite à l'heure du visiteur (cartes finies retirées, statuts).
const GENERE = Date.now();
const ceSoir = (t, soirees = [], base = '', lang = 'fr') => {
  const auj = cle(new Date(GENERE).toISOString()), DUREE = 6 * 3600e3, d = (s) => Date.parse(s.debut);
  const soir = soirees.filter((s) => s.jour === auj && d(s) + DUREE > GENERE).sort((a, b) => (d(b) <= GENERE) - (d(a) <= GENERE) || d(a) - d(b)); // en cours d'abord, puis par heure
  const live = soir.filter((s) => d(s) <= GENERE), tard = soir.filter((s) => d(s) > GENERE);
  const nb = (n) => (n === 1 ? t.js.soiree : t.js.soirees.replace('{n}', n));
  const groupe = (nom, l) => `<div class="groupe-soir" data-groupe="${nom}"${l.length ? '' : ' hidden'}><h3>${nom === 'live' ? '<i class="point"></i>' : ''}<span>${l.length ? esc(`${nom === 'live' ? t.js.live : t.js.plusTard} · ${nb(l.length)}`) : ''}</span></h3><div class="rangee">${l.map((s) => carte(s, { t, base, lang })).join('')}</div>${l.length > 8 ? `<button type="button" class="bouton contour voir-tout-soir">${lang === 'fr' ? `Voir les ${l.length - 8} autres soirées` : `+ ${l.length - 8}`}</button>` : ''}</div>`;
  return `<section id="ce-soir" class="ce-soir"${soir.length ? '' : ' hidden'}>
  <div class="tete"><p class="etiquette${live.length || !soir.length ? '' : ' sans-direct'}" data-direct="${esc(t.ceSoirEtiquette)}"><i class="point"></i>${esc(live.length || !soir.length ? t.ceSoirEtiquette : t.js.ceSoir)}</p><h2>${t.ceSoirH2}</h2><p>${esc(t.ceSoirP)}</p></div>
  ${groupe('live', live)}
  ${groupe('tard', tard)}
</section>`;
};

const champRecherche = (t, id = 'recherche') => `<div class="recherche" role="search"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><input id="${id}" type="search" name="q" placeholder="${esc(t.placeholder)}" aria-label="${esc(t.rechercher)}" autocomplete="off" enterkeyhint="search"><button type="button" class="effacer" aria-label="${esc(t.effacer)}" hidden>×</button></div>`;

function agenda(soirees, { t, base, lang, filtresVille = true, filtreStyle = true }) {
  const parJour = {};
  for (const s of soirees) (parJour[s.jour] ||= []).push(s);
  const jours = Object.entries(parJour).map(([jour, l]) => `<section class="jour" data-jour="${jour}"><h2>${esc(dateLongue(`${jour}T12:00:00Z`, t))}</h2><div class="grille">${l.map((s) => carte(s, { t, base, lang })).join('\n')}</div></section>`).join('\n');
  // Chaque filtre est un menu déroulant (une seule barre sur ordinateur) ; dans la feuille mobile, ils sont tous ouverts.
  const TITRES = { quand: t.quandL, ville: t.ou, style: t.stylesL, prix: t.prixL, acces: t.accesL, tri: t.trierL };
  const groupe = (f, valeurs, libelles) => `<details class="filtre" data-bloc="${f}"><summary><span>${esc(TITRES[f])}</span><b class="choix">${esc(libelles[0])}</b></summary><div class="groupe" data-filtre="${f}">${valeurs.map((v, i) => `<button type="button"${i ? '' : ' class="actif"'} data-v="${v}">${esc(libelles[i])}</button>`).join('')}</div></details>`;
  const styles = STYLES_MUSIQUE.map((x) => x.cle).filter((k) => soirees.some((s) => s.styles.includes(k)));
  return `<section id="agenda" class="agenda">
  <div class="filtres-place"><div class="filtres" role="toolbar" aria-label="${esc(t.js.filtres)}">
    <div class="vues"><button type="button" class="fermer-filtres">${esc(t.js.fermer)}</button></div>
    ${champRecherche(t)}
    <div class="menus">
    ${groupe('quand', ['tout', 'soir', 'weekend', 'semaine', 'favoris'], [...t.quand, t.favoris]).replace('</div></details>', `<label class="choix-date"><span>${esc(t.choisirDate)}</span><input type="date" min="${cle(new Date().toISOString())}"></label></div></details>`)}
    ${filtresVille ? groupe('ville', ['tout', ...VILLES.map((v) => v.toLowerCase()), 'var', 'autres'], [t.partout, t.villes.nice, t.villes.cannes, t.villes.monaco, t.villes.antibesCourt, t.var, t.ailleurs]) : ''}
    ${filtreStyle && styles.length > 1 ? groupe('style', ['tout', ...styles], [t.sons[0], ...styles.map((k) => nomStyle(k, t, lang))]) : ''}
    ${groupe('prix', ['tout', 'gratuit', '10'], t.prix)}
    ${groupe('acces', ['tout', 'pres', 'tram', 'train', 'bus', 'parking'], t.acces)}
    ${groupe('tri', ['date', 'prix', 'demande'], t.tris)}
    <p class="nb-res" aria-live="polite"></p>
    </div>
  </div></div>
  <div class="liste">
  ${jours || `<p class="vide">${esc(t.vide)}</p>`}
  <p class="vide" id="aucune" hidden>${esc(t.aucune)}</p>
  </div>
</section>`;
}

function blocPartenaires({ t, tr, T, base, partenaires }) {
  const P = (partenaires || lire(path.join(ROOT, 'contenus', 'partenaires.json'), { liste: [] }).liste || []).filter((x) => x.fichier);
  if (!P.length) return '';
  return `<section class="qui partenaires reveal">
  <p class="etiquette">${esc(t.partEtiquette)}</p>
  <h2>${t.partH2(esc(T.nbPartenaires))}</h2>
  <p>${esc(t.partP)}</p>
  ${(() => { // 24 logos visibles, les autres dans un dépliant (163 logos rendaient la page interminable sur mobile)
    const logo = (x, i) => { const img = `<img src="${base}${esc(x.fichier)}" alt="${esc(x.nom || 'Partenaire Teufy')}" loading="lazy" width="80" height="80">`; return x.instagram ? `<a href="https://www.instagram.com/${esc(x.instagram)}/" target="_blank" rel="noopener" title="${esc(x.nom || x.instagram)}" style="--i:${i % 12}">${img}</a>` : `<span style="--i:${i % 12}">${img}</span>`; };
    const N = 24;
    return `<div class="logos">${P.slice(0, N).map(logo).join('')}</div>${P.length > N ? `<details class="logos-plus"><summary>${esc(tr ? tr("Voir tous les partenaires") : t.etPlus)} <span>+${P.length - N}</span></summary><div class="logos">${P.slice(N).map(logo).join('')}</div></details>` : `<p class="et-plus">${esc(t.etPlus)}</p>`}`; })()}
</section>`;
}

const chiffres = (t, T, nb) => `<ul class="chiffres">
    <li><strong data-compte="${esc(nb)}">${esc(nb)}</strong><span>${esc(t.chiffres[0])}</span></li>
    <li><strong data-compte="${esc(T.nbPartenaires)}" data-suffixe="+">${esc(T.nbPartenaires)}+</strong><span>${esc(t.chiffres[1])}</span></li>
    <li><strong data-compte="10" data-prefixe="~">~10</strong><span>${esc(t.chiffres[2])}</span></li>
  </ul>`;

function blocTeufy({ t, T, base, lang }, nb) {
  return `<section class="qui reveal">
  <p class="etiquette">${esc(t.teufyEtiquette)}</p>
  <h2>${t.teufyH2}</h2>
  <p>${t.teufyP}</p>
  ${chiffres(t, T, nb)}
  <a class="lien" href="${base}${pre(lang)}a-propos/">${esc(t.teufyLien)}</a>
</section>`;
}


// Bloc « Tu fais vivre la nuit ? » : partenaires, ambassadeurs, BDE.
// « Travaille avec Teufy » : trois portes d'entrée en photo, avec ce que chacun y gagne et un vrai bouton.
const PROS = [
  ['partenaires/', 0, 'Clubs · Organisateurs · Artistes', 'Remplis tes soirées', "Ta soirée mise en avant sur le site et sur Instagram, devant ceux qui cherchent où sortir ce soir.", 'Devenir partenaire'],
  ['ambassadeurs/', 1, 'Ambassadeurs', 'Rejoins la team', "Tu connais toutes les soirées avant tout le monde ? Représente Teufy dans ta ville ou ton école.", 'Postuler'],
  ['bde/', 2, 'BDE · Associations', 'Des soirées étudiantes en grand', "On t'aide à remplir et à organiser vos soirées, avec notre réseau de clubs partenaires.", 'Organiser avec Teufy'],
];
const blocPros = ({ tr, base, lang }) => `<section class="pros reveal">
  <p class="etiquette">${esc(tr('Pros'))}</p>
  <h2>${tr('Travaille avec <em>Teufy</em>')}</h2>
  <div class="pros-cartes">${PROS.map(([c, k, et, titre, texte, bouton], i) => { const a = AFFICHES_COLLAGE.length >= 6 ? AFFICHES_COLLAGE[k] : ''; return `<a class="pro${a ? '' : ' sans-photo'}" href="${base}${pre(lang)}${c}#contact" style="--i:${i}">${a ? `<img src="${base}${a.replace(/\.jpg$/, '-800.webp')}" alt="" width="800" height="1000" loading="lazy" decoding="async">` : ''}<span><i class="pro-et">${esc(tr(et))}</i><strong>${esc(tr(titre))}</strong><em class="pro-texte">${esc(tr(texte))}</em><b class="pro-bouton">${esc(tr(bouton))} →</b></span></a>`; }).join('')}</div>
</section>`;

const blocFaq = (titre, faq) => `<section class="qui faq reveal"><h2>${titre}</h2>${faq.map(([q, r]) => `<details><summary>${esc(q)}</summary><p>${esc(r)}</p></details>`).join('')}</section>`;
const ldFaq = (faq) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, r]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: r } })) });

// Fond du hero : la vidéo du port de Monaco (muette, en boucle) ou une photo.
const fond = (base, photo, video, alt) => (video
  ? `<video class="hero-photo" autoplay muted loop playsinline preload="none" poster="${base}site/img/equipe/${photo}-600.webp" aria-label="${esc(alt)}"><source src="${base}site/img/equipe/${photo}.mp4" type='video/mp4; codecs="avc1.64001F"'>${existsSync(path.join(SITE, 'img', 'equipe', `${photo}.webm`)) ? `<source src="${base}site/img/equipe/${photo}.webm" type="video/webm">` : ''}</video>`
  : image(base, `site/img/${PHOTOS.includes(photo) ? '' : 'equipe/'}${photo}.jpg`, { alt, sizes: TAILLE_HERO, attrs: 'class="hero-photo" fetchpriority="high"' }));
// Sur ordinateur, la photo du hero est une carte à droite (jamais étirée, donc jamais floue) ; sur mobile, elle est en fond.
const TAILLE_HERO = '(min-width:980px) 560px, 100vw';

// Collage d'affiches (soirées à venir, un lot différent par page) ou de logos partenaires, à droite des en-têtes sans photo.
let AFFICHES_COLLAGE = [];
// Photos libres des spots pour un date (outils/photos-spots.mjs) : fichier, auteur, licence, source.
// Photos libres des villes (outils/photos-spots.mjs) : dernier recours pour une soirée sans aucune image.
const PHOTOS_VILLES = new Map(Object.entries(lire(path.join(ROOT, 'contenus', 'villes-photos.json'), {})).filter(([, p]) => p.fichier && existsSync(path.join(ROOT, p.fichier.replace(/\.jpg$/, '-480.webp')))).map(([v, p]) => [sansAccent(v.replace(/\s*\(.*\)/, '')).replace(/[^a-z]/g, ''), p]));
const photoVille = (ville) => { const k = sansAccent(String(ville || '')).replace(/[^a-z]/g, ''); if (!k) return null; if (PHOTOS_VILLES.has(k)) return PHOTOS_VILLES.get(k); for (const [n, p] of PHOTOS_VILLES) if (n.length >= 4 && k.startsWith(n)) return p; return null; };
const PHOTOS_SPOTS = Object.fromEntries(Object.entries(lire(path.join(ROOT, 'contenus', 'spots-photos.json'), {})).filter(([, p]) => p.fichier && existsSync(path.join(ROOT, p.fichier))));
// Fiche pratique du lieu d'une soirée (dress code, âge, prix des verres), si le lieu est dans l'annuaire des clubs et bars.
let DETAILS_LIEUX = new Map();
const normLieu = (x) => sansAccent(String(x || '')).replace(/\b(le|la|les|l|club|bar|the)\b/g, '').replace(/[^a-z0-9]/g, '');
const detailsDuLieu = (s) => DETAILS_LIEUX.get(normLieu(s.lieu)) || null;
// Version affichable d'une image (affiche, actu, post, photo) : la WebP la plus adaptée qui existe.
// Photo de ville en 1200 px (grands écrans) quand l'original est assez grand : sinon floue sur ordinateur.
const grandeVille = (rel) => { const f = path.join(ROOT, rel); if (!existsSync(f) || (tailleJpeg(f)?.[0] || 0) < 1100) return null; const w = webp(f, 1200); return w ? path.relative(ROOT, w) : null; };
const visuelHero = (rel) => [800, 480, 400, 600].map((l) => rel.replace(/\.(jpe?g|png)$/i, `-${l}.webp`)).find((f) => f !== rel && existsSync(path.join(ROOT, f))) || rel;
const collage = (base, k, logos = null, images = null, seules = false) => {
  const imgs = (images || []).filter(Boolean).filter((a) => { const f = visuelHero(a); const d = /\.jpe?g$/i.test(a) ? tailleJpeg(path.join(ROOT, a)) : null; return (!d || d[1] / d[0] >= 0.7) && (!/\.webp$/.test(f) || largeurWebp(path.join(ROOT, f)) >= 480); }).slice(0, 3); // jamais d'image trop petite (floue)
  // Fiches (artistes…) : seulement leurs propres affiches, jamais celles d'autres soirées pour remplir.
  if (seules) return imgs.length ? `<div class="collage collage-${Math.min(3, imgs.length)}" aria-hidden="true">${imgs.slice(0, 3).map((a, i) => `<img src="${base}${esc(visuelHero(a))}" alt="" width="400" height="500" loading="lazy" style="--i:${i}">`).join('')}</div>` : '';
  if (imgs.length === 3) return `<div class="collage" aria-hidden="true">${imgs.map((a, i) => `<img src="${base}${esc(visuelHero(a))}" alt="" width="400" height="500" loading="lazy" style="--i:${i}">`).join('')}</div>`;
  if (logos) return `<div class="collage logos-collage" aria-hidden="true">${logos.slice(0, 12).map((f, i) => `<img src="${base}${esc(f)}" alt="" width="160" height="160" loading="lazy" style="--i:${i}">`).join('')}</div>`;
  const l = AFFICHES_COLLAGE.length ? [0, 1, 2].map((i) => AFFICHES_COLLAGE[(k * 3 + i) % AFFICHES_COLLAGE.length]) : [];
  return l.length ? `<div class="collage" aria-hidden="true">${l.map((a, i) => `<img src="${base}${a.replace(/\.jpg$/, '-800.webp')}" alt="" width="400" height="500" loading="lazy" style="--i:${i}">`).join('')}</div>` : '';
};
const ICO_PARTAGE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 11H6.5A1.5 1.5 0 0 0 5 12.5v7A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const boutonPartage = (label, cls = '') => `<button type="button" class="partager icone-rond${cls ? ` ${cls}` : ''}" aria-label="${esc(label)}" title="${esc(label)}">${ICO_PARTAGE}</button>`;
const heroCourt = ({ base, photo, video, alt, etiquette, h1, p, live = false, k = 0, logos = null, images = null, seules = false, partage = '', actions = '' }) => `<section class="hero court${photo ? '' : ' sans-photo'}">
  ${photo ? `<div class="hero-media">${fond(base, photo, video, alt)}</div>` : `<div class="hero-deco" aria-hidden="true"><span></span><span></span><span></span></div>${collage(base, k, logos, images, seules)}`}
  <div class="hero-texte">
    <p class="etiquette">${esc(etiquette)}</p>${partage ? boutonPartage(partage, 'hero-partage') : ''}
    <h1>${h1}</h1>
    ${p ? `<p>${p}</p>` : ''}
    ${live ? '<div class="hero-actions"><a class="pastille-live" href="#ce-soir" hidden><i class="point"></i><span></span></a></div>' : ''}${actions ? `<div class="hero-actions">${actions}</div>` : ''}
  </div>
</section>`;

const blocTendance = ({ t, tr, base, lang, lieux }) => {
  const top = (lieux || []).filter((l) => l.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  if (!top.length) return '';
  return `<section class="bloc-large reveal"><h2>${tr('Les spots du <em>moment</em>')}</h2><div class="fiches fiches-tendance">${top.map((l, i) => carteLieu(l, { t, tr, base, lang }, i, true)).join('')}</div><p class="cta"><a class="bouton contour" href="${base}${pre(lang)}clubs-bars/">${esc(t.lieuxNav)}</a><a class="bouton contour" href="${base}${pre(lang)}france/">${esc(t.franceNav)}</a></p></section>`;
};
function page({ lang, t, tr, base, compte, T, soirees, posts, now, maj, partenaires, lieux }) {
  const handle = compte.replace(/^@/, '');
  const semaine = soirees.filter((s) => Date.parse(s.debut) < now.getTime() + 8 * 864e5);
  const vedette = [...semaine].filter((s) => s.affiche && (s.buzz ?? 0) >= 0.7).sort((a, b) => b.buzz - a.buzz)[0];
  const ctx = { lang, t, tr, base, T, partenaires };
  const populaires = PAGES_STYLES.filter((k) => soirees.some((s) => s.styles.includes(k)));
  const faq = t.faqHome;
  const corps = `<section class="hero">
  <div class="hero-media"><div class="diaporama n${DIAPORAMA.length}" aria-hidden="true">${DIAPORAMA.map((f, i) => { const img = image(base, `site/img/${f}.jpg`, { sizes: TAILLE_HERO, attrs: `class="hero-photo" style="--i:${i}"${i ? '' : ' fetchpriority="high"'}` }); return i ? img.replace(' src="', ' data-src="').replace(' srcset="', ' data-srcset="') : img; }).join('')}</div></div>
  <div class="hero-texte">
    <p class="etiquette">${esc(t.heroEtiquette)}</p>
    <h1>${t.heroH1}</h1>
    <p>${esc(t.heroP(soirees.length))}</p>
    <form class="hero-recherche" action="" method="get" role="search">${champRecherche(t, 'recherche-hero').replace('<div class="recherche" role="search">', '<div class="recherche">')}<button class="bouton" type="submit">${esc(t.rechercher)}</button></form>
    <p class="populaires">${esc(t.populaires)} ${populaires.map((k) => `<a href="${base}${pre(lang)}soirees-${k}/">${esc(nomStyle(k, t, lang))}</a>`).join('')}</p>
    <div class="hero-actions"><a class="bouton contour" href="#agenda">${esc(t.toutes)}</a><a class="pastille-live" href="#ce-soir" hidden><i class="point"></i><span></span></a></div>
  </div>
</section>
${defile(t)}
${ceSoir(t, soirees, base, lang)}
${vedette ? `<section class="la-plus reveal"><h2 class="etiquette">${esc(t.laPlus)}</h2>${carte(vedette, { t, base, lang, vedette: true })}</section>` : ''}
${agenda(soirees, { t, base, lang })}
${blocAbonnement({ tr: (x) => trad(lang, x), base })}
${CODES.length ? `<section class="bloc-large reveal"><h2>${t.bonsPlansH2}</h2><div class="cartes-texte">${CODES.map((c) => `<article class="carte-texte">${blocPromo(c, t, (x) => trad(lang, x))}</article>`).join('')}</div></section>` : ''}
${blocTendance({ t, tr: (x) => trad(lang, x), base, lang, lieux })}
${blocTeufy(ctx, soirees.length)}
${blocPartenaires(ctx)}
${blocFaq(t.faqH, faq)}
${grilleInsta(posts, { t, base, compte })}
${blocOrga({ t, tr, base, handle, lang })}`;
  return gabarit({ lang, t, titre: t.homeTitre, description: t.homeDesc(soirees.length), chemin: '', base, corps, ld: [...ldOrganisation(T, compte, t, lang), ldFaq(faq), ...jsonld(soirees, lang)], compte, maj, agendaIci: true });
}

// Organisateurs : une carte claire (affiches réelles en éventail, 3 étapes, 2 boutons) au lieu d'un grand aplat de texte.
const ICO_IG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.3" fill="currentColor"/></svg>';
function blocOrga({ t, tr = (x) => x, base, handle, lang }) {
  const aff = AFFICHES_COLLAGE.slice(-3);
  const ETAPES = [['Envoie ta soirée', "L'affiche, la date et le lien de billetterie, en message sur Instagram."], ['On vérifie', 'Date, lieu et prix contrôlés sur ta billetterie.'], ["C'est en ligne", "Ta soirée apparaît dans l'agenda, et les plus attendues sont mises en avant."]];
  return `<section class="orga2 reveal">
  ${aff.length === 3 ? `<div class="orga2-affiches" aria-hidden="true">${aff.map((a, i) => `<img src="${base}${a.replace(/\.jpg$/, '-480.webp')}" alt="" width="240" height="300" loading="lazy" style="--i:${i}">`).join('')}</div>` : ''}
  <div class="orga2-texte">
    <p class="etiquette">${esc(t.orgaEtiquette)}</p>
    <h2>${tr('Ta soirée, <em>vue par ceux qui sortent</em>')}</h2>
    <ol class="orga2-etapes">${ETAPES.map(([a, b], i) => `<li style="--i:${i}"><b>${i + 1}</b><span><strong>${esc(tr(a))}</strong>${esc(tr(b))}</span></li>`).join('')}</ol>
    <p class="orga2-actions"><a class="bouton" href="https://ig.me/m/${esc(handle)}" target="_blank" rel="noopener">${ICO_IG}<span>${esc(tr('Envoyer ma soirée'))}</span></a><a class="bouton contour" href="${base}${pre(lang)}partenaires/#contact">${esc(tr('Devenir partenaire'))}</a></p>
  </div>
</section>`;
}

function pageVille({ lang, t, tr, base, compte, T, chemin, v, soirees, now, maj }) {
  const ville = t.villes[v.cle];
  const n = soirees.filter((s) => s.jour === cle(now.toISOString())).length;
  const faq = t.faq(ville, n);
  const corps = `${heroCourt({ partage: t.partager, base, photo: v.photo, video: v.video, images: v.photo ? null : soirees.filter((x) => x.affiche).map((x) => x.affiche), k: 8, alt: ville, etiquette: t.villeEtiquette(ville), h1: t.villeH1(esc(ville)), p: `${esc(t.intro[v.cle])} ${esc(t.villeN(soirees.length))}`, live: true })}
${ceSoir(t, soirees, base, lang)}
${agenda(soirees, { t, base, lang, filtresVille: false })}
${blocFaq(esc(t.faqH2(ville)), faq)}
${blocOrga({ t, tr, base, handle: compte.replace(/^@/, ''), lang })}`;
  return gabarit({ lang, t, titre: t.villeTitre(ville), description: t.villeDesc(ville, soirees.length), chemin, base, corps, compte, maj, agendaIci: true,
    ld: [...ldOrganisation(T, compte, t, lang), ...jsonld(soirees, lang), ldFaq(faq), fil(lang, [['Teufy', ''], [ville, chemin]])] });
}

function pageStyle({ lang, t, tr, base, compte, T, chemin, cleStyle, soirees, maj }) {
  const st = STYLES_MUSIQUE.find((x) => x.cle === cleStyle);
  const nom = nomStyle(cleStyle, t, lang);
  const corps = `${heroCourt({ partage: t.partager, base, photo: PHOTO_STYLE[cleStyle], alt: nom, etiquette: `${t.styleEtiquette} · ${nom}`, h1: t.styleH1(esc(nom)), p: `${esc(tr(st.intro))} ${esc(t.villeN(soirees.length))}`, live: true })}
${ceSoir(t, soirees, base, lang)}
${agenda(soirees, { t, base, lang, filtreStyle: false })}
${blocAbonnement({ tr, base, nom: `agenda-${cleStyle}`, libelle: nom })}
<section class="qui reveal"><p class="liens-styles">${PAGES_STYLES.filter((k) => k !== cleStyle).map((k) => `<a class="puce" href="${base}${pre(lang)}soirees-${k}/">${esc(nomStyle(k, t, lang))}</a>`).join('')}</p></section>
${blocOrga({ t, tr, base, handle: compte.replace(/^@/, ''), lang })}`;
  return gabarit({ lang, t, titre: t.styleTitre(nom), description: t.styleDesc(nom, soirees.length), chemin, base, corps, compte, maj, agendaIci: true,
    ld: [...ldOrganisation(T, compte, t, lang), ...jsonld(soirees, lang), fil(lang, [['Teufy', ''], [nom, chemin]])] });
}

// « Ta nuit complète » : où boire un verre avant (bars de la même ville ouverts ce jour-là, horaires publiés) et où
// manger tard / finir en after (lieux vérifiés de contenus/nuit-tardive.json). Rien n'est affiché sans horaires sourcés.
const heure24 = (d) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(d));
function nuitComplete(s, { lieux, tr, base, lang }) {
  const ville = sansAccent(s.ville || ''), jourSemaine = ((new Date(Date.parse(s.debut) - 5 * 3600e3).getUTCDay() + 6) % 7) + 1;
  const ouvertCeJour = (H) => (H?.plages || []).find((p) => p.j.includes(jourSemaine));
  const memeLieu = (l) => normLieu(l.nom) && (normLieu(s.lieu || '') === normLieu(l.nom) || normLieu(s.lieu || '').startsWith(normLieu(l.nom)));
  const avant = (lieux || []).filter((l) => l.slug && sansAccent(l.ville || '') === ville && ['bar', 'pub', 'rooftop', 'bar-a-cocktails', 'lounge', 'beach-club'].includes(l.type) && !memeLieu(l))
    .map((l) => ({ l, p: ouvertCeJour(lireHoraires(l.details?.horaires)) }))
    // Encore ouvert une heure avant le début de la soirée (fermeture après minuit comprise).
    .filter((x) => { if (!x.p) return false; const deb = heure24(s.debut), avantDeb = deb >= '01:00' ? `${String(+deb.slice(0, 2) - 1).padStart(2, '0')}${deb.slice(2)}` : deb; const nuit = x.p.a <= x.p.de; return x.p.de <= avantDeb && (nuit || x.p.a >= deb); })
    .sort((a, b) => (b.l.partenaire ? 1 : 0) - (a.l.partenaire ? 1 : 0) || (b.l.score || 0) - (a.l.score || 0)).slice(0, 3);
  // Après la soirée : les adresses ouvertes ce jour-là les plus proches de la soirée (distance), sinon de la même ville.
  const cS = s.lat && !s.approx ? [+s.lat, +s.lng] : null;
  const apres = (TARDIFS || []).filter((l) => l.type !== 'resto-soir').map((l) => ({ l, p: ouvertCeJour(lireHoraires(l.horaires)), d: cS && l.lat ? metres(cS, [l.lat, l.lng]) : null }))
    .filter((x) => x.p && (x.d != null ? x.d <= 4000 : sansAccent(x.l.ville || '') === ville)).sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9)).slice(0, 3);
  if (!avant.length && !apres.length) return '';
  const h = (x) => x.replace(':00', 'h').replace(':', 'h');
  const ligne = (href, nom, type, p, ext, d = null) => `<li><a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}><b>${esc(nom)}</b><small>${esc(tr(type))} · ${esc(h(p.de))}–${esc(h(p.a))}${d != null ? ` · ${esc(distanceTexte(d))}` : ''}</small></a></li>`;
  return `<section class="nuit-complete" aria-labelledby="nuit-${s.id}"><h2 id="nuit-${s.id}">${tr('Ta nuit <em>complète</em>')}</h2>
    ${avant.length ? `<div><p class="pied-titre">${esc(tr('Avant : un verre à côté'))}</p><ul>${avant.map(({ l, p }) => ligne(`${base}${pre(lang)}clubs-bars/${l.slug}/`, l.nom, l.type === 'bar-a-cocktails' ? 'Bar à cocktails' : l.type === 'rooftop' ? 'Rooftop' : l.type === 'pub' ? 'Pub' : l.type === 'lounge' ? 'Lounge' : l.type === 'beach-club' ? 'Beach club' : 'Bar', p, false)).join('')}</ul></div>` : ''}
    ${apres.length ? `<div><p class="pied-titre">${esc(tr('Après : manger tard ou finir en after'))}</p><ul>${apres.map(({ l, p, d }) => ligne(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([l.nom, l.adresse, l.ville].filter(Boolean).join(', '))}`, l.nom, l.type === 'after' ? 'After' : (l.categorie || 'Manger tard'), p, true, d)).join('')}</ul></div>` : ''}
    <p class="petit">${esc(tr('Horaires relevés sur les sources officielles des lieux : vérifie avant d\'y aller.'))}</p></section>`;
}
// Présentation de la soirée quand la source n'en dit presque rien : un texte vivant construit UNIQUEMENT à partir des
// données vérifiées (date, lieu, sons, line-up, organisateur, prix, infos du lieu). Aucune IA, rien d'inventé.
function presentation(s, { t, L, lieu }) {
  const liste = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} et ${a[a.length - 1]}` : a[0] || '');
  const p = [];
  const quand = `${dateLongue(s.debut, t).toLowerCase()} à partir de ${heure(s.debut, t)}${s.fin ? ` et jusqu'à ${heure(s.fin, t)}` : ''}`;
  p.push(`${s.nom}, c'est ${quand}${s.lieu ? `, ${/^les\s/i.test(s.lieu) ? `aux ${s.lieu.slice(4)}` : /^le\s/i.test(s.lieu) ? `au ${s.lieu.slice(3)}` : /^(la\s|l')/i.test(s.lieu) ? `à ${s.lieu}` : `au ${s.lieu}`}` : ''}${s.ville && !sansAccent(s.lieu).toLowerCase().includes(sansAccent(s.ville).toLowerCase()) ? ` à ${s.ville}` : ''}.`
    + (s.genres ? ` Côté son : ${liste(s.genres.split(' · ').map((g) => g.toLowerCase()))}.` : ''));
  if (s.artistes?.length) p.push(`${s.artistes.length > 1 ? 'Aux platines et sur scène' : 'Sur scène'} : ${liste(s.artistes.map((a) => a.nom || a))}.`);
  if (s.instagram) p.push(`La soirée est portée par ${s.organisateur || `@${s.instagram}`}${s.organisateur ? ` (@${s.instagram})` : ''} : c'est sur leur Instagram que tombent les dernières annonces (line-up, horaires, préventes).`);
  if (L?.description) p.push(`Le lieu : ${String(L.description).replace(/\s+/g, ' ').trim().replace(/([^.!?])$/, '$1.')}`);
  const d = detailsDuLieu(s);
  const pratique = [d?.dress_code && `dress code ${String(d.dress_code).toLowerCase()}`, d?.age_min && `âge minimum ${String(d.age_min).toLowerCase()}`].filter(Boolean);
  const prix = s.prix === 0 ? 'L\'entrée est gratuite' : s.prix != null ? `Côté billets, ça part ${prixTexte(s.prix, t)}` : 'Tarifs et préventes : directement sur la billetterie officielle';
  p.push(`${prix}${s.offres?.length >= 2 ? `, et la soirée est en vente sur ${s.offres.length} billetteries : compare les prix juste en dessous` : ''}.${pratique.length ? ` À savoir : ${liste(pratique)}.` : ''} Ajoute-la à ton agenda, envoie-la à tes potes, et rendez-vous ${lieu ? 'sur place' : 'là-bas'}.`);
  return `<div class="presentation">${p.map((x) => `<p>${esc(x)}</p>`).join('')}</div>`;
}

const lieuDe = (s, lieux) => (lieux || []).find((l) => l.slug && normLieu(l.nom).length >= 3 && (normLieu(s.lieu) === normLieu(l.nom) || normLieu(s.lieu).startsWith(normLieu(l.nom))));
function pageSoiree({ lang, t, tr, base, compte, T, chemin, s, soirees, maj, lieux }) {
  const P = pre(lang);
  const sa = (x) => sansAccent(String(x || '')).toLowerCase(); // pas de « Antibes, Antibes » quand l'adresse contient déjà la ville
  const lieu = [s.lieu, s.adresse && s.adresse !== s.lieu ? s.adresse : '', s.adresse && sa(s.adresse).includes(sa(s.ville)) ? '' : s.ville].filter(Boolean).join(', ');
  // La même ville d'abord (puis le reste de la région), pour que les suggestions soient utiles.
  const villeDabord = (l) => [...l.filter((x) => x.filtreVille === s.filtreVille), ...l.filter((x) => x.filtreVille !== s.filtreVille)];
  const meme = villeDabord(soirees.filter((x) => x.jour === s.jour && x.id !== s.id)).slice(0, 6);
  const style = villeDabord(soirees.filter((x) => x.id !== s.id && x.jour !== s.jour && x.styles.some((k) => s.styles.includes(k)))).slice(0, 6);
  const mini = (l, titre) => (l.length ? `<section class="similaires reveal"><h2>${titre}</h2><div class="grille">${l.map((x) => carte(x, { t, base, lang })).join('')}</div></section>` : '');
  const offres = s.offres.length ? `<div class="offres"><p class="pied-titre">${esc(t.comparer)}</p>${s.offres.map((o, i) => `<a href="${esc(o.url)}" target="_blank" rel="noopener"><span>${esc(nomPlateforme(o.url))}</span><b>${esc(o.prix == null ? t.prixBillet : prixTexte(o.prix, t))}</b>${i === 0 && o.prix != null ? `<i>${esc(t.meilleurPrix)}</i>` : ''}</a>`).join('')}</div>` : '';
  const img = s.affiche ? image(base, s.affiche, { alt: t.affiche + s.nom, sizes: '(min-width:860px) 460px, 92vw', attrs: `fetchpriority="high"${s.dims ? ` width="${s.dims[0]}" height="${s.dims[1]}"` : ''}${s.dims && s.dims[0] < 560 ? ` class="petite" style="max-width:${s.dims[0]}px"` : ''}` }) : `<div class="affiche-fiche">${vignette(s, base)}</div>`;
  const corps = `<article class="fiche carte-donnees" data-id="${s.id}" data-debut="${esc(s.debut)}">
  <nav class="ariane"><a href="${base}${P}">Teufy</a> › ${s.zone === 'occitanie' ? `<a href="${base}${P}occitanie/">Occitanie</a>` : s.zone === 'france' ? `<a href="${base}${P}france/">${esc(t.franceNav)}</a>` : `<a href="${base}${P}#agenda">${esc(t.agenda)}</a>`} › <span>${esc(s.nom)}</span></nav>
  <div class="fiche-grille">
    <div class="fiche-affiche${s.affiche && s.dims && (s.dims[0] / s.dims[1] > 0.95 || s.dims[0] < 560) ? ' cadre' : ''}${s.affiche && s.dims && s.dims[0] / s.dims[1] > 1.2 ? ' large' : ''}">${s.affiche && s.dims && (s.dims[0] / s.dims[1] > 0.95 || s.dims[0] < 560) ? `<img class="fond-flou" src="${base}${s.affiche.replace(/\.jpg$/, '-480.webp')}" alt="" aria-hidden="true">` : ''}${img}</div>
    <div class="fiche-infos">
      ${s.genres ? `<p class="genre">${esc(s.genres)}</p>` : ''}
      <h1>${esc(s.nom)}</h1>
      ${s.accroche ? `<p class="fiche-accroche">${esc(s.accroche)}</p>` : ''}
      ${s.instagram ? `<a class="orga-carte" href="https://www.instagram.com/${esc(s.instagram)}/" target="_blank" rel="noopener"><span class="orga-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.3" fill="currentColor"/></svg></span><span class="orga-txt"><small>${esc(tr('Organisé par'))}</small><b>${esc(s.organisateur || `@${s.instagram}`)}</b>${s.organisateur ? `<em>@${esc(s.instagram)}</em>` : ''}</span><span class="orga-cta">${esc(tr('Voir sur Instagram'))} →</span></a>` : ''}
      ${s.description && s.description !== s.accroche ? `<p class="fiche-desc">${esc(s.description)}</p>` : ''}
      ${lang === 'fr' && (s.description || '').length < 260 ? presentation(s, { t, L: lieuDe(s, lieux), lieu }) : ''}
      ${s.artistes?.length ? `<p class="line-up"><span class="pied-titre">${esc(tr('Line-up'))}</span>${s.artistes.map((a) => `<a class="puce" href="${base}${pre(lang)}artistes/${a.slug}/">${esc(a.nom)}</a>`).join('')}</p>` : ''}
      <div class="rebours-bloc" data-debut="${esc(s.debut)}"><p class="pied-titre">${esc(t.commenceDans)}</p><p class="rebours-grand rebours" data-debut="${esc(s.debut)}" data-long="1"></p>${(s.buzz ?? 0) >= SEUIL_DEMANDE ? `<p class="petit">${esc(t.tresDemandee)} · ${esc(t.reserveTot)}</p>` : ''}</div>
      <dl>
        <div><dt>${esc(t.quandL)}</dt><dd>${esc(dateLongue(s.debut, t))} · ${esc(heure(s.debut, t))}</dd></div>
        <div><dt>${esc(t.ou)}</dt><dd>${esc(lieu)}</dd></div>
        <div><dt>${esc(t.prixL)}</dt><dd>${esc(prixTexte(s.prix, t) || t.prixBillet)}</dd></div>
        ${(() => { const d = detailsDuLieu(s); if (!d) return ''; return [[tr('Dress code'), d.dress_code], [tr('Âge'), d.age_min], [tr('Verres'), d.prix_verre]].filter((x) => x[1]).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(tr(v))}</dd></div>`).join(''); })()}
      </dl>
      <p class="fiche-actions">${boutonBillets(s, t)}
        <a class="bouton contour sombre" href="${base}site/ics/${s.id}.ics" download>${esc(t.calendrier)}</a>
        <a class="bouton contour sombre" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(lieu)}" target="_blank" rel="noopener">${esc(t.itineraire)}</a>
        ${boutonPartage(t.partager)}
        <button type="button" class="bouton contour sombre story" data-story="${esc(JSON.stringify((() => { const n = parseInt(h(s.nom), 16), te = [[255, 90, 60], [255, 46, 110], [130, 80, 255], [40, 170, 255], [61, 255, 138], [255, 200, 60]]; return { nom: s.nom, quand: `${dateLongue(s.debut, t)} · ${heure(s.debut, t)}`, lieu, genres: (s.genres || '').split(' · ').slice(0, 3).join(' · '), affiche: s.affiche ? `${base}${s.affiche}` : '', a: te[n % 6], b: te[(Math.floor(n / 7) % 5 + 1 + n % 6) % 6], site: URL_SITE.replace(/^https?:\/\//, '').replace(/\/$/, ''), compte, fichier: `teufy-${s.id}.png` }; })()))}">${ICO_IG}<span>${esc(tr('Story Instagram'))}</span></button>
        <a class="bouton contour sombre whatsapp" href="https://wa.me/?text=${encodeURIComponent(`${tr('On y va ?')} ${s.nom} · ${dateLongue(s.debut, t)} · ${heure(s.debut, t)} · ${lieu}\n${URL_SITE}${pre(lang)}soiree/${s.id}/`)}" target="_blank" rel="noopener">${esc(tr('Proposer à mes potes'))}</a>
        <button type="button" class="coeur grand" aria-label="${esc(t.ajouterFav)}" aria-pressed="false"></button>
      </p>
      ${promoDe(s) ? blocPromo(promoDe(s), t, tr, s) : ''}
      ${offres}
      ${(() => { const L = lieuDe(s, lieux); if (!L) return '';
        const H = lireHoraires(L.details?.horaires);
        return `<a class="fiche-lieu lieu-mini" href="${base}${pre(lang)}clubs-bars/${esc(L.slug)}/" data-ville="${esc(slug(L.ville || ''))}"${H ? ` data-horaires="${esc(JSON.stringify(H.plages))}"` : ''}${L.soirs?.length ? ` data-soirs="${esc(JSON.stringify(L.soirs))}"` : ''}>${L.photo ? `<img src="${base}${esc(L.photo)}" alt="" width="56" height="56" loading="lazy">` : ''}<span><small>${esc(tr('Le lieu'))}</small><b>${esc(L.nom)}</b><span class="lieu-statut" hidden></span><em>${esc(tr('Horaires, dress code et autres soirées'))} →</em></span></a>`; })()}
      ${nuitComplete(s, { lieux, tr, base, lang })}
      <p class="source-fiche">${s.url ? `${esc(tr('Infos vérifiées sur'))} <a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(nomPlateforme(s.url))}</a> · ` : ''}${esc(tr('Une erreur ?'))} <a href="https://ig.me/m/${esc(compte.replace(/^@/, ''))}" target="_blank" rel="noopener">${esc(tr('Signale-la'))}</a> · <a href="${base}${P}faq/#sources">${esc(tr('Nos sources'))}</a></p>
    </div>
    <div class="fiche-aside">
      ${yAller(s, t, lieu)}
    </div>
  </div>
</article>
<div class="barre-billets" hidden><div><b>${esc(prixTexte(s.prix, t) || t.prixBillet)}</b><small>${esc(dateCourte(s.debut, t))} · ${esc(heure(s.debut, t))}</small></div>${boutonBillets(s, t)}</div>
${mini(meme, esc(t.memeSoir))}
${mini(style, esc(t.memeStyle))}
<p class="retour"><a class="bouton" href="${base}${P}${s.zone === 'occitanie' ? 'occitanie/' : s.zone === 'france' ? 'france/' : '#agenda'}">${esc(s.zone === 'occitanie' ? tr("Toutes les soirées d'Occitanie") : t.toutes)}</a></p>`;
  const rubriqueNav = s.zone === 'occitanie' ? 'occitanie/' : s.zone === 'france' ? null : `${(VILLES_SEO.find((v) => v.cle === s.filtreVille || v.re.test(s.ville || '')) || { slug: '' }).slug}${VILLES_SEO.some((v) => v.cle === s.filtreVille || v.re.test(s.ville || '')) ? '/' : ''}`;
  return gabarit({ rubriqueNav, lang, t, titre: titreCourt([s.nom, dateCourte(s.debut, t), s.lieu || s.ville]), description: `${s.nom}, ${dateLongue(s.debut, t)} ${heure(s.debut, t)}, ${lieu}. ${s.accroche || ''} ${prixTexte(s.prix, t)}`.trim().slice(0, 300), chemin, base, corps, compte, maj,
    image: s.affiche || 'site/img/equipe/monaco.jpg', ld: [jsonEvent(s, lang), fil(lang, [['Teufy', ''], s.zone === 'occitanie' ? ['Occitanie', 'occitanie/'] : s.zone === 'france' ? [t.franceNav, 'france/'] : [t.agenda, ''], [s.nom, chemin]])] });
}

// « Y aller » : parkings, transports, vélos et taxis autour du lieu (OpenStreetMap), plus un itinéraire en transports.
function yAller(s, t, lieu) {
  const p = s.proches;
  const dist = (m) => t.aPied.replace('{m}', m).replace('{min}', Math.max(1, Math.round(m / 80)));
  const dest = s.approx || !s.lat ? encodeURIComponent(s.adresse || lieu) : `${s.lat},${s.lng}`; // adresse exacte si le point n'est pas encore connu
  const li = (a, b) => `<li><span>${a}</span><small>${b}</small></li>`;
  const parkings = (p?.parkings || []).map((x) => li(esc(x.nom || t.parking), esc([x.type === 'underground' ? t.souterrain : '', x.payant === false ? t.gratuitP : x.payant ? t.payantP : '', dist(x.m)].filter(Boolean).join(' · '))));
  const trans = (p?.transports || []).map((x) => li(`<b class="ligne ${x.type}">${esc(t[x.type])}${x.lignes ? ` ${esc(x.lignes.split(';').slice(0, 3).join(' · '))}` : ''}</b> ${esc(x.nom)}`, esc(dist(x.m))));
  if (p?.velo) trans.push(li(`<b class="ligne velo">${esc(t.velo)}</b> ${esc(p.velo.nom)}`, esc(dist(p.velo.m))));
  if (p?.taxi) trans.push(li(`<b class="ligne taxi">${esc(t.taxi)}</b> ${esc(p.taxi.nom)}`, esc(dist(p.taxi.m))));
  return `<div class="y-aller"><p class="pied-titre">${esc(t.yAller)}</p>
    ${parkings.length ? `<p class="y-titre">${esc(t.seGarer)}</p><ul>${parkings.join('')}</ul>` : ''}
    ${trans.length ? `<p class="y-titre">${esc(t.enTransports)}</p><ul>${trans.join('')}</ul>` : ''}
    ${s.lat && !s.approx ? `<div class="mini-carte" data-lat="${s.lat}" data-lng="${s.lng}" data-nom="${esc(lieu)}" role="img" aria-label="${esc(`${t.yAller} : ${lieu}`)}"></div>` : ''}
    <p class="y-liens"><a class="lien" href="https://www.google.com/maps/dir/?api=1&amp;destination=${dest}&amp;travelmode=transit" target="_blank" rel="noopener">${esc(t.itiTransports)}</a></p>
    <p class="y-note">${esc(t.rentrer)}</p></div>`;
}

// Rubriques « Pour un date », « Restos », « Activités » : partenaires identifiés et classés.
function pageSorties({ lang, t, tr, base, compte, T, chemin, maj, partenaires, cleS }) {
  const C = SORTIES[cleS], handle = compte.replace(/^@/, '');
  // Seulement la région (Côte d'Azur, Var, Monaco) et une seule fiche par lieu (un même lieu a parfois deux comptes Instagram).
  const region = (p) => !p.ville || CENTRES.some(([re]) => re.test(p.ville));
  const nomN = (p) => sansAccent(p.nom).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const l = [];
  for (const p of (partenaires || []).filter((x) => x.nom && x.categorie && C.filtre(x) && region(x))) {
    const d = l.find((q) => q.categorie === p.categorie && (q.ville || '') === (p.ville || '') && (nomN(q).startsWith(nomN(p)) || nomN(p).startsWith(nomN(q)) || (p.site && q.site && p.site.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] === q.site.replace(/^https?:\/\/(www\.)?/, '').split('/')[0])));
    if (!d) { l.push({ ...p }); continue; }
    if (nomN(p).length < nomN(d).length) d.nom = p.nom; // le nom le plus court (« Great Game » plutôt que « Great Game Party Room »)
    for (const k of ['instagram', 'site', 'fichier', 'adresse', 'prix']) d[k] ||= p[k];
    if ((p.description || '').length > (d.description || '').length) d.description = p.description;
  }
  const ICO = { ig: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.3" fill="currentColor"/></svg>',
    site: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.5" fill="currentColor"/></svg>' };
  const carteP = (p, i) => `<article class="fiche-lieu" style="--i:${i % 8}" data-ville-nom="${esc(p.ville || '')}">
    <div class="fiche-banniere"${p.fichier ? ` style="--fond:url('${base}${esc(p.fichier)}')"` : ''}>${p.fichier ? `<img src="${base}${esc(p.fichier)}" alt="" width="88" height="88" loading="lazy">` : `<span class="lieu-initiale">${esc((p.nom[0] || '?').toUpperCase())}</span>`}</div>
    <div class="fiche-corps">
    <p class="genre">${esc(tr(SORTIES.categories[p.categorie] || ''))}${p.ville ? ` · ${esc(p.ville)}` : ''}${p.prix ? ` <span class="fiche-prix">${esc(p.prix.replace(/\s+/g, ''))}</span>` : ''}</p>
    <h3>${esc(p.nom)}</h3>
    ${p.description ? `<p class="fiche-desc">${esc(tr(p.description))}</p>` : ''}
    ${cleS === 'dates' && p.date_raison ? `<p class="petit">♥ ${esc(tr(p.date_raison))}</p>` : ''}
    <p class="lieu-actions">${p.instagram ? `<a href="https://www.instagram.com/${esc(p.instagram)}/" target="_blank" rel="noopener" aria-label="Instagram @${esc(p.instagram)}">${ICO.ig}<span>Instagram</span></a>` : ''}${p.site ? `<a href="${esc(p.site)}" target="_blank" rel="noopener">${ICO.site}<span>${esc(t.siteWeb)}</span></a>` : ''}${p.adresse || p.ville ? `<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent([p.nom, p.adresse, p.ville].filter(Boolean).join(', '))}" target="_blank" rel="noopener">${ICO.map}<span>${esc(t.itineraire)}</span></a>` : ''}</p>
    </div>
  </article>`;
  const ICONES = ['🌅', '🌊', '🌿', '🎨', '⛵'];
  const spots = cleS === 'dates' ? SPOTS_DATE.map((g, k) => `<section class="bloc-large reveal"><h2>${ICONES[k] || '✦'} ${esc(tr(g.titre))}</h2><div class="spots">${g.lieux.map(([nom, ville, texte], i) => { const ph = PHOTOS_SPOTS[nom] || photoVille(ville); return `<article class="spot-carte${ph ? '' : ' sans-photo'}" style="--i:${i}">${ph ? `<figure class="spot-photo">${image(base, ph.fichier, { alt: `${nom}, ${ville}`, sizes: '(min-width:980px) 380px, 92vw', attrs: 'loading="lazy" decoding="async" width="800" height="533"' })}<figcaption>${esc(tr(PHOTOS_SPOTS[nom] ? 'Photo' : 'Photo de la ville'))} : ${esc(ph.auteur)} · <a href="${esc(ph.source)}" target="_blank" rel="noopener nofollow">${esc(ph.licence)}</a></figcaption></figure>` : `<span class="spot-vignette" aria-hidden="true">${ICONES[k] || '✦'}</span>`}<div class="spot-corps"><p class="genre">${esc(ville)}</p><h3>${esc(nom)}</h3><p>${esc(tr(texte))}</p><p class="lieu-actions"><a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(`${nom}, ${ville}`)}" target="_blank" rel="noopener">${ICO.map}<span>${esc(t.itineraire)}</span></a></p></div></article>`; }).join('')}</div></section>`).join('\n') : '';
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, images: cleS === 'dates' ? Object.values(PHOTOS_SPOTS).map((x) => x.fichier) : null, logos: cleS === 'dates' ? null : (() => { const lg = l.filter((x) => x.fichier).map((x) => x.fichier); return lg.length >= 4 ? lg : null; })(), alt: tr(C.etiquette), etiquette: tr(C.etiquette), h1: tr(C.h1), p: esc(tr(C.p)), k: 8 + Object.keys(SORTIES).indexOf(cleS) })}
${spots}
<section class="bloc-large reveal">${l.length ? `<h2>${tr('Les bonnes adresses de nos <em>partenaires</em>')}</h2>` : ''}${l.length ? `<div class="fiches" data-grouper="1">${l.map(carteP).join('')}</div>` : cleS === 'dates' ? '' : `<p class="vide">${esc(tr(SORTIES.vide))}</p>`}${ctaIg(handle, t.orgaBouton, T.email)}</section>`;
  return gabarit({ lang, t, titre: tr(C.titre), description: tr(C.desc), chemin, base, corps, compte, maj, image: cleS === 'dates' ? Object.values(PHOTOS_SPOTS)[0]?.fichier : undefined, ld: [...ldOrganisation(T, compte, t, lang), fil(lang, [['Teufy', ''], [tr(C.etiquette), chemin]]),
    ...(l.length ? [{ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: l.map((p, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': p.categorie === 'restaurant' ? 'Restaurant' : 'LocalBusiness', name: p.nom, ...(p.adresse || p.ville ? { address: { '@type': 'PostalAddress', streetAddress: p.adresse || undefined, addressLocality: p.ville || undefined } } : {}), ...(p.site ? { url: p.site } : {}) } })) }] : [])] });
}

function pageFestivals({ lang, t, tr, base, compte, T, chemin, soirees, maj, festivalsGuide, partenaires }) {
  const recherche = (n) => `https://www.google.com/search?q=${encodeURIComponent(`${n} site officiel`)}`;
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, images: soirees.filter((x) => x.affiche).map((x) => x.affiche), alt: t.festivals, k: 1, etiquette: t.festivals, h1: t.festH1, p: esc(t.festP) })}
<section class="bloc-large reveal"><h2>${t.festAgendaH2}</h2>${soirees.length ? `<div class="grille">${soirees.map((s) => carte(s, { t, base, lang })).join('')}</div>` : `<p class="vide">${esc(t.festAgendaVide)}</p>`}</section>
${(festivalsGuide || []).length ? (() => {
  const parts = new Set((partenaires || []).map((p) => (p.instagram || '').toLowerCase()).filter(Boolean));
  const fmt = (d) => paris(`${d}T12:00:00Z`, { day: 'numeric', month: 'long', year: 'numeric' }, t.locale);
  const carteF = (f, i) => `<article class="carte-texte festival${parts.has(f.instagram) ? ' partenaire' : ''}" style="--i:${i % 8}"><p class="genre">${f.debut_prochaine ? esc(fmt(f.debut_prochaine)) : esc(tr(f.periode || ''))} · ${esc(f.ville)}${parts.has(f.instagram) ? ` · ${esc(t.partenaires)}` : ''}</p><h3>${esc(f.nom)}</h3>${f.styles ? `<p class="petit">${esc(tr(f.styles))}</p>` : ''}${f.description ? `<p>${esc(tr(f.description))}</p>` : ''}<p class="lieu-liens">${f.site ? `<a class="lien" href="${esc(f.site)}" target="_blank" rel="noopener">${esc(t.siteOfficiel)}</a>` : `<a class="lien" href="${recherche(f.nom)}" target="_blank" rel="noopener">${esc(t.siteOfficiel)}</a>`}${f.instagram ? `<a class="lien" href="https://www.instagram.com/${esc(f.instagram)}/" target="_blank" rel="noopener">@${esc(f.instagram)}</a>` : ''}</p></article>`;
  const tri = (a, b) => (a.debut_prochaine || '9999').localeCompare(b.debut_prochaine || '9999');
  const ete = festivalsGuide.filter((f) => f.saison !== 'annee').sort(tri), annee = festivalsGuide.filter((f) => f.saison === 'annee').sort(tri);
  return `${ete.length ? `<section class="bloc-large reveal"><h2>${t.festGuideH2}</h2><div class="cartes-texte">${ete.map(carteF).join('')}</div></section>` : ''}${annee.length ? `<section class="bloc-large reveal"><h2>${tr("Toute l'<em>année</em>")}</h2><div class="cartes-texte">${annee.map(carteF).join('')}</div></section>` : ''}`;
})() : `<section class="bloc-large reveal"><h2>${t.festGuideH2}</h2><div class="cartes-texte">${FESTIVALS.map((f, i) => `<article class="carte-texte" style="--i:${i}"><p class="genre">${esc(tr(f.quand))} · ${esc(f.ville === 'Partout' ? tr(f.ville) : f.ville)}</p><h3>${esc(f.nom)}</h3><p class="petit">${esc(tr(f.style))}</p><p>${esc(tr(f.texte))}</p><a class="lien" href="${recherche(f.nom)}" target="_blank" rel="noopener">${esc(t.siteOfficiel)}</a></article>`).join('')}</div></section>`}
<section class="bloc-large reveal"><h2>${t.festRdvH2}</h2><div class="cartes-texte">${RENDEZ_VOUS.map((f, i) => `<article class="carte-texte" style="--i:${i}"><p class="genre">${esc(tr(f.quand))}${f.ville ? ` · ${esc(f.ville)}` : ''}</p><h3>${esc(f.nom)}</h3><p>${esc(tr(f.texte))}</p></article>`).join('')}</div><p class="avert">${esc(t.festAvert)}</p></section>
${blocOrga({ t, tr, base, handle: compte.replace(/^@/, ''), lang })}`;
  return gabarit({ lang, t, titre: t.festTitre, description: t.festDesc, chemin, base, corps, compte, maj, image: soirees.find((x) => x.affiche)?.affiche, ld: [...ldOrganisation(T, compte, t, lang), ...jsonld(soirees, lang), fil(lang, [['Teufy', ''], [t.festivals, chemin]])] });
}

// --- Flux Instagram du compte ----------------------------------------------------------------------------------
const FLUX = path.join(ROOT, 'contenus', 'insta-flux.json');
async function fluxInstagram({ hist, ig, api, log }) {
  const dossier = path.join(SITE, 'img', 'insta');
  await mkdir(dossier, { recursive: true });
  let flux = lire(FLUX, []);
  if (ig && api.compteMedia) {
    try {
      const m = await api.compteMedia(ig, 12, 'media_url,thumbnail_url');
      const nouveaux = [];
      for (const x of m) {
        const src = x.media_type === 'VIDEO' ? x.thumbnail_url : x.media_url;
        const f = path.join(dossier, `${x.id}.jpg`);
        if (!existsSync(f) && !(src && await telecharger(src, f))) continue;
        webp(f, 480); webp(f, 800);
        nouveaux.push({ id: x.id, lien: x.permalink, image: path.relative(ROOT, f), reel: x.media_product_type === 'REELS' || x.media_type === 'VIDEO', carrousel: x.media_type === 'CAROUSEL_ALBUM', titre: String(x.caption || '').split('\n')[0].slice(0, 120), date: x.timestamp });
      }
      if (nouveaux.length) { flux = nouveaux; await writeFile(FLUX, JSON.stringify(flux, null, 1) + '\n'); }
    } catch (e) { log(`Site : flux Instagram non lu (${e.message})`); }
  }
  flux = flux.filter((x) => existsSync(path.join(ROOT, x.image)));
  if (flux.length >= 3) return flux.slice(0, 12);
  // Secours : couvertures gardées dans media/ par l'historique de publication.
  const vus = new Set();
  return hist.filter((x) => x.lien).slice(-12).reverse().map((x) => {
    const id = x.id; const p = lire(path.join(ROOT, 'media', id, 'publication.json'), null);
    const img = p ? (p.couverture || p.images?.[0]) : null;
    return { lien: x.lien, titre: (x.titre || x.publication?.titre || '').replace(/[[\]]/g, ''), image: img ? `media/${id}/${img}` : '', reel: /reel/.test(x.publication?.type || '') };
  }).filter((x) => x.image && existsSync(path.join(ROOT, x.image)) && !vus.has(x.image) && vus.add(x.image));
}
function grilleInsta(posts, { t, base, compte }) {
  if (!posts.length) return '';
  const handle = compte.replace(/^@/, '');
  const img = (p) => {
    const w = [480, 800].map((l) => p.image.replace(/\.jpg$/, `-${l}.webp`)).filter((f) => existsSync(path.join(ROOT, f)));
    return w.length ? `<img src="${base}${w.at(-1)}" srcset="${w.map((f) => `${base}${f} ${largeurWebp(path.join(ROOT, f))}w`).join(', ')}" sizes="(min-width:980px) 300px, 33vw" alt="${esc(p.titre)}" width="480" height="600" loading="lazy" decoding="async">` : `<img src="${base}${esc(p.image)}" alt="${esc(p.titre)}" width="480" height="600" loading="lazy" decoding="async">`;
  };
  return `<section class="insta reveal"><div class="insta-tete"><h2>${esc(t.insta)}</h2><a class="insta-compte" href="https://www.instagram.com/${esc(handle)}/" target="_blank" rel="noopener"><img src="${base}site/img/logo-96.webp" alt="" width="40" height="40">${esc(compte)}</a></div>
<div class="posts n${Math.min(posts.length, 9)}">${posts.slice(0, 9).map((p) => `<a href="${esc(p.lien)}" target="_blank" rel="noopener"${p.reel ? ' class="reel"' : p.carrousel ? ' class="carrousel"' : ''}>${img({ ...p, titre: p.titre ? '' : 'Instagram' })}${p.titre ? `<span>${esc(p.titre)}</span>` : ''}</a>`).join('')}</div>
<a class="bouton" href="https://www.instagram.com/${esc(handle)}/" target="_blank" rel="noopener">${esc(t.suivreInsta || compte)}</a></section>`;
}

// --- Images des actus -------------------------------------------------------------------------------------------
const MOTS_VIDES = new Set('les des une pour avec dans sur par aux ses son est sont qui que nice cannes monaco antibes soirée soirees soirée festival club cette edition édition premier première nouveau nouvelle annonce annoncé confirmé janvier fevrier mars avril juin juillet aout septembre octobre novembre decembre lundi mardi mercredi jeudi vendredi samedi dimanche veille jour ferie ferié soir nuit electro techno house party night collectif events event edition programme programmation invite invités artiste artistes producteur attendu convie prochain prochaine retour'.split(' '));
async function imagesActus(actus, { soirees, hist }) {
  const dossier = path.join(SITE, 'img', 'actus');
  await mkdir(dossier, { recursive: true });
  const pub = lire(path.join(ROOT, 'media', 'veille', 'publication.json'), null);
  const GENERIQUES = /^(\d+|palais|festival|festivals|salle|club|soiree|soirees|nuit|plage|plages|theatre|arena|centre|scene|live|tour|edition|concert|novembre|decembre|janvier|fevrier)$/;
  const mots = (x) => new Set(sansAccent(String(x || '')).toLowerCase().split(/[^a-z0-9]+/).filter((m) => m.length > 3 && !MOTS_VIDES.has(m) && !GENERIQUES.test(m)));
  const illustrees = new Set();
  for (const a of actus) {
    const f = path.join(dossier, `${h(a.source || a.cle)}.jpg`);
    a.visuel = false;
    // 1. Le visuel « Info de dernière minute » publié par la veille pour cette actu.
    if (!existsSync(f) && pub?.veille?.source && pub.veille.source === a.source) {
      const v = path.join(ROOT, 'media', 'veille', pub.images?.[0] || '');
      if (pub.images?.[0] && existsSync(v)) spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', v, '-vf', "scale='min(1080,iw)':-2", '-q:v', '3', f]);
    }
    if (existsSync(f)) { a.image_site = path.relative(ROOT, f); a.visuel = true; a.dims = [1080, 1350]; }
    // 2. L'affiche d'une soirée à venir dont l'actu parle (artiste, lieu ou nom en commun).
    if (!a.image_site) {
      const m = mots(`${a.titre} ${a.chapo}`);
      const s = soirees.filter((x) => x.affiche).map((x) => ({ x, n: [...mots(`${x.nom} ${x.lieu}`)].filter((w) => m.has(w)).length })).sort((p, q) => q.n - p.n)[0];
      // Au moins 2 mots distinctifs en commun : un seul (« Palais », « Festival ») collait une affiche sans rapport.
      if (s?.n >= 2) { a.image_site = s.x.affiche; a.soiree = s.x.id; a.dims = s.x.dims; }
    }
    // 3. L'image de la source (téléchargée une fois : les liens Instagram expirent).
    if (!a.image_site && /^https?:/.test(a.image || '')) {
      const g = path.join(dossier, `${h(a.image)}-src.jpg`);
      if (existsSync(g) || await telecharger(a.image, g)) a.image_site = path.relative(ROOT, g);
    }
    // 4. L'image de partage officielle (og:image) de l'article source.
    if (!a.image_site && /^https?:/.test(a.source || '')) {
      const g = path.join(dossier, `${h(a.source)}-og.jpg`);
      const u = existsSync(g) ? '' : await imageDePartage(a.source);
      if (existsSync(g) || (u && await telecharger(u, g))) { a.image_site = path.relative(ROOT, g); a.dims = tailleJpeg(g) || undefined; }
    }
    // 5. Toujours une image : photo d'illustration de la ville de l'actu (Nice pour la Côte d'Azur ou la France),
    //    signalée « Photo d'illustration » sur la page de l'actu.
    if (!a.image_site) {
      // Jamais deux fois la même photo d'illustration : la ville de l'actu si elle est libre, sinon une autre ville de la Côte.
      const P = (v) => path.join(SITE, 'img', 'villes', `${v}.jpg`);
      const choix = [slug(a.ville || ''), 'nice', 'cannes', 'monaco', 'antibes', 'menton', 'villefranche-sur-mer', 'saint-tropez', 'toulon', 'frejus', 'hyeres', 'cagnes-sur-mer'].filter((v) => v && existsSync(P(v)));
      const f = P(choix.find((v) => !illustrees.has(v)) || choix[0] || 'nice');
      if (existsSync(f)) { illustrees.add(path.basename(f, '.jpg')); a.image_site = path.relative(ROOT, f); a.dims = tailleJpeg(f) || undefined; a.illustration = true; }
    }
    if (a.image_site && !/affiches/.test(a.image_site)) for (const l of [400, 800, 1200]) webp(path.join(ROOT, a.image_site), l);
    const post = hist.find((x) => x.lien && x.publication?.veille?.source && x.publication.veille.source === a.source);
    if (post) a.insta = post.lien;
  }
  return actus;
}
function imageActu(a, { base, cadre = true, sizes = '(min-width:980px) 560px, 92vw', attrs = 'loading="lazy" decoding="async"' } = {}) {
  if (!a.image_site) return `<span class="actu-flash" aria-hidden="true"><b>${esc(a.ville || 'Teufy')}</b></span>`;
  // Dans les cartes, le cadre est en 4/5 : une image en paysage y est recadrée donc agrandie ; on demande la taille réelle affichée.
  const f = cadre && a.dims ? Math.max(1, 1.25 * a.dims[0] / a.dims[1]) : 1;
  if (f > 1) sizes = sizes.replace(/(\d+)(px|vw)/g, (_, n, u) => `${Math.round(n * f)}${u}`);
  return image(base, a.image_site, { alt: a.titre, sizes, attrs: `${attrs}${a.dims ? ` width="${a.dims[0]}" height="${a.dims[1]}"` : ''}` });
}
const dateActu = (a, t) => { const d = Date.parse(a.date); return isNaN(d) ? '' : paris(d, { day: 'numeric', month: 'long', year: 'numeric' }, t.locale); };
function pageActus({ lang, t, tr, base, compte, T, chemin, actus, maj }) {
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, images: actus.filter((a) => a.image_site).map((a) => a.image_site), alt: t.actus, k: 2, etiquette: t.actus, h1: t.actusH1, p: esc(t.actusP) })}
<section class="bloc-large reveal"><h2 class="vh">${esc(t.actus)}</h2>${actus.length ? `<div class="actus">${actus.map((a, i) => `<a class="actu${i === 0 ? ' une' : ''}" href="${base}${pre(lang)}actus/${a.id}/" style="--i:${i % 6}"><span class="actu-img${a.visuel ? ' visuel' : ''}">${imageActu(a, { base, sizes: i === 0 ? '(min-width:980px) 560px, 92vw' : undefined, ...(i === 0 ? { attrs: 'decoding="async" fetchpriority="high"' } : {}) })}</span><p class="genre">${esc(dateActu(a, t))}${a.ville ? ` · ${esc(tr(a.ville))}` : ''}</p><h3>${esc(tr(a.titre))}</h3><p>${esc(tr(a.chapo))}</p><b>${esc(t.lire)} →</b></a>`).join('')}</div>` : `<p class="vide">${esc(t.actusVide)}</p>`}</section>`;
  return gabarit({ lang, t, titre: t.actusTitre, description: t.actusDesc, chemin, base, corps, compte, maj, image: actus.find((a) => a.image_site)?.image_site, ld: [...ldOrganisation(T, compte, t, lang), fil(lang, [['Teufy', ''], [t.actus, chemin]])] });
}
function pageActu({ lang, t, tr, base, compte, chemin, a, actus, maj }) {
  const autres = actus.filter((x) => x.id !== a.id).slice(0, 3);
  const corps = `<article class="article">
  <nav class="ariane"><a href="${base}${pre(lang)}">Teufy</a> › <a href="${base}${pre(lang)}actus/">${esc(t.actus)}</a></nav>
  <p class="genre">${esc(t.publie.replace('{d}', dateActu(a, t)))}${a.ville ? ` · ${esc(tr(a.ville))}` : ''}</p>
  <h1>${esc(tr(a.titre))}</h1>
  <p class="chapo">${esc(tr(a.chapo))}</p>
  <p class="actu-partage">${boutonPartage(t.partager)}<span>${esc(t.partager)}</span></p>
  ${a.image_site ? `<figure class="actu-figure${a.visuel ? ' visuel' : ''}">${imageActu(a, { base, cadre: false, sizes: '(min-width:760px) 680px, 92vw', attrs: 'decoding="async"' })}${a.illustration ? `<figcaption>${esc(tr("Photo d'illustration"))}</figcaption>` : ''}</figure>` : ''}
  ${a.paragraphes.map((p) => `<p>${esc(tr(p))}</p>`).join('\n  ')}
  ${a.soiree ? `<p><a class="bouton" href="${base}${pre(lang)}soiree/${a.soiree}/">${esc(t.voir)}</a></p>` : ''}
  ${a.insta ? `<p><a class="bouton" href="${esc(a.insta)}" target="_blank" rel="noopener">${esc(t.voirInsta)}</a></p>` : ''}
  <p class="source">${esc(t.source)} : <a href="${esc(a.source)}" target="_blank" rel="noopener nofollow">${esc((() => { try { return new URL(a.source).hostname.replace(/^www\./, ''); } catch { return a.source; } })())}</a></p>
</article>
${autres.length ? `<section class="bloc-large reveal"><h2>${esc(t.autresActus)}</h2><div class="actus">${autres.map((x) => `<a class="actu" href="${base}${pre(lang)}actus/${x.id}/"><span class="actu-img${x.visuel ? ' visuel' : ''}">${imageActu(x, { base })}</span><p class="genre">${esc(dateActu(x, t))}</p><h3>${esc(tr(x.titre))}</h3><b>${esc(t.lire)} →</b></a>`).join('')}</div></section>` : ''}`;
  return gabarit({ lang, t, titre: `${tr(a.titre)} · Teufy`, description: tr(a.chapo), chemin, base, corps, compte, maj, image: a.image_site ? `${URL_SITE}${a.image_site}` : undefined,
    ld: [{ '@context': 'https://schema.org', '@type': 'NewsArticle', headline: tr(a.titre).slice(0, 110), datePublished: a.date, dateModified: a.ajout || a.date, inLanguage: lang, description: tr(a.chapo), isBasedOn: a.source, publisher: { '@type': 'Organization', name: 'Teufy', logo: { '@type': 'ImageObject', url: `${URL_SITE}site/img/logo.png` } }, author: { '@type': 'Organization', name: 'Teufy', url: URL_SITE } }, fil(lang, [['Teufy', ''], [t.actus, 'actus/'], [tr(a.titre), chemin]])] });
}

// Vitrine : les partenaires déjà identifiés (photo, nom, type, ville), triés pour montrer d'abord les lieux.
function vitrine({ t, tr, base, partenaires }) {
  const ordre = ['club', 'bar', 'rooftop', 'beach-club', 'restaurant', 'activite', 'festival', 'organisateur', 'artiste', 'hotel', 'media', 'marque', 'service', 'autre', undefined];
  const l = (partenaires || []).filter((p) => p.nom && p.fichier).sort((a, b) => (!!b.payant - !!a.payant) || (ordre.indexOf(a.categorie) - ordre.indexOf(b.categorie))); // partenaires payants en tête
  if (!l.length) return '';
  return `<section class="bloc-large vitrine reveal"><h2>${t.vitrineH2}</h2><p class="avert">${esc(t.vitrineN.replace('{n}', Math.max(l.length, +((partenaires || []).length))))}</p>
  ${(() => { // 20 visibles (rangées pleines en 2, 4 ou 5 colonnes), le reste dans un dépliant : 167 lignes faisaient une page interminable sur mobile
    const item = (p, i) => `<${p.instagram ? `a href="https://www.instagram.com/${esc(p.instagram)}/" target="_blank" rel="noopener"` : 'div'} class="vitrine-item${p.payant ? ' payant' : ''}" style="--i:${i % 12}"><img src="${base}${esc(p.fichier)}" alt="" width="64" height="64" loading="lazy"><span><strong>${esc(p.nom)}</strong><small>${esc([p.categorie ? tr(SORTIES.categories[p.categorie] || '') : '', p.ville].filter(Boolean).join(' · '))}</small></span></${p.instagram ? 'a' : 'div'}>`;
    const N = 20;
    return `<div class="vitrine-grille">${l.slice(0, N).map(item).join('')}</div>${l.length > N ? `<details class="logos-plus"><summary>${esc(tr('Voir tous les partenaires'))} <span>+${l.length - N}</span></summary><div class="vitrine-grille">${l.slice(N).map(item).join('')}</div></details>` : ''}`; })()}</section>`;
}

// Clubs & bars : tendance du moment puis annuaire par ville.
const TYPES_NOMS = { club: 'Club', bar: 'Bar', rooftop: 'Rooftop', 'beach-club': 'Beach club', 'bar-a-cocktails': 'Bar à cocktails', pub: 'Pub', lounge: 'Lounge', salle: 'Salle de concert' };
const ICO_LIEU = { ig: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.3" fill="currentColor"/></svg>',
  site: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.5" fill="currentColor"/></svg>' };
// Fiche d'un club ou d'un bar : même style que les fiches Restos / Activités (bannière, logo, boutons).
// Filtre « Boîtes de nuit / Bars » (13/11/2026, directeur : « voir rapidement quels clubs sont ouverts ce soir »).
const EST_CLUB = (l) => l.type === 'club';
const VILLES_VAR_SLUGS = ['toulon', 'la-seyne-sur-mer', 'hyeres', 'six-fours-les-plages', 'sanary-sur-mer', 'bandol', 'frejus', 'saint-raphael', 'saint-tropez', 'sainte-maxime', 'draguignan'];
function filtreTypes(L, tr) {
  const n = L.filter(EST_CLUB).length;
  if (!n || n === L.length) return '';
  return `<p class="liens-styles filtre-types" role="group" aria-label="${esc(tr('Type de lieu'))}"><button type="button" class="puce actif" data-type-lieu="">${esc(tr('Tout'))} · ${L.length}</button><button type="button" class="puce" data-type-lieu="club">${esc(tr('Boîtes de nuit'))} · ${n}</button><button type="button" class="puce" data-type-lieu="bar">${esc(tr('Bars'))} · ${L.length - n}</button></p>`;
}
const avantageDe = (l) => AVANTAGES.find((a) => (a.instagram && a.instagram === l.instagram) || normLieu(a.partenaire_nom) === normLieu(l.nom));
function carteLieu(l, { t, tr, base, lang }, i = 0, tendance = false) {
  const prochaines = l.prochaines || [];
  const raison = l.insta && l.insta.posts21 ? `${tr('Sur ses publications des 3 dernières semaines')} : ${l.insta.likes} ${tr('likes')} · ${l.insta.commentaires} ${tr('commentaires en moyenne')} · ${l.insta.posts21} ${tr('posts')}` : '';
  const H = lireHoraires(l.details?.horaires);
  return `<article class="fiche-lieu${tendance ? ' tendance' : ''}" id="${esc(l.slug)}" style="--i:${i % 8}" data-type="${esc(l.type)}" data-ville="${esc(slug(l.ville || ''))}" data-ville-nom="${esc(l.ville || '')}"${H ? ` data-horaires="${esc(JSON.stringify(H.plages))}"${H.saison ? ' data-saison="1"' : ''}` : ''}${l.soirs?.length ? ` data-soirs="${esc(JSON.stringify(l.soirs))}"` : ''}>
    ${(() => { /* Bandeau : la vraie photo du lieu (sa publication Instagram la plus aimée) ; sinon son logo flouté ;
      jamais un paysage de la ville. */ const couv = l.instagram ? `site/lieux/${l.instagram.replace(/[^a-z0-9._-]/g, '')}-couv-800.webp` : '';
      const aCouv = couv && existsSync(path.join(ROOT, couv)) && !ressembleAffiche(path.join(ROOT, couv.replace(/-800\.webp$/, '.jpg'))); // jamais une affiche en bandeau de lieu
      return `<div class="fiche-banniere${aCouv ? ' banniere-photo' : l.photo ? '' : ` banniere-neutre type-${esc(l.type || 'bar')}`}"${aCouv ? ` style="--fond:url('${base}${esc(couv)}')"` : l.photo ? ` style="--fond:url('${base}${esc(l.photo)}')"` : ''}>`; })()}${tendance ? `<span class="rang">#${i + 1}</span>` : ''}${l.photo ? `<img src="${base}${esc(l.photo)}" alt="" width="88" height="88" loading="lazy">` : `<span class="lieu-icone"><svg viewBox="0 0 24 24" width="52" height="52" aria-hidden="true">${ICO_TARD[l.type === 'club' ? 'verre' : ['restaurant'].includes(l.type) ? 'couverts' : 'verre']}</svg></span>`}</div>
    <div class="fiche-corps">
    <p class="genre">${esc(tr(TYPES_NOMS[l.type] || ''))}${l.ville ? ` · ${esc(l.ville)}` : ''}${l.partenaire ? ` <span class="fiche-prix">${esc(t.partenaires)}</span>` : ''}</p>
    <h3><a href="${base}${pre(lang)}clubs-bars/${esc(l.slug)}/">${esc(l.nom)}</a></h3>
    <p class="lieu-statut" hidden></p>
    ${(() => { const a = avantageDe(l); return a ? `<a class="av-bandeau-lieu" href="${base}${pre(lang)}avantages/#${esc(slug(`av-${a.partenaire_nom}`))}"><b>${esc(tr('Avantage Teufy'))}</b> ${esc(tr(a.titre))}</a>` : ''; })()}
    ${l.description ? `<p class="fiche-desc">${esc(tr(l.description))}</p>` : ''}
    ${l.details ? (() => { const d = l.details; const lignes = [[ICO_INFO.musique, tr('Musique'), d.styles], [ICO_INFO.tenue, tr('Dress code'), d.dress_code], [ICO_INFO.horaires, tr('Horaires'), d.horaires && d.horaires.replace(/\b23h5[5-9]\b/g, 'minuit')], [ICO_INFO.verre, tr('Verres'), d.prix_verre], [ICO_INFO.entree, tr('Entrée'), d.entree], [ICO_INFO.age, tr('Âge'), d.age_min]].filter((x) => x[2]); return lignes.length ? `<details class="lieu-pratique"><summary>${esc(tr('Infos pratiques'))}</summary><dl class="lieu-infos">${lignes.map(([i, k, v]) => `<div><dt><span aria-hidden="true">${i}</span> ${esc(k)}</dt><dd>${esc(tr(v))}</dd></div>`).join('')}</dl><p class="lieu-maj">${esc(tr('Infos relevées le'))} ${esc(paris(d.le, { day: 'numeric', month: 'long' }, t.locale))}${d.sources?.[0] ? ` · <a href="${esc(d.sources[0])}" target="_blank" rel="noopener nofollow">${esc(tr('source'))}</a>` : ''}</p></details>` : ''; })() : ''}
    ${raison && tendance ? `<p class="lieu-stats" title="${esc(raison)}"><span class="lieu-stats-titre">${esc(tr('Sur Instagram, en moyenne par post'))}</span><span>${esc(Number(l.insta.likes).toLocaleString(t.locale || 'fr-FR', { maximumFractionDigits: 1 }))} ${esc(tr('likes'))}</span><span>${esc(Number(l.insta.commentaires).toLocaleString(t.locale || 'fr-FR', { maximumFractionDigits: 1 }))} ${esc(tr('commentaires'))}</span><span>${esc(Number(l.insta.posts21).toLocaleString(t.locale || 'fr-FR', { maximumFractionDigits: 1 }))} ${esc(tr('posts en 3 semaines'))}</span></p>` : ''}
    ${prochaines.length ? `<p class="lieu-soirees">${prochaines.slice(0, 3).map((x) => `<a href="${base}${pre(lang)}soiree/${x.id}/">${esc(x.nom)}</a>`).join('')}</p>` : ''}
    <p class="lieu-actions">${l.instagram ? `<a href="https://www.instagram.com/${esc(l.instagram)}/" target="_blank" rel="noopener" aria-label="Instagram @${esc(l.instagram)}">${ICO_LIEU.ig}<span>Instagram</span></a>` : ''}${l.site ? `<a href="${esc(l.site)}" target="_blank" rel="noopener">${ICO_LIEU.site}<span>${esc(t.siteWeb)}</span></a>` : ''}<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent([l.nom, l.adresse, l.ville].filter(Boolean).join(', '))}" target="_blank" rel="noopener">${ICO_LIEU.map}<span>${esc(t.itineraire)}</span></a></p>
    </div>
  </article>`;
}

// Page d'un lieu (club, bar, rooftop…) : statut ouvert ce soir, infos pratiques, prochaines soirées, accès, liens.
// Pour Google : établissement (NightClub / BarOrPub) avec adresse et horaires d'ouverture quand ils sont vérifiés.
const JOURS_SCHEMA = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// « Après ce lieu » (13/11/2026, directeur : « sur la page du Bisous, voir où manger après si je sors à 3 h, ou les
// afters ») : adresses vérifiées les plus proches, avec la distance à pied et l'itinéraire.
const GEO_CACHE = lire(GEO, {});
function coordDe(x) {
  if (x.lat && x.lng) return [+x.lat, +x.lng];
  const g = GEO_CACHE[`${String(x.nom || x.lieu || '').toLowerCase()}|${String(x.ville || '').toLowerCase()}`];
  return g?.lat ? [g.lat, g.lng] : null;
}
const metres = (a, b) => Math.round(Math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * Math.cos(a[0] * Math.PI / 180)));
const distanceTexte = (m) => (m < 1000 ? `${Math.max(50, Math.round(m / 50) * 50)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`);
function blocApres({ nom, coord, ville, tr, base, lang, ctx, sauf = '' }) {
  const proche = (liste, max) => liste.map((x) => ({ x, d: coord && coordDe(x) ? metres(coord, coordDe(x)) : null }))
    .filter((y) => (y.d != null ? y.d <= max : sansAccent(y.x.ville || '') === sansAccent(ville || '')))
    .sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9));
  const manger = proche(TARDIFS.filter((x) => x.type === 'manger-tard'), 3000).slice(0, 4);
  const afters = proche([...TARDIFS.filter((x) => x.type === 'after'), ...LIEUX_TOUS.filter((x) => x.nom !== sauf && (lireHoraires(x.details?.horaires)?.plages || []).some((p) => p.a >= '06:00' && p.a < '12:00'))], 8000).slice(0, 3);
  if (!manger.length && !afters.length) return '';
  const carteP = ({ x, d }, i) => (x.fermetures ? carteTardive(x, tr, i) : carteLieu(x, ctx, i)).replace('<h3>', `${d != null ? `<p class="distance">${esc(distanceTexte(d))} ${esc(tr('à pied ou en VTC'))}</p>` : ''}<h3>`);
  return `<section class="bloc-large apres-lieu"><h2>${tr(`Après ${nom} :`)} <em>${tr('on fait quoi ?')}</em></h2>
${manger.length ? `<h3 class="sous-titre">${esc(tr('Manger en sortant'))}</h3><div class="fiches lieux-tard">${manger.map(carteP).join('')}</div>` : ''}
${afters.length ? `<h3 class="sous-titre">${esc(tr('Finir la nuit : les afters'))}</h3><div class="fiches lieux-tard">${afters.map(carteP).join('')}</div>` : ''}
<p class="cta"><a class="bouton contour" href="${base}${pre(lang)}manger-tard/">${esc(tr('Toutes les adresses pour manger tard'))}</a><a class="bouton contour" href="${base}${pre(lang)}after/">${esc(tr('Tous les afters'))}</a></p></section>`;
}
function pageLieu({ lang, t, tr, base, compte, T, chemin, maj, l, soirees, lieux, toutes = [] }) {
  const d = l.details || {};
  const H = lireHoraires(d.horaires);
  const type = TYPES_NOMS[l.type] || '';
  const voisins = (lieux || []).filter((x) => x !== l && x.ville === l.ville && x.slug).slice(0, 6);
  const infos = [[ICO_INFO.musique, tr('Musique'), d.styles], [ICO_INFO.tenue, tr('Dress code'), d.dress_code], [ICO_INFO.horaires, tr('Horaires'), d.horaires && d.horaires.replace(/\b23h5[5-9]\b/g, 'minuit')], [ICO_INFO.verre, tr('Verres'), d.prix_verre], [ICO_INFO.entree, tr('Entrée'), d.entree], [ICO_INFO.age, tr('Âge'), d.age_min]].filter((x) => x[2]);
  const carteL = carteLieu(l, { t, tr, base, lang }, 0);
  const statut = carteL.match(/^\s*<article [^>]*>/)[0].replace('class="fiche-lieu', 'class="fiche-lieu lieu-entete');
  const corps = `<div class="fiche lieu-page">
  <nav class="ariane"><a href="${base}${pre(lang)}">Teufy</a> › <a href="${base}${pre(lang)}clubs-bars/">${esc(t.lieuxNav)}</a> › <span>${esc(l.nom)}</span></nav>
  ${statut}
    <div class="lieu-tete">${l.photo ? `<img class="lieu-logo" src="${base}${esc(l.photo)}" alt="${esc(l.nom)}" width="120" height="120">` : ''}<div>
      <p class="genre">${esc(tr(type))}${l.ville ? ` · ${esc(l.ville)}` : ''}${l.partenaire ? ` <span class="fiche-prix">${esc(t.partenaires)}</span>` : ''}</p>
      <h1>${esc(l.nom)}</h1>
      <p class="lieu-statut" hidden></p>
      ${(() => { const a = avantageDe(l); return a ? `<a class="av-bandeau-lieu av-grand" href="${base}${pre(lang)}avantages/#${esc(slug(`av-${a.partenaire_nom}`))}"><b>${esc(tr('Avantage Teufy'))}</b> ${esc(tr(a.titre))}${a.conditions ? ` <small>· ${esc(tr(a.conditions))}</small>` : ''}</a>` : ''; })()}
      ${l.description ? `<p class="chapo">${esc(tr(l.description))}</p>` : ''}</div></div>
  </article>
  </div>
  <div class="lieu-grille">
    <section class="lieu-bloc"><h2>${tr('Infos <em>pratiques</em>')}</h2>${infos.length ? `<dl class="lieu-infos">${infos.map(([i, k, v]) => `<div><dt><span aria-hidden="true">${i}</span> ${esc(k)}</dt><dd>${esc(tr(v))}</dd></div>`).join('')}</dl>${d.sources?.[0] ? `<p class="lieu-maj">${esc(tr('Infos relevées le'))} ${esc(paris(d.le, { day: 'numeric', month: 'long' }, t.locale))} · <a href="${esc(d.sources[0])}" target="_blank" rel="noopener nofollow">${esc(tr('source'))}</a></p>` : ''}` : `<dl class="lieu-infos">${[[ICO_INFO.entree, tr('Type'), tr(type || 'Lieu de sortie')], [ICO_INFO.horaires, tr('Adresse'), l.adresse || l.ville || ''], [ICO_INFO.musique, tr('Programme'), l.instagram ? `${tr('Soirées et horaires annoncés chaque semaine sur')} @${l.instagram}` : soirees?.length ? tr('Voir ses prochaines soirées ci-dessous') : '']].filter((x) => x[2]).map(([i, k, v]) => `<div><dt><span aria-hidden="true">${i}</span> ${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`}
      <p class="lieu-actions">${l.instagram ? `<a href="https://www.instagram.com/${esc(l.instagram)}/" target="_blank" rel="noopener">${ICO_LIEU.ig}<span>Instagram</span></a>` : ''}${l.site ? `<a href="${esc(l.site)}" target="_blank" rel="noopener">${ICO_LIEU.site}<span>${esc(t.siteWeb)}</span></a>` : ''}<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([l.nom, l.adresse || l.ville].filter(Boolean).join(' '))}" target="_blank" rel="noopener">${ICO_LIEU.map}<span>${esc(tr('Itinéraire'))}</span></a></p>
      ${l.adresse ? `<p class="lieu-adresse">${ICO_INFO.lieu}${esc(l.adresse)}</p>` : ''}
    </section>
    ${soirees.length ? `<section class="lieu-bloc"><h2>${tr('Prochaines <em>soirées</em>')}</h2><div class="grille">${soirees.slice(0, 12).map((x) => carte(x, { t, base, lang })).join('')}</div></section>` : (() => { const pres = toutes.filter((x) => l.ville && x.ville === l.ville).slice(0, 6); return pres.length ? `<section class="lieu-bloc"><h2>${tr('Les prochaines soirées à')} <em>${esc(l.ville)}</em></h2><div class="grille">${pres.map((x) => carte(x, { t, base, lang })).join('')}</div></section>` : ''; })()}
  </div>
  ${blocApres({ nom: l.nom, coord: coordDe(l), ville: l.ville, tr, base, lang, ctx: { t, tr, base, lang }, sauf: l.nom })}
  ${voisins.length ? `<section class="bloc-large"><h2>${tr('Ailleurs à')} <em>${esc(l.ville)}</em></h2><div class="fiches">${voisins.map((x, i) => carteLieu(x, { t, tr, base, lang }, i)).join('')}</div></section>` : ''}`;
  const ld = { '@context': 'https://schema.org', '@type': ['club', 'beach-club'].includes(l.type) ? 'NightClub' : 'BarOrPub', name: l.nom, url: `${URL_SITE}${pre(lang)}clubs-bars/${l.slug}/`,
    ...(l.description ? { description: l.description } : {}), ...(l.photo ? { image: URL_SITE + l.photo } : {}),
    address: { '@type': 'PostalAddress', ...(l.adresse ? { streetAddress: l.adresse } : {}), addressLocality: l.ville, addressCountry: /monaco|monte/i.test(l.ville || '') ? 'MC' : 'FR' },
    ...(H && !H.saison ? { openingHoursSpecification: H.plages.map((p) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: p.j.map((j) => JOURS_SCHEMA[j - 1]), opens: p.de, closes: p.a })) } : {}),
    sameAs: [l.instagram && `https://www.instagram.com/${l.instagram}/`, l.site].filter(Boolean),
    ...(soirees.length ? { event: soirees.slice(0, 10).map((x) => ({ '@type': 'Event', name: x.nom, startDate: x.debut, url: `${URL_SITE}${pre(lang)}soiree/${x.id}/` })) } : {}) };
  return gabarit({ lang, t, titre: titreCourt([l.nom, `${tr(type)} à ${l.ville}`, tr('horaires et soirées')]), description: `${l.nom}${l.ville ? `, ${tr(type).toLowerCase()} à ${l.ville}` : ''} : ${tr('ouvert ce soir ?')} ${[(d.horaires || '').replace(/\b23h5[5-9]\b/g, 'minuit'), d.dress_code, d.entree].filter(Boolean).join(' · ') || tr('horaires, prochaines soirées et accès')}. ${soirees.length ? `${pl(soirees.length, 'soirée')} ${tr('à venir')}.` : ''}`.slice(0, 300), chemin, base, corps, compte, maj, rubriqueNav: 'clubs-bars/',
    ld: [...ldOrganisation(T, compte, t, lang), ld, fil(lang, [['Teufy', ''], [t.lieuxNav, 'clubs-bars/'], [l.nom, chemin]])] });
}

// Pages des recherches les plus fréquentes (« soirée ce week-end Nice », « soirée gratuite », « soirée étudiante »,
// « nouvel an Côte d'Azur ») : même agenda, filtré, avec un titre et un texte qui répondent à la question.
const jourParis = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
// Temps forts de l'année : la page existe toute l'année (Google a le temps de la classer), mais elle n'est mise en
// avant (menu, bandeau en haut du site) que pendant sa période. Dates au format MM-JJ, à cheval sur l'année possible.
const SAISONS = [
  { cle: 'halloween', debut: '10-01', fin: '11-01', emoji: '🎃', slug: 'halloween', nom: { fr: 'Halloween', en: 'Halloween', it: 'Halloween', es: 'Halloween', zh: '万圣节', ar: 'الهالوين' } },
  { cle: 'noel', debut: '12-01', fin: '12-26', emoji: '🎄', slug: 'noel', nom: { fr: 'Noël', en: 'Christmas', it: 'Natale', es: 'Navidad', zh: '圣诞节', ar: 'عيد الميلاد' } },
  { cle: 'nouvel-an', debut: '12-15', fin: '01-02', emoji: '🥂', slug: 'nouvel-an', nom: { fr: 'Nouvel an', en: "New Year's Eve", it: 'Capodanno', es: 'Nochevieja', zh: '跨年', ar: 'رأس السنة' } },
  { cle: 'saint-valentin', debut: '02-01', fin: '02-15', emoji: '❤️', slug: 'saint-valentin', nom: { fr: 'Saint-Valentin', en: "Valentine's Day", it: 'San Valentino', es: 'San Valentín', zh: '情人节', ar: 'عيد الحب' } },
  { cle: 'fete-musique', debut: '06-01', fin: '06-22', emoji: '🎶', slug: 'fete-de-la-musique', nom: { fr: 'Fête de la musique', en: 'Fête de la Musique', it: 'Festa della musica', es: 'Fiesta de la música', zh: '音乐节', ar: 'عيد الموسيقى' } },
];
const dansPeriode = (mmjj, debut, fin) => (debut <= fin ? mmjj >= debut && mmjj <= fin : mmjj >= debut || mmjj <= fin);
// Temps fort en cours (le plus précis d'abord : Nouvel an prime sur Noël après le 26).
const saisonActive = (now = Date.now()) => { const mmjj = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', month: '2-digit', day: '2-digit' }).format(now).replace('/', '-'); return [...SAISONS].reverse().find((x) => dansPeriode(mmjj, x.debut, x.fin)) || null; };
const SELECTIONS = [
  { slug: 'ce-week-end', etiquette: 'Ce week-end', h1: 'Que faire <em>ce week-end</em> sur la Côte d\'Azur ?', titre: 'Soirées ce week-end sur la Côte d\'Azur et dans le Var · Teufy',
    intro: "Vendredi, samedi et dimanche : toutes les soirées du week-end à Nice, Cannes, Monaco, Antibes et dans le Var, avec les prix et les billets.",
    garde: (x, now) => {
      const a = jourParis(new Date(now - 6 * 3600e3)), d = Date.parse(`${a}T12:00:00Z`), dow = new Date(d).getUTCDay(); // 0 = dimanche
      const deb = [5, 6, 0].includes(dow) ? a : jourParis(new Date(d + (5 - dow) * 864e5));
      const fin = jourParis(new Date(Date.parse(`${deb}T12:00:00Z`) + ((7 - new Date(`${deb}T12:00:00Z`).getUTCDay()) % 7) * 864e5));
      return x.jour >= deb && x.jour <= fin; } },
  { slug: 'soirees-gratuites', etiquette: 'Gratuit', h1: 'Soirées <em>gratuites</em> et bons plans', titre: 'Soirées gratuites et bons plans sur la Côte d\'Azur · Teufy',
    intro: "Entrée libre, soirées gratuites et petits prix (10 € ou moins) à Nice, Cannes, Monaco, Antibes et dans le Var : sortir sans vider son compte.",
    garde: (x) => x.prix != null && x.prix <= 10 },
  { slug: 'soirees-etudiantes', etiquette: 'Étudiants', h1: 'Soirées <em>étudiantes</em> sur la Côte d\'Azur', titre: 'Soirées étudiantes à Nice, Sophia, Cannes et Monaco · Teufy',
    intro: "Soirées d'intégration, BDE, afterworks et soirées à petit prix pour les étudiants de Nice, Sophia Antipolis, Cannes, Monaco et Toulon.",
    garde: (x) => !!x.etudiant || RE_ETUDIANT.test(`${x.nom} ${x.accroche || ''}`) },
  { slug: 'halloween', etiquette: 'Halloween', h1: 'Soirées d\'<em>Halloween</em> sur la Côte d\'Azur', titre: 'Soirées Halloween à Nice, Cannes, Monaco et Toulon · Teufy',
    intro: "Déguisements, soirées d'horreur et clubs costumés : toutes les soirées d'Halloween de la Côte d'Azur et du Var, ajoutées dès leur annonce.",
    garde: (x) => /halloween|horreur|horror|zombie|monstre/i.test(x.nom) || /-10-3[01]$|-11-01$/.test(x.jour) && /costum|déguis|deguis/i.test(`${x.nom} ${x.accroche || ''}`) },
  { slug: 'noel', etiquette: 'Noël', h1: 'Soirées de <em>Noël</em> sur la Côte d\'Azur', titre: 'Soirées de Noël et des fêtes à Nice, Cannes et Monaco · Teufy',
    intro: "Soirées de Noël, ugly sweater parties et nuits des fêtes : où sortir en décembre sur la Côte d'Azur et dans le Var.",
    garde: (x) => /no[eë]l|christmas|xmas|pull moche|ugly sweater/i.test(x.nom) || /-12-2[45]$/.test(x.jour) },
  { slug: 'saint-valentin', etiquette: 'Saint-Valentin', h1: 'Où sortir pour la <em>Saint-Valentin</em> ?', titre: 'Soirées de la Saint-Valentin sur la Côte d\'Azur · Teufy',
    intro: "Soirées en duo, soirées célibataires et sorties romantiques autour du 14 février à Nice, Cannes, Monaco et dans le Var.",
    garde: (x) => /valentin|valentine|c[ée]libataires?\b/i.test(x.nom) || /-02-14$/.test(x.jour) },
  { slug: 'fete-de-la-musique', etiquette: 'Fête de la musique', h1: '<em>Fête de la musique</em> sur la Côte d\'Azur', titre: 'Fête de la musique à Nice, Cannes, Monaco et Toulon · Teufy',
    intro: "Scènes en plein air, DJ sets et soirées du 21 juin : le programme de la Fête de la musique sur la Côte d'Azur et dans le Var.",
    garde: (x) => /f[eê]te de la musique|fete de la musique/i.test(x.nom) || /-06-21$/.test(x.jour) },
  { slug: 'nouvel-an', etiquette: 'Nouvel an', h1: 'Réveillon du <em>Nouvel an</em> sur la Côte d\'Azur', titre: 'Soirées du Nouvel an à Nice, Cannes, Monaco et Saint-Tropez · Teufy',
    intro: "Où fêter le 31 décembre : soirées du réveillon dans les clubs, rooftops et beach clubs de la Côte d'Azur et du Var, ajoutées dès leur annonce.",
    garde: (x) => /-12-31$|-01-01$/.test(x.jour) || /nouvel an|new year|réveillon|reveillon|nye\b/i.test(x.nom) },
];
function pageSelection({ lang, t, tr, base, compte, T, chemin, maj, sel, soirees }) {
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, images: soirees.filter((x) => x.affiche).map((x) => x.affiche), k: 9, alt: tr(sel.etiquette), etiquette: tr(sel.etiquette), h1: tr(sel.h1), p: `${esc(tr(sel.intro))} ${esc(t.villeN(soirees.length))}` })}
${soirees.length ? agenda(soirees, { t, base, lang }) : `<section class="bloc-large"><p class="vide">${esc(tr("Aucune soirée annoncée pour l'instant : cette page se remplit automatiquement dès qu'une soirée est publiée."))} <a href="${base}${pre(lang)}">${esc(t.toutes)}</a></p></section>`}`;
  return gabarit({ lang, t, titre: tr(sel.titre), description: `${tr(sel.intro)} ${t.villeN(soirees.length)}`.slice(0, 300), chemin, base, corps, compte, maj, rubriqueNav: '', agendaIci: soirees.length > 0,
    ld: [...ldOrganisation(T, compte, t, lang), ...jsonld(soirees, lang), fil(lang, [['Teufy', ''], [tr(sel.etiquette), chemin]])] });
}

// « Où sortir ce soir ? » : les soirées de ce soir et les boîtes / bars ouverts ce soir, statut calculé à l'heure de Paris.
// Répond à « tu sais où je peux sortir ce soir ? » et « telle boîte est ouverte ? ». La page est régénérée chaque jour
// (et à chaque veille) ; le tri des soirées et des lieux ouverts se fait dans le navigateur, à l'heure réelle.
// Fiche d'une adresse de fin de nuit : statut calculé à l'heure du visiteur (mêmes règles que les clubs), horaires et source.
// Icônes dessinées (pas d'emoji) pour les cartes « manger / after » : on voit d'un coup d'œil ce que c'est.
const ICO_TARD = {
  pizza: '<path d="M12 3c4.5 0 8 1.3 8 1.3L12 21 4 4.3S7.5 3 12 3Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="10" cy="9" r="1.3" fill="currentColor"/><circle cx="14" cy="11" r="1.3" fill="currentColor"/><circle cx="12" cy="15" r="1.1" fill="currentColor"/>',
  croissant: '<path d="M3.5 15c2-6 6-9 8.5-9s6.5 3 8.5 9c-2 .5-3.5-.5-4.5-2-1 2.5-2.5 3.5-4 3.5S9 15.5 8 13c-1 1.5-2.5 2.5-4.5 2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 7.5 10.5 12M15 7.5 13.5 12" stroke="currentColor" stroke-width="1.4"/>',
  tasse: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Z M16 10h1.5a2.5 2.5 0 0 1 0 5H16" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 3.5c0 1.5 1.5 1.5 1.5 3M11.5 3.5c0 1.5 1.5 1.5 1.5 3" stroke="currentColor" stroke-width="1.4" fill="none"/>',
  verre: '<path d="M6 4h12l-6 8v7m-3.5 1h7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 7h7" stroke="currentColor" stroke-width="1.4"/>',
  couverts: '<path d="M7 3v8m-2.5-8v5a2.5 2.5 0 0 0 5 0V3M7 11v10M16.5 3c-2 1.5-2.5 4-2.5 7h2.5V21" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
};
const icoTard = (l) => { const c = String(l.categorie || ''); const k = /pizz/i.test(c) ? 'pizza' : /boulang/i.test(c) ? 'croissant' : /caf/i.test(c) ? 'tasse' : l.type === 'after' || /bar|club|pub/i.test(c) ? 'verre' : 'couverts'; return { k, svg: `<svg viewBox="0 0 24 24" width="56" height="56" aria-hidden="true">${ICO_TARD[k]}</svg>` }; };
const carteTardive = (l, tr, i) => { const H = lireHoraires(l.horaires); const carte = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([l.nom, l.adresse, l.ville].filter(Boolean).join(', '))}`;
  const ic = icoTard(l);
  return `<article class="fiche-lieu fiche-tard cat-${ic.k}" style="--i:${i % 8}" data-type="${esc(l.type)}" data-ville="${esc(slug(l.ville || ''))}" data-ville-nom="${esc(l.ville || '')}"${H ? ` data-horaires="${esc(JSON.stringify(H.plages))}"` : ''}${l.fermetures ? ` data-ferme="${esc(JSON.stringify(l.fermetures))}"` : ''}${l.ouvertures ? ` data-ouvre="${esc(JSON.stringify(l.ouvertures))}"` : ''}>
  <div class="tard-bandeau">${ic.svg}${l.ville ? `<span class="tard-ville">${ICO_INFO.lieu}${esc(l.ville)}</span>` : ''}</div>
  <div class="fiche-corps">
  <p class="genre">${esc(tr(l.categorie || (l.type === 'after' ? 'After' : 'Manger tard')))}</p><h3>${esc(l.nom)}</h3>
  <p class="lieu-statut" hidden></p>
  ${l.adresse ? `<p class="tard-adresse">${esc(l.adresse)}</p>` : ''}
  <p class="tard-horaires">${ICO_INFO.horaires}${esc(l.horaires)} · <a href="${esc(l.source)}" target="_blank" rel="noopener">${esc(tr('source'))}</a></p>
  ${l.description ? `<p class="fiche-desc">${esc(tr(l.description))}</p>` : ''}
  <p class="fiche-liens"><a class="bouton petit" href="${esc(carte)}" target="_blank" rel="noopener">${esc(tr('Itinéraire'))}</a>${l.instagram ? `<a class="bouton petit contour" href="https://www.instagram.com/${esc(l.instagram)}/" target="_blank" rel="noopener">Instagram</a>` : ''}</p>
</div></article>`; };
// « Où manger après la boîte » (12/11/2026, demande du directeur : « où manger à 2 h ou 5 h du matin ») : lieux dont
// les horaires publiés (OpenStreetMap) vont après 2 h, filtre « ouvert ce soir jusqu'à 2 h / 3 h / 4 h / 5 h ».
function pageMangerTard({ lang, t, tr, base, compte, T, chemin, maj }) {
  const L = TARDIFS.filter((x) => x.type === 'manger-tard').sort((a, b) => Math.max(...Object.values(b.fermetures || { 0: 0 })) - Math.max(...Object.values(a.fermetures || { 0: 0 })));
  const villes = [...new Set(L.map((l) => l.ville).filter(Boolean))].sort((a, b) => L.filter((l) => l.ville === b).length - L.filter((l) => l.ville === a).length);
  const nb = (v) => L.filter((l) => l.ville === v).length;
  const tard = (v, h) => L.filter((l) => l.ville === v && Math.max(...Object.values(l.fermetures || { 0: 0 })) >= h).map((l) => l.nom).slice(0, 3);
  const faq = [
    [tr('Où manger à 2 h du matin sur la Côte d\'Azur ?'), villes.length ? tr(`Teufy recense ${L.length} adresses ouvertes après 2 h du matin, surtout à ${villes.slice(0, 3).join(', ')}. Choisis « ouvert jusqu'à 2 h » et ta ville en haut de la page : seules celles ouvertes ce soir restent affichées.`) : tr('La liste se remplit chaque jour à partir des horaires publiés sur OpenStreetMap.')],
    [tr('Où manger à 5 h du matin à Nice ?'), tard('Nice', 300).length ? tr(`À Nice, d'après leurs horaires publiés : ${tard('Nice', 300).join(', ')}. Vérifie toujours avant d'y aller, les horaires de nuit changent souvent.`) : tr("Peu d'adresses publient des horaires jusqu'à 5 h à Nice : regarde celles ouvertes jusqu'à 3 h ou 4 h, et les boulangeries qui ouvrent tôt.")],
    [tr('D\'où viennent ces horaires ?'), tr("D'OpenStreetMap, la carte libre tenue par les commerçants et les habitants. Teufy ne garde que les horaires clairs et ne devine rien ; un lien « source » est donné pour chaque adresse.")],
  ];
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, alt: tr('Manger tard'), etiquette: tr('Après la soirée'), h1: tr('Où manger <em>après la boîte</em> ?'), p: esc(tr(`Kebabs, pizzerias, snacks et boulangeries ouverts à 2 h, 3 h, 4 h ou 5 h du matin à Nice, Cannes, Antibes, Monaco, Toulon et dans le Var${L.length ? ` : ${L.length} adresses` : ''}, avec leurs horaires publiés.`)) })}
<section class="bloc-large tard-page" id="manger-tard">
<p class="liens-styles filtre-tard" role="group" aria-label="${esc(tr('Ouvert ce soir jusqu\'à'))}"><span class="filtre-titre">${esc(tr('Ouvert ce soir jusqu\'à'))}</span>${[[0, tr('Toutes')], [120, '2 h'], [180, '3 h'], [240, '4 h'], [300, '5 h et +']].map(([h, x], i) => `<button type="button" class="puce${i ? '' : ' actif'}" data-jusqua="${h}">${esc(x)}</button>`).join('')}</p>
<p class="liens-styles filtre-villes"><button type="button" class="puce actif" data-ville="">${esc(tr('Partout'))}</button>${villes.map((v) => `<button type="button" class="puce" data-ville="${esc(slug(v))}">${esc(v)} · ${nb(v)}</button>`).join('')}</p>
<p class="avert">${esc(tr("Horaires publiés sur OpenStreetMap, relevés chaque jour. Les horaires de nuit changent souvent (jours fériés, saison) : vérifie avant d'y aller."))}</p>
${L.length ? `<div class="fiches lieux-tard" data-grouper="1">${L.map((x, i) => carteTardive(x, tr, i)).join('')}</div><p class="vide" data-aucun-tard hidden>${esc(tr('Aucune adresse ne correspond ce soir : élargis l\'heure ou la ville.'))}</p>` : `<p class="vide">${esc(tr('La liste se remplit : Teufy relève chaque jour les horaires de nuit publiés sur OpenStreetMap.'))}</p>`}
<p class="cta"><a class="bouton contour" href="${base}${pre(lang)}after/">${esc(tr('Pas encore fatigué ? Les afters'))}</a><a class="bouton contour" href="${base}${pre(lang)}ce-soir/">${esc(tr('Où sortir ce soir'))}</a></p></section>
${blocFaq(tr('Manger tard : <em>les questions</em>'), faq)}`;
  return gabarit({ lang, t, titre: tr("Où manger après la boîte : ouvert à 2 h, 3 h, 5 h du matin à Nice, Cannes, Toulon · Teufy"), description: tr(`Kebabs, pizzerias, snacks et boulangeries ouverts tard la nuit sur la Côte d'Azur et dans le Var (${L.length} adresses) : horaires publiés, ouvert ce soir jusqu'à quelle heure, itinéraire.`), chemin, base, corps, compte, maj,
    ld: [...ldOrganisation(T, compte, t, lang), fil(lang, [['Teufy', ''], [tr('Manger tard'), chemin]]), ldFaq(faq), { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: L.slice(0, 60).map((l, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': l.categorie === 'Boulangerie' ? 'Bakery' : l.categorie === 'Restaurant' ? 'Restaurant' : 'FastFoodRestaurant', name: l.nom, ...(l.adresse ? { address: l.adresse } : {}), ...(l.lat ? { geo: { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lng } } : {}) } })) }] });
}
// Afters : soirées qui commencent quand les boîtes ferment (à partir de 4 h) ou qui se disent « after », et lieux dont les
// horaires publiés vont après 5 h (OpenStreetMap, fiches des clubs).
const estAfter = (s) => { const h = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(new Date(s.debut)); return (h >= 4 && h < 11) || /\bafter\b|afterparty|after-party/i.test(s.nom); };
function pageAfter({ lang, t, tr, base, compte, T, chemin, maj, soirees, lieux }) {
  const S = soirees.filter(estAfter);
  const finTard = (l) => { const H = lireHoraires(l.details?.horaires); return (H?.plages || []).some((p) => p.a >= '05:30' && p.a < '12:00'); };
  const clubs = (lieux || []).filter((l) => l.slug && finTard(l));
  const osm = TARDIFS.filter((x) => x.type === 'after' && !clubs.some((c) => normLieu(c.nom) === normLieu(x.nom)));
  const ctx = { t, tr, base, lang };
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, images: S.filter((x) => x.affiche).map((x) => x.affiche), k: 5, alt: 'After', etiquette: tr('After'), h1: tr('Les <em>afters</em> de la Côte d\'Azur'), p: esc(tr("Quand les boîtes ferment, la nuit continue : soirées after à partir de 4 h du matin et lieux ouverts jusqu'au lever du soleil, à Nice, Cannes, Monaco et dans le Var.")) })}
<section class="bloc-large"><h2>${tr('Les soirées <em>after</em>')}</h2>${S.length ? `<div class="grille">${S.map((s) => carte(s, { t, base, lang })).join('')}</div>` : `<p class="vide">${esc(tr("Pas de soirée after annoncée pour l'instant : elles apparaissent ici dès qu'une billetterie les publie."))}</p>`}</section>
${clubs.length ? `<section class="bloc-large"><h2>${tr('Ouverts <em>après 5 h</em>')}</h2><p class="avert">${esc(tr('Horaires relevés sur les sources officielles des lieux : vérifie sur leur Instagram avant d\'y aller.'))}</p><div class="fiches" data-grouper="1">${clubs.map((l, i) => carteLieu(l, ctx, i)).join('')}</div></section>` : ''}
${osm.length ? `<section class="bloc-large"><h2>${tr('Autres adresses <em>jusqu\'au matin</em>')}</h2><div class="fiches lieux-tard" data-grouper="1">${osm.map((x, i) => carteTardive(x, tr, i)).join('')}</div></section>` : ''}
<section class="bloc-large"><p class="cta"><a class="bouton" href="${base}${pre(lang)}manger-tard/">${esc(tr('Une faim de 5 h du matin ? Où manger'))}</a><a class="bouton contour" href="${base}${pre(lang)}ce-soir/">${esc(tr('Où sortir ce soir'))}</a></p></section>`;
  return gabarit({ lang, t, titre: tr("After à Nice, Cannes, Monaco : soirées after et lieux ouverts jusqu'au matin · Teufy"), description: tr("Les afters de la Côte d'Azur et du Var : soirées qui commencent quand les boîtes ferment et lieux ouverts après 5 h du matin, avec horaires et billets."), chemin, base, corps, compte, maj,
    ld: [...ldOrganisation(T, compte, t, lang), fil(lang, [['Teufy', ''], ['After', chemin]]), ...jsonld(S, lang)] });
}
// Avantages Teufy : codes promo et offres des partenaires (verre offert, entrée offerte…), réservés aux lecteurs.
// Source : config.json (codes_promo, avantages) ; une offre expirée disparaît d'elle-même.
// Page d'un code promo (13/11, directeur : « quand on clique sur l'offre de 20 %, pourquoi ça n'affiche pas les soirées
// comme pour le Barathym ? ») : toutes les soirées où le code marche, avec affiches, et le code à copier en haut.
function pageCode({ lang, t, tr, base, compte, T, chemin, maj, code, soirees }) {
  const nom = code.partenaire_nom || `@${code.partenaire}`;
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, images: soirees.filter((x) => x.affiche).map((x) => x.affiche), k: 5, alt: nom, etiquette: tr('Code promo Teufy'), h1: `${esc(code.remise)} <em>${esc(tr('avec Teufy'))}</em>`, p: esc(tr(code.description || '')) })}
<section class="bloc-large"><p class="code-ligne code-grand"><b>${esc(code.remise)}</b><button type="button" class="code" data-copier="${esc(code.code)}">${esc(code.code)} <span>${esc(t.copier)}</span></button></p>${code.conditions ? `<p class="petit">${esc(tr('Conditions'))} : ${esc(tr(code.conditions))}${code.jusqu_au ? ` · ${esc(tr("jusqu'au"))} ${esc(paris(`${code.jusqu_au}T12:00:00Z`, { day: 'numeric', month: 'long', year: 'numeric' }, t.locale))}` : ''}</p>` : ''}</section>
<section class="bloc-large"><h2>${pl(soirees.length, tr('soirée'))} <em>${esc(tr('où le code marche'))}</em></h2><div class="grille">${soirees.map((x) => carte(x, { t, base, lang })).join('')}</div></section>
<section class="bloc-large"><p class="cta"><a class="bouton contour" href="${base}${pre(lang)}avantages/">${esc(tr('Tous les avantages Teufy'))}</a>${code.partenaire ? `<a class="bouton contour" href="https://www.instagram.com/${esc(code.partenaire)}/" target="_blank" rel="noopener">Instagram ${esc(nom)}</a>` : ''}</p></section>`;
  return gabarit({ lang, t, titre: tr(`Code promo ${code.code} : ${code.remise} sur les soirées ${nom} · Teufy`), description: tr(`${code.remise} avec le code ${code.code} sur ${soirees.length} soirées ${nom}. ${code.description || ''}`), chemin, base, corps, compte, maj, ld: [...ldOrganisation(T, compte, t, lang), fil(lang, [['Teufy', ''], [tr('Avantages'), 'avantages/'], [code.code, chemin]])] });
}

function pageAvantages({ lang, t, tr, base, compte, T, chemin, maj, now, lieux, soirees }) {
  // Refonte 13/11/2026 (directeur : « la page ne donne pas envie, mets les logos, l'adresse, mets en avant les partenaires
  // et leurs soirées ») : une carte par partenaire, photo et logo, adresse, ouvert ce soir, prochaines soirées.
  const actifs = (config) => (config || []).filter((a) => !a.jusqu_au || Date.parse(a.jusqu_au) >= now.getTime());
  const offres = actifs(T.avantages);
  const lieuDe = (insta, nom) => (lieux || []).find((l) => (insta && l.instagram === insta) || (normLieu(nom || '') && normLieu(l.nom) === normLieu(nom || '')));
  const img = (f) => (existsSync(path.join(ROOT, f)) ? f : '');
  const couvDe = (insta) => insta ? img(`site/lieux/${insta}-couv-800.webp`) : '';
  const quand = (x) => `${paris(x.debut, { weekday: 'short', day: 'numeric', month: 'short' }, t.locale)} · ${heure(x.debut, t)}`;
  const carteOffre = ({ cle, type, titre, description, conditions, jusqu, partenaire, insta, ville, code, remise, liste }) => {
    const L = lieuDe(insta, partenaire);
    const sxAff = (liste || []).find((x) => x.affiche);
    // Organisateur (code promo) : l'affiche d'une soirée où le code marche, plus parlante que sa dernière publication.
    const couv = code && sxAff ? sxAff.affiche.replace(/\.jpg$/, '-800.webp') : couvDe(insta || L?.instagram), logo = L?.photo || img(`site/lieux/${insta}-176.webp`);
    const H = lireHoraires(L?.details?.horaires);
    const adresse = L?.adresse || '';
    const sx = (liste || (L ? (soirees || []).filter((x) => (L.soirees || []).includes(x.id)) : [])).slice(0, 4);
    return `<article class="fiche-lieu avantage-carte" id="${esc(slug(cle))}"${H ? ` data-horaires="${esc(JSON.stringify(H.plages))}"` : ''}>
  <div class="av-bandeau">${couv && existsSync(path.join(ROOT, couv)) ? `<img src="${base}${esc(couv)}" alt="" width="800" height="533" loading="lazy" decoding="async">` : ''}${logo ? `<img class="av-logo" src="${base}${esc(logo)}" alt="${esc(partenaire)}" width="88" height="88" loading="lazy">` : ''}<span class="av-type">${esc(tr(type))}</span></div>
  <div class="fiche-corps">
    <p class="av-offre">${esc(tr(titre))}</p>
    <h3>${L?.slug ? `<a href="${base}${pre(lang)}clubs-bars/${esc(L.slug)}/">${esc(partenaire)}</a>` : code && liste?.length ? `<a href="${base}${pre(lang)}avantages/${esc(slug(code))}/">${esc(partenaire)}</a>` : esc(partenaire)}</h3>
    <p class="genre">${esc(tr(L ? ({ club: 'Boîte de nuit', bar: 'Bar', pub: 'Pub', rooftop: 'Rooftop', 'bar-a-cocktails': 'Bar à cocktails', 'beach-club': 'Beach club' }[L.type] || 'Lieu') : 'Organisateur'))}${ville || L?.ville ? ` · ${esc(ville || L.ville)}` : ''}</p>
    ${H ? '<p class="lieu-statut" hidden></p>' : ''}
    ${code ? `<p class="code-ligne"><b>${esc(remise)}</b><button type="button" class="code" data-copier="${esc(code)}">${esc(code)} <span>${esc(t.copier)}</span></button></p>` : ''}
    ${adresse ? `<p class="av-adresse">${ICO_INFO.lieu}${esc(adresse)}</p>` : ''}
    ${sx.length ? `<div class="av-soirees"><p class="pied-titre">${esc(tr(code ? 'Soirées où le code marche' : 'Ses prochaines soirées'))}</p><ul>${sx.map((x) => `<li><a href="${base}${pre(lang)}soiree/${esc(x.id)}/"><b>${esc(x.nom)}</b><small>${esc(quand(x))}</small></a></li>`).join('')}</ul></div>` : ''}
    <p class="petit av-conditions">${conditions ? `${esc(tr('Conditions'))} : ${esc(tr(conditions))}` : ''}${jusqu ? `${conditions ? ' · ' : ''}${esc(tr("jusqu'au"))} ${esc(paris(`${jusqu}T12:00:00Z`, { day: 'numeric', month: 'long', year: 'numeric' }, t.locale))}` : ''}</p>
    <p class="fiche-liens">${adresse ? `<a class="bouton petit" href="https://www.google.com/maps/dir/?api=1&amp;destination=${encodeURIComponent([partenaire, adresse].join(', '))}" target="_blank" rel="noopener">${esc(tr('Itinéraire'))}</a>` : ''}${L?.slug ? `<a class="bouton petit contour" href="${base}${pre(lang)}clubs-bars/${esc(L.slug)}/">${esc(tr('Voir le lieu'))}</a>` : ''}${code && liste?.length ? `<a class="bouton petit" href="${base}${pre(lang)}avantages/${esc(slug(code))}/">${esc(tr(`Voir les ${liste.length} soirées`))}</a>` : ''}${insta ? `<a class="bouton petit contour" href="https://www.instagram.com/${esc(insta)}/" target="_blank" rel="noopener">Instagram</a>` : ''}<button type="button" class="bouton petit contour partager" data-url="${URL_SITE}${pre(lang)}${code && liste?.length ? `avantages/${esc(slug(code))}/` : `avantages/#${esc(slug(cle))}`}" data-titre="${esc(`${tr(titre)} · ${partenaire}`)}">${esc(t.partager || 'Partager')}</button></p>
  </div></article>`;
  };
  const cartes = [
    ...offres.map((a) => carteOffre({ cle: `av-${a.partenaire_nom}`, type: a.type || 'Avantage', titre: a.titre, description: a.description, conditions: a.conditions, jusqu: a.jusqu_au, partenaire: a.partenaire_nom, insta: a.instagram, ville: a.ville })),
    ...CODES.map((c) => carteOffre({ cle: `code-${c.code}`, type: 'Code promo', titre: c.description, description: '', conditions: c.conditions, jusqu: c.jusqu_au, partenaire: c.partenaire_nom || `@${c.partenaire}`, insta: c.partenaire, code: c.code, remise: c.remise,
      liste: (soirees || []).filter((x) => promoDe(x) === c) })),
  ];
  const n = cartes.length;
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, alt: tr('Avantages'), etiquette: tr('Avantages Teufy'), h1: tr('Les <em>avantages</em> Teufy'), p: esc(tr(`${n ? `${n} offre${n > 1 ? 's' : ''} en ce moment : ` : ''}verres offerts, codes promo, entrées gratuites… Réservés aux lecteurs de Teufy chez nos partenaires de la Côte d'Azur et du Var. Montre Teufy, c'est tout.`)) })}
<section class="bloc-large" id="liste-avantages">${n ? `<ol class="av-mode"><li><b>1</b>${esc(tr('Choisis ton avantage'))}</li><li><b>2</b>${esc(tr('Montre cette page ou notre Instagram sur place (ou colle le code)'))}</li><li><b>3</b>${esc(tr('Profite, c\'est offert par le partenaire'))}</li></ol><div class="fiches avantages-grille">${cartes.join('')}</div>` : `<p class="vide">${esc(tr('Les premiers avantages arrivent : les établissements partenaires sont en train de créer leurs offres. Reviens vite, ou suis @teufy_official pour être prévenu.'))}</p>`}</section>
<section class="bloc-large"><h2>${tr('Tu as un bar, un club, une <em>activité</em> ?')}</h2><p class="grand-texte">${esc(tr("Propose un avantage aux lecteurs de Teufy : c'est gratuit, on le met en avant ici et dans nos stories."))}</p><p class="cta"><a class="bouton" href="${base}${pre(lang)}partenaires/#avantage">${esc(tr('Proposer un avantage'))}</a><a class="bouton contour" href="${base}${pre(lang)}partenaires/#tarifs">${esc(tr('Voir les formules'))}</a></p></section>`;
  return gabarit({ lang, t, titre: tr('Avantages Teufy : codes promo et offres des bars et clubs de la Côte d\'Azur'), description: tr("Codes promo, verres offerts et entrées gratuites réservés aux lecteurs de Teufy dans les bars, clubs et activités de la Côte d'Azur et du Var."), chemin, base, corps, compte, maj, ld: [...ldOrganisation(T, compte, t, lang), fil(lang, [['Teufy', ''], [tr('Avantages'), chemin]])] });
}
// Formulaire « Propose ton avantage » (page Partenaires) : prépare un message structuré (Instagram ou e-mail).
const blocAvantage = ({ tr, handle, email }) => { const ig = `https://ig.me/m/${esc(handle)}`; const champ = (n, l, extra = '') => `<label${/detail|conditions/.test(n) ? ' class="large"' : ''}><span>${esc(tr(l))}</span>${extra || `<input name="${n}"${n === 'etab' ? ' required' : ''}>`}</label>`;
  return `<section class="bloc-large contact-pro" id="avantage"><h2>${tr('Propose ton <em>avantage</em>')}</h2><p class="intro">${esc(tr("Un verre offert, l'entrée gratuite avant minuit, un code promo, une partie offerte… C'est gratuit : on le met en avant sur la page Avantages et dans nos stories. 1 minute, promis."))}</p>
  <form class="form-contact form-avantage" data-objet="${esc(tr('Avantage Teufy'))}" data-ok-ig="${esc(tr('✓ Message copié. Colle-le dans la conversation Instagram qui vient de s\'ouvrir.'))}" data-ok-mail="${esc(tr('✓ Ton application e-mail s\'ouvre avec le message prêt à envoyer.'))}" data-manque="${esc(tr("Indique au moins le nom de l'établissement et l'avantage."))}" novalidate>
    ${champ('etab', "Nom de l'établissement")}${champ('insta', 'Compte Instagram', '<input name="insta" placeholder="@" autocomplete="off" autocapitalize="off">')}${champ('ville', 'Ville')}
    ${champ('type', "Type d'avantage", `<select name="type">${['Verre offert', 'Entrée offerte', 'Code promo', 'Réduction', 'Partie / activité offerte', 'Autre'].map((x) => `<option>${esc(tr(x))}</option>`).join('')}</select>`)}
    ${champ('detail', "L'avantage en une phrase", `<textarea name="detail" rows="2" required placeholder="${esc(tr('Ex. : 1 verre acheté = 1 verre offert sur présentation de Teufy'))}"></textarea>`)}
    ${champ('conditions', 'Conditions (jours, horaires, limites)', '<input name="conditions">')}${champ('fin', "Valable jusqu'au", '<input name="fin" type="date">')}
    ${champ('contact', 'Ton e-mail ou téléphone pro', '<input name="contact" autocomplete="email">')}
    ${champ('formule', 'Formule souhaitée', `<select name="formule">${['Gratuit (juste l\'avantage)', 'Visibilité', 'Premium', 'Je veux en parler'].map((x) => `<option>${esc(tr(x))}</option>`).join('')}</select>`)}
    <p class="envoyer"><a class="bouton" data-envoi="ig" href="${ig}" target="_blank" rel="noopener">${ICO_IG}<span>${esc(tr('Envoyer sur Instagram'))}</span></a>${email ? `<a class="bouton contour" data-envoi="mail" href="mailto:${esc(email)}">${esc(tr('Envoyer par e-mail'))}</a>` : ''}</p>
    <p class="retour-form" role="status" aria-live="polite" hidden></p>
  </form></section>`; };
function pageCeSoir({ lang, t, tr, base, compte, T, chemin, maj, soirees, lieux, now }) {
  const jour = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
  const auj = jour(new Date(now - 6 * 3600e3)), demain = jour(new Date(now + 18 * 3600e3));
  const soir = soirees.filter((s) => s.jour === auj || s.jour === demain).sort((a, b) => a.debut.localeCompare(b.debut));
  const L = (lieux || []).filter((l) => ['club', 'bar', 'rooftop', 'beach-club', 'bar-a-cocktails', 'pub', 'lounge'].includes(l.type));
  const villes = [...new Set(L.map((l) => l.ville).filter(Boolean))].sort((a, b) => L.filter((l) => l.ville === b).length - L.filter((l) => l.ville === a).length);
  const ctx = { t, tr, base, lang };
  // « Je cherche… » (13/11/2026, directeur : choisir soirée, boîte, bar, resto, manger après, after, et la ville).
  const T_ = (type) => TARDIFS.filter((x) => x.type === type);
  const nbClubs = L.filter(EST_CLUB).length;
  const afterLieux = L.filter((l) => (lireHoraires(l.details?.horaires)?.plages || []).some((p) => p.a >= '06:00' && p.a < '12:00'));
  const PRIO = ['Nice', 'Cannes', 'Monaco', 'Antibes', 'Juan-les-Pins', 'Toulon', 'Saint-Tropez', 'Menton'];
  const toutesVilles = [...new Set([...L.map((l) => l.ville), ...TARDIFS.map((x) => x.ville)].filter(Boolean))].sort((a, b) => ((PRIO.indexOf(a) + 1 || 99) - (PRIO.indexOf(b) + 1 || 99)) || [...L, ...TARDIFS].filter((x) => x.ville === b).length - [...L, ...TARDIFS].filter((x) => x.ville === a).length);
  const cleSoiree = (v) => { const k = sansAccent(v).replace(/[^a-z]/g, ''); return ['nice', 'cannes', 'monaco', 'antibes'].find((x) => k.startsWith(x)) || (/juan/.test(k) ? 'antibes' : /montecarlo|beausoleil/.test(k) ? 'monaco' : VILLES_VAR_SLUGS.includes(slug(v)) ? 'var' : 'autres'); };
  const RUB = [['soirees', tr('Soirées'), soir.length], ['clubs', tr('Boîtes de nuit'), nbClubs], ['bars', tr('Bars'), L.length - nbClubs], ['resto-soir', tr('Restos du soir'), T_('resto-soir').length], ['manger-tard', tr('Manger après'), T_('manger-tard').length], ['after', tr('Afters'), T_('after').length + afterLieux.length]].filter((r) => r[2]);
  const hub = `<nav class="je-cherche" aria-label="${esc(tr('Je cherche'))}"><p class="jc-titre">${esc(tr('Je cherche'))}</p>
<p class="liens-styles jc-rubriques"><button type="button" class="puce actif" data-rubrique="">${esc(tr('Tout'))}</button>${RUB.map(([k, nom, n]) => `<button type="button" class="puce" data-rubrique="${k}" data-nom="${esc(nom)}">${esc(nom)} · <b class="jc-n">${n}</b></button>`).join('')}</p>
<p class="liens-styles jc-villes" role="group" aria-label="${esc(tr('Où ?'))}"><span class="jc-ou">${esc(tr('Où ?'))}</span><button type="button" class="puce actif" data-jc-ville="" data-soirees="">${esc(tr('Partout'))}</button>${toutesVilles.map((v, k) => `<button type="button" class="puce${k >= 8 ? ' jc-plus' : ''}" data-jc-ville="${esc(slug(v))}" data-soirees="${esc(cleSoiree(v))}">${esc(v)} <small>${[...L, ...TARDIFS].filter((x) => x.ville === v).length}</small></button>`).join('')}${toutesVilles.length > 8 ? `<button type="button" class="puce contour jc-voir-plus">+ ${toutesVilles.length - 8} ${esc(tr('villes'))}</button>` : ''}</p></nav>`;
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, images: soir.filter((x) => x.affiche).map((x) => x.affiche), alt: tr('Ce soir'), k: 7, etiquette: tr('Ce soir'), h1: tr('Où sortir <em>ce soir</em> ?'), p: esc(tr("Les soirées de ce soir et les boîtes et bars ouverts en ce moment sur la Côte d'Azur et dans le Var, mis à jour en direct.")) })}
${hub}
<section class="bloc-large ce-soir-page" id="soirees-ce-soir" data-rubrique="soirees"><h2>${tr('Les soirées de <em>ce soir</em>')} <span class="compte-ce-soir" data-compte-soir></span></h2>
<div class="grille ce-soir-liste">${soir.map((s, i) => carte(s, { t, base, lang, prioritaire: i === 0 })).join('')}</div>
<div id="sugg-source" hidden>${soirees.filter((s) => s.jour > auj && Date.parse(`${s.jour}T12:00:00Z`) - now < 8 * 864e5).slice(0, 12).map((s) => carte(s, { t, base, lang })).join('')}</div>
<p class="vide" data-soir-ville-vide hidden>${esc(tr('Ce soir, aucune soirée annoncée à'))} <b></b>${esc(tr(' : les boîtes et bars ouverts sont juste en dessous, ou choisis une ville voisine.'))}</p>
<p class="vide" data-aucune-soiree hidden>${esc(tr("Pas de soirée annoncée ce soir pour l'instant : regarde les lieux ouverts juste en dessous, ou l'agenda des prochains jours."))} <a href="${base}${pre(lang)}#agenda">${esc(t.toutes)}</a></p></section>
<section class="bloc-large" id="lieux-ouverts" data-rubrique="clubs bars"><h2>${tr('Boîtes de nuit et bars <em>ouverts ce soir</em>')} <span class="compte-ce-soir"><b data-compte-ouverts="lieux-ce-soir">·</b> / <span data-compte-total="lieux-ce-soir">${L.length}</span></span></h2>
<p class="avert">${esc(tr("Horaires relevés sur les sources officielles des lieux (site, Instagram, fiche Google). Ils peuvent changer, surtout les jours fériés : en cas de doute, vérifie sur leur Instagram avant d'y aller."))}</p>
${filtreTypes(L, tr)}
<p class="liens-styles filtre-villes"><button type="button" class="puce actif" data-ville="">${esc(tr('Partout'))}</button>${villes.map((v) => `<button type="button" class="puce" data-ville="${esc(slug(v))}">${esc(v)}</button>`).join('')}</p>
<div class="fiches lieux-ce-soir" id="lieux-ce-soir" data-replier="1" data-grouper="1">${L.map((l, i) => carteLieu(l, ctx, i)).join('')}</div>
<p class="cta"><button type="button" class="bouton contour voir-fermes" hidden>${esc(tr('Voir les lieux fermés ce soir'))} (<span></span>)</button></p></section>
${[['resto-soir', tr('Un resto <em>avant de sortir</em> ?'), tr("Pour bien commencer la soirée ou pour un date : ces restos servent encore à 23 h. Réserve, puis enchaîne.")], ['manger-tard', tr('3 h du mat, <em>t\'as faim</em> ?'), tr("La boîte ferme, l'estomac crie : kebabs, pizzas, snacks et boulangeries encore ouverts après 2 h, triés par ville, les ouverts en premier.")], ['after', tr('Pas fatigué ? <em>Les afters</em>'), tr("La nuit n'est pas finie : les lieux et soirées qui continuent quand les boîtes ferment.")]].map(([type, h, p]) => { const l = TARDIFS.filter((x) => x.type === type); const clubsTard = type === 'after' ? afterLieux : []; return l.length || clubsTard.length ? `<section class="bloc-large" id="${type}" data-rubrique="${type}"><h2>${h}</h2><p class="avert">${esc(p)} ${esc(tr("Vérifie toujours avant d'y aller : les horaires de nuit changent souvent."))}</p><div class="fiches lieux-tard" data-grouper="1">${clubsTard.map((x, i) => carteLieu(x, ctx, i)).join('')}${l.map((x, i) => carteTardive(x, tr, i)).join('')}</div></section>` : ''; }).join('\n')}`;
  return gabarit({ lang, t, titre: tr("Où sortir ce soir sur la Côte d'Azur : soirées et boîtes ouvertes · Teufy"), description: tr("Ce soir à Nice, Cannes, Monaco, Antibes et dans le Var : toutes les soirées et les boîtes de nuit et bars ouverts maintenant, avec horaires, prix et billets."), chemin, base, corps, compte, maj,
    ld: [...ldOrganisation(T, compte, t, lang), fil(lang, [['Teufy', ''], [tr('Ce soir'), chemin]]), ...jsonld(soir, lang)] });
}

function pageLieux({ lang, t, tr, base, compte, T, chemin, maj, lieux }) {
  const ctx = { t, tr, base, lang };
  const top = (lieux || []).filter((l) => l.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
  const parVille = {};
  for (const l of lieux || []) (parVille[l.ville || tr('Autres')] ||= []).push(l);
  const PRIO_V = ['Nice', 'Cannes', 'Monaco', 'Antibes', 'Juan-les-Pins', 'Toulon', 'Saint-Tropez', 'Menton'];
  const villes = Object.keys(parVille).sort((a, b) => ((PRIO_V.indexOf(a) + 1 || 99) - (PRIO_V.indexOf(b) + 1 || 99)) || parVille[b].length - parVille[a].length);
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, logos: (lieux || []).filter((l) => l.photo).sort((a, b) => (b.score || 0) - (a.score || 0)).map((l) => l.photo), alt: t.lieuxNav, k: 3, etiquette: t.lieuxNav, h1: tr("Les clubs et bars de la <em>Côte d'Azur</em> et du Var"), p: esc(tr("Boîtes de nuit, bars, rooftops et beach clubs de Nice à Toulon, avec ceux qui font le plus parler d'eux en ce moment.")) })}
${top.length ? `<section class="bloc-large reveal"><h2>${tr('Tendance du <em>moment</em>')}</h2><p class="avert">${esc(tr("Classement calculé chaque jour à partir de données réelles : likes et commentaires sur les publications Instagram des 3 dernières semaines, rapportés au nombre d'abonnés. Être partenaire de Teufy ne donne aucun bonus."))}</p><div class="fiches fiches-tendance">${top.map((l, i) => carteLieu(l, ctx, i, true)).join('')}</div></section>` : ''}
<section class="bloc-large reveal">${filtreTypes(lieux || [], tr)}<p class="liens-styles">${villes.map((v) => `<a class="puce" href="#v-${slug(v)}">${esc(v)} · ${parVille[v].length}</a>`).join('')}</p></section>
${villes.map((v) => `<section class="bloc-large reveal" id="v-${slug(v)}"><h2>${esc(v)}</h2><div class="fiches" data-max="6">${parVille[v].map((l, i) => carteLieu(l, ctx, i)).join('')}</div></section>`).join('\n')}
${(lieux || []).length ? '' : `<section class="bloc-large"><p class="vide">${esc(tr("L'annuaire se remplit : Teufy recense les clubs et bars de la Côte d'Azur et du Var."))}</p></section>`}`;
  return gabarit({ lang, t, titre: tr("Clubs et bars de la Côte d'Azur et du Var : les plus tendance en ce moment · Teufy"), description: tr("Toutes les boîtes de nuit, bars, rooftops et beach clubs de Nice, Cannes, Antibes, Monaco, Toulon et Saint-Tropez, et le classement des lieux les plus tendance du moment."), chemin, base, corps, compte, maj,
    ld: [...ldOrganisation(T, compte, t, lang), fil(lang, [['Teufy', ''], [t.lieuxNav, chemin]]), { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: (lieux || []).slice(0, 100).map((l, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': l.type === 'club' ? 'NightClub' : 'BarOrPub', name: l.nom, ...(l.adresse || l.ville ? { address: { '@type': 'PostalAddress', streetAddress: l.adresse || undefined, addressLocality: l.ville || undefined } } : {}) } })) }] });
}

// Occitanie : toutes les soirées de la région, par jour, avec un filtre par ville (site seulement).
// Nombre de soirées par ville (boutons des pages France / Occitanie, menu « Villes »), renseigné à la construction.
const NB_VILLES = { france: {}, occitanie: {}, cote: 0, franceTotal: 0, occitanieTotal: 0 };
const nbPuce = (n) => (n ? ` <span class="nb-puce">${n}</span>` : '');
function pageOccitanie({ lang, t, tr, base, compte, T, chemin, maj, soirees, cleVille }) {
  const villes = [...new Set(soirees.map((s) => s.filtreVille))];
  const nomVille = cleVille ? (VILLES_OCCITANIE.find((v) => slug(v) === cleVille) || soirees[0]?.ville || cleVille) : '';
  const tous = cleVille ? null : villes;
  const titre = cleVille ? tr(`Soirées à ${nomVille} : l'agenda`) : tr('Soirées en Occitanie : tout l\'agenda');
  const parJour = new Map();
  for (const s of soirees) { if (!parJour.has(s.jour)) parJour.set(s.jour, []); parJour.get(s.jour).push(s); }
  const jourTitre = (iso) => { const x = paris(Date.parse(`${iso}T12:00:00Z`), { weekday: 'long', day: 'numeric', month: 'long' }, t.locale); return x.charAt(0).toUpperCase() + x.slice(1); };
  const puces = VILLES_OCCITANIE.filter((v) => (tous || villes).includes(slug(v))).map((v) => `<a class="puce${slug(v) === cleVille ? ' actif' : ''}" href="${base}${pre(lang)}occitanie/${slug(v)}/">${esc(v)}${nbPuce(NB_VILLES.occitanie[slug(v)])}</a>`).join('');
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, images: soirees.filter((x) => x.affiche).map((x) => x.affiche), alt: titre, k: 5, etiquette: 'Occitanie', h1: cleVille ? tr(`Les soirées à <em>${nomVille}</em>`) : tr('Toutes les soirées d\'<em>Occitanie</em>'), p: esc(cleVille ? tr(`Toutes les soirées à venir à ${nomVille}, vérifiées sur leur billetterie.`) : tr("Teufy, c'est d'abord la Côte d'Azur. Pour quand tu bouges : Montpellier, Toulouse, Nîmes, Perpignan, Sète, Béziers… toutes les soirées d'Occitanie au même endroit, vérifiées sur leur billetterie.")) })}
<section class="bloc-large reveal"><p class="liens-styles">${cleVille ? `<a class="puce" href="${base}${pre(lang)}occitanie/">${esc(tr('Toute l\'Occitanie'))}</a>` : ''}${puces}<a class="puce" href="${base}${pre(lang)}#agenda">${esc(tr("Côte d'Azur et Var"))}${nbPuce(NB_VILLES.cote)}</a></p>
${soirees.length ? [...parJour].map(([j, l]) => `<h2 class="jour-titre">${esc(jourTitre(j))} <small>${l.length}</small></h2><div class="grille">${l.map((s) => carte(s, { t, base, lang })).join('')}</div>`).join('\n') : `<p class="vide">${esc(tr('Les soirées d\'Occitanie arrivent : la recherche tourne chaque jour.'))}</p>`}</section>`;
  return gabarit({ lang, t, titre: `${titre} · Teufy`, description: couper(cleVille ? tr(`Toutes les soirées à ${nomVille} : ${pl(soirees.length, 'soirée')} à venir avec date, lieu, prix et billetterie, vérifiées par Teufy.`) : tr(`Toutes les soirées d'Occitanie : ${pl(soirees.length, 'soirée')} à venir à Montpellier, Toulouse, Nîmes, Perpignan, Sète, Béziers et dans toute la région.`), 160), chemin, base, corps, compte, maj, image: soirees.find((x) => x.affiche)?.affiche, ld: [...ldOrganisation(T, compte, t, lang), ...jsonld(soirees, lang)] });
}

// Grandes villes de France : rubrique séparée de l'agenda de la Côte d'Azur et du Var.
function pageFrance({ lang, t, tr, base, compte, T, chemin, maj, soirees, cleVille }) {
  const nomVille = cleVille ? (VILLES_FRANCE.find((v) => slug(v) === cleVille) || soirees[0]?.ville || cleVille) : '';
  const villes = [...new Set(soirees.map((s) => s.filtreVille))];
  const titre = cleVille ? tr(`Soirées à ${nomVille} : les plus attendues`) : tr('Soirées dans les grandes villes de France');
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, images: soirees.filter((x) => x.affiche).map((x) => x.affiche), alt: titre, k: 4, etiquette: tr('Ailleurs en France'), h1: cleVille ? tr(`Les soirées à <em>${nomVille}</em>`) : tr('Les soirées des <em>grandes villes</em> de France'), p: esc(tr("Teufy, c'est d'abord la Côte d'Azur et le Var. Ici, les soirées les plus attendues des grandes villes étudiantes, pour quand tu bouges.")) })}
<section class="bloc-large reveal"><p class="liens-styles">${cleVille ? `<a class="puce" href="${base}${pre(lang)}france/">${esc(tr('Toutes les villes'))}</a>` : ''}${VILLES_FRANCE.filter((v) => villes.includes(slug(v))).map((v) => `<a class="puce${slug(v) === cleVille ? ' actif' : ''}" href="${base}${pre(lang)}france/${slug(v)}/">${esc(v)}${nbPuce(NB_VILLES.france[slug(v)])}</a>`).join('')}<a class="puce" href="${base}${pre(lang)}#agenda">${esc(tr("Côte d'Azur et Var"))}${nbPuce(NB_VILLES.cote)}</a></p>
${soirees.length ? `<h2>${tr('Les plus <em>attendues</em>')}</h2><div class="grille">${soirees.map((s) => carte(s, { t, base, lang })).join('')}</div>` : `<p class="vide">${esc(tr('Les soirées des grandes villes arrivent : la recherche tourne tous les deux jours.'))}</p>`}</section>`;
  return gabarit({ lang, t, titre: `${titre} · Teufy`, description: cleVille ? tr(`Les soirées les plus attendues à ${nomVille} : ${pl(soirees.length, 'soirée')} à venir, avec date, lieu, prix et lien de billetterie, choisies par Teufy.`) : tr("Les soirées les plus attendues à Paris, Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Montpellier, Strasbourg, Rennes, Grenoble et Aix-en-Provence."), chemin, base, corps, compte, maj, image: soirees.find((x) => x.affiche)?.affiche, ld: [...ldOrganisation(T, compte, t, lang), ...jsonld(soirees, lang)] });
}

// Pages « pros » : partenaires, ambassadeurs, BDE (texte français traduit par l'IA).
const cartesTexte = (l, tr) => `<div class="cartes-texte">${l.map(([a, b], i) => `<article class="carte-texte" style="--i:${i}"><h3>${tr(a)}</h3><p>${tr(b)}</p></article>`).join('')}</div>`;
const etapes = (l, tr) => `<ol class="etapes">${l.map(([a, b], i) => `<li style="--i:${i}"><b>${i + 1}</b><div><h3>${tr(a)}</h3><p>${tr(b)}</p></div></li>`).join('')}</ol>`;
// Bloc « Passer à l'action » des pages pros : un vrai formulaire qui prépare le message (Instagram ou e-mail).
// Pas de serveur (GitHub Pages) : le message est copié puis la conversation Instagram s'ouvre, ou l'e-mail est pré-rempli.
const CONTACTS = {
  partenaire: ['Envoie ta soirée ou ton lieu', "Remplis ces quelques lignes : on prépare ton message, tu n'as plus qu'à l'envoyer. Réponse en général sous 24 h.", 'Ton lieu ou ta soirée, tes prochaines dates, ton lien de billetterie…', 'Demande de partenariat'],
  ambassadeur: ['Postule maintenant', "Deux minutes suffisent : on prépare ta candidature, tu n'as plus qu'à l'envoyer.", 'Ton âge, ton école ou ton travail, et en deux phrases pourquoi tu veux représenter Teufy…', 'Candidature ambassadeur'],
  bde: ['Parlez-nous de votre soirée', "Quelques lignes suffisent : on prépare votre message, vous n'avez plus qu'à l'envoyer.", 'Votre école ou association, la date, le type de soirée, le nombre de participants…', 'Soirée BDE / association'],
};
const blocContact = ({ tr, handle, email, type }) => { const [h, p, ph, objet] = CONTACTS[type]; const ig = `https://ig.me/m/${esc(handle)}`; return `<section class="bloc-large contact-pro" id="contact">
  <h2>${esc(tr(h))}</h2><p class="intro">${esc(tr(p))}</p>
  <form class="form-contact" data-objet="${esc(tr(objet))}" data-ok-ig="${esc(tr('✓ Message copié. Colle-le dans la conversation Instagram qui vient de s\'ouvrir.'))}" data-ok-mail="${esc(tr('✓ Ton application e-mail s\'ouvre avec le message prêt à envoyer.'))}" data-manque="${esc(tr('Indique au moins ton nom et ton message.'))}" novalidate>
    <label class="large"><span>${esc(tr('Ton nom ou celui de ton lieu'))}</span><input name="nom" autocomplete="name" required></label>
    <label><span>${esc(tr('Ton compte Instagram'))}</span><input name="insta" placeholder="@" autocomplete="off" autocapitalize="off"></label>
    <label><span>${esc(tr('Ville'))}</span><input name="ville" autocomplete="address-level2"></label>
    <label class="large"><span>${esc(tr('Ton message'))}</span><textarea name="message" rows="4" required placeholder="${esc(tr(ph))}"></textarea></label>
    <p class="envoyer"><a class="bouton" data-envoi="ig" href="${ig}" target="_blank" rel="noopener">${ICO_IG}<span>${esc(tr('Envoyer sur Instagram'))}</span></a>${email ? `<a class="bouton contour" data-envoi="mail" href="mailto:${esc(email)}">${esc(tr('Envoyer par e-mail'))}</a>` : ''}</p>
    <p class="retour-form" role="status" aria-live="polite" hidden></p>
  </form>
</section>`; };
// Tarifs des formules partenaires (config.site.tarifs) : bouton « Payer » si un lien de paiement est renseigné,
// sinon « Choisir cette formule » qui pré-remplit le formulaire de contact.
const blocTarifs = ({ tr, T, base, lang, t }) => {
  const C = T.tarifs; if (!C?.formules?.length) return '';
  const tva = Number(C.tva ?? 20), loc = t?.locale || 'fr-FR';
  const fmt = (n) => `${new Intl.NumberFormat(loc, { maximumFractionDigits: 2 }).format(Math.round(n * 100) / 100)} €`;
  const per = { mois: tr('/ mois'), post: tr('le post'), story: tr('la story') };
  const F = (k) => C.formules.find((f) => f.cle === k);
  // Preuves : uniquement des chiffres mesurés (abonnés et portée médiane des derniers posts, relevés par le robot).
  const A = lire(path.join(ROOT, 'apprentissage.json'), {});
  const abonnes = A.abonnes?.at(-1)?.n, portees = (A.posts || []).map((x) => x.metrics?.reach).filter(Number.isFinite).sort((a, b) => a - b);
  const mediane = portees.length >= 10 ? Math.round(portees[Math.floor(portees.length / 2)] / 100) * 100 : null;
  const nf = (n, o) => new Intl.NumberFormat(loc, o).format(n);
  const preuves = [abonnes && [nf(abonnes, { notation: 'compact', maximumFractionDigits: 1 }), tr('abonnés sur Instagram')], mediane && [`~${nf(mediane)}`, tr('personnes touchées par post')], ['6', tr('langues sur le site')]].filter(Boolean);
  const bouton = (f, texte, cls = 'bouton') => (/^https:\/\//.test(f.paiement || '') ? `<a class="${cls}" href="${esc(f.paiement)}" target="_blank" rel="noopener">${esc(texte)} →</a>` : `<a class="${cls}" href="#contact" data-formule="${esc(`${tr(f.nom)} (${fmt(f.prix)} ${tr('HT')}${per[f.periode] ? ` ${per[f.periode]}` : ''})`)}">${esc(texte)} →</a>`);
  const abo = (f) => f && `<article class="abo${f.vedette ? ' vedette' : ''}">
    ${f.badge ? `<span class="abo-badge">${esc(tr(f.badge))}</span>` : ''}
    <h3>${esc(tr(f.nom))}</h3><p class="abo-accroche">${esc(tr(f.accroche || ''))}</p>
    <p class="abo-prix"><b>${esc(fmt(f.prix))}</b> <span>${esc(tr('HT'))} ${esc(per.mois)}</span></p>
    <p class="abo-jour">${esc(tr('soit'))} ${esc(fmt(f.prix / 30))} ${esc(tr('HT par jour'))}${tva ? ` · ${esc(fmt(f.prix * (1 + tva / 100)))} ${esc(tr('TTC'))} ${esc(per.mois)}` : ''}</p>
    <ul>${f.points.map((x) => `<li>${esc(tr(x))}</li>`).join('')}</ul>
    ${bouton(f, `${tr(/^https:/.test(f.paiement || '') ? "S'abonner :" : 'Choisir')} ${tr(f.nom)}`, `bouton${f.vedette ? '' : ' contour'} abo-choisir`)}
  </article>`;
  const unite = (f) => f && `<article class="unite"><div><h4>${esc(tr(f.nom))}</h4><p>${esc(tr(f.accroche || ''))}</p></div><p class="unite-prix"><b>${esc(fmt(f.prix))}</b> <span>${esc(tr('HT'))}${tva ? ` · ${esc(fmt(f.prix * (1 + tva / 100)))} ${esc(tr('TTC'))}` : ''}</span></p>${bouton(f, tr('Commander'), 'bouton petit contour')}</article>`;
  const abos = C.formules.filter((f) => f.periode === 'mois'), unites = C.formules.filter((f) => f.prix && f.periode !== 'mois');
  return `<section class="bloc-large tarifs" id="tarifs">
  <h2>${tr('Remplis tes soirées avec <em>Teufy</em>')}</h2>
  ${preuves.length ? `<ul class="tarifs-preuves">${preuves.map(([n, l]) => `<li><b>${esc(n)}</b><span>${esc(l)}</span></li>`).join('')}</ul>` : ''}
  <div class="abos">${abos.map(abo).join('')}</div>
  ${unites.length ? `<h3 class="tarifs-sous">${esc(tr('Sans abonnement'))}</h3><div class="unites">${unites.map(unite).join('')}</div>` : ''}
  ${F('gratuit') ? `<p class="offre-gratuite">${esc(tr("Pas de budget ? L'ajout de ta soirée dans l'agenda du site reste gratuit."))} <a href="#contact">${esc(tr('Envoyer ma soirée'))} →</a></p>` : ''}
  ${C.etapes?.length ? `<ol class="tarifs-etapes">${C.etapes.map((e, k) => `<li><b>${k + 1}</b><span>${esc(tr(e))}</span></li>`).join('')}</ol>` : ''}
  ${C.portail ? `<p class="tarifs-portail">${esc(tr('Déjà partenaire ?'))} <a href="${esc(C.portail)}" target="_blank" rel="noopener">${esc(tr('Gérer mon abonnement (résiliation, factures)'))} →</a></p>` : ''}
  <p class="merci-paiement" hidden role="status">✓ ${esc(tr("Paiement reçu, merci ! Écris-nous ton nom d'établissement et tes dates juste en dessous : on te répond sous 24 h pour caler tes contenus."))}</p>
  <p class="tarifs-note">${mediane ? `${esc(tr(`Portée : médiane de nos ${portees.length} derniers posts (statistiques Instagram).`))} ` : ''}${tva ? `${esc(tr(`Prix hors taxes, TVA de ${tva} % en sus.`))} ` : ''}${esc(tr(C.mention || ''))} ${esc(tr('Les contenus payants sont signalés « partenariat rémunéré ». Aucune formule ne garantit un nombre de vues ou de ventes.'))} <a href="${base}${pre(lang)}cgv/">${esc(tr('Conditions de vente'))}</a></p>
</section>`;
};
const ctaForm = (tr, handle) => `<p class="cta"><a class="bouton" href="#contact">${esc(tr('Remplir le formulaire'))} ↑</a><a class="bouton contour" href="https://ig.me/m/${esc(handle)}" target="_blank" rel="noopener">${ICO_IG}<span>${esc(tr('Écrire sur Instagram'))}</span></a></p>`;
const ctaIg = (handle, texte, email) => `<p class="cta"><a class="bouton" href="https://ig.me/m/${esc(handle)}" target="_blank" rel="noopener">${esc(texte)}</a>${email ? `<a class="bouton contour" href="mailto:${esc(email)}">${esc(email)}</a>` : ''}</p>`;

function pagePartenaire({ lang, t, tr, base, compte, T, chemin, maj, partenaires }) {
  const C = PARTENAIRE, handle = compte.replace(/^@/, '');
  const faq = C.faq.map(([q, r]) => [tr(q), tr(r)]);
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, logos: (partenaires || []).filter((x) => x.fichier).slice(0, 12).map((x) => x.fichier), alt: t.partenaires, etiquette: tr(C.etiquette), h1: tr(C.h1), p: esc(tr(C.chapo)), actions: `<a class="bouton" href="#tarifs">${esc(tr('Voir les tarifs'))}</a><a class="bouton contour" href="#contact">${esc(tr('Envoyer ma soirée (gratuit)'))}</a>` })}
${blocTarifs({ tr, T, base, lang, t })}
${blocAvantage({ tr, handle, email: T.email })}
${blocContact({ tr, handle, email: T.email, type: 'partenaire' })}
${vitrine({ t, tr, base, partenaires })}
<section class="bloc-large reveal"><h2>${tr(C.pourquoiH2)}</h2>${cartesTexte(C.pourquoi, tr)}</section>
<section class="bloc-large reveal"><h2>${tr(C.offreH2)}</h2>${cartesTexte(C.offre, tr)}</section>
<section class="bloc-large reveal"><h2>${tr(C.pourQuiH2)}</h2><p class="liens-styles">${C.pourQui.map((x) => `<span class="puce">${esc(tr(x))}</span>`).join('')}</p></section>
<section class="bloc-large reveal"><h2>${tr(C.etapesH2)}</h2>${etapes(C.etapes, tr)}${ctaForm(tr, handle)}</section>
${blocFaq(t.faqH, faq)}`;
  return gabarit({ lang, t, titre: tr(C.titre), description: tr(C.desc), chemin, base, corps, compte, maj, image: 'site/img/lasers.jpg', ld: [...ldOrganisation(T, compte, t, lang), ldFaq(faq), fil(lang, [['Teufy', ''], [t.partenaires, chemin]])] });
}
function pageAmbassadeur({ lang, t, tr, base, compte, T, chemin, maj, posts }) {
  const C = AMBASSADEUR, handle = compte.replace(/^@/, '');
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, images: (posts || []).map((x) => x.image), alt: t.ambassadeurs, k: 5, etiquette: tr(C.etiquette), h1: tr(C.h1), p: esc(tr(C.chapo)) })}
${blocContact({ tr, handle, email: T.email, type: 'ambassadeur' })}
<section class="bloc-large reveal"><h2>${tr(C.roleH2)}</h2>${cartesTexte(C.role, tr)}</section>
<section class="bloc-large reveal"><h2>${tr(C.avantagesH2)}</h2>${cartesTexte(C.avantages, tr)}</section>
<section class="bloc-large reveal"><h2>${tr(C.profilH2)}</h2><ul class="coches">${C.profil.map((x) => `<li>${esc(tr(x))}</li>`).join('')}</ul></section>
<section class="bloc-large reveal"><h2>${tr(C.candidatureH2)}</h2><p class="grand-texte">${esc(tr(C.candidature))}</p>${ctaForm(tr, handle)}</section>
`;
  return gabarit({ lang, t, titre: tr(C.titre), description: tr(C.desc), chemin, base, corps, compte, maj, image: 'site/img/danse.jpg', ld: [...ldOrganisation(T, compte, t, lang), fil(lang, [['Teufy', ''], [t.ambassadeurs, chemin]])] });
}
function pageBde({ lang, t, tr, base, compte, T, chemin, soirees, maj, partenaires }) {
  const C = BDE, handle = compte.replace(/^@/, '');
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, images: soirees.filter((x) => x.affiche).map((x) => x.affiche), alt: t.bde, k: 6, etiquette: tr(C.etiquette), h1: tr(C.h1), p: esc(tr(C.chapo)) })}
${blocContact({ tr, handle, email: T.email, type: 'bde' })}
<section class="bloc-large reveal"><h2>${tr(C.offreH2)}</h2>${cartesTexte(C.offre, tr)}</section>
<section class="bloc-large reveal"><h2>${tr(C.etapesH2)}</h2>${etapes(C.etapes, tr)}${ctaForm(tr, handle)}</section>
${soirees.length ? `<section class="bloc-large reveal"><h2>${tr(C.soireesH2)}</h2><div class="grille">${soirees.map((s) => carte(s, { t, base, lang })).join('')}</div></section>` : ''}`;
  return gabarit({ lang, t, titre: tr(C.titre), description: tr(C.desc), chemin, base, corps, compte, maj, image: soirees.find((x) => x.affiche)?.affiche || 'site/img/selfie.jpg', ld: [...ldOrganisation(T, compte, t, lang), ...jsonld(soirees, lang), fil(lang, [['Teufy', ''], [t.bde, chemin]])] });
}
// FAQ générale + sources (FAQPage pour Google), avec un sommaire cliquable.
function pageFaq({ lang, t, tr, base, compte, T, chemin, maj, posts }) {
  const C = FAQ, slugG = (x) => slug(x);
  const faq = C.groupes.flatMap(([, l]) => l.map(([q, r]) => [tr(q), tr(r)]));
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, images: (posts || []).map((x) => x.image), alt: 'FAQ', k: 8, etiquette: tr(C.etiquette), h1: tr(C.h1), p: esc(tr(C.chapo)) })}
<section class="bloc-large faq-page reveal">
  <nav class="faq-sommaire" aria-label="${esc(tr('Sommaire'))}">${C.groupes.map(([g]) => `<a class="puce" href="#${slugG(g)}">${esc(tr(g))}</a>`).join('')}<a class="puce" href="#sources">${esc(tr('Nos sources'))}</a></nav>
  ${C.groupes.map(([g, l]) => `<div class="qui faq" id="${slugG(g)}"><h2>${esc(tr(g))}</h2>${l.map(([q, r]) => `<details><summary>${esc(tr(q))}</summary><p>${esc(tr(r))}</p></details>`).join('')}</div>`).join('\n  ')}
  <div class="sources" id="sources"><h2>${tr(C.sourcesH2)}</h2><p>${esc(tr(C.sourcesP))}</p>
  <dl class="sources-liste">${C.sources.map(([k, v]) => `<div><dt>${esc(tr(k))}</dt><dd>${esc(tr(v))}</dd></div>`).join('')}</dl></div>
  <p class="cta"><a class="bouton" href="https://ig.me/m/${esc(compte.replace(/^@/, ''))}" target="_blank" rel="noopener">${esc(tr('Poser une autre question'))}</a></p>
</section>`;
  return gabarit({ lang, t, titre: tr(C.titre), description: tr(C.desc), chemin, base, corps, compte, maj, ld: [...ldOrganisation(T, compte, t, lang), ldFaq(faq), fil(lang, [['Teufy', ''], ['FAQ', chemin]])] });
}
const TR_SOURCES = { fr: 'Nos sources', en: 'Our sources', it: 'Le nostre fonti', es: 'Nuestras fuentes', zh: '信息来源', ar: 'مصادرنا' };
const TR_LEG = { fr: 'Confidentialité et cookies', en: 'Privacy and cookies', it: 'Privacy e cookie', es: 'Privacidad y cookies', zh: '隐私与 Cookie', ar: 'الخصوصية وملفات تعريف الارتباط' };
const NOMS_LEGAUX = { 'mentions-legales': 'Mentions légales', cgu: "Conditions d'utilisation (CGU)", cgv: 'Conditions de vente et de partenariat (CGV)', confidentialite: 'Confidentialité et cookies' };
function pageLegal({ lang, t, tr, base, compte, T, chemin, maj, cle = 'mentions-legales' }) {
  const C = (PAGES_LEGALES[cle] || LEGAL)(T, compte);
  const corps = `<article class="article">
  <h1>${tr(C.h1)}</h1>
  ${C.blocs.length > 6 ? `<nav class="sommaire-legal" aria-label="${esc(tr('Sommaire'))}"><p>${esc(tr('Sommaire'))}</p><ol>${C.blocs.map(([titre], i) => `<li><a href="#art-${i + 1}">${esc(tr(titre).replace(/^\d+\.\s*/, ''))}</a></li>`).join('')}</ol></nav>` : ''}
  ${C.blocs.map(([titre, ps], i) => `<h2 id="art-${i + 1}">${esc(tr(titre))}</h2>${ps.map((p) => `<p>${esc(tr(p))}</p>`).join('')}`).join('\n  ')}
  <nav class="liens-legaux" aria-label="${esc(tr('Informations légales'))}">${Object.keys(PAGES_LEGALES).filter((k) => k !== cle).map((k) => `<a class="puce" href="${base}${pre(lang)}${k}/">${esc(tr(NOMS_LEGAUX[k]))}</a>`).join('')}</nav>
</article>`;
  return gabarit({ lang, t, titre: tr(C.titre), description: tr(C.desc || C.blocs[0][1][0]), chemin, base, corps, compte, maj });
}

// Teufy en chiffres (un seul bloc) + modèle économique : données fournies par la direction (config.json → site.entreprise).
function chiffresTeufy({ tr, T, nb }) {
  const E = T.entreprise || {};
  const l = [[String(nb), tr("soirées à venir sur le site : Côte d'Azur, Var, Occitanie et grandes villes de France")], [`${T.nbPartenaires}+`, tr("partenaires : clubs, bars, organisateurs, artistes")],
    [E.telechargements, tr(E.telechargements_legende || '')], [E.chiffre_affaires, tr(E.chiffre_affaires_legende || '')], [E.benefice, tr(E.benefice_legende || '')]].filter((x) => x[0]);
  return `<ul class="chiffres chiffres-teufy">${l.map(([v, x], i) => `<li style="--i:${i}"><strong>${esc(v)}</strong><span>${esc(x)}</span></li>`).join('')}</ul>`;
}
function blocModele({ tr, T }) {
  const m = (T.entreprise?.modele || []).filter((x) => x?.[0]);
  if (!m.length) return '';
  return `<section class="qui entreprise reveal" id="modele">
  <p class="etiquette">${esc(tr('Le modèle'))}</p>
  <h2>${tr('Comment Teufy <em>se finance</em>')}</h2>
  <p>${esc(tr(`Le site est gratuit pour toi. Teufy vit de ${['', 'une activité', 'deux activités', 'trois activités', 'quatre activités', 'cinq activités', 'six activités'][m.length] || `${m.length} activités`}, de la plus importante à la plus petite :`))}</p>
  <ul class="modele">${m.map(([titre, texte], i) => `<li style="--i:${i}"><b>${esc(tr(titre))}</b><span>${esc(tr(texte))}</span></li>`).join('')}</ul>
  ${T.raison_sociale ? `<p class="petit">${esc(T.raison_sociale)}, ${esc(tr(T.forme || ''))}.</p>` : ''}
</section>`;
}
function aPropos({ lang, t, tr, base, compte, T, chemin, nb, maj, partenaires, posts }) {
  const initiales = T.directeur.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  const bio = lang === 'fr' && T.directeur_bio ? T.directeur_bio : t.bio;
  const ctx = { lang, t, tr, base, T, partenaires };
  const METHODE = [
    ['On repère tout', "Billetteries, clubs, organisateurs, agendas des villes, comptes Instagram : chaque jour, on passe tout en revue pour ne rien rater."],
    ['On vérifie', "Date, heure, lieu, prix : chaque soirée est contrôlée sur sa page officielle avant d'apparaître sur Teufy."],
    ['On y va', "Notre équipe se déplace aux événements et dans les spots qu'on te conseille. C'est sur le terrain qu'on fait les meilleures sélections."],
  ];
  const h1 = tr('On sort. On trie. <em>Tu profites.</em>'), chapo = esc(tr("Teufy, c'est une équipe qui écume chaque semaine les soirées de la Côte d'Azur, notre terrain de jeu, pour ne te garder que les meilleures. Et sur le site, l'Occitanie aussi."));
  const mosaique = (posts || []).filter((p) => p.image && existsSync(path.join(ROOT, p.image.replace(/\.jpg$/, '-480.webp')))).slice(0, 6);
  const hero = mosaique.length >= 6 ? `<section class="hero court ap-hero">
  <div class="ap-mosaique" aria-hidden="true">${mosaique.map((p, i) => `<img src="${base}${p.image.replace(/\.jpg$/, '-480.webp')}" alt="" width="480" height="600" ${i < 3 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" style="--i:${i}">`).join('')}</div>
  <div class="hero-texte"><p class="etiquette">${esc(t.apEtiquette)}</p><h1>${h1}</h1><p>${chapo}</p></div>
</section>` : heroCourt({ partage: t.partager, base, photo: null, alt: t.heroAlt, etiquette: t.apEtiquette, k: 7, h1, p: chapo });
  const corps = `${hero}
<section class="qui reveal">
  <p class="etiquette">${esc(tr('Notre méthode'))}</p>
  <h2>${tr('Comment on choisit <em>tes soirées</em>')}</h2>
  ${etapes(METHODE, tr)}
  ${chiffresTeufy({ tr, T, nb })}
</section>
${blocModele({ tr, T })}
<section class="qui directeur reveal">
  <div class="portrait">${T.photo_directeur ? `${image(base, T.photo_directeur, { alt: T.directeur, sizes: '(min-width:700px) 380px, 340px', attrs: 'loading="lazy" width="900" height="1125"' })}` : `<span>${esc(initiales)}</span>`}</div>
  <div>
    <p class="etiquette">${esc(t.dirEtiquette)}</p>
    <h2>${esc(T.directeur)}</h2>
    <p>${esc(bio)}</p>
${T.directeur_reseaux ? `<p class="reseaux">${T.directeur_reseaux.instagram ? `<a class="bouton contour" href="${esc(T.directeur_reseaux.instagram)}" target="_blank" rel="noopener me"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.3" fill="currentColor"/></svg>Instagram</a>` : ''}${T.directeur_reseaux.linkedin ? `<a class="bouton contour" href="${esc(T.directeur_reseaux.linkedin)}" target="_blank" rel="noopener me"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11H3zm7 0h3.8v1.5h.06c.53-1 1.83-1.8 3.77-1.8 4 0 4.37 2.4 4.37 5.5v5.8h-4v-5.1c0-1.3 0-2.9-1.8-2.9s-2.2 1.4-2.2 2.8v5.2h-4z"/></svg>LinkedIn</a>` : ''}</p>` : ''}
  </div>
</section>
${blocPartenaires(ctx)}
${blocPros(ctx)}`;
  return gabarit({ lang, t, titre: t.apTitre, description: t.apDesc(T.directeur, T.nbPartenaires), chemin, base, corps, compte, maj, ld: [...ldOrganisation(T, compte, t, lang), fil(lang, [['Teufy', ''], [t.qui, chemin]])], image: 'site/img/logo.png' });
}

// Page 404 (GitHub Pages la sert pour toute adresse inconnue : chemins absolus).
function page404(t) {
  const B = new URL(URL_SITE).pathname; // « / » sur le domaine propre, « /teufy-instagram/ » sur GitHub Pages
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(t.e404)} · Teufy</title><meta name="robots" content="noindex"><link rel="icon" type="image/png" sizes="64x64" href="${B}site/img/favicon-fond-64.png"><link rel="stylesheet" href="${B}site/style.min.css"></head>
<body><main class="page-404"><a href="${B}"><img src="${B}site/img/logo-200.webp" alt="Teufy" width="96" height="79"></a><h1>4<em>0</em>4</h1><p>${esc(t.e404p)}</p><p><a class="bouton" href="${B}#agenda">${esc(t.e404b)}</a></p>
<p class="langues-pied">${LANGUES.map((l) => `<a href="${B}${pre(l)}" hreflang="${l}" lang="${l}">${esc(TXT[l].nom)}</a>`).join(' · ')}</p></main></body></html>
`;
}
