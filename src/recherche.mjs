// Recherche des soirées sur tout le web de la Côte d'Azur, par une IA gratuite (Gemini avec
// recherche Google, voir llm.mjs) :
//  - agendas des villes et offices de tourisme, billetteries (Shotgun via les moteurs de
//    recherche, DICE, Resident Advisor, Weezevent, Billetweb, Eventbrite…), sites des clubs,
//    presse locale, pages d'événements publiques ;
//  - posts Instagram récents des organisateurs et clubs suivis (API officielle Business Discovery),
//    avec l'affiche du post.
// Chaque soirée reçoit une note de pertinence pour les 17-30 ans ; le reste est écarté.
// Résultat mis en cache dans evenements-web.json (rafraîchi tous les N jours).
import * as LLM from './llm.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'evenements-web.json');
const ORGAS = path.join(ROOT, 'contenus', 'organisateurs.json');

export const FICHIER_CACHE = CACHE;
export function lireCache() {
  return existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : { maj: null, evenements: [] };
}

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['evenements', 'comptes_instagram'],
  properties: {
    evenements: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['name', 'start', 'venue', 'city', 'price', 'styles', 'image', 'url', 'source_site', 'public_17_30', 'confiance', 'accroche', 'instagram', 'buzz', 'buzz_raison'],
        properties: {
          name: { type: 'string', description: 'Nom exact de la soirée.' },
          start: { type: 'string', description: 'Date et heure de début, ISO 8601 avec fuseau (ex. 2026-11-14T23:00:00+01:00).' },
          venue: { type: 'string' },
          city: { type: 'string' },
          price: { type: ['number', 'null'], description: 'Prix le plus bas en euros, 0 si gratuit, null si inconnu.' },
          styles: { type: 'array', items: { type: 'string' }, description: 'Styles musicaux (techno, house, afro house, shatta, rap…).' },
          image: { type: 'string', description: 'URL directe de l\'affiche si connue, sinon chaîne vide.' },
          url: { type: 'string', description: 'Page de la soirée ou de la billetterie.' },
          source_site: { type: 'string', description: 'Site ou compte où l\'info a été trouvée.' },
          public_17_30: { type: 'number', description: 'Pertinence pour les 17-30 ans, de 0 à 1.' },
          confiance: { type: 'number', description: 'Fiabilité de l\'info (date, lieu), de 0 à 1. 0.9 et plus seulement si confirmé sur la page officielle ou la billetterie.' },
          accroche: { type: 'string', description: 'Une phrase courte (max 100 caractères) qui donne envie d\'y aller, uniquement à partir de faits vérifiés (line-up, lieu, concept, ambiance annoncée). Ton Teufy, sans tiret cadratin, sans exagération inventée.' },
          instagram: { type: 'array', items: { type: 'string' }, description: 'Comptes Instagram de l\'organisateur, du lieu ou des artistes de cette soirée, seulement s\'ils sont certains (sans @).' },
          buzz: { type: 'number', description: 'Potentiel de buzz auprès des 17-30 ans, de 0 à 1 : notoriété de la tête d\'affiche ou du collectif, réputation du lieu, événement unique (festival, ouverture, closing, anniversaire, édition spéciale, première venue), risque de sold out, soir de week-end ou veille de férié, engagement du post de l\'organisateur (likes, commentaires rapportés aux abonnés). 0,5 = soirée ordinaire.' },
          buzz_raison: { type: 'string', description: 'En quelques mots, pourquoi (faits vérifiés seulement).' },
        },
      },
    },
    comptes_instagram: { type: 'array', items: { type: 'string' }, description: 'Comptes Instagram d\'organisateurs, clubs ou collectifs de soirées de la Côte d\'Azur repérés (sans @).' },
  },
};

const CIBLE = `Public visé par Teufy : les 17-30 ans qui sortent sur la Côte d'Azur et dans le Var (Nice, Cannes, Antibes, Juan-les-Pins, Monaco, Menton, Cagnes, Saint-Laurent-du-Var, Grasse, Fréjus, Saint-Raphaël, Saint-Tropez, Toulon, Hyères…).
À garder : soirées en club, DJ sets, techno, house, afro, shatta, amapiano, rap, RnB, électro, soirées étudiantes, open airs, rooftops, day parties, festivals, concerts qui attirent ce public, soirées à thème.
À écarter (public_17_30 bas) : théâtre, musique classique, opéra, conférences, salons, événements enfants ou seniors, dîners spectacles chers, sport.`;

// Posts récents des comptes d'organisateurs (légende + affiche), pour extraction.
async function postsOrganisateurs({ ig, api, comptes, now, log }) {
  const out = [];
  const valides = [];
  for (const handle of comptes) {
    try {
      const bd = await api.businessDiscovery(handle, ig);
      valides.push(handle);
      for (const m of bd.media?.data || []) {
        if ((now - new Date(m.timestamp)) / 86400e3 > 21 || !m.caption) continue;
        out.push({ compte: handle, abonnes: bd.followers_count, likes: m.like_count, commentaires: m.comments_count, publie: m.timestamp.slice(0, 10), legende: m.caption.slice(0, 1200), affiche: m.media_type === 'VIDEO' ? '' : (m.media_url || ''), lien: m.permalink });
      }
    } catch (err) { log(`  @${handle} : ${String(err.message).slice(0, 80)}`); }
  }
  return { posts: out.slice(0, 120), valides };
}

