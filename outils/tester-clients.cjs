// Tests utilisateurs simulés (20/11/2026, directeur : « teste l'expérience de 1000 clients différents sur le site : soucis
// de navigation, est-ce intuitif, rapide, est-ce que ça répond à toutes les demandes des gens »).
// Chaque client a un appareil, une langue, une ville, un style, une connexion et une intention (trouver une soirée ce soir,
// un billet, où manger à 3 h, une boîte ouverte à Monaco, rentrer chez soi…). Il part d'une page d'entrée réaliste et
// essaie d'aboutir en touchant l'écran comme une vraie personne. On mesure : réussite, nombre d'actions, temps, erreurs,
// images manquantes ou cassées, débordements, textes techniques, résultats incohérents (filtre « gratuit » qui montre
// une soirée payante…).
//   1. servir le site : node outils/serveur-local.cjs (ou DOSSIER=… pour un autre dossier)
//   2. CLIENTS=1000 PARALLELE=6 node outils/tester-clients.cjs   → rapport dans out/clients/
const pw = (() => { try { return require('playwright'); } catch { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } })();
const fs = require('fs');
const path = require('path');
const B = process.env.SITE || 'http://localhost:8765/';
const RACINE = process.env.DOSSIER || path.resolve(__dirname, '..');
const N = Number(process.env.CLIENTS || 1000), PARALLELE = Number(process.env.PARALLELE || 6);
const SORTIE = path.join(path.resolve(__dirname, '..'), 'out', 'clients');

// --- Tirage reproductible --------------------------------------------------------------------------------------
let graine = Number(process.env.GRAINE || 20261120);
const hasard = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };
const un = (l) => l[Math.floor(hasard() * l.length)];
const pondere = (l) => { const t = l.reduce((s, [, p]) => s + p, 0); let r = hasard() * t; for (const [v, p] of l) { if ((r -= p) < 0) return v; } return l[0][0]; };

const APPAREILS = [['iPhone 13', 30], ['iPhone SE', 12], ['Pixel 7', 18], ['Galaxy S9+', 8], ['iPad Mini', 6], ['ordi', 18], ['petit-android', 8]];
const contexteDe = (a) => a === 'ordi' ? { viewport: { width: 1440, height: 900 } } : a === 'petit-android' ? { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: pw.devices['Pixel 7'].userAgent } : pw.devices[a];
const LANGUES = [['fr', 78], ['en', 12], ['it', 5], ['es', 5]];
const VILLES = [['nice', 40], ['cannes', 18], ['monaco', 14], ['antibes', 10], ['var', 12], ['tout', 6]];
const STYLES = ['techno', 'house', 'afro', 'shatta', 'rap', 'latino'];
const INTENTIONS = [['ce-soir', 16], ['style-weekend', 12], ['recherche', 12], ['billet', 10], ['rentrer', 6], ['manger-tard', 6], ['club-ouvert', 8], ['favoris', 5], ['gratuit', 5], ['date-precise', 4], ['page-ville', 6], ['actus', 4], ['partenaire', 2], ['nouveautes', 1], ['bien-sortir', 1], ['egare', 2]];

