import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile} from 'remotion';
import {noise2D} from '@remotion/noise';
import {BandeSon, Eclat, Grain, quand, useT} from '../ui/base';
import {Commentaire} from '../ui/illus';
import {E, SPR, clamp, mix, p, rnd, sp} from '../lib/anim';
import {F} from '../lib/fonts';
import type {Mot, Spec} from '../lib/types';

// Explicatif v2 : « Arrête d'acheter ta place la veille ». Scène type keynote (noir, grille fine, un seul
// accent), un chiffre géant par écran, cartes en 3D, calendrier qui tourne, grille de 100 billets,
// transitions par expansion d'éléments (jamais de fondu), caméra 2.5D qui pousse et se retire.

const C = {fond: '#07070b', surface: '#14141c', surface2: '#1d1d28', ligne: 'rgba(255,255,255,.07)', texte: '#f4f1ec', gris: '#8d8b95', accent: '#ff6b4a', alerte: '#ff3b30', or: '#ffd23f'};

const Scene: React.FC<{show: boolean; children: React.ReactNode; style?: React.CSSProperties}> = ({show, children, style}) => (show ? <AbsoluteFill style={style}>{children}</AbsoluteFill> : null);

/** Fond de scène : dégradé, halo qui suit le centre d'intérêt, grille fine (48 px) qui défile avec la caméra. */
const Plateau: React.FC<{t: number; hx: number; hy: number; dx: number; dy: number; teinte?: string}> = ({t, hx, hy, dx, dy, teinte = C.accent}) => (
  <AbsoluteFill style={{background: C.fond}}>
    <AbsoluteFill style={{background: `radial-gradient(circle at ${hx}px ${hy}px, ${teinte}2e 0%, transparent 42%), radial-gradient(ellipse at 50% 0%, #1b1b2a 0%, transparent 60%)`}} />
    <AbsoluteFill style={{backgroundImage: `linear-gradient(${C.ligne} 1px, transparent 1px), linear-gradient(90deg, ${C.ligne} 1px, transparent 1px)`, backgroundSize: '48px 48px', backgroundPosition: `${dx % 48}px ${dy % 48}px`, maskImage: 'radial-gradient(ellipse at 50% 45%, #000 30%, transparent 85%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 45%, #000 30%, transparent 85%)'}} />
  </AbsoluteFill>
);

