// Légendes Instagram. Écrites pour sonner comme un vrai community manager :
// phrases courtes, peu d'emojis, pas de tirets cadratins, peu de hashtags.
// Chaque formulation est choisie par le sélecteur d'apprentissage (`ch.pick`) :
// les versions qui font le plus réagir reviennent plus souvent.
// L'app Teufy n'est pas encore sortie : on pousse à s'abonner au compte, pas à télécharger.
import { jourCourt, jourNum, moisCourt, heure, plage } from './dates.mjs';
import { styleLabel } from './genres.mjs';

// Tirage déterministe : même date → même texte (aperçu = publication réelle).
export function rng(seedStr) {
  let h = 2166136261;
  for (const c of seedStr) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

import { TENDANCES, tendancesAuto, scoreHashtag } from './tendances.mjs';

// 5 hashtags maximum (règle Instagram depuis décembre 2025) : #TeufyParty + 2 locaux + 2 du style.
// Le choix suit ce qui a marché sur le compte (apprentissage) et les tendances des autres comptes.
const PERTINENT = /nice|cannes|monaco|antibes|azur|riviera|techno|house|club|night|soir|teuf|rave|party|afro|shatta|amapiano/i;
export function hashtags(ch, genre = 'general') {
  const H = TENDANCES.hashtags_candidats;
  const max = TENDANCES.regles_instagram.hashtags_max;
  const tendance = Object.keys(tendancesAuto().hashtags || {}).filter((t) => PERTINENT.test(t) && t !== H.marque.toLowerCase());
  const local = [...new Set([...H.local, ...tendance.filter((t) => /nice|cannes|monaco|antibes|azur|riviera/.test(t))])];
  const style = [...new Set([...(H[genre] || H.general), ...tendance.filter((t) => !local.includes(t))])];
  const l = ch.pickMany(`hashtags-local`, local, 2, scoreHashtag);
  const g = ch.pickMany(`hashtags-${genre}`, style.filter((t) => !l.includes(t)), max - 3, scoreHashtag);
  return [H.marque, ...l, ...g].slice(0, max).join(' ');
}

// Une ligne d'info par soirée : date, nom, styles, lieu, prix.
const ligne = (e, avecMois = false) => {
  const lieu = [e.venue, e.city].filter(Boolean).join(', ');
  const style = styleLabel(e);
  const p = e.price === 0 ? ' · gratuit' : e.price != null ? ` · ${String(e.price).replace('.', ',')} €` : '';
  return `→ ${jourCourt(e.start)} ${jourNum(e.start)}${avecMois ? ` ${moisCourt(e.start)}` : ''} · ${e.name}${style ? ` (${style})` : ''}${lieu ? ` · ${lieu}` : ''} · ${heure(e.start)}${p}`;
};
// Le mois n'est ajouté que si les dates s'étalent sur plus de 9 jours.
const liste = (events, n = 12) => {
  const t = events.map((e) => Date.parse(e.start));
  const avecMois = Math.max(...t) - Math.min(...t) > 9 * 86400e3;
  return events.slice(0, n).map((e) => ligne(e, avecMois)).join('\n');
};

const SUIVRE = [
  'Abonne-toi pour ne rien rater de ce qui se passe sur la Côte.',
  'Chaque semaine, les meilleures soirées de la Côte sont ici.',
  'Enregistre le post, tu nous remercieras vendredi.',
  'Envoie-le à ceux avec qui tu sors.',
];

// --- Les incontournables de la semaine ------------------------------------

export function captionIncontournables({ variante, events, from, to, ch, r }) {
  const techno = variante === 'techno';
  const ajoutees = TENDANCES.intros_ajoutees?.[variante] || []; // proposées par l'analyse hebdomadaire
  const intro = ch.pick(`intro-${variante}`, [...ajoutees, ...(techno
    ? [
      `Les événements techno de la semaine.\nDes line-up solides, des lieux qui comptent, une communauté qui répond toujours présent.`,
      `Pas juste des soirées. Des nuits entières.\nLa sélection techno de la semaine sur la Côte.`,
      `Pour ceux qui viennent pour la musique, et rien d'autre.\nVoilà où ça se passe cette semaine.`,
      `Kicks lourds, lumières basses, jusqu'au lever du jour.\nLes dates techno à ne pas manquer.`,
    ]
    : [
      `Cette semaine, la Côte d'Azur ne dort pas.\nNice, Cannes, Monaco… des ambiances, des styles, des vibes pour tous.`,
      `Une semaine, plusieurs ambiances.\nDu rooftop au club, voilà nos coups de cœur.`,
      `Certaines soirées se racontent pendant des semaines.\nCelles-là en font partie.`,
      `Afro, house, shatta, électro…\nCette semaine, il y en a pour toutes les envies.`,
    ])]);
  const question = ch.pick(`question-${variante}`, techno
    ? ['Tu seras à laquelle ?', 'On se retrouve où ?', 'Laquelle t\'attire le plus ?']
    : ['Tu sors où cette semaine ?', 'Laquelle on fait ensemble ?', 'Ta préférée, c\'est laquelle ?']);
  const suivre = ch.pick('suivre', SUIVRE);
  return clip(`${intro}\n\n${liste(events)}\n\n${question} ${suivre}\n\n${hashtags(ch, variante)}`);
}

// --- Appel aux organisateurs (#TeufyParty) -----------------------------------

export function captionOrgas({ quand, ch, r }) {
  const intro = ch.pick('orgas', [
    `Vous organisez une soirée ${quand} sur la Côte d'Azur ?\nPostez-la ici 👇\nDate, lieu, style : tout le monde passe par les commentaires.`,
    `Organisateurs, DJ, collectifs…\nVotre soirée ${quand}, c'est en commentaire que ça se passe 👇`,
    `Une soirée ${quand} à faire connaître ?\nDéposez-la ici, avec la date et le lieu 👇`,
  ]);
  return clip(`🪩 ${intro}\n\nEt si tu cherches où sortir, lis les commentaires.\n\n${hashtags(ch)}`);
}

// --- Bons plans -------------------------------------------------------------

export function captionBonPlan({ variante, events, from, to, ch, r, manuel }) {
  const suivre = ch.pick('suivre', SUIVRE);
  if (manuel) {
    const fin = ch.pick('fin-bonplan', ['Partagez à ceux qui doivent savoir.', 'Enregistrez pour plus tard.', 'Envoyez ça à votre groupe.']);
    return clip(`${manuel.titre}\n\n${manuel.texte}\n\n${fin} ${suivre}\n\n${hashtags(ch)}`);
  }
  if (variante === 'a-reserver') {
    const intro = ch.pick('intro-a-reserver', [
      `Bon plan : les grosses dates qui arrivent sur la Côte. Prenez vos places avant que ce soit sold out.`,
      `Petit conseil : ces soirées vont partir vite. Les places sont souvent moins chères maintenant que la veille.`,
      `À réserver maintenant, pas le jour J. Les dates qu'on surveille pour les prochaines semaines.`,
    ]);
    const fin = ch.pick('fin-a-reserver', ['Envoie ça à ton groupe avant d\'oublier.', 'Enregistre le post, ça t\'évitera le « c\'est complet ».', 'Laquelle vous tente le plus ?']);
    return clip(`${intro}\n\n${liste(events)}\n\n${fin}\n\nBillets sur Shotgun et DICE. ${suivre}\n\n${hashtags(ch)}`);
  }
  const intro = ch.pick('intro-petits-prix', [
    `Bon plan : sortir sur la Côte sans se ruiner. Gratuit ou petit prix, ${plage(from, to)}.`,
    `Fin de mois difficile ? Voilà les soirées gratuites ou à petit prix des prochains jours.`,
    `Qui a dit que sortir sur la Côte coûtait une fortune ? Petits prix et entrées gratuites 👇`,
  ]);
  const fin = ch.pick('fin-petits-prix', ['Partagez à votre pote toujours fauché.', 'Tag la personne qui dit toujours que c\'est trop cher.', 'Vous connaissez d\'autres bons plans ? Partagez en commentaire.']);
  return clip(`${intro}\n\n${liste(events)}\n\n${fin}\n\n${suivre}\n\n${hashtags(ch)}`);
}

// --- Débat ------------------------------------------------------------------

export function captionDebat({ debat, ch, r }) {
  const vote = debat.a && debat.b
    ? `\n\n${ch.pick('vote', ['Votez en commentaire', 'Répondez en commentaire', 'Votre camp en commentaire'])} : 🅰️ ${debat.a} ou 🅱️ ${debat.b}`
    : '';
  return clip(`${debat.legende}${vote}\n\n${hashtags(ch)}`);
}

// --- Reels ------------------------------------------------------------------

export function captionReel({ variante, events, ch, r, elargi = false }) {
  const hooks = {
    weekend: ['Laquelle tu choisis ce week-end ? Réponds avec le numéro.', 'Ton week-end sur la Côte en 15 secondes. Tu vas à laquelle ?', 'Plus d\'excuse pour rester chez toi ce week-end.'],
    techno: ['Ce week-end ça tape. Ton numéro en commentaire.', 'La famille techno de la Côte, on se retrouve où ce week-end ?', 'Pour ceux qui rentrent quand le soleil se lève.'],
    'petits-prix': ['Sortir ce week-end sans exploser ton budget. Laquelle tu prends ?', 'Gratuit ou presque. Ton numéro en commentaire.', 'Le week-end des petits budgets sur la Côte.'],
  }[variante].filter((h) => !elargi || !/week-end/i.test(h));
  const hook = ch.pick(`legende-reel-${variante}`, hooks.length ? hooks : ['Laquelle tu choisis ? Ton numéro en commentaire.']);
  const cta = ch.pick('cta-reel', ['Envoie ce reel à ton crew.', 'Tag ceux qui viennent avec toi.', 'Enregistre pour ne pas oublier.']);
  const suivre = ch.pick('suivre', SUIVRE);
  return clip(`${hook}\n\n${events.map((e, i) => `${i + 1}. ${ligne(e)}`).join('\n')}\n\n${cta} ${suivre}\n\n${hashtags(ch, variante === 'techno' ? 'techno' : 'general')}`);
}

function clip(s) { return s.length <= 2200 ? s : s.slice(0, 2190) + '…'; }
