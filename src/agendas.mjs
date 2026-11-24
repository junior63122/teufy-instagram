// Agendas ouverts (22/11/2026, directeur : « trouve d'autres moyens d'obtenir encore plus de soirées : des agendas intéressants »).
// Sources officielles et gratuites, sans IA, lues une fois par jour par le robot « Veille technique » :
// - DATAtourisme (base nationale des offices de tourisme, export quotidien des événements en CSV sur data.gouv.fr, sans clé) :
//   concerts, festivals, soirées, fêtes, marchés de Noël en soirée… dans nos villes ; idéal pour les touristes.
// - OpenAgenda (agendas officiels des villes et des salles, clé gratuite dans le secret OPENAGENDA_KEY).
// Seules les soirées sont gardées (mêmes règles que pour les billetteries), rangées par rubrique (Côte, Occitanie, France).
// Sortie : contenus/agendas.json, relu par src/sources.mjs (Côte) et src/run.mjs (France, Occitanie).
import { writeFileSync } from 'node:fs';
import path from 'node:path';
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

/** Prochaine date à venir d'une case de date (ISO, AAAA-MM-JJ, JJ/MM/AAAA, plusieurs dates séparées), sinon la première ; null si illisible. */
export function prochaineDate(texte, maintenant = Date.now()) {
  const ts = [];
  for (const m of String(texte).matchAll(/(\d{4}-\d{2}-\d{2})(T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?|(\d{2})\/(\d{2})\/(\d{4})/g)) {
    const iso = m[1] ? (m[2] ? `${m[1]}${m[2]}` : `${m[1]}T20:00:00+01:00`) : `${m[5]}-${m[4]}-${m[3]}T20:00:00+01:00`;
    const t = Date.parse(iso); if (!Number.isNaN(t)) ts.push(t);
  }
  if (!ts.length) return null;
  return ts.filter((t) => t >= maintenant - 6 * 3600e3).sort((a, b) => a - b)[0] ?? ts[0];
}

/** Colonnes reconnues d'après leur nom (le format exact de l'export peut changer : on cherche par mots). */
export function colonnes(entetes) {
  const n = entetes.map((h) => h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
  const trouve = (...re) => n.findIndex((h) => re.some((r) => r.test(h)));
  return { nom: trouve(/^nom/, /label/, /titre/, /^name/), debut: trouve(/date.*debut/, /debut/, /start/), fin: trouve(/date.*fin/, /^fin/, /end/),
    commune: trouve(/commune/, /ville/, /city/, /locality/), cp: trouve(/code.?postal/, /postal/), adresse: trouve(/adresse/, /address/, /street/),
    lieu: trouve(/lieu/, /etablissement/, /venue/), url: trouve(/url/, /site.?web/, /homepage/, /^web$/), image: trouve(/image/, /photo/, /illustration/),
    categories: trouve(/categor/, /type/, /theme/), description: trouve(/description/, /resume/) };
}

// 24/11/2026 : le « CSV simplifié » publié sur data.gouv.fr (data.cquest.org) n'a plus que l'identifiant, le titre et le type :
// dates, villes, liens vides sur ses 67 879 lignes. On lit donc l'export complet JSON-LD du même éditeur (700 Mo une fois
// décompressé), objet par objet, sans jamais le charger en entier.
const val = (x) => (Array.isArray(x) ? (x.find((y) => y?.['@language'] === 'fr') ?? x[0]) : x);
const texteDe = (x) => { const v = val(x); return String(v && typeof v === 'object' ? v['@value'] ?? '' : v ?? '').trim(); };
const liste = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

/** Rend un à un les objets du tableau « @graph » d'un JSON-LD lu par morceaux (chaînes). */
export async function* objetsGraph(morceaux) {
  const pile = []; let chaine = false, echap = false, buf = '', dedans = false;
  for await (const m of morceaux) {
    let debut = dedans ? 0 : -1;
    for (let i = 0; i < m.length; i++) {
      const c = m[i];
      if (chaine) { if (echap) echap = false; else if (c === '\\') echap = true; else if (c === '"') chaine = false; continue; }
      if (c === '"') { chaine = true; continue; }
      if (c === '{' || c === '[') {
        if (c === '{' && pile.length === 2 && pile[1] === '[') { dedans = true; debut = i; buf = ''; }
        pile.push(c);
      } else if (c === '}' || c === ']') {
        pile.pop();
        if (c === '}' && dedans && pile.length === 2) { buf += m.slice(debut, i + 1); dedans = false; debut = -1; try { yield JSON.parse(buf); } catch { /* objet illisible : ignoré */ } buf = ''; }
      }
    }
    if (dedans) buf += m.slice(debut);
  }
}

/** Instant (ms) d'une date + heure locales de Paris. */
const FMT_OFFSET = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'longOffset' });
export function instantParis(date, heure = '00:00:00') {
  const brut = Date.parse(`${date}T${`${heure}:00:00`.slice(0, 8)}Z`); if (Number.isNaN(brut)) return null;
  const ecart = (t) => { const z = FMT_OFFSET.formatToParts(new Date(t)).find((x) => x.type === 'timeZoneName')?.value || '';
    const m = z.match(/([+-])(\d{2}):(\d{2})/); return m ? (m[1] === '+' ? 1 : -1) * (+m[2] * 60 + +m[3]) * 60e3 : 0; };
  return brut - ecart(brut - ecart(brut));
}

