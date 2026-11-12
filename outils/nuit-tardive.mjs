#!/usr/bin/env node
// « Où manger après la boîte » et « afters » — OpenStreetMap, gratuit, SANS IA (12/11/2026, demande du directeur :
// « où manger à 2 h du matin ou à 5 h du matin »).
// Snacks, kebabs, pizzerias, burgers, restaurants et boulangeries des villes de la Côte d'Azur, du Var et de Monaco dont
// les horaires PUBLIÉS sur OpenStreetMap montrent une ouverture après 2 h du matin ; clubs et bars ouverts après 5 h
// (afters). Horaires incompréhensibles (jours fériés, mois…) → lieu ignoré : rien n'est deviné.
// Résultat : contenus/nuit-tardive.json (lu par le site : pages « Manger tard » et « After », bloc « Ta nuit complète »).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireOSM, fermeturesDeNuit, texteHorairesSoir } from '../src/horaires-osm.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const F = path.join(ROOT, 'contenus', 'nuit-tardive.json');
const SERVEURS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
// Centres des villes (la ville d'un lieu = adresse publiée, sinon la ville la plus proche à moins de 7 km).
export const VILLES = { Nice: [43.7031, 7.2661], Cannes: [43.5513, 7.0128], Antibes: [43.5808, 7.1239], 'Juan-les-Pins': [43.5682, 7.1094], Monaco: [43.7384, 7.4246],
  Menton: [43.7764, 7.5048], 'Cagnes-sur-Mer': [43.6644, 7.1489], 'Saint-Laurent-du-Var': [43.6730, 7.1900], 'Villefranche-sur-Mer': [43.7040, 7.3110], 'Le Cannet': [43.5769, 7.0194],
  'Mandelieu-la-Napoule': [43.5466, 6.9380], Vallauris: [43.5780, 7.0540], Grasse: [43.6589, 6.9224], Beausoleil: [43.7430, 7.4230], 'Fréjus': [43.4330, 6.7370],
  'Saint-Raphaël': [43.4250, 6.7680], 'Saint-Tropez': [43.2727, 6.6406], 'Sainte-Maxime': [43.3090, 6.6350], Toulon: [43.1242, 5.9280], 'La Seyne-sur-Mer': [43.1007, 5.8788],
  'Hyères': [43.1204, 6.1286], 'Six-Fours-les-Plages': [43.0940, 5.8390], 'Sanary-sur-Mer': [43.1190, 5.8010], Bandol: [43.1360, 5.7530], Draguignan: [43.5366, 6.4646] };
// Zone rectangulaire Var + Alpes-Maritimes + Monaco (une requête légère : les découpages par commune faisaient tomber les serveurs).
const REQUETE = `[out:json][timeout:170][bbox:42.98,5.70,43.95,7.55];
(
  nwr["amenity"~"^(fast_food|restaurant|cafe|nightclub|bar|pub)$"]["opening_hours"]["name"];
  nwr["shop"="bakery"]["opening_hours"]["name"];
);
out tags center;`;
const dist = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos(a * Math.PI / 180));
const villeDe = (t, lat, lng) => {
  const c = String(t['addr:city'] || '').trim();
  if (c) return c;
  if (lat == null) return '';
  let best = '', d0 = 7;
  for (const [v, [a, b]] of Object.entries(VILLES)) { const d = dist(lat, lng, a, b); if (d < d0) { d0 = d; best = v; } }
  return best;
};

const TYPE = (t) => {
  const c = String(t.cuisine || '').toLowerCase();
  if (t.amenity === 'nightclub') return 'Club';
  if (['bar', 'pub'].includes(t.amenity)) return 'Bar';
  if (t.shop === 'bakery') return 'Boulangerie';
  if (/kebab|doner|tacos/.test(c)) return 'Kebab';
  if (/pizza/.test(c)) return 'Pizzeria';
  if (/burger/.test(c)) return 'Burger';
  if (/sandwich|crepe|snack/.test(c) || t.amenity === 'fast_food') return 'Snack';
  if (t.amenity === 'cafe') return 'Café';
  return 'Restaurant';
};
const adresse = (t) => [[t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '), [t['addr:postcode'], t['addr:city']].filter(Boolean).join(' ')].filter(Boolean).join(', ');
const slug = (x) => String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const insta = (t) => { const v = String(t['contact:instagram'] || t.instagram || '').split(';')[0].trim(); const m = v.match(/instagram\.com\/([A-Za-z0-9._]{2,30})/) || v.match(/^@?([A-Za-z0-9._]{2,30})$/); return m ? m[1].toLowerCase() : ''; };
const site = (t) => { const s = String(t.website || t['contact:website'] || '').split(';')[0].trim(); return /^https?:\/\//.test(s) ? s : ''; };

/** Réponse Overpass → lieux ouverts tard (manger après 2 h, afters après 5 h). */
export function lieuxTardifs(json) {
  const out = [], vus = new Set();
  for (const el of json?.elements || []) {
    const t = el.tags || {};
    const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon;
    const ville = villeDe(t, lat, lng);
    if (!ville) continue;
    if (!t.name || t.disused || /^(no|closed|off)$/i.test(t.opening_hours)) continue;
    const plages = lireOSM(t.opening_hours);
    if (!plages) continue;
    const f = fermeturesDeNuit(plages);
    const max = Math.max(...Object.values(f));
    const categorie = TYPE(t);
    const nuit = ['Club', 'Bar'].includes(categorie);
    // Manger : ouvert après 2 h (et pas une simple fermeture à 2 h pile d'un restaurant) ; after : après 5 h.
    const type = nuit ? (max >= 300 && max < 1440 ? 'after' : null) : (max > 120 ? 'manger-tard' : null);
    if (!type) continue;
    const cle = `${slug(t.name)}|${slug(ville)}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push({ nom: t.name, type, categorie, ville, adresse: adresse(t), horaires: texteHorairesSoir(plages), fermetures: f,
      lat, lng, instagram: insta(t), site: site(t),
      source: `https://www.openstreetmap.org/${el.type}/${el.id}`, slug: slug(`${t.name}-${ville}`) });
  }
  return out;
}

async function main() {
  for (const url of SERVEURS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'TeufyBot/1.0 (+https://teufyparty.com)' }, body: `data=${encodeURIComponent(REQUETE)}`, signal: AbortSignal.timeout(200000) });
      if (!r.ok) { console.log(`OpenStreetMap : ${url} a répondu ${r.status}`); continue; }
      const lieux = lieuxTardifs(await r.json());
      if (!lieux.length) { console.log('OpenStreetMap : aucun lieu ouvert tard trouvé, fichier inchangé.'); return; }
      writeFileSync(F, `${JSON.stringify({ maj: new Date().toISOString(), source: 'OpenStreetMap (ODbL)', lieux }, null, 1)}\n`);
      console.log(`Nuit tardive : ${lieux.filter((l) => l.type === 'manger-tard').length} endroit(s) où manger après 2 h, ${lieux.filter((l) => l.type === 'after').length} after(s), horaires OpenStreetMap.`);
      return;
    } catch (err) { console.log(`OpenStreetMap : ${url} indisponible (${String(err.message).slice(0, 80)})`); }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
