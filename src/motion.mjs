// Reels en motion design : chaque scène est une page HTML animée (CSS), capturée image par
// image à 30 i/s en « rembobinant » les animations (rendu net et déterministe), puis montée
// en MP4 avec ffmpeg et une musique. Textes qui arrivent en rythme, affiches qui tombent,
// zooms, transitions « whip », glitch pour la techno, décor de saison animé (neige, citrouilles…).
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { heure } from './dates.mjs';
import { genresList, styleLabel } from './genres.mjs';
import { pickMusic } from './reel.mjs';
import { parler, bruitages, mixer } from './audio.mjs';
import { genererBeat, surLaGrille } from './beat.mjs';

const W = 1080, H = 1920;
const esc = (s) => String(s ?? '').replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bg = (u) => (u ? `background-image:url('${String(u).replace(/'/g, '%27')}')` : '');
const prix = (e) => (e.price == null ? '' : e.price === 0 ? 'Gratuit' : `dès ${String(Math.round(e.price * 100) / 100).replace('.', ',')} €`);
const dateCourte = (d) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(new Date(d).getTime() - 6 * 3600e3)).replace('.', '');
const ville = (e) => (e.city || e.venue || "Côte d'Azur").replace(/-(sur-Mer|la-Napoule|du-Var|Cap-Martin|les-Pins|Loubet|sur-Loup)$/i, '').replace(/^Saint-/i, 'St-');

function rnd(seed) { let h = seed >>> 0 || 1; return () => ((h = Math.imul(h ^ (h >>> 13), 1597334677) >>> 0) / 4294967296); }

// Ressorts physiques (repris du skill « animated reels » pour Remotion) : la courbe d'un vrai
// ressort (raideur, amortissement, masse) est simulée puis traduite en easing CSS linear(),
// ce qui donne le même dépassement naturel que spring() de Remotion, sans dépendance.
export function ressort({ damping = 18, stiffness = 120, mass = 0.9 } = {}) {
  const dt = 1 / 600; let x = 0, v = 0, t = 0; const pts = [];
  while (t < 3) {
    const a = (-stiffness * (x - 1) - damping * v) / mass;
    v += a * dt; x += v * dt; t += dt; pts.push(x);
    if (t > 0.1 && Math.abs(x - 1) < 0.002 && Math.abs(v) < 0.02) break;
  }
  const N = 40;
  const vals = Array.from({ length: N + 1 }, (_, i) => (i === 0 ? 0 : i === N ? 1 : +pts[Math.round((i / N) * (pts.length - 1))].toFixed(4)));
  return { dur: +t.toFixed(3), ease: `linear(${vals.join(',')})` };
}
const SPR = { soft: ressort({ damping: 18, stiffness: 120, mass: 0.9 }), pop: ressort({ damping: 11, stiffness: 170, mass: 0.7 }), snappy: ressort({ damping: 20, stiffness: 260, mass: 0.6 }) };
const OUT_EXPO = 'cubic-bezier(.16,1,.3,1)', IN_CUBIC = 'cubic-bezier(.32,0,.67,0)';
const A = (nom, sp, delai) => `${nom} ${sp.dur}s ${sp.ease} ${delai.toFixed(2)}s both`;
// Entrée « Pop » : monte et grossit sur un ressort, se défloute ; « net » gère opacité et flou à part
// (un ressort qui dépasse 1 ne doit pas rendre le flou négatif).
const entre = (delai, sp = SPR.soft, nom = 'monte') => `animation:${A(nom, sp, delai)},net .35s ${OUT_EXPO} ${delai.toFixed(2)}s both`;

