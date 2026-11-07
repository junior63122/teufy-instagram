// Extraction générique des événements contenus dans une page HTML.
// Shotgun et DICE sont des sites Next.js : les données sont présentes soit en
// schema.org (application/ld+json), soit dans le JSON de la page (__NEXT_DATA__,
// application/json, flux RSC self.__next_f). On parcourt tout ce JSON et on garde
// les objets qui ressemblent à un événement (un nom + une date de début).

const EVENT_TYPES = /event$/i; // Event, MusicEvent, DanceEvent, SocialEvent…

export function extractEvents(html, { source, baseUrl }) {
  const blobs = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    const body = m[2].trim();
    if (!body) continue;
    if (/application\/(ld\+)?json/i.test(attrs) || /id=["']__NEXT_DATA__["']/i.test(attrs)) {
      const j = safeJson(decodeEntities(body));
      if (j) blobs.push(j);
    } else if (body.includes('self.__next_f.push')) {
      for (const s of rscStrings(body)) blobs.push(...jsonFragments(s));
    } else if (/window\.__[A-Z_]+__\s*=/.test(body)) {
      const idx = body.indexOf('{');
      if (idx >= 0) {
        const j = safeJson(body.slice(idx).replace(/;\s*$/, ''));
        if (j) blobs.push(j);
      }
    }
  }

  const found = [];
  const seen = new WeakSet();
  const walk = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > 40 || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) { for (const x of node) walk(x, depth + 1); return; }
    const ev = toEvent(node, { source, baseUrl });
    if (ev) found.push(ev);
    for (const v of Object.values(node)) walk(v, depth + 1);
  };
  for (const b of blobs) walk(b, 0);
  return dedupe(found);
}

function toEvent(o, { source, baseUrl }) {
  const type = [].concat(o['@type'] || []).join(' ');
  const isLd = EVENT_TYPES.test(type);
  const name = str(o.name) || str(o.title) || str(o.eventName);
  if (!name || name.length > 200) return null;

  const start = date(
    o.startDate, o.start_date, o.startTime, o.start_time, o.startsAt, o.starts_at, o.beginAt, o.begin_at,
    o.dates?.event_start_date, o.dates?.start, o.date?.start, o.eventStartDate, o.date
  );
  if (!start) return null;
  // Sans @type schema.org, on exige un indice supplémentaire d'événement pour éviter les faux positifs.
  const hasHint = isLd || o.venue || o.venues || o.location || o.lineup || o.dates || o.slug || o.perm_name || o.ticketing || o.price;
  if (!hasHint) return null;

  const end = date(o.endDate, o.end_date, o.endTime, o.end_time, o.endsAt, o.ends_at, o.dates?.event_end_date, o.date?.end);

  const venueObj = first(o.location, o.venue, Array.isArray(o.venues) ? o.venues[0] : o.venues, o.place);
  const venue = typeof venueObj === 'string' ? venueObj : str(venueObj?.name) || str(venueObj?.title) || '';
  const addr = venueObj && typeof venueObj === 'object' ? venueObj.address : null;
  const city = str(o.city?.name) || str(o.city) || str(venueObj?.city?.name) || str(venueObj?.city) ||
    (typeof addr === 'string' ? addr : str(addr?.addressLocality)) || str(o.geolocation?.city) || '';
  const address = typeof addr === 'string' ? addr : [str(addr?.streetAddress), str(addr?.postalCode), str(addr?.addressLocality)].filter(Boolean).join(' ');

  let url = str(o.url) || str(o.link) || str(o.permalink) || '';
  if (!url && o.perm_name) url = `https://dice.fm/event/${o.perm_name}`;
  if (!url && o.slug && source === 'shotgun') url = `https://shotgun.live/fr/events/${o.slug}`;
  if (url && !/^https?:/i.test(url)) { try { url = new URL(url, baseUrl).href; } catch { url = ''; } }

  const image = img(o.image) || img(o.images) || img(o.coverUrl) || img(o.cover) || img(o.cover_image) ||
    img(o.flyer) || img(o.event_images) || img(o.picture) || img(o.imageUrl) || '';

  const price = priceOf(o);
  const tags = tagsOf(o);
  const description = clean(str(o.description) || str(o.about) || str(o.summary)).slice(0, 600);

  const popularite = num(o.interestedCount ?? o.interested_count ?? o.attendeesCount ?? o.attendees_count ?? o.goingCount ?? o.going_count ??
    o.likesCount ?? o.likes_count ?? o.favouritesCount ?? o.favourites_count ?? o.followersCount ?? o.ticketsSold ?? o.tickets_sold ?? o.savesCount);

  return { source, name: clean(name), start, end, venue: clean(venue), city: clean(city), address: clean(address), url, image: bigImage(image), price, tags, description, popularite };
}

