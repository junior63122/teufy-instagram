// Contrôle des textes avant toute publication Instagram (12/11/2026, directeur : « vérifie vraiment tes sources pour
// éviter les images floues ou les erreurs de texte »). Mêmes règles que le contrôle du site (outils/controle-donnees.mjs) :
// un texte cassé ne part jamais.
const MAUVAIS = [
  [/\bundefined\b/, '« undefined »'], [/\bNaN\b/, '« NaN »'], [/\bnull\b/, '« null »'], [/\[object Object\]/, '« [object Object] »'],
  [/\b23h59\b/, 'heure fantôme 23h59 (à écrire « minuit »)'], [/\bdès\s+dès\b/i, '« dès dès »'], [/\s,\s*,/, 'virgules doublées'],
  [/\(\s*\)/, 'parenthèses vides'], [/\*\*[^*\n]{2,80}\*\*/, 'markdown non converti'], [/<\/?(b|i|em|strong|br|p|a|span)\b/i, 'balise HTML'],
  [/&(amp|lt|gt|quot|#\d+);/, 'caractère échappé'], [/\b(lorem ipsum|TODO|FIXME)\b/i, 'texte provisoire'], [/\$\{|\}\}|\{\{/, 'variable non remplie'],
  [/\[(?![^\]]*\])|(?<!\[[^[]*)\]/, 'crochet de mise en valeur non fermé'],
  [/(^|\s)#(?=\s|$)/, '« # » sans hashtag'],
];

/** Liste des fautes d'un texte destiné au public (vide = OK). */
export function fautesTexte(texte) {
  const t = String(texte ?? '');
  const f = [];
  if (!t.trim()) return ['texte vide'];
  for (const [re, m] of MAUVAIS) if (re.test(t)) f.push(m);
  // Mot répété (« le le », « de de »), sauf noms propres et répétitions voulues (« Boum Boum »).
  for (const x of t.matchAll(/\b(\p{L}{2,})\s+\1\b/giu)) if (!/^\p{Lu}/u.test(x[1]) && !/^(na|la|ha|lo|so|go|bla|tic|hip|boom|vroum)$/i.test(x[1])) f.push(`mot répété « ${x[0]} »`);
  return [...new Set(f)];
}

/** Contrôle d'une publication préparée : légende, titre et textes des visuels. Lève une erreur au premier problème. */
export function controlerPublication(pub, textesVisuels = []) {
  const fautes = [];
  for (const [nom, t] of [['légende', pub.legende], ...(pub.titre ? [['titre', pub.titre]] : []), ...textesVisuels.map((t, i) => [`visuel ${i + 1}`, t])]) {
    for (const x of fautesTexte(t)) fautes.push(`${nom} : ${x}`); // crochets gardés : un crochet non fermé est une erreur de mise en valeur
  }
  if ((pub.legende || '').length > 2200) fautes.push('légende de plus de 2 200 caractères');
  if (fautes.length) throw new Error(`Texte refusé avant publication : ${fautes.join(' ; ')}`);
  return true;
}
