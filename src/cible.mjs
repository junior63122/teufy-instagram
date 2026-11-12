// La cible de Teufy (contenus/cible.json) mise en texte pour les robots qui écrivent du contenu (reels, débats, veille).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const F = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'contenus', 'cible.json');
export const lireCible = () => { try { return JSON.parse(readFileSync(F, 'utf8')); } catch { return null; } };

/** Bloc à insérer dans les consignes d'une IA qui écrit pour Teufy. */
export function texteCible(c = lireCible()) {
  if (!c) return '';
  return `LA CIBLE : les fêtards de la Côte d'Azur et du Var (17-30 ans).
${(c.profils || []).map((p) => `- ${p.nom} (${p.qui}) : ${p.vit}.`).join('\n')}
Situations qu'ils vivent vraiment (pars de là) :
${(c.situations || []).map((s) => `- ${s}`).join('\n')}
Ce qu'ils s'envoient entre potes : ${(c.ce_qui_se_partage || []).join(' ; ')}.
Ton : ${c.langage || ''}
À éviter : ${(c.a_eviter || []).join(' ; ')}.
${c.test_du_partage || ''}`;
}
