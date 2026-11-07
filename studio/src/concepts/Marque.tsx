import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile} from 'remotion';
import {evolvePath} from '@remotion/paths';
import {noise2D} from '@remotion/noise';
import {BandeSon, Grain, useT} from '../ui/base';
import {E, clamp, mix, p, rnd} from '../lib/anim';
import {F} from '../lib/fonts';
import type {Spec} from '../lib/types';

// Film de marque « la Côte s'allume » : sans voix, monté sur les temps de la musique, en un seul plan.
// Grammaire des films de marque qui marchent : noir + halo de la couleur de marque, traînée de lumière
// dès la 1re image, carte survolée en 3D où les villes s'allument sur les temps, plongée, mots qui
// claquent avec flou de mouvement, mur de tuiles, logo qui naît de la lumière.

const BPM = 123.8;
const b = 60 / BPM;
const B = (n: number) => n * b;
const C = {noir: '#050409', corail: '#ff6b4a', rose: '#ff4fa3', or: '#ffd23f', violet: '#7b5cff', bleu: '#3a86ff', creme: '#fff4ea'};

// Côte d'Azur stylisée (Menton → Saint-Tropez), en coordonnées « carte » (1000 × 1000).
const COTE = 'M1010 120 L960 150 L925 190 L880 205 L835 222 L790 235 L755 245 L715 300 L690 360 L655 395 L625 430 L590 440 L545 470 L505 480 L460 520 L400 575 L330 640 L270 690 L230 760 L170 830 L140 920 L100 980';
const VILLES = [
  {nom: 'MENTON', x: 985, y: 135, b: 6},
  {nom: 'MONACO', x: 922, y: 190, b: 7},
  {nom: 'NICE', x: 760, y: 242, b: 8},
  {nom: 'ANTIBES', x: 625, y: 432, b: 10},
  {nom: 'CANNES', x: 510, y: 480, b: 12},
  {nom: 'ST-TROPEZ', x: 145, y: 925, b: 14},
];
const STYLES = [
  {w: 'TECHNO', c: C.violet}, {w: 'AFRO', c: C.or}, {w: 'HOUSE', c: C.corail}, {w: 'SHATTA', c: C.rose},
  {w: 'RAP', c: C.bleu}, {w: 'AMAPIANO', c: C.or}, {w: 'DISCO', c: C.rose}, {w: 'R&B', c: C.violet},
];

/** Mot qui arrive avec un flou de mouvement directionnel, tient, et repart. */
const MotFlou: React.FC<{t0: number; t1: number; children: React.ReactNode; taille?: number; couleur?: string; dir?: 1 | -1; serif?: boolean; y?: number}> = ({t0, t1, children, taille = 220, couleur = C.creme, dir = 1, serif, y = 860}) => {
  const {t} = useT();
  if (t < t0 - 0.05 || t > t1 + 0.2) return null;
  const a = p(t, t0, 0.22, E.outExpo);
  const s = p(t, t1, 0.2, E.inCubic);
  const x = (1 - a) * 260 * dir - s * 260 * dir;
  const flou = (1 - a) * 26 + s * 26;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', transform: `translateX(${x}px) scaleX(${1 + flou / 120})`, filter: `blur(${flou}px)`, opacity: clamp(a * 2) * (1 - s),
      fontFamily: serif ? F.serif : F.wide, fontStyle: serif ? 'italic' : 'normal', fontWeight: serif ? 400 : 900, fontStretch: '110%', fontSize: taille, lineHeight: 1, color: couleur, letterSpacing: serif ? 0 : '-0.02em',
      textShadow: `0 0 40px ${couleur}66`}}>{children}</div>
  );
};

