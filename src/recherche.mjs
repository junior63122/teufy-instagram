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

const CIBLE = `Public visé par Teufy : les 17-30 ans qui sortent sur la Côte d'Azur (Nice, Cannes, Antibes, Juan-les-Pins, Monaco, Menton, Cagnes, Saint-Laurent-du-Var, Grasse, Fréjus, Saint-Raphaël, Saint-Tropez…).
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
    'les billetteries weezevent, billetweb, helloasso, eventbrite, fever, xceed, allevents, festik, yurplan pour la Côte d\'Azur',
    'les clubs et discothèques de Nice (High Club, Le Glam, Frigo 16 / Le 109, Le Ghost, Down Town, La Suite, Le Seven, L\'Antre…) et leurs pages événements',
    'les clubs et beach clubs de Cannes, Antibes, Juan-les-Pins et Monaco (Bâoli, Gotha, La Suite, Twiga, Jimmy\'z, Sea Club, Le Sporting, Medusa, Le Village, Palais Nikaïa pour les concerts)',
    'les agendas officiels et offices de tourisme (nice.fr, cannes.com, visitmonaco.com, antibesjuanlespins.com, cotedazurfrance.fr, menton-riviera-merveilles) rubrique soirées, concerts, DJ, festivals',
    'les soirées étudiantes, afterworks, day parties, rooftops et open airs de Nice, Cannes, Antibes et Monaco',
    'les festivals, concerts rap, électro et techno et les grosses dates de la Côte d\'Azur et du Var (Fréjus, Saint-Raphaël, Saint-Tropez)',
    'la presse et les médias locaux (Nice-Matin, Monaco-Matin, Nice Premium, Côte d\'Azur Dream, sortir à Nice) : agenda des soirées et nouveautés',
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
    const comptes = [...new Set([...(orgas.comptes || []), ...(orgas.suggeres || [])])].slice(0, R.max_comptes ?? 40);
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
export function memeSoiree(a, b) {
  if (nuitDe(a.start) !== nuitDe(b.start)) return false;
  const lieu = lieuCle(a.venue) && lieuCle(a.venue) === lieuCle(b.venue);
  const nom = jaccard(a.name, b.name);
  return nom >= 0.8 || (lieu && nom >= 0.34) || (lieu && Math.abs(Date.parse(a.start) - Date.parse(b.start)) < 3600e3);
}
export function fusionner(liste) {
  const out = [];
  for (const e of liste) {
    const prev = out.find((x) => memeSoiree(x, e));
    if (!prev) { out.push({ ...e }); continue; }
    // On garde la version la plus fiable et on complète les champs vides.
    const [garde, autre] = (e.confiance ?? 0) > (prev.confiance ?? 0) ? [{ ...e }, prev] : [prev, e];
    for (const k of Object.keys(autre)) if ((garde[k] == null || garde[k] === '' || (Array.isArray(garde[k]) && !garde[k].length)) && autre[k] != null) garde[k] = autre[k];
    garde.instagram = [...new Set([...(garde.instagram || []), ...(autre.instagram || [])])].slice(0, 3);
    garde.tags = [...new Set([...(garde.tags || []), ...(autre.tags || [])])];
    garde.buzz = Math.max(garde.buzz ?? 0, autre.buzz ?? 0) || garde.buzz;
    if (garde.source_site !== autre.source_site) garde.sources_sites = [...new Set([...(garde.sources_sites || [garde.source_site]), autre.source_site])];
    out[out.indexOf(prev)] = garde;
  }
  return out;
}
