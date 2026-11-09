import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { extractEvents, dedupe, keyOf } from './extract.mjs';
import { fusionner } from './recherche.mjs';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export async function collectEvents(config, { root, debugDir, fixturesDir, webEvents = [] } = {}) {
  const all = [];
  const report = [];
  // Pages Eventbrite déjà lues : gardées 7 jours (contenus/eventbrite-pages.json) pour ne relire que les nouvelles.
  const FICHIER_EB = path.join(root || '.', 'contenus', 'eventbrite-pages.json');
  const ebCache = existsSync(FICHIER_EB) ? JSON.parse(await readFile(FICHIER_EB, 'utf8').catch(() => '{}')) : {};
  const vus = new Map(Object.entries(ebCache).filter(([, v]) => Date.now() - Date.parse(v.le) < 7 * 864e5).map(([k, v]) => [k, v.d]));
  const nouvelles = { n: 0 };
  for (const [source, urls] of Object.entries(config.sources)) {
    if (!Array.isArray(urls)) continue;
    for (const url of urls) {
      let html = '';
      try {
        html = fixturesDir ? await readFixture(fixturesDir, source, url) : await fetchHtml(url);
      } catch (err) {
        report.push({ source, url, erreur: String(err.message || err) });
        continue;
      }
      if (debugDir) {
        await mkdir(debugDir, { recursive: true });
        await writeFile(path.join(debugDir, `${source}-${slug(url)}.html`), html);
      }
      let evs = source === 'bizouk' && !fixturesDir ? await soireesBizouk(html) : extractEvents(html, { source, baseUrl: url });
      if (source === 'eventbrite' && !fixturesDir) evs = await heuresEventbrite(evs, vus, nouvelles);
      report.push({ source, url, evenements: evs.length });
      all.push(...evs);
    }
  }
  if (!fixturesDir && nouvelles.n) await writeFile(FICHIER_EB, JSON.stringify(Object.fromEntries([...vus].map(([k, d]) => [k, { le: ebCache[k]?.le || new Date().toISOString(), d }])), null, 1) + '\n').catch(() => {});
  if (webEvents.length || !fixturesDir) report.push({ source: 'web', evenements: webEvents.length });
  all.push(...webEvents);
  const manual = await readManual(root);
  report.push({ source: 'manuel', evenements: manual.length });
  all.push(...manual);
  // Doublons exacts, puis la même soirée vue sur plusieurs sources (même nuit + même lieu ou nom proche).
  return { events: fusionner(dedupe(all)), report };
}

async function fetchHtml(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA, 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8', accept: 'text/html,application/xhtml+xml' },
        redirect: 'follow',
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        // Page de vérification anti-robot (Vercel, Cloudflare…) : inutile d'insister, et on ne la contourne pas.
        if (/Security Checkpoint|cf-chl|challenge-platform|captcha/i.test(txt)) { const e = new Error(`bloqué par une vérification anti-robot (HTTP ${res.status})`); e.definitif = true; throw e; }
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.text();
    } catch (err) {
      last = err;
      if (err.definitif) break;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw last;
}

async function readFixture(dir, source, url) {
  const f = path.join(dir, `${source}-${slug(url)}.html`);
  if (!existsSync(f)) throw new Error('pas de fixture');
  return readFile(f, 'utf8');
}

async function readManual(root) {
  const f = path.join(root, 'evenements-manuels.json');
  if (!existsSync(f)) return [];
  const list = JSON.parse(await readFile(f, 'utf8'));
  return list.filter((e) => e.name && e.start).map((e) => ({
    source: 'teufy', venue: '', city: '', address: '', url: '', image: '', price: null, end: null, ...e,
    start: new Date(e.start).toISOString(), manuel: true,
  }));
}

function slug(url) { return url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 80); }

// --- filtres ---------------------------------------------------------------

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'").replace(/\s+/g, '-');

