// Filtres de l'agenda Teufy (quand, ville, style, prix). Les soirées sont déjà dans la page : on ne fait que masquer.
(() => {
  const etat = { quand: 'tout', ville: 'tout', style: 'tout', prix: 'tout' };
  const auj = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.now() - 6 * 3600e3));
  const jPlus = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.parse(auj + 'T12:00:00Z') + n * 864e5));
  const dow = new Date(auj + 'T12:00:00Z').getUTCDay(); // 0 = dimanche
  const vendredi = jPlus((5 - dow + 7) % 7 || (dow === 5 ? 0 : 7)), dimanche = jPlus((7 - dow) % 7);
  const dansQuand = (j) => etat.quand === 'tout' || (etat.quand === 'soir' && j === auj)
    || (etat.quand === 'semaine' && j >= auj && j <= jPlus(6))
    || (etat.quand === 'weekend' && j >= (dow >= 5 || dow === 0 ? auj : vendredi) && j <= dimanche);
  const appliquer = () => {
    let n = 0;
    document.querySelectorAll('.agenda .carte').forEach((c) => {
      const p = c.dataset.prix === '' ? null : +c.dataset.prix;
      const ok = dansQuand(c.dataset.jour) && (etat.ville === 'tout' || c.dataset.ville === etat.ville)
        && (etat.style === 'tout' || c.dataset.styles.split(' ').includes(etat.style))
        && (etat.prix === 'tout' || (etat.prix === 'gratuit' ? p === 0 : p != null && p < 10));
      c.hidden = !ok; if (ok) n++;
    });
    document.querySelectorAll('.agenda .jour').forEach((j) => { j.hidden = !j.querySelector('.carte:not([hidden])'); });
    document.getElementById('aucune').hidden = n > 0;
  };
  document.querySelectorAll('.filtres .groupe').forEach((g) => g.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    g.querySelectorAll('button').forEach((x) => x.classList.toggle('actif', x === b));
    etat[g.dataset.filtre] = b.dataset.v; appliquer();
  }));
  // Les soirées passées de la journée disparaissent d'elles-mêmes (la page est régénérée chaque jour).
  document.querySelectorAll('.carte').forEach((c) => { if (c.dataset.jour < auj) c.hidden = true; });
  appliquer();
})();
