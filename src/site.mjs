// Site Teufy : agenda des soirées de la Côte d'Azur, généré chaque jour par le bot (mêmes soirées vérifiées que les posts).
//   node src/run.mjs site        → index.html (racine du dépôt, servi par GitHub Pages) + site/ + en/ it/ es/ zh/ ar/
// - Les soirées sont écrites dans la page (et en données structurées schema.org Event) : Google peut les indexer.
// - 6 langues : français à la racine, les autres dans leur dossier (balises hreflang, sitemap multilingue).
// - Les affiches sont copiées dans site/affiches/ (les liens Instagram expirent) et vérifiées par Gemini
//   (une affiche d'une autre soirée n'est pas montrée). Résultats gardés dans contenus/affiches-verifiees.json.
// - Les lieux sont placés sur la carte grâce à OpenStreetMap (cache contenus/lieux-geo.json).
// - Le JavaScript (site/app.js) gère les filtres, « Ce soir / En ce moment », la carte et les animations.
import { readFileSync, existsSync } from 'node:fs';
import { writeFile, mkdir, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { genresList, isTechno } from './genres.mjs';
import { LANGUES, TXT } from './site-langues.mjs';

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
const STYLES = [
  ['techno', /techno|hard|acid|trance|rave|indus|minimal|tekno/i],
  ['house', /house|disco|deep|garage|french touch|electro/i],
  ['afro', /afro|amapiano|shatta|dancehall|reggaeton|perreo|latin|bouyon|kompa/i],
  ['rap', /rap|hip.?hop|rnb|r&b|trap|drill/i],
  ['commercial', /commercial|ann[ée]es|80|90|2000|pop|généraliste|open format|club/i],
];
const styleDe = (e) => {
  const t = [...(e.tags || []), e.name].join(' ');
  return STYLES.filter(([, re]) => re.test(t)).map(([k]) => k).slice(0, 2);
};

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
    const aRetenter = c && c.introuvable && Date.now() - Date.parse(c.le) > 14 * 864e5;
    if (s.lieu && (!c || aRetenter) && requetes < 40 && !coupe) {
      requetes++;
      const u = new URL('https://nominatim.openstreetmap.org/search');
      Object.entries({ format: 'json', limit: '1', q: `${s.lieu}, ${s.ville}`, countrycodes: 'fr,mc', viewbox: '5.6,44.4,7.8,42.9', bounded: '1' }).forEach(([a, b]) => u.searchParams.set(a, b));
      const r = await fetch(u, { headers: { 'User-Agent': 'TeufySite/1.0 (+https://junior63122.github.io/teufy-instagram/)', 'Accept-Language': 'fr' }, signal: AbortSignal.timeout(12000) }).catch(() => null);
      if (r?.ok) {
        const [p] = await r.json().catch(() => []);
        cache[k] = p ? { lat: +(+p.lat).toFixed(5), lng: +(+p.lon).toFixed(5), le: new Date().toISOString() } : { introuvable: true, le: new Date().toISOString() };
        if (p) trouves++;
        await dort(1100);
      } else coupe = true; // pas de réseau ou service refusé : on réessaiera au prochain passage
    }
    const g = cache[k];
    if (g && !g.introuvable) Object.assign(s, { lat: g.lat, lng: g.lng, approx: false });
    else {
      const [, lat, lng] = CENTRES.find(([re]) => re.test(`${s.ville} ${s.lieu}`)) || [null, 43.7009, 7.2683];
      const d = parseInt(h(s.lieu || s.nom), 16); // décalage stable : deux lieux d'une même ville ne se superposent pas
      Object.assign(s, { lat: +(lat + ((d % 100) - 50) * 0.00008).toFixed(5), lng: +(lng + ((Math.floor(d / 256) % 100) - 50) * 0.00011).toFixed(5), approx: true });
    }
  }
  await writeFile(GEO, JSON.stringify(cache, null, 1) + '\n');
  if (requetes) log(`Site : carte, ${trouves} lieu(x) trouvé(s) sur OpenStreetMap${coupe ? ' (service injoignable : positions approximatives en attendant)' : ''}`);
}

