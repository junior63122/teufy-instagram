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
import { STYLES as STYLES_MUSIQUE, PAGES_STYLES, FESTIVALS, RENDEZ_VOUS, PARTENAIRE, AMBASSADEUR, BDE, LEGAL, RE_ETUDIANT, RE_FESTIVAL } from './site-contenus.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const VERIF = path.join(ROOT, 'contenus', 'affiches-verifiees.json');
const GEO = path.join(ROOT, 'contenus', 'lieux-geo.json');
const TRAD = path.join(ROOT, 'contenus', 'traductions.json');
const URL_SITE = 'https://junior63122.github.io/teufy-instagram/';
const h = (s) => createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lire = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
const paris = (d, o, locale = 'fr-FR') => new Intl.DateTimeFormat(locale, { timeZone: 'Europe/Paris', ...o }).format(new Date(d));
const nuit = (d) => new Date(Date.parse(d) - 6 * 3600e3); // une soirée qui commence à 1h appartient à la veille
const cle = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(nuit(d)); // AAAA-MM-JJ
const pre = (l) => (l === 'fr' ? '' : `${l}/`);
const dort = (ms) => new Promise((r) => setTimeout(r, ms));

const VILLES = ['Nice', 'Cannes', 'Monaco', 'Antibes'];
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
  // 800 px de large max, JPEG léger : le site reste rapide sur mobile.
  const c = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-vf', "scale='min(800,iw)':-2", '-q:v', '4', f]);
  spawnSync('rm', ['-f', tmp]);
  return c.status === 0 && existsSync(f);
}

