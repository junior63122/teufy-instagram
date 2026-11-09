// Audit statique de toutes les pages générées : SEO (title, description, H1, canonical, hreflang, Open Graph,
// données structurées), sitemap et robots.txt, images (alt, dimensions), liens externes (rel), secrets exposés.
// Usage : node outils/audit-seo.mjs   (code de sortie 1 s'il reste un problème bloquant)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IGNORES = new Set(['node_modules', '.git', 'studio', 'media', 'apercus', 'out', 'site', 'contenus', 'src', 'outils', 'veille', 'tests', 'livrables']);
const pages = [];
(function parcourir(d) {
  for (const f of readdirSync(d)) {
    const p = path.join(d, f);
    if (statSync(p).isDirectory()) { if (!IGNORES.has(f) || d !== ROOT) parcourir(p); } else if (f.endsWith('.html')) pages.push(p);
  }
})(ROOT);

const domaine = existsSync(path.join(ROOT, 'CNAME')) ? `https://${readFileSync(path.join(ROOT, 'CNAME'), 'utf8').trim()}/` : 'https://junior63122.github.io/teufy-instagram/';
const bloquants = [], avertissements = [];
const titres = new Map(), descriptions = new Map();
const attr = (balise, nom) => (balise.match(new RegExp(`${nom}="([^"]*)"`)) || [])[1];
let nbImg = 0, nbLiensExt = 0, nbLd = 0;

