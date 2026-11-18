// Photos de couverture sans répétition (18/11/2026, directeur : « fais gaffe à ne pas utiliser tout le temps les mêmes
// images dans le flux en couverture »). Banque de la DA : studio/public/decors/da/*.jpg. Une couverture ne reprend jamais
// une photo déjà visible dans les FENETRE dernières cases de la grille (3 rangées) ; si toutes y sont, la moins récente.
export const BANQUE = ['danse', 'foule', 'dj', 'rire', 'terrasse', 'plage', 'lasers', 'selfie', 'rooftop', 'taxi', 'baskets', 'file'];
export const FENETRE = 9;
// Photos des dernières couvertures de la grille, la plus récente d'abord (historique.json : champ `photo`).
export function photosRecentes(historique, n = FENETRE) {
  return historique.filter((h) => h.photo && !h.hors_grille).slice(-n).reverse().map((h) => h.photo);
}
// `preferees` : photos qui collent au sujet, dans l'ordre ; le reste de la banque sert de réserve.
export function choisirPhoto(preferees, recentes, banque = BANQUE) {
  const ordre = [...new Set([...preferees, ...banque])];
  const libre = ordre.find((x) => !recentes.includes(x));
  if (libre) return libre;
  return [...ordre].sort((a, b) => recentes.indexOf(b) - recentes.indexOf(a))[0];
}
