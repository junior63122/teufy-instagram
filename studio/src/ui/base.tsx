import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {noise2D} from '@remotion/noise';
import {E, clamp, mix, p, rnd, sp, SPR} from '../lib/anim';
import {F} from '../lib/fonts';
import type {Mot, Spec} from '../lib/types';

export const useT = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  return {t: frame / fps, frame, fps, W: width, H: height};
};

/** Caméra virtuelle : on déplace et zoome un « monde » plus grand que l'écran, avec un léger tremblé organique. */
export const Camera: React.FC<{x: number; y: number; z: number; r?: number; tremble?: number; children: React.ReactNode}> = ({x, y, z, r = 0, tremble = 0, children}) => {
  const {t, W, H} = useT();
  const tx = tremble ? noise2D('cx', t * 0.6, 0) * tremble : 0;
  const ty = tremble ? noise2D('cy', 0, t * 0.6) * tremble : 0;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: W / 2, top: H / 2, width: 0, height: 0, transform: `scale(${z}) rotate(${r}deg) translate(${-x + tx}px, ${-y + ty}px)`}}>{children}</div>
    </AbsoluteFill>
  );
};

/** Grain de film animé (bruit SVG) et vignettage. */
export const Grain: React.FC<{force?: number}> = ({force = 0.08}) => {
  const {frame} = useT();
  const seed = frame % 7;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'overlay', opacity: force}}>
      <svg width="100%" height="100%">
        <filter id={`g${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#g${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};
export const Vignette: React.FC<{force?: number}> = ({force = 0.55}) => (
  <AbsoluteFill style={{pointerEvents: 'none', background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,${force}) 100%)`}} />
);

/** Éclat de particules (confettis, étincelles) autour d'un point, à l'instant t0. */
export const Eclat: React.FC<{t0: number; x: number; y: number; n?: number; r?: number; couleurs?: string[]; taille?: number}> = ({t0, x, y, n = 14, r = 260, couleurs = ['#ff6b4a', '#ffd23f', '#ffffff'], taille = 22}) => {
  const {t} = useT();
  const k = (t - t0) / 0.9;
  if (k < 0 || k > 1) return null;
  const pr = E.outExpo(k);
  return (
    <div style={{position: 'absolute', left: x, top: y}}>
      {Array.from({length: n}).map((_, i) => {
        const a = (i / n) * Math.PI * 2 + rnd(i) * 0.6;
        const rr = r * (0.55 + rnd(i + 9) * 0.6) * pr;
        const s = taille * (0.5 + rnd(i + 3) * 0.7) * (1 - k * 0.7);
        const forme = i % 3;
        return (
          <div key={i} style={{position: 'absolute', left: Math.cos(a) * rr - s / 2, top: Math.sin(a) * rr - s / 2 + k * k * 120, width: s, height: forme === 1 ? s * 0.4 : s,
            borderRadius: forme === 0 ? '50%' : 3, background: couleurs[i % couleurs.length], opacity: 1 - k, transform: `rotate(${k * 300 + i * 40}deg)`}} />
        );
      })}
    </div>
  );
};