export async function rechercherSoirees({ config, now = new Date(), ig = null, api = {}, ia = LLM, log = console.log, force = false } = {}) {
  const R = config.recherche_web || {};
  const cache = lireCache();
  if (R.actif === false) return cache;
  const ageJours = cache.maj ? (now - new Date(cache.maj)) / 86400e3 : Infinity;
  if (!force && ageJours < (R.rafraichir_jours ?? 3)) return cache;
  if (ia === LLM && !LLM.fournisseurs(config).length) { log('Aucune IA configurée (secret gratuit GEMINI_API_KEY) : pas de recherche web.'); return cache; }
  const jour = now.toISOString().slice(0, 10);
  const fin = new Date(now.getTime() + (R.horizon_jours ?? 45) * 86400e3).toISOString().slice(0, 10);

  // 1. Recherche sur le web : plusieurs passes ciblées (une seule recherche ne remonte qu'une vingtaine de soirées).
  log(`Recherche web des soirées du ${jour} au ${fin}…`);
  const PASSES = R.passes || [
    'la billetterie shotgun.live (pages des soirées à Nice, Cannes, Antibes, Monaco, Menton, Cagnes, Saint-Laurent-du-Var, Fréjus, Saint-Raphaël)',
    'la billetterie dice.fm (événements Nice, Côte d\'Azur, Monaco)',
    'Resident Advisor ra.co (événements Nice, Monaco, Cannes, Antibes)',
    'la billetterie eventbrite.fr (événements soirées, clubs, concerts à Nice, Cannes, Antibes, Monaco, Toulon et dans le Var)',
    'la billetterie ticketmaster.fr (concerts, soirées et festivals dans les Alpes-Maritimes, à Monaco et dans le Var : Nikaïa, Palais des Festivals, Zénith Toulon…)',
    'la billetterie bizouk.com (soirées afro, shatta, dancehall, kompa, zouk, bouyon et caribéennes sur la Côte d\'Azur et dans le Var)',
    'l\'agenda officiel provence-alpes-cotedazur.com rubrique « que faire / sortir / toutes les sorties » (soirées, concerts, festivals des Alpes-Maritimes et du Var)',
    'les billetteries See Tickets (seetickets.com), HelloAsso, Billetweb, Weezevent, Fever, Xceed, Festik et Yurplan pour la Côte d\'Azur et le Var',
    'les clubs et discothèques de Nice (High Club, Le Glam, Frigo 16 / Le 109, Le Ghost, Down Town, La Suite, Le Seven, L\'Antre…) et leurs pages événements',
    'les clubs et beach clubs de Cannes, Antibes, Juan-les-Pins et Monaco (Bâoli, Gotha, La Suite, Twiga, Jimmy\'z, Sea Club, Le Sporting, Medusa, Le Village, Palais Nikaïa pour les concerts)',
    'les agendas officiels et offices de tourisme (nice.fr, cannes.com, visitmonaco.com, antibesjuanlespins.com, cotedazurfrance.fr, menton-riviera-merveilles) rubrique soirées, concerts, DJ, festivals',
    'les soirées étudiantes, afterworks, day parties, rooftops et open airs de Nice, Cannes, Antibes et Monaco',
    'les festivals, concerts rap, électro et techno et les grosses dates de la Côte d\'Azur et du Var (Fréjus, Saint-Raphaël, Saint-Tropez)',
    'la presse et les médias locaux (Nice-Matin, Monaco-Matin, Nice Premium, Côte d\'Azur Dream, sortir à Nice) : agenda des soirées et nouveautés',
    'les soirées, clubs, bars et concerts du Var ouest : Toulon, La Seyne-sur-Mer, Hyères, Six-Fours, Sanary, Bandol, La Ciotat (clubs, bars de nuit, soirées étudiantes, Var Matin, billetteries)',
    'les soirées, clubs, beach clubs et festivals du Var est : Fréjus, Saint-Raphaël, Sainte-Maxime, Saint-Tropez, Ramatuelle, Draguignan, Puget et Roquebrune-sur-Argens',
    // Sources ajoutées le 10/11 : agendas ouverts, concerts, Monaco, billetteries secondaires, organisateurs.
    'OpenAgenda (openagenda.com) et les agendas municipaux qui l\'utilisent (Nice, Antibes, Cannes, Fréjus, Toulon, Hyères) : soirées, concerts, DJ sets, fêtes',
    'les agendas de concerts et de DJ : Allevents (allevents.in), Songkick, Bandsintown et Infoconcert, pour Nice, Cannes, Monaco, Antibes, Fréjus et Toulon',
    'Monaco : Monte-Carlo Société des Bains de Mer (montecarlosbm.com : Jimmy\'z, Sporting, Twiga, Buddha-Bar, Moods), Grimaldi Forum, Monaco Live Productions, Chapiteau de Fontvieille et visitmonaco.com',
    'les billetteries Billetréduc, Digitick, Fnac Spectacles, Tickeasy, TicketSwap (soirées en revente) et les liens de billetterie (Linktree, sites) des organisateurs de la Côte d\'Azur et du Var',
    'les collectifs, associations et organisateurs de soirées électro, techno, house, afro, latino et rap de la Côte d\'Azur et du Var, leurs pages événements et leurs billetteries',
  ];
  const textes = [];
  for (const [i, cible] of PASSES.entries()) {
    const t = await ia.rechercher({
      config,
      system: `Tu recenses TOUTES les soirées de la Côte d'Azur pour le média Teufy. Tu ne rapportes que des soirées réelles, trouvées sur une page web, jamais inventées.\n${CIBLE}`,
      prompt: `Cherche sur ${cible} toutes les soirées entre le ${jour} et le ${fin}. Vérifie chaque soirée sur sa page officielle ou sa billetterie (date, heure, lieu) : une info non confirmée doit être signalée comme telle. Pour chaque soirée : nom exact, date et heure, lieu, ville, prix minimum, styles musicaux, URL de l'affiche si tu la vois, URL de la page de la soirée, site source, ce qui peut faire le buzz (tête d'affiche, lieu réputé, festival, ouverture/closing, sold out) et les comptes Instagram de l'organisateur et du lieu. Sois exhaustif : liste-les toutes, une par ligne.`,
    }).catch((err) => { log(`  passe ${i + 1} impossible : ${err.message}`); return ''; });
    if (t) textes.push(`### Source : ${cible}\n${t}`);
  }
  const web = textes.join('\n\n');
  log(`  ${textes.length}/${PASSES.length} recherche(s) web abouties.`);
  if (!web) log('Pas de recherche web possible (GEMINI_API_KEY absent ou quota atteint) : seulement Instagram et les billetteries.');

  // 2. Posts Instagram des organisateurs (comptes connus + suggérés).
  const orgas = existsSync(ORGAS) ? JSON.parse(readFileSync(ORGAS, 'utf8')) : { comptes: [], suggeres: [] };
  let posts = [];
  if (ig && api.businessDiscovery) {
    const comptes = [...new Set([...(orgas.partenaires || []), ...(orgas.comptes || []), ...(orgas.suggeres || [])])].slice(0, R.max_comptes ?? 100); // partenaires d'abord
    const r = await postsOrganisateurs({ ig, api, comptes, now, log });
    posts = r.posts;
    orgas.valides = r.valides;
    log(`Instagram : ${posts.length} post(s) récents chez ${r.valides.length} compte(s).`);
  }

  // 3. Mise en forme structurée, par lots (une seule réponse JSON tronquerait la liste), puis fusion des doublons.
  if (!web && !posts.length) return cache;
  const lots = [...textes.map((t) => ({ web: t, posts: [] }))];
  for (let i = 0; i < posts.length; i += 30) lots.push({ web: '', posts: posts.slice(i, i + 30) });
  const d = { evenements: [], comptes_instagram: [] };
  let ok = 0;
  for (const lot of lots) {
    try {
      const r = await ia.json({
        config, nom: 'soirees', schema: SCHEMA, gratuit: true,
        system: `Tu transformes des informations de soirées en données propres. N'invente rien : une soirée sans date ou sans lieu certain est écartée ou reçoit une confiance basse. Dates au fuseau Europe/Paris.\n${CIBLE}`,
        prompt: `Aujourd'hui : ${jour}. Garde les soirées entre ${jour} et ${fin}, fusionne les doublons (même soirée trouvée sur plusieurs sites). Liste-les TOUTES.\n\nRésultats de la recherche web :\n${lot.web || '(aucun)'}\n\nPosts Instagram récents d'organisateurs (l'URL "affiche" est l'image du post, à reprendre comme image de la soirée annoncée) :\n${JSON.stringify(lot.posts)}`,
      });
      d.evenements.push(...(r.evenements || [])); d.comptes_instagram.push(...(r.comptes_instagram || [])); ok++;
    } catch (err) { log(`  mise en forme d'un lot impossible (${err.message})`); }
  }
  if (!ok) { log('Mise en forme impossible : on garde le cache.'); return cache; }

  const min = R.pertinence_min_site ?? 0.35; // le site recense tout ; les posts gardent leur propre seuil
  const evenements = (d.evenements || [])
    .filter((e) => e.name && !isNaN(Date.parse(e.start)) && e.venue && e.confiance >= 0.6 && e.public_17_30 >= min)
    .map((e) => ({
      source: 'web', source_site: e.source_site, name: e.name.trim(), start: new Date(e.start).toISOString(), venue: e.venue, city: e.city,
      address: '', url: /^https?:\/\//.test(e.url) ? e.url : '', image: /^https?:\/\//.test(e.image) ? e.image : '',
      price: typeof e.price === 'number' ? e.price : null, tags: e.styles || [], description: '', public_cible: e.public_17_30, confiance: e.confiance,
      buzz: typeof e.buzz === 'number' ? Math.max(0, Math.min(1, e.buzz)) : undefined, buzz_raison: e.buzz_raison || undefined,
      accroche: typeof e.accroche === 'string' && e.accroche.length <= 120 && !/—/.test(e.accroche) ? e.accroche.trim() : '',
      instagram: [...new Set((e.instagram || []).map((h) => String(h).replace(/^@/, '').trim().toLowerCase()).filter((h) => /^[a-z0-9._]{2,30}$/.test(h)))].slice(0, 3),
    }));
  // On cumule avec les soirées encore à venir des recherches précédentes : la liste s'enrichit au fil des jours.
  const anciennes = (cache.evenements || []).filter((e) => Date.parse(e.start) > now.getTime() - 6 * 3600e3);
  const uniques = fusionner([...evenements, ...anciennes]);
  await completerBilletterie({ liste: uniques, ia, config, log });
  const nouveaux = (d.comptes_instagram || []).map((h) => String(h).replace(/^@/, '').trim().toLowerCase()).filter((h) => /^[a-z0-9._]{2,30}$/.test(h));
  orgas.suggeres = [...new Set([...(orgas.suggeres || []), ...nouveaux])].filter((h) => !(orgas.comptes || []).includes(h)).slice(0, 80);
  const out = { maj: now.toISOString(), du: jour, au: fin, nb_bruts: (d.evenements || []).length, evenements: uniques };
  await writeFile(CACHE, JSON.stringify(out, null, 2));
  await writeFile(ORGAS, JSON.stringify(orgas, null, 2) + '\n');
  log(`Recherche web : ${uniques.length} soirée(s) uniques gardées sur ${out.nb_bruts} trouvée(s).`);
  return out;
}

