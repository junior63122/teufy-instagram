// Thèmes et titres des carrousels de soirées (analyse des publications du 24/11/2026, ANALYSE-ENGAGEMENT.md).
// Titres du carrousel « commercial » (analyse du 24/11/2026) : une promesse concrète au lieu de « nos coups de cœur ».
// La fenêtre est la semaine en cours : jamais « week-end » dans le titre (règle de cohérence titre / contenu).
export const TITRES_COMMERCIAL = ['Ta semaine de soirées est réglée', 'Où sortir cette semaine sur la Côte', 'Les soirées de la semaine, de Nice à Monaco'];
// Nuit du Nouvel An (31 décembre 17 h → 1er janvier 6 h, Paris) tant qu'on est entre le 1er et le 30 décembre et qu'aucun
// carrousel « Nouvel An » n'est parti ces 6 derniers jours ; sinon null.
export function fenetreNouvelAn(now, historique = []) {
  const [j, m, a] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' }).format(now).split('/').map(Number);
  if (m !== 12 || j > 30) return null;
  if (historique.some((h) => h.publication?.theme === 'nouvel-an' && now - Date.parse(h.le || h.date) < 6 * 864e5)) return null;
  return { from: new Date(`${a}-12-31T17:00:00+01:00`), to: new Date(`${a + 1}-01-01T06:00:00+01:00`) };
}
