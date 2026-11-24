#!/usr/bin/env node
// Contrôle des DONNÉES affichées sur le site (12/11/2026, demande du directeur : « il ne faut jamais d'erreur, tout est
// censé être vérifié et de qualité impeccable »). Sans IA. Complète verifier-liens (liens), audit-seo (balises) et
// tester-site (affichage) : ici on lit ce que le visiteur LIT.
//   - texte visible cassé : undefined, NaN, null, [object Object], &amp; doublé, balises ou markdown qui traînent ;
//   - soirées : déjà passées, en double, date du titre ≠ date de la soirée, heure fantôme (23h59), prix aberrant,
//     lien billetterie vers une page de recherche, ville incohérente avec le lieu, compte Instagram non vérifié ;
//   - images : affiche absente du disque, affiche trop petite (floue).
// Sortie : liste des problèmes ; code 1 s'il y a des erreurs bloquantes (utilisable en CI).
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f, d) => { try { return JSON.parse(readFileSync(path.join(ROOT, f), 'utf8')); } catch { return d; } };
const erreurs = [], alertes = [];
const OCR = process.argv.includes('--ocr');
// Même lecture des dates que le contrôle des carrousels (studio/scripts/affiches.mjs).
const srcAff = readFileSync(path.join(ROOT, 'studio', 'scripts', 'affiches.mjs'), 'utf8');
const { datesLues, dateCompatible } = new Function(`${srcAff.slice(srcAff.indexOf('const MOIS'), srcAff.indexOf('function ocrAffiche')).replace(/export function/g, 'function')}; return { datesLues, dateCompatible };`)();
const err = (page, m) => erreurs.push(`${page} : ${m}`);
const alerte = (page, m) => alertes.push(`${page} : ${m}`);

