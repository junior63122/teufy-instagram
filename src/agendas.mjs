// Agendas ouverts (22/11/2026, directeur : « trouve d'autres moyens d'obtenir encore plus de soirées : des agendas intéressants »).
// Sources officielles et gratuites, sans IA, lues une fois par jour par le robot « Veille technique » :
// - DATAtourisme (base nationale des offices de tourisme, export quotidien des événements en CSV sur data.gouv.fr, sans clé) :
//   concerts, festivals, soirées, fêtes, marchés de Noël en soirée… dans nos villes ; idéal pour les touristes.
// - OpenAgenda (agendas officiels des villes et des salles, clé gratuite dans le secret OPENAGENDA_KEY).
// Seules les soirées sont gardées (mêmes règles que pour les billetteries), rangées par rubrique (Côte, Occitanie, France).
// Sortie : contenus/agendas.json, relu par src/sources.mjs (Côte) et src/run.mjs (France, Occitanie).
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const H = { 'user-agent': 'TeufyAgendas/1.0 (+https://teufyparty.com)' };

/** Découpe une ligne CSV (guillemets, séparateur « , » ou « ; »). */
export function ligneCsv(l, sep) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === sep) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur); return out;
}

/** Toutes les lignes d'un CSV, champs entre guillemets sur plusieurs lignes compris. */
export function* lignesCsv(texte, sep) {
  let champ = '', ligne = [], q = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (q) { if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; } else if (c === '"') q = false; else champ += c; continue; }
    if (c === '"') q = true; else if (c === sep) { ligne.push(champ); champ = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && texte[i + 1] === '\n') i++; ligne.push(champ); champ = ''; if (ligne.length > 1 || ligne[0]) yield ligne; ligne = []; }
    else champ += c;
  }
  if (champ || ligne.length) { ligne.push(champ); yield ligne; }
}

