// Tests de bout en bout du site (Playwright) : tous les scénarios d'usage sur mobile, tablette et ordinateur.
//   1. servir le dépôt : node outils/serveur-local.cjs   (port 8765, gzip, page 404 comme GitHub Pages)
//   2. node outils/tester-site.cjs                      → liste des échecs, code de sortie 1 s'il y en a
// Playwright installé globalement (navigateur préinstallé) si présent, sinon celui du projet.
const pw = (() => { try { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } catch { return require('playwright'); } })();
// Moteur choisi par NAVIGATEUR=chromium|webkit|firefox (WebKit = moteur de Safari / iPhone). Firefox ne gère pas isMobile.
const NAV = process.env.NAVIGATEUR || 'chromium';
const chromium = pw[NAV];
const devices = new Proxy(pw.devices, { get: (o, k) => { const d = o[k]; if (!d || NAV !== 'firefox') return d; const { isMobile, ...r } = d; return r; } });
const fs = require('fs');
const path = require('path');
const B = process.env.SITE || 'http://localhost:8765/';
const ROOT = path.resolve(__dirname, '..');
const echecs = [];
const nbVisibles = (p) => p.locator('.liste .carte:not([hidden])').count();
const ok = (cond, msg) => { if (!cond) echecs.push(msg); return !!cond; };
const premiereSoiree = fs.readdirSync(path.join(ROOT, 'soiree'))[0];
const soireePromo = fs.readdirSync(path.join(ROOT, 'soiree')).find((d) => /frigo|ref-session/.test(d)) || premiereSoiree;
const PAGES = ['', 'en/', 'ar/', 'zh/', 'soirees-nice/', 'soirees-cannes/', 'soirees-monaco/', 'soirees-antibes/', 'soirees-shatta/', 'soirees-techno/', `soiree/${premiereSoiree}/`, `ar/soiree/${premiereSoiree}/`,
  'festivals/', 'clubs-bars/', 'france/', 'actus/', 'partenaires/', 'ambassadeurs/', 'bde/', 'dates/', 'restaurants/', 'activites/', 'a-propos/', 'mentions-legales/', 'cgu/', 'cgv/', 'confidentialite/', 'existe-pas/'];
const APPAREILS = { mobile: devices['iPhone 13'], tablette: devices['iPad Mini'], ordi: { viewport: { width: 1440, height: 900 } }, grand: { viewport: { width: 1920, height: 1080 } } };

