// Billetteries par leurs API officielles (22/11/2026, directeur : « trouve une solution pour vraiment avoir toutes les soirées
// de la Côte automatiquement, comme avant mais encore mieux »). Eventbrite et Shotgun bloquent désormais la lecture de leurs
// pages par nos robots : on ne contourne pas un blocage, on passe par les accès officiels et gratuits.
//
// - Eventbrite : API officielle (jeton personnel gratuit, secret EVENTBRITE_TOKEN). La recherche publique n'existe plus dans
//   l'API, mais « les événements d'un organisateur » oui : on retrouve les organisateurs de la Côte à partir des soirées déjà
//   vues (contenus/eventbrite-pages.json) et de celles trouvées par la recherche web, puis on lit leurs prochaines soirées.
// - Ticketmaster : API « Discovery » officielle (clé gratuite, secret TICKETMASTER_KEY) : concerts, festivals et soirées
//   autour de Nice et de Toulon (Nikaïa, Zénith, Palais des Festivals…).
// Sans clé : la source est simplement sautée (rien n'est inventé). Relevé gardé 6 h (contenus/api-billetteries.json).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const lire = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
const ZONES = [{ nom: 'Nice', latlong: '43.70,7.26', rayon: 45 }, { nom: 'Toulon', latlong: '43.20,6.05', rayon: 40 }, { nom: 'Fréjus', latlong: '43.43,6.74', rayon: 25 }];

async function json(url, opts = {}) {
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(25000) });
  if (r.status === 429) { await attendre(5000); const r2 = await fetch(url, { ...opts, signal: AbortSignal.timeout(25000) }); if (!r2.ok) throw new Error(`HTTP ${r2.status}`); return r2.json(); }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Identifiant d'événement Eventbrite tiré d'une adresse de page (…-tickets-1234567890). */
