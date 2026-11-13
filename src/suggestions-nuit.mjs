// Adresses « où manger tard » proposées par la communauté (commentaires Instagram, réponses aux stories, formulaire du
// site), 13/11/2026. Directeur : « utiliser les gens pour alimenter la base, mais vérifier, pas un Wikipédia ».
// Règle : une suggestion n'est JAMAIS publiée telle quelle. Elle attend dans contenus/suggestions-nuit.json jusqu'à ce
// que l'équipe la valide avec des horaires vérifiés (outils/suggestions-nuit.mjs --valider), et elle passe alors dans
// contenus/nuit-tardive-manuels.json avec sa source.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FICHIER = path.join(ROOT, 'contenus', 'suggestions-nuit.json');
const lire = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
export const cle = (nom, ville) => `${nom} ${ville || ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(le|la|les|l|chez|snack|kebab|pizzeria|pizza)\b/g, '').replace(/[^a-z0-9]+/g, '');

/** Ajoute (ou renforce) une suggestion. Plusieurs personnes qui citent le même lieu = plus de poids, jamais une validation. */
export function ajouterSuggestion({ nom, ville = '', horaires = '', origine, auteur = '', texte = '', ref = '', post = '' }, { fichier = FICHIER, now = new Date() } = {}) {
  nom = String(nom || '').trim().slice(0, 80); if (nom.length < 2) return null;
  const d = lire(fichier, { suggestions: [] });
  const k = cle(nom, ville);
  let s = d.suggestions.find((x) => x.cle === k);
  if (!s) { s = { cle: k, nom, ville: String(ville || '').trim(), statut: 'a_verifier', mentions: [] }; d.suggestions.push(s); }
  if (ref && s.mentions.some((m) => m.ref === ref)) return s;
  s.mentions.push({ origine, auteur, texte: String(texte).slice(0, 300), horaires: String(horaires || '').slice(0, 80), ref, post, le: now.toISOString() });
  s.personnes = new Set(s.mentions.map((m) => m.auteur || m.ref)).size;
  writeFileSync(fichier, JSON.stringify(d, null, 1) + '\n');
  return s;
}

/** Suggestions en attente, les plus citées d'abord. */
export const enAttente = (d = lire(FICHIER, { suggestions: [] })) => d.suggestions.filter((s) => s.statut === 'a_verifier').sort((a, b) => (b.personnes || 0) - (a.personnes || 0));
