#!/usr/bin/env node
// Place sur la carte les lieux des soirées (adresse → Base Adresse Nationale / OpenStreetMap) et cherche les transports
// et parkings autour (Overpass), sans construire tout le site. Résultats : contenus/lieux-geo.json et lieux-proches.json,
// réutilisés par la construction du site. Lancé par le workflow « Teufy - Site seulement ».
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geocoder, aProximite } from '../src/site.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f, d) => { try { return JSON.parse(readFileSync(path.join(ROOT, f), 'utf8')); } catch { return d; } };
const sources = [...(lire('evenements-manuels.json', [])), ...(lire('evenements-web.json', {}).evenements || [])];
const vus = new Set(), soirees = [];
for (const e of sources) {
  const s = { lieu: e.venue || '', ville: e.city || '', adresse: e.address || '', nom: e.name || '' };
  const k = `${s.lieu}|${s.ville}`.toLowerCase();
  if (!s.lieu || vus.has(k)) continue;
  vus.add(k); soirees.push(s);
}
for (const l of lire('contenus/lieux-manuels.json', { lieux: [] }).lieux || []) soirees.push({ lieu: l.nom, ville: l.ville, adresse: l.adresse || '', nom: l.nom });
console.log(`${soirees.length} lieu(x) à placer ou vérifier.`);
await geocoder(soirees, console.log);
await aProximite(soirees, console.log);
const g = soirees.filter((s) => !s.approx && s.lat);
console.log(`Placés précisément : ${g.length}/${soirees.length}. Green Musik : ${JSON.stringify(soirees.filter((s) => /green musik/i.test(s.lieu)).map((s) => [s.lieu, s.lat, s.lng, s.approx]))}`);
