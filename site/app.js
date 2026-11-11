// Site Teufy : agenda (filtres multiples, recherche, près de moi, transports), « Ce soir / En ce moment », carte, favoris,
// filtres en feuille sur mobile, partage et animations. Les soirées sont déjà dans la page (bon pour Google) :
// le script ne fait que trier, masquer et animer.
(() => {
  const T = JSON.parse(document.getElementById('teufy-t')?.textContent || '{}');
  const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Défilement doux seulement pour les liens dans la page : en arrivant sur une ancre (…/#tarifs), on y est tout de suite.
  if (!reduit) addEventListener('load', () => setTimeout(() => document.documentElement.classList.add('doux'), 50), { once: true });
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
  const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const toast = (m) => { const t = document.querySelector('.toast'); if (!t || !m) return; t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2600); };

  // Menu : la rubrique ouverte est centrée dans la barre (on sait où l'on est, même au fond du menu).
  { const n = document.querySelector('.nav'), a = n?.querySelector('[aria-current]');
    if (n && a && n.scrollWidth > n.clientWidth) n.scrollLeft = a.offsetLeft - (n.clientWidth - a.offsetWidth) / 2; }

  // Menu « Villes ▾ » : se ferme en cliquant ailleurs ou avec Échap.
  document.querySelectorAll('.nav-groupe').forEach((d) => {
    d.addEventListener('toggle', () => { if (d.open) document.querySelectorAll('.nav-groupe[open]').forEach((x) => { if (x !== d) x.open = false; }); });
    document.addEventListener('click', (e) => { if (d.open && !d.contains(e.target)) d.open = false; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && d.open) { d.open = false; d.querySelector('summary').focus(); } });
  });

  // Lieux : ouvert / fermé ce soir, à l'heure de Paris (la nuit continue jusqu'à 6 h). Une soirée prévue au lieu ce soir
  // prime : le lieu est forcément ouvert. Sans horaires vérifiés : « Horaires non confirmés » (jamais deviné).
  const lieux = [...document.querySelectorAll('.fiche-lieu')];
  if (lieux.length) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(maintenant)).map((x) => [x.type, x.value]));
    const JOUR = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    let jour = JOUR[p.weekday], min = +p.hour * 60 + +p.minute;
    if (min < 360) { jour = jour === 1 ? 7 : jour - 1; min += 1440; } // entre minuit et 6 h : c'est encore « ce soir »
    const enMin = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
    const fmt = (h) => h.replace(/^0/, '').replace(':00', 'h').replace(':', 'h');
    for (const el of lieux) {
      const st = el.querySelector('.lieu-statut'); if (!st) continue;
      let txt = '', cls = '';
      const soir = (() => { try { return JSON.parse(el.dataset.soirs || '[]').find((x) => x[0] === auj); } catch { return null; } })();
      const plages = (() => { try { return JSON.parse(el.dataset.horaires || 'null'); } catch { return null; } })();
      const pl = plages && plages.find((x) => x.j.includes(jour));
      if (pl) {
        const de = enMin(pl.de); let a = enMin(pl.a); if (a <= de) a += 1440;
        if (min < de) { txt = (T.ouvreA || '{h}').replace('{h}', fmt(pl.de)); cls = 'bientot'; }
        else if (min < a) { txt = (T.ouvertJusqua || '{h}').replace('{h}', fmt(pl.a)); cls = 'ouvert'; }
        else { txt = T.fermeMaint; cls = 'ferme'; }
      } else if (plages) { txt = T.fermeCeSoir; cls = 'ferme'; }
      if (soir && cls !== 'ouvert') { txt = (T.soireeA || '{h}').replace('{h}', fmt(soir[1])); cls = 'soiree'; }
      if (!txt) { txt = T.horairesInconnus; cls = 'inconnu'; }
      if (el.dataset.saison && plages) txt += ` · ${T.saison}`;
      st.textContent = txt; st.className = `lieu-statut ${cls}`; st.hidden = false; el.dataset.statut = cls;
    }
    // Page « Ce soir » : les lieux ouverts d'abord, puis ceux qui ouvrent, puis les inconnus ; les fermés repliés.
    const rang = { ouvert: 0, soiree: 1, bientot: 2, inconnu: 3, ferme: 4 };
    document.querySelectorAll('.lieux-ce-soir').forEach((g) => {
      const l = [...g.querySelectorAll('.fiche-lieu')].sort((a, b) => rang[a.dataset.statut] - rang[b.dataset.statut]);
      l.forEach((x) => g.append(x));
      const fermes = l.filter((x) => x.dataset.statut === 'ferme');
      const compteur = document.querySelector(`[data-compte-ouverts="${g.id}"]`);
      if (compteur) compteur.textContent = String(l.filter((x) => ['ouvert', 'soiree', 'bientot'].includes(x.dataset.statut)).length);
      if (fermes.length && g.dataset.replier) { fermes.forEach((x) => { x.hidden = true; }); const b = g.parentElement.querySelector('.voir-fermes'); if (b) { b.hidden = false; b.querySelector('span').textContent = fermes.length; b.addEventListener('click', () => { fermes.forEach((x) => { x.hidden = false; }); b.remove(); if (g.dataset.max) { g.dataset.deplie = '1'; replier(g); } }); } }
    });
  }

  // Annuaires de lieux : les N premiers lieux visibles, puis « Voir les N autres » (recalculé quand on change de ville).
  const replier = (g) => {
    const max = +g.dataset.max; if (!max) return;
    const vis = [...g.children].filter((x) => !x.hidden && !x.classList.contains('hors-ville'));
    [...g.children].forEach((x) => x.classList.remove('en-trop'));
    vis.slice(max).forEach((x) => x.classList.add('en-trop'));
    let b = g.nextElementSibling?.classList.contains('voir-autres') ? g.nextElementSibling : null;
    const reste = vis.length - max;
    if (reste > 0 && !g.dataset.deplie) {
      if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'bouton contour voir-autres'; b.addEventListener('click', () => { g.dataset.deplie = '1'; g.querySelectorAll('.en-trop').forEach((x) => x.classList.remove('en-trop')); b.hidden = true; }); g.after(b); }
      b.textContent = (T.voirAutresLieux || 'Voir les {n} autres lieux').replace('{n}', reste); b.hidden = false;
    } else { if (b) b.hidden = true; if (g.dataset.deplie) g.querySelectorAll('.en-trop').forEach((x) => x.classList.remove('en-trop')); }
  };
  document.querySelectorAll('.fiches[data-max]').forEach(replier);

  // Pages des lieux et suggestions : une soirée déjà passée disparaît (la page n'est régénérée qu'une fois par jour).
  document.querySelectorAll('.lieu-bloc .carte, .similaires .carte').forEach((c) => { if (c.dataset.jour && (c.dataset.jour < auj || maintenant > debut(c) + DUREE)) c.hidden = true; });
  // Page « Ce soir » : seulement les soirées de ce soir pas encore finies ; filtre des lieux par ville.
  const listeSoir = document.querySelector('.ce-soir-liste');
  if (listeSoir) {
    const restantes = [...listeSoir.querySelectorAll('.carte')].filter((c) => { const ok = c.dataset.jour === auj && maintenant < debut(c) + DUREE; c.hidden = !ok; return ok; });
    const n = document.querySelector('[data-compte-soir]'); if (n) n.textContent = `· ${nb(restantes.length)}`;
    if (!restantes.length) document.querySelector('[data-aucune-soiree]')?.removeAttribute('hidden');
  }
  document.querySelectorAll('.filtre-villes').forEach((f) => f.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ville]'); if (!b) return;
    f.querySelectorAll('.puce').forEach((x) => x.classList.toggle('actif', x === b));
    document.querySelectorAll('#lieux-ce-soir .fiche-lieu').forEach((l) => { l.classList.toggle('hors-ville', !!b.dataset.ville && l.dataset.ville !== b.dataset.ville); });
    document.querySelectorAll('#lieux-ce-soir[data-max]').forEach(replier);
  }));

  // Tarifs : « Choisir cette formule » pré-remplit le message du formulaire de contact.
  document.querySelectorAll('[data-formule]').forEach((b) => b.addEventListener('click', () => {
    const m = document.querySelector('.form-contact textarea[name="message"]');
    if (m && !m.value.includes(b.dataset.formule)) m.value = `Formule choisie : ${b.dataset.formule}\n${m.value}`.trim() + '\n';
  }));
  // Formulaire des pages pros : prépare le message puis ouvre Instagram (message copié) ou l'e-mail (pré-rempli).
  document.querySelectorAll('.form-contact').forEach((f) => {
    const retour = f.querySelector('.retour-form');
    const dire = (m, ok) => { retour.textContent = m; retour.hidden = false; retour.classList.toggle('ok', ok); };
    f.addEventListener('submit', (e) => { e.preventDefault(); f.querySelector('[data-envoi]')?.click(); });
    f.querySelectorAll('[data-envoi]').forEach((b) => b.addEventListener('click', (e) => {
      const v = (k) => (f.elements[k]?.value || '').trim();
      if (!v('nom') || !v('message')) { e.preventDefault(); dire(f.dataset.manque, false); (v('nom') ? f.elements.message : f.elements.nom).focus(); return; }
      const texte = [`Bonjour Teufy ! ${f.dataset.objet}`, `${v('nom')}${v('insta') ? ` (${v('insta')})` : ''}${v('ville') ? ` · ${v('ville')}` : ''}`, '', v('message')].join('\n');
      if (b.dataset.envoi === 'mail') {
        b.href = `${b.href.split('?')[0]}?subject=${encodeURIComponent(`Teufy · ${f.dataset.objet}`)}&body=${encodeURIComponent(texte)}`;
        dire(f.dataset.okMail, true);
      } else {
        try { navigator.clipboard?.writeText(texte).catch(() => {}); } catch { /* presse-papiers refusé */ }
        dire(f.dataset.okIg, true);
      }
    }));
  });

  // Ambiance de saison (heure de Paris) : neige à Noël et en hiver, chauves-souris à Halloween, paillettes au Nouvel an,
  // cœurs à la Saint-Valentin, lumière chaude l'été. Décor seulement : jamais cliquable, coupé si mouvements réduits.
  // Aperçu possible avec ?saison=noel (halloween, nouvel-an, saint-valentin, fete-musique, hiver, ete).
  {
    const mmjj = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', month: '2-digit', day: '2-digit' }).format(maintenant).replace('/', '-');
    const dans = (a, b) => (a <= b ? mmjj >= a && mmjj <= b : mmjj >= a || mmjj <= b);
    const PERIODES = [['nouvel-an', '12-27', '01-02'], ['noel', '12-01', '12-26'], ['halloween', '10-20', '11-01'], ['saint-valentin', '02-07', '02-15'], ['fete-musique', '06-14', '06-22'], ['hiver', '12-21', '03-10'], ['ete', '06-15', '08-31']];
    const voulu = new URLSearchParams(location.search).get('saison');
    const saison = PERIODES.some(([k]) => k === voulu) ? voulu : (PERIODES.find(([, a, b]) => dans(a, b)) || [])[0];
    if (saison) {
      document.documentElement.dataset.saison = saison;
      const MOTIFS = { halloween: '🦇', 'saint-valentin': '❤', 'nouvel-an': '✦', 'fete-musique': '♪' };
      if (MOTIFS[saison] && !reduit) {
        const d = document.createElement('div'); d.className = 'decor-saison'; d.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < 9; i++) { const e = document.createElement('i'); e.textContent = MOTIFS[saison]; e.style.cssText = `--x:${(i * 37 + 7) % 100}vw;--d:${9 + (i * 5) % 9}s;--r:${(i * 3) % 8}s;--t:${0.7 + (i % 4) * 0.25}`; d.append(e); }
        document.body.append(d);
      }
    }
  }
  const cartes = [...document.querySelectorAll('.liste .carte')];
  // Soirées terminées : elles disparaissent d'elles-mêmes (la page n'est régénérée qu'une fois par jour).
  const finies = new Set(cartes.filter((c) => c.dataset.jour < auj || maintenant > debut(c) + DUREE));
  document.querySelectorAll('.la-plus .carte').forEach((c) => { if (c.dataset.jour < auj) c.closest('.la-plus').hidden = true; });

  // --- Ce soir / En ce moment -------------------------------------------------------------------------------
  const ceSoir = document.getElementById('ce-soir');
  const soir = cartes.filter((c) => !finies.has(c) && c.dataset.jour === auj).sort((a, b) => enCours(b) - enCours(a) || debut(a) - debut(b));
  if (ceSoir && !soir.length) ceSoir.hidden = true; // plus aucune soirée ce soir à l'heure du visiteur
  if (ceSoir && soir.length) {
    // Deux groupes distincts : « En ce moment » (déjà commencées) et « Plus tard ce soir » (pas encore commencées).
    const live = soir.filter(enCours), tard = soir.filter((c) => !enCours(c));
    const duree = (ms) => { const m = Math.max(1, Math.round(ms / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`; };
    for (const [nom, liste] of [['live', live], ['tard', tard]]) {
      const g = ceSoir.querySelector(`.groupe-soir[data-groupe="${nom}"]`);
      if (!g) continue;
      // Version pré-remplie à la génération : remplacée par le calcul à l'heure du visiteur.
      g.querySelector('.rangee').replaceChildren(); g.querySelector('.voir-tout-soir')?.remove();
      if (!liste.length) { g.hidden = true; continue; }
      g.querySelector('h3 span').textContent = `${nom === 'live' ? T.live : (T.plusTard || T.ceSoir)} · ${nb(liste.length)}`;
      const rangee = g.querySelector('.rangee');
      for (const c of liste) {
        const k = c.cloneNode(true);
        k.hidden = false;
        const s = document.createElement('span');
        s.className = 'statut' + (nom === 'live' ? ' en-cours' : '');
        const avant = debut(c) - maintenant;
        if (nom === 'live') { const p = document.createElement('i'); p.className = 'point'; s.append(p, T.live); }
        else s.textContent = avant < 3 * 3600e3 && T.dansH ? T.dansH.replace('{d}', duree(avant)) : (T.bientot || '{h}').replace('{h}', c.dataset.heure);
        k.querySelector('.affiche')?.append(s);
        rangee.append(k);
      }
      g.hidden = false;
      // Ordinateur : grille de 8 cartes (2 rangées) puis « Voir les N autres » (style.css) ; mobile : carrousel.
      if (liste.length > 8) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'bouton contour voir-tout-soir';
        const fr = document.documentElement.lang === 'fr';
        b.textContent = fr ? `Voir les ${liste.length - 8} autres soirées` : `+ ${liste.length - 8}`;
        b.addEventListener('click', () => { rangee.classList.add('tout'); b.remove(); });
        g.append(b);
      }
    }
    // Étiquette du bloc : « En direct » seulement s'il y a vraiment des soirées en cours.
    const et = ceSoir.querySelector('.tete .etiquette');
    if (et && !live.length) { et.textContent = T.ceSoir; et.classList.add('sans-direct'); }
    else if (et && live.length && et.classList.contains('sans-direct')) { const i = document.createElement('i'); i.className = 'point'; et.replaceChildren(i, et.dataset.direct || T.live); et.classList.remove('sans-direct'); }
    ceSoir.hidden = false;
    document.querySelectorAll('.pastille-live').forEach((p) => {
      p.querySelector('span').textContent = live.length ? `${T.live} · ${nb(live.length)}` : `${T.ceSoir} · ${nb(soir.length)}`;
      p.hidden = false;
    });
  }

  // --- Filtres : « quand » et « prix » à choix unique ; villes, styles et accès à choix multiples --------------
  const MULTI = new Set(['ville', 'style', 'acces']);
  const etat = { quand: 'tout', prix: 'tout', tri: 'date', date: '', ville: new Set(), style: new Set(), acces: new Set(), q: '', qBrut: '' };
  let favoris = new Set();
  try { favoris = new Set(JSON.parse(localStorage.getItem('teufy-favoris') || '[]')); } catch { /* stockage indisponible */ }
  // Favoris : nom et lien gardés à l'enregistrement (pour les montrer depuis n'importe quelle page) ; les soirées
  // passées (date à la fin de l'identifiant, ou carte terminée sur cette page) sont retirées automatiquement.
  let favInfo = {};
  try { favInfo = JSON.parse(localStorage.getItem('teufy-favoris-info') || '{}') || {}; } catch { /* privé */ }
  const sauverFav = () => { try { localStorage.setItem('teufy-favoris', JSON.stringify([...favoris])); localStorage.setItem('teufy-favoris-info', JSON.stringify(Object.fromEntries([...favoris].filter((id) => favInfo[id]).map((id) => [id, favInfo[id]])))); } catch { /* privé */ } };
  { const avant = favoris.size; for (const id of [...favoris]) { const j = (id.match(/(\d{4}-\d{2}-\d{2})(?:-\d+)?$/) || [])[1]; if (j && j < auj) favoris.delete(id); } finies.forEach((c) => favoris.delete(c.dataset.id)); if (favoris.size !== avant) sauverFav(); }
  let position = null; // position du visiteur (« Près de moi »), jamais envoyée nulle part
  const RAYON = 10; // km
  const distanceKm = (c) => {
    if (!position || !c.dataset.lat) return null;
    const la = +c.dataset.lat, lo = +c.dataset.lng;
    const r = Math.PI / 180, x = (lo - position.lng) * r * Math.cos(((la + position.lat) / 2) * r), y = (la - position.lat) * r;
    return Math.sqrt(x * x + y * y) * 6371;
  };
  // Liste de soirées partagée par un ami (?liste=id1,id2…) : sans compte, rien n'est envoyé à Teufy.
  const listePartagee = new Set((new URLSearchParams(location.search).get('liste') || '').split(',').filter((x) => /^[a-z0-9-]{3,120}$/.test(x)).slice(0, 60));
  if (listePartagee.size && document.querySelector('.liste')) {
    etat.quand = 'liste';
    const n = cartes.filter((c) => listePartagee.has(c.dataset.id)).length;
    const bandeau = document.createElement('div'); bandeau.className = 'liste-partagee';
    const titre = document.createElement('p'); titre.textContent = (T.listePartagee || '{n}').replace('{n}', nb(n));
    const ajouter = document.createElement('button'); ajouter.type = 'button'; ajouter.className = 'bouton petit'; ajouter.textContent = T.toutAjouter;
    ajouter.addEventListener('click', () => { listePartagee.forEach((id) => favoris.add(id)); try { localStorage.setItem('teufy-favoris', JSON.stringify([...favoris])); } catch { /* privé */ } majCoeurs?.(); toast(T.ajoute); });
    const tout = document.createElement('a'); tout.className = 'bouton contour petit'; tout.href = location.pathname; tout.textContent = T.voirAgenda;
    bandeau.append(titre, ajouter, tout);
    document.querySelector('.liste').before(bandeau);
  }
  const dansQuand = (c) => {
    const j = c.dataset.jour;
    return (etat.quand === 'date' && j === etat.date) || etat.quand === 'tout' || (etat.quand === 'soir' && j === auj) || (etat.quand === 'favoris' && favoris.has(c.dataset.id)) || (etat.quand === 'liste' && listePartagee.has(c.dataset.id))
      || (etat.quand === 'semaine' && j >= auj && j <= jPlus(6))
      || (etat.quand === 'weekend' && j >= (dow >= 5 || dow === 0 ? auj : vendredi) && j <= dimanche);
  };
  const accesOk = (c) => {
    for (const a of etat.acces) {
      if (a === 'pres') { const d = distanceKm(c); if (d == null || d > RAYON) return false; } else if (!(c.dataset.acces || '').split(' ').includes(a)) return false;
    }
    return true;
  };
  let visibles = 0;
  // Affichage progressif : les premières soirées, puis « Voir plus » (pages courtes sur mobile, chargement léger).
  // Les filtres et la recherche portent toujours sur TOUTES les soirées ; seul l'affichage est étalé.
  const PAS = matchMedia('(min-width: 980px)').matches ? 36 : 20;
  let limite = PAS;
  const paginer = () => {
    const liste = document.querySelector('.liste'); if (!liste) return;
    const vis = [...liste.querySelectorAll('.carte')].filter((c) => !c.hidden);
    vis.forEach((c, i) => c.classList.toggle('plus-loin', i >= limite));
    cartes.filter((c) => c.hidden).forEach((c) => c.classList.remove('plus-loin'));
    liste.querySelectorAll('.jour').forEach((j) => { j.hidden = !j.querySelector('.carte:not([hidden]):not(.plus-loin)'); });
    let b = document.querySelector('.voir-plus');
    const reste = vis.length - limite;
    if (reste > 0) {
      if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'bouton contour voir-plus'; b.addEventListener('click', () => { limite += PAS; paginer(); animerCartes(); }); liste.after(b); }
      b.textContent = (T.voirPlus || 'Voir plus de soirées ({n})').replace('{n}', reste); b.hidden = false;
    } else if (b) b.hidden = true;
  };
  const appliquer = () => {
    limite = PAS;
    visibles = 0;
    for (const c of cartes) {
      const p = c.dataset.prix === '' ? null : +c.dataset.prix;
      const ok = !finies.has(c) && dansQuand(c)
        && (!etat.q || etat.q.split(/\s+/).every((m) => (c.dataset.q || '').includes(m)))
        && (!etat.ville.size || etat.ville.has(c.dataset.ville))
        && (!etat.style.size || c.dataset.styles.split(' ').some((s) => etat.style.has(s)))
        && (etat.prix === 'tout' || (etat.prix === 'gratuit' ? p === 0 : p != null && p < 10))
        && accesOk(c);
      c.hidden = !ok;
      if (ok) visibles++;
      const d = distanceKm(c), span = c.querySelector('.distance');
      if (span) span.textContent = d == null ? '' : `${d < 1 ? Math.round(d * 1000) + ' m' : d.toFixed(1).replace('.', ',') + ' km'}`;
    }
    document.querySelectorAll('.liste .jour').forEach((j) => { j.hidden = !j.querySelector('.carte:not([hidden])'); });
    // Vue « Favoris » : un bouton pour envoyer sa liste à ses potes (un simple lien).
    let pl = document.querySelector('.partager-liste');
    let ailleurs = document.querySelector('.fav-ailleurs');
    const horsPage = etat.quand === 'favoris' ? [...favoris].filter((id) => !cartes.some((c) => c.dataset.id === id)) : [];
    if (horsPage.length && document.querySelector('.liste')) {
      if (!ailleurs) { ailleurs = document.createElement('div'); ailleurs.className = 'fav-ailleurs'; document.querySelector('.liste').before(ailleurs); }
      const nomDe = (id) => favInfo[id]?.nom || id.replace(/-\d{4}-\d{2}-\d{2}(-\d+)?$/, '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
      const lienDe = (id) => favInfo[id]?.url || `${T.base}${T.langue && T.langue !== 'fr' ? T.langue + '/' : ''}soiree/${id}/`;
      ailleurs.replaceChildren(Object.assign(document.createElement('p'), { textContent: T.favAilleurs || 'Tes autres favoris :' }), ...horsPage.map((id) => { const a = document.createElement('a'); a.href = lienDe(id); a.textContent = `♥ ${nomDe(id)}`; return a; }));
      ailleurs.hidden = false;
    } else if (ailleurs) ailleurs.hidden = true;
    if (etat.quand === 'favoris' && (visibles || horsPage.length) && document.querySelector('.liste')) {
      if (!pl) { pl = document.createElement('button'); pl.type = 'button'; pl.className = 'bouton petit partager-liste'; pl.textContent = `↗ ${T.partagerListe}`;
        pl.addEventListener('click', async () => { const url = `${location.origin}${location.pathname}?liste=${[...favoris].slice(0, 60).join(',')}`;
          if (navigator.share) { try { await navigator.share({ title: 'Teufy', url }); return; } catch { return; } }
          try { await navigator.clipboard.writeText(url); toast(T.lienCopie); } catch { toast(url); } });
        document.querySelector('.liste').before(pl); }
      pl.hidden = false;
    } else if (pl) pl.hidden = true;
    const aucune = document.getElementById('aucune');
    if (aucune) { aucune.hidden = visibles > 0 || !cartes.length; aucune.textContent = etat.q && !visibles ? (T.aucunRes || '').replace('{q}', etat.qBrut) : aucune.dataset.texte || aucune.textContent; }
    document.querySelectorAll('.nb-res').forEach((p) => { p.textContent = etat.q ? (T.resultats || '').replace('{n}', visibles).replace('{q}', etat.qBrut) : cartes.length ? nb(visibles) : ''; });
    document.querySelectorAll('.ouvrir-filtres .compte, .voir-n').forEach((b) => { b.textContent = cartes.length ? (b.classList.contains('voir-n') ? (T.voirN || '{n}').replace('{n}', visibles) : visibles) : ''; });
    majBoutons();
    trier();
    paginer();
    animerCartes();
  };
  // Tri : par date (groupé par jour, comme la page), ou en une seule liste par prix ou par soirées les plus attendues.
  const places = new Map();
  let grilleTri = null;
  function trier() {
    const liste = document.querySelector('.liste'); if (!liste) return;
    if (etat.tri === 'date') {
      if (!grilleTri) return;
      for (const [c, marque] of places) marque.replaceWith(c);
      places.clear(); grilleTri.remove(); grilleTri = null;
      liste.querySelectorAll('.jour').forEach((j) => { j.hidden = !j.querySelector('.carte:not([hidden])'); });
      return;
    }
    if (!grilleTri) {
      grilleTri = Object.assign(document.createElement('div'), { className: 'grille grille-triee' });
      liste.prepend(grilleTri);
      for (const c of cartes) { const m = document.createComment('carte'); c.replaceWith(m); places.set(c, m); }
    }
    const prix = (c) => (c.dataset.prix === '' ? Infinity : +c.dataset.prix), buzz = (c) => +(c.dataset.buzz || 0);
    const ordre = [...cartes].sort(etat.tri === 'prix' ? (a, b) => prix(a) - prix(b) || debut(a) - debut(b) : (a, b) => buzz(b) - buzz(a) || debut(a) - debut(b));
    grilleTri.append(...ordre);
    liste.querySelectorAll('.jour').forEach((j) => { j.hidden = true; });
  }
  document.addEventListener('change', (e) => {
    const i = e.target.closest('.choix-date input'); if (!i) return;
    etat.date = i.value; etat.quand = i.value ? 'date' : 'tout';
    document.querySelectorAll('.choix-date input').forEach((x) => { x.value = i.value; });
    if (!feuille) i.closest('details')?.removeAttribute('open');
    appliquer();
  });
  const majBoutons = () => document.querySelectorAll('.filtres .groupe').forEach((g) => {
    const f = g.dataset.filtre;
    g.querySelectorAll('button').forEach((b) => {
      const actif = MULTI.has(f) ? (b.dataset.v === 'tout' ? !etat[f].size : etat[f].has(b.dataset.v)) : etat[f] === b.dataset.v;
      b.classList.toggle('actif', actif);
      b.setAttribute('aria-pressed', actif);
    });
    // Résumé du choix dans le titre du menu (« Nice, Cannes », « Techno +2 »…).
    const choix = g.closest('details')?.querySelector('.choix');
    if (choix) {
      const actifs = [...g.querySelectorAll('button.actif')].map((b) => b.textContent.trim());
      choix.textContent = g.dataset.filtre === 'quand' && etat.quand === 'date' ? new Intl.DateTimeFormat(T.locale, { day: 'numeric', month: 'short' }).format(new Date(etat.date + 'T12:00:00Z')) : actifs.length > 2 ? `${actifs[0]} +${actifs.length - 1}` : actifs.join(', ');
      g.closest('details').classList.toggle('filtre-actif', g.dataset.filtre === 'tri' ? etat.tri !== 'date' : g.dataset.filtre === 'quand' ? etat.quand !== 'tout' : !g.querySelector('button[data-v="tout"].actif'));
    }
  });
  const demanderPosition = () => new Promise((ok) => {
    if (!navigator.geolocation) { toast(T.geoImpossible); ok(false); return; }
    if (T.geoAttente) toast(T.geoAttente); // tout de suite : la demande d'autorisation peut rester sans réponse
    navigator.geolocation.getCurrentPosition((p) => { position = { lat: p.coords.latitude, lng: p.coords.longitude }; ok(true); }, () => { toast(T.geoRefus); ok(false); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  });
  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('.filtres .groupe button'); if (!b) return;
    const f = b.closest('.groupe').dataset.filtre, v = b.dataset.v;
    if (MULTI.has(f)) {
      if (v === 'tout') etat[f].clear();
      else if (etat[f].has(v)) etat[f].delete(v);
      else {
        if (v === 'pres' && !position && !(await demanderPosition())) return;
        etat[f].add(v);
      }
    } else { etat[f] = v; if (!feuille) b.closest('details')?.removeAttribute('open'); }
    appliquer();
  });
  // Menus déroulants des filtres : un seul ouvert à la fois, fermés par un clic ailleurs ou Échap.
  document.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!d.matches?.('details.filtre') || !d.open || feuille) return;
    document.querySelectorAll('details.filtre[open]').forEach((x) => { if (x !== d) x.removeAttribute('open'); });
  }, true);
  document.addEventListener('click', (e) => { if (feuille || e.target.closest('details.filtre')) return; document.querySelectorAll('details.filtre[open]').forEach((x) => x.removeAttribute('open')); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !feuille) document.querySelectorAll('details.filtre[open]').forEach((x) => x.removeAttribute('open')); });

  // --- Recherche -------------------------------------------------------------------------------------------
  const champs = [...document.querySelectorAll('.recherche input')];
  const aucuneP = document.getElementById('aucune'); if (aucuneP) aucuneP.dataset.texte = aucuneP.textContent;
  let minuteur = 0;
  const chercher = (v, source) => {
    etat.qBrut = v.trim(); etat.q = norm(v);
    champs.forEach((c) => { if (c !== source) c.value = v; const x = c.parentElement.querySelector('.effacer'); if (x) x.hidden = !v; });
    clearTimeout(minuteur);
    minuteur = setTimeout(() => {
      if (cartes.length) appliquer();
      const u = new URL(location.href); if (etat.q) u.searchParams.set('q', etat.qBrut); else u.searchParams.delete('q');
      history.replaceState(null, '', u);
    }, 120);
  };
  const agenda = document.getElementById('agenda');
  champs.forEach((c) => {
    c.addEventListener('input', () => chercher(c.value, c));
    c.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault(); c.blur();
      if (feuilleOuverte()) fermer(); else if (vue === 'liste') document.querySelector('.liste')?.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth' });
    });
    c.parentElement.querySelector('.effacer')?.addEventListener('click', () => { c.value = ''; chercher('', null); c.focus(); });
  });
  document.querySelector('.hero-recherche')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!agenda) return;
    chercher(e.target.querySelector('input')?.value || '', null);
    agenda.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth' });
  });

  // --- Favoris (gardés dans ce navigateur uniquement) ------------------------------------------------------
  const majCoeurs = () => document.querySelectorAll('[data-id] .coeur').forEach((b) => b.setAttribute('aria-pressed', favoris.has(b.closest('[data-id]').dataset.id)));
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('.coeur'); if (!b) return;
    ev.preventDefault();
    const id = b.closest('[data-id]')?.dataset.id; if (!id) return;
    if (favoris.has(id)) favoris.delete(id); else {
      favoris.add(id); toast(T.ajoute);
      const k = b.closest('[data-id]'), a = k.querySelector('h3 a, h1');
      favInfo[id] = { nom: (k.querySelector('h3, h1')?.textContent || '').trim().slice(0, 90), url: a?.href || location.href, jour: k.dataset.jour || '' };
    }
    sauverFav();
    majCoeurs(); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    // Dans la vue « Favoris », une soirée retirée reste visible (estompée) jusqu'au prochain changement de filtre :
    // pas de saut de mise en page sous le doigt, et on peut la remettre d'un tap.
    if (etat.quand === 'favoris') b.closest('.carte')?.classList.toggle('retiree', !favoris.has(id));
  });
  majCoeurs();

  // --- Partage, copie de code promo, retour en haut ---------------------------------------------------------
  document.addEventListener('click', async (ev) => {
    const p = ev.target.closest('.partager');
    if (p) {
      const d = { title: document.title, url: location.href.split('#')[0] };
      if (navigator.share) { try { await navigator.share(d); } catch { /* partage annulé */ } return; }
      // Sans partage natif : copie du lien, et si le presse-papiers est refusé, le lien s'affiche pour être copié à la main.
      try { await navigator.clipboard.writeText(d.url); toast(T.lienCopie); } catch { toast(d.url); }
      return;
    }
    const code = ev.target.closest('[data-copier]');
    if (code) { try { await navigator.clipboard.writeText(code.dataset.copier); toast(T.codeCopie); } catch { toast(code.dataset.copier); } }
  });
  const haut = document.querySelector('.haut');
  haut?.addEventListener('click', () => scrollTo({ top: 0, behavior: reduit ? 'auto' : 'smooth' }));

  // --- Filtres en feuille (mobile) ----------------------------------------------------------------------------
  // Le bloc de filtres est déplacé dans une feuille plein écran (au-dessus de tout), la page derrière est bloquée.
  // On ferme : bouton « Voir les N soirées », croix, tap sur le fond, glisser vers le bas, touche Échap.
  const place = document.querySelector('.filtres-place'), filtres = document.querySelector('.filtres');
  const flottant = document.querySelector('.flottant');
  const mobile = matchMedia('(max-width: 759px)');
  let feuille = null, scrollAvant = 0, etatAvant = '';
  const signature = () => JSON.stringify([etat.quand, etat.date, etat.tri, etat.prix, [...etat.ville], [...etat.style], [...etat.acces], etat.q]);
  const feuilleOuverte = () => !!feuille;
  const ouvrir = () => {
    if (feuille || !filtres) return;
    scrollAvant = scrollY;
    etatAvant = signature();
    place.style.minHeight = place.offsetHeight + 'px';
    feuille = document.createElement('div');
    feuille.className = 'feuille-filtres';
    feuille.setAttribute('role', 'dialog');
    feuille.setAttribute('aria-modal', 'true');
    feuille.innerHTML = `<div class="feuille-fond"></div><div class="feuille-boite"><div class="feuille-poignee"><span></span><button type="button" class="feuille-x" aria-label="${T.fermerX || '×'}">×</button></div><div class="feuille-corps"></div><div class="feuille-pied"><button type="button" class="bouton voir-n"></button></div></div>`;
    feuille.querySelector('.feuille-corps').append(filtres);
    filtres.querySelectorAll('details.filtre').forEach((d) => { d.open = true; });
    document.body.append(feuille);
    document.documentElement.classList.add('bloque');
    document.body.style.top = `-${scrollAvant}px`;
    flottant.hidden = true;
    feuille.querySelector('.feuille-fond').addEventListener('click', fermer);
    feuille.querySelector('.feuille-x').addEventListener('click', fermer);
    feuille.querySelector('.voir-n').addEventListener('click', fermer);
    // Glisser vers le bas depuis la poignée (ou depuis le haut du contenu) pour fermer.
    const boite = feuille.querySelector('.feuille-boite'), corps = feuille.querySelector('.feuille-corps');
    let y0 = null, dy = 0;
    boite.addEventListener('touchstart', (e) => { if (e.target.closest('.feuille-poignee') || corps.scrollTop <= 0) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
    boite.addEventListener('touchmove', (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); if (dy > 0) boite.style.transform = `translateY(${dy}px)`; }, { passive: true });
    boite.addEventListener('touchend', () => { if (y0 == null) return; y0 = null; boite.style.transform = ''; if (dy > 90) fermer(); });
    appliquer();
    setTimeout(() => feuille?.querySelector('.voir-n')?.focus({ preventScroll: true }), 50);
  };
  function fermer() {
    if (!feuille) return;
    place.append(filtres);
    filtres.querySelectorAll('details.filtre').forEach((d) => d.removeAttribute('open'));
    place.style.minHeight = '';
    feuille.remove(); feuille = null;
    document.documentElement.classList.remove('bloque');
    document.body.style.top = '';
    scrollTo({ top: scrollAvant, behavior: 'instant' });
    // Filtres changés : on montre le début des résultats ; sinon on reste exactement où on était.
    const cible = document.querySelector('.liste');
    if (signature() !== etatAvant && cible && cible.getBoundingClientRect().top < 0) cible.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'start' });
    majFlottant();
  }
  const majFlottant = () => {
    if (!flottant || !place || feuille) return;
    const r = place.getBoundingClientRect(), a = agenda.getBoundingClientRect();
    flottant.hidden = !(mobile.matches && r.bottom < 0 && a.bottom > innerHeight * 0.6);
  };
  addEventListener('keydown', (e) => { if (e.key === 'Escape') fermer(); });
  if (place && flottant) {
    flottant.querySelector('button').addEventListener('click', ouvrir);
    mobile.addEventListener?.('change', () => { if (!mobile.matches) fermer(); majFlottant(); });
  }
  // Boutons flottants (Filtres, retour en haut) : cachés quand on descend (ils ne masquent jamais une carte),
  // de retour dès qu'on remonte un peu — comme la barre de Safari.
  let attente = false, dernierY = scrollY, versLeBas = false;
  addEventListener('scroll', () => {
    if (attente || feuille) return;
    attente = true;
    requestAnimationFrame(() => {
      attente = false;
      const y = scrollY, d = y - dernierY;
      if (Math.abs(d) > 6) { versLeBas = d > 0; dernierY = y; }
      majFlottant(); if (haut) haut.hidden = y < Math.max(900, innerHeight * 1.5);
      document.documentElement.classList.toggle('defile-bas', versLeBas && y > 300);
      // Barre d'onglets : cachée en descendant (lecture), revient en remontant ou en bas de page.
      const enBas = innerHeight + y >= document.documentElement.scrollHeight - 40;
      document.documentElement.classList.toggle('onglets-caches', versLeBas && y > 300 && !enBas && !document.documentElement.classList.contains('menu-ouvert'));
    });
  }, { passive: true });

  // --- Une seule vue : la liste (la carte générale a été retirée ; chaque soirée a sa mini-carte) ----------------
  const vue = 'liste';
  const choisirVue = () => {};

  let promesse = null;
  // Carte : MapLibre (version compatible CSP, hébergée sur le site) + fonds vectoriels OpenFreeMap (gratuits, sans clé),
  // recolorés aux couleurs de Teufy (site/vendor/maplibre/teufy-style.json). Chargée seulement quand une carte s'affiche.
  const VENDOR = T.base + 'site/vendor/maplibre/';
  const chargerCarte = () => promesse ||= new Promise((ok, ko) => {
    const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: VENDOR + 'maplibre-gl.css' });
    const js = Object.assign(document.createElement('script'), { src: VENDOR + 'maplibre-gl-csp.js' });
    js.onload = () => { try { window.maplibregl.setWorkerUrl(new URL(VENDOR + 'maplibre-gl-csp-worker.js', location.href).href); ok(window.maplibregl); } catch (e) { ko(e); } };
    js.onerror = () => { promesse = null; ko(); };
    document.head.append(css, js);
  });
  const nouvelleCarte = (ml, conteneur, opts) => {
    const m = new ml.Map({ container: conteneur, style: new URL(VENDOR + 'teufy-style.json', location.href).href, attributionControl: false, cooperativeGestures: false, dragRotate: false, pitchWithRotate: false, scrollZoom: false, ...opts });
    m.touchZoomRotate.disableRotation();
    m.addControl(new ml.NavigationControl({ showCompass: false }), 'top-left');
    m.addControl(new ml.AttributionControl({ compact: true }), 'bottom-right'); // mentions OpenFreeMap / OpenStreetMap fournies par le style
    m.on('click', () => m.scrollZoom.enable());
    // Petites cartes (mobile, mini-carte) : crédits repliés derrière le bouton « i ».
    m.once('load', () => { if (conteneur.clientWidth < 720) conteneur.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'); });
    return m;
  };
  // Le conteneur est positionné par MapLibre (transform) ; la goutte tournée est à l'intérieur.
  const repere = (html, cls = '') => { const e = document.createElement('div'); e.className = 'repere-ancre'; const r = document.createElement('div'); r.className = `repere ${cls}`.replace(/\s+/g, ' ').trim(); r.innerHTML = html; e.append(r); return e; };
  const nommer = (marqueur, nom) => { const e = marqueur.getElement(); e.setAttribute('aria-label', nom); e.setAttribute('role', 'button'); e.tabIndex = 0; return marqueur; };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

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
    if (!obsCartes) { cartes.forEach((c) => c.classList.add('entre')); return; }
    requestAnimationFrame(() => { premier = false; });
    document.querySelectorAll('.liste .grille').forEach((g) => {
      [...g.querySelectorAll('.carte:not([hidden])')].forEach((c, i) => {
        c.style.setProperty('--i', i % 3);
        if (!premier) c.classList.remove('entre');
        obsCartes.observe(c);
      });
    });
  }
  // Vidéos : lecture seulement si le visiteur accepte les animations ; relancées si le navigateur les a mises en pause.
  document.querySelectorAll('video').forEach((v) => {
    if (reduit) { v.removeAttribute('autoplay'); v.pause(); return; }
    v.muted = true;
    const jouer = () => v.play().catch(() => {});
    v.addEventListener('ended', () => { v.currentTime = 0; jouer(); });
    v.addEventListener('pause', () => { if (!document.hidden && !reduit) setTimeout(jouer, 300); });
    jouer();
  });

  // Diaporama de l'accueil : les photos suivantes se chargent une fois la page affichée (la première arrive plus vite).
  addEventListener('load', () => setTimeout(() => document.querySelectorAll('.diaporama img[data-src]').forEach((i) => { if (i.dataset.srcset) i.srcset = i.dataset.srcset; i.src = i.dataset.src; }), 1500));

  // --- Comptes à rebours (soirées très attendues, page de chaque soirée) : mis à jour chaque seconde -------------
  const rebours = [...document.querySelectorAll('.rebours[data-debut]')];
  const deux = (n) => String(n).padStart(2, '0');
  const majRebours = () => {
    const t0 = Date.now(), [uj, uh, um, us] = T.u || ['j', 'h', 'min', 's'];
    for (const e of rebours) {
      const r = Date.parse(e.dataset.debut) - t0;
      const bloc = e.closest('.rebours-bloc, .demande');
      if (r <= 0) { e.textContent = t0 - Date.parse(e.dataset.debut) < 6 * 3600e3 ? (T.cestParti || '') : ''; if (bloc && !e.textContent) bloc.hidden = true; continue; }
      if (!e.dataset.long && r > 7 * 864e5) { if (bloc?.classList.contains('demande')) e.textContent = ''; continue; }
      const j = Math.floor(r / 864e5), h = Math.floor(r / 3600e3) % 24, m = Math.floor(r / 60e3) % 60, sec = Math.floor(r / 1000) % 60;
      e.textContent = e.dataset.long
        ? `${j ? `${j} ${uj} ` : ''}${deux(h)} ${uh} ${deux(m)} ${um} ${deux(sec)} ${us}`
        : `${T.dans || ''} ${j ? `${j} ${uj} ` : ''}${deux(h)} ${uh} ${deux(m)} ${um}`;
    }
  };
  if (rebours.length) { majRebours(); setInterval(majRebours, 1000); }

  // --- Mini-carte du lieu (page d'une soirée) : chargée seulement quand elle arrive à l'écran ---------------------
  const mini = document.querySelector('.mini-carte');
  if (mini) {
    // Sans WebGL (vieux appareil, mode économie, navigateur restreint) : pas de carte, mais l'adresse et l'itinéraire.
    const webgl = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };
    const repli = () => {
      mini.classList.add('sans-carte'); mini.removeAttribute('role');
      const a = el('a', 'bouton contour', `📍 ${mini.dataset.nom}`); a.href = `https://www.google.com/maps/search/?api=1&query=${mini.dataset.lat},${mini.dataset.lng}`; a.target = '_blank'; a.rel = 'noopener';
      mini.replaceChildren(a);
    };
    const ouvrir = async () => {
      if (!webgl()) return repli();
      let ml; try { ml = await chargerCarte(); } catch { return repli(); }
      const ll = [+mini.dataset.lng, +mini.dataset.lat];
      let m; try { m = nouvelleCarte(ml, mini, { center: ll, zoom: 15 }); } catch { return repli(); }
      m.on('error', (e) => { if (/webgl/i.test(String(e?.error?.message || e?.error?.statusMessage || ''))) repli(); });
      nommer(new ml.Marker({ element: repere('<b>♪</b>', 'seul'), anchor: 'bottom' }).setLngLat(ll).addTo(m), mini.dataset.nom);
    };
    if ('IntersectionObserver' in window) { const o = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { o.disconnect(); ouvrir(); } }, { rootMargin: '300px' }); o.observe(mini); } else ouvrir();
  }

  // --- Page d'une soirée sur téléphone : barre « Billets » en bas dès que les boutons principaux sont hors écran ---
  const barre = document.querySelector('.barre-billets'), actions = document.querySelector('.fiche-actions');
  if (barre && actions && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { barre.hidden = e.isIntersecting; }).observe(actions); // visible dès l'arrivée tant que les boutons ne sont pas à l'écran
  }

  // --- Démarrage -----------------------------------------------------------------------------------------------
  const q0 = new URLSearchParams(location.search).get('q');
  if (q0 && champs.length) { champs.forEach((c) => { c.value = q0; const x = c.parentElement.querySelector('.effacer'); if (x) x.hidden = false; }); etat.qBrut = q0; etat.q = norm(q0); if (agenda) setTimeout(() => agenda.scrollIntoView(), 60); }
  if (cartes.length || document.querySelector('.filtres')) appliquer(); else animerCartes();
  majFlottant();
  const allerRecherche = (doux) => { const c = document.getElementById('recherche'); if (!c || !agenda) return false; agenda.scrollIntoView({ behavior: doux && !reduit ? 'smooth' : 'auto' }); setTimeout(() => c.focus({ preventScroll: true }), doux ? 350 : 80); return true; };
  if (location.hash === '#recherche') allerRecherche(false);
  document.querySelector('a.loupe[href="#recherche"]')?.addEventListener('click', (e) => { if (allerRecherche(true)) e.preventDefault(); });
  addEventListener('hashchange', () => { if (location.hash === '#recherche') allerRecherche(true); });
  // --- Navigation mobile : menu plein écran + barre d'onglets (Agenda, Ce soir, Chercher, Favoris, Menu) ---------
  const menu = document.getElementById('menu');
  let avantMenu = null;
  const fermerMenu = () => { if (!menu || menu.hidden) return; menu.hidden = true; document.documentElement.classList.remove('menu-ouvert'); if (location.hash === '#menu') history.replaceState(null, '', location.pathname + location.search); avantMenu?.focus({ preventScroll: true }); };
  const ouvrirMenu = () => { if (!menu) return; avantMenu = document.activeElement; menu.hidden = false; document.documentElement.classList.add('menu-ouvert'); menu.querySelector('.menu-corps').scrollTop = 0; menu.querySelector('.menu-x').focus({ preventScroll: true }); };
  document.querySelectorAll('[data-menu]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); if (menu.hidden) ouvrirMenu(); else fermerMenu(); }));
  menu?.querySelector('.menu-x').addEventListener('click', (e) => { e.preventDefault(); fermerMenu(); });
  menu?.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a && a.hash && a.pathname === location.pathname && !a.hasAttribute('data-chercher')) fermerMenu(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') fermerMenu(); });
  if (location.hash === '#menu') ouvrirMenu();
  // « Chercher » : sur une page d'agenda, ouvre directement la recherche et les filtres (feuille sur mobile).
  const ouvrirRecherche = (doux) => {
    if (!filtres) return false;
    fermerMenu();
    if (mobile.matches) { ouvrir(); setTimeout(() => feuille?.querySelector('input[type="search"]')?.focus({ preventScroll: true }), 80); return true; }
    return allerRecherche(doux);
  };
  document.querySelectorAll('[data-chercher]').forEach((a) => a.addEventListener('click', (e) => { if (ouvrirRecherche(true)) e.preventDefault(); }));
  if (location.hash === '#recherche' && mobile.matches) ouvrirRecherche(false);
  // « Favoris » : affiche les soirées enregistrées (filtre « ♥ Favoris » de l'agenda), avec leur nombre sur l'onglet.
  const montrerFavoris = () => {
    const b = document.querySelector('.filtres .groupe[data-filtre="quand"] button[data-v="favoris"]');
    if (!b || !agenda) return false;
    fermerMenu(); b.click(); agenda.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth' });
    if (!favoris.size && T.aucunFav) toast(T.aucunFav);
    return true;
  };
  document.querySelectorAll('[data-favoris]').forEach((a) => a.addEventListener('click', (e) => { if (montrerFavoris()) e.preventDefault(); }));
  if (location.hash === '#favoris') setTimeout(montrerFavoris, 120);
  const majNbFav = () => document.querySelectorAll('.nb-fav').forEach((b) => { b.textContent = favoris.size; b.hidden = !favoris.size; });
  majNbFav(); document.addEventListener('click', (e) => { if (e.target.closest('.coeur')) setTimeout(majNbFav, 0); });

  // Carrousels (Ce soir, photos) : flèches sur ordinateur à la place de la barre de défilement du navigateur ;
  // elles disparaissent au début et à la fin ; un fondu signale qu'il reste des cartes à droite.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const en = document.documentElement.lang !== 'fr';
    document.querySelectorAll('.rangee, .photos').forEach((r) => {
      if (r.parentElement.querySelector(':scope > .fleche')) return;
      r.parentElement.classList.add('a-fleches');
      const f = (sens) => { const b = document.createElement('button'); b.type = 'button'; b.className = `fleche ${sens < 0 ? 'prec' : 'suiv'}`;
        b.setAttribute('aria-label', sens < 0 ? (en ? 'Previous' : 'Précédent') : (en ? 'Next' : 'Suivant'));
        b.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="${sens < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        b.addEventListener('click', () => r.scrollBy({ left: sens * Math.max(240, r.clientWidth * 0.85) * (document.dir === 'rtl' ? -1 : 1), behavior: reduit ? 'auto' : 'smooth' }));
        r.after(b); return b; };
      const p = f(-1), n = f(1);
      const maj = () => { const x = Math.abs(r.scrollLeft), max = r.scrollWidth - r.clientWidth - 2; p.hidden = x <= 2; n.hidden = x >= max; }; // rien ne change sur la rangée elle-même pendant le défilement (Safari iPhone la ramenait au début)
      r.addEventListener('scroll', maj, { passive: true }); addEventListener('resize', maj); new ResizeObserver(maj).observe(r); maj();
    });
  }
  // Anciens liens « …/#carte » (partagés avant le retrait de la carte générale) : on arrive sur l'agenda.
  if (location.hash === '#carte') { history.replaceState(null, '', location.pathname + location.search + '#agenda'); setTimeout(() => agenda?.scrollIntoView(), 50); }
})();