// --- Doublons : la même soirée vue sur plusieurs sites ------------------------------------
// Même nuit (heure de Paris, une soirée à 1h compte pour la veille) ET (même lieu ou nom très proche) = même soirée.
const sansAccents = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const mots = (x) => new Set(sansAccents(x).replace(/\b(w|x|feat|presents?|pres|avec|invite|le|la|les|de|du|des|at|the|soiree|party|night|nice|cannes|monaco|club)\b/g, ' ').split(/[^a-z0-9]+/).filter((w) => w.length >= 3));
const jaccard = (a, b) => { const A = mots(a), B = mots(b); if (!A.size || !B.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.min(A.size, B.size); };
const nuitDe = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.parse(d) - 6 * 3600e3));
const lieuCle = (x) => sansAccents(x).replace(/[^a-z0-9]+/g, ' ').replace(/\b(le|la|les|club|nice|cannes|monaco|by|beach)\b/g, ' ').trim().split(/\s+/).filter((w) => w.length >= 3).slice(0, 2).join(' ');
// Page de billetterie normalisée : même page = même soirée (« shotgun.live/fr/events/x » = « shotgun.live/events/x »).
const pageBillet = (u) => { try { const x = new URL(u); const ch = x.pathname.replace(/^\/(fr|en|es|it|de)(?=\/)/i, '').replace(/\/+$/, ''); return ch.split('/').length > 2 ? `${x.hostname.replace(/^www\./, '')}${ch}`.toLowerCase() : ''; } catch { return ''; } };
// Heure « bouche-trou » d'une source qui ne connaît que la date (00:00 ou 23:59, heure de Paris).
const heureFloue = (d) => /^(00:00|23:59)$/.test(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(d)));
const jourDe = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(d));
export function memeSoiree(a, b) {
  const pa = pageBillet(a.url), pb = pageBillet(b.url);
  if (pa && pa === pb && jaccard(a.name, b.name) >= 0.8 && Math.abs(Date.parse(a.start) - Date.parse(b.start)) < 36 * 3600e3) return true; // une page peut couvrir plusieurs nuits (festival) : le nom doit aussi correspondre
  if (nuitDe(a.start) !== nuitDe(b.start)) {
    // Même date, même nom, l'une des deux heures est un bouche-trou : c'est la même soirée lue par deux sources.
    return jourDe(a.start) === jourDe(b.start) && (heureFloue(a.start) || heureFloue(b.start)) && jaccard(a.name, b.name) >= 0.8 && lieuCle(a.venue) === lieuCle(b.venue);
  }
  // Même lieu, quel que soit l'ordre des mots (« Frigo 16 - Le 109 » = « Le 109 - Frigo 16 » = « Frigo 16 »).
  const mots = (x) => new Set(sansAccents(x).replace(/[^a-z0-9]+/g, ' ').replace(/\b(le|la|les|club|nice|cannes|monaco|by|beach|bar|the)\b/g, ' ').trim().split(/\s+/).filter((w) => w.length >= 2));
  const [ma, mb] = [mots(a.venue), mots(b.venue)];
  const [petit, grand] = ma.size <= mb.size ? [ma, mb] : [mb, ma];
  const lieu = (lieuCle(a.venue) && lieuCle(a.venue) === lieuCle(b.venue)) || (petit.size > 0 && [...petit].every((w) => grand.has(w)));
  const nom = jaccard(a.name, b.name);
  return nom >= 0.8 || (lieu && nom >= 0.34) || (lieu && Math.abs(Date.parse(a.start) - Date.parse(b.start)) < 3600e3);
}
// Offres de billetterie (une par plateforme, prix le plus bas) : sert à comparer les prix sur le site.
const plateforme = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
// Réseaux sociaux et agrégateurs de liens : pas des billetteries (on n'y achète pas de place, un prix lu dans un post
// n'est pas un prix de billet). Exclus du comparateur.
export const PAS_BILLETTERIE = /(^|\.)(instagram|facebook|fb|tiktok|x|twitter|threads|youtube|linktr|linktree|beacons|lnk|snapchat|whatsapp|t)\.(com|me|ee|bio|net|co|ai|to)$/i;
export function offresDe(l) {
  const m = new Map();
  for (const o of l) {
    const url = o.url || '', p = plateforme(url);
    if (!lienPrecis(url) || !p || PAS_BILLETTERIE.test(p)) continue;
    const prix = typeof (o.prix ?? o.price) === 'number' ? (o.prix ?? o.price) : null;
    const prev = m.get(p);
    if (!prev || (prix != null && (prev.prix == null || prix < prev.prix))) m.set(p, { plateforme: p, url, prix });
  }
  return [...m.values()];
}
export function fusionner(liste) {
  const out = [];
  for (const e of liste) {
    const prev = out.find((x) => memeSoiree(x, e));
    if (!prev) { out.push({ ...e }); continue; }
    // On garde la version la plus fiable et on complète les champs vides.
    // Une soirée saisie à la main par l'équipe (vérifiée) l'emporte toujours sur ce que la recherche web a trouvé.
    const rang = (x) => (x.manuel ? 2 : 0) + (x.confiance ?? 0);
    const [garde, autre] = rang(e) > rang(prev) ? [{ ...e }, prev] : [prev, e];
    for (const k of Object.keys(autre)) if ((garde[k] == null || garde[k] === '' || (Array.isArray(garde[k]) && !garde[k].length)) && autre[k] != null) garde[k] = autre[k];
    garde.instagram = [...new Set([...(garde.instagram || []), ...(autre.instagram || [])])].slice(0, 3);
    garde.tags = [...new Set([...(garde.tags || []), ...(autre.tags || [])])];
    garde.buzz = Math.max(garde.buzz ?? 0, autre.buzz ?? 0) || garde.buzz;
    garde.offres = offresDe([...(garde.offres || []), ...offresDe([garde]), ...(autre.offres || []), ...offresDe([autre])]);
    if (garde.source_site !== autre.source_site) garde.sources_sites = [...new Set([...(garde.sources_sites || [garde.source_site]), autre.source_site])];
    out[out.indexOf(prev)] = garde;
  }
  return out;
}