for (const f of pages) {
  const rel = path.relative(ROOT, f);
  const h = readFileSync(f, 'utf8');
  const est404 = rel === '404.html';
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(h);
  const titre = (h.match(/<title>([^<]*)<\/title>/) || [])[1];
  const desc = attr(h.match(/<meta name="description"[^>]*>/)?.[0] || '', 'content');
  if (!titre) bloquants.push(`${rel} : pas de <title>`); else { if (titre.length > 75 && !noindex) avertissements.push(`${rel} : titre long (${titre.length} car.)`); const k = `${rel.split('/')[0].length === 2 ? rel.split('/')[0] : 'fr'}|${titre}`; (titres.get(k) || titres.set(k, []).get(k)).push(rel); }
  if (!noindex) {
    if (!desc) bloquants.push(`${rel} : pas de meta description`); else { if (desc.length < 50 || desc.length > 180) avertissements.push(`${rel} : description de ${desc.length} car.`); const kd = `${rel.split('/')[0].length === 2 ? rel.split('/')[0] : 'fr'}|${desc}`; (descriptions.get(kd) || descriptions.set(kd, []).get(kd)).push(rel); }
    const canon = attr(h.match(/<link rel="canonical"[^>]*>/)?.[0] || '', 'href');
    if (!canon) bloquants.push(`${rel} : pas de canonical`);
    else if (!canon.startsWith(domaine)) bloquants.push(`${rel} : canonical hors domaine (${canon})`);
    else { const attendu = rel.replace(/index\.html$/, ''); if (canon !== domaine + attendu) bloquants.push(`${rel} : canonical ${canon} ≠ ${domaine + attendu}`); }
    const hl = (h.match(/<link rel="alternate" hreflang="[^"]+"/g) || []).length;
    if (hl < 7) avertissements.push(`${rel} : ${hl} hreflang (6 langues + x-default attendus)`);
    for (const og of ['og:title', 'og:description', 'og:image', 'og:url']) if (!h.includes(`property="${og}"`)) bloquants.push(`${rel} : ${og} absent`);
    if (!h.includes('name="twitter:card"')) avertissements.push(`${rel} : twitter:card absent`);
  } else if (!est404) avertissements.push(`${rel} : page en noindex`);
  if (!/<html lang="[a-z]{2}"/.test(h)) bloquants.push(`${rel} : attribut lang absent`);
  if (!h.includes('name="viewport"')) bloquants.push(`${rel} : viewport absent`);
  const main = h.split('<main')[1] || h;
  const h1 = (main.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) bloquants.push(`${rel} : ${h1} titre(s) H1`);
  // Hiérarchie des titres : pas de saut (h1 → h3) dans le contenu principal.
  let prec = 1;
  for (const m of main.matchAll(/<h([1-6])[\s>]/g)) { const n = +m[1]; if (n > prec + 1) { avertissements.push(`${rel} : saut de titre h${prec} → h${n}`); break; } prec = n; }
  for (const ld of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { nbLd++; try { JSON.parse(ld[1]); } catch { bloquants.push(`${rel} : JSON-LD invalide`); } }
  for (const img of h.match(/<img\b[^>]*>/g) || []) {
    nbImg++;
    if (!/\salt="/.test(img)) bloquants.push(`${rel} : image sans attribut alt (${img.slice(0, 80)})`);
    if (!/\swidth="/.test(img) && !/class="[^"]*(principale|fond-flou|hero-photo)/.test(img) && !/data-src/.test(img)) avertissements.push(`${rel} : image sans dimensions (${(attr(img, 'src') || '').slice(-40)})`);
  }
  for (const a of h.match(/<a\b[^>]*target="_blank"[^>]*>/g) || []) { nbLiensExt++; if (!/rel="[^"]*noopener/.test(a)) bloquants.push(`${rel} : lien externe sans rel=noopener`); }
  if (/AIza[0-9A-Za-z_-]{30,}|EAA[A-Za-z0-9]{40,}|sk-[A-Za-z0-9]{30,}|ghp_[A-Za-z0-9]{30,}/.test(h)) bloquants.push(`${rel} : ressemble à une clé secrète exposée !`);
}
for (const [t, l] of titres) if (l.length > 1) avertissements.push(`titre en double sur ${l.length} pages : « ${t.slice(0, 60)} » (${l.slice(0, 3).join(', ')})`);
for (const [d, l] of descriptions) if (l.length > 1) avertissements.push(`description en double sur ${l.length} pages (${l.slice(0, 3).join(', ')})`);

// Sitemap et robots.txt
const sm = readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const u of locs) { if (!u.startsWith(domaine)) { bloquants.push(`sitemap : URL hors domaine ${u}`); continue; } const f = path.join(ROOT, u.slice(domaine.length), 'index.html'); if (!existsSync(f) && !existsSync(path.join(ROOT, u.slice(domaine.length)))) bloquants.push(`sitemap : page absente ${u}`); }
const indexables = pages.filter((f) => !/<meta name="robots" content="[^"]*noindex/.test(readFileSync(f, 'utf8'))).map((f) => domaine + path.relative(ROOT, f).replace(/index\.html$/, ''));
const dansSm = new Set(locs);
const absents = indexables.filter((u) => !dansSm.has(u));
if (absents.length) avertissements.push(`${absents.length} page(s) indexable(s) absentes du sitemap (ex. ${absents.slice(0, 3).join(', ')})`);
const robots = readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
if (!robots.includes(`Sitemap: ${domaine}sitemap.xml`)) bloquants.push('robots.txt : lien vers le sitemap absent ou mauvais domaine');
if (/Disallow:\s*\/\s*$/m.test(robots)) bloquants.push('robots.txt bloque tout le site');

console.log(`${pages.length} pages, ${locs.length} URL dans le sitemap, ${nbImg} images, ${nbLiensExt} liens externes, ${nbLd} blocs JSON-LD`);
const resume = (l) => { const c = new Map(); for (const x of l) { const k = x.replace(/^[^:]+ : /, '').replace(/\(.*\)/, '').replace(/\d+/g, 'N'); c.set(k, [...(c.get(k) || []), x]); } return [...c.values()].map((v) => `${v[0]}${v.length > 1 ? `  (+${v.length - 1} autres)` : ''}`); };
if (avertissements.length) console.log(`⚠ ${avertissements.length} avertissement(s) :\n- ${resume(avertissements).slice(0, 25).join('\n- ')}`);
console.log(bloquants.length ? `✗ ${bloquants.length} problème(s) bloquant(s) :\n- ${resume(bloquants).slice(0, 40).join('\n- ')}` : '✓ Aucun problème bloquant.');
process.exit(bloquants.length ? 1 : 0);