// Accroches traduites par l'IA (une fois par texte et par langue). Sans clé : on garde le français.
const NOMS_LANGUE = { en: 'English', it: 'Italian', es: 'Spanish', zh: 'Simplified Chinese', ar: 'Arabic' };
async function traduire(textes, log) {
  const cache = lire(TRAD, {});
  for (const l of LANGUES.filter((x) => x !== 'fr')) {
    const manque = [...new Set(textes)].filter((t) => t && !cache[`${l}|${h(t)}`]);
    for (let i = 0; i < manque.length; i += 40) {
      const lot = manque.slice(i, i + 40);
      const r = await gemini([{ text: `Translate these short French nightlife taglines into ${NOMS_LANGUE[l]}. Keep party names, artist names, venue names and emojis unchanged, keep the same casual tone. Answer with a JSON array of ${lot.length} strings, same order.\n${JSON.stringify(lot)}` }]);
      if (!Array.isArray(r) || r.length !== lot.length) break;
      lot.forEach((t, j) => { if (typeof r[j] === 'string' && r[j].trim()) cache[`${l}|${h(t)}`] = r[j].trim(); });
      log(`Site : ${lot.length} accroche(s) traduite(s) (${l})`);
    }
  }
  await writeFile(TRAD, JSON.stringify(cache, null, 1) + '\n');
  return (l, t) => (l === 'fr' || !t ? t : cache[`${l}|${h(t)}`] || t);
}

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
  for (const e of fiables) {
    let affiche = '';
    if (e.image) {
      const f = path.join(SITE, 'affiches', `${h(e.image)}.jpg`);
      if (existsSync(f) || await telecharger(e.image, f)) {
        if (await verifier(e, f, cache)) affiche = `site/affiches/${path.basename(f)}`;
        else log(`Site : affiche écartée (ne correspond pas) pour « ${e.name} »`);
      }
    }
    const ville = VILLES.find((v) => new RegExp(v, 'i').test(`${e.city} ${e.venue}`)) || 'autres';
    soirees.push({
      nom: e.name, debut: e.start, jour: cle(e.start), lieu: e.venue || '', ville: e.city || '', filtreVille: ville.toLowerCase(),
      prix: e.price == null ? null : e.price, styles: styleDe(e), genres: genresList(e, 3).join(' · '), techno: isTechno(e),
      url: /^https?:\/\//.test(e.url || '') && !/^https?:\/\/[^/]+\/?$/.test(e.url) ? e.url : '', affiche, accroche: e.accroche || '',
      instagram: (e.instagram || [])[0] || '', buzz: e.buzz ?? null,
    });
  }
  await writeFile(VERIF, JSON.stringify(cache, null, 1) + '\n');
  await geocoder(soirees, log);
  const tr = await traduire(soirees.map((s) => s.accroche), log);

  // Derniers posts Instagram du compte (couverture gardée dans media/).
  const posts = hist.filter((x) => x.lien).slice(-9).reverse().map((x) => {
    const id = x.id; const p = lire(path.join(ROOT, 'media', id, 'publication.json'), null);
    const img = p ? (p.couverture || p.images?.[0]) : null;
    return { lien: x.lien, titre: (x.titre || x.publication?.titre || '').replace(/[[\]]/g, ''), image: img ? `media/${id}/${img}` : '' };
  }).filter((x) => x.image && existsSync(path.join(ROOT, x.image)));

  await assets();
  const compte = config.compte || '@teufy_official';
  const T = { ...TEUFY, ...(config.site || {}) };
  T.nbPartenaires = (String(T.partenaires).match(/\d+/) || ['200'])[0];
  GOOGLE = (config.site?.google_verification || '').trim();

  const pages = [];
  for (const lang of LANGUES) {
    const t = TXT[lang];
    const P = pre(lang);
    const prof = (sous) => '../'.repeat((lang === 'fr' ? 0 : 1) + (sous ? 1 : 0));
    const sl = soirees.map((s) => ({ ...s, accroche: tr(lang, s.accroche) }));
    const ctx = (chemin) => ({ lang, t, chemin, base: prof(!!chemin), compte, T });
    pages.push([P, page({ ...ctx(''), soirees: sl, posts, now })]);
    pages.push([`${P}a-propos/`, aPropos({ ...ctx('a-propos/'), nb: sl.length })]);
    for (const v of VILLES_SEO) pages.push([`${P}${v.slug}/`, pageVille({ ...ctx(`${v.slug}/`), v, soirees: sl.filter((x) => v.re.test(`${x.ville} ${x.lieu}`)), now })]);
  }
  for (const [dossier, html] of pages) {
    await mkdir(path.join(ROOT, dossier), { recursive: true });
    await writeFile(path.join(ROOT, dossier, 'index.html'), html);
  }
  const jourIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now);
  const chemins = ['', 'a-propos/', ...VILLES_SEO.map((v) => `${v.slug}/`)];
  const urls = LANGUES.flatMap((l) => chemins.map((c) => `  <url><loc>${URL_SITE}${pre(l)}${c}</loc><lastmod>${jourIso}</lastmod><changefreq>daily</changefreq><priority>${c ? '0.8' : l === 'fr' ? '1.0' : '0.9'}</priority>${LANGUES.map((x) => `<xhtml:link rel="alternate" hreflang="${x}" href="${URL_SITE}${pre(x)}${c}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${URL_SITE}${c}"/></url>`));
  await writeFile(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);
  await writeFile(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /out/\nDisallow: /apercus/\nDisallow: /livrables/\nSitemap: ${URL_SITE}sitemap.xml\n`);
  await writeFile(path.join(ROOT, '.nojekyll'), '');
  log(`Site : ${soirees.length} soirée(s), ${soirees.filter((s) => s.affiche).length} avec affiche, ${soirees.filter((s) => !s.approx).length} placée(s) précisément sur la carte, ${posts.length} post(s) Instagram, ${pages.length} page(s) en ${LANGUES.length} langues`);
  return soirees;
}

