// Veille technique quotidienne (20/11/2026, directeur : « surveille les mises à jour de tout ce qu'on utilise pour ne
// jamais être pris de cours quand un prestataire arrête une fonctionnalité ; une fois par jour »). Sans IA, gratuit.
// Relève : version de l'API Instagram (et la dernière publiée par Meta), modèles Groq et Gemini encore ouverts,
// actions GitHub et Node, dépendances npm en retard ou vulnérables, état de chaque billetterie et site source.
// Résultat : contenus/veille-technique.json (alertes en tête), lu chaque jour par Claude qui répare et s'adapte.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEvents } from '../src/extract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const alertes = [], R = { le: new Date().toISOString() };
const alerte = (sujet, detail) => { alertes.push({ sujet, detail }); console.log(`ALERTE ${sujet} : ${detail}`); };
const get = async (url, opt = {}) => { const r = await fetch(url, { ...opt, signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; TeufyVeille/1.0)', ...(opt.headers || {}) } }); return r; };
const essai = async (nom, f) => { try { await f(); } catch (err) { R[nom] = { erreur: String(err.message || err).slice(0, 200) }; console.log(`${nom} : ${R[nom].erreur}`); } };

// 1. Instagram (Meta Graph API) : version utilisée, dernière version publiée, avertissements de fin de vie.
await essai('instagram', async () => {
  const src = readFileSync(path.join(ROOT, 'src', 'instagram.mjs'), 'utf8');
  const utilisee = process.env.IG_API_VERSION || src.match(/IG_API_VERSION \|\| '(v\d+\.\d+)'/)?.[1];
  const page = await (await get('https://developers.facebook.com/docs/graph-api/changelog/')).text();
  const versions = [...page.matchAll(/v(\d{2,3})\.0/g)].map((m) => +m[1]);
  const derniere = versions.length ? Math.max(...versions) : null;
  R.instagram = { utilisee, derniere: derniere ? `v${derniere}.0` : null };
  const n = +String(utilisee).replace(/[^\d.]/g, '').split('.')[0];
  if (derniere && n && derniere - n >= 3) alerte('Instagram', `API ${utilisee} utilisée, Meta en est à v${derniere}.0 : une version vit environ 2 ans, passer à une version récente (tester une publication).`);
  const token = (process.env.IG_ACCESS_TOKEN || '').trim(), user = (process.env.IG_USER_ID || '').trim();
  if (token && user) {
    const r = await get(`https://${process.env.IG_API_HOST || 'graph.facebook.com'}/${utilisee}/${user}?fields=id,username&access_token=${encodeURIComponent(token)}`);
    const j = await r.json().catch(() => ({}));
    const avert = [...r.headers].filter(([k]) => /deprecat|warning|api-version/i.test(k)).map(([k, v]) => `${k}: ${v}`);
    R.instagram.compte = j.username || null; R.instagram.entetes = avert;
    if (j.error) alerte('Instagram', `appel de contrôle refusé : ${j.error.message?.slice(0, 160)} (code ${j.error.code})`);
    if (avert.some((x) => /deprecat/i.test(x))) alerte('Instagram', `avertissement de Meta : ${avert.join(' | ').slice(0, 200)}`);
  }
});

// 2. IA gratuites : modèles encore ouverts (un modèle retiré casse la veille, les traductions, la lecture d'affiches).
await essai('groq', async () => {
  if (!process.env.GROQ_API_KEY) { R.groq = { cle: false }; return; }
  const j = await (await get('https://api.groq.com/openai/v1/models', { headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}` } })).json();
  const ouverts = (j.data || []).map((m) => m.id).sort();
  const src = readFileSync(path.join(ROOT, 'src', 'llm.mjs'), 'utf8');
  const pref = (nom) => JSON.parse((src.match(new RegExp(`const ${nom} = (\\[[^\\]]*\\])`))?.[1] || '[]').replace(/'/g, '"'));
  R.groq = { ouverts };
  for (const [nom, usage] of [['PREF_JSON', 'textes et JSON'], ['PREF_VISION', 'lecture d\'images (affiches)'], ['PREF_RECHERCHE', 'recherche web']]) {
    const dispo = pref(nom).filter((m) => ouverts.includes(m));
    R.groq[nom] = dispo;
    if (!dispo.length) alerte('Groq', `aucun modèle ${usage} ouvert parmi ${pref(nom).join(', ')} ; ouverts : ${ouverts.join(', ')}`);
  }
});
await essai('gemini', async () => {
  if (!process.env.GEMINI_API_KEY) { R.gemini = { cle: false }; return; }
  const j = await (await get(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${process.env.GEMINI_API_KEY}`)).json();
  const ouverts = (j.models || []).map((m) => m.name.replace('models/', ''));
  const cfg = JSON.parse(readFileSync(path.join(ROOT, 'config.json'), 'utf8')).llm || {};
  R.gemini = { modele: cfg.modele_gemini, ouvert: ouverts.includes(cfg.modele_gemini), flash: ouverts.filter((m) => /flash/.test(m)).slice(-8) };
  if (cfg.modele_gemini && !R.gemini.ouvert) alerte('Gemini', `modèle ${cfg.modele_gemini} plus proposé ; flash ouverts : ${R.gemini.flash.join(', ')}`);
});

// 3. GitHub Actions et Node : versions des actions utilisées, Node en fin de vie.
await essai('github', async () => {
  const dir = path.join(ROOT, '.github', 'workflows');
  const txt = readdirSync(dir).map((f) => readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const actions = [...new Set([...txt.matchAll(/uses: ([\w.-]+\/[\w.-]+)@v(\d+)/g)].map((m) => `${m[1]}@v${m[2]}`))];
  R.github = { actions: {} };
  for (const a of actions) {
    const [nom, v] = a.split('@v');
    const r = await get(`https://api.github.com/repos/${nom}/releases/latest`, process.env.GITHUB_TOKEN ? { headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } } : {});
    const tag = (await r.json().catch(() => ({}))).tag_name || '';
    const majeure = +tag.replace(/^v/, '').split('.')[0];
    R.github.actions[a] = tag;
    if (majeure > +v) alerte('GitHub Actions', `${nom} : v${v} utilisée, ${tag} publiée (les anciennes versions finissent par être bloquées).`);
  }
  const nodes = [...new Set([...txt.matchAll(/node-version: (\d+)/g)].map((m) => +m[1]))];
  const sorties = await (await get('https://nodejs.org/dist/index.json')).json();
  const lts = Math.max(...sorties.filter((s) => s.lts).map((s) => +s.version.slice(1).split('.')[0]));
  R.node = { utilisees: nodes, lts };
  // Fin de vie : une version paire vit 30 mois après sa sortie (avril de l'année N) → fin avril N+3.
  for (const n of nodes) { const sortie = sorties.filter((s) => +s.version.slice(1).split('.')[0] === n).at(-1)?.date; const fin = sortie ? new Date(`${+sortie.slice(0, 4) + 3}-04-30`) : null; if (fin && fin < new Date()) alerte('Node', `Node ${n} est en fin de vie depuis ${fin.toISOString().slice(0, 10)} : passer à Node ${lts} dans les workflows.`); }
});

// 4. Dépendances npm : vulnérabilités et retards (racine et studio).
await essai('npm', async () => {
  R.npm = {};
  for (const d of ['.', 'studio']) {
    if (!existsSync(path.join(ROOT, d, 'package.json'))) continue;
    let audit = {}; try { audit = JSON.parse(execSync('npm audit --omit=dev --json', { cwd: path.join(ROOT, d), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 120000 })); } catch (e) { try { audit = JSON.parse(e.stdout || '{}'); } catch {} }
    const v = audit.metadata?.vulnerabilities || {};
    R.npm[d] = { vulnerabilites: v };
    if ((v.high || 0) + (v.critical || 0)) alerte('npm', `${d} : ${v.critical || 0} faille(s) critique(s), ${v.high || 0} haute(s) (npm audit).`);
  }
});

// 5. Billetteries et sites sources : chacun doit encore répondre et donner des soirées (une source muette = des trous).
await essai('sources', async () => {
  const cfg = JSON.parse(readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
  R.sources = {};
  for (const [source, urls] of Object.entries(cfg.sources || {})) for (const url of Array.isArray(urls) ? urls : []) {
    try { const r = await get(url, { headers: { 'accept-language': 'fr-FR,fr;q=0.9' } }); const html = await r.text(); const n = r.ok ? extractEvents(html, { source, baseUrl: url }).length : 0; R.sources[url] = { http: r.status, soirees: n }; }
    catch (err) { R.sources[url] = { erreur: String(err.message || err).slice(0, 80) }; }
  }
  const muettes = Object.entries(R.sources).filter(([, s]) => !s.soirees);
  if (muettes.length) alerte('Sources', `${muettes.length} source(s) sans soirée lue : ${muettes.map(([u, s]) => `${u} (${s.http || s.erreur})`).join(' ; ').slice(0, 900)}`);
  const clubs = existsSync(path.join(ROOT, 'contenus', 'sites-clubs.json')) ? JSON.parse(readFileSync(path.join(ROOT, 'contenus', 'sites-clubs.json'), 'utf8')) : null;
  if (clubs) R.sites_clubs = { maj: clubs.maj, lus: Object.values(clubs.sites || {}).filter((s) => !s.erreur).length, avec_soirees: Object.values(clubs.sites || {}).filter((s) => s.soirees).length, total: Object.keys(clubs.sites || {}).length };
});

// 6. Données des soirées : ce qui manque (heure, prix, affiche, billetterie) dans les 7 prochains jours.
await essai('donnees', async () => {
  const ev = JSON.parse(readFileSync(path.join(ROOT, 'evenements-web.json'), 'utf8')).evenements || [];
  const sem = ev.filter((e) => { const t = Date.parse(e.start); return t > Date.now() - 6 * 3600e3 && t < Date.now() + 7 * 864e5; });
  const floue = (d) => /^(00:00|23:59)$/.test(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(d)));
  R.donnees = { semaine: sem.length, sans_heure: sem.filter((e) => floue(e.start)).length, sans_prix: sem.filter((e) => e.price == null).length, sans_affiche: sem.filter((e) => !e.image).length, sans_billetterie: sem.filter((e) => !/^https?:\/\/[^/]+\/.+/.test(e.url || '')).length };
  const ville = {}; for (const e of sem) ville[e.city || '?'] = (ville[e.city || '?'] || 0) + 1; R.donnees.par_ville = ville;
  if (sem.length < 40) alerte('Soirées', `seulement ${sem.length} soirée(s) dans les 7 prochains jours : sources à renforcer.`);
});

// 7. Soirées sans image (relevé du site) et lieux écrits comme un pseudo Instagram.
await essai('images', async () => {
  const f = path.join(ROOT, 'contenus', 'soirees-sans-image.json');
  if (!existsSync(f)) return;
  const j = JSON.parse(readFileSync(f, 'utf8')), proches = (j.sans_image || []).filter((s) => Date.parse(`${s.jour}T23:00:00Z`) < Date.now() + 7 * 864e5);
  R.images = { total: j.total, sans_image: (j.sans_image || []).length, dans_7_jours: proches.length };
  if (proches.length) alerte('Images', `${proches.length} soirée(s) des 7 prochains jours sans affiche ni photo : ${proches.slice(0, 15).map((s) => `${s.nom} (${s.lieu || s.ville}, ${s.jour})`).join(' ; ')}`);
  const pseudos = (JSON.parse(readFileSync(path.join(ROOT, 'evenements-web.json'), 'utf8')).evenements || []).filter((e) => /^@?[a-z0-9]+([._][a-z0-9]+)+$/.test(String(e.venue || '').trim()));
  if (pseudos.length) alerte('Lieux', `${pseudos.length} soirée(s) avec un pseudo Instagram comme lieu : ${pseudos.slice(0, 8).map((e) => e.venue).join(', ')}`);
});

R.alertes = alertes;
writeFileSync(path.join(ROOT, 'contenus', 'veille-technique.json'), `${JSON.stringify(R, null, 1)}\n`);
console.log(`Veille technique : ${alertes.length} alerte(s).`);
