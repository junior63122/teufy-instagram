// Site Teufy : filtres de l'agenda, « Ce soir / En ce moment », carte interactive, filtres flottants et animations.
// Les soirées sont déjà dans la page (bon pour Google) : le script ne fait que trier, masquer et animer.
(() => {
  const T = JSON.parse(document.getElementById('teufy-t')?.textContent || '{}');
  const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const jourParis = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
  const maintenant = Date.now();
  const auj = jourParis(new Date(maintenant - 6 * 3600e3)); // la nuit continue jusqu'à 6h du matin
  const jPlus = (n) => jourParis(new Date(Date.parse(auj + 'T12:00:00Z') + n * 864e5));
  const dow = new Date(auj + 'T12:00:00Z').getUTCDay(); // 0 = dimanche
  const vendredi = jPlus((5 - dow + 7) % 7), dimanche = jPlus((7 - dow) % 7);
  const DUREE = 6 * 3600e3; // durée supposée d'une soirée (l'heure de fin est rarement publiée)
  const debut = (c) => Date.parse(c.dataset.debut);
  const enCours = (c) => debut(c) <= maintenant && maintenant < debut(c) + DUREE;
  const nb = (n) => (n === 1 ? T.soiree : (T.soirees || '{n}').replace('{n}', n));

  const cartes = [...document.querySelectorAll('.liste .carte')];
  // Soirées terminées : elles disparaissent d'elles-mêmes (la page n'est régénérée qu'une fois par jour).
  const finies = new Set(cartes.filter((c) => c.dataset.jour < auj || maintenant > debut(c) + DUREE));
  document.querySelectorAll('.la-plus .carte').forEach((c) => { if (c.dataset.jour < auj) c.closest('.la-plus').hidden = true; });

  // --- Ce soir / En ce moment -------------------------------------------------------------------------------
  const ceSoir = document.getElementById('ce-soir');
  const soir = cartes.filter((c) => !finies.has(c) && c.dataset.jour === auj).sort((a, b) => enCours(b) - enCours(a) || debut(a) - debut(b));
  if (ceSoir && soir.length) {
    const rangee = ceSoir.querySelector('.rangee');
    for (const c of soir) {
      const k = c.cloneNode(true);
      const s = document.createElement('span');
      s.className = 'statut' + (enCours(c) ? ' en-cours' : '');
      if (enCours(c)) { const p = document.createElement('i'); p.className = 'point'; s.append(p, T.live); } else s.textContent = (T.bientot || '{h}').replace('{h}', c.dataset.heure);
      k.querySelector('.affiche')?.append(s);
      rangee.append(k);
    }
    ceSoir.hidden = false;
    const live = soir.filter(enCours).length;
    document.querySelectorAll('.pastille-live').forEach((p) => {
      p.querySelector('span').textContent = live ? `${T.live} · ${nb(live)}` : `${T.ceSoir} · ${nb(soir.length)}`;
      p.hidden = false;
    });
  }

  // --- Filtres ---------------------------------------------------------------------------------------------
  const etat = { quand: 'tout', ville: 'tout', style: 'tout', prix: 'tout', q: '' };
  const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  let favoris = new Set();
  try { favoris = new Set(JSON.parse(localStorage.getItem('teufy-favoris') || '[]')); } catch { /* stockage indisponible */ }
  const dansQuand = (j, c) => etat.quand === 'tout' || (etat.quand === 'soir' && j === auj) || (etat.quand === 'favoris' && favoris.has(c.dataset.id))
    || (etat.quand === 'semaine' && j >= auj && j <= jPlus(6))
    || (etat.quand === 'weekend' && j >= (dow >= 5 || dow === 0 ? auj : vendredi) && j <= dimanche);
  let visibles = 0;
  const appliquer = () => {
    visibles = 0;
    for (const c of cartes) {
      const p = c.dataset.prix === '' ? null : +c.dataset.prix;
      const ok = !finies.has(c) && dansQuand(c.dataset.jour, c) && (!etat.q || etat.q.split(/\s+/).every((m) => (c.dataset.q || '').includes(m))) && (etat.ville === 'tout' || c.dataset.ville === etat.ville)
        && (etat.style === 'tout' || c.dataset.styles.split(' ').includes(etat.style))
        && (etat.prix === 'tout' || (etat.prix === 'gratuit' ? p === 0 : p != null && p < 10));
      c.hidden = !ok; if (ok) visibles++;
    }
    document.querySelectorAll('.liste .jour').forEach((j) => { j.hidden = !j.querySelector('.carte:not([hidden])'); });
    const aucune = document.getElementById('aucune');
    if (aucune) { aucune.hidden = visibles > 0 || !cartes.length; if (etat.q && !visibles) aucune.textContent = (T.aucunRes || '').replace('{q}', etat.qBrut); else if (aucune.dataset.texte) aucune.textContent = aucune.dataset.texte; }
    document.querySelectorAll('.nb-res').forEach((p) => { p.textContent = etat.q ? (T.resultats || '').replace('{n}', visibles).replace('{q}', etat.qBrut) : ''; });
    document.querySelectorAll('.ouvrir-filtres .compte').forEach((b) => { b.textContent = cartes.length ? visibles : ''; });
    animerCartes();
    if (vue === 'carte') dessiner();
  };
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('.filtres .groupe button'); if (!b) return;
    const g = b.parentElement;
    g.querySelectorAll('button').forEach((x) => x.classList.toggle('actif', x === b));
    etat[g.dataset.filtre] = b.dataset.v; appliquer();
  });


  // --- Recherche -------------------------------------------------------------------------------------------
  const champs = [...document.querySelectorAll('.recherche input')];
  const aucuneP = document.getElementById('aucune'); if (aucuneP) aucuneP.dataset.texte = aucuneP.textContent;
  let minuteur = 0;
  const chercher = (v, source) => {
    etat.qBrut = v.trim(); etat.q = norm(v);
    champs.forEach((c) => { if (c !== source) c.value = v; c.parentElement.querySelector('.effacer').hidden = !v; });
    clearTimeout(minuteur);
    minuteur = setTimeout(() => {
      appliquer();
      const u = new URL(location.href); if (etat.q) u.searchParams.set('q', etat.qBrut); else u.searchParams.delete('q');
      history.replaceState(null, '', u);
    }, 120);
  };
  champs.forEach((c) => {
    c.addEventListener('input', () => chercher(c.value, c));
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); c.blur(); if (vue === 'liste') document.querySelector('.liste')?.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth' }); } });
    c.parentElement.querySelector('.effacer')?.addEventListener('click', () => { c.value = ''; chercher('', null); c.focus(); });
  });
  document.querySelector('.hero-recherche')?.addEventListener('submit', (e) => {
    e.preventDefault();
    agenda?.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth' });
  });

  // --- Favoris (gardés dans ce navigateur uniquement) ------------------------------------------------------
  const majCoeurs = () => document.querySelectorAll('[data-id] .coeur').forEach((b) => b.setAttribute('aria-pressed', favoris.has(b.closest('[data-id]').dataset.id)));
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('.coeur'); if (!b) return;
    const id = b.closest('[data-id]')?.dataset.id; if (!id) return;
    if (favoris.has(id)) favoris.delete(id); else favoris.add(id);
    try { localStorage.setItem('teufy-favoris', JSON.stringify([...favoris])); } catch { /* navigation privée */ }
    majCoeurs(); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    if (etat.quand === 'favoris') appliquer();
  });
  majCoeurs();

  // --- Partage, toast, retour en haut ----------------------------------------------------------------------
  const toast = (m) => { const t = document.querySelector('.toast'); if (!t) return; t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2200); };
  document.addEventListener('click', async (ev) => {
    if (!ev.target.closest('.partager')) return;
    const d = { title: document.title, url: location.href.split('#')[0] };
    try { if (navigator.share) await navigator.share(d); else { await navigator.clipboard.writeText(d.url); toast(T.lienCopie); } } catch { /* partage annulé */ }
  });
  const haut = document.querySelector('.haut');
  haut?.addEventListener('click', () => scrollTo({ top: 0, behavior: reduit ? 'auto' : 'smooth' }));

  // --- Filtres flottants (mobile) : un bouton en bas de l'écran ouvre les filtres en feuille ----------------
  const place = document.querySelector('.filtres-place'), filtres = document.querySelector('.filtres'), agenda = document.getElementById('agenda');
  const flottant = document.querySelector('.flottant');
  const mobile = matchMedia('(max-width: 759px)');
  let voile = null;
  const ouvrir = () => {
    place.style.minHeight = place.offsetHeight + 'px';
    filtres.classList.add('feuille');
    voile = Object.assign(document.createElement('div'), { className: 'voile' });
    voile.addEventListener('click', fermer);
    document.body.append(voile);
    flottant.hidden = true;
  };
  function fermer() {
    if (!filtres.classList.contains('feuille')) return;
    filtres.classList.remove('feuille');
    place.style.minHeight = '';
    voile?.remove(); voile = null;
    const cible = vue === 'carte' ? document.getElementById('carte') : document.querySelector('.liste');
    if (cible && cible.getBoundingClientRect().top < 0) cible.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'start' });
    majFlottant();
  }
  const majFlottant = () => {
    if (!flottant || !place || filtres.classList.contains('feuille')) return;
    const r = place.getBoundingClientRect(), a = agenda.getBoundingClientRect();
    flottant.hidden = !(mobile.matches && r.bottom < 0 && a.bottom > innerHeight * 0.6);
  };
  if (!place && haut) addEventListener('scroll', () => { haut.hidden = scrollY < 1400; }, { passive: true });
  if (place && flottant) {
    flottant.querySelector('button').addEventListener('click', ouvrir);
    filtres.querySelector('.fermer-filtres')?.addEventListener('click', fermer);
    addEventListener('keydown', (e) => { if (e.key === 'Escape') fermer(); });
    let attente = false;
    addEventListener('scroll', () => { if (!attente) { attente = true; requestAnimationFrame(() => { attente = false; majFlottant(); if (haut) haut.hidden = scrollY < 1400; }); } }, { passive: true });
    mobile.addEventListener?.('change', majFlottant);
  }

  // --- Vue liste / carte -------------------------------------------------------------------------------------
  let vue = 'liste';
  const zoneCarte = document.getElementById('carte'), liste = document.querySelector('.liste');
  const choisirVue = (v) => {
    if (!zoneCarte) return;
    vue = v;
    document.querySelectorAll('.vues [data-vue]').forEach((b) => b.classList.toggle('actif', b.dataset.vue === v));
    zoneCarte.hidden = v !== 'carte'; liste.hidden = v === 'carte';
    if (v === 'carte') dessiner();
  };
  document.querySelectorAll('.vues [data-vue]').forEach((b) => b.addEventListener('click', () => choisirVue(b.dataset.vue)));
  // Les liens « Carte » (menu, hero) ouvrent la carte au lieu de sauter à une ancre cachée.
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('a[href$="#carte"]'); if (!a || !zoneCarte) return;
    const u = new URL(a.href, location.href);
    if (u.pathname !== location.pathname) return;
    ev.preventDefault(); choisirVue('carte'); history.replaceState(null, '', '#carte');
    agenda.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth' });
  });

  let promesse = null, carteL = null, calque = null;
  const chargerLeaflet = () => promesse ||= new Promise((ok, ko) => {
    const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: T.base + 'site/vendor/leaflet/leaflet.css' });
    const js = Object.assign(document.createElement('script'), { src: T.base + 'site/vendor/leaflet/leaflet.js' });
    js.onload = () => ok(window.L); js.onerror = ko;
    document.head.append(css, js);
  });
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const bulle = (l) => {
    const d = el('div');
    d.append(el('p', 'pop-lieu', l[0].querySelector('.ou')?.textContent || ''));
    for (const c of l) {
      const s = el('div', 'pop-soiree');
      s.append(el('strong', '', c.querySelector('h3')?.textContent || ''), el('small', '', `${enCours(c) ? '● ' + T.live + ' · ' : ''}${c.querySelector('.date')?.textContent || ''} · ${c.dataset.heure}`));
      const b = c.querySelector('.actions .bouton');
      if (b) { const a = el('a', '', b.textContent); a.href = b.href; a.target = '_blank'; a.rel = 'noopener'; s.append(el('br'), a); }
      d.append(s);
    }
    if (l[0].dataset.approx) d.append(el('p', 'pop-approx', T.approx));
    return d;
  };
  async function dessiner() {
    let L;
    try { L = await chargerLeaflet(); } catch { return; }
    if (!carteL) {
      carteL = L.map(zoneCarte.querySelector('.leaflet-zone'), { scrollWheelZoom: false }).setView([43.62, 7.15], 10);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>', subdomains: 'abcd', maxZoom: 19,
      }).addTo(carteL);
      carteL.on('click', () => carteL.scrollWheelZoom.enable());
      calque = L.layerGroup().addTo(carteL);
    }
    calque.clearLayers();
    const lieux = new Map();
    for (const c of cartes) if (!c.hidden && c.dataset.lat) { const k = c.dataset.lat + ',' + c.dataset.lng; if (!lieux.has(k)) lieux.set(k, []); lieux.get(k).push(c); }
    const points = [];
    lieux.forEach((l, k) => {
      const ll = k.split(',').map(Number); points.push(ll);
      const html = `<div class="repere${l.some(enCours) ? ' en-cours' : ''}${l[0].dataset.approx ? ' approx' : ''}"><b>${l.length}</b></div>`;
      L.marker(ll, { icon: L.divIcon({ className: '', html, iconSize: [34, 34], iconAnchor: [17, 40], popupAnchor: [0, -36] }) }).bindPopup(bulle(l), { maxWidth: 280 }).addTo(calque);
    });
    zoneCarte.querySelector('.carte-vide').hidden = points.length > 0;
    setTimeout(() => { carteL.invalidateSize(); if (points.length) carteL.fitBounds(points, { padding: [40, 40], maxZoom: 14 }); }, 60);
  }

  // --- Animations ---------------------------------------------------------------------------------------------
  const io = 'IntersectionObserver' in window;
  const compter = (s) => {
    const n = +s.dataset.compte, pre = s.dataset.prefixe || '', suf = s.dataset.suffixe || '';
    if (reduit || !n) return;
    const t0 = performance.now();
    const pas = (t) => { const k = Math.min(1, (t - t0) / 1200); s.textContent = pre + Math.round(n * (1 - Math.pow(1 - k, 3))) + suf; if (k < 1) requestAnimationFrame(pas); };
    requestAnimationFrame(pas);
  };
  const montrer = (e) => { e.classList.add('vu'); e.querySelectorAll('[data-compte]').forEach(compter); };
  const obs = io ? new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { montrer(x.target); obs.unobserve(x.target); } }), { rootMargin: '0px 0px -4% 0px' }) : null;
  document.querySelectorAll('.reveal').forEach((e) => (obs ? obs.observe(e) : montrer(e)));

  const obsCartes = io && !reduit ? new IntersectionObserver((es) => es.forEach((x) => {
    if (x.isIntersecting) { x.target.classList.add('entre'); obsCartes.unobserve(x.target); }
  }), { rootMargin: '0px 0px -6% 0px' }) : null;
  let premier = true;
  function animerCartes() {
    if (!obsCartes) return;
    requestAnimationFrame(() => { premier = false; });
    document.querySelectorAll('.liste .grille').forEach((g) => {
      [...g.querySelectorAll('.carte:not([hidden])')].forEach((c, i) => {
        c.style.setProperty('--i', i % 3);
        if (!premier) c.classList.remove('entre');
        obsCartes.observe(c);
      });
    });
  }
  if (reduit) document.querySelectorAll('video').forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });

  const q0 = new URLSearchParams(location.search).get('q');
  if (q0 && champs.length) { champs.forEach((c) => { c.value = q0; }); etat.qBrut = q0; etat.q = norm(q0); champs.forEach((c) => { c.parentElement.querySelector('.effacer').hidden = false; }); setTimeout(() => agenda?.scrollIntoView(), 60); }
  appliquer();
  majFlottant();
  if (location.hash === '#recherche') { const c = document.getElementById('recherche'); if (c) { agenda.scrollIntoView(); setTimeout(() => c.focus({ preventScroll: true }), 80); } }
  document.querySelector('a.loupe[href="#recherche"]')?.addEventListener('click', (e) => { const c = document.getElementById('recherche'); if (!c) return; e.preventDefault(); if (vue !== 'liste') choisirVue('liste'); agenda.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth' }); setTimeout(() => c.focus({ preventScroll: true }), 350); });
  addEventListener('hashchange', () => { if (location.hash === '#recherche') { agenda?.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth' }); setTimeout(() => document.getElementById('recherche')?.focus({ preventScroll: true }), 350); } });
  if (location.hash === '#carte') { choisirVue('carte'); setTimeout(() => agenda?.scrollIntoView(), 50); }
})();
