import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { extractEvents, dedupe, keyOf } from './extract.mjs';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export async function collectEvents(config, { root, debugDir, fixturesDir } = {}) {
  const all = [];
  const report = [];
  for (const [source, urls] of Object.entries(config.sources)) {
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
      const evs = extractEvents(html, { source, baseUrl: url });
      report.push({ source, url, evenements: evs.length });
      all.push(...evs);
    }
  }
  const manual = await readManual(root);
  report.push({ source: 'manuel', evenements: manual.length });
  all.push(...manual);
  return { events: dedupe(all), report };
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      last = err;
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
    if (!e.url || e.enrichi || (e.image && e.tags?.length && e.price != null)) continue;
    n++;
    e.enrichi = true;
    try {
      const html = await fetchHtml(e.url, 2);
      if (debugDir) { await mkdir(debugDir, { recursive: true }); await writeFile(path.join(debugDir, `detail-${slug(e.url)}.html`), html); }
      const found = extractEvents(html, { source: e.source, baseUrl: e.url });
      const m = found.find((x) => keyOf(x) === keyOf(e)) || found.find((x) => x.start.slice(0, 10) === e.start.slice(0, 10)) || found[0];
      if (!m) continue;
      for (const f of ['image', 'venue', 'city', 'address', 'description', 'popularite']) if (!e[f] && m[f]) e[f] = m[f];
      if (e.price == null && m.price != null) e.price = m.price;
      if (m.tags?.length) e.tags = [...new Set([...(e.tags || []), ...m.tags])];
    } catch { /* page indisponible : on garde ce qu'on a */ }
  }
  return events;
}