export function isCoteAzur(e, villes) {
  const lieu = norm([e.city, e.address].join(' '));
  if (!lieu.replace(/-/g, '')) return true; // page « ville » sans précision : on garde
  if (/\b0?6\d{3}\b|\b83\d{3}\b|98000/.test(lieu)) return true; // codes postaux 06, 83, Monaco
  return villes.some((v) => lieu.includes(norm(v)));
}

export function filterEvents(events, { from, to, villes }) {
  return events
    .filter((e) => { const t = Date.parse(e.start); return t >= from.getTime() && t < to.getTime(); })
    .filter((e) => isCoteAzur(e, villes))
    .sort((a, b) => score(b) - score(a) || a.start.localeCompare(b.start));
}

// Classement : événements Teufy d'abord, puis ceux avec visuel, lieu et lien.
function score(e) {
  return (e.manuel ? 100 : 0) + (e.mise_en_avant ? 50 : 0) + (e.image ? 10 : 0) + (e.venue ? 4 : 0) + (e.url ? 2 : 0) + (e.sources ? 3 : 0);
}

// Complète les soirées retenues (affiche, style, description, prix) en lisant leur page de détail.
export async function enrich(events, { max = 25, debugDir } = {}) {
  let n = 0;
  for (const e of events) {
    if (n >= max) break;
    if (!e.url || e.enrichi || (e.source !== 'web' && e.image && e.tags?.length && e.price != null)) continue;
    n++;
    e.enrichi = true;
    try {
      const html = await fetchHtml(e.url, 2);
      if (debugDir) { await mkdir(debugDir, { recursive: true }); await writeFile(path.join(debugDir, `detail-${slug(e.url)}.html`), html); }
      const found = extractEvents(html, { source: e.source, baseUrl: e.url });
      const m = found.find((x) => keyOf(x) === keyOf(e)) || found.find((x) => x.start.slice(0, 10) === e.start.slice(0, 10)) || found[0];
      // Vérification : le nom de la soirée figure sur sa page, et la date annoncée concorde.
      const txt = norm(html);
      const mots = norm(e.name).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
      e.verifie = mots.length > 0 && mots.filter((w) => txt.includes(w)).length / mots.length >= 0.6;
      // Même soirée sur la page mais à une autre date (écart de plus de 30 h) : info douteuse.
      const memeNom = m && m.name && norm(m.name).includes(norm(e.name).slice(0, 12));
      if (memeNom && Math.abs(Date.parse(m.start) - Date.parse(e.start)) > 30 * 3600e3) e.douteux = true;
      if (m) {
        for (const f of ['image', 'venue', 'city', 'address', 'description', 'popularite']) if (!e[f] && m[f]) e[f] = m[f];
        if (e.price == null && m.price != null) e.price = m.price;
        if (m.tags?.length) e.tags = [...new Set([...(e.tags || []), ...m.tags])];
      }
      // Pas d'affiche dans les données : image de partage de la page (og:image), souvent l'affiche.
      if (!e.image) {
        const og = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]*content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i);
        if (og && /^https?:\/\//.test(og[1]) && !/logo|favicon|default/i.test(og[1])) e.image = og[1].replace(/&amp;/g, '&');
      }
    } catch { /* page indisponible : on garde ce qu'on a */ }
  }
  return events;
}