// --- Billetterie et prix manquants -----------------------------------------------------------
// Une soirée sans lien exact vers sa billetterie (ou avec seulement « shotgun.live ») ou sans prix : on cherche sa page
// de billetterie et son prix le plus bas, par lots de 8. Chaque soirée n'est cherchée qu'une fois.
const lienPrecis = (u) => /^https?:\/\/[^/]+\/.+/.test(u || '') && !/^https?:\/\/[^/]+\/?(fr|en|events?)?\/?$/i.test(u);
export async function completerBilletterie({ liste, ia, config, log = console.log, max = 48 }) {
  const a = liste.filter((e) => (!e.billetterie_cherchee && (!lienPrecis(e.url) || e.price == null)) || !e.offres_cherchees).slice(0, max);
  if (!a.length) return;
  const SCHEMA_B = { type: 'object', additionalProperties: false, required: ['soirees'], properties: { soirees: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['n', 'url', 'prix'], properties: {
    n: { type: 'integer', description: 'numéro de la soirée dans la liste' },
    url: { type: 'string', description: 'URL exacte de la page de la soirée sur sa billetterie (pas la page d\'accueil), vide si introuvable' },
    prix: { type: ['number', 'null'], description: 'prix le moins cher en euros, 0 si gratuit, null si inconnu' },
    autres: { type: 'array', description: 'AUTRES billetteries qui vendent exactement la même soirée (même date, même lieu), avec leur prix le plus bas', items: { type: 'object', additionalProperties: false, required: ['url', 'prix'], properties: { url: { type: 'string' }, prix: { type: ['number', 'null'] } } } },
  } } } } };
  let trouves = 0;
  for (let i = 0; i < a.length; i += 8) {
    const lot = a.slice(i, i + 8);
    const texte = lot.map((e, k) => `${k + 1}. ${e.name} | ${new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' }).format(new Date(e.start))} | ${e.venue}, ${e.city}${e.source_site ? ` | vu sur ${e.source_site}` : ''}`).join('\n');
    try {
      const web = await ia.rechercher({ config, gratuit: true, system: 'Tu retrouves la page de billetterie officielle de soirées précises. Tu ne donnes que des liens que tu as réellement trouvés.',
        prompt: `Pour chacune de ces soirées de la Côte d'Azur, trouve l'URL exacte de sa page de billetterie (Shotgun, DICE, Ticketmaster, Eventbrite, Bizouk, See Tickets, Weezevent, Billetweb, HelloAsso, Fever, site du club…) et son prix le moins cher. Si la même soirée est vendue sur plusieurs plateformes, donne chaque plateforme avec son prix (pour comparer) :\n${texte}` });
      if (!web) continue;
      const r = await ia.json({ config, gratuit: true, nom: 'billetterie', schema: SCHEMA_B, system: 'Tu extrais des liens et des prix sans rien inventer.', prompt: `Soirées :\n${texte}\n\nRésultats de recherche :\n${web}\n\nDonne pour chaque numéro l'URL exacte de la page de la soirée et le prix le moins cher, selon le schéma.` });
      for (const x of r.soirees || []) {
        const e = lot[x.n - 1];
        if (!e) continue;
        if (lienPrecis(x.url) && !lienPrecis(e.url)) { e.url = x.url; trouves++; }
        if (e.price == null && typeof x.prix === 'number' && x.prix >= 0 && x.prix < 500) e.price = x.prix;
        const autres = (x.autres || []).filter((o) => o.prix == null || (o.prix >= 0 && o.prix < 500));
        e.offres = offresDe([...(e.offres || []), { url: e.url, prix: e.price }, ...(lienPrecis(x.url) ? [{ url: x.url, prix: x.prix }] : []), ...autres]);
      }
    } catch (err) { log(`  billetterie : lot impossible (${err.message})`); }
    lot.forEach((e) => { e.billetterie_cherchee = true; e.offres_cherchees = true; });
  }
  log(`  billetterie : ${trouves} lien(s) trouvé(s) pour ${a.length} soirée(s) à compléter.`);
}

