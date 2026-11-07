// Classe une soirée « techno » ou « commerciale » (house, shatta, afro, électro, rap…)
// à partir du nom, des tags Shotgun/DICE, de la description et du lieu.

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const TECHNO = [
  'techno', 'hard techno', 'hardtechno', 'acid', 'industrial', 'rave', 'warehouse', 'minimal', 'tekno', 'schranz',
  'peak time', 'peaktime', 'hardgroove', 'hard groove', 'ebm', 'hardcore', 'gabber', 'hard dance', 'free party',
  'dark disco', 'melodic techno', 'raw', 'berlin', 'boiler', 'bpm 140', 'hypnotic', 'detroit', 'trance',
];
const COMMERCIAL = [
  'house', 'shatta', 'afro', 'amapiano', 'dancehall', 'reggaeton', 'latino', 'latin', 'rap', 'hip hop', 'hip-hop', 'rnb', 'r&b',
  'electro', 'disco', 'funk', 'commercial', 'generaliste', 'annees 2000', '2000', 'annees 90', '90s', '80s', 'student', 'etudiant',
  'afterwork', 'sunset', 'rooftop', 'brunch', 'pop', 'baile', 'kompa', 'zouk', 'drill', 'urban', 'open format', 'tech house', 'deep house',
  'bachata', 'salsa', 'kizomba', 'soca', 'french touch', 'ladies night', 'girls',
];
// Mots trompeurs : « tech house » est commercial, pas techno.
const FAUX_TECHNO = ['tech house', 'tech-house', 'techhouse'];

export function genreOf(e) {
  const txt = ' ' + norm([e.name, ...(e.tags || []), e.description, e.venue].join(' ')).replace(/[^a-z0-9& ]+/g, ' ') + ' ';
  const has = (w) => txt.includes(' ' + w + ' ') || txt.includes(' ' + w.replace(/ /g, '') + ' ') || (w.length > 5 && txt.includes(w));
  const tagTxt = norm((e.tags || []).join(' '));
  let t = TECHNO.filter(has).length;
  if (FAUX_TECHNO.some((w) => txt.includes(w))) t -= 1;
  if (/techno|hard ?groove|schranz|acid/.test(tagTxt) && !/tech ?house/.test(tagTxt)) t += 2; // tags = info la plus fiable
  const c = COMMERCIAL.filter(has).length;
  if (t > 0 && t >= c) return 'techno';
  return 'commercial';
}

export const isTechno = (e) => genreOf(e) === 'techno';

// Petit libellé de style à afficher sur les visuels (« Afro · Shatta »).
export function styleLabel(e) {
  const txt = norm([e.name, ...(e.tags || []), e.description].join(' '));
  const map = [
    ['hard techno', 'Hard techno'], ['hardgroove', 'Hardgroove'], ['acid', 'Acid'], ['techno', 'Techno'], ['trance', 'Trance'],
    ['tech house', 'Tech house'], ['amapiano', 'Amapiano'], ['shatta', 'Shatta'], ['dancehall', 'Dancehall'], ['afro', 'Afro'],
    ['reggaeton', 'Reggaeton'], ['latino', 'Latino'], ['rap', 'Rap'], ['hip hop', 'Hip-hop'], ['rnb', 'RnB'], ['r&b', 'RnB'],
    ['disco', 'Disco'], ['house', 'House'], ['electro', 'Électro'], ['2000', 'Années 2000'], ['funk', 'Funk'],
  ];
  const out = [];
  for (const [k, label] of map) {
    if (out.length >= 2) break;
    if (txt.includes(k) && !out.some((x) => x.toLowerCase().includes(label.toLowerCase()) || label.toLowerCase().includes(x.toLowerCase()))) out.push(label);
  }
  return out.join(' · ');
}

// Liste des styles affichée dans le bandeau du bas (« Techno, Bass House, Disco »),
// tirée des tags Shotgun/DICE puis du nom et de la description de la soirée.
const GENRES = [
  'Melodic Techno', 'Hard Techno', 'Hardgroove', 'Acid Techno', 'Industrial', 'Minimal', 'Trance', 'Techno', 'Acid',
  'Afro House', 'Tech House', 'Deep House', 'Bass House', 'Disco House', 'Electro House', 'Progressive House', 'House',
  'Drum & Bass', 'Dubstep', 'Afrobeat', 'Amapiano', 'Afro', 'Shatta', 'Dancehall', 'Reggaeton', 'Baile Funk', 'Latino', 'Kompa', 'Zouk',
  'Hip Hop', 'Rap', 'RnB', 'Jersey Club', 'Disco', 'Funk', 'Électro', 'Variété Française', 'Années 2000', 'Années 80', 'Pop', 'Indie', 'Progressive', 'Club',
];
const ALIAS = { 'hip-hop': 'hip hop', 'r&b': 'rnb', 'r n b': 'rnb', electro: 'électro', 'variete francaise': 'variété française', 'annees 2000': 'années 2000', '2000s': 'années 2000', 'annees 80': 'années 80', 'dnb': 'drum & bass', 'drum and bass': 'drum & bass' };

export function genresList(e, max = 6) {
  let txt = ' ' + norm([...(e.tags || []), e.name, e.description].join(' | ')).replace(/[^a-z0-9&|]+/g, ' ') + ' ';
  for (const [a, b] of Object.entries(ALIAS)) txt = txt.split(` ${norm(a).replace(/[^a-z0-9&]+/g, ' ')} `).join(` ${norm(b)} `);
  const out = [];
  for (const g of GENRES) {
    const k = ` ${norm(g)} `;
    if (txt.includes(k)) {
      txt = txt.split(k).join(' | ');
      if (!out.some((o) => norm(o).startsWith(norm(g)))) out.push(g); // « Afro » inutile si « Afrobeat »
    }
    if (out.length >= max) break;
  }
  return out;
}
