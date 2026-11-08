// Site Teufy : agenda des soirées de la Côte d'Azur, généré chaque jour par le bot (mêmes soirées vérifiées que les posts).
//   node src/run.mjs site        → index.html (racine du dépôt, servi par GitHub Pages) + site/
// - Les soirées sont écrites dans la page (et en données structurées schema.org Event) : Google peut les indexer.
// - Les affiches sont copiées dans site/affiches/ (les liens Instagram expirent) et vérifiées par Gemini
//   (une affiche d'une autre soirée n'est pas montrée). Résultats gardés dans contenus/affiches-verifiees.json.
// - Le JavaScript ne sert qu'aux filtres (quand, ville, style, prix).
import { readFileSync, existsSync } from 'node:fs';
import { writeFile, mkdir, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { genresList, isTechno } from './genres.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const VERIF = path.join(ROOT, 'contenus', 'affiches-verifiees.json');
const URL_SITE = 'https://junior63122.github.io/teufy-instagram/';
const h = (s) => createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lire = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
const paris = (d, o) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', ...o }).format(new Date(d));
const nuit = (d) => new Date(Date.parse(d) - 6 * 3600e3); // une soirée qui commence à 1h appartient à la veille
const cle = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(nuit(d)); // AAAA-MM-JJ

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

async function verifier(e, fichier, cache) {
  const k = h(`${e.image}|${e.name}`);
  if (cache[k]) return cache[k].ok;
  const CLE = (process.env.GEMINI_API_KEY || '').trim();
  if (!CLE) return true; // pas de clé : on ne bloque pas
  const API = 'https://generativelanguage.googleapis.com/v1beta/models';
  try {
    const liste = await (await fetch(`${API}?pageSize=200&key=${CLE}`)).json();
    const modeles = (liste.models || []).map((m) => m.name.replace('models/', '')).filter((n) => /^gemini-[\d.]+-flash/.test(n) && !/image|tts|audio|live|lite/.test(n))
      .sort((a, b) => parseFloat(b.slice(7)) - parseFloat(a.slice(7)));
    const img = readFileSync(fichier).toString('base64');
    const consigne = `Affiche censée illustrer la soirée « ${e.name} », le ${paris(e.start, { dateStyle: 'full' })}, ${e.venue || ''} ${e.city || ''}. Réponds en JSON {"correspond": true|false} : false seulement si l'affiche annonce clairement une AUTRE soirée (autre nom, autre artiste principal, autre lieu ou autre date).`;
    for (const m of modeles.slice(0, 3)) {
      const r = await fetch(`${API}/${m}:generateContent?key=${CLE}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'image/jpeg', data: img } }, { text: consigne }] }], generationConfig: { responseMimeType: 'application/json' } }) });
      if (r.status === 404) continue;
      const t = ((await r.json()).candidates?.[0]?.content?.parts || []).map((x) => x.text || '').join('');
      const ok = JSON.parse(t || '{}').correspond !== false;
      cache[k] = { ok, le: new Date().toISOString(), nom: e.name };
      return ok;
    }
  } catch { /* vérification impossible : on montre l'affiche */ }
  return true;
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

  // Derniers posts Instagram du compte (couverture gardée dans media/).
  const posts = hist.filter((x) => x.lien).slice(-9).reverse().map((x) => {
    const id = x.id; const p = lire(path.join(ROOT, 'media', id, 'publication.json'), null);
    const img = p ? (p.couverture || p.images?.[0]) : null;
    return { lien: x.lien, titre: (x.titre || x.publication?.titre || '').replace(/[[\]]/g, ''), image: img ? `media/${id}/${img}` : '' };
  }).filter((x) => x.image && existsSync(path.join(ROOT, x.image)));

  await assets();
  const compte = config.compte || '@teufy_official';
  const T = { ...TEUFY, ...(config.site || {}) };
  GOOGLE = (config.site?.google_verification || '').trim();
  const pages = [['', page({ soirees, posts, now, compte, T, base: '' })], ['a-propos/', aPropos({ now, compte, T, base: '../', nb: soirees.length })]];
  for (const v of VILLES_SEO) pages.push([`${v.slug}/`, pageVille({ v, soirees: soirees.filter((x) => v.re.test(`${x.ville} ${x.lieu}`)), now, compte, T, base: '../' })]);
  for (const [dossier, html] of pages) {
    await mkdir(path.join(ROOT, dossier), { recursive: true });
    await writeFile(path.join(ROOT, dossier, 'index.html'), html);
  }
  const jourIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now);
  await writeFile(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(([d]) => `  <url><loc>${URL_SITE}${d}</loc><lastmod>${jourIso}</lastmod><changefreq>daily</changefreq><priority>${d ? '0.8' : '1.0'}</priority></url>`).join('\n')}\n</urlset>\n`);
  await writeFile(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /out/\nDisallow: /apercus/\nDisallow: /livrables/\nSitemap: ${URL_SITE}sitemap.xml\n`);
  await writeFile(path.join(ROOT, '.nojekyll'), '');
  log(`Site : ${soirees.length} soirée(s), ${soirees.filter((s) => s.affiche).length} avec affiche, ${posts.length} post(s) Instagram, ${pages.length} page(s) (accueil, à propos, villes)`);
  return soirees;
}

// Polices, logo et photos de la DA copiés depuis le studio (une seule source de vérité).
async function assets() {
  const S = path.join(ROOT, 'studio', 'public');
  await mkdir(path.join(SITE, 'fonts'), { recursive: true });
  await mkdir(path.join(SITE, 'img'), { recursive: true });
  for (const f of ['bricolage.woff2', 'bricolage-ext.woff2', 'inter-tight.woff2', 'inter-tight-ext.woff2']) await copyFile(path.join(S, 'fonts', f), path.join(SITE, 'fonts', f));
  await copyFile(path.join(S, 'logo.png'), path.join(SITE, 'img', 'logo.png'));
  for (const f of ['danse', 'foule', 'selfie', 'rire', 'dj', 'lasers', 'rooftop', 'terrasse']) {
    const out = path.join(SITE, 'img', `${f}.jpg`);
    if (!existsSync(out)) spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(S, 'decors', 'da', `${f}.jpg`), '-vf', "scale='min(1200,iw)':-2", '-q:v', '5', out]);
  }
}

const PHOTOS = ['danse', 'foule', 'selfie', 'rire', 'dj', 'lasers', 'rooftop', 'terrasse'];
const prixTexte = (p) => (p == null ? '' : p === 0 ? 'Gratuit' : `dès ${String(Math.round(p * 100) / 100).replace('.', ',')} €`);
const titreAccent = (t) => esc(t).replace(/\[([^\]]+)\]/g, '<em>$1</em>');

function carte(s, vedette = false, base = '') {
  const date = paris(s.debut, { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
  const heureTxt = paris(s.debut, { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  const prix = prixTexte(s.prix);
  return `<article class="carte${vedette ? ' vedette' : ''}" data-jour="${s.jour}" data-ville="${s.filtreVille}" data-styles="${s.styles.join(' ')}" data-prix="${s.prix ?? ''}">
  <div class="affiche${s.affiche ? '' : ' sans'}">${s.affiche ? `<img src="${base}${s.affiche}" alt="Affiche : ${esc(s.nom)}" loading="lazy" decoding="async">` : `<img src="${base}site/img/${PHOTOS[parseInt(h(s.nom), 16) % PHOTOS.length]}.jpg" alt="" loading="lazy" decoding="async">`}<span class="date">${esc(date)}</span></div>
  <div class="infos">
    ${s.genres ? `<p class="genre">${esc(s.genres)}</p>` : ''}
    <h3>${esc(s.nom)}</h3>
    ${s.accroche ? `<p class="accroche">${esc(s.accroche)}</p>` : ''}
    <p class="meta"><span>${esc(heureTxt)}</span><span>${esc(prix || 'Prix sur la billetterie')}</span><span>${esc([s.lieu, s.ville].filter(Boolean).join(', '))}</span></p>
    <p class="actions">${s.url ? `<a class="bouton" href="${esc(s.url)}" target="_blank" rel="noopener">Billets</a>` : `<a class="bouton secondaire" href="https://www.google.com/search?q=${encodeURIComponent(`${s.nom} ${s.lieu} billetterie`)}" target="_blank" rel="noopener">Trouver les billets</a>`}${s.instagram ? `<a class="lien" href="https://www.instagram.com/${esc(s.instagram)}/" target="_blank" rel="noopener">@${esc(s.instagram)}</a>` : ''}</p>
  </div>
</article>`;
}

function jsonld(soirees) {
  return soirees.slice(0, 60).map((s) => ({
    '@context': 'https://schema.org', '@type': 'Event', name: s.nom, startDate: s.debut, eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: s.lieu || s.ville, address: { '@type': 'PostalAddress', addressLocality: s.ville, addressRegion: "Provence-Alpes-Côte d'Azur", addressCountry: 'FR' } },
    ...(s.affiche ? { image: [URL_SITE + s.affiche] } : {}),
    ...(s.url ? { url: s.url } : {}),
    ...(s.prix != null ? { offers: { '@type': 'Offer', price: s.prix, priceCurrency: 'EUR', ...(s.url ? { url: s.url } : {}), availability: 'https://schema.org/InStock' } } : {}),
    ...(s.instagram ? { organizer: { '@type': 'Organization', name: `@${s.instagram}`, url: `https://www.instagram.com/${s.instagram}/` } } : {}),
  }));
}

// --- Présentation de Teufy (modifiable dans config.json, rubrique « site ») -------------------------------------
const TEUFY = {
  directeur: 'Junior Joyant',
  directeur_bio: "Niçois et fêtard convaincu, Junior Joyant a créé Teufy pour une raison simple : sur la Côte d'Azur, les soirées étaient partout, sauf au même endroit. Il dirige aujourd'hui une équipe d'une dizaine de personnes qui trient, vérifient et racontent la nuit de Nice à Monaco.",
  equipe: "une dizaine de personnes",
  partenaires: "plus de 200",
  photo_directeur: '', // chemin d'une photo (ex. site/img/junior.jpg) : laissé vide tant qu'aucune photo n'est fournie
};
const VILLES_SEO = [
  { slug: 'soirees-nice', nom: 'Nice', re: /nice|saint-laurent|cagnes|villefranche/i, intro: "Clubs du Vieux-Nice et du port, rooftops, soirées étudiantes, techno au Frigo 16 ou grosses dates à Nikaïa : toutes les soirées de Nice, vérifiées et mises à jour chaque jour." },
  { slug: 'soirees-cannes', nom: 'Cannes', re: /cannes|mandelieu|le cannet/i, intro: "Plages privées, clubs de la Croisette, soirées des festivals et after-beach : toutes les soirées de Cannes, vérifiées et mises à jour chaque jour." },
  { slug: 'soirees-monaco', nom: 'Monaco', re: /monaco|monte.?carlo|beausoleil/i, intro: "Twiga, Jimmy'z, Sea Club, Sporting : les soirées de Monaco et Monte-Carlo, avec les prix et les liens de réservation, mises à jour chaque jour." },
  { slug: 'soirees-antibes', nom: 'Antibes · Juan-les-Pins', re: /antibes|juan|biot|vallauris|golfe/i, intro: "Juan-les-Pins, le Vieil Antibes et les beach clubs du Cap : toutes les soirées d'Antibes et Juan-les-Pins, vérifiées et mises à jour chaque jour." },
];

let GOOGLE = ''; // code de vérification Google Search Console (config.site.google_verification)
function gabarit({ titre, description, chemin, base, corps, ld = [], image = 'site/img/danse.jpg', compte }) {
  const handle = compte.replace(/^@/, '');
  const nav = [['', 'Agenda'], ...VILLES_SEO.map((v) => [`${v.slug}/`, v.nom.split(' ·')[0]]), ['a-propos/', 'Qui sommes-nous']];
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${URL_SITE}${chemin}">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${URL_SITE}${image}">
<meta property="og:url" content="${URL_SITE}${chemin}">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta name="theme-color" content="#0B0B0F">
${GOOGLE ? `<meta name="google-site-verification" content="${esc(GOOGLE)}">` : ''}
<link rel="icon" href="${base}site/img/logo.png">
<link rel="stylesheet" href="${base}site/style.css">
${ld.length ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<header class="barre">
  <a class="marque" href="${base || './'}"><img src="${base}site/img/logo.png" alt="Teufy"><span>Teufy</span></a>
  <a class="bouton petit" href="https://www.instagram.com/${esc(handle)}/" target="_blank" rel="noopener">Instagram</a>
</header>
<nav class="nav">${nav.map(([d, n]) => `<a href="${base}${d}"${d === chemin ? ' aria-current="page"' : ''}>${esc(n)}</a>`).join('')}</nav>
${corps}
<footer>
  <p><strong>Teufy</strong> · Le guide des soirées de la Côte d'Azur · <a href="${base}a-propos/">Qui sommes-nous</a> · <a href="https://www.instagram.com/${esc(handle)}/" target="_blank" rel="noopener">${esc(compte)}</a></p>
  <p>Soirées à <a href="${base}soirees-nice/">Nice</a>, <a href="${base}soirees-cannes/">Cannes</a>, <a href="${base}soirees-monaco/">Monaco</a>, <a href="${base}soirees-antibes/">Antibes et Juan-les-Pins</a>, Menton, Cagnes, Fréjus, Saint-Raphaël et toute la Côte.</p>
  <p>Les informations viennent des pages officielles des soirées : vérifie toujours sur la billetterie avant de sortir.</p>
</footer>
<script src="${base}site/app.js" defer></script>
</body>
</html>
`;
}

// Organisation + site (schema.org) : qui est Teufy, qui la dirige, où la suivre.
function ldOrganisation(T, compte) {
  const handle = compte.replace(/^@/, '');
  return [{
    '@context': 'https://schema.org', '@type': 'Organization', '@id': `${URL_SITE}#teufy`, name: 'Teufy', url: URL_SITE, logo: `${URL_SITE}site/img/logo.png`,
    description: "Teufy est le guide des soirées de la Côte d'Azur : un agenda vérifié chaque jour de Nice à Monaco, un média Instagram et un réseau de partenaires (clubs, organisateurs, collectifs).",
    founder: { '@type': 'Person', name: T.directeur, jobTitle: 'Directeur', ...(T.photo_directeur ? { image: URL_SITE + T.photo_directeur } : {}) },
    areaServed: ["Côte d'Azur", 'Nice', 'Cannes', 'Monaco', 'Antibes'], sameAs: [`https://www.instagram.com/${handle}/`],
  }, { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Teufy', url: URL_SITE, inLanguage: 'fr-FR', publisher: { '@id': `${URL_SITE}#teufy` } }];
}

function agenda(soirees, base, { filtresVille = true } = {}) {
  const parJour = {};
  for (const s of soirees) (parJour[s.jour] ||= []).push(s);
  const jours = Object.entries(parJour).map(([jour, l]) => {
    const titre = paris(`${jour}T12:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' });
    return `<section class="jour" data-jour="${jour}"><h2>${esc(titre.charAt(0).toUpperCase() + titre.slice(1))}</h2><div class="grille">${l.map((s) => carte(s, false, base)).join('\n')}</div></section>`;
  }).join('\n');
  return `<section id="agenda" class="agenda">
  <div class="filtres" role="toolbar" aria-label="Filtres">
    <div class="groupe" data-filtre="quand"><button class="actif" data-v="tout">Tout</button><button data-v="soir">Ce soir</button><button data-v="weekend">Ce week-end</button><button data-v="semaine">7 jours</button></div>
    ${filtresVille ? `<div class="groupe" data-filtre="ville"><button class="actif" data-v="tout">Partout</button>${VILLES.map((v) => `<button data-v="${v.toLowerCase()}">${v}</button>`).join('')}<button data-v="autres">Ailleurs</button></div>` : ''}
    <div class="groupe" data-filtre="style"><button class="actif" data-v="tout">Tous les sons</button><button data-v="techno">Techno</button><button data-v="house">House</button><button data-v="afro">Afro · Latino</button><button data-v="rap">Rap · RnB</button><button data-v="commercial">Commercial</button></div>
    <div class="groupe" data-filtre="prix"><button class="actif" data-v="tout">Tous les prix</button><button data-v="gratuit">Gratuit</button><button data-v="10">Moins de 10 €</button></div>
  </div>
  ${jours || '<p class="vide">Pas encore de soirée vérifiée pour les prochains jours : reviens demain.</p>'}
  <p class="vide" id="aucune" hidden>Aucune soirée ne correspond à ces filtres.</p>
</section>`;
}

function blocPartenaires(T, base) {
  const P = lire(path.join(ROOT, 'contenus', 'partenaires.json'), { liste: [] }).liste || [];
  if (!P.length) return '';
  return `<section class="qui partenaires">
  <p class="etiquette">Partenaires</p>
  <h2>${esc(T.partenaires.replace(/^plus de /, 'Plus de '))} <em>partenaires</em> sur la Côte</h2>
  <p>Clubs, bars, beach clubs, organisateurs, collectifs, festivals et artistes : ils travaillent avec Teufy au quotidien.</p>
  <div class="logos">${P.map((x) => { const img = `<img src="${base}${esc(x.fichier)}" alt="${esc(x.nom || 'Partenaire Teufy')}" loading="lazy" width="80" height="80">`; return x.instagram ? `<a href="https://www.instagram.com/${esc(x.instagram)}/" target="_blank" rel="noopener" title="${esc(x.nom || x.instagram)}">${img}</a>` : `<span>${img}</span>`; }).join('')}</div>
  <p class="et-plus">Et bien plus encore !</p>
</section>`;
}

function blocTeufy(T, base, nb) {
  return `<section class="qui">
  <p class="etiquette">Qui sommes-nous</p>
  <h2>Teufy, la nuit de la Côte d'Azur <em>au même endroit</em></h2>
  <p>Teufy est le guide des soirées de la Côte d'Azur. Chaque jour, notre équipe et nos outils parcourent les billetteries (Shotgun, DICE, Resident Advisor, Weezevent…), les sites des clubs, les agendas des villes et les comptes des organisateurs pour réunir <strong>toutes les soirées de Nice à Monaco</strong>, sans doublon, avec l'affiche officielle, l'heure, le prix et le lien de billetterie.</p>
  <ul class="chiffres">
    <li><strong>${esc(nb)}</strong><span>soirées à venir dans l'agenda</span></li>
    <li><strong>${esc(T.partenaires)}</strong><span>partenaires sur la Côte d'Azur</span></li>
    <li><strong>${esc(T.equipe.replace(/^une /, ''))}</strong><span>personnes dans l'équipe</span></li>
  </ul>
  <a class="lien" href="${base}a-propos/">Découvrir Teufy et son équipe</a>
</section>`;
}

function page({ soirees, posts, now, compte, T, base }) {
  const handle = compte.replace(/^@/, '');
  const semaine = soirees.filter((s) => Date.parse(s.debut) < now.getTime() + 8 * 864e5);
  const vedette = [...semaine].filter((s) => s.affiche && (s.buzz ?? 0) >= 0.7).sort((a, b) => b.buzz - a.buzz)[0];
  const corps = `<section class="hero">
  <img src="site/img/danse.jpg" alt="Soirée sur la Côte d'Azur" class="hero-photo">
  <div class="hero-texte">
    <p class="etiquette">Agenda · Côte d'Azur</p>
    <h1>Où sortir ce soir sur la <em>Côte d'Azur</em> ?</h1>
    <p>Toutes les soirées de Nice, Cannes, Monaco et Antibes réunies et vérifiées chaque jour par Teufy : ${soirees.length} soirées à venir, avec affiches officielles, horaires, prix et billetterie.</p>
    <a class="bouton" href="#agenda">Voir l'agenda</a>
  </div>
</section>
${vedette ? `<section class="la-plus"><p class="etiquette">🔥 La plus attendue cette semaine</p>${carte(vedette, true, base)}</section>` : ''}
${agenda(soirees, base)}
${blocTeufy(T, base, soirees.length)}
${blocPartenaires(T, base)}
${posts.length ? `<section class="insta"><h2>Sur Instagram</h2><div class="posts">${posts.map((p) => `<a href="${esc(p.lien)}" target="_blank" rel="noopener"><img src="${esc(p.image)}" alt="${esc(p.titre)}" loading="lazy"></a>`).join('')}</div><a class="bouton" href="https://www.instagram.com/${esc(handle)}/" target="_blank" rel="noopener">${esc(compte)}</a></section>` : ''}
${blocOrga(handle, base)}`;
  return gabarit({ titre: "Teufy · Soirées sur la Côte d'Azur : où sortir ce soir à Nice, Cannes, Monaco", description: `Toutes les soirées de la Côte d'Azur au même endroit : ${soirees.length} soirées vérifiées à Nice, Cannes, Monaco et Antibes, mises à jour chaque jour. Clubs, techno, afro, rooftops, soirées étudiantes.`, chemin: '', base, corps, ld: [...ldOrganisation(T, compte), ...jsonld(soirees)], compte });
}

function blocOrga(handle, base) {
  return `<section class="orga">
  <img src="${base}site/img/foule.jpg" alt="" class="hero-photo">
  <div class="hero-texte">
    <p class="etiquette">Organisateurs</p>
    <h2>Ta soirée sur <em>Teufy</em></h2>
    <p>Envoie-nous ton affiche, la date et le lien de billetterie en message sur Instagram : on l'ajoute à l'agenda et, si elle plaît aux 17-30 ans de la Côte, on la met en avant.</p>
    <a class="bouton" href="https://ig.me/m/${esc(handle)}" target="_blank" rel="noopener">Écrire à Teufy</a>
  </div>
</section>`;
}

function pageVille({ v, soirees, now, compte, T, base }) {
  const ville = v.nom;
  const ceSoir = soirees.filter((s) => s.jour === cle(now.toISOString())).length;
  const faq = [
    [`Où sortir ce soir à ${ville} ?`, `Teufy recense chaque jour toutes les soirées de ${ville} : ${ceSoir ? `${ceSoir} soirée(s) ce soir` : 'consulte l\'agenda ci-dessus'}, avec l'heure, le prix et le lien de billetterie. Utilise le filtre « Ce soir ».`],
    [`Quelles soirées ce week-end à ${ville} ?`, `Le filtre « Ce week-end » de l'agenda affiche toutes les soirées de vendredi à dimanche à ${ville}, mises à jour chaque jour.`],
    [`Y a-t-il des soirées gratuites à ${ville} ?`, `Oui : le filtre « Gratuit » affiche les soirées sans entrée payante, et « Moins de 10 € » les bons plans.`],
  ];
  const corps = `<section class="hero court">
  <img src="${base}site/img/${PHOTOS[parseInt(h(v.slug), 16) % PHOTOS.length]}.jpg" alt="Soirée à ${esc(ville)}" class="hero-photo">
  <div class="hero-texte">
    <p class="etiquette">Agenda · ${esc(ville)}</p>
    <h1>Soirées à <em>${esc(ville)}</em> : où sortir ce soir et ce week-end</h1>
    <p>${esc(v.intro)} ${soirees.length} soirées à venir.</p>
  </div>
</section>
${agenda(soirees, base, { filtresVille: false })}
<section class="qui faq"><h2>Sortir à ${esc(ville)} : questions fréquentes</h2>${faq.map(([q, r]) => `<details><summary>${esc(q)}</summary><p>${esc(r)}</p></details>`).join('')}</section>
${blocOrga(compte.replace(/^@/, ''), base)}`;
  return gabarit({ titre: `Soirées à ${ville} ce soir et ce week-end · Teufy`, description: `Toutes les soirées à ${ville} : ${soirees.length} soirées vérifiées, clubs, DJ, techno, afro, rooftops, prix et billetterie. Agenda mis à jour chaque jour par Teufy.`, chemin: `${v.slug}/`, base, corps, compte,
    ld: [...ldOrganisation(T, compte), ...jsonld(soirees), { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, r]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: r } })) }] });
}