// --- Grandes villes étudiantes de France : rubrique séparée du site (jamais utilisée pour les posts Instagram) --------
// Les soirées les plus attendues de chaque ville, gardées dans evenements-france.json (rafraîchi tous les 2 jours).
const CACHE_FRANCE = path.join(ROOT, 'evenements-france.json');
export const VILLES_FRANCE = ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Lille', 'Nantes', 'Strasbourg', 'Rennes', 'Grenoble', 'Aix-en-Provence']; // Toulouse et Montpellier : rubrique Occitanie
export function lireFrance() { return existsSync(CACHE_FRANCE) ? JSON.parse(readFileSync(CACHE_FRANCE, 'utf8')) : { maj: null, evenements: [] }; }
export async function rechercherFrance({ config, now = new Date(), ia = LLM, log = console.log, force = false } = {}) {
  const R = config.recherche_web || {};
  const cache = lireFrance();
  if (R.france === false) return cache;
  const ageJours = cache.maj ? (now - new Date(cache.maj)) / 86400e3 : Infinity;
  if (!force && ageJours < (R.rafraichir_france_jours ?? 2)) return cache;
  if (ia === LLM && !LLM.fournisseurs(config).length) return cache;
  const jour = now.toISOString().slice(0, 10);
  const fin = new Date(now.getTime() + 30 * 86400e3).toISOString().slice(0, 10);
  const evenements = [];
  for (let i = 0; i < VILLES_FRANCE.length; i += 3) {
    const villes = VILLES_FRANCE.slice(i, i + 3).join(', ');
    const web = await ia.rechercher({ config, gratuit: true,
      system: 'Tu recenses les soirées les plus attendues des grandes villes étudiantes de France. Tu ne rapportes que des soirées réelles trouvées sur une page web (billetterie, club, média).',
      prompt: `Pour chacune de ces villes : ${villes}, cherche sur Shotgun, DICE, Resident Advisor, les clubs et les médias locaux les 12 soirées les plus attendues par les 18-30 ans entre le ${jour} et le ${fin} (clubs, soirées étudiantes, techno, rap, afro, open airs, festivals). Pour chaque soirée : nom exact, date et heure, lieu, ville, prix minimum, styles, URL de la page de la soirée, URL de l'affiche si tu la vois.` }).catch(() => '');
    if (!web) continue;
    try {
      const r = await ia.json({ config, nom: 'soirees', schema: SCHEMA, gratuit: true,
        system: "Tu transformes des informations de soirées en données propres. N'invente rien : une soirée sans date ou sans lieu certain est écartée. Dates au fuseau Europe/Paris. Public : les 18-30 ans qui sortent dans les grandes villes de France.",
        prompt: `Aujourd'hui : ${jour}. Garde les soirées entre ${jour} et ${fin}.\n\n${web}` });
      for (const e of r.evenements || []) {
        if (!e.name || isNaN(Date.parse(e.start)) || !e.venue || !e.city || e.confiance < 0.75) continue;
        evenements.push({ source: 'web', source_site: e.source_site, name: e.name.trim(), start: new Date(e.start).toISOString(), venue: e.venue, city: e.city, address: '',
          url: /^https?:\/\//.test(e.url) ? e.url : '', image: /^https?:\/\//.test(e.image) ? e.image : '', price: typeof e.price === 'number' ? e.price : null, tags: e.styles || [],
          description: '', public_cible: e.public_17_30, confiance: e.confiance, verifie: e.confiance >= 0.85, buzz: e.buzz,
          accroche: typeof e.accroche === 'string' && e.accroche.length <= 120 && !/—/.test(e.accroche) ? e.accroche.trim() : '', instagram: [] });
      }
    } catch (err) { log(`  France (${villes}) : mise en forme impossible (${err.message})`); }
  }
  if (!evenements.length) return cache;
  const anciennes = (cache.evenements || []).filter((e) => Date.parse(e.start) > now.getTime() - 6 * 3600e3);
  const out = { maj: now.toISOString(), evenements: fusionner([...evenements, ...anciennes]) };
  await writeFile(CACHE_FRANCE, JSON.stringify(out, null, 2));
  log(`France : ${out.evenements.length} soirée(s) dans ${VILLES_FRANCE.length} villes.`);
  return out;
}