// --- 1. Texte visible de toutes les pages ---------------------------------------------------------------------
function pages(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (/^(node_modules|\.git|studio|media|apercus|out|tests|outils|src|contenus|veille)$/.test(n)) continue;
    const f = path.join(dir, n);
    const st = statSync(f);
    if (st.isDirectory()) pages(f, out); else if (n === 'index.html') out.push(f);
  }
  return out;
}
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
const texte = (html) => visible(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const MAUVAIS = [
  [/\bundefined\b/, 'mot « undefined » affiché'], [/\bNaN\b/, '« NaN » affiché'], [/\[object Object\]/, '« [object Object] » affiché'],
  [/>\s*null\s*</, '« null » affiché'], [/&amp;(amp|lt|gt|quot|#\d+);/, 'caractère spécial doublement échappé'],
  [/\*\*[^*\n]{2,60}\*\*/, 'markdown (**…**) non converti'], [/&lt;\/?(b|i|em|strong|br|p|a)\b/, 'balise HTML affichée en texte'],
  [/\b23h59\b/, 'heure fantôme 23h59'], [/\bdès\s+dès\b/, '« dès dès »'], [/\s,\s*,/, 'virgules doublées'], [/\(\s*\)/, 'parenthèses vides'],
  [/\b(lorem ipsum|Lorem ipsum)\b|\b(TODO|FIXME)\b/, 'texte provisoire'], [/\b(\w{3,})\s+\1\b/i, null],
];
const liste = pages(ROOT);
for (const f of liste) {
  const rel = path.relative(ROOT, f).replace(/index\.html$/, '') || '/';
  const html = readFileSync(f, 'utf8');
  const t = visible(html), tt = texte(html);
  for (const [re, m] of MAUVAIS) {
    // Mots répétés : à l'intérieur d'un même texte seulement (pas entre deux éléments voisins).
    const x = m ? t.match(re) : visible(html).split(/<[^>]+>/).map((n) => n.match(re)).find(Boolean);
    if (!x) continue;
    if (!m) { // mot répété (« le le », « de de ») hors balises et hors noms connus doublés (« Bora Bora »…)
      const mot = x[1].toLowerCase();
      if (/^\p{Lu}/u.test(x[1])) continue; // nom propre répété (« Boum Boum », « Pony Pony Run Run ») : voulu
      if (/^(bora|tam|ylang|chin|ping|cha|knock|bye|tic|bla|hip|shake|step|vroum|boom|go|na|la|ha|lo|so|dj)$/.test(mot) || !/^[a-zà-ÿ]+$/i.test(mot)) continue;
      const contexte = x.input.slice(Math.max(0, x.index - 40), x.index + 40);
      alerte(rel, `mot répété « ${x[0]} » (…${contexte.replace(/\s+/g, ' ').trim()}…)`);
      continue;
    }
    const contexte = t.slice(Math.max(0, x.index - 50), x.index + 50).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    err(rel, `${m} (…${contexte}…)`);
  }
}

// --- 2. Données des soirées -----------------------------------------------------------------------------------
const now = Date.now();
const evts = [...(lire('evenements-web.json', {}).evenements || []), ...lire('evenements-manuels.json', [])];
const sansAccent = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const pagesSoiree = existsSync(path.join(ROOT, 'soiree')) ? readdirSync(path.join(ROOT, 'soiree')) : [];
const parId = new Map(pagesSoiree.map((id) => [id, readFileSync(path.join(ROOT, 'soiree', id, 'index.html'), 'utf8')]));
const MOIS = { jan: 1, janv: 1, fev: 2, fevr: 2, mars: 3, avr: 4, mai: 5, juin: 6, juil: 7, aout: 8, sept: 9, oct: 10, nov: 11, dec: 12 };
const vus = new Map();
for (const [id, html] of parId) {
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)?.map((x) => { try { return JSON.parse(x.replace(/<\/?script[^>]*>/g, '')); } catch { return null; } }).flat().find((x) => x && /Event/.test(x['@type'] || ''));
  const nom = (html.match(/<h1>([^<]*)<\/h1>/) || [])[1] || id;
  const debut = (html.match(/data-debut="([^"]+)"/) || [])[1];
  if (!debut) { err(`soiree/${id}/`, 'date de début introuvable'); continue; }
  const d = Date.parse(debut);
  if (d < now - 30 * 3600e3) alerte(`soiree/${id}/`, `soirée passée (${debut.slice(0, 10)}) toujours publiée`);
  // Date écrite dans le titre (« 14/11/2026 », « 14 novembre ») ≠ date de la soirée.
  const jp = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(d - 5 * 3600e3)).split('-').map(Number);
  const tn = sansAccent(nom.replace(/&#39;/g, "'"));
  for (const m of tn.matchAll(/\b([0-3]?\d)\/([01]?\d)(?:\/(?:20)?\d\d)?\b/g)) if (+m[2] >= 1 && +m[2] <= 12 && (+m[1] !== jp[2] || +m[2] !== jp[1])) err(`soiree/${id}/`, `le titre « ${nom} » annonce le ${m[1]}/${m[2]}, la soirée est le ${jp[2]}/${jp[1]}`);
  for (const m of tn.matchAll(/\b([0-3]?\d)\s+(janv?|fevr?|mars|avr|mai|juin|juil|aout|sept|oct|nov|dec)[a-z]*\b/g)) if (+m[1] !== jp[2] || MOIS[m[2]] !== jp[1]) err(`soiree/${id}/`, `le titre « ${nom} » annonce le ${m[1]} ${m[2]}, la soirée est le ${jp[2]}/${jp[1]}`);
  // Doublons : même nom (simplifié) le même jour.
  const cle = `${tn.replace(/\(.*?\)|[^a-z0-9]/g, '').slice(0, 24)}|${jp.join('-')}`;
  if (vus.has(cle)) err(`soiree/${id}/`, `doublon de soiree/${vus.get(cle)}/`); else vus.set(cle, id);
  // Prix aberrant.
  const prix = (html.match(/<dt>Prix<\/dt><dd>([^<]*)</) || [])[1] || '';
  const p = Number((prix.match(/(\d+(?:,\d+)?)/) || [])[1]?.replace(',', '.'));
  if (p && (p > 250 || p < 1)) alerte(`soiree/${id}/`, `prix inhabituel : ${prix}`);
  // Billetterie : jamais une page de recherche ou de redirection.
  for (const u of html.matchAll(/href="(https?:\/\/[^"]+)"[^>]*class="[^"]*billet/g)) if (/vertexaisearch|google\.[a-z.]+\/(search|url)|bing\.com\/search/.test(u[1])) err(`soiree/${id}/`, `lien billetterie vers une page de recherche (${u[1].slice(0, 60)})`);
  if (/vertexaisearch/.test(html)) err(`soiree/${id}/`, 'adresse de redirection Google dans la page');
  // Affiche : fichier présent et assez grand.
  const aff = (html.match(/class="fiche-affiche[^"]*"[^>]*>(?:<img class="fond-flou"[^>]*>)?<img[^>]*src="[^"]*?(site\/affiches\/[0-9a-f]{12})/) || [])[1];
  if (aff) { const f = path.join(ROOT, `${aff}.jpg`); if (!existsSync(f)) err(`soiree/${id}/`, `affiche absente (${aff}.jpg)`); }
  // Lecture de l'affiche (OCR gratuit, option --ocr) : une date lisible qui n'est pas celle de la soirée = mauvaise affiche.
  if (aff && OCR && existsSync(path.join(ROOT, `${aff}.jpg`))) {
    const r = spawnSync('tesseract', [path.join(ROOT, `${aff}.jpg`), '-', '-l', 'fra+eng', '--psm', '11'], { encoding: 'utf8', timeout: 60000 });
    const lues = r.status === 0 ? datesLues(r.stdout) : [];
    if (lues.length && !lues.some((x) => dateCompatible(x, [jp[2], jp[1]]))) alerte(`soiree/${id}/`, `l'affiche annonce le ${lues.map(([j, m]) => `${j}/${m}`).join(', ')}, la soirée est le ${jp[2]}/${jp[1]} (${aff}.jpg)`);
  }
  void ld;
}
// Même affiche sur deux soirées différentes (12/11/2026 : l'affiche d'Halloween du High Club sur 5 soirées) : erreur.
{ const parAffiche = new Map();
  for (const [id, html] of parId) { const a = (html.match(/class="fiche-affiche[^"]*"[^>]*>(?:<img class="fond-flou"[^>]*>)?<img[^>]*src="[^"]*?(site\/affiches\/[0-9a-f]{12})/) || [])[1]; if (a) parAffiche.set(a, [...(parAffiche.get(a) || []), id]); }
  for (const [a, ids] of parAffiche) if (ids.length > 1) err(`soiree/${ids[0]}/`, `même affiche (${a}.jpg) que ${ids.slice(1).map((x) => `soiree/${x}/`).join(', ')}`); }
// Photo d'un lieu sur une carte : jamais une affiche (texte, date) — lue par Tesseract si disponible.
{ const t = lire('contenus/photos-texte.json', {});
  const vues = new Set(); for (const [, html] of parId) for (const m of html.matchAll(/site\/lieux\/([a-z0-9._-]+-couv\d?)-(?:480|800)\.webp/g)) vues.add(m[1]);
  for (const v of vues) { const k = Object.keys(t).find((x) => x.startsWith(`site/lieux/${v}.jpg|`)); if (k && t[k]) err('photos de lieu', `${v}.jpg est une affiche et sert de photo de lieu`); } }
const verif = lire('contenus/comptes-verifies.json', {});
const suivis = new Set([...(lire('contenus/partenaires-comptes.json', []).comptes || lire('contenus/partenaires-comptes.json', [])).map?.((x) => String(x.instagram || '').toLowerCase()) || []]);
for (const [id, html] of parId) for (const m of html.matchAll(/class="orga-carte" href="https:\/\/www\.instagram\.com\/([a-z0-9._]+)\//g)) if (!verif[m[1]]?.ok && !suivis.has(m[1])) err(`soiree/${id}/`, `compte Instagram non vérifié affiché : @${m[1]}`);

// 23/11/2026 (directeur : Gotha fermé définitivement, Bâoli « ouvre ce soir » en novembre, dégustation de midi « ce soir ») :
// un lieu décrit comme saisonnier doit avoir sa saison (sinon il est annoncé ouvert toute l'année) ; « Ce soir » ne montre
// jamais un événement de journée.
{ const f = path.join(ROOT, 'ce-soir', 'index.html');
  if (existsSync(f)) {
    const h = readFileSync(f, 'utf8');
    for (const m of h.matchAll(/<article class="fiche-lieu[^"]*"[^>]*>[\s\S]*?<\/article>/g)) {
      const art = m[0], nom = (art.match(/<h3[^>]*>(?:<a[^>]*>)?([^<]+)/) || [])[1] || '?';
      const texte = art.replace(/<[^>]+>/g, ' ');
      if (/saisonni|ouvert(e)? (?:seulement |uniquement )?en saison|saison estivale|l'été seulement|de mai à|d'avril à/i.test(texte) && !/data-saison=/.test(art.slice(0, 1200))) err('ce-soir/', `${nom.trim()} : décrit comme saisonnier mais sans saison enregistrée (risque « ouvert ce soir » hors saison)`);
    }
  }
  const heure = (iso) => +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  for (const page of ['index.html', 'ce-soir/index.html']) {
    const g = path.join(ROOT, page); if (!existsSync(g)) continue;
    const h = readFileSync(g, 'utf8');
    const bloc = page === 'index.html' ? (h.match(/<section id="ce-soir"[\s\S]*?<\/section>/) || [''])[0] : (h.match(/id="soirees-ce-soir"[\s\S]*?<\/section>/) || [''])[0];
    for (const m of bloc.matchAll(/data-debut="([^"]+)"/g)) { const x = heure(m[1]); if (x >= 6 && x < 17) err(page, `événement de journée (${x} h) affiché dans « Ce soir »`); }
  }
}

// 23/11/2026 (testeur pratique) : villes fantômes (« Nice Partenaires ») dans les filtres et les adresses des pages.
{ const f = path.join(ROOT, 'clubs-bars', 'index.html');
  if (existsSync(f)) for (const m of new Set(readFileSync(f, 'utf8').match(/data-ville="[^"]*"/g) || [])) if (/partenaire|undefined|null/.test(m)) err('clubs-bars/', `ville impossible ${m}`); }

// 23/11/2026 : une erreur de code a fait disparaître toute la rubrique « France » (108 pages) sans aucune autre alerte.
for (const [f, rub] of [['evenements-france.json', 'france'], ['evenements-occitanie.json', 'occitanie']]) {
  const d = lire(f, null); const l = Array.isArray(d) ? d : d?.evenements || [];
  const avenir = l.filter((e) => Date.parse(e.start) > Date.now()).length;
  if (avenir >= 5 && !existsSync(path.join(ROOT, rub, 'index.html'))) err(`${rub}/`, `${avenir} soirées à venir dans ${f} mais aucune page ${rub}/`);
  if (avenir >= 5 && existsSync(path.join(ROOT, rub)) && !readdirSync(path.join(ROOT, rub), { withFileTypes: true }).some((x) => x.isDirectory())) err(`${rub}/`, `aucune page de ville dans ${rub}/`);
}

// --- 3. Corriger (24/11/2026, directeur : « le contrôle doit contrôler et corriger, c'est logique ») ----------------------
// Chaque erreur qui touche une fiche soirée (titre et date qui ne collent pas, texte abîmé, doublon, lien de recherche, compte
// non vérifié…) inscrit la soirée dans contenus/corrections-auto.json : la construction suivante du site (dans l'heure) et les
// posts l'écartent. Une soirée passée sort de la liste. --lecture-seule : ne rien écrire.
if (!process.argv.includes('--lecture-seule')) {
  const F = path.join(ROOT, 'contenus', 'corrections-auto.json');
  const ancien = lire('contenus/corrections-auto.json', { soirees: [] });
  const aujourdhui = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const liste = (ancien.soirees || []).filter((c) => c.nuit >= aujourdhui);
  const ajouts = [];
  for (const e of erreurs) {
    const m = e.match(/^(?:[a-z]{2}\/)?soiree\/([^/]+)\/ : (.*)$/); if (!m) continue;
    if (/^(même affiche|affiche absente|caractère spécial doublement échappé)/.test(m[2])) continue; // corrigés à la construction (affiche retirée, traduction décodée), pas la soirée
    // Erreur de texte : seulement si elle est dans le contenu propre de la soirée (pas dans les cartes « Le même soir »).
    const regle = MAUVAIS.find(([, lib]) => lib && m[2].startsWith(lib));
    if (regle) { const pageHtml = readFileSync(path.join(ROOT, e.split(' : ')[0], 'index.html'), 'utf8'); const propre = visible(pageHtml.split('class="similaires')[0].replace(/data-q="[^"]*"/g, '')); if (!regle[0].test(propre)) continue; }
    const html = parId.get(m[1]); if (!html) continue;
    const nom = ((html.match(/<h1>([^<]*)<\/h1>/) || [])[1] || '').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    const debut = (html.match(/data-debut="([^"]+)"/) || [])[1]; if (!nom || !debut) continue;
    const nuit = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.parse(debut) - 5 * 3600e3));
    const nom_cle = sansAccent(nom).replace(/[^a-z0-9]/g, '');
    if (liste.some((c) => c.nom_cle === nom_cle && c.nuit === nuit) || ajouts.some((c) => c.nom_cle === nom_cle && c.nuit === nuit)) continue;
    ajouts.push({ nom, nom_cle, nuit, page: `soiree/${m[1]}/`, raison: m[2].slice(0, 200), le: new Date().toISOString() });
  }
  if (ajouts.length || liste.length !== (ancien.soirees || []).length) {
    writeFileSync(F, JSON.stringify({ _note: 'Soirées écartées automatiquement par le contrôle des données (outils/controle-donnees.mjs) : jamais affichées ni publiées tant que l\'erreur n\'est pas corrigée à la source. Retirer une ligne pour remettre la soirée.', soirees: [...liste, ...ajouts] }, null, 1) + '\n');
    for (const a of ajouts) console.log(`→ corrigé : « ${a.nom} » (${a.nuit}) sera écartée à la prochaine construction (${a.raison.slice(0, 80)})`);
  }
}

// --- 4. Bilan -------------------------------------------------------------------------------------------------
console.log(`Contrôle des données : ${liste.length} pages lues, ${parId.size} fiches soirée.`);
for (const e of erreurs) console.log(`✗ ${e}`);
for (const a of alertes.slice(0, 80)) console.log(`! ${a}`);
console.log(erreurs.length ? `${erreurs.length} erreur(s), ${alertes.length} alerte(s).` : `✓ Aucune erreur. ${alertes.length} alerte(s) à regarder.`);
process.exit(erreurs.length ? 1 : 0);
