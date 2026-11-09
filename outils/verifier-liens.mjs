// Vérifie que chaque lien interne du site (pages, images, scripts, vidéos, .ics) pointe vers un fichier existant.
//   node outils/verifier-liens.mjs        → liste des liens cassés (code de sortie 1 s'il y en a)
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DOSSIERS = ['', 'en', 'it', 'es', 'zh', 'ar'];
const pages = [];
const parcourir = (d) => { for (const x of readdirSync(d, { withFileTypes: true })) { const f = path.join(d, x.name); if (x.isDirectory()) { if (!/^(node_modules|studio|media|out|apercus|livrables|\.git|site|src|tests|contenus|veille|outils)$/.test(x.name)) parcourir(f); } else if (x.name === 'index.html') pages.push(f); } };
parcourir(ROOT);
pages.push(path.join(ROOT, '404.html'));
const casses = new Map(); let n = 0;
for (const p of pages) {
  const html = readFileSync(p, 'utf8');
  const refs = [...html.matchAll(/\s(?:href|src|poster)="([^"]+)"/g)].map((m) => m[1]).concat([...html.matchAll(/\ssrcset="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((x) => x.trim().split(/\s+/)[0])));
  for (const m of html.matchAll(/\s(?:src|poster)="((?:\.\.\/)*)"/g)) casses.set(`(image sans fichier) « ${m[1]} »  ←  ${path.relative(ROOT, p)}`, true);
  for (let r of refs) {
    if (/^(https?:|mailto:|tel:|data:|#|javascript:)/.test(r) || !r) continue;
    r = r.replace(/&amp;/g, '&').split('#')[0].split('?')[0];
    if (!r) continue;
    n++;
    // Liens absolus : depuis la racine du domaine propre (fichier CNAME) ou depuis /teufy-instagram/ sur GitHub Pages.
    let f = r.startsWith('/teufy-instagram/') ? path.join(ROOT, r.slice('/teufy-instagram/'.length)) : r.startsWith('/') ? path.join(ROOT, r.slice(1)) : path.resolve(path.dirname(p), r);
    if (existsSync(f) && statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!existsSync(f)) casses.set(r + '  ←  ' + path.relative(ROOT, p), true);
  }
}
// Photos d'ambiance (site/img/*) : chacune sur une seule page par langue, pour éviter les répétitions.
const usages = new Map();
for (const p of pages) {
  const rel = path.relative(ROOT, p); const lang = /^(en|it|es|zh|ar)\//.test(rel) ? rel.slice(0, 2) : 'fr';
  for (const nom of new Set([...[...readFileSync(p, 'utf8').matchAll(/\s(?:src|srcset|poster|data-src|data-srcset)="([^"]+)"/g)].map((m) => m[1]).join(' ').matchAll(/site\/img\/(?:equipe\/)?([a-z]+(?:-[a-z]+)*)-(?:\d+|169)\.(?:webp)|site\/img\/(?:equipe\/)?([a-z-]+)\.(?:jpg|mp4)/g)].map((m) => m[1] || m[2]).filter((x) => !/^(logo|icone)/.test(x)))) {
    const k = `${lang}|${nom}`; if (!usages.has(k)) usages.set(k, new Set()); usages.get(k).add(rel.replace(/index\.html$/, ''));
  }
}
const repetees = [...usages].filter(([k, v]) => v.size > 1 && !k.endsWith('|junior-joyant'));
for (const [k, v] of repetees) casses.set(`(photo répétée) ${k.split('|')[1]} sur ${[...v].slice(0, 4).join(', ')}${v.size > 4 ? '…' : ''}`, true);
console.log(`${pages.length} pages, ${n} liens internes vérifiés, ${casses.size} cassé(s)`);
for (const k of [...casses.keys()].slice(0, 40)) console.log('  ✗', k);
process.exit(casses.size ? 1 : 0);
