// Dates en heure de Paris (fuseau de la Côte d'Azur), sans dépendance externe.
const TZ = 'Europe/Paris';

function parts(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return p;
}

// Instant UTC correspondant à une date/heure locale de Paris.
export function parisToUtc(y, m, d, h = 0, min = 0) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const p = parts(new Date(guess));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(guess - (asUtc - guess));
}

// Lundi 00:00 (Paris) de la semaine contenant `now`.
export function mondayOf(now = new Date()) {
  const p = parts(now);
  const dow = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
  const local = new Date(Date.UTC(+p.year, +p.month - 1, +p.day - (dow - 1)));
  return parisToUtc(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate());
}

// Fenêtre couvrant les jours ISO donnés (1 = lundi … 7 ou 0 = dimanche).
// La nuit déborde jusqu'à 6 h le lendemain du dernier jour.
export function windowFor(jours, now = new Date()) {
  const iso = jours.map((j) => (j === 0 ? 7 : j));
  const lo = Math.min(...iso), hi = Math.max(...iso);
  const mon = mondayOf(now);
  const p = parts(mon);
  const base = (offset, h) => {
    const local = new Date(Date.UTC(+p.year, +p.month - 1, +p.day + offset));
    return parisToUtc(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate(), h);
  };
  return { from: base(lo - 1, 6), to: base(hi, 6) };
}

const fmt = (opts) => new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, ...opts });
// Une soirée qui commence avant 6 h appartient à la nuit de la veille (00h30 dim. → « Sam »).
const nuit = (d) => new Date(new Date(d).getTime() - 6 * 3600e3);
export const jourCourt = (d) => cap(fmt({ weekday: 'short' }).format(nuit(d)).replace('.', ''));
export const jourLong = (d) => cap(fmt({ weekday: 'long' }).format(nuit(d)));
export const jourNum = (d) => fmt({ day: 'numeric' }).format(nuit(d));
export const moisCourt = (d) => fmt({ month: 'short' }).format(nuit(d)).replace('.', '');
export const heure = (d) => fmt({ hour: '2-digit', minute: '2-digit' }).format(new Date(d)).replace(':', 'h');
export const dateLongue = (d) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d));
export const isoLocal = (d) => { const p = parts(new Date(d)); return `${p.year}-${p.month}-${p.day}`; };

export function plage(from, to) {
  const last = new Date(to.getTime() - 7 * 3600e3); // la veille au soir
  const a = fmt({ day: 'numeric' }).format(from);
  const b = fmt({ day: 'numeric', month: 'long' }).format(last);
  return fmt({ month: 'short' }).format(from) === fmt({ month: 'short' }).format(last) ? `du ${a} au ${b}` : `du ${a} ${fmt({ month: 'long' }).format(from)} au ${b}`;
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Jour ISO (1 = lundi … 7 = dimanche) et rang de ce jour dans le mois (1er, 2e… lundi du mois).
export function slotOfDay(now = new Date()) {
  const p = parts(now);
  const dow = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
  return { jour: dow, rang: Math.ceil(+p.day / 7), date: `${p.year}-${p.month}-${p.day}` };
}

// Toutes les dates du mois de `now` (midi heure de Paris).
export function daysOfMonth(now = new Date()) {
  const p = parts(now);
  const out = [];
  for (let d = 1; d <= 31; d++) {
    const t = parisToUtc(+p.year, +p.month, d, 12);
    if (parts(t).month !== p.month) break;
    out.push(t);
  }
  return out;
}

// Fenêtre glissante : de `now` + a jours à `now` + b jours.
export function rolling(now, a, b) {
  return { from: new Date(now.getTime() + a * 86400e3), to: new Date(now.getTime() + b * 86400e3) };
}
