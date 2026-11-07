// Visuels dans la DA du compte @teufy_official, rendus par Chromium (Playwright) :
//  - couverture : photo de soirée plein cadre teintée (couleur de la saison), grand titre blanc
//    en capitales très larges, sous-titre corail ;
//  - une diapo par soirée en 3 bandeaux : photo + « 13/12 · logo · Cannes », l'affiche
//    Shotgun/DICE, photo + styles musicaux (et nom · lieu · heure · prix) ;
//  - fin / débat / bon plan : photo, logo TF, pastille #TeufyParty, texte en gras.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { heure } from './dates.mjs';
import { genresList, styleLabel } from './genres.mjs';

// Typo française : espace insécable avant ? ! : ; et à l'intérieur des guillemets.
const fr = (s) => String(s ?? '').replace(/ ([?!:;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');
const esc = (s) => fr(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = (s) => esc(s).replace(/\n/g, '<br>');
const bg = (url) => (url ? `background-image:url('${esc(url)}')` : '');
const prix = (e) => (e.price == null ? '' : e.price === 0 ? 'Gratuit' : `dès ${String(Math.round(e.price * 100) / 100).replace('.', ',')} €`);
const dateCourte = (d) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit' }).format(new Date(new Date(d).getTime() - 6 * 3600e3));
const ville = (e) => (e.city || e.venue || "Côte d'Azur").replace(/^./, (c) => c.toUpperCase());

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:var(--w);height:var(--h);overflow:hidden;background:var(--nuit);color:var(--blanc);font-family:'TeufyWide',Archivo,'DejaVu Sans',sans-serif;font-stretch:var(--wdth)}
.large{font-family:'TeufyWide',Archivo,'DejaVu Sans',sans-serif;font-stretch:var(--wdth);font-weight:var(--g-titre);text-transform:uppercase;letter-spacing:.5px;line-height:1.02}
h1,h2,p{max-width:100%}
.ph{position:absolute;overflow:hidden;background:#111}
.ph .img{position:absolute;inset:0;background-size:cover;background-position:center;filter:saturate(1.12) contrast(1.06)}
.ph .img.repli{inset:-60px;filter:grayscale(1) blur(22px) contrast(1.25) brightness(.85)}
.ph .tint{position:absolute;inset:0;background:var(--teinte);mix-blend-mode:color;opacity:var(--teinte-force)}
.ph .lift{position:absolute;inset:0;background:var(--teinte);mix-blend-mode:soft-light;opacity:.25}
.ph.nb .img{filter:grayscale(1) contrast(1.25) brightness(1.05)}
.ph.nb .tint,.ph.nb .lift{opacity:0}
.ph .img.synth{filter:none;background:
 repeating-conic-gradient(from var(--a) at 50% -10%,rgba(255,255,255,.55) 0 2deg,transparent 2deg 11deg),
 radial-gradient(60% 40% at 50% 0%,rgba(255,255,255,.9),transparent 70%),
 radial-gradient(80% 50% at 50% 110%,rgba(255,255,255,.35),transparent 70%),#2a2a2a}
.ph .voile{position:absolute;inset:0}
.logo{display:block;width:auto;filter:drop-shadow(7px 7px 0 var(--ombre))}
.ombre{text-shadow:0 4px 28px rgba(0,0,0,.45)}
.pill{display:inline-block;padding:10px 26px;border:4px solid var(--corail);border-radius:22px;font-weight:600;font-stretch:100%;font-size:44px;background:rgba(0,0,0,.18)}
`;

// Réduit la taille d'un texte tant qu'il dépasse sa boîte (largeur et hauteur).
const FIT = `<script>
window.__fit = (async () => {
  try { await document.fonts.ready; } catch (e) {}
  for (const el of document.querySelectorAll('.fit')) {
    let s = parseFloat(getComputedStyle(el).fontSize);
    const maxH = parseFloat(el.dataset.maxh || 0);
    while ((el.scrollWidth > el.clientWidth + 2 || (maxH && el.scrollHeight > maxH)) && s > 18) { s -= 2; el.style.fontSize = s + 'px'; }
  }
})();
</script>`;

function page(th, w, h, body, extraCss = '') {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${th.css}
:root{--w:${w}px;--h:${h}px}${BASE_CSS}${extraCss}</style></head><body>${body}${FIT}</body></html>`;
}

// Bloc photo teintée. `src` = { url, photo } ; sans vraie photo, l'affiche est floutée.
function photo(src, css, { nb = false, voile = 'rgba(0,0,0,.25)' } = {}) {
  const img = src.url
    ? `<div class="img${src.photo ? '' : ' repli'}" style="${bg(src.url)}"></div>`
    : `<div class="img synth" style="--a:${(css.length * 37) % 360}deg"></div>`; // ni photo ni affiche : faisceaux de lumière
  return `<div class="ph${nb ? ' nb' : ''}" style="${css}">${img}<div class="tint"></div><div class="lift"></div><div class="voile" style="background:${voile}"></div></div>`;
}
const logo = (th, h) => (th.logo ? `<img class="logo" src="${th.logo}" style="height:${h}px" alt="">` : `<span class="large" style="font-size:${h}px">T</span>`);

// --- Couverture -------------------------------------------------------------

function couverture(th, w, h, { titre, sous, src }) {
  return page(th, w, h, `
  ${photo(src, 'inset:0', { voile: 'linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.35) 45%,rgba(0,0,0,.35) 65%,rgba(0,0,0,.55))' })}
  <h1 class="large fit ombre t" data-maxh="${Math.round(h * 0.34)}">${nl(titre)}</h1>
  ${sous ? `<h2 class="large fit s">${esc(sous)}</h2>` : ''}`, `
  .t{position:absolute;left:60px;right:60px;top:${Math.round(h * 0.42)}px;text-align:center;font-size:${h > 1500 ? 92 : 84}px}
  .s{position:absolute;left:60px;right:60px;bottom:${Math.round(h * 0.09)}px;text-align:center;font-size:76px;color:var(--corail);white-space:nowrap}`);
}

// --- Soirée en 3 bandeaux ---------------------------------------------------

function soiree(th, w, h, { e, haut, bas }) {
  const bh = Math.round(h * 0.275);
  const genres = genresList(e);
  const info = [e.name, e.venue, heure(e.start), prix(e)].filter(Boolean).join(' · ');
  return page(th, w, h, `
  ${photo(haut, `left:0;right:0;top:0;height:${bh}px`, { nb: th.techno, voile: 'rgba(0,0,0,.28)' })}
  <div class="bande haut"><span class="large d">${esc(dateCourte(e.start))}</span>${logo(th, Math.round(bh * 0.36))}<span class="large fit v">${esc(ville(e))}</span></div>
  <div class="aff" style="top:${bh}px;height:${h - 2 * bh}px">
    <div class="flou" style="${bg(e.image)}"></div>
    ${e.image ? `<div class="net" style="${bg(e.image)}"></div>` : `<div class="sans"><span class="large fit" data-maxh="${h - 2 * bh - 80}">${esc(e.name)}</span></div>`}
  </div>
  ${photo(bas, `left:0;right:0;bottom:0;height:${bh}px`, { nb: th.techno, voile: 'rgba(0,0,0,.38)' })}
  <div class="bande bas"><p class="g fit" data-maxh="${Math.round(bh * 0.55)}">${esc(genres.length ? genres.join(', ') : styleLabel(e) || e.name)}</p><p class="i fit">${esc(info)}</p></div>`, `
  .bande{position:absolute;left:0;right:0;height:${bh}px;display:flex;align-items:center;padding:0 70px}
  .haut{top:0;justify-content:space-between;gap:30px}
  .haut .d{font-size:${Math.round(bh * 0.17)}px;flex:1}
  .haut .v{font-size:${Math.round(bh * 0.17)}px;flex:1;text-align:right;text-transform:none;white-space:nowrap}
  .bas{bottom:0;flex-direction:column;justify-content:center;gap:${Math.round(bh * 0.06)}px;text-align:center}
  .g{font-weight:var(--g-titre);font-size:${Math.round(bh * 0.17)}px;line-height:1.15;width:100%}
  .i{font-weight:600;font-stretch:100%;font-size:${Math.round(bh * 0.085)}px;opacity:.9;white-space:nowrap;overflow:hidden;width:100%}
  .aff{position:absolute;left:0;right:0;overflow:hidden;background:#000}
  .aff .flou{position:absolute;inset:-60px;background-size:cover;background-position:center;filter:blur(36px) brightness(.5)}
  .aff .net{position:absolute;inset:0;background-size:contain;background-repeat:no-repeat;background-position:center}
  .aff .sans{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:40px 70px;text-align:center;background:linear-gradient(135deg,var(--logo1),var(--logo2))}
  .aff .sans span{font-size:90px;width:100%}`);
}

// --- Diapo « message » (fin, débat, bon plan) : photo, logo, pastille, texte -------------

export function message(th, w, h, { src, pill, texte, options = [], pied }) {
  return page(th, w, h, `
  ${photo(src, 'inset:0', { voile: 'linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.1) 40%,rgba(0,0,0,.6))' })}
  <div class="lg">${logo(th, Math.round(h * 0.1))}</div>
  <div class="bloc">
    ${pill ? `<span class="pill">${esc(pill)}</span>` : ''}
    <p class="tx fit ombre" data-maxh="${Math.round(h * 0.3)}">${nl(texte)}</p>
    ${options.map((o) => `<p class="op ombre"><b>${esc(o[0])}</b> ${esc(o[1])}</p>`).join('')}
    ${pied ? `<p class="pd ombre">${esc(pied)}</p>` : ''}
  </div>`, `
  .lg{position:absolute;top:${Math.round(h * 0.07)}px;left:0;right:0;display:flex;justify-content:center}
  .bloc{position:absolute;left:70px;right:70px;bottom:${Math.round(h * 0.07)}px;display:flex;flex-direction:column;align-items:flex-start;gap:26px}
  .tx{font-weight:800;font-size:60px;line-height:1.18;width:100%}
  .op{font-weight:700;font-size:44px;line-height:1.2}
  .op b{display:inline-block;min-width:66px;color:var(--corail);font-weight:900}
  .pd{font-weight:700;font-stretch:100%;font-size:40px;opacity:.95}`);
}

// --- Exports -----------------------------------------------------------------

export function carouselPages({ th, titre, sous, events, photos, fin }) {
  const details = events.slice(0, 8); // couverture + 8 soirées + fin = 10 (max Instagram)
  return [
    couverture(th, 1080, 1350, { titre, sous, src: photos.next(events[0]?.image) }),
    ...details.map((e) => soiree(th, 1080, 1350, { e, haut: photos.next(e.image), bas: photos.next(e.image) })),
    message(th, 1080, 1350, { src: photos.next(events.at(-1)?.image), pill: th.hashtag, texte: fin.texte, pied: fin.pied }),
  ];
}

export function debatPage({ th, debat, photos }) {
  return [message(th, 1080, 1350, {
    src: photos.next(), pill: '#TeufyDébat', texte: debat.q,
    options: debat.a && debat.b ? [['A', debat.a], ['B', debat.b]] : [],
    pied: 'Réponds en commentaire 👇',
  })];
}

export function bonPlanManuelPage({ th, bp, photos }) {
  return [message(th, 1080, 1350, { src: bp.image ? { url: bp.image, photo: true } : photos.next(), pill: '#BonPlan', texte: `${bp.titre}\n${bp.texte}` })];
}

export function reelPages({ th, events, photos, titre, sous, question, compte }) {
  return [
    couverture(th, 1080, 1920, { titre, sous, src: photos.next(events[0]?.image) }),
    ...events.map((e) => soiree(th, 1080, 1920, { e, haut: photos.next(e.image), bas: photos.next(e.image) })),
    message(th, 1080, 1920, { src: photos.next(events[0]?.image), pill: th.hashtag, texte: question, options: events.map((e, i) => [String(i + 1), e.name]).slice(0, 6), pied: 'Ton numéro en commentaire 👇' }),
    message(th, 1080, 1920, { src: photos.next(events.at(-1)?.image), texte: `Abonne-toi à ${compte}`, pied: 'Les soirées de la Côte, chaque semaine. Envoie à ton crew 📲' }),
  ];
}

// --- Rendu -----------------------------------------------------------------

export async function renderPages(pages, outDir, prefix, { width, height, png = false }) {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const files = [];
  try {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const pg = await ctx.newPage();
    for (let i = 0; i < pages.length; i++) {
      await pg.setContent(pages[i], { waitUntil: 'load', timeout: 60000 }).catch(() => {});
      await pg.evaluate(() => window.__fit).catch(() => {});
      await pg.waitForTimeout(250);
      const f = path.join(outDir, `${prefix}-${String(i + 1).padStart(2, '0')}.${png ? 'png' : 'jpg'}`);
      await pg.screenshot(png ? { path: f } : { path: f, type: 'jpeg', quality: 92 });
      files.push(f);
    }
  } finally {
    await browser.close();
  }
  return files;
}