const GRAIN = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>")}")`;

const BASE = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:var(--nuit);color:#fff;font-family:'TeufyWide',Archivo,'DejaVu Sans',sans-serif;font-stretch:var(--wdth)}
.large{font-stretch:var(--wdth);font-weight:var(--g-titre);text-transform:uppercase;line-height:1.02}
.ombre{text-shadow:0 6px 30px rgba(0,0,0,.55)}
.fond{position:absolute;inset:-6%;background-size:cover;background-position:center;filter:saturate(1.12) contrast(1.06);animation:kb var(--d) linear both}
.fond.nb{filter:grayscale(1) contrast(1.3)}
.teinte{position:absolute;inset:0;background:var(--teinte);mix-blend-mode:color;opacity:var(--teinte-force)}
.voile{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.15) 40%,rgba(0,0,0,.6))}
.scene{position:absolute;inset:0;animation:sortie .32s cubic-bezier(.6,0,.9,.4) calc(var(--d) - .32s) both}
.logo{height:110px;filter:drop-shadow(7px 7px 0 var(--ombre))}
.p{position:absolute;top:0;animation:tombe var(--t) linear var(--dl) infinite;font-size:var(--s);opacity:.9}
.flash{position:absolute;inset:0;background:#fff;animation:flash .25s ease-out both;pointer-events:none}
.grain{position:absolute;inset:-40%;background:${GRAIN};opacity:.09;mix-blend-mode:overlay;pointer-events:none;z-index:9;animation:grain .5s steps(1) infinite}
.m{display:inline-block;overflow:hidden;vertical-align:top;padding:.14em .03em .14em;margin:-.14em -.03em -.14em}
.mi{display:inline-block}
.e{position:absolute;width:0;height:0;pointer-events:none;z-index:6}
.e i{position:absolute;font-style:normal;animation:eclat .9s ${OUT_EXPO} var(--t0) both}
@keyframes kb{from{transform:scale(1.14)}to{transform:scale(1)}}
@keyframes sortie{to{transform:translateX(-18%) scale(1.06);filter:blur(14px);opacity:0}}
@keyframes tombe{from{transform:translate(0,-12vh) rotate(0)}50%{transform:translate(40px,50vh) rotate(180deg)}to{transform:translate(-30px,112vh) rotate(360deg)}}
@keyframes flash{from{opacity:.85}to{opacity:0}}
@keyframes monte{from{transform:translateY(46px) scale(.9)}to{transform:none}}
@keyframes grossit{from{transform:scale(0) rotate(-12deg)}to{transform:none}}
@keyframes net{from{opacity:0;filter:blur(10px)}to{opacity:1;filter:blur(0)}}
@keyframes roll{from{transform:translateY(115%);filter:blur(6px)}to{transform:none;filter:blur(0)}}
@keyframes rollout{to{transform:translateY(-115%);filter:blur(6px)}}
@keyframes swing{from{transform:translateX(260px) rotateY(34deg) scale(.88)}to{transform:none}}
@keyframes gauche{from{transform:translateX(-140px)}to{transform:none}}
@keyframes haut{from{transform:translateY(-105%)}to{transform:none}}
@keyframes bas{from{transform:translateY(105%)}to{transform:none}}
@keyframes eclat{from{transform:translate(0,0) scale(1.2) rotate(0);opacity:1}to{transform:translate(var(--x),var(--y)) scale(.35) rotate(170deg);opacity:0}}
@keyframes zoomlent{from{transform:scale(1)}to{transform:scale(1.05)}}
@keyframes glitch{0%,100%{text-shadow:0 0 0 transparent}20%{text-shadow:-6px 0 #ff004c,6px 0 #00e5ff}22%{text-shadow:0 0 0 transparent}55%{text-shadow:5px 0 #ff004c,-5px 0 #00e5ff}57%{text-shadow:0 0 0 transparent}}
@keyframes strobe{0%,100%{opacity:0}5%{opacity:.35}12%{opacity:0}}
@keyframes balaie{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes remue{0%,100%{transform:rotate(0)}25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}}
@keyframes grain{0%{transform:translate(0,0)}20%{transform:translate(-7%,4%)}40%{transform:translate(5%,-6%)}60%{transform:translate(-3%,8%)}80%{transform:translate(8%,2%)}}
`;