export const idEventbrite = (u) => (String(u || '').match(/eventbrite\.[a-z.]+\/e\/[^?#]*?-(\d{9,})(?:[/?#]|$)/) || [])[1] || null;

/** Événement Eventbrite (API v3, avec venue et prix) → format commun des soirées. */
export function depuisEventbrite(e) {
  const v = e.venue || {}, a = v.address || {};
  const prix = e.is_free ? 0 : e.ticket_availability?.minimum_ticket_price?.major_value != null ? Number(e.ticket_availability.minimum_ticket_price.major_value) : null;
  return { source: 'eventbrite', name: e.name?.text || '', start: e.start?.utc ? new Date(e.start.utc).toISOString() : null, end: e.end?.utc ? new Date(e.end.utc).toISOString() : '',
    venue: v.name || '', city: a.city || '', address: a.localized_address_display || [a.address_1, a.postal_code, a.city].filter(Boolean).join(', '),
    url: e.url || '', image: e.logo?.original?.url || e.logo?.url || '', price: prix, tags: [], description: (e.summary || '').slice(0, 400), popularite: null };
}

/** Événement Ticketmaster Discovery v2 → format commun. */
export function depuisTicketmaster(e) {
  const v = e._embedded?.venues?.[0] || {};
  const img = [...(e.images || [])].sort((x, y) => (y.width || 0) - (x.width || 0))[0];
  const g = (e.classifications || []).flatMap((c) => [c.genre?.name, c.subGenre?.name]).filter((x) => x && x !== 'Undefined');
  const start = e.dates?.start?.dateTime || (e.dates?.start?.localDate && e.dates?.start?.localTime ? `${e.dates.start.localDate}T${e.dates.start.localTime}+01:00` : null);
  return { source: 'ticketmaster', name: e.name || '', start: start ? new Date(start).toISOString() : null, end: '', venue: v.name || '', city: v.city?.name || '',
    address: [v.address?.line1, v.postalCode, v.city?.name].filter(Boolean).join(', '), url: e.url || '', image: img?.url || '',
    price: e.priceRanges?.[0]?.min ?? null, tags: [...new Set(g)].slice(0, 4), description: '', popularite: null };
}

async function eventbrite({ root, token, log, villes }) {
  const H = { headers: { authorization: `Bearer ${token}` } };
  const etat = lire(path.join(root, 'contenus', 'eventbrite-organisateurs.json'), { organisateurs: {}, evenements_vus: {} });
  // 1. Organisateurs : à partir des soirées Eventbrite déjà connues (pages lues avant le blocage + recherche web).
  const urls = [...Object.keys(lire(path.join(root, 'contenus', 'eventbrite-pages.json'), {})),
    ...(lire(path.join(root, 'evenements-web.json'), {}).evenements || []).map((e) => e.url)];
  let lus = 0;
  for (const id of [...new Set(urls.map(idEventbrite).filter(Boolean))]) {
    if (etat.evenements_vus[id] || lus >= 60) continue;
    try { const e = await json(`https://www.eventbriteapi.com/v3/events/${id}/`, H); if (e.organizer_id) etat.organisateurs[e.organizer_id] ||= { depuis: id, le: new Date().toISOString() }; etat.evenements_vus[id] = new Date().toISOString(); }
    catch (err) {
      // Jeton refusé : on s'arrête et on le dit (avant : erreur avalée, « 0 organisateur » sans explication).
      if (/HTTP 40[13]/.test(err.message)) throw new Error(`Eventbrite : jeton refusé (${err.message}) : vérifier le « Private token » dans le secret EVENTBRITE_TOKEN`);
      if (/HTTP 404/.test(err.message)) etat.evenements_vus[id] = new Date().toISOString(); // soirée supprimée : inutile de réessayer
      else log(`  Eventbrite (API) : soirée ${id} illisible (${err.message})`);
    }
    lus++; await attendre(250);
  }
  // 2. Prochaines soirées de chaque organisateur, gardées si elles sont dans nos villes.
  const sortie = [], ecartees = [];
  let recues = 0, erreurs = 0;
  for (const org of Object.keys(etat.organisateurs)) {
    try {
      const r = await json(`https://www.eventbriteapi.com/v3/organizers/${org}/events/?status=live&order_by=start_asc&expand=venue,ticket_availability&page_size=50`, H);
      for (const e of r.events || []) { recues++; const x = depuisEventbrite(e); if (x.start && villes(x)) sortie.push(x); else ecartees.push(`${x.name.slice(0, 40)} (${x.city || x.venue || 'lieu inconnu'})`); }
    } catch (err) { if (/HTTP 40[13]/.test(err.message)) throw new Error(`Eventbrite : jeton refusé (${err.message})`); erreurs++; if (erreurs <= 3) log(`  Eventbrite (API) : organisateur ${org} illisible (${err.message})`); }
    await attendre(250);
  }
  // 22/11/2026 : premier essai « 34 organisateurs, 0 soirée » sans explication : on dit ce qui est reçu et écarté.
  log(`  Eventbrite (API) : ${recues} soirée(s) reçue(s), ${ecartees.length} hors de nos villes${ecartees.length ? ` (ex. ${ecartees.slice(0, 5).join(' ; ')})` : ''}, ${erreurs} organisateur(s) illisible(s).`);
  writeFileSync(path.join(root, 'contenus', 'eventbrite-organisateurs.json'), JSON.stringify(etat, null, 1) + '\n');
  log(`  Eventbrite (API) : ${Object.keys(etat.organisateurs).length} organisateur(s), ${sortie.length} soirée(s) dans nos villes.`);
  return sortie;
}

async function ticketmaster({ key, log, villes }) {
  const sortie = [], debut = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  for (const z of ZONES) {
    for (let page = 0; page < 3; page++) {
      const u = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
      for (const [k, v] of Object.entries({ apikey: key, latlong: z.latlong, radius: z.rayon, unit: 'km', locale: '*', size: 100, page, sort: 'date,asc', startDateTime: debut })) u.searchParams.set(k, v);
      const r = await json(u.href);
      for (const e of r._embedded?.events || []) { const x = depuisTicketmaster(e); if (x.start && villes(x)) sortie.push(x); }
      if ((r.page?.totalPages ?? 1) <= page + 1) break;
      await attendre(300);
    }
  }
  log(`  Ticketmaster (API) : ${sortie.length} événement(s) dans nos villes.`);
  return sortie;
}

/** Soirées des API officielles (relevé gardé 6 h). `villes(e)` : vrai si la soirée est dans la zone couverte. */
export async function lireApiBilletteries({ root, log = console.log, villes = () => true, now = Date.now() } = {}) {
  const f = path.join(root, 'contenus', 'api-billetteries.json');
  const cache = lire(f, {});
  if (cache.maj && now - Date.parse(cache.maj) < 6 * 3600e3) return { evenements: cache.evenements || [], rapport: cache.rapport || [] };
  const rapport = [], evenements = [];
  for (const [nom, cle, fn] of [['eventbrite', process.env.EVENTBRITE_TOKEN, (k) => eventbrite({ root, token: k, log, villes })], ['ticketmaster', process.env.TICKETMASTER_KEY, (k) => ticketmaster({ key: k, log, villes })]]) {
    if (!cle) { rapport.push({ source: `${nom}-api`, erreur: 'pas de clé (secret à ajouter)' }); continue; }
    try { const ev = await fn(cle); evenements.push(...ev); rapport.push({ source: `${nom}-api`, evenements: ev.length }); }
    catch (err) { rapport.push({ source: `${nom}-api`, erreur: String(err.message).slice(0, 160) }); evenements.push(...(cache.evenements || []).filter((e) => e.source === nom)); }
  }
  // Une clé présente mais refusée ou une panne : nouvel essai dans 30 min (et non 6 h), pour qu'une clé corrigée serve vite.
  const panne = rapport.some((r) => r.erreur && !/pas de clé/.test(r.erreur));
  const maj = new Date(panne ? now - 5.5 * 3600e3 : now).toISOString();
  writeFileSync(f, JSON.stringify({ maj, evenements, rapport }, null, 1) + '\n');
  return { evenements, rapport };
}
