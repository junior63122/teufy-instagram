#!/usr/bin/env node
// Test d'intrusion par DONNÉES PIÉGÉES (12/11/2026) : un pirate ne peut pas toucher au code, mais il peut publier une
// soirée, une page de billetterie, une bio Instagram ou un formulaire de paiement que les robots de Teufy vont lire.
// On injecte une soirée piégée (HTML, scripts, faux liens « javascript: », faux comptes, faux prix), on construit le
// site, et on vérifie qu'aucune de ces données ne ressort autrement qu'en texte inoffensif.
//   node outils/tester-donnees-piegees.mjs   (≈ 3 min ; le fichier des soirées manuelles est restauré à la fin)
import { readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const F = path.join(ROOT, 'evenements-manuels.json');
const original = readFileSync(F, 'utf8');
const debut = new Date(Date.now() + 5 * 864e5); debut.setUTCHours(21, 0, 0, 0);
const PIEGE = {
  name: 'Piege"><img src=x onerror=alert(1)><script>alert(2)</script> Soiree',
  start: debut.toISOString(), venue: 'Club</title><svg onload=alert(3)>', city: 'Nice', address: '1 rue <b>x</b>',
  url: 'javascript:alert(4)', image: 'javascript:alert(5)', price: -5,
  tags: ['techno"><script>alert(6)</script>'], instagram: ['x" onmouseover="alert(7)', '../../etc/passwd'],
  organisateur: '<iframe src=https://evil.example></iframe>', artistes: ['<b>DJ</b> "><svg/onload=alert(8)>'],
  accroche: 'Clique <a href="javascript:alert(9)">ici</a> {{7*7}} ${7*7}', description: '<style>body{display:none}</style>**gras** <meta http-equiv="refresh" content="0;url=https://evil.example">',
  confiance: 1,
};
const failles = [];
try {
  writeFileSync(F, JSON.stringify([...JSON.parse(original), PIEGE], null, 2));
  const r = spawnSync('node', ['src/run.mjs', 'site', '--force'], { cwd: ROOT, env: { ...process.env, SANS_RECHERCHE: '1', GEMINI_API_KEY: '', ANTHROPIC_API_KEY: '', IG_ACCESS_TOKEN: '' }, encoding: 'utf8', timeout: 900000 });
  if (r.status !== 0) failles.push(`construction du site en échec avec la soirée piégée : ${(r.stderr || '').slice(-300)}`);
  const pages = [];
  (function lire(d) { for (const e of readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const x = path.join(d, e.name); if (/^(node_modules|\.git|studio|media|apercus|out|outils|tests|src|contenus)/.test(x)) continue; if (e.isDirectory()) lire(x); else if (e.name.endsWith('.html')) pages.push(x); } })('.');
  const DANGERS = [
    [/<img src=x onerror/i, 'balise <img onerror> injectée'], [/<script>alert/i, 'balise <script> injectée'], [/<svg[^>]*onload/i, 'balise <svg onload> injectée'],
    [/<iframe src=https:\/\/evil/i, 'iframe injectée'], [/href="javascript:/i, 'lien javascript:'], [/src="javascript:/i, 'image javascript:'],
    [/onmouseover="alert/i, 'attribut onmouseover injecté'], [/<meta http-equiv="refresh"[^>]*evil/i, 'redirection injectée'], [/<style>body\{display:none/i, 'style injecté'],
    [/instagram\.com\/x" onmouseover/i, 'faux compte Instagram injecté dans un lien'], [/instagram\.com\/\.\.\//, 'chemin ../ dans un lien Instagram'],
  ];
  let vue = 0;
  for (const p of pages) {
    const h = readFileSync(path.join(ROOT, p), 'utf8');
    if (!/Piege/.test(h)) continue;
    vue++;
    for (const [re, m] of DANGERS) if (re.test(h)) failles.push(`${p} : ${m}`);
    if (/dès -5|>-5(,0+)?\s?€</.test(h)) failles.push(`${p} : prix négatif affiché`);
  }
  if (!vue) failles.push('la soirée piégée n\'apparaît nulle part : test non concluant');
  console.log(`Soirée piégée retrouvée sur ${vue} page(s) ; ${failles.length} faille(s).`);
} finally {
  writeFileSync(F, original);
  // Retire toutes les pages créées par la soirée piégée (soirée, artiste), dans toutes les langues.
  for (const l of ['', 'en/', 'it/', 'es/', 'zh/', 'ar/']) for (const [dir, re] of [['soiree', /^piege/], ['artistes', /svg-onload|^b-dj-b/]]) {
    const d = path.join(ROOT, l, dir); if (!existsSync(d)) continue;
    for (const x of readdirSync(d)) if (re.test(x)) rmSync(path.join(d, x), { recursive: true, force: true });
  }
}
for (const f of failles) console.log(`✗ ${f}`);
if (!failles.length) console.log('✓ Aucune donnée piégée n\'est exécutable ni ne modifie la page.');
process.exit(failles.length ? 1 : 0);
