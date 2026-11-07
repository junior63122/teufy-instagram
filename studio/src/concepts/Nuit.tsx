import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile} from 'remotion';
import {BandeSon, Grain, useT} from '../ui/base';
import {E, clamp, mix, p} from '../lib/anim';
import {F} from '../lib/fonts';
import type {Spec} from '../lib/types';

// Concept « immersif » : un court film d'ambiance, sans voix, monté sur les temps de la musique.
// Format cinéma (bandes noires) étouffé comme derrière une porte, puis la porte s'ouvre : la vidéo
// joue à l'intérieur des lettres de NUIT, on plonge dans la lettre, coupes sur les temps, ralentis.
// Rien n'indique un lieu ou un événement précis : ce sont des images d'illustration.

const BPM = 118.1;
const b = 60 / BPM;
const PORTE = 12 * b;

type Plan = {src: string; de: number; a: number; debut?: number; vitesse?: number; zoom?: [number, number]; filtre?: string; pan?: [number, number]};
const PLANS: Plan[] = [
  {src: 'rushes/4344.mp4', de: 0, a: 6 * b, zoom: [1.0, 1.14], filtre: 'grayscale(0.7) brightness(0.72) contrast(1.15)', debut: 1},
  {src: 'rushes/4187.mp4', de: 6 * b, a: PORTE, vitesse: 0.5, zoom: [1.08, 1.0], filtre: 'grayscale(0.55) brightness(0.75) contrast(1.2)'},
  {src: 'rushes/4188.mp4', de: PORTE, a: 16 * b, zoom: [1.25, 1.0], filtre: 'saturate(1.35) contrast(1.12)'},
  {src: 'rushes/834.mp4', de: 16 * b, a: 20 * b, zoom: [1.18, 1.0], filtre: 'saturate(1.3) contrast(1.1) hue-rotate(-10deg)', pan: [-40, 40]},
  {src: 'rushes/46896.mp4', de: 20 * b, a: 24 * b, zoom: [1.0, 1.12], filtre: 'saturate(1.25) contrast(1.1)'},
  {src: 'rushes/830.mp4', de: 24 * b, a: 26 * b, zoom: [1.3, 1.05], filtre: 'saturate(1.4) contrast(1.2)'},
  {src: 'rushes/40105.mp4', de: 26 * b, a: 28 * b, zoom: [1.2, 1.0], filtre: 'saturate(1.3) contrast(1.15)', debut: 3},
  {src: 'rushes/4188.mp4', de: 28 * b, a: 30 * b, zoom: [1.35, 1.05], filtre: 'saturate(1.4) contrast(1.2)', debut: 5},
  {src: 'rushes/46893.mp4', de: 30 * b, a: 37 * b, vitesse: 0.5, zoom: [1.0, 1.1], filtre: 'saturate(1.15) contrast(1.05)', debut: 2},
  {src: 'rushes/42299.mp4', de: 37 * b, a: 41 * b, vitesse: 0.6, zoom: [1.05, 1.15], filtre: 'saturate(1.1)', debut: 1},
];
const FIN = 41 * b;