// Eventbrite : les listes ne donnent que la date (sans heure). On lit la page de chaque soirée (40 au plus par
// passage, requêtes espacées) pour l'heure exacte, le prix et la grande image. Sans heure fiable, la soirée est
// écartée plutôt qu'affichée avec une heure inventée (elle sera retentée au passage suivant).
async function heuresEventbrite(evs, vus, nouvelles = { n: 0 }) {
  const sortie = [];
  for (const e of evs) {
    if (!/T00:00:00(\.000)?Z$/.test(e.start || '')) { sortie.push(e); continue; }
    let d = vus.get(e.url);
    if (d === undefined) {
      if (!e.url || nouvelles.n >= 40) continue;
      nouvelles.n++;
      d = null;
      try {
        await new Promise((r) => setTimeout(r, 1200));
        const detail = extractEvents(await fetchHtml(e.url, 2), { source: 'eventbrite', baseUrl: e.url });
        d = detail.find((x) => x.start && !/T00:00:00(\.000)?Z$/.test(x.start)) || null;
      } catch { d = null; }
      vus.set(e.url, d);
    }
    if (d) sortie.push({ ...e, start: d.start, end: d.end || e.end, price: d.price ?? e.price, image: d.image || e.image, venue: e.venue || d.venue, city: e.city || d.city, address: e.address || d.address });
  }
  return sortie;
}

// Bizouk (soirées afro, zouk, shatta, kompa…) : pas de page par ville. La page d'accueil liste les soirées avec leur
// ville (« Clubbing · Nice ») ; on garde celles de la Côte d'Azur, de Monaco et du Var, puis on lit leur page
// (données structurées de l'événement : date et heure, lieu, prix, image).
const VILLES_COTE = /\b(nice|cannes|antibes|juan|monaco|monte.?carlo|menton|cagnes|saint.?laurent.?du.?var|villeneuve.?loubet|grasse|mougins|le cannet|mandelieu|vallauris|golfe.?juan|beausoleil|villefranche|toulon|la seyne|hy[eè]res|six.?fours|sanary|bandol|fr[ée]jus|saint.?rapha[eë]l|sainte.?maxime|saint.?tropez|draguignan|puget|brignoles|la valette|la garde)\b/i;
async function soireesBizouk(html) {
  const liens = new Map();
  for (const m of html.matchAll(/<div class="[^"]*kicker[^"]*">([^<]*)<\/div>\s*<a[^>]+href="(https:\/\/www\.bizouk\.com\/events\/details\/[^"]+)"/g)) {
    const ville = (m[1].split('·').pop() || '').trim();
    if (VILLES_COTE.test(ville)) liens.set(m[2], ville);
  }
  // Repli : toute fiche dont le texte voisin cite une ville de la Côte.
  for (const m of html.matchAll(/href="(https:\/\/www\.bizouk\.com\/events\/details\/[^"]+)"/g)) {
    if (liens.has(m[1])) continue;
    const autour = html.slice(Math.max(0, m.index - 600), m.index + 400).replace(/<[^>]+>/g, ' ');
    if (VILLES_COTE.test(autour)) liens.set(m[1], '');
  }
  const evs = [];
  for (const u of [...liens.keys()].slice(0, 30)) {
    try {
      await new Promise((r) => setTimeout(r, 1200));
      const e = extractEvents(await fetchHtml(u, 2), { source: 'bizouk', baseUrl: u })[0];
      if (e && VILLES_COTE.test(`${e.city} ${e.address} ${e.venue}`)) evs.push({ ...e, url: e.url || u });
    } catch { /* fiche illisible : ignorée */ }
  }
  return evs;
}

// Pages de billetterie d'une autre région (Occitanie : rubrique du site seulement, jamais sur Instagram).
// Même lecture que pour la Côte d'Azur (JSON-LD, heure réelle lue sur la page Eventbrite), sans les soirées manuelles.
export async function lirePagesSources(sources = {}, { log = console.log } = {}) {
  const all = [], vus = new Map(), nouvelles = { n: 0 };
  for (const [source, urls] of Object.entries(sources)) {
    if (!Array.isArray(urls)) continue;
    for (const url of urls) {
      try {
        let evs = extractEvents(await fetchHtml(url, 2), { source, baseUrl: url });
        if (source === 'eventbrite') evs = await heuresEventbrite(evs, vus, nouvelles);
        all.push(...evs);
      } catch (err) { log(`  ${source} ${url} : ${err.message}`); }
    }
  }
  return dedupe(all);
}
