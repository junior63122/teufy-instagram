// Recherche des soirées sur tout le web de la Côte d'Azur, par Claude (API Anthropic) :
//  - agendas des villes et offices de tourisme, billetteries (Shotgun via les moteurs de
//    recherche, DICE, Resident Advisor, Weezevent, Billetweb, Eventbrite…), sites des clubs,
//    presse locale, pages d'événements publiques ;
//  - posts Instagram récents des organisateurs et clubs suivis (API officielle Business Discovery),
//    avec l'affiche du post.
// Chaque soirée reçoit une note de pertinence pour les 17-30 ans ; le reste est écarté.
// Résultat mis en cache dans evenements-web.json (rafraîchi tous les N jours).
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'evenements-web.json');
const ORGAS = path.join(ROOT, 'contenus', 'organisateurs.json');
const MODEL = 'claude-opus-5-5';

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
        required: ['name', 'start', 'venue', 'city', 'price', 'styles', 'image', 'url', 'source_site', 'public_17_30', 'confiance'],
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
          confiance: { type: 'number', description: 'Fiabilité de l\'info (date, lieu), de 0 à 1.' },
        },
      },
    },
    comptes_instagram: { type: 'array', items: { type: 'string' }, description: 'Comptes Instagram d\'organisateurs, clubs ou collectifs de soirées de la Côte d\'Azur repérés (sans @).' },
  },
};

const CIBLE = `Public visé par Teufy : les 17-30 ans qui sortent sur la Côte d'Azur (Nice, Cannes, Antibes, Juan-les-Pins, Monaco, Menton, Cagnes, Saint-Laurent-du-Var, Grasse, Fréjus, Saint-Raphaël, Saint-Tropez…).
À garder : soirées en club, DJ sets, techno, house, afro, shatta, amapiano, rap, RnB, électro, soirées étudiantes, open airs, rooftops, day parties, festivals, concerts qui attirent ce public, soirées à thème.
À écarter (public_17_30 bas) : théâtre, musique classique, opéra, conférences, salons, événements enfants ou seniors, dîners spectacles chers, sport.`;

// Appel Claude : réflexion adaptative, repli serveur en cas de refus, reprise des tours en pause.
async function appel(client, params) {
  const messages = [...params.messages];
  for (let tour = 0; tour < 6; tour++) {
    const res = await client.beta.messages.stream({
      model: MODEL, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', thinking: { type: 'adaptive' }, ...params, messages,
    }).finalMessage();
    if (res.stop_reason === 'refusal') throw new Error('Claude a refusé la demande.');
    if (res.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: res.content }); continue; }
    return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  }
  throw new Error('La recherche n\'a pas abouti.');
}

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
        out.push({ compte: handle, publie: m.timestamp.slice(0, 10), legende: m.caption.slice(0, 1200), affiche: m.media_type === 'VIDEO' ? '' : (m.media_url || ''), lien: m.permalink });
      }
    } catch (err) { log(`  @${handle} : ${String(err.message).slice(0, 80)}`); }
  }
  return { posts: out.slice(0, 120), valides };
}

