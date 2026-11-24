import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { extractEvents, dedupe, keyOf } from './extract.mjs';
import { fusionner, villeOccitanie, citeVille, VILLES_FRANCE } from './recherche.mjs';
import { dateParis } from './dates.mjs';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export async function collectEvents(config, { root, debugDir, fixturesDir, webEvents = [] } = {}) {
  const all = [];
  const report = [];
  // Pages Eventbrite déjà lues : gardées 7 jours (contenus/eventbrite-pages.json) pour ne relire que les nouvelles.
  const FICHIER_EB = path.join(root || '.', 'contenus', 'eventbrite-pages.json');
  const ebCache = existsSync(FICHIER_EB) ? JSON.parse(await readFile(FICHIER_EB, 'utf8').catch(() => '{}')) : {};
  const vus = new Map(Object.entries(ebCache).filter(([, v]) => Date.now() - Date.parse(v.le) < 7 * 864e5).map(([k, v]) => [k, v.d]));
  const nouvelles = { n: 0 };
  // Billetteries lues toutes les 6 h au plus, 4 à la fois (20/11/2026 : une vingtaine de sources, une billetterie lente ne
  // doit jamais retarder les publications) ; entre deux lectures, le dernier relevé (contenus/billetteries.json).
  const FICHIER_BIL = path.join(root || '.', 'contenus', 'billetteries.json');
  const bil = !fixturesDir && existsSync(FICHIER_BIL) ? JSON.parse(await readFile(FICHIER_BIL, 'utf8').catch(() => '{}')) : {};
  const frais = !fixturesDir && bil.maj && Date.now() - Date.parse(bil.maj) < 6 * 3600e3;
  if (frais) {
    const evs = (bil.evenements || []).filter((e) => Date.parse(e.start) > Date.now() - 6 * 3600e3);
    report.push({ source: 'billetteries', evenements: evs.length, url: `(relevé du ${bil.maj.slice(11, 16)} UTC)` });
    all.push(...evs);
  } else {
    const taches = Object.entries(config.sources).filter(([, urls]) => Array.isArray(urls)).flatMap(([source, urls]) => urls.map((url) => ({ source, url })));
    const trouves = [];
    let i = 0;
    const travail = async () => {
      while (i < taches.length) {
        const { source, url } = taches[i++];
        let html = '';
        try {
          html = fixturesDir ? await readFixture(fixturesDir, source, url) : await fetchHtml(url, 2);
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
        trouves.push(...evs);
      }
    };
    await Promise.all(Array.from({ length: fixturesDir ? 1 : 4 }, travail));
    // Billetterie en panne ce passage-ci : ses soirées du relevé précédent sont gardées (avant : le relevé partiel était
    // enregistré comme frais et ses soirées disparaissaient du site et des posts pendant 6 h).
    const repris = fixturesDir ? [] : reprendreEnPanne(report, bil.evenements || [], Date.now());
    if (repris.length) report.push({ source: 'billetteries', evenements: repris.length, url: '(relevé précédent des billetteries en panne)' });
    trouves.push(...repris);
    all.push(...trouves);
    if (!fixturesDir && trouves.length) await writeFile(FICHIER_BIL, JSON.stringify({ maj: new Date().toISOString(), evenements: trouves, en_panne: [...new Set(report.filter((r) => r.erreur).map((r) => r.url))] }, null, 1) + '\n').catch(() => {});
  }
  if (!fixturesDir && nouvelles.n) await writeFile(FICHIER_EB, JSON.stringify(Object.fromEntries([...vus].map(([k, d]) => [k, { le: ebCache[k]?.le || new Date().toISOString(), d }])), null, 1) + '\n').catch(() => {});
  // API officielles (Eventbrite, Ticketmaster), 22/11/2026 : remplacent la lecture des pages bloquées. Sans clé : sautées.
  if (!fixturesDir && root) {
    try { const { lireApiBilletteries } = await import('./api-billetteries.mjs'); const r = await lireApiBilletteries({ root, villes: (e) => !!rubriqueDe(e) });
      report.push(...r.rapport); const { PAS_SOIREE } = await import('./recherche.mjs'); // règles du jour appliquées aussi au relevé gardé 6 h
      all.push(...r.evenements.filter((e) => rubriqueDe(e) === 'cote' && !PAS_SOIREE.test(`${e.name} ${e.description || ''}`))); }
    catch (err) { report.push({ source: 'api', erreur: String(err.message || err) }); }
  }
  // Agendas ouverts (DATAtourisme, OpenAgenda), relevés chaque matin par src/agendas.mjs : soirées de la Côte.
  if (!fixturesDir && root && existsSync(path.join(root, 'contenus', 'agendas.json'))) {
    try { const ag = JSON.parse(await readFile(path.join(root, 'contenus', 'agendas.json'), 'utf8'));
      const ev = (ag.evenements || []).filter((e) => rubriqueDe(e) === 'cote' && Date.parse(e.start) > Date.now() - 6 * 3600e3);
      report.push({ source: 'agendas', evenements: ev.length, url: `(relevé du ${String(ag.maj).slice(0, 10)})` }); all.push(...ev); }
    catch (err) { report.push({ source: 'agendas', erreur: String(err.message || err) }); }
  }
  if (webEvents.length || !fixturesDir) report.push({ source: 'web', evenements: webEvents.length });
  all.push(...webEvents);
  // Sites officiels des clubs et bars (sans IA, relevé gardé 12 h).
  if (!fixturesDir && root) {
    try { const { lireSitesClubs } = await import('./sites-clubs.mjs'); const ev = await lireSitesClubs({ root }); report.push({ source: 'clubs', evenements: ev.length }); all.push(...ev); }
    catch (err) { report.push({ source: 'clubs', erreur: String(err.message || err) }); }
  }
  const manual = await readManual(root);
  report.push({ source: 'manuel', evenements: manual.length });
  all.push(...manual);
  // Doublons exacts, puis la même soirée vue sur plusieurs sources (même nuit + même lieu ou nom proche).
  // 23/11/2026 (directeur, captures) : les pages Eventbrite mélangent tout ; webinaires et dégustations (journée, alcool mis
  // en avant) ne sont pas des soirées. Stand-up, blind tests, quiz restent (sorties du soir, en attente de l'avis du directeur).
  const garde = all.filter((e) => e.source !== 'eventbrite' || !HORS_SOIREE_EB.test(`${e.name} ${e.description || ''}`));
  const { nettoyerSoirees } = await import('./qualite-soirees.mjs');
  return { events: nettoyerSoirees(fusionner(dedupe(garde)), { log: (m) => report.push({ source: 'qualite', evenements: 0, url: m.trim() }) }), report };
}

/** Soirées à venir du relevé précédent pour les sources dont au moins une page a échoué ce passage-ci. */
export function reprendreEnPanne(report, anciennes, now = Date.now()) {
  const enPanne = new Set(report.filter((r) => r.erreur && r.source).map((r) => r.source));
  return anciennes.filter((e) => enPanne.has(e.source) && Date.parse(e.start) > now - 6 * 3600e3);
}

async function fetchHtml(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA, 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8', accept: 'text/html,application/xhtml+xml' },
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
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
    start: dateParis(e.start).toISOString(), ...(e.end ? { end: dateParis(e.end).toISOString() } : {}), manuel: true,
  }));
}

