// Prospects depuis OpenStreetMap (base ouverte et gratuite, licence ODbL) — sans IA (12/11/2026).
// Bars, clubs, restaurants, fast-foods, activités et boutiques de fête des Alpes-Maritimes, du Var et de Monaco, avec
// l'e-mail, le site et l'Instagram que l'établissement (ou un contributeur) a publiés sur la carte.
// Démarchage B2B : contact professionnel publié, message lié à l'activité, désinscription en un clic (voir prospection).
const SERVEURS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

export const REQUETE = `[out:json][timeout:180];
(area["ISO3166-2"="FR-06"];area["ISO3166-2"="FR-83"];area["ISO3166-1"="MC"];)->.z;
(
  nwr(area.z)["amenity"~"^(bar|pub|nightclub|biergarten|fast_food|restaurant)$"]["name"];
  nwr(area.z)["leisure"~"^(bowling_alley|escape_game|amusement_arcade|trampoline_park)$"]["name"];
  nwr(area.z)["sport"="karting"]["name"];
  nwr(area.z)["shop"~"^(party|costume|cosmetics|beauty|perfumery)$"]["name"];
);
out tags center;`;

const CATEGORIE = (t) => t.amenity === 'nightclub' ? 'club'
  : ['bar', 'pub', 'biergarten'].includes(t.amenity) ? 'bar'
    : t.amenity === 'fast_food' ? 'fast-food'
      : t.amenity === 'restaurant' ? 'restaurant'
        : t.leisure === 'bowling_alley' ? 'bowling' : t.leisure === 'escape_game' ? 'escape game' : t.leisure === 'amusement_arcade' ? 'salle de jeux'
          : t.leisure === 'trampoline_park' ? 'activite trampoline' : t.sport === 'karting' ? 'karting'
            : ['party', 'costume'].includes(t.shop) ? 'boutique deguisements' : t.shop ? 'boutique beaute' : 'autre';

const premier = (x) => String(x || '').split(';')[0].trim();
const instagramDe = (t) => {
  const v = premier(t['contact:instagram'] || t.instagram || '');
  const m = v.match(/instagram\.com\/([A-Za-z0-9._]{2,30})/) || v.match(/^@?([A-Za-z0-9._]{2,30})$/);
  return m ? m[1].toLowerCase() : '';
};
const siteDe = (t) => { const s = premier(t.website || t['contact:website'] || t.url || ''); return /^https?:\/\//.test(s) ? s : s && /^[\w.-]+\.[a-z]{2,}/i.test(s) ? `https://${s}` : ''; };
const emailDe = (t) => { const e = premier(t.email || t['contact:email'] || '').toLowerCase(); return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e) ? e : ''; };

/** Transforme la réponse Overpass en prospects (sans doublon, seulement ceux qu'on peut joindre). */
export function prospectsDepuisOSM(json) {
  const out = [];
  const vus = new Set();
  for (const el of json?.elements || []) {
    const t = el.tags || {};
    if (!t.name || t.disused || t['disused:amenity'] || /^(no|closed)$/.test(t.opening_hours || '')) continue;
    const categorie = CATEGORIE(t);
    const email = emailDe(t), site = siteDe(t), instagram = instagramDe(t);
    // Restaurants : seulement ceux qui publient un e-mail ou un Instagram (des milliers sinon, peu ciblés).
    if (categorie === 'restaurant' && !email && !instagram) continue;
    if (!email && !site && !instagram) continue;
    const ville = t['addr:city'] || t['is_in:city'] || '';
    const cle = `${t.name.toLowerCase()}|${ville.toLowerCase()}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push({ nom: t.name, categorie, ville, site, instagram, ...(email ? { email, email_source: `https://www.openstreetmap.org/${el.type}/${el.id}` } : {}), source: 'OpenStreetMap' });
  }
  return out;
}

/** Interroge OpenStreetMap (Overpass, gratuit). Renvoie [] si les serveurs ne répondent pas. */
export async function prospectsOSM({ fetchFn = fetch, log = console.log } = {}) {
  for (const url of SERVEURS) {
    try {
      const r = await fetchFn(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'TeufyBot/1.0 (+https://teufyparty.com)' }, body: `data=${encodeURIComponent(REQUETE)}`, signal: AbortSignal.timeout(200000) });
      if (!r.ok) { log(`OpenStreetMap : ${url} a répondu ${r.status}`); continue; }
      const l = prospectsDepuisOSM(await r.json());
      log(`OpenStreetMap : ${l.length} établissement(s) joignable(s) (${l.filter((x) => x.email).length} avec e-mail publié).`);
      return l;
    } catch (err) { log(`OpenStreetMap : ${url} indisponible (${err.message.slice(0, 80)})`); }
  }
  return [];
}
