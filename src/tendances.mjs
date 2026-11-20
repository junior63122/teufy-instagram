// Veille des tendances : analyse chaque jour les posts publics de comptes nightlife
// (API officielle Instagram « Business Discovery », pas de scraping) et en tire :
//  - les hashtags qui accompagnent les posts les plus engageants (score 0 à 1),
//  - les formats qui marchent le mieux (carrousel, reel, image),
//  - les heures de publication des meilleurs posts,
//  - les premières lignes (accroches) des meilleurs posts, pour inspiration.
// Résultat : tendances-auto.json, lu par les légendes (hashtags) et le rapport.
import { readFileSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TENDANCES = JSON.parse(readFileSync(path.join(ROOT, 'contenus', 'tendances.json'), 'utf8'));
const AUTO = path.join(ROOT, 'tendances-auto.json');

// Comptes suivis : la liste de contenus/tendances.json (concurrents, médias nightlife) + les organisateurs, clubs et
// lieux repérés par la recherche de soirées (contenus/organisateurs.json). Au plus 40 comptes par jour.
export function comptesSuivis() {
  let orgas = {};
  try { orgas = JSON.parse(readFileSync(path.join(ROOT, 'contenus', 'organisateurs.json'), 'utf8')); } catch { /* rien */ }
  const tous = [...TENDANCES.comptes_a_suivre.liste, ...(TENDANCES.concurrents?.liste || []), ...(TENDANCES.inspirations_internationales?.liste || []), ...(orgas.valides || []), ...(orgas.comptes || []).map((c) => c.handle || c), ...(orgas.suggeres || [])];
  return [...new Set(tous.filter((h) => typeof h === 'string' && /^[a-z0-9._]{2,30}$/i.test(h)).map((h) => h.toLowerCase()))].slice(0, 40);
}

export function tendancesAuto() {
  return existsSync(AUTO) ? JSON.parse(readFileSync(AUTO, 'utf8')) : { hashtags: {}, formats: {}, heures: {}, accroches: [] };
}

// Score de tendance d'un hashtag (0 à 1), 0 si inconnu.
export function scoreHashtag(tag) {
  return tendancesAuto().hashtags?.[tag.toLowerCase()] || 0;
}

export async function analyserComptes({ ig, api, now = new Date(), force = false }) {
  const prev = tendancesAuto();
  if (!force && prev.maj && (now - new Date(prev.maj)) / 86400e3 < 0.9) return { deja: true };
  // 20/11/2026 : le quota Instagram n'autorise qu'une partie des comptes par passage (src/instagram.mjs). Les comptes sont
  // relus à tour de rôle (le plus ancien d'abord) et le détail de leurs posts est gardé 10 jours entre deux lectures.
  const detail = prev.detail || {};
  const ordre = comptesSuivis().sort((a, b) => Date.parse(detail[a]?.maj || 0) - Date.parse(detail[b]?.maj || 0));
  const comptes = { ...(prev.comptes || {}) };
  for (const handle of ordre) {
    try {
      const bd = await api.businessDiscovery(handle, ig);
      detail[handle] = { maj: now.toISOString(), abonnes: bd.followers_count || 0, posts: (bd.media?.data || []).map((m) => ({
        ts: m.timestamp, format: m.media_product_type === 'REELS' ? 'reel' : m.media_type === 'CAROUSEL_ALBUM' ? 'carrousel' : 'image',
        likes: m.like_count || 0, comm: m.comments_count || 0, accroche: (m.caption || '').split('\n')[0].slice(0, 140), caption: (m.caption || '').slice(0, 600), lien: m.permalink })) };
      comptes[handle] = { abonnes: bd.followers_count, posts: detail[handle].posts.length };
    } catch (err) {
      if (/quota Instagram|request limit/i.test(err.message)) break; // la suite au prochain passage
      comptes[handle] = { erreur: String(err.message || err).slice(0, 160) };
    }
  }
  for (const h of Object.keys(detail)) if (!comptesSuivis().includes(h) || now - Date.parse(detail[h].maj) > 10 * 864e5) delete detail[h];
  const posts = Object.entries(detail).flatMap(([handle, d]) => d.posts.map((m) => ({ handle, timestamp: m.ts, media_product_type: m.format === 'reel' ? 'REELS' : '', media_type: m.format === 'carrousel' ? 'CAROUSEL_ALBUM' : 'IMAGE',
    like_count: m.likes, comments_count: m.comm, caption: m.caption, permalink: m.lien, eng: (m.likes + 3 * m.comm) / Math.max(d.abonnes, 100) })));
  if (!posts.length) {
    const out = { ...prev, maj: now.toISOString(), comptes, detail };
    await writeFile(AUTO, JSON.stringify(out, null, 2));
    return out;
  }

  // Engagement relatif au compte (pour comparer petits et gros comptes).
  const byHandle = {};
  for (const p of posts) (byHandle[p.handle] ||= []).push(p);
  for (const list of Object.values(byHandle)) {
    const med = [...list].sort((a, b) => a.eng - b.eng)[Math.floor(list.length / 2)].eng || 1e-6;
    for (const p of list) p.rel = p.eng / med;
  }

  // Hashtags : moyenne de l'engagement relatif, présents chez au moins 2 comptes.
  const tags = {};
  for (const p of posts) {
    for (const t of new Set((p.caption || '').toLowerCase().match(/#[\p{L}\p{N}_]+/gu) || [])) {
      const s = (tags[t] ||= { sum: 0, n: 0, comptes: new Set() });
      s.sum += p.rel; s.n++; s.comptes.add(p.handle);
    }
  }
  const tagScores = Object.entries(tags).filter(([, s]) => s.comptes.size >= 2 && s.n >= 3).map(([t, s]) => [t, s.sum / s.n]);
  const maxT = Math.max(1e-6, ...tagScores.map((x) => x[1]));
  const hashtags = Object.fromEntries(tagScores.sort((a, b) => b[1] - a[1]).slice(0, 40).map(([t, v]) => [t, +(v / maxT).toFixed(3)]));

  // Formats et heures (Paris) des posts.
  const fmt = (p) => (p.media_product_type === 'REELS' ? 'reel' : p.media_type === 'CAROUSEL_ALBUM' ? 'carrousel' : 'image');
  const agg = (keyOf) => {
    const o = {};
    for (const p of posts) { const k = keyOf(p); const s = (o[k] ||= { sum: 0, n: 0 }); s.sum += p.rel; s.n++; }
    return Object.fromEntries(Object.entries(o).map(([k, s]) => [k, { score: +(s.sum / s.n).toFixed(2), posts: s.n }]));
  };
  const heureParis = (p) => +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: 'numeric', hourCycle: 'h23' }).format(new Date(p.timestamp));
  const top = [...posts].sort((a, b) => b.rel - a.rel).slice(0, 12);
  const out = {
    maj: now.toISOString(),
    comptes,
    hashtags,
    formats: agg(fmt),
    heures: agg(heureParis),
    accroches: top.map((p) => ({ compte: p.handle, format: fmt(p), score: +p.rel.toFixed(2), accroche: (p.caption || '').split('\n')[0].slice(0, 140), lien: p.permalink })),
    reperes: reperes(detail, now),
    detail,
  };
  await writeFile(AUTO, JSON.stringify(out, null, 2));
  return out;
}

// Section du rapport : ce qui marche chez les autres comptes.
// Repères par compte (20/11/2026, directeur : « analyse bien les concurrents ») : rythme de publication, likes et
// commentaires habituels, taux d'interaction, part de reels, et leurs 3 meilleurs posts (accroche, format, chiffres).
const mediane = (l) => { const t = [...l].sort((a, b) => a - b); return t.length ? t[Math.floor(t.length / 2)] : 0; };
export function reperes(detail, now = new Date()) {
  const out = {};
  for (const [h, d] of Object.entries(detail || {})) {
    const P = d.posts || []; if (!P.length) continue;
    const dates = P.map((p) => Date.parse(p.ts)).filter(Boolean).sort((a, b) => a - b);
    const semaines = Math.max(1, (now - dates[0]) / (7 * 864e5));
    out[h] = {
      abonnes: d.abonnes, posts_par_semaine: +(P.length / semaines).toFixed(1),
      likes: mediane(P.map((p) => p.likes)), commentaires: mediane(P.map((p) => p.comm)),
      taux_pour_cent: +((100 * mediane(P.map((p) => p.likes + p.comm))) / Math.max(d.abonnes, 1)).toFixed(2),
      part_reels: +(P.filter((p) => p.format === 'reel').length / P.length).toFixed(2),
      meilleurs: [...P].sort((a, b) => (b.likes + 3 * b.comm) - (a.likes + 3 * a.comm)).slice(0, 3).map((p) => ({ format: p.format, likes: p.likes, comm: p.comm, accroche: p.accroche, lien: p.lien })),
    };
  }
  return out;
}

export function rapportTendances() {
  const t = tendancesAuto();
  if (!t.maj) return '## Tendances des autres comptes\n\n- Pas encore analysées (il faut les secrets Instagram).\n';
  const fm = Object.entries(t.formats || {}).sort((a, b) => b[1].score - a[1].score).map(([k, v]) => `${k} ${v.score} (${v.posts} posts)`).join(' · ');
  const hs = Object.entries(t.heures || {}).sort((a, b) => b[1].score - a[1].score).slice(0, 3).map(([k, v]) => `${k}h (${v.score})`).join(', ');
  return `## Tendances des autres comptes (${t.maj.slice(0, 10)})

- **Formats qui marchent** : ${fm || '-'}
- **Meilleures heures** : ${hs || '-'}
- **Hashtags qui accompagnent les meilleurs posts** : ${Object.keys(t.hashtags || {}).slice(0, 12).join(' ') || '-'}

**Accroches des meilleurs posts** (pour inspiration) :
${(t.accroches || []).slice(0, 8).map((a) => `- @${a.compte} (${a.format}, ×${a.score}) : « ${a.accroche} »`).join('\n') || '-'}
${Object.keys(t.reperes || {}).length ? `
**Repères par compte** (médianes de leurs derniers posts ; taux = likes + commentaires pour 100 abonnés) :

| Compte | Abonnés | Posts/sem. | Likes | Comm. | Taux | Part de reels | Meilleur post |
| --- | --- | --- | --- | --- | --- | --- | --- |
${Object.entries(t.reperes).sort((a, b) => b[1].taux_pour_cent - a[1].taux_pour_cent).map(([h, r]) => `| @${h} | ${r.abonnes} | ${r.posts_par_semaine} | ${r.likes} | ${r.commentaires} | ${r.taux_pour_cent} % | ${Math.round(r.part_reels * 100)} % | ${r.meilleurs[0] ? `${r.meilleurs[0].format}, ${r.meilleurs[0].likes} likes : « ${r.meilleurs[0].accroche.replace(/\|/g, '/').slice(0, 70)} »` : '-'} |`).join('\n')}
` : ''}`;
}