// Données du site (pour savoir ce qu'un client cherche vraiment).
const lireIds = () => fs.readdirSync(path.join(RACINE, 'soiree')).filter((d) => fs.existsSync(path.join(RACINE, 'soiree', d, 'index.html')));
const IDS = lireIds();
const accueil = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
const NOMS = [...accueil.matchAll(/<h3><a href="[^"]*soiree\/([^/"]+)\/">([^<]+)<\/a><\/h3>/g)].map((m) => ({ id: m[1], nom: m[2].replace(/&#39;/g, "'").replace(/&amp;/g, '&') }));
const LIEUX = [...new Set([...accueil.matchAll(/<span class="ou">([^<,]+)/g)].map((m) => m[1].replace(/&#39;/g, "'").trim()).filter((x) => x.length >= 4))];
const deforme = (s) => { const r = hasard(); if (r < 0.3) return s.toLowerCase(); if (r < 0.5) return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); if (r < 0.65 && s.length > 5) { const i = 1 + Math.floor(hasard() * (s.length - 2)); return s.slice(0, i) + s.slice(i + 1); } return s; };
const PREFIXE = { fr: '', en: 'en/', it: 'it/', es: 'es/' };
const TECHNIQUE = /\b(Gemini|Groq|Grok|Tavily|API|TAVILY|GROQ|token|undefined|null|NaN|\[object|lorem|TODO)\b/;

function client(i) {
  return { n: i + 1, appareil: pondere(APPAREILS), langue: pondere(LANGUES), ville: pondere(VILLES), style: un(STYLES), intention: pondere(INTENTIONS), lent: hasard() < 0.15 };
}

async function visiter(navigateur, c) {
  const r = { ...c, ok: false, actions: 0, ms: 0, soucis: [] };
  const souci = (s) => { if (!r.soucis.includes(s)) r.soucis.push(s); };
  const ctx = await navigateur.newContext({ ...contexteDe(c.appareil), locale: c.langue === 'fr' ? 'fr-FR' : c.langue, geolocation: { latitude: 43.6961, longitude: 7.2718 }, permissions: ['geolocation'] });
  const p = await ctx.newPage();
  p.setDefaultTimeout(5000);
  if (c.lent) { try { const s = await ctx.newCDPSession(p); await s.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 }); } catch {} }
  p.on('pageerror', (e) => souci(`erreur JavaScript : ${e.message.slice(0, 120)}`));
  p.on('response', (x) => { const u = x.url(); if (u.startsWith(B) && x.status() >= 400 && !/existe-pas/.test(u)) souci(`ressource introuvable ${x.status()} : ${u.replace(B, '/')}`); });
  const t0 = Date.now();
  // Un vrai doigt touche même un bouton qui bouge encore (animation) ; on ne force qu'après un premier essai normal.
  const act = async (f) => { r.actions++; try { await f(false); } catch (e) { if (!/not stable|intercepts pointer|Timeout/.test(e.message)) throw e; await f(true); r.instable = (r.instable || 0) + 1; } await p.waitForTimeout(c.lent ? 350 : 150); };
  const pre = PREFIXE[c.langue];
  const visibles = () => p.locator('.liste .carte:not([hidden]), .ce-soir-liste .carte:not([hidden])').filter({ visible: true });
  const choisir = async (bloc, v) => {
    const ouvrir = p.locator('.ouvrir-filtres:visible');
    if (await ouvrir.count()) await act((f) => ouvrir.first().click({ force: f }));
    const sum = p.locator(`details.filtre[data-bloc="${bloc}"] > summary`).filter({ visible: true }).first();
    if (await sum.count()) { const ouvert = await sum.evaluate((s) => s.parentElement.open); if (!ouvert) await act((f) => sum.click({ force: f })); }
    const bouton = p.locator(`[data-filtre="${bloc}"] [data-v="${v}"]`).filter({ visible: true }).first();
    if (!(await bouton.count())) { souci(`filtre « ${bloc} = ${v} » introuvable à l'écran`); return false; }
    await act((f) => bouton.click({ force: f }));
    const fermer = p.locator('.feuille-filtres .fermer:visible, .filtres-fermer:visible, [data-fermer-filtres]:visible');
    if (await fermer.count()) await act((f) => fermer.first().click({ force: f })).catch(() => {});
    return true;
  };
  const controlesPage = async () => {
    const d = await p.evaluate(() => {
      const W = document.documentElement.clientWidth;
      const cassees = [...document.images].filter((i) => i.complete && i.currentSrc && i.naturalWidth === 0).map((i) => i.currentSrc.split('/').pop());
      const debord = document.documentElement.scrollWidth - innerWidth;
      const petits = [...document.querySelectorAll('main a, main button, nav.onglets a')].filter((e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width && b.height && s.visibility !== 'hidden' && b.top < innerHeight * 2 && (b.height < 24 || b.width < 24) && e.textContent.trim().length > 0 && !e.closest('p, li'); }).length;
      const texte = document.body.innerText;
      // Texte coupé : pastille de ville qui dépasse de son image, titre tronqué dans sa propre boîte (les rangées qui défilent ne comptent pas).
      const coupees = [...document.querySelectorAll('.ville-tag')].filter((e) => { const a = e.closest('.affiche'); if (!a || getComputedStyle(e).display === 'none') return false; const b = e.getBoundingClientRect(), pa = a.getBoundingClientRect(); return b.width && b.right > pa.right + 2; })
        .concat([...document.querySelectorAll('.carte h3, .carte .ou, .ville-tag')].filter((e) => e.offsetWidth && e.scrollWidth > e.clientWidth + 2 && /hidden|clip/.test(getComputedStyle(e).overflowX)))
        .map((e) => e.textContent.trim().slice(0, 30));
      return { cassees, debord, petits, texte: texte.slice(0, 200000), coupees: coupees.slice(0, 3) };
    });
    if (d.cassees.length) souci(`image cassée : ${d.cassees.slice(0, 2).join(', ')}`);
    if (d.debord > 1) souci(`la page déborde à droite de ${d.debord}px`);
    if (d.coupees.length) souci(`texte coupé : ${d.coupees.join(' | ')}`);
    const m = d.texte.match(TECHNIQUE); if (m) souci(`mot technique affiché aux visiteurs : « ${m[0]} »`);
    const pseudo = [...d.texte.matchAll(/(^|[^@\w.])([a-z0-9]+_[a-z0-9_]+)\b/g)].map((m) => m[2]).find((x) => !/^teufy_official$/.test(x)); if (pseudo) souci(`pseudo Instagram affiché comme nom : ${pseudo}`);
    for (const v of ['Monaca', 'Pennsylvania', ', PA ']) if (d.texte.includes(v)) souci(`soirée hors zone affichée (${v.trim()})`);
  };
  try {
    const entree = { 'page-ville': `${pre}soirees-${c.ville === 'var' || c.ville === 'tout' ? 'nice' : c.ville}/`, 'billet': `${pre}soiree/${un(IDS)}/`, 'rentrer': `${pre}soiree/${un(IDS)}/`, 'egare': `${pre}existe-pas/` }[c.intention] || pre;
    const rep = await p.goto(B + entree, { waitUntil: 'domcontentloaded' });
    if (c.intention !== 'egare' && (!rep || rep.status() >= 400)) { souci(`page d'entrée en erreur ${rep?.status()} : ${entree}`); throw new Error('entrée'); }
    await p.locator('main').first().waitFor({ state: 'visible' });
    r.premierAffichage = Date.now() - t0;
    if (r.premierAffichage > (c.lent ? 6000 : 2500)) souci(`page lente à s'afficher (${r.premierAffichage} ms${c.lent ? ', connexion 3G' : ''})`);
    switch (c.intention) {
      case 'ce-soir': {
        await act((f) => p.locator('nav.onglets a[href$="ce-soir/"], nav.nav a[href$="ce-soir/"]').filter({ visible: true }).first().click({ force: f }));
        await p.waitForURL(/ce-soir\//);
        if (c.ville !== 'tout') { const vv = c.ville === 'var' ? 'toulon' : c.ville; const b = p.locator(`[data-jc-ville="${vv}"], [data-jc-ville^="${vv}"]`).filter({ visible: true }).first(); if (await b.count()) await act((f) => b.click({ force: f })); else souci(`ville « ${vv} » absente des choix de « Ce soir »`); }
        const n = await visibles().count(), vide = await p.locator('[data-aucune-soiree]:not([hidden]), [data-soir-ville-vide]:not([hidden])').count();
        r.ok = n > 0 || vide > 0; if (!r.ok) souci('« Ce soir » : ni soirée ni message expliquant pourquoi');
        if (n === 0 && c.ville === 'nice') souci('« Ce soir » à Nice : aucune soirée affichée un vendredi soir');
        break; }
      case 'style-weekend': case 'gratuit': case 'date-precise': {
        if (c.intention === 'style-weekend') { await choisir('quand', 'weekend'); await choisir('style', c.style); }
        if (c.intention === 'gratuit') await choisir('prix', 'gratuit');
        if (c.intention === 'date-precise') {
          const ouvrir = p.locator('.ouvrir-filtres:visible'); if (await ouvrir.count()) await act((f) => ouvrir.first().click({ force: f }));
          const s = p.locator('details.filtre[data-bloc="quand"] > summary').filter({ visible: true }).first(); if (await s.count()) await act((f) => s.click({ force: f }));
          const jour = new Date(Date.now() + (1 + Math.floor(hasard() * 6)) * 864e5).toISOString().slice(0, 10);
          const inp = p.locator('.choix-date input[type=date]').filter({ visible: true }).first();
          if (await inp.count()) { await act((f) => inp.fill(jour)); r.jour = jour; } else souci('choix d\'une date précise introuvable');
        }
        await p.waitForTimeout(300);
        const cartes = await visibles().evaluateAll((l) => l.map((x) => ({ s: x.dataset.styles || '', prix: x.dataset.prix, jour: x.dataset.jour })));
        r.resultats = cartes.length;
        if (c.intention === 'style-weekend') { const faux = cartes.filter((x) => !x.s.includes(c.style)); if (faux.length) souci(`filtre style « ${c.style} » : ${faux.length} soirée(s) d'un autre style`); }
        if (c.intention === 'gratuit') { const faux = cartes.filter((x) => x.prix && Number(x.prix) > 0); if (faux.length) souci(`filtre « gratuit » : ${faux.length} soirée(s) payante(s)`); }
        if (c.intention === 'date-precise' && r.jour) { const faux = cartes.filter((x) => x.jour && x.jour !== r.jour); if (faux.length) souci(`date précise : ${faux.length} soirée(s) d'un autre jour`); }
        const vide = await p.locator('#aucune:not([hidden]), .vide:not([hidden])').filter({ visible: true }).count();
        r.ok = cartes.length > 0 || vide > 0; if (!r.ok) souci('filtres : liste vide sans message');
        break; }
      case 'recherche': {
        const cible = hasard() < 0.6 && NOMS.length ? un(NOMS).nom : un(LIEUX);
        const q = deforme(cible.split(/[–—(@:|]/)[0].trim().split(/\s+/).slice(0, 3).join(' '));
        r.requete = q;
        const champ = p.locator('#recherche-hero:visible, #recherche:visible').first();
        if (!(await champ.count())) { await act((f) => p.locator('nav.onglets [data-chercher]').first().click({ force: f })); }
        // Panneau de recherche (mobile) : le bouton × doit être visible et touchable, même après avoir fait défiler la liste
        // (20/11/2026, vidéo du directeur : le × passait sous le champ de recherche).
        if (await p.locator('.feuille-filtres').count()) {
          const x = async () => p.evaluate(() => { const e = document.querySelector('.feuille-x'); if (!e) return false; const b = e.getBoundingClientRect(); const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!t && (t === e || e.contains(t)); });
          if (!(await x())) souci('panneau de recherche : bouton × caché');
          await p.evaluate(() => document.querySelector('.feuille-corps')?.scrollBy(0, 300)); await p.waitForTimeout(150);
          if (!(await x())) souci('panneau de recherche : bouton × caché après défilement');
          await p.evaluate(() => document.querySelector('.feuille-corps')?.scrollTo(0, 0));
        }
        await act((f) => p.locator('#recherche-hero:visible, #recherche:visible').first().fill(q));
        await p.keyboard.press('Enter').catch(() => {});
        await p.waitForTimeout(500);
        r.resultats = await visibles().count();
        r.ok = r.resultats > 0; if (!r.ok) souci(`recherche « ${q} » : aucun résultat alors que « ${cible} » existe`);
        break; }
      case 'billet': {
        const b = p.locator('.fiche-actions a.bouton, .barre-billets a.bouton').filter({ hasText: /billet|ticket|bigliett|entrada|r[ée]server/i }).first();
        const href = (await b.count()) ? await b.getAttribute('href') : '';
        r.ok = /^https?:\/\//.test(href || '');
        if (!r.ok) { const sur = /sur place|entr[ée]e libre|gratuit|free|ingresso libero|entrada libre/i.test(await p.locator('main').innerText()); if (sur) r.ok = true; else souci(`fiche soirée : pas de lien billetterie ni d'info d'entrée (${p.url().split('/soiree/')[1] || ''})`); }
        const infos = await p.evaluate(() => document.querySelector('main')?.innerText || '');
        if (!/\d{1,2}h\d{2}|minuit|\d{1,2}:\d{2}/.test(infos)) souci('fiche soirée : heure absente');
        if (!/Itin|Directions|Indicazioni|Cómo llegar|maps/i.test(infos + (await p.content()).slice(0, 0))) { if (!(await p.locator('a[href*="google.com/maps"]').count())) souci('fiche soirée : pas d\'itinéraire'); }
        if (!(await p.locator('.fiche img, .fiche-visuel img, .affiche img, .vignette').count())) souci('fiche soirée : aucune image');
        break; }
      case 'rentrer': {
        const t = (await p.evaluate(() => document.querySelector('main')?.innerText || '')).toLowerCase();
        r.ok = /(bus|tram|train|taxi|vtc|parking|rentrer|retour|navette|night|nuit)/.test(t);
        if (!r.ok) souci('fiche soirée : rien pour savoir comment y aller ou rentrer');
        break; }
      case 'manger-tard': case 'partenaire': case 'nouveautes': case 'bien-sortir': {
        const cible = { 'manger-tard': 'manger-tard/', partenaire: 'partenaires/', nouveautes: 'mises-a-jour/', 'bien-sortir': 'bien-sortir/' }[c.intention];
        const menu = p.locator('nav.onglets [data-menu]').first();
        if (await menu.isVisible().catch(() => false)) await act((f) => menu.click({ force: f }));
        // Le menu ouvert d'abord (le pied de page est derrière lui), sinon l'en-tête (ordinateur), sinon le pied de page.
        let lien = p.locator(`#menu:not([hidden]) a[href$="${cible}"]`).filter({ visible: true }).first();
        if (!(await lien.count())) lien = p.locator(`header a[href$="${cible}"], footer a[href$="${cible}"]`).filter({ visible: true }).first();
        if (await lien.count()) await act((f) => lien.click({ force: f })); else { souci(`« ${cible} » introuvable dans le menu`); await p.goto(B + pre + cible); }
        await p.waitForURL(new RegExp(cible.replace('/', '\\/'))).catch(() => souci(`« ${cible} » ne s'ouvre pas`));
        if (c.intention === 'manger-tard') { const b = p.locator('.filtre-tard button').filter({ hasText: '3 h' }).first(); if (await b.count()) await act((f) => b.click({ force: f })); const n = await p.locator('.fiche-tard:not([hidden])').filter({ visible: true }).count(); r.resultats = n; if (!n && !(await p.locator('[data-aucun-tard]:not([hidden])').count())) souci('manger tard : ni adresse ni message à 3 h'); }
        r.ok = !r.soucis.some((s) => /ne s'ouvre pas/.test(s));
        break; }
      case 'club-ouvert': {
        await p.goto(B + pre + 'clubs-bars/', { waitUntil: 'domcontentloaded' });
        const v = c.ville === 'var' ? 'toulon' : c.ville === 'tout' ? 'nice' : c.ville;
        const b = p.locator(`a.puce[href="#v-${v}"]`).filter({ visible: true }).first();
        if (await b.count()) await act((f) => b.click({ force: f })); else souci(`annuaire : pas de raccourci « ${v} »`);
        const fiches = p.locator(`#v-${v} .fiche-lieu`);
        r.resultats = await fiches.count();
        r.sansPhoto = await fiches.evaluateAll((l) => l.filter((x) => !x.querySelector('img')).length);
        if (!(await p.locator(`#v-${v}`).isVisible().catch(() => false))) souci(`annuaire : la section « ${v} » n'est pas à l'écran après le clic`);
        r.ok = r.resultats > 0; if (!r.ok) souci(`annuaire : aucun lieu à ${v}`);
        if (r.resultats && r.sansPhoto / r.resultats > 0.5) souci(`annuaire ${v} : plus de la moitié des lieux sans photo (${r.sansPhoto}/${r.resultats})`);
        break; }
      case 'favoris': {
        // Un cœur de l'agenda principal, sous les yeux du visiteur (pas une carte cachée hors champ d'un carrousel horizontal).
        await p.locator('.liste .carte').first().scrollIntoViewIfNeeded().catch(() => {});
        const coeur = p.locator('.liste .carte .coeur').filter({ visible: true }).first();
        if (!(await coeur.count())) { souci('aucun cœur « favori » visible'); break; }
        await coeur.scrollIntoViewIfNeeded().catch(() => {});
        await act((f) => coeur.click({ force: f }));
        // La barre d'onglets se cache quand on descend et revient quand on remonte : le visiteur remonte un peu pour l'atteindre.
        await p.mouse.wheel(0, -250).catch(() => {}); await p.waitForTimeout(350);
        const vers = p.locator('nav.onglets a[href$="#favoris"], nav.nav a[href$="#favoris"], [data-favoris]').filter({ visible: true }).first();
        if (await vers.count()) await act((f) => vers.click({ force: f })); else await choisir('quand', 'favoris');
        await p.waitForTimeout(400);
        r.resultats = await visibles().count();
        r.ok = r.resultats >= 1; if (!r.ok) souci('favoris : la soirée ajoutée n\'apparaît pas');
        break; }
      case 'page-ville': {
        const v = c.ville === 'var' || c.ville === 'tout' ? 'nice' : c.ville;
        const villes = await p.locator('.liste .carte, .grille .carte').evaluateAll((l) => l.map((x) => x.dataset.ville));
        r.resultats = villes.length;
        const autres = villes.filter((x) => x && x !== v && !(v === 'antibes' && /juan/.test(x)));
        if (autres.length > villes.length / 2) souci(`page « soirées à ${v} » : ${autres.length}/${villes.length} soirées d'une autre ville`);
        r.ok = villes.length > 0;
        break; }
      case 'actus': {
        await p.goto(B + pre + 'actus/', { waitUntil: 'domcontentloaded' });
        const a = p.locator('a.actu').first();
        if (!(await a.count())) { souci('actus : aucune actu'); break; }
        await act((f) => a.click({ force: f }));
        await p.waitForTimeout(400);
        const img = await p.evaluate(async () => { const i = document.querySelector('.actu-figure img:not(.actu-fond)'); if (!i) return null; if (!i.complete) await new Promise((ok) => { i.onload = i.onerror = ok; setTimeout(ok, 4000); }); return { ok: i.naturalWidth > 0, src: i.currentSrc }; });
        if (img && !img.ok) souci(`actus : image de l'article cassée (${img.src.split('/').pop()})`);
        r.ok = true;
        break; }
      case 'egare': {
        const lien = p.locator('a[href="./"], a[href="../"], a[href="/"], a[href$="teufyparty.com/"]').filter({ visible: true }).first();
        r.ok = (await lien.count()) > 0; if (!r.ok) souci('page introuvable : aucun lien pour revenir à l\'accueil');
        break; }
    }
    await controlesPage();
  } catch (e) { if (!/entrée/.test(e.message)) souci(`bloqué : ${e.message.split('\n')[0].slice(0, 140)}`); }
  r.ms = Date.now() - t0;
  if (r.actions > 6) souci(`parcours long : ${r.actions} actions pour « ${c.intention} »`);
  await ctx.close().catch(() => {});
  return r;
}

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const nav = await pw.chromium.launch();
  const clients = Array.from({ length: N }, (_, i) => client(i));
  const res = [];
  let i = 0;
  await Promise.all(Array.from({ length: PARALLELE }, async () => { while (i < clients.length) { const c = clients[i++]; res.push(await visiter(nav, c)); if (res.length % 50 === 0) process.stdout.write(`${res.length}/${N} `); } }));
  await nav.close();
  res.sort((a, b) => a.n - b.n);
  const parSouci = {};
  for (const r of res) for (const s of r.soucis) { const k = s.replace(/\d+(ms| ms|px|\/\d+)?/g, 'N').replace(/« [^»]* »/g, '«…»').slice(0, 110); (parSouci[k] ||= { nb: 0, exemples: [] }).nb++; if (parSouci[k].exemples.length < 3) parSouci[k].exemples.push(`#${r.n} ${r.appareil}/${r.langue}/${r.intention} : ${s}`); }
  const parIntention = {};
  for (const r of res) { const x = (parIntention[r.intention] ||= { clients: 0, reussis: 0, ms: 0, actions: 0 }); x.clients++; x.reussis += r.ok ? 1 : 0; x.ms += r.ms; x.actions += r.actions; }
  for (const x of Object.values(parIntention)) { x.ms = Math.round(x.ms / x.clients); x.actions = +(x.actions / x.clients).toFixed(1); x.taux = `${Math.round((100 * x.reussis) / x.clients)} %`; }
  const resume = { le: new Date().toISOString(), clients: res.length, reussis: res.filter((r) => r.ok).length, sans_souci: res.filter((r) => !r.soucis.length).length, premier_affichage_moyen_ms: Math.round(res.reduce((s, r) => s + (r.premierAffichage || 0), 0) / res.length), parIntention, soucis: Object.entries(parSouci).sort((a, b) => b[1].nb - a[1].nb).map(([k, v]) => ({ souci: k, ...v })) };
  fs.writeFileSync(path.join(SORTIE, 'resume.json'), JSON.stringify(resume, null, 1));
  fs.writeFileSync(path.join(SORTIE, 'clients.json'), JSON.stringify(res, null, 1));
  console.log(`\n${resume.reussis}/${resume.clients} clients ont abouti, ${resume.sans_souci} sans aucun souci.`);
  for (const s of resume.soucis.slice(0, 40)) console.log(`${String(s.nb).padStart(4)}  ${s.souci}`);
})();
