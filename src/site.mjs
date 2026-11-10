// Site Teufy : agenda des soirées de la Côte d'Azur, généré chaque jour par le bot (mêmes soirées vérifiées que les posts).
//   node src/run.mjs site        → index.html (racine du dépôt, servi par GitHub Pages) + site/ + en/ it/ es/ zh/ ar/
// - Les soirées sont écrites dans la page (et en données structurées schema.org Event) : Google peut les indexer.
// - 6 langues : français à la racine, les autres dans leur dossier (balises hreflang, sitemap multilingue).
// - Les affiches sont copiées dans site/affiches/ (les liens Instagram expirent) et vérifiées par Gemini
//   (une affiche d'une autre soirée n'est pas montrée). Résultats gardés dans contenus/affiches-verifiees.json.
// - Les lieux sont placés sur la carte grâce à OpenStreetMap (cache contenus/lieux-geo.json).
// - Le JavaScript (site/app.js) gère les filtres, « Ce soir / En ce moment », la carte et les animations.
import { readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { writeFile, mkdir, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { genresList, isTechno } from './genres.mjs';
import { LANGUES, TXT } from './site-langues.mjs';
import { STYLES as STYLES_MUSIQUE, PAGES_STYLES, FESTIVALS, RENDEZ_VOUS, PARTENAIRE, AMBASSADEUR, BDE, LEGAL, PAGES_LEGALES, RE_ETUDIANT, RE_FESTIVAL, SORTIES, SPOTS_DATE, FAQ } from './site-contenus.mjs';
import { VILLES_FRANCE, VILLES_OCCITANIE, villeOccitanie, fusionner } from './recherche.mjs';
import * as LLM from './llm.mjs';

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
const nuit = (d) => new Date(Date.parse(d) - 6 * 3600e3); // une soirée qui commence à 1h appartient à la veille
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

// Appel Gemini (modèle flash le plus récent disponible), réponse JSON. null si pas de clé ou échec.
let MODELES = null;
// Budget de temps : les enrichissements (lieux, partenaires, transports…) s'arrêtent à temps pour que la mise à jour
// se termine et s'enregistre toujours (GitHub coupe un passage au bout d'une heure). Le reste se fait au passage suivant.
let LIMITE = Infinity;
let CONFIG_LLM = {};
// « Très demandée » : seulement les soirées les plus attendues (environ 1 sur 8, et buzz ≥ 0,85).
let SEUIL_DEMANDE = 0.85;
const tempsOk = () => Date.now() < LIMITE;
async function gemini(parts, { recherche = false } = {}) {
  const CLE = (process.env.GEMINI_API_KEY || '').trim();
  if (!CLE) return null;
  if (!LLM.budgetOk('gemini', CONFIG_LLM)) return null; // plafonds de dépense (contenus/budget-ia.json) ou compte à sec
  const API = 'https://generativelanguage.googleapis.com/v1beta/models';
  try {
    if (!MODELES) {
      const liste = await (await fetch(`${API}?pageSize=200&key=${CLE}`, { signal: AbortSignal.timeout(30000) })).json();
      MODELES = (liste.models || []).map((m) => m.name.replace('models/', '')).filter((n) => /^gemini-[\d.]+-flash/.test(n) && !/image|tts|audio|live|lite/.test(n))
        .sort((a, b) => parseFloat(b.slice(7)) - parseFloat(a.slice(7)));
    }
    for (const m of MODELES.slice(0, 3)) {
      const r = await fetch(`${API}/${m}:generateContent?key=${CLE}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        contents: [{ role: 'user', parts }], ...(recherche ? { tools: [{ google_search: {} }] } : { generationConfig: { responseMimeType: 'application/json' } }) }), signal: AbortSignal.timeout(120000) });
      if (r.status === 404) continue;
      if (!r.ok) { const e = new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`); e.status = r.status; LLM.marquerASec('gemini', e); return null; }
      LLM.compter('gemini');
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
  if (cache[k]) return cache[k].ok;
  // Sans IA disponible (ou plus de temps) : on garde l'ancien verdict s'il existe, sinon on montre l'affiche.
  if (!tempsOk() || !(process.env.GEMINI_API_KEY || '').trim()) return ancien ? ancien.ok : true;
  const r = await gemini([{ inline_data: { mime_type: 'image/jpeg', data: readFileSync(fichier).toString('base64') } }, { text: 'Lis cette affiche de soirée. Réponds en JSON {"titre":string,"artistes":[string],"lieu":string,"ville":string,"dates":["AAAA-MM-JJ"]}. Recopie seulement ce qui est écrit sur l\'affiche (dates au format AAAA-MM-JJ, année 2026 ou 2027 si elle n\'est pas écrite ; tableau vide si aucune date). Chaîne vide si absent.' }]);
  if (!r || typeof r !== 'object') return ancien ? ancien.ok : true; // lecture impossible : ancien verdict, sinon on montre l'affiche
  const jour = cle(e.start), j = Date.parse(`${jour}T12:00:00Z`);
  const dates = (r.dates || []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const dateOk = !dates.length || dates.some((d) => Math.abs(Date.parse(`${d}T12:00:00Z`) - j) <= 864e5);
  const surAffiche = motsAffiche([r.titre, ...(r.artistes || []), r.lieu].join(' '));
  const soiree = motsAffiche([e.name, e.venue, e.accroche, e.description, ...(e.tags || [])].join(' '));
  const commun = [...surAffiche].filter((m) => soiree.has(m));
  const ok = dateOk && (commun.length > 0 || !surAffiche.size);
  cache[k] = { ok, le: new Date().toISOString(), nom: e.name, lu: { titre: r.titre, dates, artistes: (r.artistes || []).slice(0, 6) }, commun: commun.slice(0, 5) };
  return ok;
}

// Position des lieux (OpenStreetMap / Nominatim, 1 requête par seconde, résultats gardés).
const cleLieu = (s) => `${s.lieu}|${s.ville}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
async function geocoder(soirees, log) {
  const cache = lire(GEO, {});
  let requetes = 0, trouves = 0, coupe = false;
  for (const s of soirees) {
    const k = cleLieu(s);
    const c = cache[k];
    const aRetenter = c && c.introuvable && (c.v !== 2 || Date.now() - Date.parse(c.le) > 14 * 864e5);
    if (s.lieu && (!c || aRetenter) && requetes < 60 && !coupe && tempsOk()) {
      // Plusieurs formulations : adresse, « lieu, ville », lieu seul (dans la zone Côte d'Azur), lieu sans mots génériques.
      const court = s.lieu.replace(/\b(club|bar|restaurant|plage|beach|rooftop|le|la|les)\b/gi, ' ').replace(/[-–—@|].*$/, '').replace(/\s+/g, ' ').trim();
      const essais = [...new Set([s.adresse, `${s.lieu}, ${s.ville}`, s.lieu, court && `${court}, ${s.ville}`].filter((x) => x && x.length > 2))];
      let p = null;
      for (const q of essais) {
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
        cache[k] = p ? { lat: +(+p.lat).toFixed(5), lng: +(+p.lon).toFixed(5), le: new Date().toISOString() } : { introuvable: true, v: 2, le: new Date().toISOString() };
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
async function aProximite(soirees, log) {
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
  const C = lire(path.join(ROOT, 'contenus', 'partenaires-comptes.json'), { comptes: [] }).comptes || [];
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
  return [...logos, ...comptes.filter((c) => !c.fusionne)].filter((x) => x.categorie !== 'personne');
}

// --- Clubs et bars de la Côte d'Azur et du Var : annuaire (recherche web, partenaires, lieux de l'agenda) et tendance
// du moment (engagement Instagram récent, surtout les commentaires, et nombre de soirées à venir). Cache : contenus/lieux-nuit.json.
const LIEUX = path.join(ROOT, 'contenus', 'lieux-nuit.json');
const TYPES_LIEUX = ['club', 'bar', 'rooftop', 'beach-club', 'bar-a-cocktails', 'pub', 'lounge', 'salle'];
const ZONES_LIEUX = ['Nice, Villefranche-sur-Mer, Saint-Laurent-du-Var, Cagnes-sur-Mer', 'Cannes, Le Cannet, Mandelieu, Antibes, Juan-les-Pins, Golfe-Juan', 'Monaco, Monte-Carlo, Beausoleil, Menton', 'Toulon, La Seyne-sur-Mer, Hyères, Six-Fours, Sanary, Bandol', 'Fréjus, Saint-Raphaël, Sainte-Maxime, Saint-Tropez, Ramatuelle'];
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
  for (const l of tous) { const ls = soirees.filter((s) => norm(s.lieu) && (norm(s.lieu) === norm(l.nom) || norm(s.lieu).startsWith(norm(l.nom)) || norm(l.nom).startsWith(norm(s.lieu))) && norm(l.nom).length >= 3); l.soirees = ls.map((s) => s.id); l.prochaines = ls.slice(0, 3).map((s) => ({ id: s.id, nom: s.nom })); }
  // 3. Engagement Instagram récent (40 comptes par passage, gardé 3 jours).
  if (ig && api.businessDiscovery) {
    // D'abord les lieux encore sans logo (jamais mesurés depuis l'ajout des logos), puis les mesures les plus anciennes.
    const sansLogo = (l) => !l.photo && !existsSync(path.join(SITE, 'lieux', `${l.instagram.replace(/[^a-z0-9._-]/g, '')}-176.webp`)) && !cache.insta[l.instagram]?.absent && !cache.insta[l.instagram]?.photo;
    const aMesurer = tous.filter((l) => l.instagram && (sansLogo(l) || !(cache.insta[l.instagram] && now - Date.parse(cache.insta[l.instagram].le) < 3 * 864e5)))
      .sort((a, b) => (sansLogo(b) - sansLogo(a)) || (Date.parse(cache.insta[a.instagram]?.le || 0)) - (Date.parse(cache.insta[b.instagram]?.le || 0))).slice(0, 60);
    for (const l of aMesurer) {
      if (!tempsOk()) break;
      try {
        const bd = await api.businessDiscovery(l.instagram, ig);
        const recents = (bd?.media?.data || []).filter((m) => now - Date.parse(m.timestamp) < 21 * 864e5);
        const moy = (k) => (recents.length ? recents.reduce((a, m) => a + (m[k] || 0), 0) / recents.length : 0);
        cache.insta[l.instagram] = { le: now.toISOString(), abonnes: bd?.followers_count ?? null, posts21: recents.length, likes: Math.round(moy('like_count')), commentaires: Math.round(moy('comments_count') * 10) / 10, photo: bd?.profile_picture_url || '' };
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
      .sort((a, b) => (b.insta?.abonnes || 0) - (a.insta?.abonnes || 0)).slice(0, 25);
    for (const l of aFicher) {
      if (!tempsOk()) break;
      const k = slug(`${l.nom}-${l.ville}`);
      const web = await gemini([{ text: `Recherche les informations pratiques à jour du lieu de sortie « ${l.nom} » (${TYPES_NOMS[l.type] || l.type}) à ${l.ville}${l.adresse ? `, ${l.adresse}` : ''}${l.instagram ? `, Instagram @${l.instagram}` : ''}${l.site ? `, site ${l.site}` : ''}. Utilise uniquement des sources fiables et récentes (site officiel, Instagram officiel, fiche Google, billetterie, presse locale). Donne : les styles de musique joués, le dress code ou la tenue exigée, les jours et heures d'ouverture et de fermeture, le prix moyen d'un verre (bière, cocktail, soft), le prix d'entrée habituel, l'âge minimum, et les URL des sources. Si une information n'est pas trouvée, dis-le.` }], { recherche: true });
      if (!web) continue;
      const r = await gemini([{ text: `Informations :\n${web}\n\nRéponds en JSON {"styles":string,"dress_code":string,"horaires":string,"prix_verre":string,"entree":string,"age_min":string,"sources":[string]}. Règles : N'INVENTE RIEN, chaîne vide si l'information n'est pas clairement donnée par une source. Phrases courtes en français. styles : 2 à 4 genres séparés par « · ». horaires : jours et heures, ex. « Jeu–Sam · 23h–5h ». prix_verre : fourchette, ex. « bière 7 € · cocktail 13–16 € ». entree : ex. « gratuit avant 1h, 15 € ensuite ». age_min : ex. « 18 ans ». sources : URL réellement utilisées.` }]);
      const ok = r && typeof r === 'object' && Array.isArray(r.sources) && r.sources.some((u) => /^https?:\/\//.test(u));
      details[k] = ok ? { le: now.toISOString(), styles: r.styles || '', dress_code: r.dress_code || '', horaires: r.horaires || '', prix_verre: r.prix_verre || '', entree: r.entree || '', age_min: r.age_min || '', sources: r.sources.filter((u) => /^https?:\/\//.test(u)).slice(0, 4) } : { le: now.toISOString(), vide: true };
    }
    await writeFile(DETAILS, JSON.stringify(details, null, 1) + '\n');
    const n = Object.values(details).filter((d) => !d.vide).length;
    if (aFicher.length) log(`Site : fiches pratiques des lieux : ${n} renseignée(s)`);
  }
  for (const l of tous) { const d = details[slug(`${l.nom}-${l.ville}`)]; if (d && !d.vide) l.details = d; }
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

const PLATEFORMES = { 'shotgun.live': 'Shotgun', 'dice.fm': 'DICE', 'link.dice.fm': 'DICE', 'ra.co': 'Resident Advisor', 'residentadvisor.net': 'Resident Advisor', 'weezevent.com': 'Weezevent', 'billetweb.fr': 'Billetweb', 'eventbrite.fr': 'Eventbrite', 'eventbrite.com': 'Eventbrite', 'helloasso.com': 'HelloAsso', 'feverup.com': 'Fever', 'fnacspectacles.com': 'Fnac Spectacles', 'ticketmaster.fr': 'Ticketmaster', 'seetickets.com': 'See Tickets', 'yurplan.com': 'Yurplan', 'xceed.me': 'Xceed', 'bizouk.com': 'Bizouk', 'ticketmaster.com': 'Ticketmaster', 'eventbrite.co.uk': 'Eventbrite', 'seetickets.fr': 'See Tickets', 'provence-alpes-cotedazur.com': 'Provence-Alpes-Côte d\'Azur Tourisme' };
const nomPlateforme = (u) => { try { const d = new URL(u).hostname.replace(/^www\./, ''); return PLATEFORMES[d] || Object.entries(PLATEFORMES).find(([k]) => d.endsWith(k))?.[1] || d; } catch { return ''; } };

export async function construireSite({ events, eventsFrance = [], eventsOccitanie = [], hist = [], config = {}, now = new Date(), log = console.log, ig = null, api = {} }) {
  CONFIG_LLM = config.llm || {};
  const PLAFOND = Date.now() + (Number(process.env.SITE_MINUTES) || config.site?.minutes_enrichissement || 30) * 60e3;
  LIMITE = PLAFOND;
  await mkdir(path.join(SITE, 'affiches'), { recursive: true });
  const cache = lire(VERIF, {});
  const fin = now.getTime() + 45 * 864e5;
  const debut = now.getTime() - 4 * 3600e3;
  // Mêmes règles de fiabilité que les posts : pas de soirée douteuse, web vérifié ou très fiable.
  const fiables = events
    .filter((e) => e.source !== 'web' || (!e.douteux && (e.verifie || (e.confiance ?? 0) >= 0.85)))
    .filter((e) => { const t = Date.parse(e.start); return t >= debut && t <= fin; })
    .sort((a, b) => a.start.localeCompare(b.start));

  const pris = new Set();
  const preparer = async (e, zone) => {
    let affiche = '', dims = null;
    if (e.image) {
      const f = path.join(SITE, 'affiches', `${h(e.image)}.jpg`);
      if (existsSync(f) || await telecharger(e.image, f)) {
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
    const ville = zone === 'occitanie' ? slug(villeOccitanie(e) || e.city) : zone === 'france' ? slug(VILLES_FRANCE.find((v) => sansAccent(e.city).includes(sansAccent(v).split('-')[0])) || e.city)
      : (VILLES.find((v) => new RegExp(v, 'i').test(`${e.city} ${e.venue}`)) || (RE_VAR.test(`${e.city} ${e.venue} ${e.address || ''}`) ? 'var' : 'autres')).toLowerCase();
    let id = `${slug(e.name) || 'soiree'}-${cle(e.start)}`;
    for (let k = 2; pris.has(id); k++) id = `${slug(e.name)}-${cle(e.start)}-${k}`;
    pris.add(id);
    const url = /^https?:\/\//.test(e.url || '') && !/^https?:\/\/[^/]+\/?$/.test(e.url) ? e.url : '';
    const offres = (e.offres || []).filter((o) => o.url).sort((a, b) => (a.prix ?? 1e9) - (b.prix ?? 1e9));
    return {
      id, zone, nom: e.name, debut: e.start, jour: cle(e.start), lieu: e.venue || '', ville: e.city || '', adresse: e.address || '', filtreVille: ville,
      prix: e.price == null ? null : e.price, styles: styleDe(e), genres: genresList(e, 3).join(' · '), techno: isTechno(e), tags: e.tags || [],
      url, affiche, dims, accroche: e.accroche || '', description: e.description || '',
      instagram: (e.instagram || [])[0] || '', buzz: e.buzz ?? null, offres: offres.length >= 2 ? offres : [],
      festival: RE_FESTIVAL.test(`${e.name} ${(e.tags || []).join(' ')}`), etudiant: RE_ETUDIANT.test(`${e.name} ${(e.tags || []).join(' ')} ${e.public_cible || ''}`),
    };
  };
  const soirees = [];
  for (const e of fiables) soirees.push(await preparer(e, 'cote'));
  { const b = soirees.map((x) => x.buzz || 0).sort((x, y) => y - x); SEUIL_DEMANDE = Math.max(0.85, b[Math.floor(b.length / 8)] ?? 1); }
  // Grandes villes de France : rubrique à part (jamais mélangée à l'agenda de la Côte d'Azur et du Var).
  const soireesFrance = [];
  for (const e of (eventsFrance || []).filter((x) => !x.douteux && !villeOccitanie(x) && (x.verifie || (x.confiance ?? 0) >= 0.85)).filter((x) => { const t = Date.parse(x.start); return t >= debut && t <= fin; }).sort((x, y) => x.start.localeCompare(y.start))) soireesFrance.push(await preparer(e, 'france'));
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
  DETAILS_LIEUX = new Map(lieux.filter((l) => l.details).map((l) => [normLieu(l.nom), l.details]));
  PHOTOS_COMPTES = new Map([...(partenaires || []).filter((p) => p.fichier && p.instagram).map((p) => [p.instagram.toLowerCase(), p.fichier]), ...lieux.filter((l) => l.photo && l.instagram).map((l) => [l.instagram.toLowerCase(), l.photo])]);
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
  const compte = config.compte || '@teufy_official';
  const T = { ...TEUFY, ...(config.site || {}) };
  T.nbPartenaires = (String(T.partenaires).match(/\d+/) || ['200'])[0];
  GOOGLE = (config.site?.google_verification || '').trim();
  // Domaine propre (ex. teufyparty.com) : fichier CNAME lu par GitHub Pages ; vide = adresse GitHub Pages.
  const domaine = (config.site?.domaine || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (domaine) { URL_SITE = `https://${domaine}/`; await writeFile(path.join(ROOT, 'CNAME'), `${domaine}\n`); }
  else if (existsSync(path.join(ROOT, 'CNAME'))) spawnSync('rm', ['-f', path.join(ROOT, 'CNAME')]);
  CODES = (config.codes_promo || []).filter((c) => c.code && c.s_applique && (!c.jusqu_au || Date.parse(c.jusqu_au) >= now.getTime()));
  const majTexte = (t) => t.majLe.replace('{d}', paris(now, { day: 'numeric', month: 'long' }, t.locale));

  const rendre = () => {
    const pages = [];
    for (const lang of LANGUES) {
      const t = TXT[lang];
      const P = pre(lang);
      const tr = (x) => trad(lang, x);
      const sl = soirees.map((s) => ({ ...s, accroche: tr(s.accroche), description: tr(s.description) }));
      const sf = soireesFrance.map((s) => ({ ...s, accroche: tr(s.accroche) }));
      const so = soireesOccitanie.map((s) => ({ ...s, accroche: tr(s.accroche), description: tr(s.description) }));
      const ctx = (chemin) => ({ lang, t, tr, chemin, base: '../'.repeat((lang === 'fr' ? 0 : 1) + chemin.split('/').filter(Boolean).length), compte, T, maj: majTexte(t), actus, partenaires, lieux, festivalsGuide });
      const ajoute = (chemin, f) => pages.push([`${P}${chemin}`, f(ctx(chemin))]);
      ajoute('', (c) => page({ ...c, soirees: sl, posts, now }));
      ajoute('a-propos/', (c) => aPropos({ ...c, nb: sl.length, posts }));
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
    }
    return pages;
  };
  let pages = rendre();
  if (Object.keys(TR.manque).length && await traduireManquants(log)) pages = rendre();
  await writeFile(TRAD, JSON.stringify(TR.cache, null, 1) + '\n');

  // Anciennes pages de soirées (passées) : supprimées pour ne pas garder de liens morts dans Google.
  for (const l of LANGUES) {
    const d = path.join(ROOT, pre(l), 'soiree');
    if (existsSync(d)) for (const x of readdirSync(d)) if (!pris.has(x)) rmSync(path.join(d, x), { recursive: true, force: true });
    // Pages de villes (France, Occitanie) sans soirée à venir : supprimées elles aussi.
    for (const r of ['france', 'occitanie']) { const dr = path.join(ROOT, pre(l), r); if (existsSync(dr)) for (const x of readdirSync(dr, { withFileTypes: true })) if (x.isDirectory() && !pages.some(([c]) => c === `${pre(l)}${r}/${x.name}/`)) rmSync(path.join(dr, x.name), { recursive: true, force: true }); }
    const da = path.join(ROOT, pre(l), 'actus');
    if (existsSync(da)) for (const x of readdirSync(da, { withFileTypes: true })) if (x.isDirectory() && !actus.some((a) => a.id === x.name)) rmSync(path.join(da, x.name), { recursive: true, force: true });
  }
  for (const [dossier, html] of pages) {
    await mkdir(path.join(ROOT, dossier), { recursive: true });
    await writeFile(path.join(ROOT, dossier, 'index.html'), html);
  }
  await writeFile(path.join(ROOT, '404.html'), page404(TXT.fr));
  await ics([...soirees, ...soireesOccitanie, ...soireesFrance.filter((x) => !soirees.some((s) => s.id === x.id))], compte); // pages France aussi (bouton « Ajouter au calendrier »)

  const jourIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now);
  const chemins = [...new Set(pages.map(([d]) => d.replace(/^(en|it|es|zh|ar)\//, '')))];
  const prio = (c) => (!c ? '1.0' : /^soiree\//.test(c) ? '0.6' : /^(actus\/.|mentions)/.test(c) ? '0.5' : '0.8');
  const urls = LANGUES.flatMap((l) => chemins.map((c) => `  <url><loc>${URL_SITE}${pre(l)}${c}</loc><lastmod>${jourIso}</lastmod><changefreq>daily</changefreq><priority>${prio(c)}</priority>${LANGUES.map((x) => `<xhtml:link rel="alternate" hreflang="${x}" href="${URL_SITE}${pre(x)}${c}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${URL_SITE}${c}"/></url>`));
  await writeFile(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);
  await writeFile(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /out/\nDisallow: /apercus/\nDisallow: /livrables/\nDisallow: /tests/\nDisallow: /studio/\nDisallow: /veille/\nSitemap: ${URL_SITE}sitemap.xml\n`);
  await writeFile(path.join(ROOT, '.nojekyll'), '');
  log(`Site : ${soirees.length} soirée(s), ${soirees.filter((s) => s.affiche).length} avec affiche, ${soirees.filter((s) => !s.approx).length} placée(s) précisément sur la carte, ${soirees.filter((s) => s.offres.length).length} avec comparateur de prix, ${actus.length} actu(s), ${pages.length} page(s) en ${LANGUES.length} langues`);
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
  for (const x of readdirSync(d)) if (!soirees.some((s) => `${s.id}.ics` === x)) rmSync(path.join(d, x), { force: true });
  const f = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const e = (x) => String(x || '').replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  for (const s of soirees) {
    const t = Date.parse(s.debut);
    await writeFile(path.join(d, `${s.id}.ics`), ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Teufy//Agenda//FR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      `UID:${s.id}@teufy`, `DTSTAMP:${f(Date.now())}`, `DTSTART:${f(t)}`, `DTEND:${f(t + 5 * 3600e3)}`, `SUMMARY:${e(s.nom)}`,
      `LOCATION:${e([s.lieu, s.adresse, s.ville].filter(Boolean).join(', '))}`, `DESCRIPTION:${e(`${s.accroche ? `${s.accroche}\n` : ''}${s.url ? `Billets : ${s.url}\n` : ''}Via Teufy ${compte}`)}`,
      ...(s.url ? [`URL:${s.url}`] : []), 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n'));
  }
}

// Les 12 photos d'ambiance : chacune n'est utilisée qu'à UN seul endroit du site (pas de répétition).
const PHOTOS = ['danse', 'foule', 'selfie', 'rire', 'dj', 'lasers', 'rooftop', 'terrasse', 'plage', 'baskets', 'file', 'taxi'];
// Photos de Junior et de l'équipe en soirée (site/img/equipe/).
// Photos d'ambiance du hero d'accueil (diaporama) : pas de visage de l'équipe (seul le portrait du directeur est montré, page « Qui sommes-nous »).
const GALERIE = [];
const DIAPORAMA = ['danse', 'rooftop', 'selfie'];
const nombre = (p, t) => new Intl.NumberFormat(t.locale, { maximumFractionDigits: 2 }).format(p);
const prixTexte = (p, t) => (p == null ? '' : p === 0 ? t.gratuit : t.des(nombre(Math.round(p * 100) / 100, t)));
const heure = (d, t) => (t.locale === 'fr-FR' ? paris(d, { hour: '2-digit', minute: '2-digit' }).replace(':', 'h') : paris(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, t.locale));
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

function carte(s, { t, base, lang, vedette = false }) {
  const prix = prixTexte(s.prix, t);
  const lien = `${base}${pre(lang)}soiree/${s.id}/`;
  const q = sansAccent([s.nom, s.lieu, s.ville, s.genres, s.tags.join(' '), s.styles.map((k) => `${nomStyle(k, t, 'fr')} ${nomStyle(k, t, lang)}`).join(' '), s.accroche].join(' ')).replace(/\s+/g, ' ');
  // Format unique 4:5 pour des rangées nettes : l'affiche entière (jamais rognée) sur un fond flouté d'elle-même.
  const petite = s.affiche ? `${base}${s.affiche.replace(/\.jpg$/, '-480.webp')}` : '';
  const img = s.affiche
    ? `${existsSync(path.join(ROOT, s.affiche.replace(/\.jpg$/, '-480.webp'))) ? `<img class="fond-flou" src="${petite}" alt="" aria-hidden="true" loading="lazy" decoding="async">` : ''}${image(base, s.affiche, { alt: t.affiche + s.nom, sizes: TAILLES.carte, attrs: `class="principale${s.dims && s.dims[0] < 560 ? ' petite' : ''}" loading="lazy" decoding="async"${s.dims ? ` width="${s.dims[0]}" height="${s.dims[1]}"` : ''}` })}`
    : vignette(s, base);
  const acces = accesDe(s);
  const promo = promoDe(s);
  return `<article class="carte${vedette ? ' vedette' : ''}" data-acces="${acces.join(' ')}" data-id="${s.id}" data-jour="${s.jour}" data-debut="${esc(s.debut)}" data-heure="${esc(heure(s.debut, t))}" data-ville="${s.filtreVille}" data-styles="${s.styles.join(' ')}" data-prix="${s.prix ?? ''}" data-buzz="${s.buzz ?? ''}" data-lat="${s.lat ?? ''}" data-lng="${s.lng ?? ''}"${s.approx ? ' data-approx="1"' : ''} data-q="${esc(q)}">
  <a class="affiche${s.affiche ? '' : ' sans'}" href="${lien}" tabindex="-1" aria-hidden="true">${img}<span class="date">${esc(dateCourte(s.debut, t))}</span></a>
  <button type="button" class="coeur" aria-label="${esc(t.ajouterFav)}" aria-pressed="false"></button>
  <div class="infos">
    ${(s.buzz ?? 0) >= SEUIL_DEMANDE ? `<p class="demande"><b>${esc(t.tresDemandee)}</b><i class="rebours" data-debut="${esc(s.debut)}"></i></p>` : ''}
    ${s.genres ? `<p class="genre">${esc(s.genres)}</p>` : ''}
    <h3><a href="${lien}">${esc(s.nom)}</a></h3>
    ${s.accroche ? `<p class="accroche">${esc(s.accroche)}</p>` : ''}
    <p class="meta"><span>${esc(heure(s.debut, t))}</span><span>${esc(prix || t.prixBillet)}</span>${s.offres.length ? `<span class="comparer">${esc(t.comparer)} · ${s.offres.length}</span>` : ''}${promo ? `<span class="promo">${(() => { const e = economie(promo, s.prix); return e ? `${esc(t.locale.startsWith('fr') ? 'Économise' : '−')} ${esc(euros(e.eco, t))}` : esc(promo.remise); })()} · ${esc(promo.code)}</span>` : ''}<span class="distance"></span><span class="ou">${esc([s.lieu, s.ville].filter(Boolean).join(', '))}</span></p>
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
  ${(() => { const e = s && economie(c, s.prix); return e ? `<p class="code-economie"><span>💸 ${esc(tr('Tu économises'))} <b>${esc(euros(e.eco, t))}</b> ${esc(tr('par place'))}</span><small>${esc(tr('Exemple : place à'))} ${esc(euros(s.prix, t))} → <b>${esc(euros(e.apres, t))}</b> ${esc(tr('avec le code'))}</small></p>` : ''; })()}
  <p class="code-valable">✓ ${esc(tr(s ? 'Valable pour cette soirée' : 'Valable sur les soirées éligibles'))}${c.jusqu_au ? ` · ${esc(tr("jusqu'au"))} ${esc(paris(`${c.jusqu_au}T12:00:00Z`, { day: 'numeric', month: 'long', year: 'numeric' }, t.locale))}` : ''}</p>
  <p>${esc(tr(c.description))}</p>
  <ol class="code-etapes"><li>${esc(tr('Copie le code'))}</li><li>${esc(tr('Clique sur « Billets »'))}</li><li>${esc(tr('Colle-le au moment du paiement : la réduction s\'applique'))}</li></ol>
  <p class="petit"><b>${esc(t.conditions)} :</b> ${esc(tr(c.conditions))}</p>
</div>`;

// Soirée sans affiche : vignette typographique aux couleurs de la DA (dégradé propre à chaque soirée), jamais une photo répétée.
// Soirée sans affiche : on montre au moins la vraie image du lieu (logo ou photo Instagram / site officiel) quand on l'a.
let PHOTOS_LIEUX = new Map(), PHOTOS_COMPTES = new Map();
const photoDuLieu = (s) => { const k = normLieu(s.lieu); if (!k) return ''; if (PHOTOS_LIEUX.has(k)) return PHOTOS_LIEUX.get(k); for (const [n, f] of PHOTOS_LIEUX) if (n.length >= 4 && (k.startsWith(n) || n.startsWith(k))) return f; return ''; };
function vignette(s, base = '') {
  const n = parseInt(h(s.nom), 16), teintes = [[255, 90, 60], [255, 46, 110], [130, 80, 255], [40, 170, 255], [61, 255, 138], [255, 200, 60]];
  const [a, b] = [teintes[n % 6], teintes[(Math.floor(n / 7) % 5 + 1 + n % 6) % 6]];
  const ph = photoDuLieu(s) || PHOTOS_COMPTES.get(String(s.instagram || '').toLowerCase()) || '';
  const pv = photoVille(s.ville) || photoVille(s.filtreVille);
  return `<span class="vignette${ph ? ' avec-lieu' : ''}${pv ? ' avec-ville' : ''}" style="--a:rgb(${a.join(',')});--b:rgb(${b.join(',')})" aria-hidden="true">${pv ? `<img class="vignette-ville" src="${base}${esc(pv.fichier.replace(/\.jpg$/, '-800.webp'))}" srcset="${base}${esc(pv.fichier.replace(/\.jpg$/, '-480.webp'))} 480w, ${base}${esc(pv.fichier.replace(/\.jpg$/, '-800.webp'))} 800w" sizes="(min-width:980px) 640px, 150vw" alt="" width="800" height="533" loading="lazy" decoding="async">` : ''}${ph ? `<img class="vignette-lieu" src="${base}${esc(ph)}" alt="" width="176" height="176" loading="lazy" decoding="async">` : ''}<small>${esc((s.genres || '').split(' · ')[0] || 'Soirée')}</small><b>${esc(s.lieu || s.ville || s.nom)}</b><i>${esc(s.lieu ? s.ville : '')}</i></span>`;
}

const boutonBillets = (s, t) => (s.url
  ? `<a class="bouton" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(t.billets)}</a>`
  : `<a class="bouton secondaire" href="https://www.google.com/search?q=${encodeURIComponent(`${s.nom} ${s.lieu} billetterie`)}" target="_blank" rel="noopener">${esc(t.trouverBillets)}</a>`);

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
];
const PHOTO_STYLE = { techno: 'foule', house: 'baskets', afro: 'rire', shatta: 'dj', latino: 'taxi', rap: 'file' };

let CSS_EN_LIGNE = ''; // CSS écrite dans chaque page : affichage plus rapide (une requête de moins)
let VERSION = '1'; // change quand le CSS ou le JS change (le navigateur recharge la bonne version)
let GOOGLE = ''; // code de vérification Google Search Console (config.site.google_verification)
// Titres et descriptions à la bonne longueur pour Google (titre ≤ 65 caractères, description ≤ 160), coupés sur un mot.
const couper = (x, n) => { x = String(x || '').replace(/\s+/g, ' ').trim(); if (x.length <= n) return x; const c = x.slice(0, n - 1); return `${c.slice(0, Math.max(c.lastIndexOf(' '), n * 0.6)).replace(/[\s,;:·–-]+$/, '')}…`; };
// Soirée : « Nom · date · lieu · Teufy » ; si trop long, le lieu saute puis le nom est raccourci (la date reste : deux dates d'un même événement gardent des titres différents).
const titreCourt = ([nom, date, lieu]) => { const fin = ` · ${date} · Teufy`; if (`${nom} · ${date} · ${lieu} · Teufy`.length <= 66 && lieu) return `${nom} · ${date} · ${lieu} · Teufy`; return `${couper(nom, Math.max(20, 66 - fin.length))}${fin}`; };
// Autres pages : titre raccourci en gardant la marque à la fin.
const titrePage = (x) => { x = String(x || ''); if (x.length <= 70) return x; const m = x.match(/^(.*?)( · Teufy)$/); return m ? `${couper(m[1], 62)}${m[2]}` : couper(x, 70); };
function gabarit({ lang, t, titre, description, chemin, base, corps, ld = [], image = 'site/img/equipe/monaco.jpg', compte, maj = '', agendaIci = false }) {
  const handle = compte.replace(/^@/, '');
  const P = pre(lang);
  const accueil = `${base}${P}`;
  const nav = [['', t.agenda], ...VILLES_SEO.map((v) => [`${v.slug}/`, t.villes[v.cle === 'antibes' ? 'antibesCourt' : v.cle]]), ['festivals/', t.festivals], ['clubs-bars/', t.lieuxNav], ['dates/', t.dates], ['restaurants/', t.restos], ['activites/', t.activites], ['occitanie/', 'Occitanie'], ['actus/', t.actus], ['partenaires/', t.partenaires], ['a-propos/', t.qui]];
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
${GOOGLE ? `<meta name="google-site-verification" content="${esc(GOOGLE)}">` : ''}
<link rel="icon" href="${base}site/img/favicon-64.png">
<link rel="apple-touch-icon" href="${base}site/img/icone-192.png">
<link rel="manifest" href="${base}site/manifest.webmanifest">
<link rel="preload" href="${base}site/fonts/bricolage-titre.woff2" as="font" type="font/woff2" crossorigin>
<style>${CSS_EN_LIGNE.replace(/__BASE__/g, base)}</style>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'sha256-Du+OJKJSbdUgz5nrHeWWINvez6XKDDU/tyj/5c2uvwo='; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tiles.openfreemap.org; font-src 'self'; media-src 'self'; connect-src 'self' https://tiles.openfreemap.org; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<script>document.documentElement.classList.add('js')</script>
${ld.length ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<a class="saut" href="#contenu">${esc(t.contenu)}</a>
<header class="barre">
  <a class="marque" href="${accueil || './'}" aria-label="Teufy"><img src="${base}site/img/logo-96.webp" alt="Teufy" width="39" height="32"></a>
  <div class="barre-droite">
    <a class="loupe" href="${agendaIci ? '' : accueil}#recherche" aria-label="${esc(t.rechercher)}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></a>
    <details class="langues"><summary><span class="vh">${esc(t.langue)} : </span>${lang.toUpperCase()}</summary><div>${LANGUES.map((l) => `<a href="${base}${pre(l)}${chemin}" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="true"' : ''}>${esc(TXT[l].nom)}</a>`).join('')}</div></details>
    <a class="ig" href="https://www.instagram.com/${esc(handle)}/" target="_blank" rel="noopener" aria-label="Instagram ${esc(compte)}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="17.4" cy="6.6" r="1.3" fill="currentColor"/></svg></a>
  </div>
</header>
<nav class="nav" aria-label="Menu">${nav.map(([d, n]) => `<a href="${accueil}${d}"${d === chemin ? ' aria-current="page"' : ''}>${esc(n)}</a>`).join('')}</nav>
<main id="contenu">
${corps}
</main>
<footer>
  <div class="pied-colonnes">
    <div><p class="pied-titre">${esc(t.villesL)}</p>${VILLES_SEO.map((v) => `<a href="${accueil}${v.slug}/">${esc(t.villes[v.cle])}</a>`).join('')}<a href="${accueil}festivals/">${esc(t.festivals)}</a><a href="${accueil}dates/">${esc(t.dates)}</a><a href="${accueil}restaurants/">${esc(t.restos)}</a><a href="${accueil}activites/">${esc(t.activites)}</a><a href="${accueil}clubs-bars/">${esc(t.lieuxNav)}</a><a href="${accueil}occitanie/">Occitanie</a><a href="${accueil}france/">${esc(t.franceNav)}</a></div>
    <div><p class="pied-titre">${esc(t.stylesL)}</p>${PAGES_STYLES.map((k) => `<a href="${accueil}soirees-${k}/">${esc(nomStyle(k, t, lang))}</a>`).join('')}</div>
    <div><p class="pied-titre">${esc(t.teufyL)}</p><a href="${accueil}a-propos/">${esc(t.qui)}</a><a href="${accueil}faq/">FAQ</a><a href="${accueil}faq/#sources">${esc(TR_SOURCES[lang] || TR_SOURCES.fr)}</a><a href="${accueil}actus/">${esc(t.actus)}</a><a href="${accueil}partenaires/">${esc(t.partenaires)}</a><a href="${accueil}ambassadeurs/">${esc(t.ambassadeurs)}</a><a href="${accueil}bde/">${esc(t.bde)}</a><a href="https://www.instagram.com/${esc(handle)}/" target="_blank" rel="noopener">${esc(compte)}</a></div>
    <div><p class="pied-titre">${esc(t.langue)}</p>${LANGUES.map((l) => `<a href="${base}${pre(l)}${chemin}" hreflang="${l}" lang="${l}">${esc(TXT[l].nom)}</a>`).join('')}</div>
  </div>
  <p><strong>Teufy</strong> · ${esc(t.pied1)}${maj ? ` · ${esc(maj)}` : ''}</p>
  <p>${esc(t.pied3)} · <a href="${accueil}mentions-legales/">${esc(t.legal)}</a> · <a href="${accueil}cgu/">CGU</a> · <a href="${accueil}cgv/">CGV</a> · <a href="${accueil}confidentialite/">${esc(TR_LEG[lang] || 'Confidentialité et cookies')}</a></p>
</footer>
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
    founder: { '@type': 'Person', name: T.directeur, jobTitle: 'Directeur', ...(T.photo_directeur ? { image: URL_SITE + T.photo_directeur } : {}) },
    areaServed: ["Côte d'Azur", 'Nice', 'Cannes', 'Monaco', 'Antibes'], sameAs: [`https://www.instagram.com/${handle}/`],
    ...(T.email ? { email: T.email, contactPoint: { '@type': 'ContactPoint', email: T.email, contactType: 'customer support', availableLanguage: ['fr', 'en'] } } : {}),
  }, { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Teufy', url: `${URL_SITE}${pre(lang)}`, inLanguage: lang, publisher: { '@id': `${URL_SITE}#teufy` },
    potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${URL_SITE}${pre(lang)}?q={search_term_string}` }, 'query-input': 'required name=search_term_string' } }];
}

// Bandeau qui défile sous le hero.
const defile = (t) => `<div class="defile" aria-hidden="true" dir="ltr"><div class="piste">${[0, 1].map(() => `<span>${t.defile.map((x) => `${esc(x)}<i>✦</i>`).join('')}</span>`).join('')}</div></div>`;

// « Ce soir / En ce moment » : rempli par app.js avec les cartes de l'agenda (l'heure du visiteur fait foi).
const ceSoir = (t) => `<section id="ce-soir" class="ce-soir" hidden>
  <div class="tete"><p class="etiquette"><i class="point"></i>${esc(t.ceSoirEtiquette)}</p><h2>${t.ceSoirH2}</h2><p>${esc(t.ceSoirP)}</p></div>
  <div class="rangee"></div>
</section>`;

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
  <div class="pros-cartes">${PROS.map(([c, k, et, titre, texte, bouton], i) => { const a = AFFICHES_COLLAGE.length >= 6 ? AFFICHES_COLLAGE[k] : ''; return `<a class="pro${a ? '' : ' sans-photo'}" href="${base}${pre(lang)}${c}" style="--i:${i}">${a ? `<img src="${base}${a.replace(/\.jpg$/, '-800.webp')}" alt="" width="800" height="1000" loading="lazy" decoding="async">` : ''}<span><i class="pro-et">${esc(tr(et))}</i><strong>${esc(tr(titre))}</strong><em class="pro-texte">${esc(tr(texte))}</em><b class="pro-bouton">${esc(tr(bouton))} →</b></span></a>`; }).join('')}</div>
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
const collage = (base, k, logos = null) => {
  if (logos) return `<div class="collage logos-collage" aria-hidden="true">${logos.slice(0, 12).map((f, i) => `<img src="${base}${esc(f)}" alt="" width="160" height="160" loading="lazy" style="--i:${i}">`).join('')}</div>`;
  const l = AFFICHES_COLLAGE.length ? [0, 1, 2].map((i) => AFFICHES_COLLAGE[(k * 3 + i) % AFFICHES_COLLAGE.length]) : [];
  return l.length ? `<div class="collage" aria-hidden="true">${l.map((a, i) => `<img src="${base}${a.replace(/\.jpg$/, '-800.webp')}" alt="" width="400" height="500" loading="lazy" style="--i:${i}">`).join('')}</div>` : '';
};
const ICO_PARTAGE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 11H6.5A1.5 1.5 0 0 0 5 12.5v7A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const boutonPartage = (label, cls = '') => `<button type="button" class="partager icone-rond${cls ? ` ${cls}` : ''}" aria-label="${esc(label)}" title="${esc(label)}">${ICO_PARTAGE}</button>`;
const heroCourt = ({ base, photo, video, alt, etiquette, h1, p, live = false, k = 0, logos = null, partage = '' }) => `<section class="hero court${photo ? '' : ' sans-photo'}">
  ${photo ? `<div class="hero-media">${fond(base, photo, video, alt)}</div>` : `<div class="hero-deco" aria-hidden="true"><span></span><span></span><span></span></div>${collage(base, k, logos)}`}
  <div class="hero-texte">
    <p class="etiquette">${esc(etiquette)}</p>${partage ? boutonPartage(partage, 'hero-partage') : ''}
    <h1>${h1}</h1>
    ${p ? `<p>${p}</p>` : ''}
    ${live ? '<div class="hero-actions"><a class="pastille-live" href="#ce-soir" hidden><i class="point"></i><span></span></a></div>' : ''}
  </div>
</section>`;

const blocTendance = ({ t, tr, base, lang, lieux }) => {
  const top = (lieux || []).filter((l) => l.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  if (!top.length) return '';
  return `<section class="bloc-large reveal"><h2>${tr('🔥 Les spots du <em>moment</em>')}</h2><div class="fiches">${top.map((l, i) => carteLieu(l, { t, tr, base, lang }, i, true)).join('')}</div><p class="cta"><a class="bouton contour" href="${base}${pre(lang)}clubs-bars/">${esc(t.lieuxNav)}</a><a class="bouton contour" href="${base}${pre(lang)}france/">${esc(t.franceNav)}</a></p></section>`;
};
function page({ lang, t, tr, base, compte, T, soirees, posts, now, maj, partenaires, lieux }) {
  const handle = compte.replace(/^@/, '');
  const semaine = soirees.filter((s) => Date.parse(s.debut) < now.getTime() + 8 * 864e5);
  const vedette = [...semaine].filter((s) => s.affiche && (s.buzz ?? 0) >= 0.7).sort((a, b) => b.buzz - a.buzz)[0];
  const ctx = { lang, t, tr, base, T, partenaires };
  const populaires = PAGES_STYLES.filter((k) => soirees.some((s) => s.styles.includes(k)));
  const faq = t.faqHome;
  const corps = `<section class="hero">
  <div class="hero-media"><div class="diaporama" aria-hidden="true">${DIAPORAMA.map((f, i) => { const img = image(base, `site/img/${f}.jpg`, { sizes: TAILLE_HERO, attrs: `class="hero-photo" style="--i:${i}"${i ? '' : ' fetchpriority="high"'}` }); return i ? img.replace(' src="', ' data-src="').replace(' srcset="', ' data-srcset="') : img; }).join('')}</div></div>
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
${ceSoir(t)}
${vedette ? `<section class="la-plus reveal"><h2 class="etiquette">${esc(t.laPlus)}</h2>${carte(vedette, { t, base, lang, vedette: true })}</section>` : ''}
${agenda(soirees, { t, base, lang })}
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
    <p class="orga2-actions"><a class="bouton" href="https://ig.me/m/${esc(handle)}" target="_blank" rel="noopener">${ICO_IG}<span>${esc(tr('Envoyer ma soirée'))}</span></a><a class="bouton contour" href="${base}${pre(lang)}partenaires/">${esc(tr('Devenir partenaire'))}</a></p>
  </div>
</section>`;
}

function pageVille({ lang, t, tr, base, compte, T, chemin, v, soirees, now, maj }) {
  const ville = t.villes[v.cle];
  const n = soirees.filter((s) => s.jour === cle(now.toISOString())).length;
  const faq = t.faq(ville, n);
  const corps = `${heroCourt({ partage: t.partager, base, photo: v.photo, video: v.video, alt: ville, etiquette: t.villeEtiquette(ville), h1: t.villeH1(esc(ville)), p: `${esc(t.intro[v.cle])} ${esc(t.villeN(soirees.length))}`, live: true })}
${ceSoir(t)}
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
${ceSoir(t)}
${agenda(soirees, { t, base, lang, filtreStyle: false })}
<section class="qui reveal"><p class="liens-styles">${PAGES_STYLES.filter((k) => k !== cleStyle).map((k) => `<a class="puce" href="${base}${pre(lang)}soirees-${k}/">${esc(nomStyle(k, t, lang))}</a>`).join('')}</p></section>
${blocOrga({ t, tr, base, handle: compte.replace(/^@/, ''), lang })}`;
  return gabarit({ lang, t, titre: t.styleTitre(nom), description: t.styleDesc(nom, soirees.length), chemin, base, corps, compte, maj, agendaIci: true,
    ld: [...ldOrganisation(T, compte, t, lang), ...jsonld(soirees, lang), fil(lang, [['Teufy', ''], [nom, chemin]])] });
}

function pageSoiree({ lang, t, tr, base, compte, T, chemin, s, soirees, maj }) {
  const P = pre(lang);
  const lieu = [s.lieu, s.adresse && s.adresse !== s.lieu ? s.adresse : '', s.ville].filter(Boolean).join(', ');
  const meme = soirees.filter((x) => x.jour === s.jour && x.id !== s.id).slice(0, 6);
  const style = soirees.filter((x) => x.id !== s.id && x.jour !== s.jour && x.styles.some((k) => s.styles.includes(k))).slice(0, 6);
  const mini = (l, titre) => (l.length ? `<section class="similaires reveal"><h2>${titre}</h2><div class="grille">${l.map((x) => carte(x, { t, base, lang })).join('')}</div></section>` : '');
  const offres = s.offres.length ? `<div class="offres"><p class="pied-titre">${esc(t.comparer)}</p>${s.offres.map((o, i) => `<a href="${esc(o.url)}" target="_blank" rel="noopener"><span>${esc(nomPlateforme(o.url))}</span><b>${esc(o.prix == null ? t.prixBillet : prixTexte(o.prix, t))}</b>${i === 0 && o.prix != null ? `<i>${esc(t.meilleurPrix)}</i>` : ''}</a>`).join('')}</div>` : '';
  const img = s.affiche ? image(base, s.affiche, { alt: t.affiche + s.nom, sizes: '(min-width:860px) 460px, 92vw', attrs: `fetchpriority="high"${s.dims ? ` width="${s.dims[0]}" height="${s.dims[1]}"` : ''}${s.dims && s.dims[0] < 560 ? ` class="petite" style="max-width:${s.dims[0]}px"` : ''}` }) : `<div class="affiche-fiche">${vignette(s, base)}</div>${(() => { const pv = photoVille(s.ville) || photoVille(s.filtreVille); return pv ? `<p class="credit-photo">${esc(tr('Photo de la ville'))} : ${esc(pv.auteur)} · <a href="${esc(pv.source)}" target="_blank" rel="noopener nofollow">${esc(pv.licence)}</a></p>` : ''; })()}`;
  const corps = `<article class="fiche carte-donnees" data-id="${s.id}" data-debut="${esc(s.debut)}">
  <nav class="ariane"><a href="${base}${P}">Teufy</a> › ${s.zone === 'occitanie' ? `<a href="${base}${P}occitanie/">Occitanie</a>` : s.zone === 'france' ? `<a href="${base}${P}france/">${esc(t.franceNav)}</a>` : `<a href="${base}${P}#agenda">${esc(t.agenda)}</a>`} › <span>${esc(s.nom)}</span></nav>
  <div class="fiche-grille">
    <div class="fiche-affiche">${img}</div>
    <div class="fiche-infos">
      ${s.genres ? `<p class="genre">${esc(s.genres)}</p>` : ''}
      <h1>${esc(s.nom)}</h1>
      ${s.accroche ? `<p class="fiche-accroche">${esc(s.accroche)}</p>` : ''}
      ${s.description && s.description !== s.accroche ? `<p>${esc(s.description)}</p>` : ''}
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
        <button type="button" class="coeur grand" aria-label="${esc(t.ajouterFav)}" aria-pressed="false"></button>
      </p>
      ${promoDe(s) ? blocPromo(promoDe(s), t, tr, s) : ''}
      ${offres}
      ${yAller(s, t, lieu)}
      ${s.instagram ? `<p class="orga-ig"><a class="lien" href="https://www.instagram.com/${esc(s.instagram)}/" target="_blank" rel="noopener">@${esc(s.instagram)}</a></p>` : ''}
      <p class="source-fiche">${s.url ? `${esc(tr('Infos vérifiées sur'))} <a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(nomPlateforme(s.url))}</a> · ` : ''}${esc(tr('Une erreur ?'))} <a href="https://ig.me/m/${esc(compte.replace(/^@/, ''))}" target="_blank" rel="noopener">${esc(tr('Signale-la'))}</a> · <a href="${base}${P}faq/#sources">${esc(tr('Nos sources'))}</a></p>
    </div>
  </div>
</article>
<div class="barre-billets" hidden><div><b>${esc(prixTexte(s.prix, t) || t.prixBillet)}</b><small>${esc(dateCourte(s.debut, t))} · ${esc(heure(s.debut, t))}</small></div>${boutonBillets(s, t)}</div>
${mini(meme, esc(t.memeSoir))}
${mini(style, esc(t.memeStyle))}
<p class="retour"><a class="bouton" href="${base}${P}${s.zone === 'occitanie' ? 'occitanie/' : s.zone === 'france' ? 'france/' : '#agenda'}">${esc(s.zone === 'occitanie' ? tr("Toutes les soirées d'Occitanie") : t.toutes)}</a></p>`;
  return gabarit({ lang, t, titre: titreCourt([s.nom, dateCourte(s.debut, t), s.lieu || s.ville]), description: `${s.nom}, ${dateLongue(s.debut, t)} ${heure(s.debut, t)}, ${lieu}. ${s.accroche || ''} ${prixTexte(s.prix, t)}`.trim().slice(0, 300), chemin, base, corps, compte, maj,
    image: s.affiche || 'site/img/equipe/monaco.jpg', ld: [jsonEvent(s, lang), fil(lang, [['Teufy', ''], s.zone === 'occitanie' ? ['Occitanie', 'occitanie/'] : s.zone === 'france' ? [t.franceNav, 'france/'] : [t.agenda, ''], [s.nom, chemin]])] });
}

// « Y aller » : parkings, transports, vélos et taxis autour du lieu (OpenStreetMap), plus un itinéraire en transports.
function yAller(s, t, lieu) {
  const p = s.proches;
  const dist = (m) => t.aPied.replace('{m}', m).replace('{min}', Math.max(1, Math.round(m / 80)));
  const dest = s.approx || !s.lat ? encodeURIComponent(lieu) : `${s.lat},${s.lng}`;
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
  const carteP = (p, i) => `<article class="fiche-lieu" style="--i:${i % 8}">
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
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, alt: tr(C.etiquette), etiquette: tr(C.etiquette), h1: tr(C.h1), p: esc(tr(C.p)), k: 8 + Object.keys(SORTIES).indexOf(cleS) })}
${spots}
<section class="bloc-large reveal">${l.length ? `<h2>${tr('Les bonnes adresses de nos <em>partenaires</em>')}</h2>` : ''}${l.length ? `<div class="fiches">${l.map(carteP).join('')}</div>` : cleS === 'dates' ? '' : `<p class="vide">${esc(tr(SORTIES.vide))}</p>`}${ctaIg(handle, t.orgaBouton, T.email)}</section>`;
  return gabarit({ lang, t, titre: tr(C.titre), description: tr(C.desc), chemin, base, corps, compte, maj, ld: [...ldOrganisation(T, compte, t, lang), fil(lang, [['Teufy', ''], [tr(C.etiquette), chemin]]),
    ...(l.length ? [{ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: l.map((p, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': p.categorie === 'restaurant' ? 'Restaurant' : 'LocalBusiness', name: p.nom, ...(p.adresse || p.ville ? { address: { '@type': 'PostalAddress', streetAddress: p.adresse || undefined, addressLocality: p.ville || undefined } } : {}), ...(p.site ? { url: p.site } : {}) } })) }] : [])] });
}

function pageFestivals({ lang, t, tr, base, compte, T, chemin, soirees, maj, festivalsGuide, partenaires }) {
  const recherche = (n) => `https://www.google.com/search?q=${encodeURIComponent(`${n} site officiel`)}`;
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, alt: t.festivals, k: 1, etiquette: t.festivals, h1: t.festH1, p: esc(t.festP) })}
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
  return gabarit({ lang, t, titre: t.festTitre, description: t.festDesc, chemin, base, corps, compte, maj, ld: [...ldOrganisation(T, compte, t, lang), ...jsonld(soirees, lang), fil(lang, [['Teufy', ''], [t.festivals, chemin]])] });
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
    if (a.image_site && !/affiches/.test(a.image_site)) for (const l of [400, 800, 1200]) webp(path.join(ROOT, a.image_site), l);
    const post = hist.find((x) => x.lien && x.publication?.veille?.source && x.publication.veille.source === a.source);
    if (post) a.insta = post.lien;
  }
  return actus;
}
function imageActu(a, { base, cadre = true, sizes = '(min-width:980px) 380px, 92vw', attrs = 'loading="lazy" decoding="async"' } = {}) {
  if (!a.image_site) return `<span class="actu-flash" aria-hidden="true"><b>${esc(a.ville || 'Teufy')}</b></span>`;
  // Dans les cartes, le cadre est en 4/5 : une image en paysage y est recadrée donc agrandie ; on demande la taille réelle affichée.
  const f = cadre && a.dims ? Math.max(1, 1.25 * a.dims[0] / a.dims[1]) : 1;
  if (f > 1) sizes = sizes.replace(/(\d+)(px|vw)/g, (_, n, u) => `${Math.round(n * f)}${u}`);
  return image(base, a.image_site, { alt: a.titre, sizes, attrs: `${attrs}${a.dims ? ` width="${a.dims[0]}" height="${a.dims[1]}"` : ''}` });
}
const dateActu = (a, t) => { const d = Date.parse(a.date); return isNaN(d) ? '' : paris(d, { day: 'numeric', month: 'long', year: 'numeric' }, t.locale); };
function pageActus({ lang, t, tr, base, compte, T, chemin, actus, maj }) {
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, alt: t.actus, k: 2, etiquette: t.actus, h1: t.actusH1, p: esc(t.actusP) })}
<section class="bloc-large reveal"><h2 class="vh">${esc(t.actus)}</h2>${actus.length ? `<div class="actus">${actus.map((a, i) => `<a class="actu${i === 0 ? ' une' : ''}" href="${base}${pre(lang)}actus/${a.id}/" style="--i:${i % 6}"><span class="actu-img${a.visuel ? ' visuel' : ''}">${imageActu(a, { base, sizes: i === 0 ? '(min-width:980px) 560px, 92vw' : undefined })}</span><p class="genre">${esc(dateActu(a, t))}${a.ville ? ` · ${esc(tr(a.ville))}` : ''}</p><h3>${esc(tr(a.titre))}</h3><p>${esc(tr(a.chapo))}</p><b>${esc(t.lire)} →</b></a>`).join('')}</div>` : `<p class="vide">${esc(t.actusVide)}</p>`}</section>`;
  return gabarit({ lang, t, titre: t.actusTitre, description: t.actusDesc, chemin, base, corps, compte, maj, ld: [...ldOrganisation(T, compte, t, lang), fil(lang, [['Teufy', ''], [t.actus, chemin]])] });
}
function pageActu({ lang, t, tr, base, compte, chemin, a, actus, maj }) {
  const autres = actus.filter((x) => x.id !== a.id).slice(0, 3);
  const corps = `<article class="article">
  <nav class="ariane"><a href="${base}${pre(lang)}">Teufy</a> › <a href="${base}${pre(lang)}actus/">${esc(t.actus)}</a></nav>
  <p class="genre">${esc(t.publie.replace('{d}', dateActu(a, t)))}${a.ville ? ` · ${esc(tr(a.ville))}` : ''}</p>
  <h1>${esc(tr(a.titre))}</h1>
  <p class="chapo">${esc(tr(a.chapo))}</p>
  <p class="actu-partage">${boutonPartage(t.partager)}<span>${esc(t.partager)}</span></p>
  ${a.image_site ? `<figure class="actu-figure${a.visuel ? ' visuel' : ''}">${imageActu(a, { base, cadre: false, sizes: '(min-width:760px) 680px, 92vw', attrs: 'decoding="async"' })}</figure>` : ''}
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
  const l = (partenaires || []).filter((p) => p.nom && p.fichier).sort((a, b) => ordre.indexOf(a.categorie) - ordre.indexOf(b.categorie));
  if (!l.length) return '';
  return `<section class="bloc-large vitrine reveal"><h2>${t.vitrineH2}</h2><p class="avert">${esc(t.vitrineN.replace('{n}', Math.max(l.length, +((partenaires || []).length))))}</p>
  ${(() => { // 20 visibles (rangées pleines en 2, 4 ou 5 colonnes), le reste dans un dépliant : 167 lignes faisaient une page interminable sur mobile
    const item = (p, i) => `<${p.instagram ? `a href="https://www.instagram.com/${esc(p.instagram)}/" target="_blank" rel="noopener"` : 'div'} class="vitrine-item" style="--i:${i % 12}"><img src="${base}${esc(p.fichier)}" alt="" width="64" height="64" loading="lazy"><span><strong>${esc(p.nom)}</strong><small>${esc([p.categorie ? tr(SORTIES.categories[p.categorie] || '') : '', p.ville].filter(Boolean).join(' · '))}</small></span></${p.instagram ? 'a' : 'div'}>`;
    const N = 20;
    return `<div class="vitrine-grille">${l.slice(0, N).map(item).join('')}</div>${l.length > N ? `<details class="logos-plus"><summary>${esc(tr('Voir tous les partenaires'))} <span>+${l.length - N}</span></summary><div class="vitrine-grille">${l.slice(N).map(item).join('')}</div></details>` : ''}`; })()}</section>`;
}

// Clubs & bars : tendance du moment puis annuaire par ville.
const TYPES_NOMS = { club: 'Club', bar: 'Bar', rooftop: 'Rooftop', 'beach-club': 'Beach club', 'bar-a-cocktails': 'Bar à cocktails', pub: 'Pub', lounge: 'Lounge', salle: 'Salle de concert' };
const ICO_LIEU = { ig: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.3" fill="currentColor"/></svg>',
  site: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.5" fill="currentColor"/></svg>' };
// Fiche d'un club ou d'un bar : même style que les fiches Restos / Activités (bannière, logo, boutons).
function carteLieu(l, { t, tr, base, lang }, i = 0, tendance = false) {
  const prochaines = l.prochaines || [];
  const raison = l.insta && l.insta.posts21 ? `${tr('Sur ses publications des 3 dernières semaines')} : ${l.insta.likes} ${tr('likes')} · ${l.insta.commentaires} ${tr('commentaires en moyenne')} · ${l.insta.posts21} ${tr('posts')}` : '';
  return `<article class="fiche-lieu${tendance ? ' tendance' : ''}" id="${esc(l.slug)}" style="--i:${i % 8}" data-type="${esc(l.type)}">
    <div class="fiche-banniere${l.photo ? '' : ' banniere-ville'}"${l.photo ? ` style="--fond:url('${base}${esc(l.photo)}')"` : photoVille(l.ville) ? ` style="--fond:url('${base}${esc(photoVille(l.ville).fichier.replace(/\.jpg$/, '-480.webp'))}')"` : ''}>${tendance ? `<span class="rang">🔥 #${i + 1}</span>` : ''}${l.photo ? `<img src="${base}${esc(l.photo)}" alt="" width="88" height="88" loading="lazy">` : `<span class="lieu-initiale">${esc((l.nom[0] || '?').toUpperCase())}</span>`}</div>
    <div class="fiche-corps">
    <p class="genre">${esc(tr(TYPES_NOMS[l.type] || ''))}${l.ville ? ` · ${esc(l.ville)}` : ''}${l.partenaire ? ` <span class="fiche-prix">${esc(t.partenaires)}</span>` : ''}</p>
    <h3>${esc(l.nom)}</h3>
    ${l.description ? `<p class="fiche-desc">${esc(tr(l.description))}</p>` : ''}
    ${l.details ? (() => { const d = l.details; const lignes = [['🎵', tr('Musique'), d.styles], ['👔', tr('Dress code'), d.dress_code], ['🕒', tr('Horaires'), d.horaires], ['🍸', tr('Verres'), d.prix_verre], ['🎟️', tr('Entrée'), d.entree], ['🔞', tr('Âge'), d.age_min]].filter((x) => x[2]); return lignes.length ? `<dl class="lieu-infos">${lignes.map(([i, k, v]) => `<div><dt><span aria-hidden="true">${i}</span> ${esc(k)}</dt><dd>${esc(tr(v))}</dd></div>`).join('')}</dl><p class="lieu-maj">${esc(tr('Infos relevées le'))} ${esc(paris(d.le, { day: 'numeric', month: 'long' }, t.locale))}${d.sources?.[0] ? ` · <a href="${esc(d.sources[0])}" target="_blank" rel="noopener nofollow">${esc(tr('source'))}</a>` : ''}</p>` : ''; })() : ''}
    ${raison && tendance ? `<p class="petit">${esc(raison)}</p>` : ''}
    ${prochaines.length ? `<p class="lieu-soirees">${prochaines.slice(0, 3).map((x) => `<a href="${base}${pre(lang)}soiree/${x.id}/">${esc(x.nom)}</a>`).join('')}</p>` : ''}
    <p class="lieu-actions">${l.instagram ? `<a href="https://www.instagram.com/${esc(l.instagram)}/" target="_blank" rel="noopener" aria-label="Instagram @${esc(l.instagram)}">${ICO_LIEU.ig}<span>Instagram</span></a>` : ''}${l.site ? `<a href="${esc(l.site)}" target="_blank" rel="noopener">${ICO_LIEU.site}<span>${esc(t.siteWeb)}</span></a>` : ''}<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent([l.nom, l.adresse, l.ville].filter(Boolean).join(', '))}" target="_blank" rel="noopener">${ICO_LIEU.map}<span>${esc(t.itineraire)}</span></a></p>
    </div>
  </article>`;
}
function pageLieux({ lang, t, tr, base, compte, T, chemin, maj, lieux }) {
  const ctx = { t, tr, base, lang };
  const top = (lieux || []).filter((l) => l.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
  const parVille = {};
  for (const l of lieux || []) (parVille[l.ville || tr('Autres')] ||= []).push(l);
  const villes = Object.keys(parVille).sort((a, b) => parVille[b].length - parVille[a].length);
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, alt: t.lieuxNav, k: 3, etiquette: t.lieuxNav, h1: tr("Les clubs et bars de la <em>Côte d'Azur</em> et du Var"), p: esc(tr("Boîtes de nuit, bars, rooftops et beach clubs de Nice à Toulon, avec ceux qui font le plus parler d'eux en ce moment.")) })}
${top.length ? `<section class="bloc-large reveal"><h2>${tr('🔥 Tendance du <em>moment</em>')}</h2><p class="avert">${esc(tr("Classement calculé chaque jour à partir de données réelles : likes et commentaires sur les publications Instagram des 3 dernières semaines, rapportés au nombre d'abonnés. Être partenaire de Teufy ne donne aucun bonus."))}</p><div class="fiches">${top.map((l, i) => carteLieu(l, ctx, i, true)).join('')}</div></section>` : ''}
<section class="bloc-large reveal"><p class="liens-styles">${villes.map((v) => `<a class="puce" href="#v-${slug(v)}">${esc(v)} · ${parVille[v].length}</a>`).join('')}</p></section>
${villes.map((v) => `<section class="bloc-large reveal" id="v-${slug(v)}"><h2>${esc(v)}</h2><div class="fiches">${parVille[v].map((l, i) => carteLieu(l, ctx, i)).join('')}</div></section>`).join('\n')}
${(lieux || []).length ? '' : `<section class="bloc-large"><p class="vide">${esc(tr("L'annuaire se remplit : Teufy recense les clubs et bars de la Côte d'Azur et du Var."))}</p></section>`}`;
  return gabarit({ lang, t, titre: tr("Clubs et bars de la Côte d'Azur et du Var : les plus tendance en ce moment · Teufy"), description: tr("Toutes les boîtes de nuit, bars, rooftops et beach clubs de Nice, Cannes, Antibes, Monaco, Toulon et Saint-Tropez, et le classement des lieux les plus tendance du moment."), chemin, base, corps, compte, maj,
    ld: [...ldOrganisation(T, compte, t, lang), fil(lang, [['Teufy', ''], [t.lieuxNav, chemin]]), { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: (lieux || []).slice(0, 100).map((l, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': l.type === 'club' ? 'NightClub' : 'BarOrPub', name: l.nom, ...(l.adresse || l.ville ? { address: { '@type': 'PostalAddress', streetAddress: l.adresse || undefined, addressLocality: l.ville || undefined } } : {}) } })) }] });
}

// Occitanie : toutes les soirées de la région, par jour, avec un filtre par ville (site seulement).
function pageOccitanie({ lang, t, tr, base, compte, T, chemin, maj, soirees, cleVille }) {
  const villes = [...new Set(soirees.map((s) => s.filtreVille))];
  const nomVille = cleVille ? (VILLES_OCCITANIE.find((v) => slug(v) === cleVille) || soirees[0]?.ville || cleVille) : '';
  const tous = cleVille ? null : villes;
  const titre = cleVille ? tr(`Soirées à ${nomVille} : l'agenda`) : tr('Soirées en Occitanie : tout l\'agenda');
  const parJour = new Map();
  for (const s of soirees) { if (!parJour.has(s.jour)) parJour.set(s.jour, []); parJour.get(s.jour).push(s); }
  const jourTitre = (iso) => { const x = paris(Date.parse(`${iso}T12:00:00Z`), { weekday: 'long', day: 'numeric', month: 'long' }, t.locale); return x.charAt(0).toUpperCase() + x.slice(1); };
  const puces = VILLES_OCCITANIE.filter((v) => (tous || villes).includes(slug(v))).map((v) => `<a class="puce${slug(v) === cleVille ? ' actif' : ''}" href="${base}${pre(lang)}occitanie/${slug(v)}/">${esc(v)}</a>`).join('');
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, alt: titre, k: 5, etiquette: 'Occitanie', h1: cleVille ? tr(`Les soirées à <em>${nomVille}</em>`) : tr('Toutes les soirées d\'<em>Occitanie</em>'), p: esc(cleVille ? tr(`Toutes les soirées à venir à ${nomVille}, vérifiées sur leur billetterie.`) : tr("Teufy, c'est d'abord la Côte d'Azur. Pour quand tu bouges : Montpellier, Toulouse, Nîmes, Perpignan, Sète, Béziers… toutes les soirées d'Occitanie au même endroit, vérifiées sur leur billetterie.")) })}
<section class="bloc-large reveal"><p class="liens-styles">${cleVille ? `<a class="puce" href="${base}${pre(lang)}occitanie/">${esc(tr('Toute l\'Occitanie'))}</a>` : ''}${puces}<a class="puce" href="${base}${pre(lang)}#agenda">${esc(tr("Côte d'Azur et Var"))}</a></p>
${soirees.length ? [...parJour].map(([j, l]) => `<h2 class="jour-titre">${esc(jourTitre(j))} <small>${l.length}</small></h2><div class="grille">${l.map((s) => carte(s, { t, base, lang })).join('')}</div>`).join('\n') : `<p class="vide">${esc(tr('Les soirées d\'Occitanie arrivent : la recherche tourne chaque jour.'))}</p>`}</section>`;
  return gabarit({ lang, t, titre: `${titre} · Teufy`, description: couper(cleVille ? tr(`Toutes les soirées à ${nomVille} : ${soirees.length} soirée(s) à venir avec date, lieu, prix et billetterie, vérifiées par Teufy.`) : tr(`Toutes les soirées d'Occitanie : ${soirees.length} soirée(s) à venir à Montpellier, Toulouse, Nîmes, Perpignan, Sète, Béziers et dans toute la région.`), 160), chemin, base, corps, compte, maj, ld: [...ldOrganisation(T, compte, t, lang), ...jsonld(soirees, lang)] });
}

// Grandes villes de France : rubrique séparée de l'agenda de la Côte d'Azur et du Var.
function pageFrance({ lang, t, tr, base, compte, T, chemin, maj, soirees, cleVille }) {
  const nomVille = cleVille ? (VILLES_FRANCE.find((v) => slug(v) === cleVille) || soirees[0]?.ville || cleVille) : '';
  const villes = [...new Set(soirees.map((s) => s.filtreVille))];
  const titre = cleVille ? tr(`Soirées à ${nomVille} : les plus attendues`) : tr('Soirées dans les grandes villes de France');
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, alt: titre, k: 4, etiquette: tr('Ailleurs en France'), h1: cleVille ? tr(`Les soirées à <em>${nomVille}</em>`) : tr('Les soirées des <em>grandes villes</em> de France'), p: esc(tr("Teufy, c'est d'abord la Côte d'Azur et le Var. Ici, les soirées les plus attendues des grandes villes étudiantes, pour quand tu bouges.")) })}
<section class="bloc-large reveal"><p class="liens-styles">${cleVille ? `<a class="puce" href="${base}${pre(lang)}france/">${esc(tr('Toutes les villes'))}</a>` : ''}${VILLES_FRANCE.filter((v) => villes.includes(slug(v))).map((v) => `<a class="puce${slug(v) === cleVille ? ' actif' : ''}" href="${base}${pre(lang)}france/${slug(v)}/">${esc(v)}</a>`).join('')}<a class="puce" href="${base}${pre(lang)}#agenda">${esc(tr("Côte d'Azur et Var"))}</a></p>
${soirees.length ? `<h2>${tr('Les plus <em>attendues</em>')}</h2><div class="grille">${soirees.map((s) => carte(s, { t, base, lang })).join('')}</div>` : `<p class="vide">${esc(tr('Les soirées des grandes villes arrivent : la recherche tourne tous les deux jours.'))}</p>`}</section>`;
  return gabarit({ lang, t, titre: `${titre} · Teufy`, description: cleVille ? tr(`Les soirées les plus attendues à ${nomVille} : ${soirees.length} soirée(s) à venir, avec date, lieu, prix et lien de billetterie, choisies par Teufy.`) : tr("Les soirées les plus attendues à Paris, Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Montpellier, Strasbourg, Rennes, Grenoble et Aix-en-Provence."), chemin, base, corps, compte, maj, ld: [...ldOrganisation(T, compte, t, lang), ...jsonld(soirees, lang)] });
}

// Pages « pros » : partenaires, ambassadeurs, BDE (texte français traduit par l'IA).
const cartesTexte = (l, tr) => `<div class="cartes-texte">${l.map(([a, b], i) => `<article class="carte-texte" style="--i:${i}"><h3>${tr(a)}</h3><p>${tr(b)}</p></article>`).join('')}</div>`;
const etapes = (l, tr) => `<ol class="etapes">${l.map(([a, b], i) => `<li style="--i:${i}"><b>${i + 1}</b><div><h3>${tr(a)}</h3><p>${tr(b)}</p></div></li>`).join('')}</ol>`;
const ctaIg = (handle, texte, email) => `<p class="cta"><a class="bouton" href="https://ig.me/m/${esc(handle)}" target="_blank" rel="noopener">${esc(texte)}</a>${email ? `<a class="bouton contour" href="mailto:${esc(email)}">${esc(email)}</a>` : ''}</p>`;

function pagePartenaire({ lang, t, tr, base, compte, T, chemin, maj, partenaires }) {
  const C = PARTENAIRE, handle = compte.replace(/^@/, '');
  const faq = C.faq.map(([q, r]) => [tr(q), tr(r)]);
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, logos: (partenaires || []).filter((x) => x.fichier).slice(0, 12).map((x) => x.fichier), alt: t.partenaires, etiquette: tr(C.etiquette), h1: tr(C.h1), p: esc(tr(C.chapo)) })}
${vitrine({ t, tr, base, partenaires })}
<section class="bloc-large reveal"><h2>${tr(C.pourquoiH2)}</h2>${cartesTexte(C.pourquoi, tr)}</section>
<section class="bloc-large reveal"><h2>${tr(C.offreH2)}</h2>${cartesTexte(C.offre, tr)}</section>
<section class="bloc-large reveal"><h2>${tr(C.pourQuiH2)}</h2><p class="liens-styles">${C.pourQui.map((x) => `<span class="puce">${esc(tr(x))}</span>`).join('')}</p></section>
<section class="bloc-large reveal"><h2>${tr(C.etapesH2)}</h2>${etapes(C.etapes, tr)}${ctaIg(handle, tr(C.cta), T.email)}</section>
${blocFaq(t.faqH, faq)}`;
  return gabarit({ lang, t, titre: tr(C.titre), description: tr(C.desc), chemin, base, corps, compte, maj, image: 'site/img/lasers.jpg', ld: [...ldOrganisation(T, compte, t, lang), ldFaq(faq), fil(lang, [['Teufy', ''], [t.partenaires, chemin]])] });
}
function pageAmbassadeur({ lang, t, tr, base, compte, T, chemin, maj }) {
  const C = AMBASSADEUR, handle = compte.replace(/^@/, '');
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, alt: t.ambassadeurs, k: 5, etiquette: tr(C.etiquette), h1: tr(C.h1), p: esc(tr(C.chapo)) })}
<section class="bloc-large reveal"><h2>${tr(C.roleH2)}</h2>${cartesTexte(C.role, tr)}</section>
<section class="bloc-large reveal"><h2>${tr(C.avantagesH2)}</h2>${cartesTexte(C.avantages, tr)}</section>
<section class="bloc-large reveal"><h2>${tr(C.profilH2)}</h2><ul class="coches">${C.profil.map((x) => `<li>${esc(tr(x))}</li>`).join('')}</ul></section>
<section class="bloc-large reveal"><h2>${tr(C.candidatureH2)}</h2><p class="grand-texte">${esc(tr(C.candidature))}</p>${ctaIg(handle, tr(C.cta), T.email)}</section>
`;
  return gabarit({ lang, t, titre: tr(C.titre), description: tr(C.desc), chemin, base, corps, compte, maj, image: 'site/img/danse.jpg', ld: [...ldOrganisation(T, compte, t, lang), fil(lang, [['Teufy', ''], [t.ambassadeurs, chemin]])] });
}
function pageBde({ lang, t, tr, base, compte, T, chemin, soirees, maj, partenaires }) {
  const C = BDE, handle = compte.replace(/^@/, '');
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, alt: t.bde, k: 6, etiquette: tr(C.etiquette), h1: tr(C.h1), p: esc(tr(C.chapo)) })}
<section class="bloc-large reveal"><h2>${tr(C.offreH2)}</h2>${cartesTexte(C.offre, tr)}</section>
<section class="bloc-large reveal"><h2>${tr(C.etapesH2)}</h2>${etapes(C.etapes, tr)}${ctaIg(handle, tr(C.cta), T.email)}</section>
${soirees.length ? `<section class="bloc-large reveal"><h2>${tr(C.soireesH2)}</h2><div class="grille">${soirees.map((s) => carte(s, { t, base, lang })).join('')}</div></section>` : ''}`;
  return gabarit({ lang, t, titre: tr(C.titre), description: tr(C.desc), chemin, base, corps, compte, maj, image: 'site/img/selfie.jpg', ld: [...ldOrganisation(T, compte, t, lang), ...jsonld(soirees, lang), fil(lang, [['Teufy', ''], [t.bde, chemin]])] });
}
// FAQ générale + sources (FAQPage pour Google), avec un sommaire cliquable.
function pageFaq({ lang, t, tr, base, compte, T, chemin, maj }) {
  const C = FAQ, slugG = (x) => slug(x);
  const faq = C.groupes.flatMap(([, l]) => l.map(([q, r]) => [tr(q), tr(r)]));
  const corps = `${heroCourt({ partage: t.partager, base, photo: null, alt: 'FAQ', k: 8, etiquette: tr(C.etiquette), h1: tr(C.h1), p: esc(tr(C.chapo)) })}
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
  ${C.blocs.map(([titre, ps]) => `<h2>${esc(tr(titre))}</h2>${ps.map((p) => `<p>${esc(tr(p))}</p>`).join('')}`).join('\n  ')}
  <nav class="liens-legaux" aria-label="${esc(tr('Informations légales'))}">${Object.keys(PAGES_LEGALES).filter((k) => k !== cle).map((k) => `<a class="puce" href="${base}${pre(lang)}${k}/">${esc(tr(NOMS_LEGAUX[k]))}</a>`).join('')}</nav>
</article>`;
  return gabarit({ lang, t, titre: tr(C.titre), description: tr(C.desc || C.blocs[0][1][0]), chemin, base, corps, compte, maj });
}

// Teufy en chiffres (un seul bloc) + modèle économique : données fournies par la direction (config.json → site.entreprise).
function chiffresTeufy({ tr, T, nb }) {
  const E = T.entreprise || {};
  const l = [[String(nb), tr("soirées à venir sur la Côte d'Azur et le Var")], [`${T.nbPartenaires}+`, tr("partenaires : clubs, bars, organisateurs, artistes")],
    [E.telechargements, tr(E.telechargements_legende || '')], [E.chiffre_affaires, tr(E.chiffre_affaires_legende || '')]].filter((x) => x[0]);
  return `<ul class="chiffres chiffres-teufy">${l.map(([v, x], i) => `<li style="--i:${i}"><strong>${esc(v)}</strong><span>${esc(x)}</span></li>`).join('')}</ul>`;
}
function blocModele({ tr, T }) {
  const m = (T.entreprise?.modele || []).filter((x) => x?.[0]);
  if (!m.length) return '';
  return `<section class="qui entreprise reveal">
  <p class="etiquette">${esc(tr('Le modèle'))}</p>
  <h2>${tr('Comment Teufy <em>se finance</em>')}</h2>
  <p>${esc(tr('Teufy vit de trois activités :'))}</p>
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
${blocModele({ tr, T })}
${blocPros(ctx)}`;
  return gabarit({ lang, t, titre: t.apTitre, description: t.apDesc(T.directeur, T.nbPartenaires), chemin, base, corps, compte, maj, ld: [...ldOrganisation(T, compte, t, lang), fil(lang, [['Teufy', ''], [t.qui, chemin]])], image: 'site/img/logo.png' });
}

// Page 404 (GitHub Pages la sert pour toute adresse inconnue : chemins absolus).
function page404(t) {
  const B = new URL(URL_SITE).pathname; // « / » sur le domaine propre, « /teufy-instagram/ » sur GitHub Pages
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(t.e404)} · Teufy</title><meta name="robots" content="noindex"><link rel="icon" href="${B}site/img/favicon-64.png"><link rel="stylesheet" href="${B}site/style.min.css"></head>
<body><main class="page-404"><a href="${B}"><img src="${B}site/img/logo-200.webp" alt="Teufy" width="96" height="79"></a><h1>4<em>0</em>4</h1><p>${esc(t.e404p)}</p><p><a class="bouton" href="${B}#agenda">${esc(t.e404b)}</a></p>
<p class="langues-pied">${LANGUES.map((l) => `<a href="${B}${pre(l)}" hreflang="${l}" lang="${l}">${esc(TXT[l].nom)}</a>`).join(' · ')}</p></main></body></html>
`;
}