/** Chiffre géant (police large, chiffres tabulaires) avec halo. */
const Geant: React.FC<{v: React.ReactNode; couleur?: string; taille?: number; style?: React.CSSProperties}> = ({v, couleur = C.texte, taille = 360, style}) => (
  <div style={{position: 'absolute', fontFamily: F.wide, fontWeight: 900, fontStretch: '115%', fontSize: taille, lineHeight: 0.85, color: couleur, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', textShadow: `0 0 80px ${couleur}55`, whiteSpace: 'nowrap', ...style}}>{v}</div>
);

/** Page de calendrier en 3D : la moitié haute bascule pour révéler le jour suivant. */
const Calendrier: React.FC<{avant: string; apres: string; flip: number; style?: React.CSSProperties; alerte?: boolean}> = ({avant, apres, flip, style, alerte}) => {
  const demi = (txt: string, haut: boolean, rot = 0, z = 0) => (
    <div style={{position: 'absolute', left: 0, right: 0, top: haut ? 0 : 160, height: 160, overflow: 'hidden', background: haut ? C.surface2 : C.surface, borderRadius: haut ? '28px 28px 0 0' : '0 0 28px 28px',
      transformOrigin: haut ? '50% 100%' : '50% 0%', transform: `rotateX(${rot}deg)`, backfaceVisibility: 'hidden', zIndex: z, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08)'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: haut ? 20 : -140, textAlign: 'center', fontFamily: F.wide, fontWeight: 900, fontStretch: '110%', fontSize: 210, lineHeight: 1.33, color: alerte && txt === apres ? C.alerte : C.texte}}>{txt}</div>
    </div>
  );
  const a = clamp(flip);
  return (
    <div style={{position: 'absolute', width: 460, height: 320, perspective: 1400, ...style}}>
      {demi(apres, true)}
      {demi(avant, false)}
      {a < 0.5 ? demi(avant, true, -a * 180, 2) : demi(apres, false, (1 - a) * 180, 2)}
      <div style={{position: 'absolute', left: 0, right: 0, top: 158, height: 4, background: C.fond, zIndex: 3}} />
      {[110, 350].map((x) => <div key={x} style={{position: 'absolute', left: x - 12, top: -26, width: 24, height: 52, borderRadius: 12, background: '#3a3a48', zIndex: 4}} />)}
    </div>
  );
};

/** Sous-titres « toast » : une pastille sombre en bas, mot prononcé en blanc, mots clés en accent. */
const Toast: React.FC<{mots: Mot[]; cles: string[]; masquer?: (t: number) => boolean}> = ({mots, cles, masquer}) => {
  const {t} = useT();
  if (masquer?.(t)) return null;
  const groupes: Mot[][] = [];
  let g: Mot[] = [];
  mots.forEach((m, i) => {
    g.push(m);
    if (/[.,!?:;…]$/.test(m.w) || g.length >= 4 || (mots[i + 1] && mots[i + 1].scene !== m.scene)) { groupes.push(g); g = []; }
  });
  if (g.length) groupes.push(g);
  const gi = groupes.findIndex((gr, i) => t >= gr[0].start - 0.05 && (i === groupes.length - 1 || t < groupes[i + 1][0].start - 0.05));
  if (gi < 0) return null;
  const gr = groupes[gi];
  if (t > gr[gr.length - 1].end + 0.5) return null;
  const a = p(t, gr[0].start - 0.08, 0.16);
  const n = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 1330, display: 'flex', justifyContent: 'center', opacity: a, transform: `translateY(${(1 - a) * 14}px)`}}>
      <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 0.26em', maxWidth: 860, padding: '16px 30px 20px', borderRadius: 28, background: 'rgba(18,18,26,.82)', border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 20px 50px rgba(0,0,0,.5)',
        fontFamily: F.wide, fontWeight: 800, fontStretch: '100%', fontSize: 58, lineHeight: 1.12}}>
        {gr.map((m, i) => {
          const dit = t >= m.start - 0.03;
          const cle = cles.includes(n(m.w));
          return <span key={i} style={{color: cle ? C.accent : dit ? C.texte : '#ffffff55', transform: `scale(${dit && t < m.end + 0.05 ? 1.06 : 1})`, display: 'inline-block'}}>{m.w}</span>;
        })}
      </div>
    </div>
  );
};

/** Expansion d'élément : un rectangle arrondi qui grandit depuis un point jusqu'à remplir l'écran. */
const Expansion: React.FC<{t0: number; x: number; y: number; couleur: string; d?: number; children?: React.ReactNode}> = ({t0, x, y, couleur, d = 0.45, children}) => {
  const {t} = useT();
  if (t < t0) return null;
  const a = p(t, t0, d, E.outQuint);
  const w = mix(120, 1180, a), h = mix(120, 2020, a);
  return (
    <div style={{position: 'absolute', left: mix(x, 540, a) - w / 2, top: mix(y, 960, a) - h / 2, width: w, height: h, borderRadius: mix(60, 0, a), background: couleur, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: -(mix(x, 540, a) - w / 2), top: -(mix(y, 960, a) - h / 2), width: 1080, height: 1920}}>{children}</div>
    </div>
  );
};

