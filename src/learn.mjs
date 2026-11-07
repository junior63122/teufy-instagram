// Apprentissage : le bot mesure chaque publication et s'en sert pour choisir la suite.
//
// 1. Mesure : statistiques Instagram de chaque post (portée, likes, commentaires,
//    enregistrements, partages, abonnements gagnés, visites du profil, temps de
//    visionnage des reels) + nombre d'abonnés chaque jour → apprentissage.json
// 2. Score : (likes + 2·commentaires + 3·enregistrements + 4·partages + 10·abonnements)
//    ÷ portée, comparé à la médiane du même format (carrousel, image, reel), avec un
//    bonus portée (nouveaux publics) et rétention (reels regardés jusqu'au bout).
// 3. Choix : pour chaque décision (accroche, intro, question, sujet de débat, heure,
//    soirées mises en avant…) on tire au sort en favorisant ce qui a marché, tout en
//    continuant à tester les options peu essayées (échantillonnage de Thompson).
import { readFileSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { genreOf, styleLabel } from './genres.mjs';
import { rapportTendances } from './tendances.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_FILE = path.join(ROOT, 'apprentissage.json');

export function loadData() {
  return existsSync(DATA_FILE) ? JSON.parse(readFileSync(DATA_FILE, 'utf8')) : { posts: [], abonnes: [] };
}

export function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}

// --- Score d'une publication -------------------------------------------------

function rawRate(m) {
  const reach = Math.max(m.reach || 0, 50);
  const inter = (m.likes || 0) + 2 * (m.comments || 0) + 3 * (m.saved || 0) + 4 * (m.shares || 0) + 10 * (m.follows || 0) + 0.5 * (m.profile_visits || 0);
  let r = inter / reach;
  if (m.ig_reels_avg_watch_time && m.duree) r *= 0.6 + 0.8 * Math.min(1, m.ig_reels_avg_watch_time / 1000 / m.duree);
  return r;
}
const median = (a) => { if (!a.length) return 1; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] || 1; };
const format = (p) => (p.type === 'reel' ? 'reel' : p.nb_images === 1 ? 'image' : 'carrousel');

// Score normalisé : 1 = performance habituelle du format, 2 = deux fois mieux.
export function scorePosts(data) {
  const measured = data.posts.filter((p) => p.metrics && p.metrics.reach);
  const byFmt = {};
  for (const p of measured) (byFmt[format(p)] ||= []).push(p);
  for (const list of Object.values(byFmt)) {
    const mr = median(list.map((p) => rawRate(p.metrics)));
    const mreach = median(list.map((p) => p.metrics.reach));
    for (const p of list) p.score = +(0.7 * (rawRate(p.metrics) / mr) + 0.3 * (p.metrics.reach / mreach)).toFixed(3);
  }
  return measured;
}

// --- Modèle ----------------------------------------------------------------

export function buildModel(data = loadData()) {
  const posts = scorePosts(data);
  const arms = {}; // "pool:option" → { n, sum }
  const feats = {}; // caractéristique de soirée → { n, sum }
  const add = (map, k, v) => { const s = (map[k] ||= { n: 0, sum: 0 }); s.n++; s.sum += v; };
  for (const p of posts) {
    for (const [pool, opt] of Object.entries(p.choix || {})) for (const o of [].concat(opt)) add(arms, `${pool}:${o}`, p.score);
    for (const f of new Set(p.features || [])) add(feats, f, p.score);
  }
  return { arms, feats, nPosts: posts.length };
}