// --- Vitesse : cache du navigateur (sw.js) et préchargement des pages au survol / au toucher d'un lien -----------
(() => {
  const icone = document.querySelector('link[rel=icon]');
  const racine = icone ? icone.href.replace(/site\/img\/[^/]+$/, '') : null;
  if (racine && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) addEventListener('load', () => navigator.serviceWorker.register(racine + 'sw.js', { scope: racine }).catch(() => {}));
  const vus = new Set();
  const precharger = (e) => {
    const a = e.target.closest?.('a[href]');
    if (!a || a.target === '_blank' || a.origin !== location.origin || a.hash && a.pathname === location.pathname || vus.has(a.href) || /\.(ics|mp4|jpg|png|webp)$/.test(a.pathname)) return;
    if (navigator.connection?.saveData) return;
    vus.add(a.href);
    const l = document.createElement('link'); l.rel = 'prefetch'; l.href = a.href; document.head.appendChild(l);
  };
  addEventListener('pointerover', precharger, { passive: true });
  addEventListener('touchstart', precharger, { passive: true });
  // Glisser n'est pas cliquer : dans les rangées qui défilent sur le côté, un clic qui suit un déplacement du doigt
  // (ou de la souris) de plus de 10 px est ignoré (sinon un simple glissement ouvrait une soirée sur iPhone).
  { let x0 = 0, y0 = 0, bouge = false;
    const DEFILANTS = '.rangee, .cartes-texte, .nav, .liens-styles, .posts, .vitrine-grille';
    addEventListener('pointerdown', (e) => { if (!e.target.closest(DEFILANTS)) return; x0 = e.clientX; y0 = e.clientY; bouge = false; }, { passive: true, capture: true });
    addEventListener('pointermove', (e) => { if (!bouge && e.target.closest(DEFILANTS) && (Math.abs(e.clientX - x0) > 10 || Math.abs(e.clientY - y0) > 10)) bouge = true; }, { passive: true, capture: true });
    addEventListener('pointercancel', (e) => { if (e.target.closest?.(DEFILANTS)) bouge = true; }, { passive: true, capture: true }); // le navigateur a pris le défilement
    addEventListener('scroll', (e) => { if (e.target instanceof Element && e.target.matches(DEFILANTS)) bouge = true; }, { passive: true, capture: true });
    addEventListener('click', (e) => { const glisse = bouge; bouge = false; if (glisse && e.target.closest(DEFILANTS)) { e.preventDefault(); e.stopPropagation(); } }, { capture: true });
  }
  // Changement de page fluide : l'affiche d'une soirée « glisse » de la carte vers sa fiche (et retour),
  // une fine barre indique le chargement si la page met du temps ; l'en-tête reste en place (style.css).
  const lienInterne = (e, a) => a && !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && a.target !== '_blank' && !a.hasAttribute('download') && a.origin === location.origin && !(a.hash && a.pathname === location.pathname) && !/\.(ics|mp4|jpg|png|webp)$/.test(a.pathname);
  addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]'); if (!lienInterne(e, a)) return;
    document.documentElement.classList.add('en-route'); clearTimeout(lienInterne.t); lienInterne.t = setTimeout(() => document.documentElement.classList.remove('en-route'), 10000);
    const img = /\/soiree\/[^/]+\/$/.test(a.pathname) && a.closest('.carte')?.querySelector('.affiche img.principale');
    if (img) { document.querySelectorAll('.fiche-affiche > img').forEach((x) => { x.style.viewTransitionName = 'none'; }); img.style.viewTransitionName = 'affiche-soiree'; }
  });
  addEventListener('pageshow', () => document.documentElement.classList.remove('en-route'));
  addEventListener('pagereveal', (e) => {
    const de = window.navigation?.activation?.from?.url || ''; const id = (de.match(/\/soiree\/([^/]+)\/$/) || [])[1];
    if (!e.viewTransition || !id || document.querySelector('.fiche-affiche')) return;
    const img = [...document.querySelectorAll(`.carte[data-id="${CSS.escape(id)}"] .affiche img.principale`)].find((x) => x.getBoundingClientRect().height);
    if (img) { img.style.viewTransitionName = 'affiche-soiree'; e.viewTransition.finished.finally(() => { img.style.viewTransitionName = ''; }); }
  });
  addEventListener('focusin', precharger);
})();