export const Marque: React.FC<{spec: Spec}> = ({spec}) => {
  const {t, fps} = useT();

  // --- caméra sur la carte (plan 1 → 2) ---
  const tracé = p(t, -0.25, B(5), E.inOut); // la traînée dessine la côte dès la 1re image
  const plonge = p(t, B(16), B(2.2), E.inCubic); // plongée sur Nice
  const incl = mix(10, 38, p(t, B(3), B(4), E.inOut));
  const zoom = mix(2.4, 1.7, p(t, 0, B(6), E.inOut)) * mix(1, 9, plonge);
  const carteVisible = t < B(18.3);
  const ev = evolvePath(tracé, COTE);
  const pointTrainee: number[] = (() => { const k = Math.min(1, tracé); const pts = COTE.slice(1).split(' L').map((s) => s.split(' ').map(Number)); const i = Math.min(pts.length - 2, Math.floor(k * (pts.length - 1))); const f = k * (pts.length - 1) - i; return [mix(pts[i][0], pts[i + 1][0], f), mix(pts[i][1], pts[i + 1][1], f)]; })();

  // Caméra : suit la traînée qui dessine la côte, puis glisse de ville en ville sur les temps.
  const cibles = VILLES.map((v) => [B(v.b), v.x, v.y] as const);
  const [camX, camY] = (() => {
    if (t < B(6)) return [pointTrainee[0], pointTrainee[1]];
    const pts: [number, number, number][] = [[B(6) - 0.01, pointTrainee[0], pointTrainee[1]], ...cibles.map((c) => [c[0] - 0.35, c[1], c[2]] as [number, number, number]), [B(16), 760, 242]];
    for (let i = 0; i < pts.length - 1; i++) if (t < pts[i + 1][0]) { const f = E.inOut(clamp((t - pts[i][0]) / (pts[i + 1][0] - pts[i][0]))); return [mix(pts[i][1], pts[i + 1][1], f), mix(pts[i][2], pts[i + 1][2], f)]; }
    return [760, 242];
  })();

  // --- éclairs sur les temps forts ---
  const flashs = [B(4), B(18), B(26), B(32)].map((t0) => (t >= t0 && t < t0 + 0.18 ? 1 - (t - t0) / 0.18 : 0));
  const flash = Math.max(...flashs);
  const pulse = Math.pow(1 - ((t / b) % 1), 3); // battement de la musique

  return (
    <AbsoluteFill style={{background: C.noir, fontFamily: F.wide, overflow: 'hidden'}}>
      {/* halo de marque qui respire sur le temps */}
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% ${mix(40, 55, p(t, 0, 20))}%, ${C.corail}${Math.round(20 + 22 * pulse).toString(16).padStart(2, '0')} 0%, transparent 55%)`}} />

      {/* ===== PLAN 1-2 : la Côte dessinée par la lumière, puis survolée ===== */}
      {carteVisible ? (
        <AbsoluteFill style={{perspective: 1400, opacity: 1 - p(t, B(18), 0.25)}}>
          <div style={{position: 'absolute', left: 540, top: 1180, width: 0, height: 0, transform: `rotateX(${incl}deg) scale(${zoom})`, transformStyle: 'preserve-3d'}}>
            <div style={{position: 'absolute', left: -camX, top: -camY, width: 1000, height: 1000}}>
              {/* grille au sol + lignes de lumière (routes) */}
              <svg width={1000} height={1000} style={{position: 'absolute', overflow: 'visible'}}>
                {Array.from({length: 26}).map((_, i) => <line key={`h${i}`} x1={-400} x2={1400} y1={i * 50 - 150} y2={i * 50 - 150} stroke="#ffffff" strokeOpacity={0.05} />)}
                {Array.from({length: 36}).map((_, i) => <line key={`v${i}`} y1={-300} y2={1300} x1={i * 50 - 400} x2={i * 50 - 400} stroke="#ffffff" strokeOpacity={0.05} />)}
                {/* la mer, côté sud-est */}
                {/* routes de lumière qui partent des villes (traînées) */}
                {VILLES.flatMap((v, i) => Array.from({length: 4}).map((_, k) => {
                  const a = rnd(i * 7 + k) * Math.PI - Math.PI * 0.95;
                  const L = 160 + rnd(i * 3 + k) * 220;
                  const on = p(t, B(v.b) + k * 0.06, 0.6, E.outExpo);
                  return <line key={`${i}-${k}`} x1={v.x} y1={v.y} x2={v.x + Math.cos(a) * L * on} y2={v.y + Math.sin(a) * L * on} stroke={[C.corail, C.or, C.rose][k % 3]} strokeWidth={2.5} strokeOpacity={0.75} style={{filter: 'drop-shadow(0 0 6px #ff6b4a)'}} />;
                }))}
                {/* la côte qui se dessine */}
                <path d={COTE} fill="none" stroke={C.corail} strokeWidth={6} strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} style={{filter: 'drop-shadow(0 0 10px #ff6b4a) drop-shadow(0 0 30px #ff6b4a)'}} />
                {tracé < 1 ? <circle cx={pointTrainee[0]} cy={pointTrainee[1]} r={14} fill="#fff" style={{filter: 'drop-shadow(0 0 20px #fff) drop-shadow(0 0 50px #ff6b4a)'}} /> : null}
                {/* villes qui s'allument sur les temps */}
                {VILLES.map((v, i) => {
                  const on = p(t, B(v.b), 0.4, E.outExpo);
                  const halo = Math.pow(1 - clamp((t - B(v.b)) / 0.6), 2);
                  return (
                    <g key={i} opacity={on}>
                      <circle cx={v.x} cy={v.y} r={60 * halo + 12} fill={C.or} opacity={0.25 + 0.5 * halo} style={{filter: 'blur(6px)'}} />
                      {Array.from({length: 14}).map((_, k) => <circle key={k} cx={v.x + (rnd(i * 31 + k) - 0.5) * 70} cy={v.y + (rnd(i * 17 + k) - 0.5) * 50} r={2 + rnd(k + i) * 3} fill="#fff4c7" opacity={0.5 + 0.5 * Math.sin(t * 6 + k)} />)}
                      <circle cx={v.x} cy={v.y} r={9} fill="#fff" />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
          {/* étiquettes des villes (restent droites, face caméra) */}
          {VILLES.map((v, i) => {
            const fin = i + 1 < VILLES.length ? B(VILLES[i + 1].b) : B(16);
            return <MotFlou key={i} t0={B(v.b)} t1={fin - 0.12} taille={Math.min(190, 900 / (v.nom.length * 0.72))} y={330} dir={i % 2 ? -1 : 1}>{v.nom}</MotFlou>;
          })}
        </AbsoluteFill>
      ) : null}

      {/* accroche, à l'écran dès la 1re image */}
      <MotFlou t0={-0.2} t1={B(3.6)} taille={150} y={1240}>CE SOIR,</MotFlou>
      <MotFlou t0={B(0.9)} t1={B(3.6)} taille={150} y={1400} serif couleur={C.corail}>la côte s'allume.</MotFlou>

      {/* ===== PLAN 3 : les styles, un par temps ===== */}
      {t >= B(18) && t < B(26.2) ? (() => {
        const k = Math.min(STYLES.length - 1, Math.floor((t - B(18)) / b));
        const s = STYLES[k];
        const local = (t - B(18 + k)) / b;
        return (
          <AbsoluteFill style={{background: `radial-gradient(circle at 50% 50%, ${s.c}55 0%, ${C.noir} 65%)`}}>
            {/* particules tirées vers le centre */}
            {Array.from({length: 40}).map((_, i) => {
              const a = rnd(i + k * 50) * Math.PI * 2, r = mix(900, 120, E.outExpo(clamp(local * 1.3))) * (0.6 + rnd(i * 3) * 0.6);
              return <div key={i} style={{position: 'absolute', left: 540 + Math.cos(a) * r, top: 960 + Math.sin(a) * r, width: 6, height: 30 + rnd(i) * 50, background: s.c, opacity: 0.7 * (1 - local), transform: `rotate(${(a * 180) / Math.PI + 90}deg)`, borderRadius: 4, filter: 'blur(1px)'}} />;
            })}
            <div style={{position: 'absolute', left: 0, right: 0, top: 820, textAlign: 'center', fontWeight: 900, fontStretch: '100%', fontSize: Math.min(220, 920 / (s.w.length * 0.78)), color: C.creme, lineHeight: 1,
              transform: `scale(${mix(1.35, 1, E.outExpo(clamp(local * 2.5)))})`, filter: `blur(${(1 - E.outExpo(clamp(local * 3))) * 18}px)`, textShadow: `0 0 50px ${s.c}, 0 0 120px ${s.c}88`}}>{s.w}</div>
            <div style={{position: 'absolute', left: 0, right: 0, top: 1100, textAlign: 'center', fontFamily: F.mono, fontWeight: 700, fontSize: 30, letterSpacing: '0.3em', color: s.c}}>{String(k + 1).padStart(2, '0')} / {String(STYLES.length).padStart(2, '0')}</div>
          </AbsoluteFill>
        );
      })() : null}

      {/* ===== PLAN 4 : mur de tuiles, « toutes les soirées » ===== */}
      {t >= B(26) && t < B(32.3) ? (() => {
        const z = mix(3.2, 0.85, p(t, B(26), B(5), E.outQuint));
        return (
          <AbsoluteFill style={{perspective: 1800}}>
            <div style={{position: 'absolute', left: 540, top: 960, width: 0, height: 0, transform: `rotateX(18deg) rotateZ(-8deg) scale(${z})`}}>
              {Array.from({length: 13 * 9}).map((_, i) => {
                const col = i % 13, row = Math.floor(i / 13);
                const st = STYLES[(i * 7) % STYLES.length];
                const allume = t > B(26) + rnd(i) * B(4);
                return (
                  <div key={i} style={{position: 'absolute', left: (col - 6.5) * 170, top: (row - 4.5) * 220 + (col % 2) * 60, width: 150, height: 200, borderRadius: 18, overflow: 'hidden',
                    background: allume ? `linear-gradient(160deg, ${st.c}, ${C.noir})` : '#15131f', boxShadow: allume ? `0 0 30px ${st.c}55` : 'none', border: '1px solid rgba(255,255,255,.08)'}}>
                    <div style={{position: 'absolute', left: 12, bottom: 12, fontFamily: F.mono, fontWeight: 700, fontSize: 16, color: '#fff', opacity: allume ? 0.9 : 0.2}}>{st.w}</div>
                  </div>
                );
              })}
            </div>
            <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(5,4,9,.85) 75%)'}} />
          </AbsoluteFill>
        );
      })() : null}
      <MotFlou t0={B(27)} t1={B(29.4)} taille={130} y={820}>TOUTES</MotFlou>
      <MotFlou t0={B(27.5)} t1={B(29.4)} taille={130} y={960}>LES SOIRÉES.</MotFlou>
      {t > B(29.4) && t < B(32) ? <AbsoluteFill style={{background: 'rgba(5,4,9,.55)'}} /> : null}
      <MotFlou t0={B(29.6)} t1={B(31.8)} taille={130} y={880} serif couleur={C.creme} dir={-1}>au même endroit.</MotFlou>

      {/* ===== PLAN 5 : le logo naît de la lumière ===== */}
      {t >= B(31.6) ? (() => {
        const a = p(t, B(32), 0.9, E.outExpo);
        const balayage = mix(-400, 1500, p(t, B(32), 1.1, E.inOut));
        return (
          <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
            {/* traînée horizontale qui révèle le logo */}
            <div style={{position: 'absolute', top: 900, left: balayage - 600, width: 1200, height: 6, background: `linear-gradient(90deg, transparent, #fff, ${C.corail}, transparent)`, filter: 'blur(2px) drop-shadow(0 0 20px #ff6b4a)'}} />
            <div style={{position: 'relative', clipPath: `inset(0 ${100 - clamp((balayage - 300) / 480) * 100}% 0 0)`, transform: `scale(${mix(1.2, 1, a)})`, filter: `drop-shadow(10px 10px 0 ${C.corail}) drop-shadow(0 0 ${40 * (1 - a) + 10}px ${C.corail})`}}>
              <Img src={staticFile('logo.png')} style={{height: 260}} />
            </div>
            <div style={{marginTop: 70, fontFamily: F.mono, fontWeight: 700, fontSize: 42, letterSpacing: '0.18em', color: C.creme, opacity: p(t, B(34), 0.5)}}>@TEUFY_OFFICIAL</div>
            <div style={{marginTop: 18, fontFamily: F.serif, fontStyle: 'italic', fontSize: 70, color: C.corail, opacity: p(t, B(35), 0.5)}}>les soirées de la côte</div>
          </AbsoluteFill>
        );
      })() : null}

      <AbsoluteFill style={{background: '#fff', opacity: flash * 0.45, pointerEvents: 'none'}} />
      <AbsoluteFill style={{pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,.7) 100%)'}} />
      <Grain force={0.06} />
      <BandeSon spec={spec} />
    </AbsoluteFill>
  );
};