// Polices, logo et photos de la DA copiés depuis le studio (une seule source de vérité).
async function assets() {
  const S = path.join(ROOT, 'studio', 'public');
  await mkdir(path.join(SITE, 'fonts'), { recursive: true });
  await mkdir(path.join(SITE, 'img'), { recursive: true });
  for (const f of ['bricolage.woff2', 'bricolage-ext.woff2', 'inter-tight.woff2', 'inter-tight-ext.woff2']) await copyFile(path.join(S, 'fonts', f), path.join(SITE, 'fonts', f));
  await copyFile(path.join(S, 'logo.png'), path.join(SITE, 'img', 'logo.png'));
  for (const f of PHOTOS) {
    const out = path.join(SITE, 'img', `${f}.jpg`);
    if (!existsSync(out)) spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(S, 'decors', 'da', `${f}.jpg`), '-vf', "scale='min(1200,iw)':-2", '-q:v', '5', out]);
  }
}

const PHOTOS = ['danse', 'foule', 'selfie', 'rire', 'dj', 'lasers', 'rooftop', 'terrasse'];
// Photos de Junior et de l'équipe en soirée (site/img/equipe/).
const GALERIE = ['fourrure', 'scene-dj', 'bal-des-fous', 'cowboys', 'bresil', 'club', 'aperol'];
const nombre = (p, t) => new Intl.NumberFormat(t.locale, { maximumFractionDigits: 2 }).format(p);
const prixTexte = (p, t) => (p == null ? '' : p === 0 ? t.gratuit : t.des(nombre(Math.round(p * 100) / 100, t)));
const heure = (d, t) => (t.locale === 'fr-FR' ? paris(d, { hour: '2-digit', minute: '2-digit' }).replace(':', 'h') : paris(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, t.locale));