/** Fiche DATAtourisme (objet JSON-LD) → événement Teufy, à la prochaine date à venir ; null si rien à venir. */
export function evenementDT(o, maintenant = Date.now()) {
  const nom = texteDe(o['rdfs:label']); if (!nom) return null;
  // Prochaine occurrence : chaque période (début, fin, heures) ; une période de plusieurs jours compte pour chaque jour.
  let meilleur = null;
  const lieu = val(o.isLocatedAt) || {};
  // Heure absente de la période : celle des horaires d'ouverture du même jour (donnée de la fiche), jamais inventée.
  const horaires = liste(lieu['schema:openingHoursSpecification']).map((h) => ({ de: texteDe(h['schema:validFrom']).slice(0, 10), a: texteDe(h['schema:validThrough']).slice(0, 10), o: texteDe(h['schema:opens']), f: texteDe(h['schema:closes']) }));
  for (const p of liste(o.takesPlaceAt)) {
    const d1 = texteDe(p.startDate), d2 = texteDe(p.endDate) || d1;
    let h1 = texteDe(p.startTime), h2 = texteDe(p.endTime);
    if (!h1) { const h = horaires.find((x) => x.o && x.de <= d1.slice(0, 10) && (!x.a || x.a >= d1.slice(0, 10))); if (h) { h1 = h.o; h2 ||= h.f; } }
    if (/^00:00(:00)?$/.test(h1)) h1 = '';
    if (!/^\d{4}-\d{2}-\d{2}/.test(d1)) continue;
    // Période longue (exposition, « tous les samedis » saisis comme une période) : on part de la veille d'aujourd'hui.
    const hier = new Date(maintenant - 864e5).toISOString().slice(0, 10);
    for (let j = 0, d = d1.slice(0, 10) < hier ? hier : d1.slice(0, 10); j < 400 && d <= d2.slice(0, 10); j++) {
      const t = instantParis(d, h1 || '00:00:00');
      if (t != null && t >= maintenant - 6 * 3600e3 && (!meilleur || t < meilleur.t)) {
        let f = h2 ? instantParis(d, h2) : null; if (f != null && f <= t) f += 864e5;
        meilleur = { t, f, heure: !!h1 }; break;
      }
      d = new Date(Date.parse(`${d}T12:00:00Z`) + 864e5).toISOString().slice(0, 10);
    }
  }
  if (!meilleur) return null;
  const adr = val(lieu['schema:address']) || {}, geo = val(lieu['schema:geo']) || {};
  const contact = liste(o.hasContact).concat(liste(o.hasBookingContact));
  const web = contact.map((c) => texteDe(c?.['foaf:homepage'])).find((u) => /^https?:/.test(u)) || '';
  const image = liste(o.hasMainRepresentation).concat(liste(o.hasRepresentation)).map((r) => texteDe(val(r?.['ebucore:hasRelatedResource'])?.['ebucore:locator'])).find((u) => /^https?:/.test(u)) || '';
  const prix = val(val(o['schema:offers'])?.['schema:priceSpecification']) || {};
  const pm = texteDe(prix['schema:minPrice']) || texteDe(prix['schema:price']), pmin = pm !== '' && Number.isFinite(+pm) ? +pm : null;
  const types = liste(o['@type']).map((t) => String(t).replace(/^.*:/, '')).filter((t) => !/^(PointOfInterest|resource|Event|EntertainmentAndEvent)$/.test(t));
  const desc = texteDe(o['rdfs:comment']) || texteDe(o.hasDescription?.shortDescription) || texteDe(o['owl:topObjectProperty']?.shortDescription);
  const rue = liste(adr['schema:streetAddress']).map(String)[0] || '';
  return { source: 'datatourisme', name: nom, start: new Date(meilleur.t).toISOString(), end: meilleur.f ? new Date(meilleur.f).toISOString() : '',
    ...(meilleur.heure ? {} : { heure_inconnue: true }),
    venue: texteDe(lieu['schema:name']) || (liste(adr['schema:streetAddress']).length > 1 ? String(liste(adr['schema:streetAddress'])[1]) : ''),
    city: String(adr['schema:addressLocality'] || ''), address: [rue, adr['schema:postalCode'], adr['schema:addressLocality']].filter(Boolean).join(', '),
    lat: Number(texteDe(geo['schema:latitude'])) || null, lng: Number(texteDe(geo['schema:longitude'])) || null,
    url: web, image, price: pmin ?? null, tags: [...new Set(types)].slice(0, 4), description: desc.slice(0, 400), popularite: null };
}

