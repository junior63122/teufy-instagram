// Stories quotidiennes (12/11/2026, directeur : « montrer une vraie présence et inciter la communauté à nous parler ») :
// soirées de ce soir, offres des partenaires, questions et débats, repost de nos reels qui ont marché et qui sont encore
// utiles, coup de cœur d'un organisateur. Construites SANS IA, mêmes contrôles que les posts (affiches vérifiées, textes).
// L'API d'Instagram ne permet ni sondage, ni lien, ni mention cliquable en story : les questions se font « en message ».
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f, d) => { try { return JSON.parse(readFileSync(path.join(ROOT, f), 'utf8')); } catch { return d; } };
export const FICHIER_HISTO = 'contenus/stories.json';

const paris = (d, o) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', ...o }).format(d);
export const jourParis = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
const heureParis = (d) => +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(d);
const jourSemaine = (d) => ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 })[new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short' }).format(d)];

/** Programme du jour (heures de Paris) : 3 à 4 stories, en plus de la story qui relaie le post. */
export function planDuJour(now) {
  const j = jourSemaine(now);
  return [
    { h: 16, type: 'soirees' },
    { h: 18, type: [1, 3, 5, 7].includes(j) ? 'offre' : 'repost' },
    { h: 20, type: 'question' },
    ...([4, 5, 6].includes(j) ? [{ h: 22, type: 'coeur' }] : []),
  ];
}

/** Stories dues maintenant : heure passée (moins de 3 h de retard), pas encore faites aujourd'hui. */
export function storiesDues(now, histo = lire(FICHIER_HISTO, [])) {
  const jour = jourParis(now), h = heureParis(now);
  return planDuJour(now).filter((s) => h >= s.h && h < s.h + 3 && !histo.some((x) => x.jour === jour && x.type === s.type));
}

// --- Choix du contenu (sans IA) ------------------------------------------------------------------------
const recentes = (histo, type, jours, now) => histo.filter((x) => x.type === type && Date.parse(x.le) > now - jours * 864e5).flatMap((x) => x.cles || []);

/** Soirées de ce soir (sinon de demain), affiche vérifiée, les plus porteuses d'abord. */
export function soireesDuSoir(evts, now, { potentiel = () => 0.5, afficheOk = (e) => !!e.image } = {}) {
  const auj = jourParis(new Date(now - 5 * 3600e3));
  const soir = (d) => jourParis(new Date(Date.parse(d) - 5 * 3600e3));
  const demain = jourParis(new Date(Date.parse(`${auj}T12:00:00Z`) + 864e5));
  for (const [quand, jour] of [['Ce soir', auj], ['Demain', demain]]) {
    const l = evts.filter((e) => e.start && soir(e.start) === jour && afficheOk(e)).sort((a, b) => potentiel(b) - potentiel(a)).slice(0, 3);
    if (l.length) return { quand, soirees: l };
  }
  return null;
}

/** Offres des partenaires encore valables (avantages + codes promo), une différente à chaque fois. */
export function offreDuJour(config, now, histo = []) {
  const valide = (x) => !x.jusqu_au || Date.parse(`${x.jusqu_au}T23:59:59Z`) > now;
  const l = [
    ...(config.site?.avantages || []).filter(valide).map((a) => ({ cle: `av-${a.partenaire_nom}-${a.titre}`, titre: a.titre, partenaire: a.partenaire_nom, ville: a.ville, conditions: a.conditions, code: '', instagram: a.instagram })),
    ...(config.codes_promo || []).filter(valide).map((c) => ({ cle: `code-${c.code}`, titre: `${c.remise} avec le code ${c.code}`, partenaire: c.partenaire_nom || c.partenaire, ville: '', conditions: c.description, code: c.code, instagram: c.partenaire })),
  ];
  if (!l.length) return null;
  const deja = recentes(histo, 'offre', 6, now);
  return l.find((x) => !deja.includes(x.cle)) || l[Math.floor(now / 864e5) % l.length];
}

/** Question ou débat pas posé depuis 30 jours (story et posts confondus). */
export function questionDuJour(now, histo = [], { questions = lire('contenus/questions-stories.json', []), debats = lire('contenus/debats.json', []), postes = [] } = {}) {
  const deja = new Set([...recentes(histo, 'question', 30, now), ...postes]);
  // Vendredi et samedi : « tu manges où à 4 h ? » (les réponses alimentent la page Manger tard, après vérification).
  const j = jourSemaine(new Date(now));
  if ([5, 6].includes(j)) {
    const recFaim = new Set(recentes(histo, 'question', 12, now));
    const f = questions.filter((x) => x.theme === 'faim' && !recFaim.has(`q-${x.id}`));
    if (f.length) { const x = f[Math.floor(now / 864e5) % f.length]; return { cle: `q-${x.id}`, q: x.q, debat: false, faim: true }; }
  }
  const debat = Math.floor(now / 864e5) % 2 === 0;
  const q = questions.filter((x) => x.theme !== 'faim' && !deja.has(`q-${x.id}`)), d = debats.filter((x) => !deja.has(`d-${x.id}`) && !deja.has(x.id));
  const pick = (l) => l[Math.floor(now / 864e5) % l.length];
  if ((debat && d.length) || !q.length) { if (!d.length) return null; const x = pick(d); return { cle: `d-${x.id}`, q: x.q, a: x.a, b: x.b, debat: true }; }
  const x = pick(q);
  return { cle: `q-${x.id}`, q: x.q, debat: false };
}

/** Reel à reposter : déjà publié depuis 7 jours, toujours utile (pas lié à une date), parmi les plus aimés. */
export function repostDuJour(hist, medias, now, histo = []) {
  const deja = recentes(histo, 'repost', 30, now);
  const datés = /weekend|week-end|techno|petits-prix|ce-soir|halloween|noel|nouvel|saint|fete|tekno|incontournables|bonplan|veille/i;
  const ok = hist.filter((h) => h.media && h.publication?.type === 'reel' && !datés.test(`${h.id} ${h.publication?.variante || ''}`)
    && !/actu/i.test(h.publication?.rubrique || '') && Date.parse(h.le || h.date) < now - 7 * 864e5 && !deja.includes(`r-${h.media}`));
  const parId = new Map(medias.map((m) => [m.id, m]));
  const cand = ok.map((h) => ({ h, m: parId.get(h.media) })).filter((x) => x.m?.media_url && x.m.media_type === 'VIDEO')
    .sort((a, b) => ((b.m.like_count || 0) + 3 * (b.m.comments_count || 0)) - ((a.m.like_count || 0) + 3 * (a.m.comments_count || 0)));
  return cand[0] ? { cle: `r-${cand[0].h.media}`, url: cand[0].m.media_url, titre: cand[0].h.titre || '' } : null;
}

/** Coup de cœur : la soirée la plus porteuse des 7 prochains jours d'un organisateur ou d'un lieu au compte vérifié. */
export function coupDeCoeur(evts, now, histo = [], { potentiel = () => 0.5, afficheOk = (e) => !!e.image, comptes = () => [] } = {}) {
  const deja = recentes(histo, 'coeur', 14, now);
  const l = evts.filter((e) => { const d = Date.parse(e.start); return d > now && d < now + 7 * 864e5 && afficheOk(e) && comptes(e).length && !deja.includes(`c-${e.name}`); })
    .sort((a, b) => potentiel(b) - potentiel(a));
  return l[0] ? { cle: `c-${l[0].name}`, soiree: l[0], compte: comptes(l[0])[0] } : null;
}

export const quandTexte = (d) => paris(new Date(d), { weekday: 'long', day: 'numeric', month: 'long' });