function carte(s, { t, base, vedette = false }) {
  const date = paris(s.debut, { weekday: 'short', day: 'numeric', month: 'short' }, t.locale).replace(/\.(?=\s|$)/g, '');
  const heureTxt = heure(s.debut, t);
  const prix = prixTexte(s.prix, t);
  return `<article class="carte${vedette ? ' vedette' : ''}" data-jour="${s.jour}" data-debut="${esc(s.debut)}" data-heure="${esc(heureTxt)}" data-ville="${s.filtreVille}" data-styles="${s.styles.join(' ')}" data-prix="${s.prix ?? ''}" data-lat="${s.lat ?? ''}" data-lng="${s.lng ?? ''}"${s.approx ? ' data-approx="1"' : ''}>
  <div class="affiche${s.affiche ? '' : ' sans'}">${s.affiche ? `<img src="${base}${s.affiche}" alt="${esc(t.affiche + s.nom)}" loading="lazy" decoding="async">` : `<img src="${base}site/img/${PHOTOS[parseInt(h(s.nom), 16) % PHOTOS.length]}.jpg" alt="" loading="lazy" decoding="async">`}<span class="date">${esc(date)}</span></div>
  <div class="infos">
    ${s.genres ? `<p class="genre">${esc(s.genres)}</p>` : ''}
    <h3>${esc(s.nom)}</h3>
    ${s.accroche ? `<p class="accroche">${esc(s.accroche)}</p>` : ''}
    <p class="meta"><span>${esc(heureTxt)}</span><span>${esc(prix || t.prixBillet)}</span><span class="ou">${esc([s.lieu, s.ville].filter(Boolean).join(', '))}</span></p>
    <p class="actions">${s.url ? `<a class="bouton" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(t.billets)}</a>` : `<a class="bouton secondaire" href="https://www.google.com/search?q=${encodeURIComponent(`${s.nom} ${s.lieu} billetterie`)}" target="_blank" rel="noopener">${esc(t.trouverBillets)}</a>`}${s.instagram ? `<a class="lien" href="https://www.instagram.com/${esc(s.instagram)}/" target="_blank" rel="noopener">@${esc(s.instagram)}</a>` : ''}</p>
  </div>
</article>`;
}

function jsonld(soirees) {
  return soirees.slice(0, 60).map((s) => ({
    '@context': 'https://schema.org', '@type': 'Event', name: s.nom, startDate: s.debut, eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: s.lieu || s.ville, address: { '@type': 'PostalAddress', addressLocality: s.ville, addressRegion: "Provence-Alpes-Côte d'Azur", addressCountry: 'FR' }, ...(s.approx === false ? { geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng } } : {}) },
    ...(s.affiche ? { image: [URL_SITE + s.affiche] } : {}),
    ...(s.url ? { url: s.url } : {}),
    ...(s.prix != null ? { offers: { '@type': 'Offer', price: s.prix, priceCurrency: 'EUR', ...(s.url ? { url: s.url } : {}), availability: 'https://schema.org/InStock' } } : {}),
    ...(s.instagram ? { organizer: { '@type': 'Organization', name: `@${s.instagram}`, url: `https://www.instagram.com/${s.instagram}/` } } : {}),
  }));
}

// --- Présentation de Teufy (modifiable dans config.json, rubrique « site ») -------------------------------------
const TEUFY = {
  directeur: 'Junior Joyant',
  directeur_bio: '', // vide : texte par défaut (traduit dans chaque langue). Rempli dans config.json : remplace le texte français.
  equipe: 'une dizaine de personnes',
  partenaires: 'plus de 200',
  photo_directeur: 'site/img/equipe/junior-joyant.jpg',
};
const VILLES_SEO = [
  { slug: 'soirees-nice', cle: 'nice', re: /nice|saint-laurent|cagnes|villefranche/i, photo: 'club' },
  { slug: 'soirees-cannes', cle: 'cannes', re: /cannes|mandelieu|le cannet/i, photo: 'bal-des-fous' },
  { slug: 'soirees-monaco', cle: 'monaco', re: /monaco|monte.?carlo|beausoleil/i, photo: 'monaco', video: true },
  { slug: 'soirees-antibes', cle: 'antibes', re: /antibes|juan|biot|vallauris|golfe/i, photo: 'bresil' },
];

