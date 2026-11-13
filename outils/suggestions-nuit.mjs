// Vérification des adresses de nuit proposées par la communauté.
//   node outils/suggestions-nuit.mjs                      → liste des suggestions à vérifier
//   node outils/suggestions-nuit.mjs --valider <cle> --horaires "lun–dim 18h–4h" --adresse "…" --categorie Kebab --source <url>
//   node outils/suggestions-nuit.mjs --refuser <cle> --raison "fermé"
// Valider exige des horaires au format du site ET une source consultable (fiche, site, photo de la devanture publiée…) :
// le simple fait que quelqu'un l'ait écrit en commentaire ne suffit pas.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FICHIER, enAttente } from '../src/suggestions-nuit.mjs';
import { lireHoraires } from '../src/horaires.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAN = path.join(ROOT, 'contenus', 'nuit-tardive-manuels.json');
const lire = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ''; };
const d = lire(FICHIER, { suggestions: [] });

if (arg('--valider')) {
  const s = d.suggestions.find((x) => x.cle === arg('--valider')); if (!s) { console.error('Suggestion inconnue.'); process.exit(1); }
  const horaires = arg('--horaires'), source = arg('--source');
  if (!lireHoraires(horaires)) { console.error('Horaires illisibles : format « lun–dim 18h–4h ».'); process.exit(1); }
  if (!/^https?:\/\//.test(source)) { console.error('Une source consultable (URL) est obligatoire.'); process.exit(1); }
  const M = lire(MAN, { lieux: [] });
  M.lieux.push({ nom: arg('--nom') || s.nom, categorie: arg('--categorie') || 'Snack', ville: arg('--ville') || s.ville, adresse: arg('--adresse'), horaires, sources: [source], _communaute: `${s.personnes || 1} signalement(s), vérifié le ${new Date().toISOString().slice(0, 10)}` });
  writeFileSync(MAN, JSON.stringify(M, null, 1) + '\n');
  s.statut = 'valide'; s.valide_le = new Date().toISOString();
} else if (arg('--refuser')) {
  const s = d.suggestions.find((x) => x.cle === arg('--refuser')); if (!s) { console.error('Suggestion inconnue.'); process.exit(1); }
  s.statut = 'refuse'; s.raison = arg('--raison'); s.refuse_le = new Date().toISOString();
} else {
  const l = enAttente(d);
  console.log(l.length ? l.map((s) => `${s.cle}\t${s.nom} · ${s.ville || '?'} · ${s.personnes || 1} personne(s)\n   ${s.mentions.map((m) => `[${m.origine}] @${m.auteur || '?'} : ${m.texte}${m.horaires ? ` (horaires dits : ${m.horaires})` : ''}`).join('\n   ')}`).join('\n') : 'Aucune suggestion à vérifier.');
  process.exit(0);
}
writeFileSync(FICHIER, JSON.stringify(d, null, 1) + '\n');
console.log('Enregistré.');
