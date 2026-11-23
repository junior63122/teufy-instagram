// Horaires d'ouverture des lieux : du texte trouvé sur les sources officielles (« Mer–Dim · 23h30–5h »,
// « Mar–Jeu 17h30–03h · Ven 17h30–04h ») vers des plages exploitables { j: [jours 1=lundi…7=dimanche], de: 'HH:MM', a: 'HH:MM' }.
// Rien n'est deviné : un texte qu'on ne comprend pas donne null (le site affiche alors « horaires non confirmés »).
const JOURS = { lun: 1, lundi: 1, mar: 2, mardi: 2, mer: 3, mercredi: 3, jeu: 4, jeudi: 4, ven: 5, vendredi: 5, sam: 6, samedi: 6, dim: 7, dimanche: 7,
  mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
const sansAccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const hh = (h, m) => `${String(+h % 24).padStart(2, '0')}:${String(m || '00').padStart(2, '0')}`;
const RE_JOUR = '\\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim|mon|tue|wed|thu|fri|sat|sun)\\b\\.?'; // \\b : « mer » n'est pas dans « confirmer »
const RE_HEURE = /(\d{1,2})\s*h\s*(\d{2})?(?:\s*\/\s*\d{1,2}\s*h\s*(?:\d{2})?)?\s*(?:–|-|à|a|to)\s*(\d{1,2})\s*(?:h\s*(\d{2})?)?/;

export function lireHoraires(texte) {
  if (!texte || typeof texte !== 'string') return null;
  const t = sansAccent(texte).replace(/7\s*j\s*\/\s*7|tous les jours|every ?day|daily/g, 'lun–dim');
  // 23/11/2026 (testeur pratique) : « fermé le dimanche » était lu comme « ouvert le dimanche ». Les jours de fermeture sont
  // retirés du texte avant la lecture (un horaire sans jour ouvert explicite reste alors « non confirmé »).
  const tt = t.replace(/(?:ferme|fermeture|closed|sauf|except)\s*(?:le|les|on|du|the)?\s*(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim)s?\b(?:\s*(?:et|,|and)\s*(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim)s?\b)*/g, ' ');
  const plages = [];
  let jours = null, enAttente = null;
  // On avance dans le texte : chaque groupe de jours s'applique aux heures qui le suivent.
  // Les précisions entre parenthèses (« été : jusqu'à 3 h », « haute saison ») ne sont pas les horaires de base.
  const morceaux = tt.replace(/\([^)]*\)/g, ' ').split(/\s*(?:·|;|\||,(?=\s*(?:lun|mar|mer|jeu|ven|sam|dim)[a-z]*\s*(?:–|-|au|\d)))\s*/);
  for (const m of morceaux) {
    const dj = [...m.matchAll(new RegExp(`${RE_JOUR}(?:\\s*(?:–|-|au|a|to)\\s*${RE_JOUR})?`, 'g'))];
    if (dj.length) {
      const set = new Set();
      for (const d of dj) {
        const a = JOURS[d[1]], b = d[2] ? JOURS[d[2]] : null;
        if (!a) continue;
        if (b) for (let i = 0, x = a; i < 7; i++, x = x % 7 + 1) { set.add(x); if (x === b) break; } else set.add(a);
      }
      // « jeu, dim, lun 19h30–1h » : les jours listés sans heure s'ajoutent au groupe suivant.
      if (set.size) jours = [...new Set([...(enAttente || []), ...set])].sort((x, y) => x - y);
    }
    const h = m.match(RE_HEURE);
    enAttente = dj.length && !h ? jours : null;
    // « 0h–0h » ou « 0h–24h » : ouvert 24 h sur 24 (fin notée 24:00).
    if (h && jours) { const de = hh(h[1], h[2]), a0 = hh(h[3], h[4]); plages.push({ j: jours, de, a: de === '00:00' && a0 === '00:00' ? '24:00' : a0 }); }
  }
  // Saison (23/11/2026 : le Bâoli, « 1er mai–31 oct. », était annoncé « ouvre ce soir » en novembre) : la période publiée
  // est gardée ({ de: 'MM-JJ', a: 'MM-JJ' }) ; « true » si le lieu est saisonnier sans dates publiées.
  // Saisonnier = une période publiée (« 1er mai–31 oct. ») ou une fermeture d'hiver dite clairement. « été : jusqu'à 3 h »
  // ou « haute / basse saison » ne sont que des variantes d'horaires d'un lieu ouvert toute l'année (23/11/2026 : Bard'Ô, Sam's Klub).
  const saisonnier = !!periodeSaison(t) || /saison estivale|\ben saison\b|seulement en saison|uniquement en saison|(?:seulement|uniquement) l'ete|ferme (?:l'hiver|en hiver|hors saison)|summer only/.test(t);
  return plages.length ? { plages, saison: saisonnier ? (periodeSaison(t) || true) : false } : null;
}

const MOIS = { janv: 1, jan: 1, janvier: 1, fevr: 2, fev: 2, fevrier: 2, feb: 2, mars: 3, mar: 3, avr: 4, avril: 4, apr: 4, mai: 5, may: 5, juin: 6, jun: 6,
  juil: 7, juillet: 7, jul: 7, aout: 8, aug: 8, sept: 9, sep: 9, septembre: 9, oct: 10, octobre: 10, nov: 11, novembre: 11, dec: 12, decembre: 12 };
const RE_MOIS = '(janvier|janv|jan|fevrier|fevr|fev|feb|mars|avril|avr|apr|mai|may|juin|jun|juillet|juil|jul|aout|aug|septembre|sept|sep|octobre|oct|novembre|nov|decembre|dec)\\.?';
/** Période de saison écrite en clair (« 1er mai–31 oct. », « d'avril à octobre », « mai - septembre ») → { de, a } en MM-JJ. */
export function periodeSaison(texte) {
  const t = sansAccent(String(texte || ''));
  const m = t.match(new RegExp(`(?:(\\d{1,2})(?:er)?\\s*)?${RE_MOIS}\\s*(?:\\d{4}\\s*)?(?:–|-|au|a|à|to|jusqu'au|jusqu'en)\\s*(?:(\\d{1,2})(?:er)?\\s*)?${RE_MOIS}`));
  if (!m) return null;
  const m1 = MOIS[m[2]], m2 = MOIS[m[4]];
  if (!m1 || !m2) return null;
  const fin = new Date(Date.UTC(2001, m2, 0)).getUTCDate(); // dernier jour du mois de fin
  const p = (x) => String(x).padStart(2, '0');
  return { de: `${p(m1)}-${p(m[1] ? +m[1] : 1)}`, a: `${p(m2)}-${p(m[3] ? +m[3] : fin)}` };
}

/** Le lieu saisonnier est-il dans sa saison ce jour-là (MM-JJ) ? null si on ne sait pas (saisonnier sans dates). */
export function enSaison(saison, mmjj) {
  if (!saison) return true;
  if (saison === true) return null;
  return saison.de <= saison.a ? mmjj >= saison.de && mmjj <= saison.a : mmjj >= saison.de || mmjj <= saison.a;
}
