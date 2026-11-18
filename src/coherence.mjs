// Contrôle de cohérence des posts (18/11/2026, directeur : « vérifie la cohérence des posts avant de poster, pour éviter
// les infos erronées ou qui ne correspondent pas au titre du carrousel »). Chaque format a une promesse (son titre) ;
// une soirée qui ne la tient pas est retirée AVANT la fabrication, et le post entier est bloqué juste avant la publication
// s'il reste la moindre incohérence (mieux vaut un autre post qu'une fausse info).
import { isTechno, isUnderground } from './genres.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const normNom = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
/** Soirées démenties par le lieu, l'organisateur ou le directeur (contenus/soirees-retirees.json). */
export function soireesRetirees() { try { return JSON.parse(readFileSync(path.join(ROOT, 'contenus', 'soirees-retirees.json'), 'utf8')).soirees || []; } catch { return []; } }
export function estRetiree(e, liste = soireesRetirees()) {
  const u = String(e.url || '').replace(/\/(en|fr|es|pt-br|pt-pt)\//, '/').replace(/[?#].*$/, '');
  return liste.some((r) => (r.url && u && String(r.url).replace(/\/(en|fr|es|pt-br|pt-pt)\//, '/').replace(/[?#].*$/, '') === u) || (r.nom && r.date && normNom(r.nom) === normNom(e.name) && String(e.start || '').slice(0, 10) === r.date));
}

const ANNULE = /annul|report[ée]|cancel|postpon/i;
const COMPLET = /sold ?out|complet|guichets? ferm/i;
const texte = (e) => `${e.name || ''} ${e.status || ''} ${e.description || ''}`;
export const cleCoherence = (e) => `${String(e.name || '').toLowerCase().replace(/\s+/g, ' ').trim()}|${String(e.start || '').slice(0, 10)}`;

/**
 * Problèmes d'une soirée pour un format donné (liste vide = cohérente).
 * format : 'commercial' | 'tekno' | 'techno' | 'petits-prix' | 'a-reserver' ; fenetre : { from, to } (dates) ; now : Date.
 */
export function problemesSoiree(e, { format, fenetre, now = new Date(), prixMax = 10 } = {}) {
  const p = [];
  const d = Date.parse(e.start);
  if (!Number.isFinite(d)) p.push('date illisible');
  else {
    if (d < now.getTime() - 6 * 3600e3) p.push('soirée passée');
    if (fenetre?.from && fenetre?.to && (d < new Date(fenetre.from).getTime() - 6 * 3600e3 || d > new Date(fenetre.to).getTime() + 30 * 3600e3)) p.push('hors de la période annoncée');
  }
  if (ANNULE.test(texte(e))) p.push('annulée ou reportée');
  if (estRetiree(e)) p.push('démentie (soirees-retirees.json)');
  if (format === 'tekno' && !isUnderground(e)) p.push('pas techno underground');
  if (format === 'techno' && !isTechno(e)) p.push('pas techno');
  if (format === 'commercial' && isTechno(e)) p.push('techno dans un post commercial');
  if (format === 'petits-prix' && !(e.price != null && Number(e.price) <= prixMax)) p.push(`prix inconnu ou supérieur à ${prixMax} €`);
  if (format === 'a-reserver' && COMPLET.test(texte(e))) p.push('déjà complet');
  return p;
}

/** Garde les soirées cohérentes avec le format (sans doublon). */
export function filtrerCoherentes(list, opts) {
  const vu = new Set();
  return list.filter((e) => { const k = cleCoherence(e); if (vu.has(k)) return false; vu.add(k); return problemesSoiree(e, opts).length === 0; });
}

/** Vérification finale d'un post : rend la liste des incohérences (vide = on peut publier). */
export function controlePost({ soirees = [], legende = '', ...opts }) {
  const out = [];
  const vu = new Set();
  for (const e of soirees) {
    const k = cleCoherence(e);
    if (vu.has(k)) out.push(`${e.name} : en double`);
    vu.add(k);
    for (const x of problemesSoiree(e, opts)) out.push(`${e.name} : ${x}`);
  }
  return out;
}

// --- Planning : post « libre » sans doublon (18/11/2026, directeur : planning « plus cohérent ») ----------------------
// Écarte la famille (guide / bon plan) publiée la veille ou le jour même, ou prévue le jour même ou le lendemain
// (post ou reel guide). `slots(date)` = publications prévues ce jour-là ; `jourDe(date)` = 'AAAA-MM-JJ' à Paris.
const familleSlot = (c) => (!c ? null : c.type === 'guide' || (c.type === 'reel' && ['viral', 'guide'].includes(c.variante)) ? 'guide' : c.type === 'bonplan' ? 'bonplan' : null);
const familleHist = (h) => (/^guide|^reel-viral|^reel-guide/.test(h.id) ? 'guide' : /^bonplan/.test(h.id) ? 'bonplan' : null);
export function choixLibre({ now, historique = [], slots, jourDe }) {
  const j = (k) => new Date(now.getTime() + k * 864e5);
  const proches = new Set([jourDe(j(-1)), jourDe(now)]);
  const prises = new Set([...historique.filter((h) => proches.has(h.date)).map(familleHist), ...[0, 1].flatMap((k) => slots(j(k)).map(familleSlot))]);
  const toutes = ['guide', 'a-reserver', 'petits-prix'];
  const ok = toutes.filter((o) => !prises.has(o === 'guide' ? 'guide' : 'bonplan'));
  return ok.length ? ok : toutes;
}
