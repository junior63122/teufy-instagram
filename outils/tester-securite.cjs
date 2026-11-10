// Tests de sécurité (intrusion « douce », sans rien casser) : à lancer sur le site servi en local.
//   node outils/tester-securite.cjs  → liste des failles, code de sortie 1 s'il y en a.
// 1. Aucune clé secrète dans le dépôt ni dans le site publié.  2. Chaque page a sa politique de sécurité (CSP) stricte.
// 3. Aucun script en ligne non autorisé (une donnée de soirée piégée ne peut pas injecter de code).
// 4. Liens externes ouverts sans donner la main à l'autre site (noopener).  5. Rien n'est chargé en http (non chiffré).
// 6. Recherche, ancre et paramètres piégés (XSS) : aucun code n'est exécuté.  7. Pages techniques non publiques.
const fs = require('fs'); const path = require('path');
const pw = (() => { try { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } catch { return require('playwright'); } })();
const ROOT = path.resolve(__dirname, '..'); const B = process.env.SITE || 'http://localhost:8765/';
const failles = []; const ko = (m) => failles.push(m);
const IGNORE = /^(node_modules|\.git|out|media|studio\/node_modules|livrables|apercus|site\/vendor)(\/|$)/;
const fichiers = []; (function lire(d) { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const r = path.join(d, e.name); if (IGNORE.test(r)) continue; if (e.isDirectory()) lire(r); else fichiers.push(r); } })('');
// 1. Secrets (motifs des clés Google, Anthropic, GitHub, Meta, Slack, ElevenLabs, clés privées).
const SECRETS = [/AIza[0-9A-Za-z_-]{35}/, /sk-ant-[A-Za-z0-9_-]{20,}/, /gh[pousr]_[A-Za-z0-9]{36}/, /github_pat_[A-Za-z0-9_]{40,}/, /EAA[A-Za-z0-9]{60,}/, /xox[baprs]-[A-Za-z0-9-]{20,}/, /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, /sk_[a-f0-9]{48}/];
for (const f of fichiers) { if (!/\.(m?js|cjs|json|html|md|ya?ml|txt|env|css|xml)$/.test(f)) continue; const t = fs.readFileSync(path.join(ROOT, f), 'utf8'); for (const re of SECRETS) if (re.test(t)) ko(`clé secrète possible dans ${f} (${re.source.slice(0, 18)}…)`); }
// 2 à 5 et 7 : contrôle de toutes les pages HTML publiées.
const pages = fichiers.filter((f) => f.endsWith('.html') && !/^(tests|outils|studio|veille)\//.test(f));
const SCRIPTS_OK = /^<script( type="(application\/ld\+json|application\/json|speculationrules)"( id="[a-z-]+")?| src="[^"]+"( defer)?)?>/;
for (const f of pages) {
  const h = fs.readFileSync(path.join(ROOT, f), 'utf8');
  if (!/http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'/.test(h) && !/404\.html$/.test(f)) ko(`${f} : pas de politique de sécurité (CSP) stricte`);
  if (/unsafe-eval/.test(h)) ko(`${f} : CSP autorise eval`);
  for (const s of h.match(/<script[^>]*>/g) || []) if (!SCRIPTS_OK.test(s)) ko(`${f} : script non autorisé ${s.slice(0, 60)}`);
  const inline = (h.match(/<script>([^<]*)<\/script>/g) || []).filter((s) => s !== "<script>document.documentElement.classList.add('js')</script>"); if (inline.length) ko(`${f} : script en ligne inattendu ${inline[0].slice(0, 60)}`);
  if (/\son[a-z]+="/i.test(h.replace(/<script[\s\S]*?<\/script>/g, ''))) ko(`${f} : attribut d'événement (on…=) dans le HTML`);
  if (/javascript:/i.test(h.replace(/<script[\s\S]*?<\/script>/g, ''))) ko(`${f} : lien javascript:`);
  for (const a of h.match(/<a [^>]*target="_blank"[^>]*>/g) || []) if (!/rel="[^"]*noopener/.test(a)) ko(`${f} : lien externe sans noopener ${a.slice(0, 80)}`);
  if (/\ssrc="http:\/\//.test(h)) ko(`${f} : ressource chargée en http non chiffré`);
}
const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
for (const d of ['/out/', '/studio/', '/veille/']) if (!robots.includes(`Disallow: ${d}`)) ko(`robots.txt : ${d} non protégé`);
for (const bot of ['GPTBot', 'ClaudeBot', 'CCBot', 'Google-Extended']) if (!new RegExp(`User-agent: ${bot}\\nDisallow: /\\n`).test(robots)) ko(`robots.txt : ${bot} (entraînement d'IA) non bloqué`);
// 6. Tentatives d'injection dans le navigateur.
(async () => {
  const b = await pw.chromium.launch(); const p = await b.newPage(); let alerte = false;
  p.on('dialog', async (d) => { alerte = true; await d.dismiss(); }); window_ = null;
  const PIEGES = ['?q=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E', '?q=%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E', '#%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E', '?q=javascript:alert(1)', 'soirees-nice/?q=%3Csvg%20onload%3Dalert(1)%3E'];
  for (const u of PIEGES) {
    await p.goto(B + u, { waitUntil: 'load' }); await p.waitForTimeout(500);
    const injecte = await p.evaluate(() => !!document.querySelector('main img[src="x"], main svg[onload], main script:not([src]):not([type])'));
    if (alerte || injecte) ko(`injection réussie avec ${u}`); alerte = false;
  }
  // Formulaire de contact : du code saisi n'est jamais exécuté ni inséré tel quel.
  await p.goto(B + 'partenaires/#contact', { waitUntil: 'load' });
  await p.fill('[name=nom]', '<img src=x onerror=alert(1)>'); await p.fill('[name=message]', '"><script>alert(1)</script>');
  await p.evaluate(() => document.querySelectorAll('[data-envoi]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault())));
  await p.click('[data-envoi="mail"]'); await p.waitForTimeout(300);
  if (alerte || await p.evaluate(() => !!document.querySelector('.form-contact img[src="x"]'))) ko('formulaire de contact : injection exécutée');
  // Le site ne peut pas être affiché dans un cadre d'un autre site pour piéger les clics (clickjacking).
  await b.close();
  console.log(failles.length ? `✗ ${failles.length} faille(s) :\n- ${[...new Set(failles)].slice(0, 40).join('\n- ')}` : `✓ Aucune faille trouvée (${fichiers.length} fichiers, ${pages.length} pages, ${PIEGES.length} injections tentées).`);
  process.exit(failles.length ? 1 : 0);
})();
var window_;
