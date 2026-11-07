// Reels « montage » : de vraies vidéos de soirée coupées sur le temps, avec du motion design
// par-dessus. Deux couches :
//  1. les plans vidéo (ffmpeg) : recadrage vertical, punch-in sur le temps, travelling, ralenti,
//     étalonnage, glitch ;
//  2. la typographie animée (Chromium, fond transparent, image par image), posée sur les plans.
// Trois « grammaires » de montage très différentes (rush, caméscope, édito), avec des réglages tirés
// au hasard à chaque reel (couleurs, polices, placements, transitions) : deux reels ne se ressemblent pas.
import { chromium } from 'playwright';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { heure } from './dates.mjs';
import { genresList, styleLabel } from './genres.mjs';
import { bruitages, mixer } from './audio.mjs';
import { tempsBeat } from './beat.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = 1080, H = 1920, FPS = 30;
export const GRAMMAIRES = ['rush', 'camescope', 'edito'];

const esc = (s) => String(s ?? '').replace(/ ([?!:;»])/g, ' $1').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f2 = (x) => (+x).toFixed(3);
function rng(seed) { let h = (seed >>> 0) || 1; return () => ((h = Math.imul(h ^ (h >>> 13), 1597334677) >>> 0) / 4294967296); }
const prix = (e) => (e.price == null ? '' : e.price === 0 ? 'gratuit' : `dès ${String(Math.round(e.price * 100) / 100).replace('.', ',')} €`);
const jour = (d, o) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', ...o }).format(new Date(new Date(d).getTime() - 6 * 3600e3));
const ville = (e) => (e.city || e.venue || "Côte d'Azur").replace(/-(sur-Mer|la-Napoule|du-Var|Cap-Martin|les-Pins|Loubet|sur-Loup)$/i, '').replace(/^Saint-/i, 'St-');

// --- Polices (embarquées, libres : Archivo, Instrument Serif, Space Mono) -------------------
const dataUri = (p, type) => `data:${type};base64,${readFileSync(p).toString('base64')}`;
let polices;
function fontes() {
  if (polices) return polices;
  const fs = (pkg, f) => path.join(ROOT, 'node_modules', '@fontsource', pkg, 'files', f);
  const out = [];
  const add = (fam, pkg, f, style = 'normal', weight = 400) => { const p = fs(pkg, f); if (existsSync(p)) out.push(`@font-face{font-family:'${fam}';src:url('${dataUri(p, 'font/woff2')}') format('woff2');font-style:${style};font-weight:${weight}}`); };
  add('Serif', 'instrument-serif', 'instrument-serif-latin-400-italic.woff2', 'italic');
  add('Serif', 'instrument-serif', 'instrument-serif-latin-ext-400-italic.woff2', 'italic');
  add('Serif', 'instrument-serif', 'instrument-serif-latin-400-normal.woff2');
  add('Mono', 'space-mono', 'space-mono-latin-400-normal.woff2');
  add('Mono', 'space-mono', 'space-mono-latin-700-normal.woff2', 'normal', 700);
  return (polices = out.join('\n'));
}