// Défilement : molette sur ordinateur, défilement de page sur mobile (WebKit mobile n'a pas de molette).
const defiler = (p, dy) => p.mouse.wheel(0, dy).catch(() => p.evaluate((d) => window.scrollBy(0, d), dy));
async function controlerPage(p, nom, u) {
  const r = await p.goto(B + u, { waitUntil: 'load' });
  await p.waitForTimeout(250);
  if (u !== 'existe-pas/') ok(r.status() === 200, `${nom} ${u} : statut ${r.status()}`);
  else ok(r.status() === 404 && (await p.locator('.page-404').count()) === 1, `${nom} : la page 404 ne s'affiche pas`);
  for (let y = 0; y < 6; y++) { await defiler(p, 900); await p.waitForTimeout(80); }
  await p.evaluate(() => scrollTo(0, 0));
  const debord = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(debord <= 1, `${nom} ${u} : la page déborde à droite de ${debord}px`);
  // Texte du hero entièrement visible.
  const coupe = await p.evaluate(() => [...document.querySelectorAll('.hero-texte > *, .fiche-infos h1, .article h1')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map((e) => e.tagName + '.' + e.className));
  ok(!coupe.length, `${nom} ${u} : texte coupé (${coupe.join(', ')})`);
  // Images cassées (celles qui ont été chargées).
  const cassees = await p.evaluate(() => [...document.images].filter((i) => i.complete && i.currentSrc && i.naturalWidth === 0).map((i) => i.currentSrc));
  ok(!cassees.length, `${nom} ${u} : image cassée ${cassees.slice(0, 2).join(' ')}`);
  // Images floues : affichées plus grandes que leur vraie taille (écran standard ; on tolère 10 %).
  const floues = await p.evaluate(async () => {
    const vues = [...document.images].filter((i) => { const r = i.getBoundingClientRect(); return i.complete && i.currentSrc && r.width >= 120 && !i.classList.contains('fond-flou') && getComputedStyle(i).opacity !== '0' && getComputedStyle(i).visibility !== 'hidden'; });
    const vraies = await Promise.all(vues.map((i) => new Promise((ok) => { const x = new Image(); x.onload = () => ok([x.naturalWidth, x.naturalHeight]); x.onerror = () => ok([0, 0]); x.src = i.currentSrc; })));
    return vues.map((i, k) => {
      const [w, h] = vraies[k]; if (!w) return null;
      const r = i.getBoundingClientRect(), fit = getComputedStyle(i).objectFit;
      const e = fit === 'cover' ? Math.max(r.width / w, r.height / h) : fit === 'contain' ? Math.min(r.width / w, r.height / h) : fit === 'scale-down' ? Math.min(1, r.width / w, r.height / h) : r.width / w;
      return e > 1.1 ? `${i.currentSrc.split('/').slice(-2).join('/')} (${w}px affichée à ${Math.round(e * 100)} %)` : null;
    }).filter(Boolean);
  });
  ok(!floues.length, `${nom} ${u} : image floue ${floues.slice(0, 3).join(' ; ')}`);
  // Chaque bouton visible se clique sans erreur.
  const nb = await p.locator('main button:visible, header button:visible').count();
  for (let i = 0; i < Math.min(nb, 30); i++) {
    const b = p.locator('main button:visible, header button:visible').nth(i);
    if (await b.count() && await b.isVisible()) await b.click({ timeout: 2000, trial: false }).catch(() => {});
    await p.keyboard.press('Escape').catch(() => {});
  }
}

(async () => {
  const exe = null;
  const b = await chromium.launch(exe ? { executablePath: exe } : {});
  for (const [nom, opt] of Object.entries(APPAREILS)) {
    const c = await b.newContext({ ...opt, permissions: NAV === 'chromium' ? ['geolocation', 'clipboard-read', 'clipboard-write'] : ['geolocation'], geolocation: { latitude: 43.6961, longitude: 7.2718 } });
    await c.clock.install({ time: new Date('2026-11-14T23:30:00+01:00') });
    const p = await c.newPage();
    let total = 0;
    const n = () => nbVisibles(p);
    p.on('pageerror', (e) => echecs.push(`${nom} : erreur JavaScript ${e.message} (${p.url()})`));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|basemaps|tile/.test(m.text())) echecs.push(`${nom} console : ${m.text()} (${p.url()})`); });

    for (const u of PAGES) await controlerPage(p, nom, u);

    // --- Accueil : recherche, filtres multiples, favoris, ce soir, compteurs ---
    try {
    await p.goto(B, { waitUntil: 'load' });
    total = await p.locator('.liste .carte:not([hidden])').count();
    ok(total > 10, `${nom} : agenda presque vide (${total})`);
    ok(/\d/.test(await p.locator('.nb-res').first().textContent()), `${nom} : le nombre de soirées n'est pas affiché`);
    ok(await p.locator('#ce-soir:not([hidden]) .carte').count() > 0, `${nom} : « Ce soir » vide un samedi soir`);
    ok(!(await p.locator('.pastille-live').first().isHidden()), `${nom} : pastille « En ce moment » absente`);
    await p.fill('#recherche-hero', 'shatta'); await p.locator('.hero-recherche button[type=submit]').click({ force: true }).catch(() => p.press('#recherche-hero', 'Enter'));
    await p.waitForTimeout(400);
    const nShatta = await p.locator('.liste .carte:not([hidden])').count();
    ok(nShatta > 0 && nShatta < total, `${nom} : la recherche « shatta » ne filtre pas (${nShatta}/${total})`);
    ok(new URL(p.url()).searchParams.get('q') === 'shatta', `${nom} : la recherche n'est pas dans l'adresse`);
    await p.locator('#recherche').fill('zzzzzz'); await p.waitForTimeout(300);
    ok(await p.locator('.liste .carte:not([hidden])').count() === 0 && await p.locator('#aucune').isVisible(), `${nom} : pas de message « aucune soirée »`);
    await p.locator('.agenda .recherche .effacer').click(); await p.waitForTimeout(300);
    ok(await p.locator('.liste .carte:not([hidden])').count() === total, `${nom} : effacer la recherche ne remet pas tout`);
    // Villes multiples.
    const clic = async (f, v) => { const d = p.locator(`.filtres details[data-bloc="${f}"]`); if (await d.count() && !(await d.evaluate((x) => x.open))) { await d.locator('summary').click(); await p.waitForTimeout(120); } await p.locator(`.filtres [data-filtre="${f}"] [data-v="${v}"]`).click(); await p.waitForTimeout(150); };
    await clic('ville', 'nice'); const nNice = await n();
    await clic('ville', 'cannes'); const nNC = await n();
    ok(nNC > nNice, `${nom} : sélection Nice + Cannes impossible (${nNice} → ${nNC})`);
    await clic('ville', 'nice'); const nC = await n();
    ok(nC === nNC - nNice, `${nom} : désélection d'une ville incorrecte`);
    await clic('ville', 'tout'); ok(await n() === total, `${nom} : « Partout » ne remet pas tout`);
    await clic('style', 'techno'); const nT = await n(); await clic('style', 'house'); const nTH = await n();
    ok(nTH >= nT && nT > 0, `${nom} : styles multiples incorrects (${nT}, ${nTH})`);
    await clic('style', 'tout');
    await clic('prix', 'gratuit'); ok(await n() < total, `${nom} : filtre Gratuit sans effet`); await clic('prix', 'tout');
    await clic('quand', 'soir'); const nSoir = await n(); ok(nSoir > 0 && nSoir < total, `${nom} : filtre Ce soir incorrect (${nSoir})`); await clic('quand', 'tout');
    // Tri par prix puis retour par date ; date précise.
    await clic('tri', 'prix');
    const prixOrdre = await p.$$eval('.grille-triee .carte:not([hidden])', (l) => l.map((c) => (c.dataset.prix === '' ? Infinity : +c.dataset.prix)));
    ok(prixOrdre.length === total && prixOrdre.every((x, i) => !i || x >= prixOrdre[i - 1]), `${nom} : le tri par prix ne trie pas`);
    await clic('tri', 'demande'); ok(await n() === total, `${nom} : le tri « plus attendues » perd des soirées`);
    await clic('tri', 'date'); ok(await p.locator('.grille-triee').count() === 0 && await n() === total && await p.locator('.liste .jour:not([hidden])').count() > 2, `${nom} : retour au tri par date incorrect`);
    const unJour = await p.locator('.liste .carte:not([hidden])').nth(3).getAttribute('data-jour');
    await p.locator('details[data-bloc="quand"] summary').click(); await p.locator('.choix-date input').first().fill(unJour); await p.waitForTimeout(300);
    const jours = await p.$$eval('.liste .carte:not([hidden])', (l) => [...new Set(l.map((c) => c.dataset.jour))]);
    ok(jours.length === 1 && jours[0] === unJour, `${nom} : le choix d'une date précise ne filtre pas (${jours.join(',')})`);
    await clic('quand', 'tout'); ok(await n() === total, `${nom} : « Tout » n'annule pas la date choisie`);
    // Près de moi (position simulée : Nice).
    await clic('acces', 'pres'); const nPres = await n();
    ok(nPres > 0 && nPres < total, `${nom} : « Près de moi » incorrect (${nPres}/${total})`);
    ok(/km|m$/.test((await p.locator('.liste .carte:not([hidden]) .distance').first().textContent()) || ''), `${nom} : distance non affichée`);
    await clic('acces', 'tout');
    // Favoris (on repart d'une liste vide : les clics sur tous les boutons ont pu en ajouter).
    await p.evaluate(() => localStorage.removeItem('teufy-favoris')); await p.reload({ waitUntil: 'load' });
    await p.locator('.liste .carte:not([hidden]) .coeur').first().click(); await p.waitForTimeout(200);
    await clic('quand', 'favoris'); ok(await n() === 1, `${nom} : le favori n'apparaît pas dans « Favoris »`);
    await p.reload({ waitUntil: 'load' }); await clic('quand', 'favoris');
    ok(await n() === 1, `${nom} : les favoris ne sont pas gardés après rechargement`);
    await p.locator('.liste .carte:not([hidden]) .coeur').first().click(); await clic('quand', 'tout');

    } catch (e) { echecs.push(`${nom} : étape interrompue (${e.message.split('\n')[0]} @l.${(String(e.stack).match(/tester-site\.cjs:(\d+)/) || [])[1] || '?'})`); }
    // --- Feuille de filtres (mobile) ---
    try {
    if (nom === 'mobile') {
      await p.goto(B, { waitUntil: 'load' });
      await p.locator('.liste .jour:not([hidden])').nth(2).scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
      ok(await p.locator('.flottant').isVisible(), 'mobile : le bouton « Filtres » flottant n\'apparaît pas');
      const fermetures = { bouton: async () => p.locator('.feuille-filtres .voir-n').click(), croix: async () => p.locator('.feuille-x').click(), fond: async () => p.mouse.click(195, 30), echap: async () => p.keyboard.press('Escape'),
        // Vrai geste tactile (objets Touch), accepté par tous les moteurs ; repli en événements simples si Touch n'existe pas.
        glisser: async () => { await p.locator('.feuille-poignee').evaluate((el) => {
          const ev = (type, y) => { let e; try { const t = new Touch({ identifier: 1, target: el, clientX: 195, clientY: y }); e = new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], changedTouches: [t] }); } catch { e = new Event(type, { bubbles: true, cancelable: true }); e.touches = type === 'touchend' ? [] : [{ clientX: 195, clientY: y }]; e.changedTouches = [{ clientX: 195, clientY: y }]; } el.dispatchEvent(e); };
          ev('touchstart', 300); ev('touchmove', 500); ev('touchend', 500);
        }); } };
      for (const [mode, fermer] of Object.entries(fermetures)) {
        await p.evaluate(() => window.scrollBy(0, -120)); await p.waitForTimeout(400); // le bouton revient quand on remonte
        const y0 = await p.evaluate(() => scrollY);
        await p.locator('.ouvrir-filtres').click(); await p.waitForTimeout(400);
        ok(await p.locator('.feuille-filtres').count() === 1, `mobile : la feuille de filtres ne s'ouvre pas (${mode})`);
        await defiler(p, 600); await p.waitForTimeout(150);
        ok(await p.evaluate(() => document.documentElement.classList.contains('bloque')), `mobile : la page derrière la feuille n'est pas bloquée (${mode})`);
        if (mode === 'bouton') { await p.locator('.feuille-filtres [data-filtre="ville"] [data-v="nice"]').click(); await p.waitForTimeout(150); ok(/\d/.test(await p.locator('.voir-n').textContent()), 'mobile : le bouton « Voir N soirées » n\'affiche pas le nombre'); }
        await fermer(); await p.waitForTimeout(400);
        ok(await p.locator('.feuille-filtres').count() === 0, `mobile : la feuille ne se ferme pas (${mode})`);
        ok(!(await p.evaluate(() => document.documentElement.classList.contains('bloque'))), `mobile : la page reste bloquée après fermeture (${mode})`);
        ok(await p.locator('.filtres-place .filtres').count() === 1, `mobile : les filtres ne reviennent pas à leur place (${mode})`);
        if (mode !== 'bouton') ok(Math.abs((await p.evaluate(() => scrollY)) - y0) < 5, `mobile : la position de lecture est perdue (${mode})`);
        if (mode === 'bouton') { ok(await nbVisibles(p) < total, 'mobile : le filtre choisi dans la feuille ne s\'applique pas'); await p.locator('.filtres [data-filtre="ville"] [data-v="tout"]').evaluate((b) => b.click()); }
        await p.locator('.liste .jour:not([hidden])').nth(2).scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
      }
    }

    } catch (e) { echecs.push(`${nom} : étape interrompue (${e.message.split('\n')[0]} @l.${(String(e.stack).match(/tester-site\.cjs:(\d+)/) || [])[1] || '?'})`); }
    // --- Mini-carte de la soirée (la carte générale a été retirée) et anciens liens #carte ---
    try {
    const avecCarte = fs.readdirSync(path.join(ROOT, 'soiree')).find((d) => fs.readFileSync(path.join(ROOT, 'soiree', d, 'index.html'), 'utf8').includes('class="mini-carte"'));
    await p.goto(B + `soiree/${avecCarte}/`, { waitUntil: 'load' }); await p.locator('.mini-carte').scrollIntoViewIfNeeded(); await p.waitForTimeout(2500);
    ok(await p.locator('.mini-carte.maplibregl-map .repere, .mini-carte.sans-carte a[href*="google.com/maps"]').count() === 1, `${nom} : ni mini-carte ni adresse du lieu`);
    ok(await p.locator('.y-aller a[href*="google.com/maps/dir"]').count() >= 1, `${nom} : pas d'itinéraire sous la mini-carte`);
    await p.goto(B + '#carte', { waitUntil: 'load' }); await p.waitForTimeout(600);
    ok(/#agenda$/.test(p.url()) && await p.locator('.liste').isVisible(), `${nom} : un ancien lien #carte ne mène pas à l'agenda`);
    ok(await p.locator('a[href$="#carte"]').count() === 0, `${nom} : un lien vers la carte générale existe encore`);
    } catch (e) { echecs.push(`${nom} : étape interrompue (${e.message.split('\n')[0]} @l.${(String(e.stack).match(/tester-site\.cjs:(\d+)/) || [])[1] || '?'})`); }
    // --- Langues, loupe, retour en haut ---
    try {
    await p.goto(B + 'a-propos/', { waitUntil: 'load' });
    await p.locator('.langues summary').click(); await p.locator('.langues a[hreflang="en"]').click(); await p.waitForLoadState('load');
    ok(/\/en\/a-propos\/$/.test(p.url()), `${nom} : le changement de langue ne garde pas la page (${p.url()})`);
    await p.locator('a.loupe').click(); await p.waitForLoadState('load'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => document.activeElement?.id === 'recherche'), `${nom} : la loupe ne place pas le curseur dans la recherche`);
    await p.evaluate(() => scrollTo(0, 4000)); await p.waitForTimeout(400);
    if (await p.locator('.haut').isVisible()) { await p.locator('.haut').click(); await p.waitForTimeout(2500); ok(await p.evaluate(() => scrollY) < 50, `${nom} : « Haut de page » ne remonte pas`); } else echecs.push(`${nom} : bouton « Haut de page » absent`);

    } catch (e) { echecs.push(`${nom} : étape interrompue (${e.message.split('\n')[0]} @l.${(String(e.stack).match(/tester-site\.cjs:(\d+)/) || [])[1] || '?'})`); }
    // --- Page soirée : billets, calendrier, itinéraire, partage, code promo ---
    try {
    await p.goto(B + `soiree/${soireePromo}/`, { waitUntil: 'load' });
    const ics = await p.locator('a[download]').getAttribute('href');
    ok(ics && fs.existsSync(path.join(ROOT, 'soiree', soireePromo, ics)), `${nom} : fichier calendrier introuvable (${ics})`);
    ok(/google\.com\/maps/.test(await p.locator('.fiche-actions a', { hasText: /itin/i }).first().getAttribute('href')), `${nom} : lien itinéraire incorrect`);
    await p.locator('.partager').click(); await p.waitForTimeout(400);
    ok(await p.locator('.toast:not([hidden])').count() === 1 || nom === 'mobile', `${nom} : le partage ne fait rien`);
    if (await p.locator('[data-copier]').count()) { await p.locator('[data-copier]').first().click(); await p.waitForTimeout(300); ok(await p.locator('.toast:not([hidden])').count() === 1, `${nom} : copier le code promo ne fait rien`); }

    } catch (e) { echecs.push(`${nom} : étape interrompue (${e.message.split('\n')[0]} @l.${(String(e.stack).match(/tester-site\.cjs:(\d+)/) || [])[1] || '?'})`); }
    // --- Vidéo de Monaco : elle tourne en boucle, pas seulement 2 secondes ---
    try {
    await p.goto(B + 'soirees-monaco/', { waitUntil: 'load' }); await c.clock.runFor(0).catch(() => {});
    const t = await p.evaluate(() => new Promise((ok) => { const v = document.querySelector('video'); if (!v) return ok(-1); let max = 0, boucles = 0, prec = 0; v.addEventListener('timeupdate', () => { if (v.currentTime < prec) boucles++; prec = v.currentTime; max = Math.max(max, v.currentTime); }); setTimeout(() => ok({ max, boucles, paused: v.paused, duree: v.duration }), 20000); }));
    ok(t !== -1 && t.duree > 15 && t.max > t.duree - 2 && t.boucles >= 1 && !t.paused, `${nom} : la vidéo de Monaco ne tourne pas en entier / en boucle (${JSON.stringify(t)})`);
    } catch (e) { echecs.push(`${nom} : étape interrompue (${e.message.split('\n')[0]} @l.${(String(e.stack).match(/tester-site\.cjs:(\d+)/) || [])[1] || '?'})`); }
    await c.close().catch(() => {});
  }
  await b.close().catch(() => {});
  console.log(echecs.length ? `✗ ${echecs.length} problème(s) :\n- ${[...new Set(echecs)].join('\n- ')}` : '✓ Tous les scénarios passent.');
  process.exit(echecs.length ? 1 : 0);
})();
