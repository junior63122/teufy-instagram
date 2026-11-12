// Reels « Guide » (12/11/2026, idée du directeur : « où manger à Cannes après la boîte », « où sont les meilleurs
// afters ») : uniquement de VRAIES adresses avec leurs horaires publiés (OpenStreetMap, fiches des clubs, soirées
// annoncées). Rien n'est inventé : sans au moins 3 adresses vérifiées pour une ville, pas de reel Guide.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireHoraires } from './horaires.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f, d) => { try { return JSON.parse(readFileSync(path.join(ROOT, f), 'utf8')); } catch { return d; } };
const sa = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const VILLES = ['Nice', 'Cannes', 'Monaco', 'Antibes', 'Toulon', 'Juan-les-Pins', 'Saint-Tropez', 'Fréjus', 'Menton', 'Hyères'];

/** Adresses par thème et par ville, à partir des données du site. */
export function adressesGuide({ now = new Date(), tard = lire('contenus/nuit-tardive.json', { lieux: [] }).lieux || [], lieux = lire('contenus/lieux-nuit.json', { lieux: [] }).lieux || [], soirees = lire('evenements-web.json', {}).evenements || [] } = {}) {
  const out = { manger: {}, after: {} };
  const ajoute = (theme, ville, x) => { if (!ville) return; const v = VILLES.find((n) => sa(n) === sa(ville)) || ville; const l = (out[theme][v] ||= []); if (!l.some((y) => sa(y.nom) === sa(x.nom))) l.push(x); };
  for (const l of tard) ajoute(l.type === 'after' ? 'after' : 'manger', l.ville, { nom: l.nom, quoi: l.categorie || '', horaires: l.horaires, source: l.source });
  for (const l of lieux) {
    const H = lireHoraires(l.details?.horaires);
    if ((H?.plages || []).some((p) => p.a >= '06:00' && p.a < '12:00')) ajoute('after', l.ville, { nom: l.nom, quoi: l.type === 'club' ? 'Club' : 'Bar', horaires: l.details.horaires, source: l.site || '' });
  }
  const t = now.getTime();
  for (const e of soirees) {
    const d = Date.parse(e.start);
    if (!(d > t && d < t + 10 * 864e5)) continue;
    const h = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(new Date(d));
    if ((h >= 4 && h < 11) || /\bafter\b|afterparty/i.test(e.name || '')) {
      const jour = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d));
      ajoute('after', e.city, { nom: `${e.name}${e.venue ? ` (${e.venue})` : ''}`, quoi: 'Soirée after', horaires: `${jour}, dès ${h} h`, source: e.url || '' });
    }
  }
  return out;
}

/** Le guide à écrire : thème et ville les moins faits récemment, avec au moins 3 adresses. */
export function choisirGuide({ deja = [], ...opts } = {}) {
  const A = adressesGuide(opts);
  const options = [];
  for (const theme of ['manger', 'after']) for (const [ville, l] of Object.entries(A[theme])) if (l.length >= 3) options.push({ theme, ville, lieux: l.slice(0, 6), fait: deja.filter((x) => x === `${theme}|${ville}`).length });
  if (!options.length) return null;
  const poids = (o) => o.fait * 100 - o.lieux.length - (['Nice', 'Cannes', 'Monaco'].includes(o.ville) ? 3 : 0);
  return options.sort((a, b) => poids(a) - poids(b))[0];
}