/** Tampon qui s'écrase (ARNAQUE ?, SOLD OUT…) avec ressort et légère rotation. */
export const Tampon: React.FC<{t0: number; texte: string; couleur?: string; taille?: number; rot?: number; style?: React.CSSProperties}> = ({t0, texte, couleur = '#ff3b30', taille = 120, rot = -8, style}) => {
  const {t, fps} = useT();
  if (t < t0) return null;
  const a = sp(t, t0, fps, SPR.sec);
  const s = mix(2.4, 1, a);
  return (
    <div style={{position: 'absolute', transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${s})`, opacity: clamp(a * 3), ...style}}>
      <div style={{fontFamily: F.wide, fontWeight: 900, fontStretch: '110%', fontSize: taille, color: couleur, border: `${taille * 0.07}px solid ${couleur}`, borderRadius: taille * 0.12,
        padding: `${taille * 0.05}px ${taille * 0.22}px`, letterSpacing: '0.02em', textTransform: 'uppercase', whiteSpace: 'nowrap', mixBlendMode: 'normal'}}>{texte}</div>
    </div>
  );
};

/** Sous-titres mot à mot : un groupe de mots à la fois, le mot prononcé surligné, mots clés dans une pastille. */
export const SousTitres: React.FC<{mots: Mot[]; y?: number; cles?: string[]; couleur?: string; accent?: string; taille?: number; style?: 'pastille' | 'contour'}> = ({mots, y = 1240, cles = [], couleur = '#fff', accent = '#ff6b4a', taille = 64, style = 'pastille'}) => {
  const {t} = useT();
  // Groupes de 1 à 4 mots, coupés à la ponctuation, comme on lit.
  const groupes: Mot[][] = [];
  let g: Mot[] = [];
  mots.forEach((m, i) => {
    g.push(m);
    const fin = /[.,!?:;…]$/.test(m.w) || g.length >= 4 || (mots[i + 1] && mots[i + 1].start - m.end > 0.35) || (mots[i + 1] && mots[i + 1].scene !== m.scene);
    if (fin) { groupes.push(g); g = []; }
  });
  if (g.length) groupes.push(g);
  const gi = groupes.findIndex((gr, i) => t >= gr[0].start - 0.05 && (i === groupes.length - 1 || t < groupes[i + 1][0].start - 0.05));
  if (gi < 0) return null;
  const gr = groupes[gi];
  if (t > gr[gr.length - 1].end + 0.6) return null;
  const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
  return (
    <div style={{position: 'absolute', left: 80, right: 140, top: y, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 0.28em', fontFamily: F.wide, fontWeight: 850, fontStretch: '100%', fontSize: taille, lineHeight: 1.15, textAlign: 'center'}}>
      {gr.map((m, i) => {
        const on = t >= m.start - 0.04;
        const a = p(t, m.start - 0.06, 0.22, E.outBack);
        const cle = cles.includes(norm(m.w));
        const actif = t >= m.start - 0.04 && t < m.end + 0.05;
        return (
          <span key={i} style={{display: 'inline-block', opacity: on ? 1 : 0.0, transform: `translateY(${(1 - a) * 18}px) scale(${0.9 + 0.1 * a})`,
            color: cle && style === 'pastille' ? '#0b0b0f' : actif ? accent : couleur,
            background: cle && style === 'pastille' ? accent : 'transparent', borderRadius: 14, padding: cle && style === 'pastille' ? '0 0.18em' : 0,
            WebkitTextStroke: style === 'contour' ? '10px #000' : undefined, paintOrder: 'stroke fill',
            textShadow: style === 'pastille' && !cle ? '0 4px 18px rgba(0,0,0,.55)' : undefined}}>{m.w}</span>
        );
      })}
    </div>
  );
};

/** Bande son : voix, musique (baissée sous la voix), bande préparée, bruitages placés à la seconde. */
export const BandeSon: React.FC<{spec: Spec}> = ({spec}) => {
  const {fps} = useVideoConfig();
  const parle = (s: number) => spec.mots.some((m) => s >= m.start - 0.15 && s <= m.end + 0.25);
  return (
    <>
      {spec.voix ? <Audio src={staticFile(spec.voix.src)} volume={spec.voix.volume ?? 1} /> : null}
      {spec.bande ? <Audio src={staticFile(spec.bande.src)} volume={spec.bande.volume ?? 1} /> : null}
      {spec.musique ? (
        <Audio src={staticFile(spec.musique.src)} startFrom={Math.round((spec.musique.debut ?? 0) * fps)}
          volume={(f) => {
            const s = f / fps;
            const base = spec.musique!.volume ?? 0.5;
            const fin = clamp((spec.duree - s) / 1.2);
            return base * (parle(s) ? spec.musique!.ducking ?? 0.35 : 1) * fin;
          }} />
      ) : null}
      {(spec.bruits || []).map((b, i) => (
        <Sequence key={i} from={Math.max(0, Math.round(b.at * fps))} layout="none">
          <Audio src={staticFile(b.src)} volume={b.volume ?? 0.6} />
        </Sequence>
      ))}
    </>
  );
};

/** Texte qui monte d'un masque, mot par mot, synchronisé sur des instants donnés. */
export const MotsMasques: React.FC<{mots: {w: string; t: number; accent?: boolean}[]; taille: number; famille?: string; poids?: number; largeur?: string; couleur?: string; accent?: string; style?: React.CSSProperties; italiqueAccent?: boolean}> = ({mots, taille, famille = F.wide, poids = 900, largeur = '125%', couleur = '#fff', accent = '#ff6b4a', style, italiqueAccent = false}) => {
  const {t} = useT();
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', gap: `0 ${taille * 0.24}px`, ...style}}>
      {mots.map((m, i) => {
        const a = p(t, m.t, 0.55, E.outExpo);
        return (
          <span key={i} style={{display: 'inline-block', overflow: 'hidden', padding: '0.08em 0.04em', margin: '-0.08em -0.04em'}}>
            <span style={{display: 'inline-block', transform: `translateY(${(1 - a) * 110}%)`, fontFamily: m.accent && italiqueAccent ? F.serif : famille, fontStyle: m.accent && italiqueAccent ? 'italic' : 'normal',
              fontWeight: m.accent && italiqueAccent ? 400 : poids, fontStretch: largeur, fontSize: taille, lineHeight: 0.95, color: m.accent ? accent : couleur, textTransform: m.accent && italiqueAccent ? 'none' : 'uppercase'}}>{m.w}</span>
          </span>
        );
      })}
    </div>
  );
};

/** Mots du script de la scène n°k, avec leurs instants. */
export const motsScene = (spec: Spec, k: number) => spec.mots.filter((m) => m.scene === k);
/** Instant où un mot est prononcé (premier mot qui commence par `w` dans la scène k, ou à partir de `apres`). */
export const quand = (spec: Spec, w: string, k?: number, apres = 0) => {
  const n = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
  const m = spec.mots.find((x) => (k == null || x.scene === k) && x.start >= apres - 0.001 && n(x.w).startsWith(n(w)));
  return m ? m.start : k != null ? spec.scenes[k]?.start ?? 0 : 0;
};