/** Colonnes reconnues d'après leur nom (le format exact de l'export peut changer : on cherche par mots). */
export function colonnes(entetes) {
  const n = entetes.map((h) => h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
  const trouve = (...re) => n.findIndex((h) => re.some((r) => r.test(h)));
  return { nom: trouve(/^nom/, /label/, /titre/, /^name/), debut: trouve(/date.*debut/, /debut/, /start/), fin: trouve(/date.*fin/, /^fin/, /end/),
    commune: trouve(/commune/, /ville/, /city/, /locality/), cp: trouve(/code.?postal/, /postal/), adresse: trouve(/adresse/, /address/, /street/),
    lieu: trouve(/lieu/, /etablissement/, /venue/), url: trouve(/url/, /site.?web/, /homepage/), image: trouve(/image/, /photo/, /illustration/),
    categories: trouve(/categor/, /type/, /theme/), description: trouve(/description/, /resume/) };
}

async function datatourisme({ garder, log }) {
  // Ressource « événements » du jeu de données DATAtourisme sur data.gouv.fr (adresse retrouvée chaque jour par l'API data.gouv).
  const ds = await (await fetch('https://www.data.gouv.fr/api/1/datasets/donnees-touristiques-de-la-base-datatourisme/', { headers: H, signal: AbortSignal.timeout(30000) })).json();
  const res = (ds.resources || []).filter((r) => /csv/i.test(r.format || r.url) && /v[eé]nement|event|fete|manifest/i.test(`${r.title} ${r.url}`));
  if (!res.length) throw new Error(`pas d'export « événements » en CSV (ressources : ${(ds.resources || []).map((r) => r.title).slice(0, 6).join(' | ')})`);
  const r = await fetch(res[0].url, { headers: H, signal: AbortSignal.timeout(300000) });
  if (!r.ok) throw new Error(`export HTTP ${r.status}`);
  // 23/11/2026 : l'export est compressé (gzip) même quand son nom finit par .csv : on regarde les premiers octets.
  let brut = Buffer.from(await r.arrayBuffer());
  if (brut[0] === 0x1f && brut[1] === 0x8b) brut = gunzipSync(brut);
  const texte = brut.toString('utf8').replace(/^\uFEFF/, '');
  const premiere = texte.slice(0, texte.indexOf('\n'));
  const sep = (premiere.match(/;/g) || []).length > (premiere.match(/,/g) || []).length ? ';' : ',';
  let C, n = 0; const sortie = [];
  for (const v of lignesCsv(texte, sep)) {
    if (!C) { C = colonnes(v); log(`  DATAtourisme : colonnes ${v.slice(0, 16).join(' | ')}`); continue; }
    n++;
    const g = (k) => (C[k] >= 0 ? (v[C[k]] || '').trim() : '');
    const e = { source: 'datatourisme', name: g('nom'), start: g('debut'), end: g('fin'), venue: g('lieu'), city: g('commune'), address: [g('adresse'), g('cp'), g('commune')].filter(Boolean).join(', '),
      url: g('url').split(/[\s|,]/)[0] || '', image: g('image').split(/[\s|,]/)[0] || '', price: null, tags: g('categories').split(/[|,;]/).map((x) => x.trim()).filter(Boolean).slice(0, 4), description: g('description').slice(0, 400), popularite: null };
    if (!e.name || !e.start) continue;
    const t = Date.parse(e.start.length === 10 ? `${e.start}T20:00:00+01:00` : e.start);
    if (!t || t < Date.now() - 6 * 3600e3 || t > Date.now() + 60 * 864e5) continue;
    e.start = new Date(t).toISOString();
    if (garder(e)) sortie.push(e);
  }
  log(`  DATAtourisme : ${n} événement(s) lus, ${sortie.length} soirée(s) gardée(s) dans nos villes.`);
  return sortie;
}

async function openagenda({ key, garder, log, villes }) {
  const get = async (u) => { const r = await fetch(u, { headers: { ...H, key }, signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); };
  const sortie = [], vus = new Set();
  for (const ville of villes) {
    let agendas = [];
    try { agendas = (await get(`https://api.openagenda.com/v2/agendas?search=${encodeURIComponent(ville)}&official=1&size=5`)).agendas || []; } catch (err) { if (/40[13]/.test(err.message)) throw new Error(`clé refusée (${err.message})`); continue; }
    for (const a of agendas) {
      if (vus.has(a.uid)) continue; vus.add(a.uid);
      try {
        const r = await get(`https://api.openagenda.com/v2/agendas/${a.uid}/events?relative[]=current&relative[]=upcoming&detailed=1&size=100`);
        for (const ev of r.events || []) {
          const t = (o) => (o && typeof o === 'object' ? o.fr || o.en || Object.values(o)[0] || '' : o || '');
          const tim = (ev.timings || [])[0] || {}, loc = ev.location || {};
          const e = { source: 'openagenda', name: t(ev.title), start: tim.begin ? new Date(tim.begin).toISOString() : '', end: tim.end ? new Date(tim.end).toISOString() : '',
            venue: loc.name || '', city: loc.city || '', address: loc.address || '', url: ev.canonicalUrl || ev.registration?.find?.((x) => /^http/.test(x.value || ''))?.value || '',
            image: ev.image ? `${ev.image.base || ''}${ev.image.filename || ''}` : '', price: null, tags: (t(ev.keywords) || []).slice?.(0, 4) || [], description: t(ev.description).slice(0, 400), popularite: null };
          if (e.name && e.start && Date.parse(e.start) > Date.now() - 6 * 3600e3 && garder(e)) sortie.push(e);
        }
      } catch { /* agenda illisible */ }
    }
  }
  log(`  OpenAgenda : ${vus.size} agenda(s) officiel(s), ${sortie.length} soirée(s) gardée(s).`);
  return sortie;
}

export async function releverAgendas({ log = console.log } = {}) {
  const { rubriqueDe } = await import('./sources.mjs');
  const { PAS_SOIREE, EST_SOIREE, VILLES_FRANCE, VILLES_OCCITANIE } = await import('./recherche.mjs');
  const garder = (e) => { const t = `${e.name} ${e.tags.join(' ')} ${e.description}`; return !!rubriqueDe(e) && EST_SOIREE.test(t) && !PAS_SOIREE.test(t); };
  const rapport = [], evenements = [];
  try { const ev = await datatourisme({ garder, log }); evenements.push(...ev); rapport.push({ source: 'datatourisme', evenements: ev.length }); }
  catch (err) { rapport.push({ source: 'datatourisme', erreur: String(err.message).slice(0, 200) }); log(`  DATAtourisme : ${err.message}`); }
  if (process.env.OPENAGENDA_KEY) {
    try { const ev = await openagenda({ key: process.env.OPENAGENDA_KEY, garder, log, villes: ['Nice', 'Cannes', 'Antibes', 'Monaco', 'Toulon', 'Fréjus', 'Saint-Tropez', ...VILLES_OCCITANIE.slice(0, 6), ...VILLES_FRANCE] });
      evenements.push(...ev); rapport.push({ source: 'openagenda', evenements: ev.length }); }
    catch (err) { rapport.push({ source: 'openagenda', erreur: String(err.message).slice(0, 200) }); }
  } else rapport.push({ source: 'openagenda', erreur: 'pas de clé (secret OPENAGENDA_KEY à ajouter)' });
  const par = {}; for (const e of evenements) par[rubriqueDe(e)] = (par[rubriqueDe(e)] || 0) + 1;
  writeFileSync(path.join(ROOT, 'contenus', 'agendas.json'), JSON.stringify({ maj: new Date().toISOString(), rapport, par_rubrique: par, evenements }, null, 1) + '\n');
  log(`Agendas : ${evenements.length} soirée(s) (${Object.entries(par).map(([k, v]) => `${k} ${v}`).join(', ') || 'aucune'}).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await releverAgendas().catch((e) => { console.error(`Agendas : ${e.message}`); });