// Appel Gemini (modèle flash le plus récent disponible), réponse JSON. null si pas de clé ou échec.
let MODELES = null;
async function gemini(parts) {
  const CLE = (process.env.GEMINI_API_KEY || '').trim();
  if (!CLE) return null;
  const API = 'https://generativelanguage.googleapis.com/v1beta/models';
  try {
    if (!MODELES) {
      const liste = await (await fetch(`${API}?pageSize=200&key=${CLE}`)).json();
      MODELES = (liste.models || []).map((m) => m.name.replace('models/', '')).filter((n) => /^gemini-[\d.]+-flash/.test(n) && !/image|tts|audio|live|lite/.test(n))
        .sort((a, b) => parseFloat(b.slice(7)) - parseFloat(a.slice(7)));
    }
    for (const m of MODELES.slice(0, 3)) {
      const r = await fetch(`${API}/${m}:generateContent?key=${CLE}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json' } }) });
      if (r.status === 404) continue;
      const t = ((await r.json()).candidates?.[0]?.content?.parts || []).map((x) => x.text || '').join('');
      return JSON.parse(t || 'null');
    }
  } catch { /* indisponible */ }
  return null;
}

async function verifier(e, fichier, cache) {
  const k = h(`${e.image}|${e.name}`);
  if (cache[k]) return cache[k].ok;
  const consigne = `Affiche censée illustrer la soirée « ${e.name} », le ${paris(e.start, { dateStyle: 'full' })}, ${e.venue || ''} ${e.city || ''}. Réponds en JSON {"correspond": true|false} : false seulement si l'affiche annonce clairement une AUTRE soirée (autre nom, autre artiste principal, autre lieu ou autre date).`;
  const r = await gemini([{ inline_data: { mime_type: 'image/jpeg', data: readFileSync(fichier).toString('base64') } }, { text: consigne }]);
  if (!r) return true; // vérification impossible : on montre l'affiche
  const ok = r.correspond !== false;
  cache[k] = { ok, le: new Date().toISOString(), nom: e.name };
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
    if (s.lieu && (!c || aRetenter) && requetes < 60 && !coupe) {
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
  if (!(process.env.GEMINI_API_KEY || '').trim()) { TR.manque = {}; return 0; }
  for (const [l, set] of Object.entries(TR.manque)) {
    const liste = [...set];
    for (let i = 0; i < liste.length;) {
      const lot = []; let taille = 0;
      while (i < liste.length && lot.length < 40 && taille < 7000) { lot.push(liste[i]); taille += liste[i].length; i++; }
      const r = await gemini([{ text: `Translate these French texts from a nightlife guide website (French Riviera) into ${NOMS_LANGUE[l]}. Keep every HTML tag exactly as it is (<em>, <strong>, <a …>). Keep names of parties, artists, venues, brands and festivals unchanged (Teufy, Shotgun, DICE, Nice Jazz Festival…). Natural, casual tone for 17-30 year olds. Answer with a JSON array of ${lot.length} strings, same order.\n${JSON.stringify(lot)}` }]);
      if (!Array.isArray(r) || r.length !== lot.length) { log(`Site : traduction ${l} interrompue (réponse invalide)`); break; }
      lot.forEach((x, j) => { if (typeof r[j] === 'string' && r[j].trim()) { TR.cache[`${l}|${h(x)}`] = r[j].trim(); n++; } });
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

const PLATEFORMES = { 'shotgun.live': 'Shotgun', 'dice.fm': 'DICE', 'link.dice.fm': 'DICE', 'ra.co': 'Resident Advisor', 'residentadvisor.net': 'Resident Advisor', 'weezevent.com': 'Weezevent', 'billetweb.fr': 'Billetweb', 'eventbrite.fr': 'Eventbrite', 'eventbrite.com': 'Eventbrite', 'helloasso.com': 'HelloAsso', 'feverup.com': 'Fever', 'fnacspectacles.com': 'Fnac Spectacles', 'ticketmaster.fr': 'Ticketmaster', 'seetickets.com': 'See Tickets', 'yurplan.com': 'Yurplan', 'xceed.me': 'Xceed' };
const nomPlateforme = (u) => { try { const d = new URL(u).hostname.replace(/^www\./, ''); return PLATEFORMES[d] || Object.entries(PLATEFORMES).find(([k]) => d.endsWith(k))?.[1] || d; } catch { return ''; } };

export async function construireSite({ events, hist = [], config = {}, now = new Date(), log = console.log }) {
  await mkdir(path.join(SITE, 'affiches'), { recursive: true });
  const cache = lire(VERIF, {});
  const fin = now.getTime() + 45 * 864e5;
  const debut = now.getTime() - 4 * 3600e3;
  // Mêmes règles de fiabilité que les posts : pas de soirée douteuse, web vérifié ou très fiable.
  const fiables = events
    .filter((e) => e.source !== 'web' || (!e.douteux && (e.verifie || (e.confiance ?? 0) >= 0.85)))
    .filter((e) => { const t = Date.parse(e.start); return t >= debut && t <= fin; })
    .sort((a, b) => a.start.localeCompare(b.start));

  const soirees = [];
  const pris = new Set();
  for (const e of fiables) {
    let affiche = '', dims = null;
    if (e.image) {
      const f = path.join(SITE, 'affiches', `${h(e.image)}.jpg`);
      if (existsSync(f) || await telecharger(e.image, f)) {
        if (await verifier(e, f, cache)) { affiche = `site/affiches/${path.basename(f)}`; dims = tailleJpeg(f); webp(f, 480); webp(f, 800); }
        else log(`Site : affiche écartée (ne correspond pas) pour « ${e.name} »`);
      }
    }
    const ville = VILLES.find((v) => new RegExp(v, 'i').test(`${e.city} ${e.venue}`)) || 'autres';
    let id = `${slug(e.name) || 'soiree'}-${cle(e.start)}`;
    for (let k = 2; pris.has(id); k++) id = `${slug(e.name)}-${cle(e.start)}-${k}`;
    pris.add(id);
    const url = /^https?:\/\//.test(e.url || '') && !/^https?:\/\/[^/]+\/?$/.test(e.url) ? e.url : '';
    const offres = (e.offres || []).filter((o) => o.url).sort((a, b) => (a.prix ?? 1e9) - (b.prix ?? 1e9));
    soirees.push({
      id, nom: e.name, debut: e.start, jour: cle(e.start), lieu: e.venue || '', ville: e.city || '', adresse: e.address || '', filtreVille: ville.toLowerCase(),
      prix: e.price == null ? null : e.price, styles: styleDe(e), genres: genresList(e, 3).join(' · '), techno: isTechno(e), tags: e.tags || [],
      url, affiche, dims, accroche: e.accroche || '', description: e.description || '',
      instagram: (e.instagram || [])[0] || '', buzz: e.buzz ?? null, offres: offres.length >= 2 ? offres : [],
      festival: RE_FESTIVAL.test(`${e.name} ${(e.tags || []).join(' ')}`), etudiant: RE_ETUDIANT.test(`${e.name} ${(e.tags || []).join(' ')} ${e.public_cible || ''}`),
    });
  }
  await writeFile(VERIF, JSON.stringify(cache, null, 1) + '\n');
  await geocoder(soirees, log);
  TR.cache = lire(TRAD, {});

  // Derniers posts Instagram du compte (couverture gardée dans media/).
  const posts = hist.filter((x) => x.lien).slice(-9).reverse().map((x) => {
    const id = x.id; const p = lire(path.join(ROOT, 'media', id, 'publication.json'), null);
    const img = p ? (p.couverture || p.images?.[0]) : null;
    return { lien: x.lien, titre: (x.titre || x.publication?.titre || '').replace(/[[\]]/g, ''), image: img ? `media/${id}/${img}` : '' };
  }).filter((x) => x.image && existsSync(path.join(ROOT, x.image)));

  // Actus (rubrique alimentée par la veille, src/veille.mjs).
  const actus = lire(path.join(ROOT, 'contenus', 'actus.json'), [])
    .filter((a) => a.titre && a.paragraphes?.length).sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((a) => ({ ...a, id: `${slug(a.titre)}-${String(a.date).slice(0, 10)}` }));

  await assets(soirees);
  const compte = config.compte || '@teufy_official';
  const T = { ...TEUFY, ...(config.site || {}) };
  T.nbPartenaires = (String(T.partenaires).match(/\d+/) || ['200'])[0];
  GOOGLE = (config.site?.google_verification || '').trim();
  const majTexte = (t) => t.majLe.replace('{d}', paris(now, { day: 'numeric', month: 'long' }, t.locale));

  const rendre = () => {
    const pages = [];
    for (const lang of LANGUES) {
      const t = TXT[lang];
      const P = pre(lang);
      const tr = (x) => trad(lang, x);
      const sl = soirees.map((s) => ({ ...s, accroche: tr(s.accroche), description: tr(s.description) }));
      const ctx = (chemin) => ({ lang, t, tr, chemin, base: '../'.repeat((lang === 'fr' ? 0 : 1) + chemin.split('/').filter(Boolean).length), compte, T, maj: majTexte(t), actus });
      const ajoute = (chemin, f) => pages.push([`${P}${chemin}`, f(ctx(chemin))]);
      ajoute('', (c) => page({ ...c, soirees: sl, posts, now }));
      ajoute('a-propos/', (c) => aPropos({ ...c, nb: sl.length }));
      for (const v of VILLES_SEO) ajoute(`${v.slug}/`, (c) => pageVille({ ...c, v, soirees: sl.filter((x) => v.re.test(`${x.ville} ${x.lieu}`)), now }));
      for (const k of PAGES_STYLES) ajoute(`soirees-${k}/`, (c) => pageStyle({ ...c, cleStyle: k, soirees: sl.filter((x) => x.styles.includes(k)) }));
      ajoute('festivals/', (c) => pageFestivals({ ...c, soirees: sl.filter((x) => x.festival) }));
      ajoute('actus/', (c) => pageActus(c));
      for (const a of actus) ajoute(`actus/${a.id}/`, (c) => pageActu({ ...c, a }));
      ajoute('partenaires/', (c) => pagePartenaire(c));
      ajoute('ambassadeurs/', (c) => pageAmbassadeur(c));
      ajoute('bde/', (c) => pageBde({ ...c, soirees: sl.filter((x) => x.etudiant) }));
      ajoute('mentions-legales/', (c) => pageLegal(c));
      for (const s of sl) ajoute(`soiree/${s.id}/`, (c) => pageSoiree({ ...c, s, soirees: sl }));
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
    const da = path.join(ROOT, pre(l), 'actus');
    if (existsSync(da)) for (const x of readdirSync(da, { withFileTypes: true })) if (x.isDirectory() && !actus.some((a) => a.id === x.name)) rmSync(path.join(da, x.name), { recursive: true, force: true });
  }
  for (const [dossier, html] of pages) {
    await mkdir(path.join(ROOT, dossier), { recursive: true });
    await writeFile(path.join(ROOT, dossier, 'index.html'), html);
  }
  await writeFile(path.join(ROOT, '404.html'), page404(TXT.fr));
  await ics(soirees, compte);

  const jourIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now);
  const chemins = [...new Set(pages.map(([d]) => d.replace(/^(en|it|es|zh|ar)\//, '')))];
  const prio = (c) => (!c ? '1.0' : /^soiree\//.test(c) ? '0.6' : /^(actus\/.|mentions)/.test(c) ? '0.5' : '0.8');
  const urls = LANGUES.flatMap((l) => chemins.map((c) => `  <url><loc>${URL_SITE}${pre(l)}${c}</loc><lastmod>${jourIso}</lastmod><changefreq>daily</changefreq><priority>${prio(c)}</priority>${LANGUES.map((x) => `<xhtml:link rel="alternate" hreflang="${x}" href="${URL_SITE}${pre(x)}${c}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${URL_SITE}${c}"/></url>`));
  await writeFile(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);
  await writeFile(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /out/\nDisallow: /apercus/\nDisallow: /livrables/\nSitemap: ${URL_SITE}sitemap.xml\n`);
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
  for (const f of PHOTOS) {
    const out = path.join(SITE, 'img', `${f}.jpg`);
    if (!existsSync(out)) spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(S, 'decors', 'da', `${f}.jpg`), '-vf', "scale='min(1200,iw)':-2", '-q:v', '5', out]);
  }
  // CSS minifiée (sans commentaires ni espaces inutiles) + version pour le cache.
  const css = readFileSync(path.join(SITE, 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim();
  await writeFile(path.join(SITE, 'style.min.css'), css);
  const js = readFileSync(path.join(SITE, 'app.js'), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).map((l) => l.trim()).filter(Boolean).join('\n');
  await writeFile(path.join(SITE, 'app.min.js'), js);
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
function image(base, rel, { alt = '', sizes = '100vw', attrs = '' } = {}) {
  const largeurs = /affiches/.test(rel) ? [480, 800] : [400, 600, 800, 1200];
  const dispo = largeurs.map((l) => [l, rel.replace(/\.jpg$/, `-${l}.webp`)]).filter(([, f]) => existsSync(path.join(ROOT, f)));
  if (!dispo.length) return `<img src="${base}${rel}" alt="${esc(alt)}" ${attrs}>`;
  return `<img src="${base}${dispo.at(-1)[1]}" srcset="${dispo.map(([l, f]) => `${base}${f} ${l}w`).join(', ')}" sizes="${sizes}" alt="${esc(alt)}" ${attrs}>`;
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

const PHOTOS = ['danse', 'foule', 'selfie', 'rire', 'dj', 'lasers', 'rooftop', 'terrasse'];
// Photos de Junior et de l'équipe en soirée (site/img/equipe/).
const GALERIE = ['fourrure', 'scene-dj', 'bal-des-fous', 'cowboys', 'bresil', 'club', 'aperol'];
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
  const img = s.affiche
    ? image(base, s.affiche, { alt: t.affiche + s.nom, sizes: TAILLES.carte, attrs: `loading="lazy" decoding="async"${s.dims ? ` width="${s.dims[0]}" height="${s.dims[1]}"` : ''}` })
    : `<img src="${base}site/img/${PHOTOS[parseInt(h(s.nom), 16) % PHOTOS.length]}-169.webp" alt="" loading="lazy" decoding="async" width="640" height="360">`;
  return `<article class="carte${vedette ? ' vedette' : ''}" data-id="${s.id}" data-jour="${s.jour}" data-debut="${esc(s.debut)}" data-heure="${esc(heure(s.debut, t))}" data-ville="${s.filtreVille}" data-styles="${s.styles.join(' ')}" data-prix="${s.prix ?? ''}" data-lat="${s.lat ?? ''}" data-lng="${s.lng ?? ''}"${s.approx ? ' data-approx="1"' : ''} data-q="${esc(q)}">
  <a class="affiche${s.affiche ? '' : ' sans'}" href="${lien}" tabindex="-1" aria-hidden="true">${img}<span class="date">${esc(dateCourte(s.debut, t))}</span></a>
  <button type="button" class="coeur" aria-label="${esc(t.ajouterFav)}" aria-pressed="false"></button>
  <div class="infos">
    ${s.genres ? `<p class="genre">${esc(s.genres)}</p>` : ''}
    <h3><a href="${lien}">${esc(s.nom)}</a></h3>
    ${s.accroche ? `<p class="accroche">${esc(s.accroche)}</p>` : ''}
    <p class="meta"><span>${esc(heure(s.debut, t))}</span><span>${esc(prix || t.prixBillet)}</span>${s.offres.length ? `<span class="comparer">${esc(t.comparer)} · ${s.offres.length}</span>` : ''}<span class="ou">${esc([s.lieu, s.ville].filter(Boolean).join(', '))}</span></p>
    <p class="actions">${boutonBillets(s, t)}<a class="lien" href="${lien}">${esc(t.voir)}</a></p>
  </div>
</article>`;
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
    location: { '@type': 'Place', name: s.lieu || s.ville, address: { '@type': 'PostalAddress', ...(s.adresse ? { streetAddress: s.adresse } : {}), addressLocality: s.ville, addressRegion: "Provence-Alpes-Côte d'Azur", addressCountry: /monaco|monte/i.test(s.ville) ? 'MC' : 'FR' }, ...(s.approx === false ? { geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng } } : {}) },
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
  { slug: 'soirees-nice', cle: 'nice', re: /nice|saint-laurent|cagnes|villefranche/i, photo: 'club' },
  { slug: 'soirees-cannes', cle: 'cannes', re: /cannes|mandelieu|le cannet/i, photo: 'bal-des-fous' },
  { slug: 'soirees-monaco', cle: 'monaco', re: /monaco|monte.?carlo|beausoleil/i, photo: 'monaco', video: true },
  { slug: 'soirees-antibes', cle: 'antibes', re: /antibes|juan|biot|vallauris|golfe/i, photo: 'bresil' },
];
const PHOTO_STYLE = { techno: 'lasers', house: 'rooftop', afro: 'danse', shatta: 'foule', latino: 'rire', rap: 'dj' };

let CSS_EN_LIGNE = ''; // CSS écrite dans chaque page : affichage plus rapide (une requête de moins)
let VERSION = '1'; // change quand le CSS ou le JS change (le navigateur recharge la bonne version)
let GOOGLE = ''; // code de vérification Google Search Console (config.site.google_verification)
function gabarit({ lang, t, titre, description, chemin, base, corps, ld = [], image = 'site/img/equipe/monaco.jpg', compte, maj = '', agendaIci = false }) {
  const handle = compte.replace(/^@/, '');
  const P = pre(lang);
  const accueil = `${base}${P}`;
  const nav = [['', t.agenda], ...VILLES_SEO.map((v) => [`${v.slug}/`, t.villes[v.cle === 'antibes' ? 'antibesCourt' : v.cle]]), ['#carte', t.carte], ['festivals/', t.festivals], ['actus/', t.actus], ['partenaires/', t.partenaires], ['a-propos/', t.qui]];
  const jsT = { ...t.js, base, langue: lang, locale: t.locale, resultats: t.resultats, aucunRes: t.aucunRes, lienCopie: t.lienCopie, ajouterFav: t.ajouterFav };
  return `<!doctype html>
<html lang="${lang}" dir="${t.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${URL_SITE}${P}${chemin}">
${LANGUES.map((l) => `<link rel="alternate" hreflang="${l}" href="${URL_SITE}${pre(l)}${chemin}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${URL_SITE}${chemin}">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${/^https?:/.test(image) ? image : URL_SITE + image}">
<meta property="og:url" content="${URL_SITE}${P}${chemin}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Teufy">
<meta property="og:locale" content="${t.og}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0B0B0F">
${GOOGLE ? `<meta name="google-site-verification" content="${esc(GOOGLE)}">` : ''}
<link rel="icon" href="${base}site/img/logo.png">
<link rel="apple-touch-icon" href="${base}site/img/icone-192.png">
<link rel="manifest" href="${base}site/manifest.webmanifest">
<link rel="preload" href="${base}site/fonts/bricolage-titre.woff2" as="font" type="font/woff2" crossorigin>
<style>${CSS_EN_LIGNE.replace(/__BASE__/g, base)}</style>
<script>document.documentElement.classList.add('js')</script>
${ld.length ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<a class="saut" href="#contenu">${esc(t.contenu)}</a>
<header class="barre">
  <a class="marque" href="${accueil || './'}" aria-label="Teufy"><img src="${base}site/img/logo.png" alt="Teufy" width="39" height="32"></a>
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
    <div><p class="pied-titre">${esc(t.villesL)}</p>${VILLES_SEO.map((v) => `<a href="${accueil}${v.slug}/">${esc(t.villes[v.cle])}</a>`).join('')}<a href="${accueil}festivals/">${esc(t.festivals)}</a></div>
    <div><p class="pied-titre">${esc(t.stylesL)}</p>${PAGES_STYLES.map((k) => `<a href="${accueil}soirees-${k}/">${esc(nomStyle(k, t, lang))}</a>`).join('')}</div>
    <div><p class="pied-titre">${esc(t.teufyL)}</p><a href="${accueil}a-propos/">${esc(t.qui)}</a><a href="${accueil}actus/">${esc(t.actus)}</a><a href="${accueil}partenaires/">${esc(t.partenaires)}</a><a href="${accueil}ambassadeurs/">${esc(t.ambassadeurs)}</a><a href="${accueil}bde/">${esc(t.bde)}</a><a href="https://www.instagram.com/${esc(handle)}/" target="_blank" rel="noopener">${esc(compte)}</a></div>
    <div><p class="pied-titre">${esc(t.langue)}</p>${LANGUES.map((l) => `<a href="${base}${pre(l)}${chemin}" hreflang="${l}" lang="${l}">${esc(TXT[l].nom)}</a>`).join('')}</div>
  </div>
  <p><strong>Teufy</strong> · ${esc(t.pied1)}${maj ? ` · ${esc(maj)}` : ''}</p>
  <p>${esc(t.pied3)} · <a href="${accueil}mentions-legales/">${esc(t.legal)}</a></p>
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
  const groupe = (f, valeurs, libelles) => `<div class="groupe" data-filtre="${f}">${valeurs.map((v, i) => `<button type="button"${i ? '' : ' class="actif"'} data-v="${v}">${esc(libelles[i])}</button>`).join('')}</div>`;
  const styles = STYLES_MUSIQUE.map((x) => x.cle).filter((k) => soirees.some((s) => s.styles.includes(k)));
  return `<section id="agenda" class="agenda">
  <div class="filtres-place"><div class="filtres" role="toolbar" aria-label="${esc(t.js.filtres)}">
    <div class="vues"><button type="button" class="actif" data-vue="liste">${esc(t.agenda)}</button><button type="button" data-vue="carte">${esc(t.carte)}</button><button type="button" class="fermer-filtres">${esc(t.js.fermer)}</button></div>
    ${champRecherche(t)}
    ${groupe('quand', ['tout', 'soir', 'weekend', 'semaine', 'favoris'], [...t.quand, t.favoris])}
    ${filtresVille ? groupe('ville', ['tout', ...VILLES.map((v) => v.toLowerCase()), 'autres'], [t.partout, t.villes.nice, t.villes.cannes, t.villes.monaco, t.villes.antibesCourt, t.ailleurs]) : ''}
    ${filtreStyle && styles.length > 1 ? groupe('style', ['tout', ...styles], [t.sons[0], ...styles.map((k) => nomStyle(k, t, lang))]) : ''}
    ${groupe('prix', ['tout', 'gratuit', '10'], t.prix)}
    <p class="nb-res" aria-live="polite"></p>
  </div></div>
  <div id="carte" class="carte-soirees" hidden><div class="leaflet-zone"></div><p class="carte-vide" hidden>${esc(t.js.carteVide)}</p></div>
  <div class="liste">
  ${jours || `<p class="vide">${esc(t.vide)}</p>`}
  <p class="vide" id="aucune" hidden>${esc(t.aucune)}</p>
  </div>
</section>`;
}

function blocPartenaires({ t, T, base }) {
  const P = lire(path.join(ROOT, 'contenus', 'partenaires.json'), { liste: [] }).liste || [];
  if (!P.length) return '';
  return `<section class="qui partenaires reveal">
  <p class="etiquette">${esc(t.partEtiquette)}</p>
  <h2>${t.partH2(esc(T.nbPartenaires))}</h2>
  <p>${esc(t.partP)}</p>
  <div class="logos">${P.map((x, i) => { const img = `<img src="${base}${esc(x.fichier)}" alt="${esc(x.nom || 'Partenaire Teufy')}" loading="lazy" width="80" height="80">`; return x.instagram ? `<a href="https://www.instagram.com/${esc(x.instagram)}/" target="_blank" rel="noopener" title="${esc(x.nom || x.instagram)}" style="--i:${i % 12}">${img}</a>` : `<span style="--i:${i % 12}">${img}</span>`; }).join('')}</div>
  <p class="et-plus">${esc(t.etPlus)}</p>
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

function galerie({ t, base }) {
  return `<section class="galerie reveal">
  <div class="tete"><p class="etiquette">${esc(t.galEtiquette)}</p><h2>${t.galH2}</h2><p>${esc(t.galP)}</p></div>
  <div class="photos">${GALERIE.map((f, i) => `<figure style="--i:${i}">${image(base, `site/img/equipe/${f}.jpg`, { alt: t.galAlt, sizes: '(max-width:430px) 70vw, (min-width:900px) 280px, 300px', attrs: 'loading="lazy" decoding="async"' })}</figure>`).join('')}</div>
</section>`;
}

// Bloc « Tu fais vivre la nuit ? » : partenaires, ambassadeurs, BDE.
const blocPros = ({ t, base, lang }) => `<section class="pros reveal">
  <h2>${t.prosH2}</h2>
  <div class="pros-cartes">${[['partenaires/', 'scene-dj'], ['ambassadeurs/', 'fourrure'], ['bde/', 'aperol']].map(([c, img], i) => `<a class="pro" href="${base}${pre(lang)}${c}" style="--i:${i}">${image(base, `site/img/equipe/${img}.jpg`, { sizes: '(min-width:760px) 380px, 92vw', attrs: 'loading="lazy"' })}<span><strong>${esc(t.pros[i][0])}</strong>${esc(t.pros[i][1])}<b>${esc(t.decouvrir)} →</b></span></a>`).join('')}</div>
</section>`;

const blocFaq = (titre, faq) => `<section class="qui faq reveal"><h2>${titre}</h2>${faq.map(([q, r]) => `<details><summary>${esc(q)}</summary><p>${esc(r)}</p></details>`).join('')}</section>`;
const ldFaq = (faq) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, r]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: r } })) });

// Fond du hero : la vidéo du port de Monaco (muette, en boucle) ou une photo.
const fond = (base, photo, video, alt) => (video
  ? `<video class="hero-photo" autoplay muted loop playsinline preload="none" poster="${base}site/img/equipe/${photo}-600.webp" aria-label="${esc(alt)}"><source src="${base}site/img/equipe/${photo}.mp4" type="video/mp4"></video>`
  : image(base, `site/img/${PHOTOS.includes(photo) ? '' : 'equipe/'}${photo}.jpg`, { alt, attrs: 'class="hero-photo" fetchpriority="high"' }));

const heroCourt = ({ base, photo, video, alt, etiquette, h1, p, live = false }) => `<section class="hero court">
  ${fond(base, photo, video, alt)}
  <div class="hero-texte">
    <p class="etiquette">${esc(etiquette)}</p>
    <h1>${h1}</h1>
    ${p ? `<p>${p}</p>` : ''}
    ${live ? '<div class="hero-actions"><a class="pastille-live" href="#ce-soir" hidden><i class="point"></i><span></span></a></div>' : ''}
  </div>
</section>`;

function page({ lang, t, base, compte, T, soirees, posts, now, maj }) {
  const handle = compte.replace(/^@/, '');
  const semaine = soirees.filter((s) => Date.parse(s.debut) < now.getTime() + 8 * 864e5);
  const vedette = [...semaine].filter((s) => s.affiche && (s.buzz ?? 0) >= 0.7).sort((a, b) => b.buzz - a.buzz)[0];
  const ctx = { lang, t, base, T };
  const populaires = PAGES_STYLES.filter((k) => soirees.some((s) => s.styles.includes(k)));
  const faq = t.faqHome;
  const corps = `<section class="hero">
  ${fond(base, 'monaco', true, t.heroAlt)}
  <div class="hero-texte">
    <p class="etiquette">${esc(t.heroEtiquette)}</p>
    <h1>${t.heroH1}</h1>
    <p>${esc(t.heroP(soirees.length))}</p>
    <form class="hero-recherche" action="" method="get" role="search">${champRecherche(t, 'recherche-hero').replace('<div class="recherche" role="search">', '<div class="recherche">')}<button class="bouton" type="submit">${esc(t.rechercher)}</button></form>
    <p class="populaires">${esc(t.populaires)} ${populaires.map((k) => `<a href="${base}${pre(lang)}soirees-${k}/">${esc(nomStyle(k, t, lang))}</a>`).join('')}</p>
    <div class="hero-actions"><a class="bouton contour" href="#carte">${esc(t.heroCarte)}</a><a class="pastille-live" href="#ce-soir" hidden><i class="point"></i><span></span></a></div>
  </div>
</section>
${defile(t)}
${ceSoir(t)}
${vedette ? `<section class="la-plus reveal"><h2 class="etiquette">${esc(t.laPlus)}</h2>${carte(vedette, { t, base, lang, vedette: true })}</section>` : ''}
${agenda(soirees, { t, base, lang })}
${blocPros(ctx)}
${blocTeufy(ctx, soirees.length)}
${galerie(ctx)}
${blocPartenaires(ctx)}
${blocFaq(t.faqH, faq)}
${posts.length ? `<section class="insta reveal"><h2>${esc(t.insta)}</h2><div class="posts">${posts.map((p) => `<a href="${esc(p.lien)}" target="_blank" rel="noopener"><img src="${base}${esc(p.image)}" alt="${esc(p.titre)}" loading="lazy"></a>`).join('')}</div><a class="bouton" href="https://www.instagram.com/${esc(handle)}/" target="_blank" rel="noopener">${esc(compte)}</a></section>` : ''}
${blocOrga({ t, base, handle, lang })}`;
  return gabarit({ lang, t, titre: t.homeTitre, description: t.homeDesc(soirees.length), chemin: '', base, corps, ld: [...ldOrganisation(T, compte, t, lang), ldFaq(faq), ...jsonld(soirees, lang)], compte, maj, agendaIci: true });
}

function blocOrga({ t, base, handle, lang }) {
  return `<section class="orga reveal">
  ${image(base, 'site/img/equipe/scene-dj.jpg', { attrs: 'class="hero-photo" loading="lazy"' })}
  <div class="hero-texte">
    <p class="etiquette">${esc(t.orgaEtiquette)}</p>
    <h2>${t.orgaH2}</h2>
    <p>${esc(t.orgaP)}</p>
    <div class="hero-actions"><a class="bouton" href="https://ig.me/m/${esc(handle)}" target="_blank" rel="noopener">${esc(t.orgaBouton)}</a><a class="bouton contour" href="${base}${pre(lang)}partenaires/">${esc(t.partenaires)}</a></div>
  </div>
</section>`;
}

function pageVille({ lang, t, base, compte, T, chemin, v, soirees, now, maj }) {
  const ville = t.villes[v.cle];
  const n = soirees.filter((s) => s.jour === cle(now.toISOString())).length;
  const faq = t.faq(ville, n);
  const corps = `${heroCourt({ base, photo: v.photo, video: v.video, alt: ville, etiquette: t.villeEtiquette(ville), h1: t.villeH1(esc(ville)), p: `${esc(t.intro[v.cle])} ${esc(t.villeN(soirees.length))}`, live: true })}
${ceSoir(t)}
${agenda(soirees, { t, base, lang, filtresVille: false })}
${blocFaq(esc(t.faqH2(ville)), faq)}
${blocOrga({ t, base, handle: compte.replace(/^@/, ''), lang })}`;
  return gabarit({ lang, t, titre: t.villeTitre(ville), description: t.villeDesc(ville, soirees.length), chemin, base, corps, compte, maj, agendaIci: true,
    ld: [...ldOrganisation(T, compte, t, lang), ...jsonld(soirees, lang), ldFaq(faq), fil(lang, [['Teufy', ''], [ville, chemin]])] });
}

function pageStyle({ lang, t, tr, base, compte, T, chemin, cleStyle, soirees, maj }) {
  const st = STYLES_MUSIQUE.find((x) => x.cle === cleStyle);
  const nom = nomStyle(cleStyle, t, lang);
  const corps = `${heroCourt({ base, photo: PHOTO_STYLE[cleStyle] || 'danse', alt: nom, etiquette: `${t.styleEtiquette} · ${nom}`, h1: t.styleH1(esc(nom)), p: `${esc(tr(st.intro))} ${esc(t.villeN(soirees.length))}`, live: true })}
${ceSoir(t)}
${agenda(soirees, { t, base, lang, filtreStyle: false })}
<section class="qui reveal"><p class="liens-styles">${PAGES_STYLES.filter((k) => k !== cleStyle).map((k) => `<a class="puce" href="${base}${pre(lang)}soirees-${k}/">${esc(nomStyle(k, t, lang))}</a>`).join('')}</p></section>
${blocOrga({ t, base, handle: compte.replace(/^@/, ''), lang })}`;
  return gabarit({ lang, t, titre: t.styleTitre(nom), description: t.styleDesc(nom, soirees.length), chemin, base, corps, compte, maj, agendaIci: true,
    ld: [...ldOrganisation(T, compte, t, lang), ...jsonld(soirees, lang), fil(lang, [['Teufy', ''], [nom, chemin]])] });
}

function pageSoiree({ lang, t, base, compte, T, chemin, s, soirees, maj }) {
  const P = pre(lang);
  const lieu = [s.lieu, s.adresse && s.adresse !== s.lieu ? s.adresse : '', s.ville].filter(Boolean).join(', ');
  const meme = soirees.filter((x) => x.jour === s.jour && x.id !== s.id).slice(0, 6);
  const style = soirees.filter((x) => x.id !== s.id && x.jour !== s.jour && x.styles.some((k) => s.styles.includes(k))).slice(0, 6);
  const mini = (l, titre) => (l.length ? `<section class="similaires reveal"><h2>${titre}</h2><div class="grille">${l.map((x) => carte(x, { t, base, lang })).join('')}</div></section>` : '');
  const offres = s.offres.length ? `<div class="offres"><p class="pied-titre">${esc(t.comparer)}</p>${s.offres.map((o, i) => `<a href="${esc(o.url)}" target="_blank" rel="noopener"><span>${esc(nomPlateforme(o.url))}</span><b>${esc(o.prix == null ? t.prixBillet : prixTexte(o.prix, t))}</b>${i === 0 && o.prix != null ? `<i>${esc(t.meilleurPrix)}</i>` : ''}</a>`).join('')}</div>` : '';
  const img = s.affiche ? image(base, s.affiche, { alt: t.affiche + s.nom, sizes: '(min-width:860px) 460px, 92vw', attrs: `fetchpriority="high"${s.dims ? ` width="${s.dims[0]}" height="${s.dims[1]}"` : ''}` }) : image(base, `site/img/${PHOTOS[parseInt(h(s.nom), 16) % PHOTOS.length]}.jpg`, { sizes: '(min-width:860px) 460px, 92vw', attrs: 'width="928" height="1152" fetchpriority="high"' });
  const corps = `<article class="fiche carte-donnees" data-id="${s.id}" data-debut="${esc(s.debut)}">
  <nav class="ariane"><a href="${base}${P}">Teufy</a> › <a href="${base}${P}#agenda">${esc(t.agenda)}</a> › <span>${esc(s.nom)}</span></nav>
  <div class="fiche-grille">
    <div class="fiche-affiche">${img}</div>
    <div class="fiche-infos">
      ${s.genres ? `<p class="genre">${esc(s.genres)}</p>` : ''}
      <h1>${esc(s.nom)}</h1>
      ${s.accroche ? `<p class="fiche-accroche">${esc(s.accroche)}</p>` : ''}
      ${s.description && s.description !== s.accroche ? `<p>${esc(s.description)}</p>` : ''}
      <dl>
        <div><dt>${esc(t.quandL)}</dt><dd>${esc(dateLongue(s.debut, t))} · ${esc(heure(s.debut, t))}</dd></div>
        <div><dt>${esc(t.ou)}</dt><dd>${esc(lieu)}</dd></div>
        <div><dt>${esc(t.prixL)}</dt><dd>${esc(prixTexte(s.prix, t) || t.prixBillet)}</dd></div>
      </dl>
      <p class="fiche-actions">${boutonBillets(s, t)}
        <a class="bouton contour sombre" href="${base}site/ics/${s.id}.ics" download>${esc(t.calendrier)}</a>
        <a class="bouton contour sombre" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(lieu)}" target="_blank" rel="noopener">${esc(t.itineraire)}</a>
        <button type="button" class="bouton contour sombre partager">${esc(t.partager)}</button>
        <button type="button" class="coeur grand" aria-label="${esc(t.ajouterFav)}" aria-pressed="false"></button>
      </p>
      ${offres}
      ${s.instagram ? `<p class="orga-ig"><a class="lien" href="https://www.instagram.com/${esc(s.instagram)}/" target="_blank" rel="noopener">@${esc(s.instagram)}</a></p>` : ''}
    </div>
  </div>
</article>
${mini(meme, esc(t.memeSoir))}
${mini(style, esc(t.memeStyle))}
<p class="retour"><a class="bouton" href="${base}${P}#agenda">${esc(t.toutes)}</a></p>`;
  return gabarit({ lang, t, titre: `${s.nom} · ${dateCourte(s.debut, t)} · ${s.lieu || s.ville} · Teufy`, description: `${s.nom}, ${dateLongue(s.debut, t)} ${heure(s.debut, t)}, ${lieu}. ${s.accroche || ''} ${prixTexte(s.prix, t)}`.trim().slice(0, 300), chemin, base, corps, compte, maj,
    image: s.affiche || 'site/img/equipe/monaco.jpg', ld: [jsonEvent(s, lang), fil(lang, [['Teufy', ''], [t.agenda, ''], [s.nom, chemin]])] });
}

function pageFestivals({ lang, t, tr, base, compte, T, chemin, soirees, maj }) {
  const recherche = (n) => `https://www.google.com/search?q=${encodeURIComponent(`${n} site officiel`)}`;
  const corps = `${heroCourt({ base, photo: 'scene-dj', alt: t.festivals, etiquette: t.festivals, h1: t.festH1, p: esc(t.festP) })}
<section class="bloc-large reveal"><h2>${t.festAgendaH2}</h2>${soirees.length ? `<div class="grille">${soirees.map((s) => carte(s, { t, base, lang })).join('')}</div>` : `<p class="vide">${esc(t.festAgendaVide)}</p>`}</section>
<section class="bloc-large reveal"><h2>${t.festGuideH2}</h2><div class="cartes-texte">${FESTIVALS.map((f, i) => `<article class="carte-texte" style="--i:${i}"><p class="genre">${esc(tr(f.quand))} · ${esc(f.ville === 'Partout' ? tr(f.ville) : f.ville)}</p><h3>${esc(f.nom)}</h3><p class="petit">${esc(tr(f.style))}</p><p>${esc(tr(f.texte))}</p><a class="lien" href="${recherche(f.nom)}" target="_blank" rel="noopener">${esc(t.siteOfficiel)}</a></article>`).join('')}</div></section>
<section class="bloc-large reveal"><h2>${t.festRdvH2}</h2><div class="cartes-texte">${RENDEZ_VOUS.map((f, i) => `<article class="carte-texte" style="--i:${i}"><p class="genre">${esc(tr(f.quand))}${f.ville ? ` · ${esc(f.ville)}` : ''}</p><h3>${esc(f.nom)}</h3><p>${esc(tr(f.texte))}</p></article>`).join('')}</div><p class="avert">${esc(t.festAvert)}</p></section>
${blocOrga({ t, base, handle: compte.replace(/^@/, ''), lang })}`;
  return gabarit({ lang, t, titre: t.festTitre, description: t.festDesc, chemin, base, corps, compte, maj, ld: [...ldOrganisation(T, compte, t, lang), ...jsonld(soirees, lang), fil(lang, [['Teufy', ''], [t.festivals, chemin]])] });
}

const dateActu = (a, t) => { const d = Date.parse(a.date); return isNaN(d) ? '' : paris(d, { day: 'numeric', month: 'long', year: 'numeric' }, t.locale); };
function pageActus({ lang, t, tr, base, compte, T, chemin, actus, maj }) {
  const corps = `${heroCourt({ base, photo: 'foule', alt: t.actus, etiquette: t.actus, h1: t.actusH1, p: esc(t.actusP) })}
<section class="bloc-large reveal">${actus.length ? `<div class="actus">${actus.map((a, i) => `<a class="actu" href="${base}${pre(lang)}actus/${a.id}/" style="--i:${i % 6}"><p class="genre">${esc(dateActu(a, t))}${a.ville ? ` · ${esc(tr(a.ville))}` : ''}</p><h3>${esc(tr(a.titre))}</h3><p>${esc(tr(a.chapo))}</p><b>${esc(t.lire)} →</b></a>`).join('')}</div>` : `<p class="vide">${esc(t.actusVide)}</p>`}</section>`;
  return gabarit({ lang, t, titre: t.actusTitre, description: t.actusDesc, chemin, base, corps, compte, maj, ld: [...ldOrganisation(T, compte, t, lang), fil(lang, [['Teufy', ''], [t.actus, chemin]])] });
}
function pageActu({ lang, t, tr, base, compte, chemin, a, actus, maj }) {
  const autres = actus.filter((x) => x.id !== a.id).slice(0, 3);
  const corps = `<article class="article">
  <nav class="ariane"><a href="${base}${pre(lang)}">Teufy</a> › <a href="${base}${pre(lang)}actus/">${esc(t.actus)}</a></nav>
  <p class="genre">${esc(t.publie.replace('{d}', dateActu(a, t)))}${a.ville ? ` · ${esc(tr(a.ville))}` : ''}</p>
  <h1>${esc(tr(a.titre))}</h1>
  <p class="chapo">${esc(tr(a.chapo))}</p>
  ${a.paragraphes.map((p) => `<p>${esc(tr(p))}</p>`).join('\n  ')}
  <p class="source">${esc(t.source)} : <a href="${esc(a.source)}" target="_blank" rel="noopener nofollow">${esc((() => { try { return new URL(a.source).hostname.replace(/^www\./, ''); } catch { return a.source; } })())}</a></p>
</article>
${autres.length ? `<section class="bloc-large reveal"><h2>${esc(t.autresActus)}</h2><div class="actus">${autres.map((x) => `<a class="actu" href="${base}${pre(lang)}actus/${x.id}/"><p class="genre">${esc(dateActu(x, t))}</p><h3>${esc(tr(x.titre))}</h3><b>${esc(t.lire)} →</b></a>`).join('')}</div></section>` : ''}`;
  return gabarit({ lang, t, titre: `${tr(a.titre)} · Teufy`, description: tr(a.chapo), chemin, base, corps, compte, maj, image: /^https?:/.test(a.image || '') ? a.image : undefined,
    ld: [{ '@context': 'https://schema.org', '@type': 'NewsArticle', headline: tr(a.titre).slice(0, 110), datePublished: a.date, dateModified: a.ajout || a.date, inLanguage: lang, description: tr(a.chapo), isBasedOn: a.source, publisher: { '@type': 'Organization', name: 'Teufy', logo: { '@type': 'ImageObject', url: `${URL_SITE}site/img/logo.png` } }, author: { '@type': 'Organization', name: 'Teufy', url: URL_SITE } }, fil(lang, [['Teufy', ''], [t.actus, 'actus/'], [tr(a.titre), chemin]])] });
}

// Pages « pros » : partenaires, ambassadeurs, BDE (texte français traduit par l'IA).
const cartesTexte = (l, tr) => `<div class="cartes-texte">${l.map(([a, b], i) => `<article class="carte-texte" style="--i:${i}"><h3>${tr(a)}</h3><p>${tr(b)}</p></article>`).join('')}</div>`;
const etapes = (l, tr) => `<ol class="etapes">${l.map(([a, b], i) => `<li style="--i:${i}"><b>${i + 1}</b><div><h3>${tr(a)}</h3><p>${tr(b)}</p></div></li>`).join('')}</ol>`;
const ctaIg = (handle, texte, email) => `<p class="cta"><a class="bouton" href="https://ig.me/m/${esc(handle)}" target="_blank" rel="noopener">${esc(texte)}</a>${email ? `<a class="bouton contour" href="mailto:${esc(email)}">${esc(email)}</a>` : ''}</p>`;

function pagePartenaire({ lang, t, tr, base, compte, T, chemin, maj }) {
  const C = PARTENAIRE, handle = compte.replace(/^@/, '');
  const faq = C.faq.map(([q, r]) => [tr(q), tr(r)]);
  const corps = `${heroCourt({ base, photo: 'scene-dj', alt: t.partenaires, etiquette: tr(C.etiquette), h1: tr(C.h1), p: esc(tr(C.chapo)) })}
<section class="bloc-large reveal">${ctaIg(handle, tr(C.cta), T.email)}<h2>${tr(C.pourquoiH2)}</h2>${cartesTexte(C.pourquoi, tr)}</section>
<section class="bloc-large reveal"><h2>${tr(C.offreH2)}</h2>${cartesTexte(C.offre, tr)}</section>
<section class="bloc-large reveal"><h2>${tr(C.pourQuiH2)}</h2><p class="liens-styles">${C.pourQui.map((x) => `<span class="puce">${esc(tr(x))}</span>`).join('')}</p></section>
<section class="bloc-large reveal"><h2>${tr(C.etapesH2)}</h2>${etapes(C.etapes, tr)}${ctaIg(handle, tr(C.cta), T.email)}</section>
${blocPartenaires({ t, T, base })}
${blocFaq(t.faqH, faq)}`;
  return gabarit({ lang, t, titre: tr(C.titre), description: tr(C.desc), chemin, base, corps, compte, maj, image: 'site/img/equipe/scene-dj.jpg', ld: [...ldOrganisation(T, compte, t, lang), ldFaq(faq), fil(lang, [['Teufy', ''], [t.partenaires, chemin]])] });
}
function pageAmbassadeur({ lang, t, tr, base, compte, T, chemin, maj }) {
  const C = AMBASSADEUR, handle = compte.replace(/^@/, '');
  const corps = `${heroCourt({ base, photo: 'fourrure', alt: t.ambassadeurs, etiquette: tr(C.etiquette), h1: tr(C.h1), p: esc(tr(C.chapo)) })}
<section class="bloc-large reveal"><h2>${tr(C.roleH2)}</h2>${cartesTexte(C.role, tr)}</section>
<section class="bloc-large reveal"><h2>${tr(C.avantagesH2)}</h2>${cartesTexte(C.avantages, tr)}</section>
<section class="bloc-large reveal"><h2>${tr(C.profilH2)}</h2><ul class="coches">${C.profil.map((x) => `<li>${esc(tr(x))}</li>`).join('')}</ul></section>
<section class="bloc-large reveal"><h2>${tr(C.candidatureH2)}</h2><p class="grand-texte">${esc(tr(C.candidature))}</p>${ctaIg(handle, tr(C.cta), T.email)}</section>
${galerie({ t, base })}`;
  return gabarit({ lang, t, titre: tr(C.titre), description: tr(C.desc), chemin, base, corps, compte, maj, image: 'site/img/equipe/fourrure.jpg', ld: [...ldOrganisation(T, compte, t, lang), fil(lang, [['Teufy', ''], [t.ambassadeurs, chemin]])] });
}
function pageBde({ lang, t, tr, base, compte, T, chemin, soirees, maj }) {
  const C = BDE, handle = compte.replace(/^@/, '');
  const corps = `${heroCourt({ base, photo: 'aperol', alt: t.bde, etiquette: tr(C.etiquette), h1: tr(C.h1), p: esc(tr(C.chapo)) })}
<section class="bloc-large reveal"><h2>${tr(C.offreH2)}</h2>${cartesTexte(C.offre, tr)}</section>
<section class="bloc-large reveal"><h2>${tr(C.etapesH2)}</h2>${etapes(C.etapes, tr)}${ctaIg(handle, tr(C.cta), T.email)}</section>
${soirees.length ? `<section class="bloc-large reveal"><h2>${tr(C.soireesH2)}</h2><div class="grille">${soirees.map((s) => carte(s, { t, base, lang })).join('')}</div></section>` : ''}
${blocPartenaires({ t, T, base })}`;
  return gabarit({ lang, t, titre: tr(C.titre), description: tr(C.desc), chemin, base, corps, compte, maj, image: 'site/img/equipe/aperol.jpg', ld: [...ldOrganisation(T, compte, t, lang), ...jsonld(soirees, lang), fil(lang, [['Teufy', ''], [t.bde, chemin]])] });
}
function pageLegal({ lang, t, tr, base, compte, T, chemin, maj }) {
  const C = LEGAL(T, compte);
  const corps = `<article class="article">
  <h1>${tr(C.h1)}</h1>
  ${C.blocs.map(([titre, ps]) => `<h2>${esc(tr(titre))}</h2>${ps.map((p) => `<p>${esc(tr(p))}</p>`).join('')}`).join('\n  ')}
</article>`;
  return gabarit({ lang, t, titre: tr(C.titre), description: tr(C.blocs[0][1][0]), chemin, base, corps, compte, maj });
}

function aPropos({ lang, t, base, compte, T, chemin, nb, maj }) {
  const handle = compte.replace(/^@/, '');
  const initiales = T.directeur.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  const bio = lang === 'fr' && T.directeur_bio ? T.directeur_bio : t.bio;
  const ctx = { lang, t, base, T };
  const corps = `${heroCourt({ base, photo: 'fourrure', alt: t.galAlt, etiquette: t.apEtiquette, h1: t.apH1, p: esc(t.apP(T.nbPartenaires)) })}
<section class="qui reveal">
  <h2>${t.missionH2}</h2>
  <p>${t.missionP1}</p>
  <p>${esc(t.missionP2)}</p>
  ${chiffres(t, T, nb)}
</section>
<section class="qui directeur reveal">
  <div class="portrait">${T.photo_directeur ? `${image(base, T.photo_directeur, { alt: T.directeur, sizes: '(min-width:700px) 380px, 340px', attrs: 'loading="lazy" width="900" height="1125"' })}` : `<span>${esc(initiales)}</span>`}</div>
  <div>
    <p class="etiquette">${esc(t.dirEtiquette)}</p>
    <h2>${esc(T.directeur)}</h2>
    <p>${esc(bio)}</p>
  </div>
</section>
${galerie(ctx)}
<section class="qui reveal">
  <h2>${t.equipeH2}</h2>
  <p>${esc(t.equipeP1(T.nbPartenaires))}</p>
  <p>${esc(t.equipeP2)} <a class="lien" href="https://ig.me/m/${esc(handle)}" target="_blank" rel="noopener">${esc(t.equipeLien)}</a>.</p>
</section>
${blocPros(ctx)}
${blocPartenaires(ctx)}
${blocOrga({ t, base, handle, lang })}`;
  return gabarit({ lang, t, titre: t.apTitre, description: t.apDesc(T.directeur, T.nbPartenaires), chemin, base, corps, compte, maj, ld: [...ldOrganisation(T, compte, t, lang), fil(lang, [['Teufy', ''], [t.qui, chemin]])], image: 'site/img/equipe/junior-joyant.jpg' });
}

// Page 404 (GitHub Pages la sert pour toute adresse inconnue : chemins absolus).
function page404(t) {
  const B = '/teufy-instagram/';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(t.e404)} · Teufy</title><meta name="robots" content="noindex"><link rel="icon" href="${B}site/img/logo.png"><link rel="stylesheet" href="${B}site/style.min.css"></head>
<body><main class="page-404"><a href="${B}"><img src="${B}site/img/logo.png" alt="Teufy" width="96" height="79"></a><h1>4<em>0</em>4</h1><p>${esc(t.e404p)}</p><p><a class="bouton" href="${B}#agenda">${esc(t.e404b)}</a></p>
<p class="langues-pied">${LANGUES.map((l) => `<a href="${B}${pre(l)}" hreflang="${l}" lang="${l}">${esc(TXT[l].nom)}</a>`).join(' · ')}</p></main></body></html>
`;
}