/** Un plan vidéo : recadrage, zoom lent ou punch, panoramique, étalonnage, « filé » à la coupe. */
const PlanVideo: React.FC<{pl: Plan}> = ({pl}) => {
  const {t, fps} = useT();
  const k = clamp((t - pl.de) / (pl.a - pl.de));
  const z = mix(pl.zoom?.[0] ?? 1, pl.zoom?.[1] ?? 1, E.outQuint(k));
  const x = pl.pan ? mix(pl.pan[0], pl.pan[1], k) : 0;
  const entree = clamp((t - pl.de) / 0.1);
  const file = (1 - entree) * 40;
  return (
    <Sequence from={Math.round(pl.de * fps)} durationInFrames={Math.max(1, Math.round((pl.a - pl.de) * fps))} layout="none">
      <AbsoluteFill style={{transform: `scale(${z}) translateX(${x + file * 4}px)`, filter: `${pl.filtre ?? ''} ${file > 1 ? `blur(${file}px)` : ''}`}}>
        <OffthreadVideo src={staticFile(pl.src)} muted playbackRate={pl.vitesse ?? 1} startFrom={Math.round((pl.debut ?? 0) * fps)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      </AbsoluteFill>
    </Sequence>
  );
};

/** Mots qui apparaissent sur un temps, accrochés au mouvement de l'image (dérive lente). */
const MotTemps: React.FC<{t0: number; t1: number; children: React.ReactNode; x: number; y: number; derive?: [number, number]; taille?: number; serif?: boolean}> = ({t0, t1, children, x, y, derive = [0, -30], taille = 150, serif = false}) => {
  const {t} = useT();
  if (t < t0 || t > t1) return null;
  const a = p(t, t0, 0.35, E.outExpo);
  const k = (t - t0) / (t1 - t0);
  return (
    <div style={{position: 'absolute', left: x + derive[0] * k, top: y + derive[1] * k, transform: `translateY(${(1 - a) * 40}px)`, opacity: a * (1 - p(t, t1 - 0.15, 0.15)), filter: `blur(${(1 - a) * 10}px)`,
      fontFamily: serif ? F.serif : F.wide, fontStyle: serif ? 'italic' : 'normal', fontWeight: serif ? 400 : 900, fontStretch: '125%', fontSize: taille, color: '#fff', lineHeight: 0.95, textTransform: serif ? 'none' : 'uppercase',
      textShadow: '0 6px 40px rgba(0,0,0,.6)'}}>{children}</div>
  );
};

export const Nuit: React.FC<{spec: Spec}> = ({spec}) => {
  const {t, fps} = useT();
  // Bandes « cinéma » : présentes avant la porte, elles s'ouvrent d'un coup quand la musique éclate.
  const bande = t < PORTE ? 300 : mix(300, 0, p(t, PORTE, 0.35, E.outExpo));
  // Le mot NUIT rempli de vidéo, puis on plonge à travers la lettre « U ».
  const motDebut = PORTE, plonge = PORTE + 2 * b;
  const zMot = t < plonge ? mix(0.85, 1, p(t, motDebut, 0.5)) : mix(1, 16, p(t, plonge, 0.55, E.inOut));
  const montrerMot = t >= motDebut && t < plonge + 0.55;
  const flash = t >= PORTE - 0.02 && t < PORTE + 0.25 ? 1 - (t - PORTE) / 0.25 : 0;
  const sec = 12 + Math.floor(t);
  // Fuites de lumière sur les temps forts.
  const fuites = [PORTE, 16 * b, 24 * b, 30 * b].map((t0) => clamp(1 - Math.abs(t - t0 - 0.25) / 0.6));
  const fuite = Math.max(...fuites);

  return (
    <AbsoluteFill style={{background: '#000'}}>
      {/* les plans (sauf pendant le mot masqué, où la vidéo n'existe que dans les lettres) */}
      <AbsoluteFill style={{opacity: montrerMot && t < plonge + 0.2 ? 0 : 1}}>
        {PLANS.map((pl, i) => <PlanVideo key={i} pl={pl} />)}
      </AbsoluteFill>

      {montrerMot ? (
        <AbsoluteFill style={{transform: `scale(${zMot})`, transformOrigin: '50% 50%', opacity: t > plonge + 0.35 ? 1 - p(t, plonge + 0.35, 0.2) : 1}}>
          <OffthreadVideo src={staticFile('rushes/4188.mp4')} muted startFrom={Math.round(2 * fps)} style={{position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(1.5) contrast(1.2) brightness(1.25)'}} />
          {/* calque noir avec le mot en blanc, en « produit » : la vidéo n'apparaît que dans les lettres */}
          <AbsoluteFill style={{background: '#000', mixBlendMode: 'multiply', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{fontFamily: F.wide, fontWeight: 900, fontStretch: '62%', fontSize: 500, lineHeight: 0.8, color: '#fff', letterSpacing: '-0.02em'}}>NUIT</div>
          </AbsoluteFill>
        </AbsoluteFill>
      ) : null}

      {/* textes */}
      <MotTemps t0={0.5} t1={3 * b * 2 - 0.1} x={90} y={820} serif taille={120}>il est 23h47.</MotTemps>
      <MotTemps t0={6 * b + 0.2} t1={PORTE - 0.7} x={90} y={820} serif taille={120}>la ville ralentit.</MotTemps>
      <MotTemps t0={PORTE - 0.62} t1={PORTE - 0.02} x={90} y={820} serif taille={140}>nous, non.</MotTemps>
      <MotTemps t0={16 * b} t1={18 * b} x={90} y={620} derive={[40, -20]}>on</MotTemps>
      <MotTemps t0={18 * b} t1={20 * b} x={90} y={620} derive={[40, -20]}>sort</MotTemps>
      <MotTemps t0={20 * b} t1={24 * b} x={90} y={620} derive={[-30, -40]} taille={170}>ce soir.</MotTemps>
      <MotTemps t0={30 * b + 0.3} t1={37 * b - 0.1} x={90} y={1060} serif taille={96}>les meilleures nuits<br />ne se racontent pas.</MotTemps>
      <MotTemps t0={37 * b + 0.2} t1={FIN - 0.1} x={90} y={1060} serif taille={110}>elles se vivent.</MotTemps>

      {/* lumière */}
      <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'screen', opacity: fuite * 0.85,
        background: `radial-gradient(ellipse at ${30 + fuite * 40}% 40%, rgba(255,120,60,.9), rgba(255,60,140,.35) 35%, transparent 65%)`}} />
      <AbsoluteFill style={{background: '#fff', opacity: flash * 0.9, pointerEvents: 'none'}} />

      {/* bandes cinéma + compteur */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: bande, background: '#000'}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: bande, background: '#000'}} />
      {t < PORTE ? (
        <div style={{position: 'absolute', left: 90, top: 200, fontFamily: F.mono, fontWeight: 700, fontSize: 34, color: '#ffffffcc', letterSpacing: '0.12em'}}>
          <span style={{color: '#ff3b30', opacity: Math.floor(t * 2) % 2 ? 1 : 0.2}}>●</span> 23:47:{String(sec).padStart(2, '0')}
        </div>
      ) : null}

      {/* carton de fin */}
      {t >= FIN ? (
        <AbsoluteFill style={{background: '#050505', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{position: 'relative', opacity: p(t, FIN, 0.4)}}>
            <Img src={staticFile('logo.png')} style={{height: 210, transform: `scale(${mix(1.25, 1, p(t, FIN, 0.8, E.outExpo))})`, filter: `drop-shadow(${mix(0, 8, p(t, FIN + 0.2, 0.4))}px ${mix(0, 8, p(t, FIN + 0.2, 0.4))}px 0 #ff6b4a) drop-shadow(0 0 ${30 * (1 - p(t, FIN, 1))}px #ffffff)`}} />
          </div>
          <div style={{marginTop: 50, fontFamily: F.mono, fontWeight: 700, fontSize: 40, color: '#fff', letterSpacing: '0.1em', opacity: p(t, FIN + 0.4, 0.5)}}>@TEUFY_OFFICIAL</div>
          <div style={{marginTop: 16, fontFamily: F.serif, fontStyle: 'italic', fontSize: 64, color: '#ff6b4a', opacity: p(t, FIN + 0.7, 0.5)}}>les soirées de la côte</div>
        </AbsoluteFill>
      ) : null}

      <AbsoluteFill style={{pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 45%, transparent 50%, rgba(0,0,0,.65) 100%)'}} />
      <Grain force={0.12} />
      <BandeSon spec={spec} />
    </AbsoluteFill>
  );
};