// Styles musicaux / catégories (Shotgun : tags, genres ; DICE : genre_tags, tags…)
function tagsOf(o) {
  const out = new Set();
  for (const k of ['tags', 'genres', 'genre_tags', 'genreTags', 'musicGenres', 'musicGenre', 'genre', 'keywords', 'categories', 'category', 'type_tags']) {
    for (const t of [].concat(o[k] || [])) {
      const v = typeof t === 'string' ? t : str(t?.name) || str(t?.title) || str(t?.label) || str(t?.value);
      if (v) v.split(/[,;|]/).forEach((x) => x.trim() && out.add(clean(x).toLowerCase()));
    }
  }
  return [...out].slice(0, 15);
}

function priceOf(o) {
  const offers = [].concat(o.offers || []);
  for (const of of offers) {
    const p = num(of?.lowPrice ?? of?.price);
    if (p != null) return p;
  }
  const p = o.price;
  if (p && typeof p === 'object') {
    const a = num(p.amount ?? p.amount_from ?? p.value ?? p.min);
    if (a != null) return a > 500 && Number.isInteger(a) ? a / 100 : a; // DICE : centimes
  }
  return num(o.price ?? o.minPrice ?? o.lowestPrice ?? o.priceFrom);
}

// --- utilitaires -----------------------------------------------------------

function str(v) { return typeof v === 'string' && v.trim() ? v.trim() : ''; }
function first(...xs) { return xs.find((x) => x != null && x !== ''); }
function num(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function clean(s) { return decodeEntities(String(s || '')).replace(/\s+/g, ' ').trim(); }

function date(...cands) {
  for (const c of cands) {
    if (c == null || c === '') continue;
    let d;
    if (typeof c === 'number') d = new Date(c < 1e12 ? c * 1000 : c);
    else if (typeof c === 'string' && /\d{4}-\d{2}-\d{2}/.test(c)) d = new Date(c);
    else continue;
    if (!isNaN(d)) return d.toISOString();
  }
  return null;
}

function img(v) {
  if (!v) return '';
  if (typeof v === 'string') return /^https?:\/\//.test(v) ? v : '';
  if (Array.isArray(v)) { for (const x of v) { const u = img(x); if (u) return u; } return ''; }
  if (typeof v === 'object') {
    return img(v.url) || img(v.contentUrl) || img(v.square) || img(v.portrait) || img(v.landscape) ||
      img(v.original) || img(v.large) || img(v.src) || img(v.image) || '';
  }
  return '';
}

// Affiche en grande taille : les CDN (imgix, Cloudinary…) redimensionnent via l'URL.
export function bigImage(u) {
  if (!u) return u;
  try {
    const url = new URL(u);
    for (const k of ['w', 'width']) if (url.searchParams.has(k) && +url.searchParams.get(k) < 1080) url.searchParams.set(k, '1080');
    for (const k of ['h', 'height']) if (url.searchParams.has(k)) url.searchParams.delete(k);
    return url.href.replace(/\/w_\d{2,3},/, '/w_1080,').replace(/\/c_fill,h_\d+,w_\d+/, '/c_limit,w_1080');
  } catch { return u; }
}

function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }

function decodeEntities(s) {
  return s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// Flux RSC de Next.js : self.__next_f.push([1,"...chaîne JS échappée..."])
function rscStrings(body) {
  const out = [];
  for (const m of body.matchAll(/self\.__next_f\.push\(\[\s*\d+\s*,\s*("(?:[^"\\]|\\.)*")\s*\]\)/g)) {
    const s = safeJson(m[1]);
    if (typeof s === 'string') out.push(s);
  }
  return out;
}

// Extrait les objets/tableaux JSON valides contenus dans une chaîne quelconque.
export function jsonFragments(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '{' || c === '[') {
      const end = matchBracket(s, i);
      if (end > i) {
        const j = safeJson(s.slice(i, end + 1));
        if (j && typeof j === 'object') { out.push(j); i = end + 1; continue; }
      }
    }
    i++;
  }
  return out;
}

function matchBracket(s, start) {
  const stack = [];
  let inStr = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') {
      const o = stack.pop();
      if ((c === '}' && o !== '{') || (c === ']' && o !== '[')) return -1;
      if (!stack.length) return i;
    }
  }
  return -1;
}

export function dedupe(events) {
  const map = new Map();
  for (const e of events) {
    const k = keyOf(e);
    const prev = map.get(k);
    if (!prev) { map.set(k, e); continue; }
    // On fusionne en gardant les champs renseignés.
    for (const f of Object.keys(e)) if (!prev[f] && e[f]) prev[f] = e[f];
    if (e.tags?.length) prev.tags = [...new Set([...(prev.tags || []), ...e.tags])];
    if (prev.source !== e.source && !prev.sources) prev.sources = [prev.source, e.source];
  }
  return [...map.values()];
}

export function keyOf(e) {
  const n = e.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 40);
  return `${n}|${e.start.slice(0, 10)}`;
}
