// Tests « essayer de casser le site » : usages extrêmes ou inattendus. Même usage que tester-site.cjs.
const pw = (() => { try { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } catch { return require('playwright'); } })();
// Moteur choisi par NAVIGATEUR=chromium|webkit|firefox (WebKit = moteur de Safari / iPhone). Firefox ne gère pas isMobile.
const NAV = process.env.NAVIGATEUR || 'chromium';
const chromium = pw[NAV];
const devices = new Proxy(pw.devices, { get: (o, k) => { const d = o[k]; if (!d || NAV !== 'firefox') return d; const { isMobile, ...r } = d; return r; } });
const B = process.env.SITE || 'http://localhost:8765/';
const echecs = [];
const ok = (c, m) => { if (!c) echecs.push(m); };
const erreurs = (p, nom) => {
  p.setDefaultTimeout(4000);
  p.on('pageerror', (e) => echecs.push(`${nom} : erreur JavaScript ${e.message}`));
  // Politique de sécurité (CSP) : tout blocage d'une ressource du site est un bug.
  p.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) echecs.push(`${nom} : ressource bloquée par la CSP (${m.text().slice(0, 140)})`); });
};
const visibles = (p) => p.locator('.liste .carte:not([hidden])').count();

(async () => {
  const b = await chromium.launch();
  const etape = async (nom, fn) => { try { await fn(); } catch (e) { echecs.push(`${nom} : interrompu (${e.message.split('\n')[0]})`); } };

  await etape('saisies piégées', async () => {
    const c = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await c.newPage(); erreurs(p, 'saisies');
    await p.goto(B);
    for (const q of ['<script>alert(1)</script>', '(.*[', '😀🔥', '   ', 'a'.repeat(400), "l'antre", 'ÉTÉ', '%27%22', '\\']) {
      await p.locator('#recherche').fill(q); await p.waitForTimeout(250);
      ok(await p.locator('script:text("alert(1)")').count() === 0, `saisies : texte injecté dans la page (${q})`);
    }
    await p.locator('#recherche').fill('antre'); await p.waitForTimeout(250);
    ok(await visibles(p) > 0, 'saisies : « antre » ne trouve pas L\'Antre (accents, apostrophes)');
    await p.goto(B + '?q=' + encodeURIComponent('<img src=x onerror=alert(1)>'));
    ok(await p.locator('img[src="x"]').count() === 0, 'saisies : paramètre ?q injecté dans la page');
    await c.close();
  });

  await etape('clics frénétiques', async () => {
    const c = await b.newContext({ ...devices['iPhone 13'] }); const p = await c.newPage(); erreurs(p, 'clics');
    await p.goto(B);
    for (let i = 0; i < 40; i++) {
      const d = p.locator('.filtres details.filtre').nth(i % 5);
      await d.locator('summary').click({ force: true }).catch(() => {});
      const btn = d.locator('.groupe button').nth(i % 3);
      if (await btn.isVisible().catch(() => false)) await btn.click({ force: true }).catch(() => {});
    }
    // Selon l'heure, les clics au hasard peuvent laisser une combinaison de filtres sans aucune soirée : on remet tout.
    if (!(await p.locator('.liste .carte:not([hidden]):not(.plus-loin)').count())) await p.evaluate(() => document.querySelectorAll('.filtres .groupe [data-v="tout"], .filtres .groupe [data-v="date"]').forEach((b) => b.click()));
    const coeur = p.locator('.liste .carte:not([hidden]):not(.plus-loin) .coeur').first(); await coeur.scrollIntoViewIfNeeded(); await p.waitForTimeout(900);
    const avant = p.url(); await coeur.dblclick().catch(() => {}); await p.waitForTimeout(300);
    ok(p.url() === avant, 'clics : un double tap sur le cœur ouvre la soirée');
    ok(await p.evaluate(() => document.querySelectorAll('.carte').length) > 10, 'clics : des cartes ont disparu du DOM');
    await c.close();
  });

  await etape('feuille + rotation', async () => {
    const c = await b.newContext({ ...devices['iPhone 13'] }); const p = await c.newPage(); erreurs(p, 'rotation');
    await p.goto(B); await p.locator('.liste .jour:not([hidden]) .carte:not([hidden])').nth(5).scrollIntoViewIfNeeded(); // 6e soirée visible (un vendredi chargé n'affiche qu'un jour avant « Voir plus ») await p.waitForTimeout(300);
    // Mobile : la recherche et les filtres s'ouvrent depuis l'onglet « Chercher » de la barre du bas, où qu'on soit.
    await p.evaluate(() => scrollBy(0, -80)); await p.waitForTimeout(350); await p.locator('.onglets [data-chercher]').click(); await p.waitForTimeout(300);
    ok(await p.locator('.feuille-filtres').count() === 1, 'rotation : l\'onglet « Chercher » n\'ouvre pas la feuille de filtres');
    await p.setViewportSize({ width: 1024, height: 700 }); await p.waitForTimeout(400);
    ok(await p.locator('.feuille-filtres').count() === 0 && await p.locator('.filtres-place .filtres').count() === 1, 'rotation : la feuille reste ouverte ou les filtres sont perdus en passant en grand écran');
    ok(!(await p.evaluate(() => document.documentElement.classList.contains('bloque'))), 'rotation : la page reste bloquée');
    await c.close();
  });

  // 13/11/2026 (directeur : « voir les lieux fermés ne fait rien », « les alertes ne marchent pas »).
  await etape('lieux fermés + agenda', async () => {
    const c = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await c.newPage(); erreurs(p, 'fermés');
    await p.goto(B.replace(/\/?$/, '/') + 'ce-soir/'); await p.waitForTimeout(600);
    for (const v of await p.$$eval('.jc-villes [data-jc-ville]', (l) => l.map((x) => x.dataset.jcVille).filter(Boolean).slice(0, 4))) {
      await p.click(`.jc-villes [data-jc-ville="${v}"]`); await p.waitForTimeout(250);
      const btn = p.locator('.voir-fermes');
      if (await btn.isVisible()) {
        const n = +(await btn.textContent()).replace(/\D+/g, '');
        ok(n > 0, `fermés : bouton visible avec 0 lieu (${v})`);
      }
    }
    await c.close();
    const m = await b.newContext({ viewport: { width: 412, height: 900 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36' }); const q = await m.newPage();
    await q.goto(B);
    const g = await q.getAttribute('.abonnement .abo-google', 'href').catch(() => null);
    if (g) ok(/calendar\.google\.com\/calendar\/r\?cid=https/.test(g) && await q.isVisible('.abo-aide-android'), 'agenda : lien Google ou aide Android absents');
    await m.close();
  });

  await etape('navigation arrière', async () => {
    const c = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await c.newPage(); erreurs(p, 'arrière');
    await p.goto(B); await p.locator('#recherche').fill('techno'); await p.waitForTimeout(400);
    const n = await visibles(p);
    await p.locator('.liste .carte:not([hidden]) h3 a').first().click(); await p.waitForLoadState('load');
    await p.goBack(); await p.waitForLoadState('load'); await p.waitForTimeout(400);
    ok(await p.locator('#recherche').inputValue() === 'techno' && await visibles(p) === n, 'arrière : la recherche est perdue au retour');
    await c.close();
  });

  await etape('stockage bloqué', async () => {
    const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await c.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('bloqué'); } }); });
    const p = await c.newPage(); erreurs(p, 'stockage');
    await p.goto(B); await p.locator('.liste .carte:not([hidden]) .coeur').first().click();
    ok(await visibles(p) > 10, 'stockage : la page ne marche plus sans stockage local');
    await c.close();
  });

  await etape('sans JavaScript', async () => {
    const c = await b.newContext({ viewport: { width: 1280, height: 800 }, javaScriptEnabled: false }); const p = await c.newPage();
    await p.goto(B);
    const op = await p.locator('.liste .carte').first().evaluate((e) => getComputedStyle(e).opacity);
    ok(op === '1' && await p.locator('.liste .carte').count() > 10, 'sans JavaScript : les soirées sont invisibles');
    await p.goto(B + 'soirees-nice/'); ok(await p.locator('h1').isVisible(), 'sans JavaScript : page ville vide');
    await c.close();
  });

  await etape('position refusée', async () => {
    const c = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await c.newPage(); erreurs(p, 'position');
    await p.goto(B); await p.locator('details[data-bloc="acces"] summary').click(); await p.locator('[data-filtre="acces"] [data-v="pres"]').click(); await p.waitForTimeout(800);
    ok(await p.locator('.toast:not([hidden])').count() === 1, 'position : aucun message quand la localisation est refusée');
    ok(await visibles(p) > 10, 'position : l\'agenda est vidé quand la localisation est refusée');
    await c.close();
  });

  await etape('mini-carte hors ligne', async () => {
    const fs = require('fs'), path = require('path');
    const S = fs.readdirSync(path.resolve(__dirname, '..', 'soiree')).find((d) => fs.readFileSync(path.resolve(__dirname, '..', 'soiree', d, 'index.html'), 'utf8').includes('class="mini-carte"'));
    const c = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await c.newPage(); erreurs(p, 'carte');
    await p.route('**/tiles.openfreemap.org/**', (r) => r.abort());
    await p.goto(B + `soiree/${S}/`); await p.locator('.mini-carte').scrollIntoViewIfNeeded(); await p.waitForTimeout(2000);
    ok(await p.locator('.mini-carte .repere, .mini-carte.sans-carte a').count() === 1, 'carte : ni repère ni adresse sans fond de carte');
    await c.close();
  });

  await etape('clavier seul', async () => {
    const c = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await c.newPage(); erreurs(p, 'clavier');
    // Point de départ du Tab fixé au début de la page (Firefox garde sinon la position du dernier focus).
    await p.goto(B, { waitUntil: 'load' }); await p.evaluate(() => { document.activeElement?.blur(); document.body.setAttribute('tabindex', '-1'); document.body.focus(); document.body.removeAttribute('tabindex'); }); await p.keyboard.press('Tab');
    ok(await p.evaluate(() => document.activeElement?.classList.contains('saut')), 'clavier : le lien « Aller au contenu » n\'est pas le premier élément');
    await p.locator('details[data-bloc="ville"] summary').focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
    ok(await p.locator('details[data-bloc="ville"]').evaluate((d) => d.open), 'clavier : un menu de filtre ne s\'ouvre pas avec Entrée');
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    ok(!(await p.locator('details[data-bloc="ville"]').evaluate((d) => d.open)), 'clavier : Échap ne ferme pas le menu');
    await c.close();
  });

  await etape('cache et hors connexion', async () => {
    const c = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await c.newPage(); erreurs(p, 'cache');
    await p.goto(B); await p.waitForTimeout(2500);
    ok(await p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active), 'cache : le service worker ne s\'installe pas');
    await p.goto(B + 'soirees-nice/'); await p.waitForTimeout(600);
    await c.setOffline(true);
    await p.goto(B).catch(() => {}); await p.waitForLoadState('load').catch(() => {}); await p.locator('.liste .carte').first().waitFor({ timeout: 9000 }).catch(() => {}); // le service worker sert le cache après son délai réseau (6 s max)
    const nHorsLigne = await p.locator('.liste .carte').count().catch(async () => { await p.waitForTimeout(800); return p.locator('.liste .carte').count(); });
    // Playwright-Firefox ne fait pas passer sa coupure réseau par le service worker comme un vrai navigateur :
    // le hors-connexion est exigé sur Chromium et WebKit, et seulement signalé sous Firefox.
    if (NAV === 'firefox' && nHorsLigne <= 10) console.log('ℹ cache : hors connexion non vérifiable sous Playwright-Firefox (validé sur Chromium et WebKit)');
    else ok(nHorsLigne > 10, 'cache : une page déjà vue ne s\'affiche plus sans connexion');
    await c.setOffline(false); await p.reload(); await p.waitForTimeout(400);
    ok(await p.locator('.liste .carte').count() > 10, 'cache : la page ne revient pas après reconnexion');
    await c.close();
  });

  await etape('textes des boutons lisibles', async () => {
    const fs = require('fs'), path = require('path');
    const unDe = (d, n = 1) => { try { return fs.readdirSync(path.resolve(__dirname, '..', d)).filter((x) => !x.includes('.')).slice(0, n).map((x) => `${d}/${x}/`); } catch { return []; } };
    const pages = ['', 'soirees-nice/', 'soirees-techno/', 'a-propos/', 'partenaires/', 'ambassadeurs/', 'bde/', 'dates/', 'restaurants/', 'activites/', 'festivals/', 'clubs-bars/', 'france/', 'actus/', ...unDe('actus', 20), ...unDe('soiree', 3), 'mentions-legales/', 'cgu/', 'cgv/', 'confidentialite/', 'page-inexistante/', 'ar/', 'en/a-propos/'];
    for (const o of [{ viewport: { width: 1440, height: 900 } }, { ...devices['iPhone 13'] }]) {
      const c = await b.newContext(o); const p = await c.newPage(); erreurs(p, 'lisible');
      for (const u of pages) {
        await p.goto(B + u); await p.waitForTimeout(150);
        const illisibles = await p.evaluate(() => {
          const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
          const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
          const fond = (e) => { while (e) { const c = getComputedStyle(e).backgroundColor; const v = rgb(c); if (v.length === 3 || (v[3] ?? 1) > 0.5) return v.slice(0, 3); e = e.parentElement; } return [11, 11, 15]; };
          return [...document.querySelectorAll('a.bouton, button.bouton, .bouton, .puce, .fiche-actions a, button')].filter((e) => e.offsetParent && e.getBoundingClientRect().width > 0).filter((e) => {
            if (!e.textContent.trim() && !e.querySelector('svg, img') && !e.getAttribute('aria-label')) return true; // bouton vide
            if (!e.textContent.trim()) return false;
            const a = lum(rgb(getComputedStyle(e).color)), f = lum(fond(e));
            return (Math.max(a, f) + 0.05) / (Math.min(a, f) + 0.05) < 3;
          }).map((e) => (e.textContent.trim() || e.className).slice(0, 30));
        });
        ok(!illisibles.length, `lisible ${o.viewport?.width || 'mobile'} ${u || 'accueil'} : bouton vide ou texte illisible (${illisibles.join(' | ')})`);
      }
      await c.close();
    }
  });

  await etape('textes coupés', async () => {
    const fs = require('fs'), path = require('path');
    const unDe = (d, n) => { try { return fs.readdirSync(path.resolve(__dirname, '..', d)).filter((x) => !x.includes('.')).slice(0, n).map((x) => `${d}/${x}/`); } catch { return []; } };
    const pages = ['', 'a-propos/', 'actus/', ...unDe('actus', 3), ...unDe('soiree', 4), 'festivals/', 'clubs-bars/', 'restaurants/', 'activites/', 'dates/', 'partenaires/', 'france/', 'ar/', ...unDe('ar/soiree', 1)];
    for (const o of [{ viewport: { width: 1920, height: 1000 } }, { viewport: { width: 1280, height: 800 } }, { ...devices['iPhone 13'] }]) {
      const c = await b.newContext(o); const p = await c.newPage(); erreurs(p, 'coupé');
      for (const u of pages) {
        await p.goto(B + u); await p.waitForTimeout(150);
        await p.evaluate(() => {
          document.querySelectorAll('.reveal').forEach((e) => e.classList.add('vu'));
          // blocs rendus à l'approche : on force leur mise en page pour mesurer vraiment (WebKit les laisse vides sinon)
          document.querySelectorAll('*').forEach((e) => { if (getComputedStyle(e).contentVisibility === 'auto') e.style.contentVisibility = 'visible'; });
        });
        await p.waitForTimeout(700);
        const coupes = await p.evaluate(() => [...document.querySelectorAll('main h1, main h2, main h3, .ariane, .ariane a, main .bouton, main .etiquette, main .genre, main .lien')].filter((e) => {
          if (!e.offsetParent || e.closest('[hidden], .vh, .liste-defile, .collage, .marquee, .bandeau, .posts')) return false;
          const r = e.getBoundingClientRect(); if (!r.width) return false;
          for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
            const st = getComputedStyle(a);
            if (/(hidden|clip)/.test(st.overflowX + st.overflowY)) {
              const q = a.getBoundingClientRect();
              if (r.left < q.left - 1 || r.right > q.right + 1 || r.top < q.top - 1 || r.bottom > q.bottom + 1) return true;
            }
          }
          return false;
        }).map((e) => `${e.tagName.toLowerCase()}.${e.className || ''} « ${e.textContent.trim().slice(0, 25)} »`));
        ok(!coupes.length, `coupé ${o.viewport?.width || 'mobile'} ${u || 'accueil'} : texte rogné par son cadre (${coupes.slice(0, 4).join(' | ')})`);
      }
      await c.close();
    }
  });

  await etape('console propre et requêtes', async () => {
    const fs = require('fs'), path = require('path');
    const un = (d) => { try { return fs.readdirSync(path.resolve(__dirname, '..', d)).filter((x) => !x.includes('.')).slice(0, 1).map((x) => `${d}/${x}/`); } catch { return []; } };
    for (const o of [{ viewport: { width: 1440, height: 900 } }, { ...devices['iPhone 13'] }]) {
      const c = await b.newContext(o); const p = await c.newPage(); erreurs(p, 'console');
      const pb = []; let page404 = false;
      // Firefox signale aussi par le service worker les images dont le chargement est interrompu par le changement de
      // page (même cas que NS_BINDING_ABORTED plus bas) : chaque image citée est revérifiée à la fin (doit répondre 200).
      const aVerifier = new Set();
      p.on('console', (m) => { if (m.type() !== 'error' || /openfreemap|openstreetmap|net::ERR_(TUNNEL|NAME|CONNECTION)/.test(m.text()) || (page404 && /status of 404/.test(m.text()))) return;
        const sw = m.text().match(/Failed to load ‘([^’]+)’\. A ServiceWorker intercepted/); if (sw) { aVerifier.add(sw[1]); return; }
        pb.push(`console : ${m.text().slice(0, 120)}`); });
      p.on('requestfailed', (r) => { const u = r.url(); if (u.startsWith(B) && !/\.(mp4|webm)/.test(u) && !/ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(r.failure()?.errorText || '')) pb.push(`requête échouée : ${u.replace(B, '/')} (${r.failure()?.errorText})`); });
      p.on('response', (r) => { if (r.url().startsWith(B) && r.status() >= 400 && !/page-inexistante/.test(r.url())) pb.push(`HTTP ${r.status()} : ${r.url().replace(B, '/')}`); });
      for (const u of ['', 'a-propos/', 'actus/', ...un('actus'), ...un('soiree'), 'festivals/', 'clubs-bars/', 'partenaires/', 'dates/', 'restaurants/', 'activites/', 'france/', 'cgu/', 'confidentialite/', 'ar/', 'page-inexistante/']) {
        page404 = u === 'page-inexistante/'; // la page d'erreur répond 404 exprès
        await p.goto(B + u).catch(() => {}); await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(300);
      }
      for (const u of aVerifier) { const r = await c.request.get(u).catch(() => null); if (!r || r.status() !== 200) pb.push(`image cassée (service worker) : ${u.replace(B, '/')} (${r ? r.status() : 'injoignable'})`); }
      ok(!pb.length, `console ${o.viewport?.width || 'mobile'} : ${[...new Set(pb)].slice(0, 6).join(' | ')}`);
      await c.close();
    }
  });

  await etape('mini-carte du lieu', async () => {
    const fs = require('fs'), path = require('path');
    const S = fs.readdirSync(path.resolve(__dirname, '..', 'soiree')).find((d) => fs.readFileSync(path.resolve(__dirname, '..', 'soiree', d, 'index.html'), 'utf8').includes('class="mini-carte"'));
    ok(!!S, 'mini-carte : aucune page de soirée n\'a de mini-carte');
    if (!S) return;
    for (const o of [{ viewport: { width: 1440, height: 900 } }, { ...devices['iPhone 13'] }]) {
      const c = await b.newContext(o); const p = await c.newPage(); erreurs(p, 'mini-carte');
      await p.goto(B + `soiree/${S}/`); await p.locator('.mini-carte').scrollIntoViewIfNeeded(); await p.waitForTimeout(2000);
      ok(await p.locator('.mini-carte.maplibregl-map .repere, .mini-carte.sans-carte a[href*="google.com/maps"]').count() === 1, `mini-carte ${o.viewport?.width || 'mobile'} : carte ou repère du lieu absent`);
      await c.close();
    }
  });

  await etape('boutons recouverts', async () => {
    for (const o of [{ ...devices['iPhone 13'] }, { viewport: { width: 1440, height: 900 } }]) {
      const c = await b.newContext(o); const p = await c.newPage(); erreurs(p, 'recouvert');
      for (const u of ['', 'soirees-techno/', 'soirees-nice/']) {
        await p.goto(B + u); await p.waitForTimeout(300);
        const cartes = p.locator('.liste .carte:not([hidden])'); const n = Math.min(await cartes.count(), 12);
        for (let i = 0; i < n; i++) {
          const k = cartes.nth(i); await k.scrollIntoViewIfNeeded(); await p.waitForTimeout(80);
          const caches = await k.evaluate((carte) => [...carte.querySelectorAll('a, button')].filter((el) => el.offsetParent && !el.closest('[aria-hidden="true"]')).filter((el) => {
            const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return false;
            const x = r.left + r.width / 2, y = r.top + r.height / 2; const h = document.elementFromPoint(x, y);
            if (h && h.closest('.flottant, .haut, .barre-billets, header, .onglets')) return false; // barres flottantes de l'écran : elles s'effacent au défilement
            return h && !el.contains(h) && !h.contains(el);
          }).map((el) => el.textContent.trim().slice(0, 20) || el.className));
          ok(!caches.length, `recouvert ${u || 'accueil'} : bouton masqué par un autre élément (${caches.join(', ')})`);
        }
      }
      await c.close();
    }
  });

  await etape('très petits et très grands écrans', async () => {
    for (const vp of [{ width: 320, height: 568 }, { width: 568, height: 320 }, { width: 2560, height: 1440 }]) {
      const c = await b.newContext({ viewport: vp }); const p = await c.newPage(); erreurs(p, `écran ${vp.width}`);
      for (const u of ['', 'ar/', `soiree/${require('fs').readdirSync(require('path').resolve(__dirname, '../soiree'))[0]}/`, 'dates/', 'clubs-bars/']) {
        await p.goto(B + u); await p.waitForTimeout(200);
        const d = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        ok(d <= 1, `écran ${vp.width}×${vp.height} ${u} : débordement de ${d}px`);
      }
      await c.close();
    }
  });

  await b.close();
  console.log(echecs.length ? `✗ ${echecs.length} problème(s) :\n- ${[...new Set(echecs)].join('\n- ')}` : '✓ Le site résiste à tous les scénarios piégés.');
  process.exit(echecs.length ? 1 : 0);
})();
