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
  name: 'Piege"><img src=x onerror=alert(1)><script>alert(2)</script> Soiree\rATTACH:https://evil.example/x\rX-PIEGE:1',
  start: debut.toISOString(), venue: 'Club</title><svg onload=alert(3)>', city: 'Nice', address: '1 rue <b>x</b>',
  url: 'javascript:alert(4)', image: 'javascript:alert(5)', price: -5,
  tags: ['techno"><script>alert(6)</script>'], instagram: ['x" onmouseover="alert(7)', '../../etc/passwd'],
  organisateur: '<iframe src=https://evil.example></iframe>', artistes: ['<b>DJ</b> "><svg/onload=alert(8)>'],
  accroche: 'Clique <a href="javascript:alert(9)">ici</a> {{7*7}} ${7*7}', description: '<style>body{display:none}</style>**gras** <meta http-equiv="refresh" content="0;url=https://evil.example">',
  offres: [{ url: 'javascript:alert(10)', prix: 5 }, { url: 'http://evil.example/billets', prix: 4 }], // 27/11/2026 : comparateur de prix
  confiance: 1,
};
const failles = [];
// Instantané des fichiers avant le test : tout ce que la soirée piégée a créé (pages, artistes, agenda) est retiré à la fin.
const DOSSIERS = ['', 'en/', 'it/', 'es/', 'zh/', 'ar/'].flatMap((l) => [`${l}soiree`, `${l}artistes`]).concat(['site/ics']);
const avant = new Map(DOSSIERS.map((d) => [d, new Set(existsSync(path.join(ROOT, d)) ? readdirSync(path.join(ROOT, d)) : [])]));
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
  for (const f of existsSync(path.join(ROOT, 'site/ics')) ? readdirSync(path.join(ROOT, 'site/ics')).filter((x) => /piege/.test(x) || /^agenda/.test(x)) : []) {
    const lignes = readFileSync(path.join(ROOT, 'site/ics', f), 'utf8').split(/\r\n|\r|\n/);
    if (lignes.some((l) => /^(ATTACH|X-PIEGE)/.test(l))) failles.push(`site/ics/${f} : une ligne a été injectée dans le fichier agenda`);
  }
  if (!vue) failles.push('la soirée piégée n\'apparaît nulle part : test non concluant');
  console.log(`Soirée piégée retrouvée sur ${vue} page(s) ; ${failles.length} faille(s).`);
} finally {
  writeFileSync(F, original);
  // Retire tout ce qui a été créé pendant le test (pages de la soirée et des artistes piégés, fichier agenda), toutes langues.
  for (const [d, deja] of avant) { const D = path.join(ROOT, d); if (!existsSync(D)) continue; for (const x of readdirSync(D)) if (!deja.has(x)) rmSync(path.join(D, x), { recursive: true, force: true }); }
}
for (const f of failles) console.log(`✗ ${f}`);
if (!failles.length) console.log('✓ Aucune donnée piégée n\'est exécutable ni ne modifie la page.');
process.exit(failles.length ? 1 : 0);
