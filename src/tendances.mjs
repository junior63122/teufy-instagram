// Veille des tendances : analyse chaque semaine les posts publics de comptes nightlife
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

export function tendancesAuto() {
  return existsSync(AUTO) ? JSON.parse(readFileSync(AUTO, 'utf8')) : { hashtags: {}, formats: {}, heures: {}, accroches: [] };
}

// Score de tendance d'un hashtag (0 à 1), 0 si inconnu.
export function scoreHashtag(tag) {
  return tendancesAuto().hashtags?.[tag.toLowerCase()] || 0;
}

export async function analyserComptes({ ig, api, now = new Date(), force = false }) {
  const prev = tendancesAuto();
  if (!force && prev.maj && (now - new Date(prev.maj)) / 86400e3 < 6.5) return { deja: true };
  const posts = [];
  const comptes = {};
  for (const handle of TENDANCES.comptes_a_suivre.liste) {
    try {
      const bd = await api.businessDiscovery(handle, ig);
      const followers = Math.max(bd.followers_count || 0, 100);
      const media = bd.media?.data || [];
      for (const m of media) {
        const eng = ((m.like_count || 0) + 3 * (m.comments_count || 0)) / followers;
        posts.push({ ...m, handle, eng });
      }
      comptes[handle] = { abonnes: bd.followers_count, posts: media.length };
    } catch (err) {
      comptes[handle] = { erreur: String(err.message || err).slice(0, 160) };
    }
  }
  if (!posts.length) {
    const out = { ...prev, maj: now.toISOString(), comptes };
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
  };
  await writeFile(AUTO, JSON.stringify(out, null, 2));
  return out;
}

// Section du rapport : ce qui marche chez les autres comptes.
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
`;
}