const PRIOR = 1, K = 2;
const shrunk = (s) => (s ? (s.sum + PRIOR * K) / (s.n + K) : PRIOR);
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// Sélecteur : choisit une option dans une liste en favorisant ce qui marche.
export function chooser(model, r) {
  const choix = {};
  return {
    choix,
    pick(pool, options, idOf = (o) => hash(typeof o === 'string' ? o : JSON.stringify(o))) {
      if (!options.length) return undefined;
      let best, bestV = -Infinity;
      for (const o of options) {
        const s = model.arms[`${pool}:${idOf(o)}`];
        const v = shrunk(s) + gauss(r) * 0.35 / Math.sqrt((s?.n || 0) + 1);
        if (v > bestV) { bestV = v; best = o; }
      }
      choix[pool] = idOf(best);
      return best;
    },
    // Choisit k options distinctes (ex. hashtags) ; `bonus` = score de tendance externe (0 à 1).
    pickMany(pool, options, k, bonus = () => 0) {
      const scored = options.map((o) => {
        const s = model.arms[`${pool}:${o}`];
        return [shrunk(s) + 0.5 * bonus(o) + gauss(r) * 0.35 / Math.sqrt((s?.n || 0) + 1), o];
      }).sort((a, b) => b[0] - a[0]).slice(0, k).map((x) => x[1]);
      choix[pool] = scored;
      return scored;
    },
  };
}

// --- Soirées : caractéristiques et classement -------------------------------

const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function eventFeatures(e) {
  const f = [`genre:${genreOf(e)}`, `source:${e.source}`];
  for (const s of styleLabel(e).split(' · ').filter(Boolean)) f.push(`style:${slug(s)}`);
  if (e.venue) f.push(`lieu:${slug(e.venue)}`);
  if (e.city) f.push(`ville:${slug(e.city)}`);
  f.push(`prix:${e.price == null ? 'inconnu' : e.price === 0 ? 'gratuit' : e.price <= 10 ? 'petit' : e.price <= 25 ? 'moyen' : 'cher'}`);
  const h = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: 'numeric', hourCycle: 'h23' }).format(new Date(e.start));
  f.push(`horaire:${h >= 6 && h < 20 ? 'jour' : 'nuit'}`);
  return f;
}

// Note d'une soirée : qualité des infos + popularité + ce que le public a aimé.
export function scoreEvent(e, model, r) {
  let s = 0;
  if (e.manuel) s += 10;
  if (e.mise_en_avant) s += 5;
  if (e.image) s += 3;
  if (e.venue) s += 1;
  if (styleLabel(e)) s += 1;
  if (e.price != null) s += 0.5;
  if (e.sources) s += 1.5; // en vente sur Shotgun ET DICE : soirée importante
  if (e.popularite) s += Math.log10(1 + e.popularite) * 1.5;
  for (const f of eventFeatures(e)) {
    const st = model.feats[f];
    if (st) s += 2 * Math.log(shrunk(st)) + (r ? gauss(r) * 0.3 / Math.sqrt(st.n + 1) : 0);
  }
  return s;
}

// Les meilleures soirées, avec un peu de diversité (2 max par lieu).
export function selectBest(list, n, model, r) {
  const ranked = list.map((e) => ({ e, s: scoreEvent(e, model, r) })).sort((a, b) => b.s - a.s);
  const out = [];
  const lieux = {};
  for (const { e } of ranked) {
    const k = slug(e.venue) || e.name;
    if ((lieux[k] || 0) >= 2) continue;
    lieux[k] = (lieux[k] || 0) + 1;
    out.push(e);
    if (out.length >= n) break;
  }
  return out;
}

// --- Notes et caractéristiques générales d'un post ---------------------------

// Note sur 100 : 50 = performance habituelle du compte pour ce format, 100 = deux fois mieux.
export const note = (p) => (p.score == null ? null : Math.max(0, Math.min(100, Math.round(50 * p.score))));

