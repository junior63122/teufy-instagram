// Qualité des soirées avant affichage (23/11/2026, testeur « vérité » sur les 52 soirées de la semaine, directeur : « 0 fake
// news ») : quatre erreurs de fond, corrigées pour toutes les sources, jamais en inventant.
//  1. « Le vendredi 27, ouverture à minuit » lu comme le 27 à 0 h (donc la nuit du jeudi) : décalé à la nuit annoncée.
//  2. « Tous les vendredis » placé un jeudi : ramené au jour annoncé (même heure), dans les 7 jours.
//  3. Événement de journée : gardé mais signalé « journee » (24/11/2026), jamais présenté comme une soirée de nuit.
//  4. Même soirée sous plusieurs annonces (« Marwa Loud Showcase » sur Instagram + « MARWA LOUD FAST PASS HIGH CLUB » sur la
//     billetterie, même club, même nuit) : fusionnées, la billetterie l'emporte (heure, lien).
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const partsParis = (t) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
const JOUR_EN = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const sansAccent = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const texte = (e) => sansAccent(`${e.name || ''} ${e.description || ''}`);
// Une sortie de journée reste une sortie : day party, open air, festival, plage, pool party, DJ…
// 24/11/2026 (directeur : « garde le principe d'événements pour jeunes ; un événement d'orgue, je ne sais pas si ça va intéresser
// les jeunes ») : ce qui ne parle pas à un public 18-30 ans est retiré, de jour comme de nuit.
export const PAS_JEUNE = /\borgue|messe\b|liturg|chorale|chœur|choeur|cantate|oratorio|\bbach\b|vivaldi|mozart|beethoven|requiem|musique (de chambre|classique|sacr[ée]e|baroque)|concert (classique|baroque|spirituel)|quatuor|r[ée]cital|th[ée].dansant|apr[eè]s.midi dansant|seniors?\b|retrait[ée]s|3e [aâ]ge|troisi[eè]me [aâ]ge|club des a[iî]n[ée]s|\bloto\b|conf[ée]rence|heure du conte|spectacle (pour )?enfants?|jeune public|atelier (enfant|parent)/;
const SOIREE_JEUNE = /\bdjs?\b|party|techno|\bhouse\b|shatta|afro|dancehall|reggaeton|\brave\b|open ?air|electro|hip.?hop|\brap\b|clubbing|\bafter\b|disco|funk|amapiano|drill/;
// En journée, seules les sorties qui parlent aux jeunes restent (day party, open air, festival, brunch, concert, stand-up…).
const JEUNE_DE_JOUR = /\bdj\b|techno|house|party|open ?air|festival|rave|club|afro|shatta|dancehall|reggaeton|latino|electro|pool|beach|plage|brunch|after\b|sunset|rooftop|apero|rap\b|hip.?hop|concert|live\b|showcase|stand.?up|comedy|blind.?test|karaok|quiz|gaming|esport|street ?food|food ?truck|friperie|vintage|skate|surf|block.?party|coachell/;
const SORTIE_DE_JOUR = /\bdj\b|techno|house|party|open ?air|festival|rave|club|afro|shatta|dancehall|reggaeton|latino|electro|pool|beach|plage|brunch|after\b|sunset|rooftop|apero/;

/** 1. Ouverture « à minuit » le jour J lue comme J à 0 h : c'est la nuit du jour J (donc J+1 à 0 h). */
export function corrigerNuit(e) {
  const t = Date.parse(e.start); if (!t) return e;
  const p = partsParis(t), h = +p.hour;
  if (h >= 2) return e; // « minuit » ou « 1 h » seulement (une vraie ouverture à 2 h du matin reste telle quelle)
  const jour = JOURS[JOUR_EN[p.weekday]], d = +p.day;
  // La description annonce ce jour-là (« vendredi 27 ») : la soirée commence le soir de ce jour, pas la nuit d'avant.
  if (new RegExp(`\\b${jour}\\s+${d}\\b`).test(texte(e))) return { ...e, start: new Date(t + 864e5).toISOString(), ...(e.end && Date.parse(e.end) ? { end: new Date(Date.parse(e.end) + 864e5).toISOString() } : {}), _nuit_corrigee: true };
  return e;
}

/** 2. « Tous les vendredis » : la date doit tomber un vendredi (on prend le prochain, même heure, dans les 7 jours). */
export function corrigerRecurrence(e) {
  const t = Date.parse(e.start); if (!t) return e;
  const m = texte(e).match(/tous les (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)s?\b/); if (!m) return e;
  const voulu = JOURS.indexOf(m[1]);
  // Jour de la soirée = jour de son début, en comptant la nuit jusqu'à 6 h (une soirée du vendredi peut commencer à 0 h 30 le samedi).
  const p = partsParis(t - 6 * 3600e3); const jour = JOUR_EN[p.weekday];
  if (jour === voulu) return e;
  const ecart = (voulu - jour + 7) % 7;
  return { ...e, start: new Date(t + ecart * 864e5).toISOString(), ...(e.end && Date.parse(e.end) ? { end: new Date(Date.parse(e.end) + ecart * 864e5).toISOString() } : {}), _jour_corrige: true };
}

/** 5. « Week-end » placé du lundi au jeudi (23/11/2026 : « Week-end Techno L'Antre » un lundi, lu dans une vidéo) : date fausse. */
export function weekEndIncoherent(e) {
  const t = Date.parse(e.start); if (!t || !/week.?end/.test(texte(e))) return false;
  const j = JOUR_EN[partsParis(t - 6 * 3600e3).weekday];
  return j >= 1 && j <= 4;
}