function slug(url) { return url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 80); }

// --- filtres ---------------------------------------------------------------

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'").replace(/\s+/g, '-');

// Zone du site (Côte d'Azur, Monaco et Var), au-delà des villes des posts (20/11/2026 : des soirées de Monaca aux
// États-Unis, de Marseille et de Vars apparaissaient dans « Le même soir »).
export const VILLES_SITE = ['toulon', 'seyne', 'la-garde', 'farlede', 'valette', 'hyeres', 'six-fours', 'sanary', 'bandol', 'ollioules', 'pradet', 'carqueiranne', 'la-crau', 'cuers', 'sollies', 'draguignan', 'puget', 'roquebrune', 'lavandou', 'bormes', 'londe', 'mandrier', 'cogolin', 'gassin', 'grimaud', 'brignoles', 'maximin', 'le-luc', 'le-muy', 'les-arcs', 'isola', 'auron', 'valberg', 'tende', 'vesubie', 'beausoleil', 'turbie', 'tourrette', 'tourette', 'opio', 'roquefort', 'rouret', 'chateauneuf', 'peymeinade', 'cezaire', 'fayence', 'aygulf', 'agay', 'saint-jeannet', 'gattieres', 'levens', 'contes', 'drap', 'trinite', 'falicon', 'mouans', 'pegomas', 'tanneron', 'la-gaude'];
export const dansZoneSite = (e, villes = []) => isCoteAzur(e, [...villes, ...VILLES_SITE]);
const HORS_SOIREE_EB = /webinar|webinaire|d[ée]gustation|tasting|wines? (?:&|and) (?:\w+ )?(?:cheese|charcuterie)/i;
const EN_LIGNE = /webinar|webinaire|\ben ligne\b|\bonline\b|\bvirtual\b|\bvirtuel(le)?\b|livestream/i;
export function isCoteAzur(e, villes) {
  const lieu = norm([e.city, e.address].join(' '));
  // 23/11/2026 : un événement en ligne (webinaire HBR sans lieu) passait pour une soirée de la Côte. Sans lieu, on ne
  // garde que ce qui vient d'une page « ville » d'une billetterie qui donne d'habitude le lieu, jamais Eventbrite (sans lieu = en ligne).
  if (EN_LIGNE.test(`${e.name || ''} ${e.venue || ''}`)) return false;
  if (!lieu.replace(/-/g, '')) return e.source !== 'eventbrite';
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
/** Rubrique du site d'une soirée (22/11/2026) : « cote » (Côte d'Azur, Monaco, Var), « occitanie », « france » (grandes villes), ou ''. */
export function rubriqueDe(e) {
  const t = `${e.city || ''} ${e.address || ''} ${e.venue || ''}`;
  if (VILLES_COTE.test(t)) return 'cote';
  if (villeOccitanie(e)) return 'occitanie';
  return VILLES_FRANCE.some((v) => citeVille(t, v)) ? 'france' : '';
}
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