// DATAtourisme recense tout le tourisme (expositions, marchés, visites, tournois…) : on ne garde que les sorties du soir,
// d'après le type de la fiche et des mots précis (un « concert » d'orgue à l'église n'est pas une soirée).
const TYPES_HORS = /^(Exhibition|ExhibitionEvent|Market|SaleEvent|Visit|Product|SportsCompetition|ChildrensEvent|Game|TrainingWorkshop|BusinessEvent|Conference|ReligiousEvent|SportsDemonstration|Rally|Course|WalkingTour)$/;
export const NUIT_DT = /soir[ée]e|party|club|\bdj\b|techno|\bhouse\b|[ée]lectro|\brap\b|hip.?hop|afro|shatta|dancehall|reggae|\bdub\b|reggaeton|latino|salsa|bachata|kizomba|kompa|zouk|open ?air|\bnight\b|\brave\b|disco|\bbal\b|guinguette|cabaret|karaok|blind.?test|jazz|\brock\b|metal|punk|sound ?system|sc[eè]ne ouverte|stand.?up|dancing|\bdanse\b|apéro|concert/i;
export const PAS_NUIT_DT = /bougie|[ée]glise|cath[ée]drale|chapelle|messe|orgue|gospel|chorale|chœur|choeur|classique|baroque|lyrique|symphoni|enfant|famille|go[uû]ter|atelier|conf[ée]rence|exposition|visite|march[ée]|tournoi|r[ée]gate|randonn|loto|thé dansant|th[ée].dansant|apr[eè]s.midi dansant|seniors?|retrait[ée]s|conservatoire|quatuor|r[ée]cital|vivaldi|\bbach\b|mozart|fl[uû]te|violon|piano|musique de chambre|martin[uů]|tcha[iï]kovsk|handi|sport/i;
export function estSortieDT(e) {
  if (e.tags.some((t) => TYPES_HORS.test(t))) return 'pas une sortie (type)';
  const t = `${e.name} ${e.description} ${e.venue}`;
  if (!NUIT_DT.test(t)) return 'pas une soirée';
  if (PAS_NUIT_DT.test(t)) return 'exclu (église, enfants, exposition…)';
  return true;
}