function aPropos({ now, compte, T, base, nb }) {
  const handle = compte.replace(/^@/, '');
  const initiales = T.directeur.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  const corps = `<section class="hero court">
  <img src="${base}site/img/selfie.jpg" alt="L'équipe Teufy en soirée" class="hero-photo">
  <div class="hero-texte">
    <p class="etiquette">Qui sommes-nous</p>
    <h1>Teufy, le guide des soirées de la <em>Côte d'Azur</em></h1>
    <p>Un agenda vérifié chaque jour, un média Instagram et un réseau de ${esc(T.partenaires)} partenaires, de Nice à Monaco.</p>
  </div>
</section>
<section class="qui">
  <h2>Notre <em>mission</em></h2>
  <p>Sur la Côte d'Azur, les soirées sont partout : sur Shotgun, DICE, Resident Advisor, Weezevent, les sites des clubs, les agendas des villes, les stories des organisateurs… sauf au même endroit. Teufy les réunit <strong>toutes</strong>, sans doublon, et vérifie chacune sur sa page officielle (date, heure, lieu, prix) avant de la publier.</p>
  <p>Notre objectif : qu'en deux secondes, tu saches où sortir ce soir, que tu sois à Nice, Cannes, Monaco, Antibes ou ailleurs sur la Côte.</p>
  <ul class="chiffres">
    <li><strong>${esc(nb)}</strong><span>soirées à venir dans l'agenda</span></li>
    <li><strong>${esc(T.partenaires)}</strong><span>partenaires : clubs, organisateurs, collectifs, lieux</span></li>
    <li><strong>${esc(T.equipe.replace(/^une /, ''))}</strong><span>personnes dans l'équipe</span></li>
  </ul>
</section>
<section class="qui directeur">
  <div class="portrait">${T.photo_directeur ? `<img src="${base}${esc(T.photo_directeur)}" alt="${esc(T.directeur)}">` : `<span>${esc(initiales)}</span>`}</div>
  <div>
    <p class="etiquette">Le directeur</p>
    <h2>${esc(T.directeur)}</h2>
    <p>${esc(T.directeur_bio)}</p>
  </div>
</section>
<section class="qui">
  <h2>L'<em>équipe</em> et les partenaires</h2>
  <p>Teufy, c'est ${esc(T.equipe)} : repérage des soirées, vérification des infos, création des visuels et des vidéos, relation avec les organisateurs. Et un réseau de ${esc(T.partenaires)} partenaires sur la Côte d'Azur (clubs, beach clubs, bars, organisateurs, collectifs et artistes) avec qui nous travaillons au quotidien.</p>
  <p>Tu organises des soirées, tu gères un lieu ou tu es artiste ? Rejoins les partenaires Teufy : <a class="lien" href="https://ig.me/m/${esc(handle)}" target="_blank" rel="noopener">écris-nous sur Instagram</a>.</p>
</section>
${blocPartenaires(T, base)}
${blocOrga(handle, base)}`;
  return gabarit({ titre: "Qui sommes-nous · Teufy, le guide des soirées de la Côte d'Azur", description: `Teufy réunit toutes les soirées de la Côte d'Azur. Dirigé par ${T.directeur}, une équipe de ${T.equipe.replace(/^une /, '')} personnes et ${T.partenaires} partenaires de Nice à Monaco.`, chemin: 'a-propos/', base, corps, compte, ld: ldOrganisation(T, compte), image: 'site/img/selfie.jpg' });
}