// --- Occitanie : toute la région, sur le site seulement (Instagram reste 100 % Côte d'Azur) ------------------------
// Toutes les soirées (pas seulement les plus attendues), rafraîchies chaque jour dans evenements-occitanie.json.
const CACHE_OCCITANIE = path.join(ROOT, 'evenements-occitanie.json');
export const VILLES_OCCITANIE = ['Montpellier', 'Toulouse', 'Nîmes', 'Perpignan', 'Béziers', 'Sète', 'Narbonne', 'Carcassonne', 'Agde', 'La Grande-Motte',
  'Palavas-les-Flots', 'Albi', 'Montauban', 'Tarbes', 'Rodez', 'Alès', 'Castres', 'Cahors', 'Auch', 'Foix', 'Mende', 'Lourdes', 'Canet-en-Roussillon', 'Argelès-sur-Mer', 'Collioure'];
// Code postal ou ville d'Occitanie (départements 09, 11, 12, 30, 31, 32, 34, 46, 48, 65, 66, 81, 82).
const RE_CP_OCCITANIE = /\b(09|11|12|30|31|32|34|46|48|65|66|81|82)\d{3}\b/;
const sansAcc = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function villeOccitanie(e) {
  const t = sansAcc(`${e.city || ''} ${e.address || ''} ${e.venue || ''}`);
  return VILLES_OCCITANIE.find((v) => t.includes(sansAcc(v).split('-')[0])) || (RE_CP_OCCITANIE.test(t) ? e.city : '');
}
// Ce qui n'est pas une soirée (conférences, stand-up, ateliers, rencontres pro…) : écarté des pages billetterie.
const PAS_SOIREE = /comedy|stand ?up|humou?r|conf[ée]rence|atelier|workshop|formation|s[ée]minaire|networking|r[ée]seautage|[ée]checs|meetup|webinar|salon|rencontre(s)? (pro|d'affaires)|apéropreneur|yoga|m[ée]ditation|visite guid|dégustation de vin|speed ?dating|quiz|book ?club|lecture|jeux|vide[- ]?dressing|clothes|sale\b|afterwork|after work|[ée]loquence|brocante|march[ée] de/i;
const EST_SOIREE = /soir[ée]e|party|club|\bdj\b|techno|house|[ée]lectro|\brap\b|afro|shatta|dancehall|reggaeton|latino|kompa|zouk|open ?air|festival|night|rave|disco|bal\b|concert|live/i;
export function lireOccitanie() { return existsSync(CACHE_OCCITANIE) ? JSON.parse(readFileSync(CACHE_OCCITANIE, 'utf8')) : { maj: null, evenements: [] }; }
export async function rechercherOccitanie({ config, now = new Date(), ia = LLM, log = console.log, force = false } = {}) {
  const R = config.recherche_web || {};
  const cache = lireOccitanie();
  if (R.occitanie === false) return cache;
  const ageJours = cache.maj ? (now - new Date(cache.maj)) / 86400e3 : Infinity;
  if (!force && ageJours < (R.rafraichir_occitanie_jours ?? 1)) return cache;
  const jour = now.toISOString().slice(0, 10);
  const fin = new Date(now.getTime() + (R.horizon_jours ?? 45) * 86400e3).toISOString().slice(0, 10);
  const evenements = [];

  // 1. Billetteries lisibles directement (pages Eventbrite par ville, config.sources_occitanie).
  try {
    const { lirePagesSources } = await import('./sources.mjs');
    const pages = await lirePagesSources(config.sources_occitanie || {}, { log });
    for (const e of pages) {
      if (!e.name || PAS_SOIREE.test(`${e.name} ${e.venue || ''}`) || !EST_SOIREE.test(`${e.name} ${(e.tags || []).join(' ')}`) || !villeOccitanie(e)) continue;
      evenements.push({ ...e, source: e.source || 'billetterie', confiance: 0.9, verifie: true, tags: e.tags || [], instagram: [] });
    }
    log(`Occitanie : ${evenements.length} soirée(s) lues sur les billetteries.`);
  } catch (err) { log(`Occitanie : billetteries illisibles (${err.message})`); }

  // 2. Recherche web par zone (IA gratuite avec recherche Google), comme pour la Côte d'Azur.
  if (!(ia === LLM && !LLM.fournisseurs(config).length)) {
    const ZONES = R.passes_occitanie || [
      'Montpellier (clubs, bars de nuit, soirées étudiantes, techno, rap, afro, open airs : Shotgun, DICE, Resident Advisor, Eventbrite, Bizouk, Midi Libre)',
      'Toulouse (clubs, soirées étudiantes, techno, house, rap, afro, open airs, festivals : Shotgun, DICE, Resident Advisor, Eventbrite, Bizouk, La Dépêche)',
      'le littoral de l\'Hérault et du Gard : Sète, Agde et Cap d\'Agde, La Grande-Motte, Palavas-les-Flots, Carnon, Le Grau-du-Roi (clubs, beach clubs, soirées)',
      'Nîmes, Alès et le Gard (clubs, soirées, concerts, férias, festivals)',
      'Perpignan et les Pyrénées-Orientales : Canet-en-Roussillon, Argelès-sur-Mer, Collioure (clubs, soirées, festivals)',
      'Béziers, Narbonne, Carcassonne et l\'Aude (clubs, soirées, férias, festivals)',
      'Albi, Castres, Montauban, Cahors, Rodez, Tarbes, Lourdes, Auch, Foix et Mende (clubs, soirées, concerts, festivals)',
      'les festivals, grosses soirées électro, techno et rap et les soirées étudiantes de toute l\'Occitanie',
    ];
    for (const [i, zone] of ZONES.entries()) {
      const web = await ia.rechercher({ config, gratuit: true,
        system: "Tu recenses TOUTES les soirées d'Occitanie pour le site Teufy. Tu ne rapportes que des soirées réelles trouvées sur une page web (billetterie, club, média), jamais inventées.",
        prompt: `Cherche les soirées à ${zone} entre le ${jour} et le ${fin}. Vérifie chaque soirée sur sa page officielle ou sa billetterie. Pour chaque soirée : nom exact, date et heure, lieu, ville, prix minimum, styles musicaux, URL de la page de la soirée, URL de l'affiche si tu la vois, site source. Sois exhaustif : une par ligne.` }).catch((err) => { log(`  Occitanie passe ${i + 1} impossible : ${err.message}`); return ''; });
      if (!web) continue;
      try {
        const r = await ia.json({ config, nom: 'soirees', schema: SCHEMA, gratuit: true,
          system: "Tu transformes des informations de soirées en données propres. N'invente rien : une soirée sans date ou sans lieu certain est écartée. Dates au fuseau Europe/Paris. Seulement des soirées en Occitanie, pour les 18-30 ans.",
          prompt: `Aujourd'hui : ${jour}. Garde les soirées entre ${jour} et ${fin}.\n\n${web}` });
        for (const e of r.evenements || []) {
          if (!e.name || isNaN(Date.parse(e.start)) || !e.venue || !e.city || e.confiance < 0.75 || !villeOccitanie(e) || PAS_SOIREE.test(e.name)) continue;
          evenements.push({ source: 'web', source_site: e.source_site, name: e.name.trim(), start: new Date(e.start).toISOString(), venue: e.venue, city: e.city, address: '',
            url: /^https?:\/\//.test(e.url) ? e.url : '', image: /^https?:\/\//.test(e.image) ? e.image : '', price: typeof e.price === 'number' ? e.price : null, tags: e.styles || [],
            description: '', public_cible: e.public_17_30, confiance: e.confiance, verifie: e.confiance >= 0.85, buzz: e.buzz,
            accroche: typeof e.accroche === 'string' && e.accroche.length <= 120 && !/—/.test(e.accroche) ? e.accroche.trim() : '', instagram: [] });
        }
      } catch (err) { log(`  Occitanie (${zone.slice(0, 30)}…) : mise en forme impossible (${err.message})`); }
    }
  }
  if (!evenements.length) return cache;
  const anciennes = (cache.evenements || []).filter((e) => Date.parse(e.start) > now.getTime() - 6 * 3600e3);
  const out = { maj: now.toISOString(), evenements: fusionner([...evenements, ...anciennes]) };
  await writeFile(CACHE_OCCITANIE, JSON.stringify(out, null, 2));
  log(`Occitanie : ${out.evenements.length} soirée(s) à venir.`);
  return out;
}