let GOOGLE = ''; // code de vérification Google Search Console (config.site.google_verification)
function gabarit({ lang, t, titre, description, chemin, base, corps, ld = [], image = 'site/img/equipe/monaco.jpg', compte }) {
  const handle = compte.replace(/^@/, '');
  const P = pre(lang);
  const accueil = `${base}${P}`;
  const nav = [['', t.agenda], ...VILLES_SEO.map((v) => [`${v.slug}/`, t.villes[v.cle === 'antibes' ? 'antibesCourt' : v.cle]]), ['#carte', t.carte], ['a-propos/', t.qui]];
  const jsT = { ...t.js, base, langue: lang, locale: t.locale };
  return `<!doctype html>
<html lang="${lang}" dir="${t.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${URL_SITE}${P}${chemin}">
${LANGUES.map((l) => `<link rel="alternate" hreflang="${l}" href="${URL_SITE}${pre(l)}${chemin}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${URL_SITE}${chemin}">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${URL_SITE}${image}">
<meta property="og:url" content="${URL_SITE}${P}${chemin}">
<meta property="og:type" content="website">
<meta property="og:locale" content="${t.og}">
<meta name="theme-color" content="#0B0B0F">
${GOOGLE ? `<meta name="google-site-verification" content="${esc(GOOGLE)}">` : ''}
<link rel="icon" href="${base}site/img/logo.png">
<link rel="stylesheet" href="${base}site/style.css">
<script>document.documentElement.classList.add('js')</script>
${ld.length ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<header class="barre">
  <a class="marque" href="${accueil || './'}" aria-label="Teufy"><img src="${base}site/img/logo.png" alt="Teufy"></a>
  <div class="barre-droite">
    <details class="langues"><summary aria-label="${esc(t.langue)}">${lang.toUpperCase()}</summary><div>${LANGUES.map((l) => `<a href="${base}${pre(l)}${chemin}" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="true"' : ''}>${esc(TXT[l].nom)}</a>`).join('')}</div></details>
    <a class="bouton petit" href="https://www.instagram.com/${esc(handle)}/" target="_blank" rel="noopener">Instagram</a>
  </div>
</header>
<nav class="nav">${nav.map(([d, n]) => `<a href="${accueil}${d}"${d === chemin ? ' aria-current="page"' : ''}>${esc(n)}</a>`).join('')}</nav>
<main>
${corps}
</main>
<footer>
  <p><strong>Teufy</strong> · ${esc(t.pied1)} · <a href="${accueil}a-propos/">${esc(t.qui)}</a> · <a href="https://www.instagram.com/${esc(handle)}/" target="_blank" rel="noopener">${esc(compte)}</a></p>
  <p>${esc(t.pied2)} <a href="${accueil}soirees-nice/">${esc(t.villes.nice)}</a>, <a href="${accueil}soirees-cannes/">${esc(t.villes.cannes)}</a>, <a href="${accueil}soirees-monaco/">${esc(t.villes.monaco)}</a>, <a href="${accueil}soirees-antibes/">${esc(t.villes.antibes)}</a>, ${esc(t.pied2b)}</p>
  <p>${esc(t.pied3)}</p>
  <p class="langues-pied">${LANGUES.map((l) => `<a href="${base}${pre(l)}${chemin}" hreflang="${l}" lang="${l}">${esc(TXT[l].nom)}</a>`).join(' · ')}</p>
</footer>
<div class="flottant" hidden><button type="button" class="ouvrir-filtres"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><span>${esc(t.js.filtres)}</span><b class="compte"></b></button></div>
<script type="application/json" id="teufy-t">${JSON.stringify(jsT).replace(/</g, '\\u003c')}</script>
<script src="${base}site/app.js" defer></script>
</body>
</html>
`;
}

// Organisation + site (schema.org) : qui est Teufy, qui la dirige, où la suivre.
function ldOrganisation(T, compte, t, lang) {
  const handle = compte.replace(/^@/, '');
  return [{
    '@context': 'https://schema.org', '@type': 'Organization', '@id': `${URL_SITE}#teufy`, name: 'Teufy', url: URL_SITE, logo: `${URL_SITE}site/img/logo.png`,
    description: t.orgDesc,
    founder: { '@type': 'Person', name: T.directeur, jobTitle: 'Directeur', ...(T.photo_directeur ? { image: URL_SITE + T.photo_directeur } : {}) },
    areaServed: ["Côte d'Azur", 'Nice', 'Cannes', 'Monaco', 'Antibes'], sameAs: [`https://www.instagram.com/${handle}/`],
  }, { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Teufy', url: `${URL_SITE}${pre(lang)}`, inLanguage: lang, publisher: { '@id': `${URL_SITE}#teufy` } }];
}

// Bandeau qui défile sous le hero.
const defile = (t) => `<div class="defile" aria-hidden="true" dir="ltr"><div class="piste">${[0, 1].map(() => `<span>${t.defile.map((x) => `${esc(x)}<i>✦</i>`).join('')}</span>`).join('')}</div></div>`;

// « Ce soir / En ce moment » : rempli par app.js avec les cartes de l'agenda (l'heure du visiteur fait foi).
const ceSoir = (t) => `<section id="ce-soir" class="ce-soir" hidden>
  <div class="tete"><p class="etiquette"><i class="point"></i>${esc(t.ceSoirEtiquette)}</p><h2>${t.ceSoirH2}</h2><p>${esc(t.ceSoirP)}</p></div>
  <div class="rangee"></div>
</section>`;

function agenda(soirees, { t, base, filtresVille = true }) {
  const parJour = {};
  for (const s of soirees) (parJour[s.jour] ||= []).push(s);
  const jours = Object.entries(parJour).map(([jour, l]) => {
    const titre = paris(`${jour}T12:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' }, t.locale);
    return `<section class="jour" data-jour="${jour}"><h2>${esc(titre.charAt(0).toUpperCase() + titre.slice(1))}</h2><div class="grille">${l.map((s) => carte(s, { t, base })).join('\n')}</div></section>`;
  }).join('\n');
  const groupe = (f, valeurs, libelles) => `<div class="groupe" data-filtre="${f}">${valeurs.map((v, i) => `<button type="button"${i ? '' : ' class="actif"'} data-v="${v}">${esc(libelles[i])}</button>`).join('')}</div>`;
  return `<section id="agenda" class="agenda">
  <div class="filtres-place"><div class="filtres" role="toolbar" aria-label="${esc(t.js.filtres)}">
    <div class="vues"><button type="button" class="actif" data-vue="liste">${esc(t.agenda)}</button><button type="button" data-vue="carte">${esc(t.carte)}</button><button type="button" class="fermer-filtres">${esc(t.js.fermer)}</button></div>
    ${groupe('quand', ['tout', 'soir', 'weekend', 'semaine'], t.quand)}
    ${filtresVille ? groupe('ville', ['tout', ...VILLES.map((v) => v.toLowerCase()), 'autres'], [t.partout, t.villes.nice, t.villes.cannes, t.villes.monaco, t.villes.antibesCourt, t.ailleurs]) : ''}
    ${groupe('style', ['tout', 'techno', 'house', 'afro', 'rap', 'commercial'], t.sons)}
    ${groupe('prix', ['tout', 'gratuit', '10'], t.prix)}
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
  <div class="photos">${GALERIE.map((f, i) => `<figure style="--i:${i}"><img src="${base}site/img/equipe/${f}.jpg" alt="${esc(t.galAlt)}" loading="lazy" decoding="async"></figure>`).join('')}</div>
</section>`;
}

// Fond du hero : la vidéo du port de Monaco (muette, en boucle) ou une photo de l'équipe.
const fond = (base, photo, video, alt) => (video
  ? `<video class="hero-photo" autoplay muted loop playsinline preload="metadata" poster="${base}site/img/equipe/${photo}.jpg" aria-label="${esc(alt)}"><source src="${base}site/img/equipe/${photo}.mp4" type="video/mp4"></video>`
  : `<img src="${base}site/img/equipe/${photo}.jpg" alt="${esc(alt)}" class="hero-photo">`);

function page({ lang, t, base, compte, T, soirees, posts, now }) {
  const handle = compte.replace(/^@/, '');
  const semaine = soirees.filter((s) => Date.parse(s.debut) < now.getTime() + 8 * 864e5);
  const vedette = [...semaine].filter((s) => s.affiche && (s.buzz ?? 0) >= 0.7).sort((a, b) => b.buzz - a.buzz)[0];
  const ctx = { lang, t, base, T };
  const corps = `<section class="hero">
  ${fond(base, 'monaco', true, t.heroAlt)}
  <div class="hero-texte">
    <p class="etiquette">${esc(t.heroEtiquette)}</p>
    <h1>${t.heroH1}</h1>
    <p>${esc(t.heroP(soirees.length))}</p>
    <div class="hero-actions"><a class="bouton" href="#agenda">${esc(t.heroBouton)}</a><a class="bouton contour" href="#carte">${esc(t.heroCarte)}</a><a class="pastille-live" href="#ce-soir" hidden><i class="point"></i><span></span></a></div>
  </div>
</section>
${defile(t)}
${ceSoir(t)}
${vedette ? `<section class="la-plus reveal"><p class="etiquette">${esc(t.laPlus)}</p>${carte(vedette, { t, base, vedette: true })}</section>` : ''}
${agenda(soirees, { t, base })}
${blocTeufy(ctx, soirees.length)}
${galerie(ctx)}
${blocPartenaires(ctx)}
${posts.length ? `<section class="insta reveal"><h2>${esc(t.insta)}</h2><div class="posts">${posts.map((p) => `<a href="${esc(p.lien)}" target="_blank" rel="noopener"><img src="${base}${esc(p.image)}" alt="${esc(p.titre)}" loading="lazy"></a>`).join('')}</div><a class="bouton" href="https://www.instagram.com/${esc(handle)}/" target="_blank" rel="noopener">${esc(compte)}</a></section>` : ''}
${blocOrga({ t, base, handle })}`;
  return gabarit({ lang, t, titre: t.homeTitre, description: t.homeDesc(soirees.length), chemin: '', base, corps, ld: [...ldOrganisation(T, compte, t, lang), ...jsonld(soirees)], compte });
}

function blocOrga({ t, base, handle }) {
  return `<section class="orga reveal">
  <img src="${base}site/img/equipe/scene-dj.jpg" alt="" class="hero-photo" loading="lazy">
  <div class="hero-texte">
    <p class="etiquette">${esc(t.orgaEtiquette)}</p>
    <h2>${t.orgaH2}</h2>
    <p>${esc(t.orgaP)}</p>
    <a class="bouton" href="https://ig.me/m/${esc(handle)}" target="_blank" rel="noopener">${esc(t.orgaBouton)}</a>
  </div>
</section>`;
}

function pageVille({ lang, t, base, compte, T, chemin, v, soirees, now }) {
  const ville = t.villes[v.cle];
  const n = soirees.filter((s) => s.jour === cle(now.toISOString())).length;
  const faq = t.faq(ville, n);
  const corps = `<section class="hero court">
  ${fond(base, v.photo, v.video, ville)}
  <div class="hero-texte">
    <p class="etiquette">${esc(t.villeEtiquette(ville))}</p>
    <h1>${t.villeH1(esc(ville))}</h1>
    <p>${esc(t.intro[v.cle])} ${esc(t.villeN(soirees.length))}</p>
    <div class="hero-actions"><a class="pastille-live" href="#ce-soir" hidden><i class="point"></i><span></span></a></div>
  </div>
</section>
${ceSoir(t)}
${agenda(soirees, { t, base, filtresVille: false })}
<section class="qui faq reveal"><h2>${esc(t.faqH2(ville))}</h2>${faq.map(([q, r]) => `<details><summary>${esc(q)}</summary><p>${esc(r)}</p></details>`).join('')}</section>
${blocOrga({ t, base, handle: compte.replace(/^@/, '') })}`;
  return gabarit({ lang, t, titre: t.villeTitre(ville), description: t.villeDesc(ville, soirees.length), chemin, base, corps, compte,
    ld: [...ldOrganisation(T, compte, t, lang), ...jsonld(soirees), { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, r]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: r } })) }] });
}

function aPropos({ lang, t, base, compte, T, chemin, nb }) {
  const handle = compte.replace(/^@/, '');
  const initiales = T.directeur.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  const bio = lang === 'fr' && T.directeur_bio ? T.directeur_bio : t.bio;
  const ctx = { lang, t, base, T };
  const corps = `<section class="hero court">
  ${fond(base, 'fourrure', false, t.galAlt)}
  <div class="hero-texte">
    <p class="etiquette">${esc(t.apEtiquette)}</p>
    <h1>${t.apH1}</h1>
    <p>${esc(t.apP(T.nbPartenaires))}</p>
  </div>
</section>
<section class="qui reveal">
  <h2>${t.missionH2}</h2>
  <p>${t.missionP1}</p>
  <p>${esc(t.missionP2)}</p>
  ${chiffres(t, T, nb)}
</section>
<section class="qui directeur reveal">
  <div class="portrait">${T.photo_directeur ? `<img src="${base}${esc(T.photo_directeur)}" alt="${esc(T.directeur)}" loading="lazy">` : `<span>${esc(initiales)}</span>`}</div>
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
${blocPartenaires(ctx)}
${blocOrga({ t, base, handle })}`;
  return gabarit({ lang, t, titre: t.apTitre, description: t.apDesc(T.directeur, T.nbPartenaires), chemin, base, corps, compte, ld: ldOrganisation(T, compte, t, lang), image: 'site/img/equipe/junior-joyant.jpg' });
}
