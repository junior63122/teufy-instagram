// Charte graphique Teufy (contenus/da.json) : police, couleurs, logo, teinte des photos
// selon la saison, et « temps forts » (Nouvel An, Halloween…).
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DA = JSON.parse(readFileSync(path.join(ROOT, 'contenus', 'da.json'), 'utf8'));

export function saison(date = new Date()) {
  const m = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', month: 'numeric' }).format(date);
  if (m === 12 || m <= 2) return 'hiver';
  if (m <= 5) return 'printemps';
  if (m <= 8) return 'ete';
  return 'automne';
}

// Temps fort de la date (MM-JJ heure de Paris), ou null.
export function tempsFort(date = new Date()) {
  const md = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', month: '2-digit', day: '2-digit' }).format(date).split('/').reverse().join('-');
  return DA.temps_forts.find((t) => t.du <= md && md <= t.au) || null;
}

const dataUri = (f, mime) => `data:${mime};base64,${readFileSync(f).toString('base64')}`;

let fontCss;
function fonts() {
  if (fontCss) return fontCss;
  const ranges = ['U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    'U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'];
  fontCss = DA.police.fichiers.map((f, i) => {
    const p = path.join(ROOT, 'assets', 'fonts', f);
    if (!existsSync(p)) return '';
    return `@font-face{font-family:'TeufyWide';src:url('${dataUri(p, 'font/woff2')}') format('woff2');font-weight:100 900;font-stretch:62% 125%;unicode-range:${ranges[i] || ranges[0]}}`;
  }).join('\n');
  return fontCss;
}

let logoCache;
function logo() {
  if (logoCache !== undefined) return logoCache;
  logoCache = null;
  for (const [f, mime] of [['logo.svg', 'image/svg+xml'], ['logo.png', 'image/png']]) {
    const p = path.join(ROOT, 'assets', f);
    if (existsSync(p)) { logoCache = dataUri(p, mime); break; }
  }
  return logoCache;
}

export function theme(date, univers = 'club') {
  const s = saison(date);
  const c = DA.couleurs;
  const teinte = DA.saisons[s].teinte;
  const techno = univers === 'techno';
  return {
    saison: s, univers, teinte, techno, logo: logo(), tempsFort: tempsFort(date), hashtag: DA.hashtag_marque,
    css: `${fonts()}
:root{--blanc:${c.blanc};--corail:${c.corail};--ombre:${c.ombre_logo};--nuit:${c.nuit};--teinte:${teinte};
--logo1:${c.degrade_logo[0]};--logo2:${c.degrade_logo[1]};--wdth:${DA.police.largeur}%;--g-titre:${DA.police.graisse_titre};--g-texte:${DA.police.graisse_texte};
--teinte-force:${techno ? 0.12 : 0.22}}`,
  };
}
