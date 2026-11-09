// Tests « essayer de casser le site » : usages extrêmes ou inattendus. Même usage que tester-site.cjs.
const { chromium, devices } = (() => { try { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } catch { return require('playwright'); } })();
const B = process.env.SITE || 'http://localhost:8765/';
const echecs = [];
const ok = (c, m) => { if (!c) echecs.push(m); };
const erreurs = (p, nom) => { p.setDefaultTimeout(4000); p.on('pageerror', (e) => echecs.push(`${nom} : erreur JavaScript ${e.message}`)); };
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
    const coeur = p.locator('.liste .carte:not([hidden]) .coeur').first(); await coeur.scrollIntoViewIfNeeded(); await p.waitForTimeout(900);
    const avant = p.url(); await coeur.dblclick().catch(() => {}); await p.waitForTimeout(300);
    ok(p.url() === avant, 'clics : un double tap sur le cœur ouvre la soirée');
    ok(await p.evaluate(() => document.querySelectorAll('.carte').length) > 10, 'clics : des cartes ont disparu du DOM');
    await c.close();
  });

  await etape('feuille + rotation', async () => {
    const c = await b.newContext({ ...devices['iPhone 13'] }); const p = await c.newPage(); erreurs(p, 'rotation');
    await p.goto(B); await p.locator('.liste .jour:not([hidden])').nth(2).scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    await p.locator('.ouvrir-filtres').click(); await p.waitForTimeout(300);
    await p.setViewportSize({ width: 1024, height: 700 }); await p.waitForTimeout(400);
    ok(await p.locator('.feuille-filtres').count() === 0 && await p.locator('.filtres-place .filtres').count() === 1, 'rotation : la feuille reste ouverte ou les filtres sont perdus en passant en grand écran');
    ok(!(await p.evaluate(() => document.documentElement.classList.contains('bloque'))), 'rotation : la page reste bloquée');
    await c.close();
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

  await etape('carte hors ligne', async () => {
    const c = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await c.newPage(); erreurs(p, 'carte');
    await p.route('**/basemaps.cartocdn.com/**', (r) => r.abort());
    await p.goto(B + '#carte'); await p.waitForTimeout(1500);
    ok(await p.locator('.repere').count() > 0, 'carte : les repères disparaissent sans fond de carte');
    await c.close();
  });

  await etape('clavier seul', async () => {
    const c = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await c.newPage(); erreurs(p, 'clavier');
    await p.goto(B); await p.keyboard.press('Tab');
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
    await p.goto(B).catch(() => {});
    ok(await p.locator('.liste .carte').count() > 10, 'cache : une page déjà vue ne s\'affiche plus sans connexion');
    await c.setOffline(false); await p.reload(); await p.waitForTimeout(400);
    ok(await p.locator('.liste .carte').count() > 10, 'cache : la page ne revient pas après reconnexion');
    await c.close();
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
