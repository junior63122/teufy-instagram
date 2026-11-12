// Période réellement couverte par une sélection de soirées, pour des titres qui disent vrai (demande du directeur
// 12/11/2026 : ne jamais écrire « cette semaine » sur des dates du mois, et nommer le mois).
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const paris = (d) => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(d); const g = (t) => p.find((x) => x.type === t).value; return { y: +g('year'), m: +g('month'), d: +g('day'), wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(g('weekday')) }; };
export function periodeDe(dates, now = new Date()) {
  // Soirée après minuit = nuit de la veille.
  const js = dates.map((x) => new Date(Date.parse(x) - 5 * 3600e3)).sort((a, b) => a - b);
  if (!js.length) return { cle: 'jours', label: 'ces prochains jours', mois: MOIS[paris(now).m - 1] };
  const n = paris(now);
  const finSemaine = Date.UTC(n.y, n.m - 1, n.d + (6 - n.wd), 23, 59);
  const debut = paris(js[0]), fin = paris(js.at(-1));
  const memeMois = debut.m === fin.m && debut.y === fin.y;
  if (Date.UTC(fin.y, fin.m - 1, fin.d) <= finSemaine) {
    const weekend = js.every((d) => [4, 5, 6].includes(paris(d).wd)); // ven, sam, dim
    return { cle: weekend ? 'weekend' : 'semaine', label: weekend ? 'ce week-end' : 'cette semaine', mois: MOIS[debut.m - 1] };
  }
  const jours = (js.at(-1) - js[0]) / 864e5;
  if (memeMois && jours > 10) return { cle: 'mois', label: `en ${MOIS[debut.m - 1]}`, mois: MOIS[debut.m - 1] };
  // Sinon : les dates exactes (« du 13 au 18 novembre »), jamais une période approximative.
  const plage = memeMois ? `du ${debut.d === 1 ? '1er' : debut.d} au ${fin.d} ${MOIS[fin.m - 1]}` : `du ${debut.d === 1 ? '1er' : debut.d} ${MOIS[debut.m - 1]} au ${fin.d} ${MOIS[fin.m - 1]}`;
  return { cle: 'jours', label: plage, mois: MOIS[debut.m - 1] };
}