function page(th, duree, body, css = '') {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${th.css}
:root{--d:${duree}s}${BASE}${th.techno ? '.titre-anim{animation:glitch 1.2s steps(1) .3s infinite}' : ''}${css}</style></head><body>${body}<div class="grain"></div></body></html>`;
}
const fond = (th, src, nb = false) => `<div class="fond${nb ? ' nb' : ''}" style="${bg(src?.url)}"></div><div class="teinte"></div><div class="voile"></div>`;
const logo = (th, h = 110) => (th.logo ? `<img class="logo" style="height:${h}px" src="${th.logo}" alt="">` : '<span class="large" style="font-size:90px">T</span>');
function deco(th, seed = 1, n = 16) {
  const ps = th.particules || [];
  if (!ps.length) return '';
  const r = rnd(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    out += `<span class="p" style="left:${Math.round(r() * 100)}%;--s:${Math.round(40 + r() * 50)}px;--t:${(4 + r() * 4).toFixed(2)}s;--dl:-${(r() * 8).toFixed(2)}s">${ps[i % ps.length]}</span>`;
  }
  return out;
}
const strobe = (th) => (th.techno ? '<div style="position:absolute;inset:0;background:#fff;animation:strobe .5s linear infinite;mix-blend-mode:overlay"></div>' : '');

// Mots qui montent d'un masque, un par un (RollText), et repartent vers le haut en fin de scène.
// *mot* = mot en corail.
function roll(texte, debut = 0.15, pas = 0.08) {
  let corail = false;
  return esc(texte).split(' ').filter(Boolean).map((brut, i) => {
    if (brut.startsWith('*')) corail = true;
    const mot = brut.replace(/\*/g, '');
    const c = corail;
    if (/\*[.,?!:;]*$/.test(brut)) corail = false;
    return `<span class="m"><span class="mi" style="${c ? 'color:var(--corail);' : ''}animation:roll .75s ${OUT_EXPO} ${(debut + i * pas).toFixed(2)}s both,rollout .42s ${IN_CUBIC} calc(var(--d) - .55s + ${(i * 0.025).toFixed(3)}s) forwards">${mot}</span></span>`;
  }).join(' ');
}

// Éclat de particules (Burst) : points corail et motifs de la saison, projetés en cercle.
function eclat(th, x, y, t0, { n = 12, r = 230, seed = 5 } = {}) {
  const g = rnd(seed);
  const motifs = th.particules?.length ? th.particules : [];
  let out = '';
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + g() * 0.5, rr = r * (0.6 + g() * 0.5), s = Math.round(18 + g() * 22);
    const contenu = i % 3 === 0 && motifs.length ? `<span style="font-size:${s * 1.6}px">${motifs[i % motifs.length]}</span>` : `<span style="display:block;width:${s}px;height:${s}px;border-radius:50%;background:var(--corail)"></span>`;
    out += `<i style="--x:${Math.round(Math.cos(ang) * rr)}px;--y:${Math.round(Math.sin(ang) * rr)}px;--t0:${t0.toFixed(2)}s;left:${-s / 2}px;top:${-s / 2}px">${contenu}</i>`;
  }
  return `<div class="e" style="left:${x}px;top:${y}px">${out}</div>`;
}

// --- Scènes --------------------------------------------------------------------
// Zones sûres (règles Reels) : contenu entre y≈180 et y≈1400, rien d'important dans les 300 px du bas
// ni contre le bord droit (boutons Instagram). La 1re image n'est jamais vide : c'est la vignette du fil.

export function sceneAccroche(th, { titre, sous, photo, duree = 2.1, voix }) {
  return { duree, voix: voix ?? titre, sfx: [['impact', 0.03, 0.9]], html: page(th, duree, `<div class="scene">${fond(th, photo)}${deco(th, 3)}
  <div style="position:absolute;top:190px;left:0;right:0;display:flex;justify-content:center;${entre(-0.25, SPR.pop, 'grossit')}">${logo(th, 120)}</div>
  <div style="position:absolute;left:70px;right:70px;top:560px;height:760px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:44px;text-align:center">
    <h1 class="large ombre titre-anim" style="font-size:${titre.length > 34 ? 96 : 118}px">${roll(titre, -0.4, 0.09)}</h1>
    ${sous ? `<h2 class="large ombre" style="font-size:70px;color:var(--corail)">${roll(sous, 0.75, 0.07)}</h2>` : ''}
  </div>
  ${eclat(th, 540, 900, 0.02, { seed: 3, r: 300, n: 14 })}${strobe(th)}</div>`) };
}

export function sceneSoiree(th, { e, n, haut, bas, milieu, duree = 2.0, voix }) {
  const g = genresList(e);
  const titreBas = g.length ? g.join(', ') : styleLabel(e) || e.venue || e.name;
  const info = [e.venue !== titreBas ? e.venue : null, heure(e.start), prix(e), e.instagram?.[0] ? `@${e.instagram[0]}` : null].filter(Boolean).join(' · ');
  const h1 = 460, h2 = 1180; // bandeau haut 0-460, affiche 460-1180, bandeau bas 1180-1920 (texte en haut du bandeau)
  return { duree, voix, sfx: [['impact', 0.12, 0.8], ['pop', 0.32, 0.7]], html: page(th, duree, `<div class="scene">
  <div style="position:absolute;left:0;right:0;top:0;height:${h1}px;overflow:hidden;animation:${A('haut', SPR.snappy, 0)}">${fond(th, haut, th.techno)}
    <div style="position:absolute;left:0;right:0;top:150px;bottom:0;display:flex;align-items:center;justify-content:space-between;padding:0 70px">
      <span class="large" style="font-size:52px;white-space:nowrap">${roll(dateCourte(e.start), 0.12, 0.06)}</span>${logo(th, 130)}<span class="large" style="font-size:52px;white-space:nowrap;text-transform:none">${roll(ville(e), 0.18, 0.06)}</span>
    </div></div>
  <div style="position:absolute;left:0;right:0;top:${h1}px;height:${h2 - h1}px;overflow:hidden;background:#000;perspective:1800px">
    ${e.image
      ? `<div style="position:absolute;inset:-60px;${bg(e.image)};background-size:cover;background-position:center;filter:blur(36px) brightness(.5)"></div>
         <div style="position:absolute;inset:22px;${entre(0.08, SPR.soft, 'swing')}"><div style="position:absolute;inset:0;${bg(e.image)};background-size:contain;background-repeat:no-repeat;background-position:center;animation:zoomlent ${duree}s linear .6s both"></div></div>`
      : `${fond(th, milieu)}<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:60px"><h1 class="large ombre titre-anim" style="text-align:center;font-size:${e.name.length > 22 ? 92 : 118}px">${roll(e.name, 0.12, 0.08)}</h1></div>`}
    <span class="large" style="position:absolute;left:44px;top:24px;font-size:190px;color:var(--corail);-webkit-text-stroke:4px #000;${entre(0.3, SPR.pop, 'grossit')}">${n}</span>
    ${eclat(th, 120, 130, 0.32, { n: 10, r: 170, seed: n * 13 })}
  </div>
  <div style="position:absolute;left:0;right:0;top:${h2}px;bottom:0;overflow:hidden;animation:${A('bas', SPR.snappy, 0.15)}">${fond(th, bas, th.techno)}
    <div style="position:absolute;left:0;right:0;top:0;height:250px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:0 140px;text-align:center">
      <p style="font-weight:900;font-size:${titreBas.length > 28 ? 58 : 76}px;line-height:1.1">${roll(titreBas, 0.4, 0.07)}</p>
      <p style="font-weight:600;font-stretch:100%;font-size:36px;opacity:.92;${entre(0.62, SPR.soft)}">${esc(e.name !== titreBas && e.image ? `${e.name} · ${info}` : info)}</p>
    </div></div>
  ${deco(th, n * 7, 8)}${strobe(th)}</div>`) };
}

export function sceneQuestion(th, { question, events, photo, duree = 2.8, voix }) {
  const liste = events.slice(0, 6);
  return { duree, voix: voix ?? `${question} Dis-le en commentaire.`, sfx: [['pop', 0.5, 0.5], ['pop', 0.62, 0.5], ['pop', 0.74, 0.5]], html: page(th, duree, `<div class="scene">${fond(th, photo)}${deco(th, 11)}
  <h1 class="large ombre titre-anim" style="position:absolute;left:70px;right:70px;top:230px;text-align:center;font-size:${question.length > 26 ? 96 : 116}px">${roll(question, 0.05, 0.09)}</h1>
  <div style="position:absolute;left:0;right:0;top:${question.length > 26 ? 640 : 600}px;display:flex;justify-content:center;${entre(0.4, SPR.pop)}"><p style="font-weight:800;font-stretch:100%;font-size:44px;padding:16px 34px;border-radius:999px;background:var(--corail);box-shadow:0 10px 30px rgba(0,0,0,.35)">Ton numéro en commentaire <span style="display:inline-block;animation:remue .6s .9s infinite">👇</span></p></div>
  <div style="position:absolute;left:70px;right:150px;top:780px;display:flex;flex-direction:column;gap:${liste.length > 4 ? 16 : 26}px">
    ${liste.map((e, i) => `<p style="font-weight:800;font-size:42px;display:flex;gap:24px;align-items:center;${entre(0.55 + i * 0.1, SPR.snappy, 'gauche')}"><b class="large" style="flex:0 0 80px;height:80px;border-radius:50%;background:linear-gradient(135deg,var(--logo1),var(--logo2));display:flex;align-items:center;justify-content:center;font-size:46px">${i + 1}</b><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.name)}</span></p>`).join('')}
  </div>
  ${strobe(th)}</div>`) };
}

export function sceneFin(th, { compte, photo, texte = 'Les soirées de la Côte, chaque semaine', duree = 2.2, voix }) {
  return { duree, voix: voix ?? 'Abonne-toi pour ne rien rater.', sfx: [['impact', 0.05, 0.7]], html: page(th, duree, `<div class="scene" style="animation:none">${fond(th, photo)}${deco(th, 23)}
  <div style="position:absolute;left:70px;right:70px;top:420px;height:900px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:50px;text-align:center">
    <div style="${entre(0.03, SPR.pop, 'grossit')}">${logo(th, 230)}</div>
    <p class="large ombre" style="font-size:80px;color:var(--corail)">${roll('Abonne-toi', 0.35, 0.08)}</p>
    <p style="font-weight:800;font-size:54px;${entre(0.55, SPR.soft)}">${esc(compte)}</p>
    <p style="font-weight:700;font-stretch:100%;font-size:42px;opacity:.92">${roll(texte, 0.75, 0.05)}</p>
  </div>
  ${eclat(th, 540, 700, 0.08, { n: 16, r: 330, seed: 23 })}</div>`) };
}

// Reel explicatif : un titre puis un point par scène (numéro qui saute, trait qui balaie, texte qui monte).
export function scenesExplication(th, { titre, sous, points, photos }) {
  const out = [sceneAccroche(th, { titre, sous, photo: photos.next(), duree: 2.4, voix: titre })];
  points.slice(0, 5).forEach((pt, i) => {
    const duree = Math.min(4.2, Math.max(2.6, pt.length / 22));
    out.push({ duree, voix: pt, sfx: [['pop', 0.08, 0.7]], html: page(th, duree, `<div class="scene">${fond(th, photos.next())}${deco(th, 40 + i, 8)}
    <span class="large" style="position:absolute;left:70px;top:230px;font-size:250px;color:var(--corail);${entre(0.03, SPR.pop, 'grossit')}">${i + 1}</span>
    ${eclat(th, 170, 380, 0.06, { n: 10, r: 190, seed: 40 + i })}
    <div style="position:absolute;left:70px;right:150px;top:620px">
      <div style="height:14px;width:260px;background:var(--corail);transform-origin:left;animation:balaie .45s ${OUT_EXPO} .2s both;margin-bottom:46px"></div>
      <p class="ombre" style="font-weight:800;font-size:${pt.length > 90 ? 60 : 72}px;line-height:1.2">${roll(pt, 0.28, 0.045)}</p>
    </div>${strobe(th)}</div>`) });
  });
  return out;
}

// --- Rendu et montage -----------------------------------------------------------

// Sous-titres karaoké : groupes de 3 mots, le mot prononcé passe en corail (minutage ElevenLabs).
function karaoke(mots, decalage) {
  if (!mots?.length) return '';
  const groupes = [];
  for (let i = 0; i < mots.length; i += 3) groupes.push(mots.slice(i, i + 3));
  return `<div style="position:absolute;left:50px;right:50px;top:1235px;display:flex;justify-content:center;z-index:5">${groupes.map((g, k) => {
    const debut = decalage + g[0].debut - 0.05;
    const fin = decalage + (groupes[k + 1] ? groupes[k + 1][0].debut : g.at(-1).fin + 0.4);
    return `<p class="large" style="position:absolute;text-align:center;font-size:64px;line-height:1.1;padding:14px 26px;border-radius:18px;background:rgba(0,0,0,.6);opacity:0;animation:kv ${(fin - debut).toFixed(2)}s linear ${debut.toFixed(2)}s both">${g.map((w) => `<span style="animation:kw .01s linear ${(decalage + w.debut).toFixed(2)}s both">${esc(w.mot)}</span>`).join(' ')}</p>`;
  }).join('')}</div><style>@keyframes kv{0%{opacity:0;transform:scale(.92)}8%{opacity:1;transform:none}92%{opacity:1}100%{opacity:0}}@keyframes kw{to{color:var(--corail)}}</style>`;
}

export async function motionReel({ scenes, out, root, genre = 'club', fps = 30, tmp, voix = null, config = {} }) {
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  const adir = `${tmp}-audio`;
  await rm(adir, { recursive: true, force: true });

  // 1. Voix off : chaque scène dure au moins le temps de sa phrase (+ une respiration).
  const sons = await bruitages(adir);
  const pistesVoix = [];
  const pistesSfx = [];
  let t = 0;
  for (const [k, s] of scenes.entries()) {
    if (voix && s.voix) {
      const v = await parler(s.voix, { voix, dossier: adir, nom: `voix-${k}`, config });
      if (v) {
        const d = Math.max(s.duree, v.duree + 0.55);
        if (d > s.duree) { s.html = s.html.replace(`--d:${s.duree}s`, `--d:${d}s`); s.duree = d; }
        if (v.mots?.length) s.html = s.html.replace('</body>', `${karaoke(v.mots, 0.2)}</body>`);
        pistesVoix.push({ fichier: v.fichier, debut: t + 0.2 });
      }
    }
    // Coupes sur la grille du tempo : chaque scène dure un nombre entier de temps.
    const g = +surLaGrille(s.duree, genre === 'techno' ? 'techno' : 'club').toFixed(3);
    if (g !== s.duree) { s.html = s.html.replace(`--d:${s.duree}s`, `--d:${g}s`); s.duree = g; }
    if (k > 0) pistesSfx.push({ fichier: sons.whoosh, debut: Math.max(0, t - 0.22), volume: 0.45 });
    for (const [nom, at, vol] of s.sfx || []) pistesSfx.push({ fichier: sons[nom], debut: t + at, volume: vol * 0.6 });
    t += s.duree;
  }

  // 2. Images : chaque scène est rejouée image par image.
  const browser = await chromium.launch();
  let n = 0;
  try {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const pg = await ctx.newPage();
    for (const s of scenes) {
      await pg.setContent(s.html, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
      await pg.evaluate(() => document.fonts?.ready).catch(() => {});
      const frames = Math.round(s.duree * fps);
      for (let f = 0; f < frames; f++) {
        const ms = (f / fps) * 1000;
        await pg.evaluate((x) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = x; } }, ms);
        await pg.screenshot({ path: path.join(tmp, `${String(n++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 88 });
      }
    }
  } finally { await browser.close(); }
  const total = n / fps;

  // 3. Son : musique baissée sous la voix, bruitages, volume égalisé ; puis montage final.
  // Musique : un .mp3 de assets/musiques s'il y en a, sinon une boucle générée au même tempo que les coupes.
  const musique = (await pickMusic(path.join(root, 'assets', 'musiques', genre))) || (await pickMusic(path.join(root, 'assets', 'musiques')))
    || await genererBeat({ style: genre === 'techno' ? 'techno' : 'club', duree: total, sortie: path.join(adir, 'beat.wav'), seed: Math.round(total * 1000) });
  const wav = await mixer({ total, musique, voix: pistesVoix, sfx: pistesSfx, sortie: path.join(adir, 'mix.wav') });
  await run('ffmpeg', ['-y', '-framerate', String(fps), '-i', path.join(tmp, '%05d.jpg'), '-i', wav,
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-t', total.toFixed(3), '-movflags', '+faststart', out]);
  return { out, total, musique, voix: pistesVoix.length ? voix : null };
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err = (err + d).slice(-3000); });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} a échoué (${c}) : ${err}`))));
  });
}
