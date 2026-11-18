// Bilan des spots promo (media/spot-promo/) : quelles accroches et quelles fonctionnalités marchent le mieux.
// Usage : node outils/bilan-spots.mjs  (lit apprentissage.json, rempli par le robot, et historique.json ; sans IA)
import { readFileSync, existsSync, readdirSync } from 'node:fs';
const lire = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);
const posts = lire('apprentissage.json', { posts: [] }).posts.filter((p) => p.choix?.['accroche-spot']);
const vues = (p) => p.metrics?.views ?? p.metrics?.reach ?? null;
const groupe = (cle) => {
  const g = {};
  for (const p of posts) for (const v of [].concat(p.choix[cle] || [])) (g[v] ||= []).push(p);
  return Object.entries(g).map(([k, l]) => {
    const m = l.map(vues).filter((x) => x != null), n = l.map((p) => p.note).filter((x) => x != null);
    const moy = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : '–');
    return { [cle]: k, spots: l.length, vues_moy: moy(m), note_moy: moy(n), partages: l.reduce((s, p) => s + (p.metrics?.shares ?? 0) + (p.metrics?.saved ?? 0), 0) };
  }).sort((a, b) => (+b.note_moy || 0) - (+a.note_moy || 0));
};
console.log(`Spots publiés mesurés : ${posts.length}`);
if (posts.length) { console.log('\nPar accroche :'); console.table(groupe('accroche-spot')); console.log('\nPar fonctionnalité :'); console.table(groupe('fonction-spot')); }
const hist = lire('historique.json', []), faits = new Set(hist.map((h) => h.concept));
const dir = 'media/spot-promo', attente = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.mp4') && !faits.has(`spot-promo-${f.replace(/\.mp4$/, '')}`)) : [];
console.log(`\nEn attente de publication : ${attente.length}${attente.length ? ` (${attente.join(', ')})` : ''}`);
for (const f of attente) { try { const m = JSON.parse(readFileSync(`${dir}/${f.replace(/\.mp4$/, '.json')}`, 'utf8')); console.log(`  - ${f} : accroche ${m.accroche}, ${m.fonctionnalites.join(', ')}`); } catch {} }
