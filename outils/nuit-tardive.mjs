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
const SERVEURS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
export const VILLES = ['Nice', 'Cannes', 'Antibes', 'Menton', 'Cagnes-sur-Mer', 'Saint-Laurent-du-Var', 'Villefranche-sur-Mer', 'Le Cannet',
  'Mandelieu-la-Napoule', 'Vallauris', 'Grasse', 'Beausoleil', 'Fréjus', 'Saint-Raphaël', 'Saint-Tropez', 'Sainte-Maxime', 'Toulon',
  'La Seyne-sur-Mer', 'Hyères', 'Six-Fours-les-Plages', 'Sanary-sur-Mer', 'Bandol', 'Draguignan'];
const REQUETE = `[out:json][timeout:240];
area["ISO3166-2"~"^FR-(06|83)$"]->.dep;
(rel(area.dep)["boundary"="administrative"]["admin_level"="8"]["name"~"^(${VILLES.join('|')})$"]; rel["ISO3166-1"="MC"]["admin_level"="2"];)->.r;
.r map_to_area->.villes;
foreach.villes->.v(
  .v out tags;
  nwr(area.v)["amenity"~"^(fast_food|restaurant|cafe|nightclub|bar|pub)$"]["opening_hours"]["name"];
  out tags center;
  nwr(area.v)["shop"="bakery"]["opening_hours"]["name"];
  out tags center;
);`;

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
  let ville = '';
  for (const el of json?.elements || []) {
    if (el.type === 'area') { ville = el.tags?.name === 'Monaco' || el.tags?.['ISO3166-1'] === 'MC' ? 'Monaco' : el.tags?.name || ''; continue; }
    const t = el.tags || {};
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
      lat: el.lat ?? el.center?.lat, lng: el.lon ?? el.center?.lon, instagram: insta(t), site: site(t),
      source: `https://www.openstreetmap.org/${el.type}/${el.id}`, slug: slug(`${t.name}-${ville}`) });
  }
  return out;
}

async function main() {
  for (const url of SERVEURS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'TeufyBot/1.0 (+https://teufyparty.com)' }, body: `data=${encodeURIComponent(REQUETE)}`, signal: AbortSignal.timeout(260000) });
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
