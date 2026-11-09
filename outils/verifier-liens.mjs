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
    let f = r.startsWith('/teufy-instagram/') ? path.join(ROOT, r.slice('/teufy-instagram/'.length)) : path.resolve(path.dirname(p), r);
    if (existsSync(f) && statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!existsSync(f)) casses.set(r + '  ←  ' + path.relative(ROOT, p), true);
  }
}
console.log(`${pages.length} pages, ${n} liens internes vérifiés, ${casses.size} cassé(s)`);
for (const k of [...casses.keys()].slice(0, 40)) console.log('  ✗', k);
process.exit(casses.size ? 1 : 0);