/** 3. Événement de journée (6 h–17 h, heure de Paris) qui n'a rien d'une sortie : pas dans l'agenda de nuit. */
export function estJourneeHorsSujet(e) {
  const t = Date.parse(e.start); if (!t) return false;
  const h = +partsParis(t).hour;
  return h >= 6 && h < 17 && !SORTIE_DE_JOUR.test(texte(e));
}

const MOTS_VIDES = new Set(['soiree', 'party', 'night', 'club', 'nice', 'cannes', 'monaco', 'toulon', 'antibes', 'high', 'pass', 'fast', 'live', 'showcase', 'with', 'avec', 'the', 'les', 'des', 'and', 'presente', 'presents', 'edition', 'special', 'speciale', 'tickets', 'billets']);
const mots = (s) => new Set(sansAccent(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !MOTS_VIDES.has(w)));
const lieuCle = (e) => sansAccent(e.venue || e.lieu || '').replace(/[^a-z0-9]+/g, ' ').trim();
const memeLieu = (a, b) => { const x = lieuCle(a), y = lieuCle(b); return !!x && !!y && (x === y || x.startsWith(y) || y.startsWith(x)); };
const nuit = (e) => { const t = Date.parse(e.start); return t ? new Date(t - 6 * 3600e3).toISOString().slice(0, 10) : ''; };
const rang = (e) => (/instagram\.com/.test(e.url || '') || e.source === 'web' ? 1 : 0); // billetterie d'abord

/** 4. Même lieu, même nuit, mêmes mots du titre (2 au moins) ou même lien : une seule soirée. */
export function fusionnerMemeNuit(events) {
  const tri = [...events].sort((a, b) => rang(a) - rang(b));
  const gardes = [];
  for (const e of tri) {
    const m = mots(e.name);
    const double = gardes.find((g) => nuit(g) === nuit(e) && memeLieu(g, e) && ((e.url && (e.url === g.url || e.url === g.billet || e.billet === g.url)) || [...mots(g.name)].filter((w) => m.has(w)).length >= 2));
    if (!double) { gardes.push(e); continue; }
    for (const [k, v] of Object.entries(e)) if (v && !double[k]) double[k] = v;
    (double.doublons ||= []).push(e.url || e.name);
  }
  return gardes;
}

/** 6. Ville d'un lieu (24/11/2026, « Je Dis Techno » à L'Antre placée à Antibes) : si au moins 2 autres annonces du même lieu
 *  donnent toutes une même autre ville, c'est elle (une IA qui lit un post peut se tromper de ville, pas plusieurs billetteries). */
export function corrigerVilles(events) {
  const v = (e) => sansAccent(e.city || '').trim();
  return events.map((e) => {
    if (!lieuCle(e) || !v(e)) return e;
    const autres = events.filter((x) => x !== e && memeLieu(x, e) && v(x));
    if (autres.some((x) => v(x) === v(e))) return e;
    const villes = [...new Set(autres.map(v))];
    return villes.length === 1 && autres.length >= 2 ? { ...e, city: autres[0].city, _ville_corrigee: e.city } : e;
  });
}

/** Intéresse un public jeune : jamais d'orgue, de thé dansant, de chorale… ; en journée, une vraie sortie (day party, concert…). */
export function pourJeunes(e) {
  const t = texte(e);
  // Une vraie marque de soirée l'emporte (« ce quatuor envoie des basses funk », « DJ Dezze Recital aux platines »).
  if (PAS_JEUNE.test(t) && !SOIREE_JEUNE.test(t)) return false;
  return !estDeJour(e) || JEUNE_DE_JOUR.test(t);
}

/** Commence entre 6 h et 17 h (heure de Paris) : événement de journée. */
export function estDeJour(e) { const t = Date.parse(e.start); if (!t) return false; const h = +partsParis(t).hour; return h >= 6 && h < 17; }

/** Les règles, dans l'ordre. */
export function nettoyerSoirees(events, { log = () => {} } = {}) {
  let n = 0;
  const corriges = corrigerVilles(events).map((e) => { const x = corrigerRecurrence(corrigerNuit(e)); if (x !== e || e._ville_corrigee) n++; return x; });
  // 24/11/2026 (directeur : « il peut y avoir des événements en journée, ils peuvent intéresser les gens aussi, mais on doit très
  // bien différencier la nuit de la journée ») : les événements de journée restent, marqués « journee » ; le site les signale
  // (pastille « En journée », menu « Moment ») et ne les met jamais sous « Ce soir ». Seul le « week-end » placé en semaine est retiré.
  const faux = corriges.filter((e) => weekEndIncoherent(e) || !pourJeunes(e));
  const fusion = fusionnerMemeNuit(corriges.filter((e) => !weekEndIncoherent(e) && pourJeunes(e))).map((e) => (estDeJour(e) ? { ...e, journee: true } : e));
  log(`  Qualité des soirées : ${n} date(s) corrigée(s), ${fusion.filter((e) => e.journee).length} événement(s) de journée gardé(s), ${faux.length} retiré(s) (date impossible ou pas pour les jeunes), ${corriges.length - faux.length - fusion.length} doublon(s) fusionné(s).`);
  return fusion;
}