// Caractéristiques communes à TOUS les posts (ceux du bot et ceux publiés à la main) :
// heure, jour, format, longueur et forme de la légende, hashtags, thèmes.
const JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
export function generalFeatures(p) {
  const f = [];
  const t = p.publie_le ? new Date(p.publie_le) : null;
  if (t) {
    const h = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: 'numeric', hourCycle: 'h23' }).format(t);
    const j = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short' }).format(t).toLowerCase().slice(0, 3);
    f.push(`heure:${h}h`, `jour:${JOURS[['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(j)] || j}`);
  }
  f.push(`format:${format(p)}`);
  if (p.type) f.push(`type:${[p.type, p.variante].filter(Boolean).join('-')}`);
  const cap = p.legende || p.caption || '';
  if (cap) {
    const L = cap.length;
    f.push(`legende:${L < 200 ? 'courte' : L < 600 ? 'moyenne' : 'longue'}`);
    if (/\?/.test(cap.split('\n')[0])) f.push('accroche:question');
    for (const h of new Set(cap.toLowerCase().match(/#[\p{L}\p{N}_]+/gu) || [])) f.push(`hashtag:${h}`);
    for (const [k, re] of Object.entries({ techno: /techno|rave/i, fetes: /no[eë]l|nouvel an|r[ée]veillon/i, gratuit: /gratuit|moins de \d+ ?€/i, orgas: /organisez|postez/i, debat: /vous pr[ée]f[ée]rez| ou |votez|team /i })) {
      if (re.test(cap)) f.push(`theme:${k}`);
    }
  }
  if (p.source === 'manuel') f.push('auteur:equipe'); else f.push('auteur:bot');
  return f;
}

// --- Collecte des statistiques ------------------------------------------------

export async function collect({ hist, ig, api, now = new Date() }) {
  const data = loadData();
  const byMedia = new Map(data.posts.map((p) => [p.media, p]));
  for (const h of hist) {
    if (!h.media || !h.publication) continue;
    if (!byMedia.has(h.media)) {
      const p = { media: h.media, ...h.publication, publie_le: h.le, source: 'bot' };
      data.posts.push(p);
      byMedia.set(h.media, p);
    }
  }
  // Posts publiés à la main sur le compte (avant le bot ou en parallèle) : importés pour comparer.
  if (api.compteMedia) {
    try {
      for (const m of await api.compteMedia(ig)) {
        if (byMedia.has(m.id)) { const p = byMedia.get(m.id); p.caption ??= m.caption; continue; }
        const p = {
          media: m.id, source: 'manuel', id: 'manuel', publie_le: m.timestamp, date: m.timestamp.slice(0, 10), caption: m.caption || '',
          type: m.media_product_type === 'REELS' ? 'reel' : 'post', nb_images: m.media_type === 'CAROUSEL_ALBUM' ? 2 : 1, lien: m.permalink,
        };
        data.posts.push(p);
        byMedia.set(m.id, p);
      }
    } catch { /* pas d'accès à la liste : on garde les posts du bot */ }
  }
  let n = 0;
  for (const p of data.posts) {
    const age = (now - new Date(p.publie_le)) / 86400e3;
    if (age < 0.9) continue;
    // Posts du bot suivis de J+1 à J+21 ; anciens posts mesurés une seule fois (valeur finale).
    if (p.source === 'manuel' ? !!p.metrics : (age > 21 || (p.mesure_le && (now - new Date(p.mesure_le)) / 86400e3 < 0.9))) continue;
    const m = await api.insights(p.media, p.type === 'reel', ig);
    if (m) { p.metrics = { ...m, duree: p.duree }; p.mesure_le = now.toISOString(); n++; }
  }
  for (const p of data.posts) p.features_generales = generalFeatures(p);
  const followers = await api.followers(ig).catch(() => null);
  const jour = now.toISOString().slice(0, 10);
  if (followers != null && !data.abonnes.some((a) => a.date === jour)) data.abonnes.push({ date: jour, n: followers });
  data.abonnes = data.abonnes.slice(-400);
  scorePosts(data);
  for (const p of data.posts) p.note = note(p);
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  await writeFile(path.join(ROOT, 'RAPPORT.md'), rapport(data));
  return n;
}

// Objectif : battre la note médiane des 10 derniers posts mesurés (+5 points).
export function objectif(data = loadData()) {
  const notes = scorePosts(data).sort((a, b) => String(b.publie_le).localeCompare(String(a.publie_le))).slice(0, 10).map(note).sort((a, b) => a - b);
  return notes.length ? Math.min(100, notes[Math.floor(notes.length / 2)] + 5) : 55;
}

// Effet de chaque caractéristique sur la note (moyenne avec ce trait − moyenne générale).
export function effets(data = loadData(), min = 2) {
  const posts = scorePosts(data);
  if (!posts.length) return [];
  const moy = posts.reduce((a, p) => a + note(p), 0) / posts.length;
  const by = {};
  for (const p of posts) for (const f of new Set([...(p.features || []), ...(p.features_generales || generalFeatures(p))])) (by[f] ||= []).push(note(p));
  return Object.entries(by).filter(([, v]) => v.length >= min)
    .map(([f, v]) => ({ trait: f, effet: Math.round(v.reduce((a, b) => a + b, 0) / v.length - moy), posts: v.length }))
    .sort((a, b) => b.effet - a.effet);
}

// --- Rapport lisible ----------------------------------------------------------

export function rapport(data) {
  const posts = scorePosts(data).sort((a, b) => note(b) - note(a));
  const ab = data.abonnes;
  const gain = ab.length > 1 ? ab[ab.length - 1].n - (ab.find((a) => a.date >= new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10)) || ab[0]).n : null;
  const obj = objectif(data);
  const recents = [...posts].sort((a, b) => String(b.publie_le).localeCompare(String(a.publie_le))).slice(0, 10);
  const ligne = (p) => `| ${p.date} | ${p.source === 'manuel' ? 'équipe' : 'bot'} | ${p.id === 'manuel' ? (p.caption || '').split('\n')[0].slice(0, 40) : p.id} | **${note(p)}** | ${p.metrics.reach} | ${p.metrics.likes ?? '-'} | ${p.metrics.comments ?? '-'} | ${p.metrics.saved ?? '-'} | ${p.metrics.shares ?? '-'} | ${p.metrics.follows ?? '-'} |`;
  const tete = '| Date | Par | Post | Note /100 | Portée | Likes | Comm. | Enreg. | Partages | Abonnés gagnés |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |';
  const moyenne = (src) => { const l = posts.filter((p) => (p.source === 'manuel') === (src === 'manuel')); return l.length ? Math.round(l.reduce((a, p) => a + note(p), 0) / l.length) : '-'; };
  const ef = effets(data);
  return `# Teufy · ce qui marche sur Instagram

Mis à jour automatiquement chaque jour. **Note /100** : 50 = performance habituelle du compte pour ce format, 100 = deux fois mieux. Elle combine likes, commentaires (×2), enregistrements (×3), partages (×4), abonnés gagnés (×10), visites du profil, portée et, pour les reels, la part de la vidéo regardée.

**Abonnés** : ${ab.at(-1)?.n ?? '?'}${gain != null ? ` (${gain >= 0 ? '+' : ''}${gain} sur 30 jours)` : ''} · **Posts notés** : ${posts.length} · **Moyenne bot** : ${moyenne('bot')} · **Moyenne posts de l'équipe** : ${moyenne('manuel')}

## Objectif du prochain post : ${obj}/100

${recents.map((p) => `- ${p.date} ${p.id === 'manuel' ? 'post équipe' : p.id} : ${note(p)}/100 ${note(p) >= obj ? '✅' : '❌'}`).join('\n') || '- Pas encore de post noté.'}

## Meilleurs posts

${tete}
${posts.slice(0, 10).map(ligne).join('\n')}

${posts.length > 10 ? `## Moins bons\n\n${tete}\n${posts.slice(-5).reverse().map(ligne).join('\n')}\n` : ''}
## Pourquoi : ce qui fait monter ou baisser la note

Écart de note moyen quand le post a ce trait (heure, jour, format, type, style, lieu, ville, source, prix, hashtags, forme de la légende…), sur 2 posts minimum.

**Ce qui fait monter** : ${ef.filter((e) => e.effet > 0).slice(0, 12).map((e) => `${e.trait} (+${e.effet}, ${e.posts} posts)`).join(' · ') || 'pas encore assez de données'}

**Ce qui fait baisser** : ${ef.filter((e) => e.effet < 0).slice(-10).reverse().map((e) => `${e.trait} (${e.effet}, ${e.posts} posts)`).join(' · ') || '-'}

${existsSync(path.join(ROOT, 'ANALYSE.md')) ? readFileSync(path.join(ROOT, 'ANALYSE.md'), 'utf8') + '\n' : ''}${rapportTendances()}`;
}
