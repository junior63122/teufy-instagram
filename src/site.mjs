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
  await writeFile(path.join(ROOT, 'index.html'), page({ soirees, posts, now, compte: config.compte || '@teufy_official' }));
  await writeFile(path.join(ROOT, '.nojekyll'), '');
  log(`Site : ${soirees.length} soirée(s), ${soirees.filter((s) => s.affiche).length} avec affiche, ${posts.length} post(s) Instagram → index.html`);
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

function carte(s, vedette = false) {
  const date = paris(s.debut, { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
  const heureTxt = paris(s.debut, { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  const prix = prixTexte(s.prix);
  return `<article class="carte${vedette ? ' vedette' : ''}" data-jour="${s.jour}" data-ville="${s.filtreVille}" data-styles="${s.styles.join(' ')}" data-prix="${s.prix ?? ''}">
  <div class="affiche${s.affiche ? '' : ' sans'}">${s.affiche ? `<img src="${s.affiche}" alt="Affiche : ${esc(s.nom)}" loading="lazy" decoding="async">` : `<img src="site/img/${PHOTOS[parseInt(h(s.nom), 16) % PHOTOS.length]}.jpg" alt="" loading="lazy" decoding="async">`}<span class="date">${esc(date)}</span></div>
  <div class="infos">
    ${s.genres ? `<p class="genre">${esc(s.genres)}</p>` : ''}
    <h3>${esc(s.nom)}</h3>
    ${s.accroche ? `<p class="accroche">${esc(s.accroche)}</p>` : ''}
    <p class="meta"><span>${esc(heureTxt)}</span>${prix ? `<span>${esc(prix)}</span>` : ''}<span>${esc([s.lieu, s.ville].filter(Boolean).join(', '))}</span></p>
    <p class="actions">${s.url ? `<a class="bouton" href="${esc(s.url)}" target="_blank" rel="noopener">Billets</a>` : ''}${s.instagram ? `<a class="lien" href="https://www.instagram.com/${esc(s.instagram)}/" target="_blank" rel="noopener">@${esc(s.instagram)}</a>` : ''}</p>
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

function page({ soirees, posts, now, compte }) {
  const parJour = {};
  for (const s of soirees) (parJour[s.jour] ||= []).push(s);
  const semaine = soirees.filter((s) => Date.parse(s.debut) < now.getTime() + 8 * 864e5);
  const vedette = [...semaine].filter((s) => s.affiche && (s.buzz ?? 0) >= 0.7).sort((a, b) => b.buzz - a.buzz)[0];
  const maj = paris(now, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const handle = compte.replace(/^@/, '');
  const jours = Object.entries(parJour).map(([jour, l]) => {
    const titre = paris(`${jour}T12:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' });
    return `<section class="jour" data-jour="${jour}"><h2>${esc(titre.charAt(0).toUpperCase() + titre.slice(1))}</h2><div class="grille">${l.map((s) => carte(s)).join('\n')}</div></section>`;
  }).join('\n');
  const description = `Les soirées vérifiées de la Côte d'Azur (Nice, Cannes, Monaco, Antibes) : agenda mis à jour chaque jour par Teufy. ${soirees.length} soirées à venir.`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Teufy · Où sortir ce soir sur la Côte d'Azur</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${URL_SITE}">
<meta property="og:title" content="Teufy · Où sortir sur la Côte d'Azur">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${URL_SITE}site/img/danse.jpg">
<meta property="og:type" content="website">
<meta name="theme-color" content="#0B0B0F">
<link rel="icon" href="site/img/logo.png">
<link rel="stylesheet" href="site/style.css">
<script type="application/ld+json">${JSON.stringify(jsonld(soirees)).replace(/</g, '\\u003c')}</script>
</head>
<body>
<header class="barre">
  <a class="marque" href="./"><img src="site/img/logo.png" alt="Teufy"><span>Teufy</span></a>
  <a class="bouton petit" href="https://www.instagram.com/${esc(handle)}/" target="_blank" rel="noopener">Suivre sur Instagram</a>
</header>

<section class="hero">
  <img src="site/img/danse.jpg" alt="" class="hero-photo">
  <div class="hero-texte">
    <p class="etiquette">Agenda · Côte d'Azur</p>
    <h1>Où sortir sur la <em>Côte</em> ?</h1>
    <p>${soirees.length} soirées vérifiées de Nice à Monaco, mises à jour chaque jour. Affiches officielles, horaires, prix et billetterie.</p>
    <a class="bouton" href="#agenda">Voir l'agenda</a>
  </div>
</section>

${vedette ? `<section class="la-plus"><p class="etiquette">🔥 La plus attendue cette semaine</p>${carte(vedette, true)}</section>` : ''}

<section id="agenda" class="agenda">
  <div class="filtres" role="toolbar" aria-label="Filtres">
    <div class="groupe" data-filtre="quand">
      <button class="actif" data-v="tout">Tout</button><button data-v="soir">Ce soir</button><button data-v="weekend">Ce week-end</button><button data-v="semaine">7 jours</button>
    </div>
    <div class="groupe" data-filtre="ville">
      <button class="actif" data-v="tout">Partout</button>${VILLES.map((v) => `<button data-v="${v.toLowerCase()}">${v}</button>`).join('')}<button data-v="autres">Ailleurs</button>
    </div>
    <div class="groupe" data-filtre="style">
      <button class="actif" data-v="tout">Tous les sons</button><button data-v="techno">Techno</button><button data-v="house">House</button><button data-v="afro">Afro · Latino</button><button data-v="rap">Rap · RnB</button><button data-v="commercial">Commercial</button>
    </div>
    <div class="groupe" data-filtre="prix">
      <button class="actif" data-v="tout">Tous les prix</button><button data-v="gratuit">Gratuit</button><button data-v="10">Moins de 10 €</button>
    </div>
  </div>
  ${jours || '<p class="vide">Pas encore de soirée vérifiée pour les prochains jours : reviens demain.</p>'}
  <p class="vide" id="aucune" hidden>Aucune soirée ne correspond à ces filtres.</p>
</section>

${posts.length ? `<section class="insta"><h2>Sur Instagram</h2><div class="posts">${posts.map((p) => `<a href="${esc(p.lien)}" target="_blank" rel="noopener"><img src="${esc(p.image)}" alt="${esc(p.titre)}" loading="lazy"></a>`).join('')}</div><a class="bouton" href="https://www.instagram.com/${esc(handle)}/" target="_blank" rel="noopener">${esc(compte)}</a></section>` : ''}

<section class="orga">
  <img src="site/img/foule.jpg" alt="" class="hero-photo">
  <div class="hero-texte">
    <p class="etiquette">Organisateurs</p>
    <h2>Ta soirée sur <em>Teufy</em></h2>
    <p>Envoie-nous ton affiche, la date et le lien de billetterie en message sur Instagram : si elle plaît aux 17-30 ans de la Côte, on la met en avant.</p>
    <a class="bouton" href="https://ig.me/m/${esc(handle)}" target="_blank" rel="noopener">Écrire à Teufy</a>
  </div>
</section>

<footer>
  <p><strong>Teufy</strong> · Les soirées de la Côte d'Azur</p>
  <p>Mis à jour le ${esc(maj)}. Les informations viennent des pages officielles des soirées : vérifie toujours sur la billetterie avant de sortir.</p>
</footer>
<script src="site/app.js" defer></script>
</body>
</html>
`;
}