// --- Plans vidéo ---------------------------------------------------------------------------

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err = (err + d).slice(-3000); });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} a échoué (${c}) : ${err}`))));
  });
}

const ETALONNAGES = {
  chaud: 'eq=contrast=1.14:saturation=1.3:brightness=-0.03,colorbalance=rs=0.05:gs=-0.01:bs=-0.03:rh=0.06:bh=-0.04',
  tealorange: 'eq=contrast=1.12:saturation=1.2:brightness=-0.03,colorbalance=rs=-0.05:bs=0.07:rh=0.08:gh=0.01:bh=-0.07',
  neon: 'eq=contrast=1.2:saturation=1.55:brightness=-0.05,colorbalance=rs=0.04:bs=0.08:rm=0.03:bm=0.05',
  nb: 'hue=s=0.12,eq=contrast=1.38:brightness=-0.05:gamma=0.95',
  delave: 'eq=contrast=1.05:saturation=0.85:brightness=0.01:gamma=1.05,colorbalance=rs=0.04:bs=0.02:rm=0.03',
};

// Un plan : extrait recadré en 9:16, avec mouvement (punch, travelling, ralenti) et étalonnage.
async function plan(p, out) {
  const { fichier, debut, duree, vitesse = 1, zoom = 'creep', pan = [0.5, 0.5], secousse = 0, glitch = false, grade } = p;
  const D = duree;
  const Z = { punch: `(1.03+0.24*exp(-t*13))`, creep: `(1.03+0.08*t/${f2(D)})`, recul: `(1.12-0.08*t/${f2(D)})`, fixe: '1.04' }[zoom] || '1.04';
  const sx = secousse ? `+${secousse}*sin(t*37)+${secousse * 0.6}*sin(t*71)` : '';
  const sy = secousse ? `+${secousse}*sin(t*43+1)` : '';
  const vf = [
    `setpts=(PTS-STARTPTS)/${vitesse}`, `fps=${FPS}`,
    `scale=w='2*trunc(iw*${H}/ih*${Z}/2)':h='2*trunc(${H}*${Z}/2)':eval=frame`,
    `crop=${W}:${H}:x='max(0,min(iw-${W},(iw-${W})*(${pan[0]}+(${pan[1] - pan[0]})*t/${f2(D)})${sx}))':y='max(0,min(ih-${H},(ih-${H})/2${sy}))'`,
    ETALONNAGES[grade] || ETALONNAGES.chaud,
    // « Whip » : flou de filé sur les 2 premières images de chaque plan, la coupe paraît rapide.
    "boxblur=luma_radius=28:luma_power=1:chroma_radius=14:enable='lt(t,0.067)'",
    ...(glitch ? ['rgbashift=rh=16:bh=-16:gv=4', 'noise=alls=30:allf=t'] : []),
    'setsar=1', 'format=yuv420p',
  ].join(',');
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', f2(debut), '-t', f2(D * vitesse + 0.1), '-i', fichier, '-vf', vf, '-t', f2(D), '-an',
    '-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', out]);
}

// --- Rushes : choix des plans selon le moment du reel ----------------------------------------

// rushes = [{ fichier, duree, tags:['foule'|'dj'|'potes'|'lumieres'] }]
function choisisseur(rushes, r) {
  const vus = new Map();
  return (envie = []) => {
    const score = (x) => (envie.some((t) => x.tags?.includes(t)) ? 2 : 0) - (vus.get(x.fichier) || 0) * 3 + r();
    const x = [...rushes].sort((a, b) => score(b) - score(a))[0];
    vus.set(x.fichier, (vus.get(x.fichier) || 0) + 1);
    return x;
  };
}

// --- Couche typographique -------------------------------------------------------------------

const CSS = (th, acc) => `${th.css}
${fontes()}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:transparent;color:#fff;font-family:'TeufyWide',Archivo,sans-serif}
.w{position:absolute;visibility:hidden}
@keyframes fen{0%,100%{visibility:visible}}
.wide{font-stretch:125%;font-weight:900;text-transform:uppercase;line-height:.92;letter-spacing:-.01em}
.cond{font-stretch:62%;font-weight:900;text-transform:uppercase;line-height:.84;letter-spacing:-.01em}
.serif{font-family:'Serif',serif;font-style:italic;font-weight:400;letter-spacing:-.01em}
.mono{font-family:'Mono',monospace;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.contour{color:transparent;-webkit-text-stroke:5px #fff}
.acc{color:${acc}}
.ombre{text-shadow:0 4px 24px rgba(0,0,0,.55)}
.m{display:inline-block;overflow:hidden;vertical-align:top;padding:.1em .02em;margin:-.1em -.02em}
.mi{display:inline-block}
.fit{white-space:nowrap;display:inline-block}
@keyframes slam{from{transform:scale(1.55) rotate(var(--r,0deg));filter:blur(14px);opacity:0}to{transform:rotate(var(--r,0deg));filter:blur(0);opacity:1}}
@keyframes roll{from{transform:translateY(110%)}to{transform:none}}
@keyframes skew{from{transform:translateX(140px) skewX(-22deg);opacity:0}to{transform:none;opacity:1}}
@keyframes monte{from{transform:translateY(40px);opacity:0;filter:blur(8px)}to{transform:none;opacity:1;filter:blur(0)}}
@keyframes pop{from{transform:scale(.4) rotate(calc(var(--r,0deg) - 14deg));opacity:0}to{transform:rotate(var(--r,0deg));opacity:1}}
@keyframes flash{from{opacity:var(--o,.9)}to{opacity:0}}
@keyframes tape{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes ligne{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes defile{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes clign{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes dizaines{from{transform:translateY(0)}to{transform:translateY(-600%)}}
@keyframes unites{from{transform:translateY(0)}to{transform:translateY(-1000%)}}
@keyframes derive{from{transform:translate(0,0) rotate(var(--r,0deg))}to{transform:translate(var(--dx,0),var(--dy,-30px)) rotate(var(--r,0deg))}}
@keyframes fuite{0%{opacity:0;transform:translate(-30%,10%) scale(1)}40%{opacity:.55}100%{opacity:0;transform:translate(25%,-10%) scale(1.3)}}
`;

// Fenêtre d'apparition [t0, t1[ (secondes absolues) ; le contenu est coupé net en fin de fenêtre.
// Les animations passées dans `style` vont sur un calque intérieur (sinon elles remplaceraient celle de la fenêtre).
const fen = (t0, t1, html, style = '') => {
  const decl = style.split(';').filter((x) => x.trim());
  const dedans = decl.filter((x) => /^\s*animation/.test(x)).join(';');
  const dehors = decl.filter((x) => !/^\s*animation/.test(x)).join(';');
  return `<div class="w" style="animation:fen ${f2(Math.max(0.04, t1 - t0))}s steps(1) ${f2(t0)}s;${dehors}">${dedans ? `<div style="${dedans}">${html}</div>` : html}</div>`;
};
const anim = (nom, dur, t, ease = 'cubic-bezier(.16,1,.3,1)') => `animation:${nom} ${f2(dur)}s ${ease} ${f2(t)}s both`;
const RESSORT = 'linear(0,0.25 8%,0.75 18%,1.08 30%,1.12 36%,1.03 48%,0.98 60%,1.005 75%,1)';

function motsMasques(texte, t, pas, cls = '') {
  return esc(texte).split(' ').filter(Boolean).map((m, i) => `<span class="m"><span class="mi ${cls}" style="${anim('roll', 0.55, t + i * pas)}">${m}</span></span>`).join(' ');
}
const flash = (t, couleur = '#fff', o = 0.9, d = 0.16) => fen(t, t + d, '', `inset:0;background:${couleur};--o:${o};${anim('flash', d, t, 'ease-out')}`);
const fuiteLumiere = (t, d, couleur) => fen(t, t + d, '', `left:-40%;top:-20%;width:180%;height:140%;background:radial-gradient(ellipse at 40% 50%,${couleur} 0%,transparent 55%);${anim('fuite', d, t, 'ease-in-out')}`);
const affiche = (e, t, t1, { x, y, w, r = -4, polaroid = false }) => (e.image
  ? fen(t, t1, `<div style="--r:${r}deg;${anim('pop', 0.6, t, RESSORT)}"><div style="--r:${r}deg;animation:derive ${f2(t1 - t)}s linear ${f2(t)}s both;--dx:${r > 0 ? -18 : 18}px">
    <div style="${polaroid ? 'background:#f4f1ea;padding:16px 16px 64px;' : ''}border-radius:${polaroid ? 4 : 22}px;box-shadow:0 30px 80px rgba(0,0,0,.6);overflow:hidden"><img src="${esc(e.image)}" onerror="this.closest('.w').remove()" style="display:block;width:${w}px;max-height:${Math.round(w * 1.35)}px;object-fit:cover;border-radius:${polaroid ? 2 : 0}px"></div></div></div>`, `left:${x}px;top:${y}px`)
  : '');

// Ajuste la taille des titres pour qu'ils tiennent dans la largeur (zones sûres : 90 px à gauche, 150 à droite).
// (appelé une fois les polices chargées, sinon la mesure se fait avec la police de secours).
const ajuster = () => {
  for (const el of document.querySelectorAll('.fit')) { const max = +el.dataset.max || 840; let s = parseFloat(getComputedStyle(el).fontSize); while (el.offsetWidth > max && s > 30) { s -= 4; el.style.fontSize = `${s}px`; } }
  // Blocs sur plusieurs lignes : aussi gros que possible sans dépasser la largeur ni la hauteur prévues.
  for (const el of document.querySelectorAll('.bloc')) { const h = +el.dataset.h || 600; let s = parseFloat(getComputedStyle(el).fontSize); while ((el.scrollWidth > el.clientWidth + 2 || el.offsetHeight > h) && s > 30) { s -= 4; el.style.fontSize = `${s}px`; } }
};

// --- Les trois grammaires -------------------------------------------------------------------
// Chacune reçoit les sections minutées et renvoie la couche typographique + le découpage en plans.

function grammaireRush({ sections, b, acc, th, r, compte }) {
  let html = '';
  const plans = [];
  for (const s of sections) {
    const { t0, t1 } = s;
    // Coupes à chaque temps, punch-in, secousse ; flash en début de section.
    const pas = s.type === 'hook' || s.type === 'cta' || s.type === 'event' ? b / 2 : b;
    for (let t = t0, k = 0; t < t1 - 0.01; t += pas, k++) plans.push({ t, d: Math.min(pas, t1 - t), zoom: k % 3 === 2 ? 'creep' : 'punch', secousse: s.type === 'hook' || s.type === 'cta' ? 10 : 5, envie: s.envie, glitch: k === 0 && s.type !== 'fin' && r() < 0.5 });
    // Stroboscope léger sur chaque temps de l'accroche.
    if (s.type === 'hook') for (let t = t0 + b; t < t1 - 0.01; t += b) html += flash(t, '#fff', 0.22, 0.08);
    if (s.type !== 'hook') html += flash(t0, s.type === 'cta' ? acc : '#fff', 0.35, 0.08);
    if (s.type === 'hook') {
      const mots = s.titre.split(' ');
      const paquets = [];
      for (let i = 0; i < mots.length;) { const n = mots[i].length <= 3 && mots[i + 1] ? 2 : 1; paquets.push(mots.slice(i, i + n).join(' ')); i += n; }
      const pas = Math.max(b / 2, Math.min(b, (t1 - t0 - b) / paquets.length));
      paquets.forEach((p, i) => {
        const t = i === 0 ? -0.2 : t0 + i * pas;
        const contour = i % 3 === 1;
        html += fen(t, i === paquets.length - 1 ? t1 : t0 + (i + 1) * pas, `<span class="wide fit ombre ${contour ? 'contour' : ''}" data-max="900" style="font-size:230px;--r:${(r() * 6 - 3).toFixed(1)}deg;display:inline-block;${anim('slam', 0.14, t, 'cubic-bezier(.2,.9,.3,1)')}">${esc(p)}</span>`,
          'left:0;right:0;top:760px;text-align:center');
      });
      if (s.sous) html += fen(t1 - b * 1.2, t1, `<span class="mono" style="font-size:40px;background:${acc};color:#0b0b0f;padding:10px 18px;${anim('tape', 0.25, t1 - b * 1.2, 'steps(12)')}">${esc(s.sous)}</span>`, 'left:0;right:0;top:1110px;text-align:center');
      html += fen(0, t1, `<img src="${th.logo}" style="height:96px;filter:drop-shadow(6px 6px 0 var(--ombre))">`, 'left:0;right:0;top:200px;text-align:center');
    } else if (s.type === 'event') {
      const e = s.e;
      const g = genresList(e).join(' · ') || styleLabel(e) || '';
      html += fen(t0, t1, `<span class="mono" style="font-size:40px;${anim('monte', 0.25, t0)}">${String(s.n).padStart(2, '0')}<span style="opacity:.55">/${String(s.total).padStart(2, '0')}</span></span>`, 'left:90px;top:220px');
      // Temps 1 : le nom de la soirée, énorme. Temps 2 : l'affiche (ou le style en contour). Temps 3 : infos.
      html += fen(t0, t1, `<p class="wide bloc ombre" data-h="${e.image ? 430 : 560}" style="width:900px;font-size:200px;line-height:.9;--r:${(r() * 4 - 2).toFixed(1)}deg;${anim('slam', 0.14, t0, 'cubic-bezier(.2,.9,.3,1)')}">${esc(e.name)}</p>`, 'left:90px;top:330px');
      html += affiche(e, t0 + b, t1, { x: 430 + Math.round(r() * 60), y: 800, w: 470, r: +(r() * 8 - 4).toFixed(1) });
      if (!e.image && g) html += fen(t0 + b, t1, `<p class="wide contour bloc" data-h="300" style="width:900px;font-size:170px;line-height:.95;${anim('slam', 0.14, t0 + b)}">${esc(g)}</p>`, 'left:90px;top:950px');
      html += fen(t0 + b * 1.5, t1, `<span class="mono" style="font-size:40px;background:#fff;color:#0b0b0f;padding:10px 18px;${anim('tape', 0.25, t0 + b * 1.5, 'steps(16)')}">${esc(`${jour(e.start, { weekday: 'short', day: 'numeric' })} · ${ville(e)}${e.price != null ? ` · ${prix(e)}` : ''}`)}</span>`, 'left:90px;top:1250px');
      if (g && e.image) html += fen(t0 + b * 2, t1, `<span class="serif acc ombre" style="font-size:90px;${anim('monte', 0.3, t0 + b * 2)}">${esc(g.toLowerCase())}</span>`, 'left:90px;top:1110px');
    } else if (s.type === 'cta') {
      html += fen(t0, t1, `<p class="wide bloc ombre" data-h="420" style="width:900px;font-size:190px;line-height:.9;${anim('slam', 0.14, t0)}">${esc(s.question)}</p>`, 'left:90px;top:260px');
      s.events.forEach((e, i) => { const t = t0 + b + i * b * 0.5; html += fen(t, t1, `<p style="font-weight:900;font-size:54px;display:flex;align-items:center;gap:22px;${anim('skew', 0.25, t)}"><b class="mono" style="font-size:46px;background:${acc};color:#0b0b0f;padding:4px 14px">${i + 1}</b><span class="ombre">${esc(e.name)}</span></p>`, `left:90px;right:150px;top:${730 + i * 100}px;white-space:nowrap;overflow:hidden`); });
      html += fen(t0 + b * 3, t1, `<span class="mono" style="font-size:42px;background:#fff;color:#0b0b0f;padding:12px 20px;${anim('pop', 0.4, t0 + b * 3, RESSORT)}">ton numéro en com 👇</span>`, `left:0;right:0;top:${Math.min(1290, 760 + s.events.length * 100 + 40)}px;text-align:center`);
    } else if (s.type === 'point') {
      html += fen(t0, t1, `<span class="wide" style="font-size:260px;color:${acc};${anim('slam', 0.16, t0)};display:inline-block">${s.n}</span>`, 'left:90px;top:220px');
      html += fen(t0 + b * 0.5, t1, `<p class="ombre" style="font-weight:800;font-size:${s.texte.length > 90 ? 64 : 76}px;line-height:1.12">${motsMasques(s.texte, t0 + b * 0.5, 0.05)}</p>`, 'left:90px;right:150px;top:600px');
    } else if (s.type === 'fin') {
      html += fen(t0, t1, `<img src="${th.logo}" style="height:220px;filter:drop-shadow(10px 10px 0 var(--ombre));--r:0deg;${anim('pop', 0.6, t0, RESSORT)}">`, 'left:0;right:0;top:620px;text-align:center');
      html += fen(t0 + b * 0.5, t1, `<span class="mono" style="font-size:46px;${anim('tape', 0.4, t0 + b * 0.5, 'steps(16)')}">${esc(compte)}</span>`, 'left:0;right:0;top:940px;text-align:center');
      html += fen(t0 + b, t1, `<span class="serif acc" style="font-size:80px;${anim('monte', 0.4, t0 + b)}">${esc(s.texte)}</span>`, 'left:90px;right:150px;top:1040px;text-align:center');
    }
  }
  return { html, plans };
}

function grammaireCamescope({ sections, b, acc, th, r, compte, now }) {
  let html = '';
  const plans = [];
  const T = sections.at(-1).t1;
  // Interface de caméscope sur tout le reel : REC qui clignote, compteur, date, coins du viseur.
  const coin = (pos) => `<div style="position:absolute;${pos};width:70px;height:70px;border:solid #fff;border-width:${pos.includes('top') ? 4 : 0}px ${pos.includes('right') ? 4 : 0}px ${pos.includes('bottom') ? 4 : 0}px ${pos.includes('left') ? 4 : 0}px;opacity:.85"></div>`;
  const chiffre = (n, an) => `<span style="display:inline-block;height:1em;overflow:hidden;vertical-align:top"><span style="display:block;animation:${an} ${n === 6 ? 60 : 10}s steps(${n}) 0s infinite">${Array.from({ length: n }, (_, i) => `<span style="display:block;height:1em;line-height:1em">${i}</span>`).join('')}</span></span>`;
  html += fen(0, T, `${coin('top:150px;left:60px')}${coin('top:150px;right:60px')}${coin('bottom:330px;left:60px')}${coin('bottom:330px;right:60px')}
    <div class="mono" style="position:absolute;top:180px;left:100px;font-size:36px;display:flex;gap:14px;align-items:center"><span style="width:26px;height:26px;border-radius:50%;background:#ff2b2b;animation:clign 1s steps(1) infinite"></span>REC</div>
    <div class="mono" style="position:absolute;top:180px;right:100px;font-size:36px;line-height:1em">00:00:${chiffre(6, 'dizaines')}${chiffre(10, 'unites')}</div>
    <div class="mono" style="position:absolute;bottom:360px;left:100px;font-size:32px;opacity:.9">${esc(jour(now, { weekday: 'short', day: '2-digit', month: 'short' }))} ${now.getFullYear()}</div>
    <div class="mono" style="position:absolute;bottom:360px;right:100px;font-size:32px;opacity:.9">▮▮▮▯</div>`, 'inset:0');
  for (const s of sections) {
    const { t0, t1 } = s;
    // Plans plus longs (2 temps), caméra à l'épaule, ralentis de temps en temps.
    for (let t = t0, k = 0; t < t1 - 0.01; t += b, k++) plans.push({ t, d: Math.min(b, t1 - t), zoom: r() < 0.5 ? 'punch' : 'recul', secousse: 7, vitesse: r() < 0.25 ? 0.6 : 1, envie: s.envie });
    if (s.type === 'hook') {
      html += fen(0, t1, `<p class="serif ombre" style="font-size:${s.titre.length > 36 ? 128 : 150}px;line-height:1">${esc(s.titre.toLowerCase()).split(' ').map((m, i) => `<span style="display:inline-block;${anim('monte', 0.4, Math.max(-0.3, i * 0.11 - 0.3))}">${m}</span>`).join(' ')}</p>`, 'left:100px;right:150px;top:640px');
      if (s.sous) html += fen(b * 2, t1, `<span class="mono" style="font-size:38px;background:${acc};color:#0b0b0f;padding:8px 14px;${anim('tape', 0.35, b * 2, 'steps(14)')}">${esc(s.sous)}</span>`, 'left:100px;top:1180px');
    } else if (s.type === 'event') {
      const e = s.e;
      const g = genresList(e).join(', ') || styleLabel(e) || '';
      const meta = [jour(e.start, { weekday: 'long' }), heure(e.start), e.venue, prix(e)].filter(Boolean).join(' · ').toLowerCase();
      html += fen(t0, t1, `<p class="serif ombre" style="font-size:${e.name.length > 22 ? 124 : 156}px;line-height:.95">${esc(e.name)}</p>`, `left:100px;right:150px;top:300px;${anim('monte', 0.4, t0)}`);
      html += fen(t0 + 0.3, t1, `<p class="mono" style="font-size:32px;line-height:1.5;max-width:780px;background:rgba(0,0,0,.35);padding:6px 10px;display:inline-block;${anim('tape', 0.9, t0 + 0.3, `steps(${Math.min(60, meta.length)})`)}">${esc(meta)}</p>`, `left:100px;top:${e.name.length > 22 ? 640 : 500}px`);
      html += affiche(e, t0 + b, t1, { x: 330, y: 720, w: 440, r: +(r() * 8 - 2).toFixed(1), polaroid: true });
      if (g) html += fen(t0 + b * 1.5, t1, `<span class="mono" style="font-size:34px;color:${acc}">#${esc(g.split(',')[0].trim().toLowerCase().replace(/\s+/g, ''))}</span>`, `left:100px;top:${e.image ? 1330 : 900}px;${anim('monte', 0.3, t0 + b * 1.5)}`);
    } else if (s.type === 'cta') {
      html += fen(t0, t1, `<p class="serif ombre" style="font-size:160px;line-height:.95">${motsMasques(s.question.toLowerCase(), t0, 0.08)}</p>`, 'left:100px;right:150px;top:300px');
      s.events.forEach((e, i) => { const t = t0 + b * 0.6 + i * 0.22; html += fen(t, t1, `<p class="mono" style="font-size:40px;${anim('monte', 0.3, t)}"><span style="color:${acc}">${i + 1}.</span> ${esc(e.name.toLowerCase())}</p>`, `left:100px;right:150px;top:${620 + i * 80}px;white-space:nowrap;overflow:hidden`); });
      html += fen(t0 + b * 2.2, t1, `<p class="serif" style="font-size:72px;${anim('monte', 0.4, t0 + b * 2.2)}">réponds en com 👇</p>`, `left:100px;top:${Math.min(1250, 660 + s.events.length * 80 + 40)}px`);
    } else if (s.type === 'point') {
      html += fen(t0, t1, `<span class="mono" style="font-size:44px;color:${acc};${anim('monte', 0.3, t0)}">astuce ${s.n}/${s.total}</span>`, 'left:100px;top:300px');
      html += fen(t0, t1, `<p class="serif ombre" style="font-size:${s.texte.length > 90 ? 82 : 96}px;line-height:1.06">${motsMasques(s.texte, t0 + 0.15, 0.045)}</p>`, 'left:100px;right:150px;top:400px');
    } else if (s.type === 'fin') {
      html += fen(t0, t1, `<p class="serif" style="font-size:96px;text-align:center">${esc(s.texte.toLowerCase())}</p>`, `left:100px;right:150px;top:700px;${anim('monte', 0.4, t0)}`);
      html += fen(t0 + b * 0.6, t1, `<p class="mono" style="font-size:46px;text-align:center">${esc(compte)}</p>`, `left:100px;right:150px;top:960px;${anim('tape', 0.4, t0 + b * 0.6, 'steps(16)')}`);
    }
  }
  return { html, plans };
}

function grammaireEdito({ sections, b, acc, th, r, compte }) {
  let html = '';
  const plans = [];
  const T = sections.at(-1).t1;
  const bandeau = `TEUFY · CÔTE D'AZUR · ${'NICE · CANNES · MONACO · ANTIBES · '.repeat(2)}`;
  html += fen(0, T, `<div style="white-space:nowrap;display:inline-block;animation:defile 9s linear 0s infinite"><span class="mono" style="font-size:28px;letter-spacing:.2em">${esc(bandeau.repeat(2))}</span></div>`, 'left:0;right:0;top:150px;overflow:hidden;opacity:.8');
  for (const s of sections) {
    const { t0, t1 } = s;
    for (let t = t0, k = 0; t < t1 - 0.01; t += b, k++) plans.push({ t, d: Math.min(b, t1 - t), zoom: k % 2 ? 'creep' : 'punch', pan: k % 2 ? [0.2, 0.8] : [0.8, 0.2], envie: s.envie });
    if (s.type === 'hook') {
      const mots = s.titre.split(' ');
      const lignes = [];
      for (const m of mots) { const l = lignes.at(-1); if (l && (l + ' ' + m).length <= 11) lignes[lignes.length - 1] = l + ' ' + m; else lignes.push(m); }
      const der = lignes.length - 1;
      html += fen(0, t1, lignes.map((l, i) => `<div class="m" style="display:block"><span class="mi ${i === der ? 'serif acc' : 'cond'} fit" data-max="880" style="font-size:${i === der ? 170 : 210}px;${i === der ? 'text-transform:none;' : ''}${anim('roll', 0.6, Math.max(-0.25, i * 0.12 - 0.25))}">${esc(i === der ? l.toLowerCase() : l)}</span></div>`).join(''), 'left:90px;right:110px;top:420px');
      if (s.sous) html += fen(b * 1.5, t1, `<div style="height:6px;width:420px;background:#fff;transform-origin:left;${anim('ligne', 0.45, b * 1.5)}"></div><p class="mono" style="font-size:34px;margin-top:22px;${anim('monte', 0.35, b * 1.7)}">${esc(s.sous)}</p>`, 'left:90px;top:1250px');
    } else if (s.type === 'event') {
      const e = s.e;
      const g = (genresList(e)[0] || styleLabel(e) || '').toLowerCase();
      html += fen(t0, t1, `<span class="mono" style="font-size:34px">N°${String(s.n).padStart(2, '0')} — ${esc(jour(e.start, { weekday: 'long', day: 'numeric', month: 'long' }))}</span>`, `left:90px;top:240px;${anim('monte', 0.3, t0)}`);
      const mots = e.name.toUpperCase().split(' ');
      const lignes = [];
      for (const m of mots) { const l = lignes.at(-1); if (l && (l + ' ' + m).length <= 12) lignes[lignes.length - 1] = l + ' ' + m; else lignes.push(m); }
      html += fen(t0, t1, lignes.slice(0, 3).map((l, i) => `<div class="m" style="display:block"><span class="mi cond fit ombre" data-max="880" style="font-size:190px;${anim('roll', 0.55, t0 + i * 0.09)}">${esc(l)}</span></div>`).join(''), 'left:90px;right:110px;top:310px');
      const yb = 310 + Math.min(3, lignes.length) * 165;
      if (g) html += fen(t0 + b * 0.6, t1, `<span class="serif acc ombre" style="font-size:96px;${anim('monte', 0.4, t0 + b * 0.6)}">${esc(g)}</span>`, `left:90px;top:${yb}px`);
      html += fen(t0 + b, t1, `<div style="height:4px;width:300px;background:#fff;transform-origin:left;${anim('ligne', 0.4, t0 + b)}"></div><p class="mono" style="font-size:32px;margin-top:16px;line-height:1.4">${esc([e.venue, ville(e)].filter(Boolean).join(', '))}<br>${esc([heure(e.start), prix(e)].filter(Boolean).join(' · '))}</p>`, `left:90px;top:${yb + 130}px`);
      html += affiche(e, t0 + b * 1.3, t1, { x: 560, y: Math.max(yb + 60, 880), w: 380, r: 3 });
    } else if (s.type === 'cta') {
      html += fen(t0, t1, `<div class="m" style="display:block"><span class="mi cond fit" data-max="880" style="font-size:200px;${anim('roll', 0.55, t0)}">${esc(s.question.replace(/ \?$/, ''))}</span></div><span class="serif acc" style="font-size:200px;line-height:.8">?</span>`, 'left:90px;right:110px;top:260px');
      s.events.forEach((e, i) => { const t = t0 + b * 0.5 + i * b * 0.4; html += fen(t, t1, `<p style="display:flex;gap:24px;align-items:baseline;border-top:2px solid rgba(255,255,255,.7);padding-top:10px;${anim('monte', 0.35, t)}"><span class="mono" style="font-size:34px;color:${acc}">${String(i + 1).padStart(2, '0')}</span><span class="cond" style="font-size:64px;line-height:1">${esc(e.name)}</span></p>`, `left:90px;right:150px;top:${600 + i * 104}px;white-space:nowrap;overflow:hidden`); });
      html += fen(t0 + b * 2, t1, `<p class="serif" style="font-size:66px;${anim('monte', 0.4, t0 + b * 2)}">ton numéro en commentaire ↓</p>`, `left:90px;top:${Math.min(1260, 640 + s.events.length * 104 + 30)}px`);
    } else if (s.type === 'point') {
      html += fen(t0, t1, `<span class="cond" style="font-size:300px;color:${acc};${anim('roll', 0.5, t0)};display:inline-block">${String(s.n).padStart(2, '0')}</span>`, 'left:90px;top:220px;overflow:hidden');
      html += fen(t0 + 0.2, t1, `<p class="ombre" style="font-weight:800;font-size:${s.texte.length > 90 ? 62 : 74}px;line-height:1.12">${motsMasques(s.texte, t0 + 0.2, 0.045)}</p>`, 'left:90px;right:150px;top:600px');
    } else if (s.type === 'fin') {
      html += fen(t0, t1, `<img src="${th.logo}" style="height:180px;filter:drop-shadow(8px 8px 0 var(--ombre));--r:0deg;${anim('pop', 0.55, t0, RESSORT)}">`, 'left:90px;top:600px');
      html += fen(t0 + b * 0.4, t1, `<p class="cond" style="font-size:150px">${motsMasques('Abonne-toi', t0 + b * 0.4, 0.05)}</p><p class="mono" style="font-size:40px;margin-top:20px">${esc(compte)}</p><p class="serif acc" style="font-size:70px;margin-top:20px">${esc(s.texte.toLowerCase())}</p>`, 'left:90px;right:150px;top:830px');
    }
  }
  return { html, plans };
}

const GRAMMAIRE = { rush: grammaireRush, camescope: grammaireCamescope, edito: grammaireEdito };

// --- Assemblage -----------------------------------------------------------------------------

// contenu = { hook:{titre,sous}, events:[…], question, points:[…] (reel explicatif), fin }
export async function montageReel({ th, contenu, rushes, out, tmp, genre = 'club', grammaire, seed = 1, compte = '@teufy_official', now = new Date(), musique = null, tempo = null, outSansMusique = null }) {
  const r = rng(seed);
  grammaire ||= GRAMMAIRES[Math.floor(r() * GRAMMAIRES.length)];
  const style = genre === 'techno' ? 'techno' : 'club';
  // Tempo : celui du vrai morceau (son Instagram analysé) ou de la boucle générée.
  const b = tempo?.bpm ? 60 / tempo.bpm : tempsBeat(style);
  const accents = genre === 'techno' ? ['#c6ff00', '#ff2e63', '#ffffff'] : ['var(--corail)', '#ffd23f', '#ff4fa3', 'var(--corail)'];
  const acc = accents[Math.floor(r() * accents.length)];
  const grade = genre === 'techno' ? (r() < 0.6 ? 'nb' : 'neon') : grammaire === 'camescope' ? (r() < 0.5 ? 'delave' : 'chaud') : ['chaud', 'tealorange', 'neon'][Math.floor(r() * 3)];

  // Sections minutées sur la grille du tempo.
  const sections = [];
  let t = 0;
  const add = (type, temps, extra) => { sections.push({ type, t0: t, t1: t + temps * b, ...extra }); t += temps * b; };
  // L'accroche démarre à 0 et finit sur un temps du morceau : les coupes suivantes tombent sur les temps.
  add('hook', 4 + ((tempo?.phase || 0) % b) / b, { titre: contenu.hook.titre, sous: contenu.hook.sous, envie: ['foule', 'lumieres'] });
  if (contenu.points) contenu.points.forEach((p, i) => add('point', Math.min(10, Math.max(6, Math.round(p.length / 18))), { texte: p, n: i + 1, total: contenu.points.length, envie: ['potes', 'foule'] }));
  else contenu.events.forEach((e, i) => add('event', grammaire === 'rush' ? 3 : 4, { e, n: i + 1, total: contenu.events.length, envie: [['dj', 'foule', 'potes', 'lumieres'][i % 4]] }));
  if (contenu.question) add('cta', 5, { question: contenu.question, events: contenu.events, envie: ['potes', 'foule'] });
  add('fin', 3, { texte: contenu.fin || 'les soirées de la côte, chaque semaine', envie: ['lumieres', 'foule'] });
  const total = t;

  const { html, plans } = GRAMMAIRE[grammaire]({ sections, b, acc, th, r, compte, now });
  await rm(tmp, { recursive: true, force: true });
  const dOv = path.join(tmp, 'calque'), dPl = path.join(tmp, 'plans');
  await mkdir(dOv, { recursive: true }); await mkdir(dPl, { recursive: true });

  // 1. Plans vidéo, minutés à l'image près, puis mis bout à bout.
  const prendre = choisisseur(rushes, r);
  const liste = [];
  let cumul = 0;
  for (const [k, p] of plans.entries()) {
    const frames = Math.round((p.t + p.d) * FPS) - Math.round(cumul * FPS);
    if (frames <= 0) continue;
    const d = frames / FPS;
    const x = prendre(p.envie);
    const vitesse = p.vitesse || 1;
    const debut = Math.max(0, r() * Math.max(0, x.duree - d * vitesse - 0.3));
    const f = path.join(dPl, `${String(k).padStart(3, '0')}.mp4`);
    await plan({ fichier: x.fichier, debut, duree: d, vitesse, zoom: p.zoom, pan: p.pan || [0.35 + r() * 0.3, 0.35 + r() * 0.3], secousse: p.secousse || 0, glitch: p.glitch, grade }, f);
    liste.push(`file '${f}'`);
    cumul += d;
  }
  await writeFile(path.join(dPl, 'liste.txt'), liste.join('\n'));
  const footage = path.join(tmp, 'plans.mp4');
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dPl, 'liste.txt'), '-c', 'copy', footage]);

  // 2. Couche typographique, image par image, fond transparent.
  const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${CSS(th, acc)}</style></head><body>${html}</body></html>`;
  await writeFile(path.join(tmp, 'calque.html'), page);
  const n = Math.round(total * FPS);
  const browser = await chromium.launch(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {});
  try {
    const pg = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
    await pg.setContent(page, { waitUntil: 'load', timeout: 60000 });
    await pg.evaluate(() => document.fonts?.ready);
    await pg.evaluate(ajuster);
    for (let i = 0; i < n; i++) {
      await pg.evaluate((ms) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms; } }, (i / FPS) * 1000);
      await pg.screenshot({ path: path.join(dOv, `${String(i).padStart(5, '0')}.png`), omitBackground: true });
    }
  } finally { await browser.close(); }

  // 3. Son : musique + bruitages calés sur les sections.
  const sons = await bruitages(path.join(tmp, 'sons'));
  const sfx = sections.flatMap((s, i) => [
    ...(i > 0 ? [{ fichier: sons.whoosh, debut: Math.max(0, s.t0 - 0.25), volume: 0.35 }] : []),
    { fichier: s.type === 'hook' || s.type === 'cta' ? sons.impact : sons.pop, debut: s.t0 + 0.02, volume: s.type === 'event' ? 0.3 : 0.55 },
  ]);
  const cta = sections.find((s) => s.type === 'cta');
  if (cta) sfx.push({ fichier: sons.riser, debut: Math.max(0, cta.t0 - 1.2), volume: 0.4 });
  // 4. Composition finale : plans + typographie + grain + vignettage.
  const grain = grammaire === 'camescope' ? 16 : 9;
  const image = path.join(tmp, 'image.mp4');
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', footage, '-framerate', String(FPS), '-i', path.join(dOv, '%05d.png'),
    '-filter_complex', `[0:v][1:v]overlay=0:0:format=auto:shortest=1,noise=alls=${grain}:allf=t+u,vignette=PI/4.5,format=yuv420p[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '20', '-maxrate', '12M', '-bufsize', '24M', '-r', String(FPS), '-t', f2(total), image]);
  const muxer = async (wav, dest) => run('ffmpeg', ['-y', '-loglevel', 'error', '-i', image, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-t', f2(total), '-movflags', '+faststart', dest]);
  // Version complète (aperçu, et secours) : musique + bruitages.
  await muxer(await mixer({ total, musique, sfx, sortie: path.join(tmp, 'mix.wav') }), out);
  // Version pour Instagram quand le son est attaché par l'API : bruitages seuls, Instagram ajoute la musique.
  if (outSansMusique) await muxer(await mixer({ total, musique: null, sfx, sortie: path.join(tmp, 'sfx.wav'), niveau: -22 }), outSansMusique);
  return { out, outSansMusique, total, grammaire, accent: acc, etalonnage: grade, musique, bpm: +(60 / b).toFixed(2) };
}
