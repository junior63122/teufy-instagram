// Sites officiels des clubs et bars (20/11/2026, directeur : « tu as les sites web des différentes boîtes de nuit aussi ») :
// lus directement, sans IA. On garde les soirées publiées en données structurées (schema.org Event, JSON des pages),
// sur la page d'accueil et les pages « agenda / événements » du même site. Résultat gardé 12 h (contenus/sites-clubs.json).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { extractEvents } from './extract.mjs';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const LIENS_AGENDA = /\/(agenda|events?|evenements?|soirees?|programmation|programme|billetterie|calendar|calendrier|whats-on|line-?up)(\/|$|\?|#)/i;

// Liens « agenda » d'une page, sur le même site (au plus n, les plus courts d'abord : la liste avant les fiches).
export function liensAgenda(html, base, n = 4) {
  let hote; try { hote = new URL(base).hostname.replace(/^www\./, ''); } catch { return []; }
  const out = new Set();
  for (const m of String(html).matchAll(/href=["']([^"'#]+)["']/gi)) {
    let u; try { u = new URL(m[1], base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol) || u.hostname.replace(/^www\./, '') !== hote || !LIENS_AGENDA.test(u.pathname)) continue;
    out.add(`${u.origin}${u.pathname}`);
  }
  return [...out].sort((a, b) => a.length - b.length).slice(0, n);
}

// Soirées d'un lieu lues sur ses pages : lieu et ville du club quand la page ne les donne pas.
export function soireesDuLieu(pages, lieu, now = new Date()) {
  const vus = new Set(), out = [];
  for (const { html, url } of pages) {
    for (const e of extractEvents(html, { source: 'site-club', baseUrl: url })) {
      const t = Date.parse(e.start);
      if (!(t > now.getTime() - 6 * 3600e3 && t < now.getTime() + 60 * 864e5)) continue;
      const cle = `${e.name}|${e.start.slice(0, 10)}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      out.push({ ...e, venue: e.venue || lieu.nom, city: e.city || lieu.ville || '', url: e.url || url, source_site: new URL(url).hostname.replace(/^www\./, ''), instagram: lieu.instagram ? [lieu.instagram] : [], confiance: 0.9 });
    }
  }
  return out;
}

async function page(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'fr-FR,fr;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.text()).slice(0, 3e6);
}

export async function lireSitesClubs({ root, now = new Date(), log = console.log, heures = 12, minutes = 4 } = {}) {
  const F = path.join(root, 'contenus', 'sites-clubs.json');
  const cache = existsSync(F) ? JSON.parse(readFileSync(F, 'utf8')) : { maj: null, evenements: [], sites: {} };
  if (cache.maj && now - Date.parse(cache.maj) < heures * 3600e3) return cache.evenements.filter((e) => Date.parse(e.start) > now.getTime() - 6 * 3600e3);
  const lire = (f) => { try { return JSON.parse(readFileSync(path.join(root, 'contenus', f), 'utf8')); } catch { return {}; } };
  const lieux = [...(lire('lieux-nuit.json').lieux || []), ...(lire('lieux-manuels.json').lieux || [])].filter((l) => /^https?:\/\//.test(l.site || '') && !l.retirer);
  const uniques = [...new Map(lieux.map((l) => [l.site.replace(/\/+$/, ''), l])).values()];
  const fin = Date.now() + minutes * 60e3, evenements = [], sites = {};
  let i = 0;
  const travail = async () => {
    while (i < uniques.length && Date.now() < fin) {
      const l = uniques[i++];
      try {
        const accueil = await page(l.site);
        const pages = [{ html: accueil, url: l.site }];
        for (const u of liensAgenda(accueil, l.site)) { if (Date.now() > fin) break; try { pages.push({ html: await page(u), url: u }); } catch {} }
        const ev = soireesDuLieu(pages, l, now);
        sites[l.site] = { lieu: l.nom, pages: pages.length, soirees: ev.length };
        evenements.push(...ev);
      } catch (err) { sites[l.site] = { lieu: l.nom, erreur: String(err.message || err).slice(0, 80) }; }
    }
  };
  await Promise.all(Array.from({ length: 6 }, travail));
  const lus = Object.values(sites).filter((s) => !s.erreur).length;
  log(`Sites des clubs : ${lus}/${uniques.length} site(s) lu(s), ${evenements.length} soirée(s) trouvée(s).`);
  if (!lus) return cache.evenements.filter((e) => Date.parse(e.start) > now.getTime() - 6 * 3600e3); // réseau en panne : on garde l'ancien relevé
  writeFileSync(F, `${JSON.stringify({ maj: now.toISOString(), evenements, sites }, null, 1)}\n`);
  return evenements;
}
