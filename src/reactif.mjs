// Planning réactif (14/11/2026, directeur : « tu peux changer les jours sans moi, sois vraiment réactif : si un reel
// fait un engouement de fou, sors la suite rapidement ; tout faire pour viser la viralité »).
//
// Sans IA, à partir des statistiques Instagram :
//  1. Engouement : une publication du robot des dernières 48 h qui fait au moins 2 fois mieux que d'habitude (vues ou
//     portée, partages) → une « suite » est programmée dès le lendemain (épisode suivant d'une série, même format de
//     reel, même type de post). Au plus 1 suite par jour et 3 par semaine, pour ne pas lasser.
//  2. Jours : chaque semaine, si un jour de la semaine marche nettement mieux qu'un autre (moyenne des notes sur
//     6 semaines, au moins 3 mesures de chaque côté), une publication déplaçable passe sur le meilleur jour libre.
// Tout est écrit dans contenus/planning-auto.json (journal lisible par le directeur) et repris dans RAPPORT.md.
import { readFileSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PLAN_FILE = path.join(ROOT, 'contenus', 'planning-auto.json');
export const SERIES = ['grand-debat', 'serie-nuit'];
const JOURS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
// Ce qui peut changer de jour tout seul. Restent fixes : les soirées du week-end (vendredi), l'Édition Tekno
// (1er jeudi du mois) et les séries (rythme promis aux abonnés).
export const DEPLACABLES = { post: ['bonplan', 'guide', 'libre'], reel: ['viral', 'teufy'] };
// Ce qui peut avoir une suite (une 2e liste de soirées du week-end n'aurait pas de sens).
const SUITE_POSTS = ['guide', 'bonplan', 'libre'];

export function lirePlan(f = PLAN_FILE) {
  try { return { extras: [], jours: { post: {}, reel: {} }, journal: [], ...JSON.parse(readFileSync(f, 'utf8')) }; }
  catch { return { extras: [], jours: { post: {}, reel: {} }, journal: [] }; }
}
export const ecrirePlan = (plan, f = PLAN_FILE) => writeFile(f, JSON.stringify(plan, null, 2) + '\n');

const dateParis = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
const jourParis = (d) => ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 })[new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short' }).format(d)];
const mediane = (a) => { const s = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const estReel = (p) => p.type === 'reel';
const audience = (p) => (estReel(p) ? p.metrics?.views ?? p.metrics?.reach : p.metrics?.reach) ?? null;

// --- 1. Engouement ------------------------------------------------------------

// `recents` : publications du robot de moins de 48 h avec des chiffres frais ; `reference` : les publications du
// robot déjà mesurées (apprentissage.json). Rend celles qui décollent, avec la raison.
export function engouements(recents, reference, { facteur = 2, minPartages = 5 } = {}) {
  const res = [];
  for (const p of recents) {
    const ref = reference.filter((x) => x.source === 'bot' && x.media !== p.media && estReel(x) === estReel(p) && x.metrics).slice(-10);
    if (ref.length < 3 || !p.metrics) continue;
    const aud = audience(p), mAud = mediane(ref.map(audience));
    const part = (p.metrics.shares ?? 0) + (p.metrics.saved ?? 0), mPart = mediane(ref.map((x) => (x.metrics.shares ?? 0) + (x.metrics.saved ?? 0))) ?? 0;
    const raisons = [];
    if (aud != null && mAud && aud >= facteur * mAud) raisons.push(`${estReel(p) ? 'vues' : 'portée'} ${aud} contre ${mAud} d'habitude (×${(aud / mAud).toFixed(1)})`);
    if (part >= Math.max(minPartages, facteur * 1.5 * mPart)) raisons.push(`${part} partages + enregistrements contre ${mPart} d'habitude`);
    if (raisons.length) res.push({ p, raison: raisons.join(' ; ') });
  }
  return res;
}

// Suite programmée pour une publication qui décolle. `episodeDispo(serie)` dit si un épisode attend d'être publié.
export function planifierSuite(plan, { p, raison }, now, { episodeDispo = () => true } = {}) {
  if (plan.extras.some((x) => x.suite_de === p.media) || plan.journal.some((j) => j.media === p.media && j.quoi === 'suite')) return null;
  const variante = p.variante || null;
  let slot;
  if (p.type === 'reel') slot = { type: 'reel', variante: SERIES.includes(variante) ? variante : variante || 'flash' };
  else if (SUITE_POSTS.includes(p.type)) slot = { type: p.type, variante };
  else return null;
  const demain = dateParis(new Date(now.getTime() + 86400e3));
  const semaine = dateParis(new Date(now.getTime() - 6 * 86400e3));
  const prises = new Set(plan.extras.map((x) => x.date));
  if (plan.extras.filter((x) => x.date >= semaine).length >= 3) return journaliser(plan, now, { quoi: 'suite-refusee', media: p.media, texte: `Engouement sur « ${p.titre || p.id} » (${raison}), mais déjà 3 suites cette semaine.` });
  let date = demain;
  if (prises.has(date)) date = dateParis(new Date(now.getTime() + 2 * 86400e3));
  if (prises.has(date)) return null;
  if (SERIES.includes(slot.variante) && !episodeDispo(slot.variante)) {
    return journaliser(plan, now, { quoi: 'a-produire', media: p.media, urgent: true, texte: `Engouement sur « ${p.titre || p.id} » (${raison}) : produire l'épisode suivant en urgence et le déposer dans media/${slot.variante}/, il partira dès le lendemain.` });
  }
  const extra = { date, ...slot, suite_de: p.media, raison, cree_le: now.toISOString() };
  plan.extras.push(extra);
  journaliser(plan, now, { quoi: 'suite', media: p.media, texte: `Engouement sur « ${p.titre || p.id} » (${raison}) → suite programmée le ${date} (${[slot.type, slot.variante].filter(Boolean).join(' ')}).` });
  return extra;
}

function journaliser(plan, now, e) {
  plan.journal.push({ le: now.toISOString(), ...e });
  plan.journal = plan.journal.slice(-60);
  return e;
}

// Publications supplémentaires prévues ce jour-là (les anciennes sont oubliées après 7 jours).
export function extrasDu(plan, date) { return plan.extras.filter((x) => x.date === date); }
export function nettoyer(plan, now) { const limite = dateParis(new Date(now.getTime() - 7 * 86400e3)); plan.extras = plan.extras.filter((x) => x.date >= limite); }

// --- 2. Jours qui marchent le mieux -----------------------------------------

// Jour du calendrier (1 = lundi) dont les publications sont servies le jour `jour`, pour une catégorie (post / reel).
// null = ce jour a été vidé (sa publication est partie ailleurs).
export function jourSource(plan, categorie, jour) {
  const m = plan.jours?.[categorie] || {};
  const venu = Object.entries(m).find(([, b]) => +b === jour);
  if (venu) return +venu[0];
  if (m[jour] != null) return null;
  return jour;
}

export function replanifier(plan, data, config, now, { semaines = 6, min = 3, ecart = 1.5 } = {}) {
  if (plan.dernier_replanning && (now - new Date(plan.dernier_replanning)) / 86400e3 < 6.5) return [];
  plan.dernier_replanning = now.toISOString();
  const depuis = now.getTime() - semaines * 7 * 86400e3;
  const mesures = data.posts.filter((p) => p.source === 'bot' && p.note != null && Date.parse(p.publie_le) >= depuis);
  const parJour = {};
  for (const p of mesures) (parJour[jourParis(new Date(p.publie_le))] ||= []).push(p.note);
  const moy = (j) => (parJour[j]?.length >= min ? parJour[j].reduce((a, b) => a + b, 0) / parJour[j].length : null);
  const changes = [];
  for (const cat of ['post', 'reel']) {
    plan.jours ||= {}; plan.jours[cat] ||= {};
    const cal = cat === 'post' ? config.calendrier : config.calendrier_reels || [];
    const occupe = (j) => { const s = jourSource(plan, cat, j); return s != null && cal.some((c) => c.jour === s); };
    const candidats = [];
    for (let a = 1; a <= 7; a++) {
      const src = jourSource(plan, cat, a);
      if (src == null) continue;
      const items = cal.filter((c) => c.jour === src);
      if (!items.length || !items.every((c) => DEPLACABLES[cat].includes(cat === 'post' ? c.type : c.variante))) continue;
      const ma = moy(a); if (ma == null) continue;
      for (let b = 1; b <= 7; b++) {
        const mb = moy(b);
        if (b === a || occupe(b) || mb == null || mb < ecart * Math.max(ma, 1)) continue;
        candidats.push({ a, b, src, ma, mb });
      }
    }
    const best = candidats.sort((x, y) => y.mb / Math.max(y.ma, 1) - x.mb / Math.max(x.ma, 1))[0];
    if (!best) continue;
    // Le jour d'origine du calendrier part sur b (on remplace un éventuel déplacement précédent).
    plan.jours[cat][best.src] = best.b;
    if (best.src === best.b) delete plan.jours[cat][best.src];
    const c = { categorie: cat, de: best.a, vers: best.b, texte: `${cat === 'post' ? 'Post' : 'Reel'} du ${JOURS[best.a]} déplacé au ${JOURS[best.b]} : note moyenne ${Math.round(best.mb)} le ${JOURS[best.b]} contre ${Math.round(best.ma)} le ${JOURS[best.a]} (${semaines} dernières semaines).` };
    changes.push(c);
    journaliser(plan, now, { quoi: 'jour', ...c });
  }
  return changes;
}

// Section ajoutée à RAPPORT.md : ce que le robot a changé tout seul.
export function sectionRapport(plan) {
  const lignes = plan.journal.slice(-15).reverse().map((j) => `- ${j.le.slice(0, 10)}${j.urgent ? ' **(urgent)**' : ''} : ${j.texte}`);
  const dep = Object.entries(plan.jours || {}).flatMap(([cat, m]) => Object.entries(m).map(([a, b]) => `${cat === 'post' ? 'post' : 'reel'} du ${JOURS[a]} → ${JOURS[b]}`));
  return `\n\n## Planning réactif (changements faits par le robot)\n\n${dep.length ? `Jours déplacés : ${dep.join(', ')}.\n\n` : ''}${lignes.length ? lignes.join('\n') : 'Rien pour l\'instant.'}\n`;
}

export const _test = { dateParis, jourParis };
export const planExiste = () => existsSync(PLAN_FILE);
