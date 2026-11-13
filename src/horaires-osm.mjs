// Horaires OpenStreetMap (« Mo-Th 11:00-02:00; Fr,Sa 11:00-05:00; Su off ») → fermeture de nuit par jour (12/11/2026).
// Sert à « Où manger après la soirée » : seuls les lieux dont les horaires PUBLIÉS montrent une ouverture après 2 h du
// matin sont gardés. Rien n'est deviné : une règle qu'on ne comprend pas (jours fériés, mois, semaines…) fait rejeter
// tout le lieu (null).
const J = { Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6, Su: 7 };
const NOMS = ['', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
const min = (h, m) => +h * 60 + +m;

function jours(txt) {
  const set = new Set();
  for (const p of txt.split(',')) {
    const m = p.trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!m) return null;
    const a = J[m[1]], b = m[2] ? J[m[2]] : a;
    for (let i = 0, x = a; i < 7; i++, x = x % 7 + 1) { set.add(x); if (x === b) break; }
  }
  return set;
}

/** Plages par jour (1 = lundi) en minutes depuis minuit du jour d'ouverture ({ de, a }, a > 1440 si après minuit). */
export function lireOSM(oh) {
  const s = String(oh || '').trim();
  if (!s) return null;
  if (/^24\/7$/.test(s)) return Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, [{ de: 0, a: 1440, continu: true }]]));
  const res = {};
  for (let regle of s.split(/\s*;\s*/)) {
    regle = regle.trim();
    if (!regle) continue;
    if (/^PH\s+(off|closed)$/i.test(regle)) continue; // « fermé les jours fériés » : sans effet sur les autres jours
    const m = regle.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)?\s*(.*)$/);
    if (!m) return null;
    const ds = m[1] ? jours(m[1]) : new Set([1, 2, 3, 4, 5, 6, 7]);
    const reste = m[2].trim();
    if (!ds) return null;
    if (/^(off|closed)$/i.test(reste)) { for (const d of ds) res[d] = []; continue; }
    const plages = [];
    for (const p of reste.split(/\s*,\s*/)) {
      const t = p.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\+?$/);
      if (!t) return null; // jours fériés, mois, semaines, textes libres : on ne devine pas
      let de = min(t[1], t[2]), a = min(t[3], t[4]);
      if (a === 1439) a = 1440; // « 23:59 » = minuit (jamais affiché 23h59)
      if (a <= de) a += 1440;
      plages.push({ de, a });
    }
    for (const d of ds) res[d] = plages;
  }
  return Object.keys(res).length ? res : null;
}

/** Ouverture au petit matin après la nuit de chaque jour (boulangerie qui ouvre à 4 h 30), en minutes ; absente sinon. */
export function ouverturesMatinales(plagesParJour) {
  const out = {};
  for (let d = 1; d <= 7; d++) for (const p of plagesParJour?.[d % 7 + 1] || []) if (p.de > 0 && p.de < 360) out[d] = Math.min(out[d] ?? 1440, p.de);
  return out;
}
/** Heure de fermeture de la nuit qui suit chaque jour (minutes après minuit, 0 si fermé avant minuit). */
export function fermeturesDeNuit(plagesParJour) {
  const out = {};
  for (let d = 1; d <= 7; d++) {
    let f = 0;
    for (const p of plagesParJour?.[d] || []) if (p.a > 1440) f = Math.max(f, p.a - 1440); else if (p.continu) f = Math.max(f, 1440);
    // Plage qui commence en pleine nuit le lendemain (« Sa 00:00-05:00 ») : elle appartient à la nuit de ce jour-ci.
    for (const p of plagesParJour?.[d % 7 + 1] || []) if (p.de === 0 && p.a > 0) f = Math.max(f, Math.min(p.a, 1440)); // suite de la nuit (« 00:00-05:00 »)
    if ((plagesParJour?.[d] || []).some((p) => p.continu) && (plagesParJour?.[d % 7 + 1] || []).some((p) => p.continu)) f = 1440;
    out[d] = f;
  }
  return out;
}

const hTxt = (m) => { m %= 1440; const h = Math.floor(m / 60), mm = m % 60; return `${h}h${mm ? String(mm).padStart(2, '0') : ''}`; };
/** Texte lisible des horaires du soir (« lun–jeu 18h–2h · ven–sam 18h–5h »), compréhensible par lireHoraires(). */
export function texteHorairesSoir(plagesParJour) {
  const parJour = {};
  for (let d = 1; d <= 7; d++) {
    const ps = (plagesParJour?.[d] || []).filter((p) => p.a > 1440 || p.continu || p.de < 360); // ouvert la nuit, ou dès le petit matin (boulangerie de 4 h 30)
    if (!ps.length) continue;
    const p = ps.at(-1);
    parJour[d] = p.continu ? '0h–24h' : `${hTxt(p.de)}–${hTxt(p.a)}`;
  }
  const groupes = [];
  for (let d = 1; d <= 7; d++) {
    if (!parJour[d]) continue;
    const g = groupes.at(-1);
    if (g && g.h === parJour[d] && g.b === d - 1) g.b = d; else groupes.push({ a: d, b: d, h: parJour[d] });
  }
  return groupes.map((g) => `${NOMS[g.a]}${g.b !== g.a ? `–${NOMS[g.b]}` : ''} ${g.h}`).join(' · ');
}