async function datatourisme({ garder, log }) {
  // Ressource « événements » en JSON-LD du jeu de données DATAtourisme (adresse retrouvée chaque jour par l'API data.gouv).
  const ds = await (await fetch('https://www.data.gouv.fr/api/1/datasets/donnees-touristiques-de-la-base-datatourisme/', { headers: H, signal: AbortSignal.timeout(30000) })).json();
  const res = (ds.resources || []).filter((r) => /json/i.test(`${r.format} ${r.url}`) && /v[eé]nement|event/i.test(`${r.title} ${r.url}`));
  if (!res.length) throw new Error(`pas d'export « événements » en JSON (ressources : ${(ds.resources || []).map((r) => r.title).slice(0, 6).join(' | ')})`);
  const url = res[0].url.replace(/^http:/, 'https:');
  const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(600000) });
  if (!r.ok) throw new Error(`export HTTP ${r.status}`);
  // Décompression au fil de l'eau (le fichier fait ~100 Mo compressé, ~700 Mo décompressé).
  const { Readable } = await import('node:stream'); const { createGunzip } = await import('node:zlib');
  const flux = Readable.fromWeb(r.body).pipe(createGunzip()); flux.setEncoding('utf8');
  let n = 0, aVenir = 0; const sortie = [], rejets = {};
  const rejet = (k, ex) => { const x = (rejets[k] ||= { n: 0, ex: [] }); x.n++; if (x.ex.length < 3 && ex) x.ex.push(String(ex).slice(0, 60)); };
  const limite = Date.now() + 60 * 864e5;
  for await (const o of objetsGraph(flux)) {
    if (!o['rdfs:label']) continue; n++;
    const e = evenementDT(o);
    if (!e) { rejet('passé ou sans date'); continue; }
    if (Date.parse(e.start) > limite) { rejet('dans plus de 60 jours'); continue; }
    if (e.heure_inconnue) { rejet('sans heure de début', `${e.name} (${e.city})`); continue; } // jamais d'heure inventée
    aVenir++;
    // Ville d'après la commune seule (« rue de Paris » dans une adresse de Moselle ne fait pas une soirée à Paris).
    const g = estSortieDT(e) === true ? garder({ ...e, address: e.city, venue: '' }) : estSortieDT(e);
    if (g === true) sortie.push(e); else rejet(g || 'écarté', `${e.name} (${e.city})`);
  }
  if (!n) throw new Error('aucun événement lu dans l\'export JSON-LD (format changé ?)');
  log(`  DATAtourisme : ${n} événement(s) lus, ${aVenir} dans les 60 jours, ${sortie.length} gardé(s) dans nos villes.`);
  log(`  DATAtourisme : écartés ${Object.entries(rejets).map(([k, v]) => `${k} ${v.n}${v.ex.length ? ` (ex. ${v.ex.join(' ; ')})` : ''}`).join(' | ') || 'aucun'}`);
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
          if (e.name && e.start && Date.parse(e.start) > Date.now() - 6 * 3600e3 && garder(e) === true) sortie.push(e);
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
  // true = gardé ; sinon le motif (journal du relevé).
  const garder = (e) => { const t = `${e.name} ${e.tags.join(' ')} ${e.description}`; if (!rubriqueDe(e)) return 'hors de nos villes'; if (!EST_SOIREE.test(t)) return 'pas une soirée'; if (PAS_SOIREE.test(t)) return 'exclu (atelier, salon…)'; return true; };
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