export async function rechercherSoirees({ config, now = new Date(), ig = null, api = {}, client, log = console.log, force = false } = {}) {
  const R = config.recherche_web || {};
  const cache = lireCache();
  if (R.actif === false) return cache;
  const ageJours = cache.maj ? (now - new Date(cache.maj)) / 86400e3 : Infinity;
  if (!force && ageJours < (R.rafraichir_jours ?? 3)) return cache;
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) { log('ANTHROPIC_API_KEY absent : pas de recherche web.'); return cache; }
    client = new Anthropic();
  }
  const jour = now.toISOString().slice(0, 10);
  const fin = new Date(now.getTime() + (R.horizon_jours ?? 45) * 86400e3).toISOString().slice(0, 10);

  // 1. Recherche sur le web.
  log(`Recherche web des soirées du ${jour} au ${fin}…`);
  const web = await appel(client, {
    max_tokens: 32000,
    tools: [
      { type: 'web_search_20260209', name: 'web_search', max_uses: R.max_recherches ?? 20, user_location: { type: 'approximate', city: 'Nice', region: 'Provence-Alpes-Côte d\'Azur', country: 'FR', timezone: 'Europe/Paris' } },
      { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: R.max_pages ?? 25 },
    ],
    system: `Tu recenses les soirées de la Côte d'Azur pour le compte Instagram Teufy. Tu ne rapportes que des soirées réelles et vérifiées sur une page web, jamais inventées.\n${CIBLE}`,
    messages: [{
      role: 'user',
      content: `Trouve un maximum de soirées entre le ${jour} et le ${fin}. Ratisse large et croise les sources : agendas des villes (Nice, Cannes, Antibes, Monaco, Menton…) et offices de tourisme (dont cotedazurfrance.com), billetteries (shotgun.live via les résultats de recherche, dice.fm, ra.co, weezevent, billetweb, eventbrite, helloasso, fever…), sites et pages des clubs et bars de nuit, collectifs et organisateurs, presse locale (Nice-Matin…), festivals, pages d'événements publiques. Pour chaque soirée : nom, date et heure, lieu, ville, prix minimum, styles musicaux, URL de l'affiche si tu la vois, URL de la page, site source. Liste aussi les comptes Instagram d'organisateurs, clubs et collectifs que tu croises. Termine par la liste complète, une soirée par ligne.`,
    }],
  });

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

  // 3. Mise en forme structurée et tri.
  const brut = await appel(client, {
    max_tokens: 32000,
    system: `Tu transformes des informations de soirées en données propres. N'invente rien : une soirée sans date ou sans lieu certain est écartée ou reçoit une confiance basse. Dates au fuseau Europe/Paris.\n${CIBLE}`,
    messages: [{
      role: 'user',
      content: `Aujourd'hui : ${jour}. Garde les soirées entre ${jour} et ${fin}, fusionne les doublons (même soirée trouvée sur plusieurs sites).\n\nRésultats de la recherche web :\n${web}\n\nPosts Instagram récents d'organisateurs (l'URL "affiche" est l'image du post, à reprendre comme image de la soirée annoncée) :\n${JSON.stringify(posts)}`,
    }],
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
  });
  let d;
  try { d = JSON.parse(brut); } catch { log('Réponse de recherche illisible : on garde le cache.'); return cache; }

  const min = R.pertinence_min ?? 0.5;
  const evenements = (d.evenements || [])
    .filter((e) => e.name && !isNaN(Date.parse(e.start)) && e.venue && e.confiance >= 0.6 && e.public_17_30 >= min)
    .map((e) => ({
      source: 'web', source_site: e.source_site, name: e.name.trim(), start: new Date(e.start).toISOString(), venue: e.venue, city: e.city,
      address: '', url: /^https?:\/\//.test(e.url) ? e.url : '', image: /^https?:\/\//.test(e.image) ? e.image : '',
      price: typeof e.price === 'number' ? e.price : null, tags: e.styles || [], description: '', public_cible: e.public_17_30,
    }));
  const nouveaux = (d.comptes_instagram || []).map((h) => String(h).replace(/^@/, '').trim().toLowerCase()).filter((h) => /^[a-z0-9._]{2,30}$/.test(h));
  orgas.suggeres = [...new Set([...(orgas.suggeres || []), ...nouveaux])].filter((h) => !(orgas.comptes || []).includes(h)).slice(0, 80);
  const out = { maj: now.toISOString(), du: jour, au: fin, nb_bruts: (d.evenements || []).length, evenements };
  await writeFile(CACHE, JSON.stringify(out, null, 2));
  await writeFile(ORGAS, JSON.stringify(orgas, null, 2) + '\n');
  log(`Recherche web : ${evenements.length} soirée(s) gardée(s) sur ${out.nb_bruts} trouvée(s).`);
  return out;
}
