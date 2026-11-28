const { chromium } = require('playwright');
// Scénarios rejoués à chaque contrôle (défauts trouvés par les testeurs du 23/11/2026, un par ligne ; tout « KO » = échec).
// Usage : node outils/serveur-local.cjs & puis node outils/tester-scenarios.cjs  (BASE=http://localhost:8765/ par défaut)
const B = process.env.BASE || 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const out = [];
  const ok = (n, v, d = '') => out.push(`${v ? 'OK ' : 'KO '} ${n}${d ? ' — ' + d : ''}`);
  // 1. Près de moi depuis Nice : aucune soirée du Var placée à Nice
  { const c = await b.newContext({ geolocation: { latitude: 43.7009, longitude: 7.2683 }, permissions: ['geolocation'], viewport: { width: 1440, height: 900 } }); const p = await c.newPage();
    await p.goto(B, { waitUntil: 'networkidle' });
    const r = await p.evaluate(() => [...document.querySelectorAll('.carte[data-ville="var"]')].filter((x) => x.dataset.lat).map((x) => Math.round(Math.hypot((+x.dataset.lat - 43.7009) * 111, (+x.dataset.lng - 7.2683) * 80))));
    ok('Var : plus aucune soirée placée à Nice (Saint-Raphaël est à 48 km)', r.every((km) => km > 30), `distances ${[...new Set(r)].slice(0, 8).join(', ')} km`); await c.close(); }
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const visibles = () => p.evaluate(() => [...document.querySelectorAll('.liste .carte')].filter((c) => c.offsetParent).length);
  await p.goto(B, { waitUntil: 'networkidle' });
  await p.fill('.filtres .recherche input', '%'); await p.waitForTimeout(800);
  ok('Recherche « % » ne montre plus tout', (await visibles()) === 0, String(await visibles()));
  await p.goto(B + 'en/', { waitUntil: 'networkidle' }); await p.fill('.filtres .recherche input', 'this weekend techno'); await p.waitForTimeout(900);
  ok('EN « this weekend techno » comprend', (await visibles()) > 1, `${await visibles()} résultats`);
  ok('Bouton « Clear all » visible avec une recherche', await p.evaluate(() => !document.querySelector('.reinit-filtres').hidden));
  await p.click('.reinit-filtres'); await p.waitForTimeout(400);
  ok('Tout effacer remet tout', await p.evaluate(() => document.querySelector('.reinit-filtres').hidden && !document.querySelector('.filtres .recherche input').value));
  await p.goto(B, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.querySelector('.groupe[data-filtre="ville"]').closest('details').setAttribute('open', ''));
  await p.click('.groupe[data-filtre="ville"] button[data-v="nice"]'); await p.waitForTimeout(300);
  const avant = await visibles();
  const lien = await p.evaluate(() => [...document.querySelectorAll('.liste .carte')].find((c) => c.offsetParent)?.querySelector('a[href*="soiree/"]')?.href);
  await p.goto(lien, { waitUntil: 'networkidle' }); await p.goBack({ waitUntil: 'networkidle' }); await p.waitForTimeout(400);
  ok('Filtre Nice gardé après retour', avant === (await visibles()), `${avant} → ${await visibles()}`);
  const z = await p.evaluate(() => [...document.querySelectorAll('.carte')].map((c) => [c.dataset.ville, c.textContent]).filter(([, t]) => /juan-les|mandelieu|la garde|farl[eè]de|saint-laurent-du-var/i.test(t)).map(([v, t]) => `${v}:${(t.match(/juan-les[- ]pins|mandelieu|la garde|farl[eè]de|saint-laurent-du-var/i) || [''])[0]}`));
  ok('Zones des villes', z.every((x) => /^(antibes:juan|cannes:mandelieu|var:(la garde|farl)|nice:saint-laurent)/i.test(x)), [...new Set(z)].join(' | '));
  const t = await (await b.newContext({ viewport: { width: 768, height: 1024 } })).newPage(); await t.goto(B, { waitUntil: 'networkidle' });
  const hors = [];
  for (const d of await t.$$('details.filtre')) {
    await d.evaluate((x) => { x.open = true; }); await t.waitForTimeout(150);
    const r = await d.evaluate((x) => { const g = x.querySelector(':scope>.groupe').getBoundingClientRect(); return [Math.round(g.left), Math.round(g.right)]; });
    if (r[0] < 0 || r[1] > 768) hors.push(r.join('→'));
    await d.evaluate((x) => { x.open = false; });
  }
  ok('Menus déroulants dans l\'écran à 768', !hors.length, hors.join(' '));
  const q = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await q.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  await q.goto(B + 'clubs-bars/', { waitUntil: 'networkidle' });
  for (let i = 0; i < 25; i++) { await q.mouse.wheel(0, 600); await q.waitForTimeout(120); }
  const cls = await q.evaluate(() => window.__cls); ok('CLS au défilement /clubs-bars/ < 0,1', cls < 0.1, cls.toFixed(3));
  await p.goto(B, { waitUntil: 'networkidle' });
  const mauvais = await p.evaluate(() => [...document.querySelectorAll('a.bouton')].filter((a) => /google\.|instagram\.com/.test(a.href) && /^(Billets|Tickets)$/i.test(a.textContent.trim())).length);
  ok('Aucun bouton « Billets » vers Google ou Instagram (accueil)', mauvais === 0, String(mauvais));
  // 26/11/2026 (directeur) : l'accueil disait 10 soirées ce soir, la page Ce soir 1 (ville gardée d'une visite précédente).
  { const c = await b.newContext({ viewport: { width: 1280, height: 800 } }); await c.addInitScript(() => { try { localStorage.setItem('teufy-jc', JSON.stringify({ r: '', v: 'cannes' })); } catch {} });
    const x = await c.newPage(); await x.goto(B, { waitUntil: 'networkidle' });
    const nAcc = await x.evaluate(() => [...document.querySelectorAll('#ce-soir .carte')].filter((k) => !k.hidden).length);
    await x.goto(B + 'ce-soir/', { waitUntil: 'networkidle' }); await x.waitForTimeout(300);
    const nPage = await x.evaluate(() => [...document.querySelectorAll('.ce-soir-liste .carte')].filter((k) => !k.hidden && !k.classList.contains('hors-ville')).length);
    ok('Ce soir : même nombre de soirées sur l\'accueil et sur la page Ce soir (ancienne ville choisie ignorée)', nAcc === nPage, `${nAcc} / ${nPage}`); await c.close(); }
  // 27/11/2026 (audit d'accessibilité) : la feuille des filtres sur téléphone a un nom, garde le focus et se ferme avec Échap.
  { const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const x = await c.newPage(); await x.goto(B, { waitUntil: 'networkidle' });
    await x.evaluate(() => { const f = document.querySelector('.flottant'); if (f) { f.hidden = false; f.querySelector('button').click(); } }); await x.waitForTimeout(400);
    const nom = await x.evaluate(() => document.querySelector('.feuille-filtres')?.getAttribute('aria-label') || '');
    let dehors = 0; for (let i = 0; i < 40; i++) { await x.keyboard.press('Tab'); if (!(await x.evaluate(() => !!document.activeElement.closest('.feuille-filtres')))) dehors++; }
    await x.keyboard.press('Escape'); await x.waitForTimeout(300);
    const ferme = await x.evaluate(() => !document.querySelector('.feuille-filtres') && document.activeElement !== document.body);
    ok('Feuille des filtres (téléphone) : nommée, Tab reste dedans, Échap ferme et rend le focus', !!nom && dehors === 0 && ferme, `nom « ${nom} », ${dehors} Tab dehors, fermée ${ferme}`); await c.close(); }
  // 28/11/2026 (contrôle terrain) : à 2 h du matin, la pastille « Ce soir » = soirées encore en cours sur la page Ce soir.
  { const c = await b.newContext({ viewport: { width: 1280, height: 800 } }); const x = await c.newPage();
    const nuit = new Date(); nuit.setUTCHours(1, 0, 0, 0); if (nuit < new Date()) nuit.setUTCDate(nuit.getUTCDate() + 1);
    await x.clock.install({ time: nuit }); await x.goto(B + 'ce-soir/', { waitUntil: 'networkidle' }); await x.waitForTimeout(300);
    const r = await x.evaluate(() => ({ p: +(document.querySelector('.nav a[href$="ce-soir/"] .nb-notif')?.textContent || 0), n: [...document.querySelectorAll('.ce-soir-liste .carte')].filter((k) => !k.hidden).length }));
    ok('Pastille « Ce soir » à 2 h = soirées encore visibles sur la page', r.p === r.n, `${r.p} / ${r.n}`); await c.close(); }
  console.log(out.join('\n')); await b.close();
  const ko = out.filter((x) => x.startsWith('KO')).length;
  console.log(ko ? `✗ ${ko} scénario(s) en échec.` : `✓ ${out.length} scénarios rejoués, tous bons.`);
  process.exit(ko ? 1 : 0);
})();