export const Paliers2: React.FC<{spec: Spec}> = ({spec}) => {
  const {t, fps} = useT();
  const S = spec.scenes;
  const q = (w: string, k: number) => quand(spec, w, k);
  const dans = (k: number, avant = 0.02, apres = 0) => t >= S[k].start - avant && t < S[k].end + apres;
  const tremble = (force: number, t0: number, d = 0.35) => (t > t0 && t < t0 + d ? noise2D('tr', t * 40, 0) * force * (1 - (t - t0) / d) : 0);

  // ---- 0 : STOP (déjà à l'écran sur la 1re image, c'est la vignette du fil) ----
  const tStop = -0.12;
  const tVeille = q('veille', 0);
  // ---- 1-2 : calendrier, chiffres ----
  const tLundi = q('lundi', 1), t12 = q('12', 1), tJeudi = q('jeudi', 2), t20 = q('20', 2), tPlace = q('place', 2), t25 = q('25', 2);
  // ---- 3 : barres → paliers ----
  const tPaliers = q('paliers', 3);
  // ---- 4-6 : grille de billets ----
  const tEarly = q('early', 4), tSuivant = q('suivant', 5), tCher = q('cher', 5), tHeures = q('heures', 6);
  // ---- 7-8 ----
  const tRegle = q('règle', 7), tPrends = q('prends', 7), tAvance = q('avance', 8), tArrache = q('arrache', 8);

  // Halo et grille suivent la caméra d'une scène à l'autre.
  const hx = mix(540, 760, p(t, S[2].start, 1)), hy = mix(700, 900, p(t, S[3].start, 1));
  const dy = interpolate(t, [0, spec.duree], [0, -600]);

  return (
    <AbsoluteFill style={{background: C.fond, fontFamily: F.wide, overflow: 'hidden'}}>
      <Plateau t={t} hx={hx} hy={hy} dx={0} dy={dy} teinte={t > tPlace && t < S[3].start ? C.alerte : C.accent} />

      {/* ===== 0 : STOP ===== */}
      <Scene show={dans(0, 1, 0.25)} style={{transform: `scale(${mix(1, 1.8, p(t, S[1].start - 0.2, 0.3, E.inCubic))})`, filter: t > S[1].start - 0.2 ? `blur(${p(t, S[1].start - 0.2, 0.3) * 30}px)` : undefined, opacity: 1 - p(t, S[1].start - 0.05, 0.2)}}>
        {/* billet en 3D derrière le mot */}
        <div style={{position: 'absolute', left: 540, top: 700, transform: `translate(-50%,-50%) perspective(1600px) rotateY(${mix(-35, -18, p(t, 0, 2))}deg) rotateX(12deg) rotateZ(-6deg)`}}>
          <div style={{width: 560, height: 300, borderRadius: 30, background: `linear-gradient(135deg, ${C.surface2}, ${C.surface})`, border: '1px solid rgba(255,255,255,.1)', boxShadow: `0 60px 120px rgba(0,0,0,.6), 0 0 120px ${C.alerte}33`, padding: 34}}>
            <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 26, color: C.gris, letterSpacing: '0.16em'}}>BILLET · LA VEILLE</div>
            <div style={{fontWeight: 900, fontStretch: '120%', fontSize: 170, color: C.alerte, lineHeight: 1, marginTop: 20}}>25 €</div>
          </div>
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 860, textAlign: 'center', transform: `translate(${tremble(16, tStop)}px, 0) scale(${mix(1.6, 1, sp(t, tStop, fps, SPR.sec))})`}}>
          <span style={{fontWeight: 900, fontStretch: '112%', fontSize: 255, color: C.texte, letterSpacing: '-0.03em', textShadow: `0 0 60px ${C.accent}88`}}>STOP</span>
        </div>
        {t > tVeille - 0.1 ? <div style={{position: 'absolute', left: 0, right: 0, top: 1170, textAlign: 'center', fontFamily: F.serif, fontStyle: 'italic', fontSize: 100, color: C.accent, opacity: p(t, tVeille - 0.1, 0.2)}}>pas la veille.</div> : null}
        <Img src={staticFile('logo.png')} style={{position: 'absolute', left: 540, top: 200, height: 70, transform: 'translateX(-50%)', opacity: 0.9, filter: 'drop-shadow(4px 4px 0 #ff6b4a)'}} />
      </Scene>

      {/* ===== 1-2 : le calendrier et les chiffres ===== */}
      <Scene show={t >= S[1].start - 0.1 && t < S[3].start + 0.12} style={{transform: `scale(${mix(1.4, 1, p(t, S[1].start - 0.1, 0.4, E.outExpo)) * mix(1, 0.2, p(t, S[3].start - 0.12, 0.24, E.inCubic))})`, transformOrigin: '540px 1000px', opacity: 1 - p(t, S[3].start - 0.05, 0.17)}}>
        <Calendrier avant="LUN" apres="JEU" flip={p(t, tJeudi - 0.25, 0.45, E.inOut)} alerte style={{left: 310, top: 280, transform: `translate(${tremble(10, tJeudi + 0.1)}px,0) rotateX(8deg)`}} />
        {/* chiffre qui grimpe */}
        {(() => {
          const v = t < tJeudi ? Math.round(interpolate(t, [t12 - 0.3, t12 + 0.1], [5, 12], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})) : Math.round(interpolate(t, [t20 - 0.25, t20 + 0.25], [12, 20], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
          const rouge = t > t20 - 0.1;
          return <Geant v={<>{v}<span style={{fontSize: 160}}> €</span></>} couleur={rouge ? C.alerte : C.texte} style={{left: 0, right: 0, textAlign: 'center', top: 720, transform: `scale(${t > t20 - 0.1 && t < t20 + 0.3 ? 1.08 : mix(0.6, 1, sp(t, t12 - 0.35, fps, SPR.pop))})`, opacity: clamp(p(t, t12 - 0.35, 0.12)) * (t < tPlace - 0.15 ? 1 : 1 - p(t, tPlace - 0.15, 0.15))}} />;
        })()}
        {/* sur place : enseigne néon qui s'ouvre depuis le chiffre */}
        {t > tPlace - 0.2 ? (
          <AbsoluteFill style={{clipPath: `inset(${mix(45, 0, p(t, tPlace - 0.2, 0.35, E.outQuint))}% ${mix(30, 0, p(t, tPlace - 0.2, 0.35, E.outQuint))}% round 40px)`, background: '#0b0610'}}>
            <div style={{position: 'absolute', left: 0, right: 0, top: 360, textAlign: 'center', fontWeight: 900, fontStretch: '110%', fontSize: 120, color: '#ff4fa3', textShadow: '0 0 20px #ff4fa3, 0 0 60px #ff4fa3', opacity: (t * 9) % 4 < 0.3 && t < tPlace + 0.8 ? 0.35 : 1}}>SUR PLACE</div>
            <Geant v={<>{Math.round(interpolate(t, [t25 - 0.3, t25 + 0.05], [20, 25], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}))}<span style={{fontSize: 180}}> €</span></>} couleur={C.alerte} taille={420}
              style={{left: 0, right: 0, textAlign: 'center', top: 700, transform: `translate(${tremble(22, t25)}px, ${tremble(10, t25 + 0.02)}px) scale(${mix(1.25, 1, sp(t, t25 - 0.05, fps, SPR.sec))})`}} />
            <Eclat t0={t25} x={540} y={880} n={18} r={460} couleurs={[C.alerte, '#fff', C.or]} taille={26} />
          </AbsoluteFill>
        ) : null}
      </Scene>

      {/* ===== 3 : trois barres (12 / 20 / 25) qui deviennent l'escalier des paliers ===== */}
      <Scene show={dans(3, 0, 0.12)} style={{transform: `scale(${mix(1, 6, p(t, S[4].start - 0.25, 0.37, E.inCubic))})`, transformOrigin: '280px 1100px', opacity: 1 - p(t, S[4].start - 0.05, 0.17)}}>
        {[12, 20, 25].map((v, i) => {
          const h = sp(t, S[3].start + 0.1 + i * 0.1, fps, SPR.pop) * v * 21;
          return (
            <div key={i} style={{position: 'absolute', left: 170 + i * 260, bottom: 640, width: 220, height: h, borderRadius: '24px 24px 6px 6px', background: i === 2 ? C.alerte : i === 1 ? C.accent : C.or, boxShadow: `0 0 60px ${[C.or, C.accent, C.alerte][i]}55`}}>
              <div style={{position: 'absolute', top: -96, left: 0, right: 0, textAlign: 'center', fontWeight: 900, fontStretch: '110%', fontSize: 74, color: C.texte}}>{v} €</div>
              <div style={{position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center', fontFamily: F.mono, fontWeight: 700, fontSize: 24, color: '#0b0b0f'}}>{['LUN.', 'JEU.', 'SUR PLACE'][i]}</div>
            </div>
          );
        })}
        <div style={{position: 'absolute', left: 90, top: 250, fontFamily: F.serif, fontStyle: 'italic', fontSize: 110, color: C.gris, opacity: p(t, S[3].start, 0.2)}}>pourquoi ?</div>
        {t > tPaliers - 0.1 ? (
          <div style={{position: 'absolute', left: 90, top: 380, fontWeight: 900, fontStretch: '125%', fontSize: 150, color: C.texte, clipPath: `inset(0 ${100 - p(t, tPaliers - 0.1, 0.35) * 100}% 0 0)`}}>LES PALIERS</div>
        ) : null}
        {/* reflet lumineux qui balaie les barres */}
        <div style={{position: 'absolute', top: 0, bottom: 0, width: 240, left: mix(-300, 1200, p(t, tPaliers, 0.8, E.inOut)), background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent)', transform: 'skewX(-18deg)'}} />
      </Scene>

      {/* ===== 4-6 : 100 billets ===== */}
      <Scene show={dans(4, 0) || dans(5) || dans(6, 0, 0.2)} style={{transform: `scale(${mix(2.2, 1, p(t, S[4].start, 0.55, E.outExpo)) * mix(1, 1.12, p(t, S[4].start + 0.6, S[6].end - S[4].start, E.linear))}) translate(${noise2D('gx', t * 0.3, 0) * 18}px, ${noise2D('gy', 0, t * 0.3) * 18 - mix(0, 40, p(t, S[4].start, S[6].end - S[4].start, E.linear))}px) rotateZ(${noise2D('gr', t * 0.2, 1) * 1.2}deg)`, opacity: p(t, S[4].start, 0.12)}}>
        {(() => {
          // Remplissage par paliers : 25 early bird, puis release 1, release 2, last.
          const fin6 = Math.max(tHeures, S[6].start + 0.6);
          // Les ventes avancent tout le temps (jamais d'écran figé), avec une accélération à chaque mot clé.
          const pts = [S[4].start + 0.3, tEarly + 0.3, tSuivant - 0.2, tSuivant + 0.5, S[6].start, fin6];
          for (let i = 1; i < pts.length; i++) pts[i] = Math.max(pts[i], pts[i - 1] + 0.05);
          const vendus = interpolate(t, pts, [0, 25, 30, 60, 66, 100], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.inOut});
          const palier = vendus < 25 ? 0 : vendus < 60 ? 1 : vendus < 85 ? 2 : 3;
          const PAL = [{n: 'EARLY BIRD', v: '12 €', c: C.or}, {n: 'RELEASE 1', v: '15 €', c: '#ffb347'}, {n: 'RELEASE 2', v: '18 €', c: C.accent}, {n: 'LAST RELEASE', v: '20 €', c: C.alerte}];
          const couleurPour = (i: number) => (i < 25 ? PAL[0].c : i < 60 ? PAL[1].c : i < 85 ? PAL[2].c : PAL[3].c);
          return (
            <>
              <div style={{position: 'absolute', left: 90, top: 220, display: 'flex', gap: 18, alignItems: 'center'}}>
                <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 30, color: '#0b0b0f', background: PAL[palier].c, padding: '10px 20px', borderRadius: 999, transform: `scale(${1 + 0.12 * clamp(1 - Math.abs(vendus % 25) / 2)})`}}>{PAL[palier].n}</div>
                <div style={{fontWeight: 900, fontStretch: '115%', fontSize: 80, color: C.texte}}>{PAL[palier].v}</div>
              </div>
              <div style={{position: 'absolute', left: 90, top: 340, width: 900, display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 14}}>
                {Array.from({length: 100}).map((_, i) => {
                  const on = i < vendus;
                  const pop = on ? clamp((vendus - i) * 2) : 0;
                  return <div key={i} style={{height: 56, borderRadius: 10, background: on ? couleurPour(i) : C.surface2, border: '1px solid rgba(255,255,255,.06)', transform: `scale(${on ? 0.86 + 0.14 * pop : 0.86}) rotate(${on ? 0 : (rnd(i) - 0.5) * 6}deg)`, boxShadow: on ? `0 0 18px ${couleurPour(i)}66` : 'none'}} />;
                })}
              </div>
              <div style={{position: 'absolute', left: 90, top: 1060, fontFamily: F.mono, fontWeight: 700, fontSize: 34, color: C.gris}}>{Math.round(vendus)} / 100 places vendues</div>
              {t > tHeures - 0.05 ? <div style={{position: 'absolute', left: 540, top: 700, transform: `translate(-50%,-50%) rotate(-10deg) scale(${mix(2.2, 1, sp(t, tHeures - 0.05, fps, SPR.sec))})`, fontWeight: 900, fontStretch: '110%', fontSize: 150, color: C.alerte, border: `14px solid ${C.alerte}`, borderRadius: 24, padding: '0 36px', background: '#07070bcc', opacity: clamp(p(t, tHeures - 0.05, 0.08))}}>SOLD OUT</div> : null}
            </>
          );
        })()}
      </Scene>

      {/* ===== 7 : la règle (s'ouvre depuis le tampon) ===== */}
      <Expansion t0={S[7].start - 0.05} x={540} y={700} couleur={C.accent}>
        {dans(7, 0.1, 0.3) ? (
          <>
            <div style={{position: 'absolute', left: 80, top: mix(560, 230, p(t, tPrends - 0.4, 0.4, E.inOut)), fontWeight: 900, fontStretch: '62%', fontSize: mix(260, 120, p(t, tPrends - 0.4, 0.4, E.inOut)), lineHeight: 0.9, color: '#0b0b0f', transform: `scale(${sp(t, S[7].start + 0.1, fps, SPR.pop)})`, transformOrigin: 'left center'}}>LA RÈGLE</div>
            <div style={{position: 'absolute', left: 90, top: mix(830, 370, p(t, tPrends - 0.4, 0.4, E.inOut)), fontFamily: F.serif, fontStyle: 'italic', fontSize: 110, color: '#0b0b0f', opacity: p(t, S[7].start + 0.6, 0.25)}}>la soirée te tente ?</div>
            {['TU PRENDS', 'TA PLACE', 'DIRECT.'].map((l, i) => (
              <div key={i} style={{position: 'absolute', left: 80, top: 560 + i * 200, overflow: 'hidden', height: 210}}>
                <div style={{fontWeight: 900, fontStretch: '62%', fontSize: 230, lineHeight: 0.9, color: i === 2 ? C.texte : '#0b0b0f', transform: `translateY(${(1 - p(t, tPrends - 0.1 + i * 0.12, 0.45)) * 100}%)`}}>{l}</div>
              </div>
            ))}
          </>
        ) : null}
      </Expansion>

      {/* ===== 8 : appel à commenter ===== */}
      <Scene show={t >= S[8].start - 0.05}>
        <AbsoluteFill style={{background: C.fond, clipPath: `circle(${p(t, S[8].start - 0.05, 0.4, E.outQuint) * 150}% at 50% 92%)`}}>
          <Plateau t={t} hx={540} hy={700} dx={0} dy={dy} />
          <div style={{position: 'absolute', left: 90, top: 250, fontFamily: F.mono, fontWeight: 700, fontSize: 32, letterSpacing: '0.16em', color: C.gris}}>ET TOI ?</div>
          {[{w: 'AVANCE', t0: tAvance, c: C.or, s: 'organisé'}, {w: 'ARRACHE', t0: tArrache, c: C.accent, s: 'dernière minute'}].map((b, i) => (
            <div key={i} style={{position: 'absolute', left: 90, top: 340 + i * 250, transform: `scale(${sp(t, b.t0 - 0.15, fps, SPR.pop)})`, transformOrigin: 'left center'}}>
              <div style={{fontWeight: 900, fontStretch: '115%', fontSize: 150, color: b.c, lineHeight: 1}}>{b.w}</div>
              <div style={{fontFamily: F.serif, fontStyle: 'italic', fontSize: 60, color: C.texte}}>si t'es {b.s}</div>
            </div>
          ))}
          <Commentaire texte="ARRACHE, évidemment 😅" t0={tArrache + 0.5} style={{left: 540, top: 1040, transform: `translate(-50%,-50%) translateY(${Math.sin(t * 3) * 8}px) scale(${sp(t, tArrache + 0.3, fps, SPR.pop)})`}} pseudo="ton pote" />
          <div style={{position: 'absolute', left: 540, top: 1160, transform: `translateX(-50%) translateY(${Math.abs(Math.sin(t * 5)) * 18}px)`, fontSize: 70, opacity: p(t, tArrache + 0.8, 0.3)}}>👇</div>
        </AbsoluteFill>
      </Scene>

      <Toast mots={spec.mots} cles={['stop', 'veille', 'paliers', 'early', 'bird', 'cher', 'direct', 'avance', 'arrache']} masquer={(x) => x < S[1].start - 0.1 || (x > S[7].start && x < S[8].start)} />
      <AbsoluteFill style={{pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,.6) 100%)'}} />
      <Grain force={0.05} />
      <BandeSon spec={spec} />
    </AbsoluteFill>
  );
};
