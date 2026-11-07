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

const W = 1080, H = 1920;
const esc = (s) => String(s ?? '').replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bg = (u) => (u ? `background-image:url('${String(u).replace(/'/g, '%27')}')` : '');
const prix = (e) => (e.price == null ? '' : e.price === 0 ? 'Gratuit' : `dès ${String(Math.round(e.price * 100) / 100).replace('.', ',')} €`);
const dateCourte = (d) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(new Date(d).getTime() - 6 * 3600e3)).replace('.', '');
const ville = (e) => (e.city || e.venue || "Côte d'Azur").replace(/-(sur-Mer|la-Napoule|du-Var|Cap-Martin|les-Pins|Loubet|sur-Loup)$/i, '').replace(/^Saint-/i, 'St-');

function rnd(seed) { let h = seed >>> 0 || 1; return () => ((h = Math.imul(h ^ (h >>> 13), 1597334677) >>> 0) / 4294967296); }

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
@keyframes kb{from{transform:scale(1.14)}to{transform:scale(1)}}
@keyframes sortie{to{transform:translateX(-18%) scale(1.06);filter:blur(14px);opacity:0}}
@keyframes tombe{from{transform:translate(0,-12vh) rotate(0)}50%{transform:translate(40px,50vh) rotate(180deg)}to{transform:translate(-30px,112vh) rotate(360deg)}}
@keyframes flash{from{opacity:.85}to{opacity:0}}
@keyframes mot{from{opacity:0;transform:translateY(90px) scale(.8)}70%{opacity:1;transform:translateY(-8px) scale(1.04)}to{opacity:1;transform:none}}
@keyframes gauche{from{opacity:0;transform:translateX(-120px)}to{opacity:1;transform:none}}
@keyframes droite{from{opacity:0;transform:translateX(120px)}to{opacity:1;transform:none}}
@keyframes haut{from{transform:translateY(-105%)}to{transform:none}}
@keyframes bas{from{transform:translateY(105%)}to{transform:none}}
@keyframes chute{from{opacity:0;transform:scale(1.35) rotate(-6deg)}65%{opacity:1;transform:scale(.97) rotate(1deg)}to{opacity:1;transform:scale(1) rotate(0)}}
@keyframes pop{from{opacity:0;transform:scale(0)}60%{opacity:1;transform:scale(1.25)}to{opacity:1;transform:scale(1)}}
@keyframes zoomlent{from{transform:scale(1)}to{transform:scale(1.05)}}
@keyframes glitch{0%,100%{text-shadow:0 0 0 transparent}20%{text-shadow:-6px 0 #ff004c,6px 0 #00e5ff}22%{text-shadow:0 0 0 transparent}55%{text-shadow:5px 0 #ff004c,-5px 0 #00e5ff}57%{text-shadow:0 0 0 transparent}}
@keyframes strobe{0%,100%{opacity:0}5%{opacity:.35}12%{opacity:0}}
@keyframes balaie{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes remue{0%,100%{transform:rotate(0)}25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}}
`;

function page(th, duree, body, css = '') {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${th.css}
:root{--d:${duree}s}${BASE}${th.techno ? '.titre-anim{animation:glitch 1.2s steps(1) .3s infinite}' : ''}${css}</style></head><body>${body}</body></html>`;
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
const mots = (texte, debut = 0.15, pas = 0.11) => esc(texte).split(' ').map((m, i) => `<span style="display:inline-block;animation:mot .5s cubic-bezier(.2,1.3,.4,1) ${(debut + i * pas).toFixed(2)}s both">${m}</span>`).join(' ');

// --- Scènes --------------------------------------------------------------------

export function sceneAccroche(th, { titre, sous, photo, duree = 2.1 }) {
  return { duree, html: page(th, duree, `<div class="scene">${fond(th, photo)}${deco(th, 3)}
  <div style="position:absolute;top:140px;left:0;right:0;display:flex;justify-content:center;animation:pop .5s .05s both">${logo(th, 120)}</div>
  <h1 class="large ombre titre-anim" style="position:absolute;left:70px;right:70px;top:640px;text-align:center;font-size:${titre.length > 34 ? 96 : 118}px">${mots(titre)}</h1>
  ${sous ? `<h2 class="large" style="position:absolute;left:60px;right:60px;bottom:280px;text-align:center;font-size:72px;color:var(--corail);animation:gauche .45s ease-out .9s both">${esc(sous)}</h2>` : ''}
  ${strobe(th)}<div class="flash"></div></div>`) };
}

export function sceneSoiree(th, { e, n, haut, bas, milieu, duree = 2.0 }) {
  const g = genresList(e);
  const titreBas = g.length ? g.join(', ') : styleLabel(e) || e.venue || e.name;
  const info = [e.venue !== titreBas ? e.venue : null, heure(e.start), prix(e), e.instagram?.[0] ? `@${e.instagram[0]}` : null].filter(Boolean).join(' · ');
  const bh = 500;
  return { duree, html: page(th, duree, `<div class="scene">
  <div style="position:absolute;left:0;right:0;top:0;height:${bh}px;overflow:hidden;animation:haut .35s cubic-bezier(.2,1,.3,1) both">${fond(th, haut, th.techno)}
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 70px">
      <span class="large" style="font-size:54px;white-space:nowrap;animation:gauche .4s .15s both">${esc(dateCourte(e.start))}</span>${logo(th, 140)}<span class="large" style="font-size:54px;white-space:nowrap;text-transform:none;animation:droite .4s .15s both">${esc(ville(e))}</span>
    </div></div>
  <div style="position:absolute;left:0;right:0;top:${bh}px;bottom:${bh}px;overflow:hidden;background:#000">
    ${e.image
      ? `<div style="position:absolute;inset:-60px;${bg(e.image)};background-size:cover;background-position:center;filter:blur(36px) brightness(.5)"></div>
         <div style="position:absolute;inset:24px;${bg(e.image)};background-size:contain;background-repeat:no-repeat;background-position:center;animation:chute .55s cubic-bezier(.2,1.2,.4,1) .1s both,zoomlent ${duree}s linear .65s both"></div>`
      : `${fond(th, milieu)}<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:60px"><h1 class="large ombre titre-anim" style="text-align:center;font-size:${e.name.length > 22 ? 92 : 120}px">${mots(e.name, .15, .09)}</h1></div>`}
    <span class="large" style="position:absolute;left:40px;top:30px;font-size:200px;color:var(--corail);-webkit-text-stroke:4px #000;animation:pop .45s .3s both">${n}</span>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:${bh}px;overflow:hidden;animation:bas .35s cubic-bezier(.2,1,.3,1) .2s both">${fond(th, bas, th.techno)}
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:0 70px;text-align:center">
      <p style="font-weight:900;font-size:${titreBas.length > 28 ? 62 : 80}px;line-height:1.1;animation:mot .45s .45s both">${esc(titreBas)}</p>
      <p style="font-weight:600;font-stretch:100%;font-size:38px;opacity:.92;animation:gauche .4s .6s both">${esc(e.name !== titreBas && e.image ? `${e.name} · ${info}` : info)}</p>
    </div></div>
  ${deco(th, n * 7, 8)}${strobe(th)}</div>`) };
}

export function sceneQuestion(th, { question, events, photo, duree = 2.8 }) {
  return { duree, html: page(th, duree, `<div class="scene">${fond(th, photo)}${deco(th, 11)}
  <h1 class="large ombre titre-anim" style="position:absolute;left:70px;right:70px;top:420px;text-align:center;font-size:120px">${mots(question)}</h1>
  <div style="position:absolute;left:70px;right:70px;top:880px;display:flex;flex-direction:column;gap:22px">
    ${events.slice(0, 6).map((e, i) => `<p style="font-weight:800;font-size:44px;display:flex;gap:26px;align-items:center;animation:gauche .4s ${(0.5 + i * 0.12).toFixed(2)}s both"><b class="large" style="flex:0 0 90px;height:90px;border-radius:50%;background:linear-gradient(135deg,var(--logo1),var(--logo2));display:flex;align-items:center;justify-content:center;font-size:52px">${i + 1}</b>${esc(e.name)}</p>`).join('')}
  </div>
  <p style="position:absolute;left:0;right:0;bottom:200px;text-align:center;font-weight:800;font-stretch:100%;font-size:52px;animation:pop .4s 1.3s both">Ton numéro en commentaire <span style="display:inline-block;animation:remue .6s 1.6s infinite">👇</span></p>
  ${strobe(th)}</div>`) };
}

export function sceneFin(th, { compte, photo, texte = 'Les soirées de la Côte, chaque semaine', duree = 2.2 }) {
  return { duree, html: page(th, duree, `<div class="scene" style="animation:none">${fond(th, photo)}${deco(th, 23)}
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px;text-align:center;padding:0 70px">
    <div style="animation:pop .55s .05s both">${logo(th, 230)}</div>
    <p class="large ombre" style="font-size:78px;color:var(--corail);animation:mot .5s .4s both">Abonne-toi</p>
    <p style="font-weight:800;font-size:54px;animation:mot .5s .55s both">${esc(compte)}</p>
    <p style="font-weight:700;font-stretch:100%;font-size:42px;opacity:.92;animation:gauche .45s .8s both">${esc(texte)}</p>
  </div></div>`) };
}

// Reel explicatif : un titre puis un point par scène (numéro, texte qui se révèle).
export function scenesExplication(th, { titre, sous, points, photos }) {
  const out = [sceneAccroche(th, { titre, sous, photo: photos.next(), duree: 2.4 })];
  points.slice(0, 5).forEach((pt, i) => {
    const duree = Math.min(4.2, Math.max(2.6, pt.length / 22));
    out.push({ duree, html: page(th, duree, `<div class="scene">${fond(th, photos.next())}${deco(th, 40 + i, 8)}
    <span class="large" style="position:absolute;left:70px;top:300px;font-size:260px;color:var(--corail);animation:pop .45s .05s both">${i + 1}</span>
    <div style="position:absolute;left:70px;right:70px;top:700px">
      <div style="height:14px;width:260px;background:var(--corail);transform-origin:left;animation:balaie .4s .25s both;margin-bottom:46px"></div>
      <p class="ombre" style="font-weight:800;font-size:${pt.length > 90 ? 62 : 74}px;line-height:1.18">${mots(pt, .3, .06)}</p>
    </div>${strobe(th)}</div>`) });
  });
  return out;
}

// --- Rendu et montage -----------------------------------------------------------

export async function motionReel({ scenes, out, root, genre = 'club', fps = 30, tmp }) {
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
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
        const t = (f / fps) * 1000;
        await pg.evaluate((ms) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms; } }, t);
        await pg.screenshot({ path: path.join(tmp, `${String(n++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 88 });
      }
    }
  } finally { await browser.close(); }
  const total = n / fps;
  const musique = (await pickMusic(path.join(root, 'assets', 'musiques', genre))) || (await pickMusic(path.join(root, 'assets', 'musiques')));
  const audio = musique
    ? ['-stream_loop', '-1', '-i', musique] // boucle si le morceau est plus court que le reel
    : ['-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'];
  await run('ffmpeg', ['-y', '-framerate', String(fps), '-i', path.join(tmp, '%05d.jpg'), ...audio,
    '-filter_complex', `[1:a]atrim=0:${total.toFixed(3)},loudnorm=I=-14:TP=-1.5,afade=t=in:d=0.2,afade=t=out:st=${Math.max(0, total - 1).toFixed(3)}:d=1,asetpts=PTS-STARTPTS[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-t', total.toFixed(3), '-movflags', '+faststart', out]);
  return { out, total, musique, premiereImage: path.join(tmp, '00012.jpg') };
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
