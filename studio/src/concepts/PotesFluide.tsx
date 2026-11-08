import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {BandeSon, Eclat, Grain, SousTitres, quand, useT} from '../ui/base';
import {Commentaire, Perso, Telephone} from '../ui/illus';
import type {Look} from '../ui/illus';
import {E, SPR, clamp, mix, p, rnd, sp} from '../lib/anim';
import {F} from '../lib/fonts';
import type {Spec} from '../lib/types';

// « Les 4 potes qu'on a tous en soirée », en UN SEUL PLAN : les quatre sont côte à côte dans le même club.
// La caméra part du groupe, plonge sur le 1er, glisse de l'un à l'autre (avec profondeur : premier plan
// plus rapide que le fond), fait ses zooms « dramatiques » elle-même, et se retire sur le groupe à la fin.
// Aucune coupe, aucun fondu : les scènes s'enchaînent par le mouvement.

const K = {noir: '#111', jaune: '#ffd60a', bleu: '#3a86ff', rose: '#ff4d9d', vert: '#2ec27e', orange: '#ff7a1a', creme: '#fff4e0', violet: '#7b2cff'};
const TRAIT = {trait: K.noir, epaisseur: 9};
const POTES: Look[] = [
  {peau: '#f2c09b', cheveux: '#3b2416', haut: K.bleu, coiffure: 'court', ...TRAIT},
  {peau: '#c98b62', cheveux: '#111', haut: K.vert, coiffure: 'casquette', ...TRAIT},
  {peau: '#8d5a3b', cheveux: '#1a1a1a', haut: K.jaune, coiffure: 'bouclé', ...TRAIT},
  {peau: '#f6d1b3', cheveux: '#b5532c', haut: K.rose, coiffure: 'long', lunettes: true, ...TRAIT},
];
const DJ: Look = {peau: '#e0a77f', cheveux: '#222', haut: '#222', coiffure: 'rasé', lunettes: true, ...TRAIT};
const COULEURS = [K.bleu, K.vert, K.orange, K.rose];
const ZONE = 900; // écart entre deux potes dans le monde
const xZone = (k: number) => k * ZONE;
const ETIQ = ['« je reste une heure »', 'celui qui demande SA musique', 'celui qui disparaît', '« bien rentré ? »'];

type Cam = {x: number; y: number; z: number};
const mixCam = (a: Cam, b: Cam, f: number): Cam => ({x: mix(a.x, b.x, f), y: mix(a.y, b.y, f), z: mix(a.z, b.z, f)});

export const PotesFluide: React.FC<{spec: Spec}> = ({spec}) => {
  const {t, fps} = useT();
  const S = spec.scenes;
  const q = (w: string, k: number) => quand(spec, w, k);
  const parle = spec.mots.some((m) => t >= m.start && t <= m.end + 0.04);

  // ---------- caméra ----------
  const GROUPE: Cam = {x: 1350, y: -470, z: 0.34};
  const sur = (k: number): Cam => ({x: xZone(k) + 60, y: -430, z: 1});
  const cam = (tt: number): Cam => {
    const pts: [number, Cam][] = [[0, {...GROUPE, z: 0.29}], [S[1].start - 0.45, {...GROUPE, z: 0.34}], [S[1].start + 0.35, sur(0)]];
    for (let k = 2; k <= 4; k++) pts.push([S[k].start - 0.3, sur(k - 2)], [S[k].start + 0.4, sur(k - 1)]);
    pts.push([S[5].start - 0.25, sur(3)], [S[5].start + 0.7, GROUPE]);
    if (tt <= pts[0][0]) return pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) if (tt < pts[i + 1][0]) {
      const f = E.inOut(clamp((tt - pts[i][0]) / (pts[i + 1][0] - pts[i][0])));
      const c = mixCam(pts[i][1], pts[i + 1][1], f);
      // pendant une glissade, la caméra recule un peu (respiration), comme un vrai travelling
      const glisse = pts[i][1].x !== pts[i + 1][1].x && pts[i][1].z === pts[i + 1][1].z ? Math.sin(f * Math.PI) * 0.12 : 0;
      return {...c, z: c.z * (1 - glisse)};
    }
    return pts[pts.length - 1][1];
  };
  // zooms « dramatiques » faits par la caméra (vers le visage) sur les chutes
  const drames = [q('ferme', 1) + 0.15, q('minutes', 2) + 0.05, q('kebab', 3) + 0.05].map((t0, i) => ({t0, x: xZone(i) + (i === 1 ? -180 : i === 2 ? 0 : -120), y: -760}));
  let c = cam(t);
  for (const d of drames) {
    if (t > d.t0 && t < d.t0 + 0.95) {
      const a = E.outExpo(clamp((t - d.t0) / 0.18)) * (1 - E.inOut(clamp((t - d.t0 - 0.6) / 0.35)));
      c = {x: mix(c.x, d.x, a), y: mix(c.y, d.y, a), z: c.z * (1 + 0.85 * a)};
    }
  }
  // flou de mouvement seulement pendant les glissades de caméra (pas pendant les zooms dramatiques)
  const base = cam(t), prev = cam(t - 1 / fps);
  const vitesse = Math.abs(base.x - prev.x) * base.z;
  const flou = Math.min(10, vitesse * 0.06);

  // ---------- fond du monde : dégradé continu, une couleur par pote ----------
  const fond = `linear-gradient(90deg, ${K.violet} 0px, ${K.bleu} ${xZone(0) + 1200}px, ${K.vert} ${xZone(1) + 1200}px, ${K.orange} ${xZone(2) + 1200}px, ${K.rose} ${xZone(3) + 1200}px)`;
  const monde = (
    <div style={{position: 'absolute', left: 540, top: 960, width: 0, height: 0, transform: `scale(${c.z}) translate(${-c.x}px, ${-c.y}px)`}}>
      <div style={{position: 'absolute', left: -2400, top: -7000, width: 7600, height: 10000, background: fond}} />
      {/* décors illustrés (Gemini) : un par pote, fondus entre eux pour garder un seul plan continu */}
      {((spec.decors as string[] | undefined) || []).map((src, i) => (
        <Img key={i} src={staticFile(src)} style={{position: 'absolute', left: xZone(i) + 60 - 680, top: -1960, width: 1360, height: 2418, objectFit: 'cover',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 17%, #000 83%, transparent 100%)', maskImage: 'linear-gradient(90deg, transparent 0%, #000 17%, #000 83%, transparent 100%)'}} />
      ))}
      {spec.decors ? <div style={{position: 'absolute', left: -2400, top: -7000, width: 7600, height: 10000, background: 'rgba(10,8,20,.12)'}} /> : null}
      {/* trame de points */}
      <svg style={{position: 'absolute', left: -2400, top: -3000, opacity: spec.decors ? 0.07 : 0.16}} width={7600} height={6000}>
        <defs><pattern id="ht2" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(20)"><circle cx="10" cy="10" r="7" fill={K.noir} /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#ht2)" />
      </svg>
      {/* faisceaux de lumière accrochés au plafond, qui balaient */}
      {Array.from({length: 10}).map((_, i) => (
        <div key={i} style={{position: 'absolute', left: -600 + i * 470, top: -2200, width: 90, height: 2200, background: 'linear-gradient(#ffffffaa, transparent)', opacity: 0.25, transformOrigin: 'top', transform: `rotate(${Math.sin(t * 1.2 + i) * 22}deg)`, filter: 'blur(8px)'}} />
      ))}
      {/* sol */}
      <div style={{position: 'absolute', left: -2400, top: 0, width: 7600, height: 3000, background: spec.decors ? 'linear-gradient(rgba(0,0,0,.15), rgba(0,0,0,.45) 400px)' : 'rgba(0,0,0,.28)'}} />
      <div style={{position: 'absolute', left: -2400, top: -6, width: 7600, height: 12, background: K.noir}} />

      {/* ===== pote 1 : « je reste une heure » ===== */}
      {(() => {
        const x0 = xZone(0), ferme = q('ferme', 1);
        const nuit = p(t, ferme - 0.3, 0.8, E.inOut);
        return (
          <>
            {/* fenêtre : la nuit devient l'aube (seulement sans décor illustré, qui a déjà la sienne) */}
            {spec.decors ? null : <div style={{position: 'absolute', left: x0 + 150, top: -1230, width: 360, height: 300, border: `9px solid ${K.noir}`, borderRadius: 16, overflow: 'hidden', background: `linear-gradient(${mix(0, 1, nuit) > 0.5 ? '#ffb86b' : '#0d1240'}, ${nuit > 0.5 ? '#ff7a59' : '#2a1a6b'})`}}>
              <div style={{position: 'absolute', left: 120, top: mix(-80, 150, nuit), width: 110, height: 110, borderRadius: '50%', background: nuit > 0.5 ? '#ffe27a' : '#f4f1ff', boxShadow: `0 0 40px ${nuit > 0.5 ? '#ffd23f' : '#ffffff'}`}} />
            </div>}
            <div style={{position: 'absolute', left: x0 + 160, top: -880, transform: `rotate(4deg) scale(${sp(t, q('heure', 1) - 0.2, fps, SPR.pop)})`, transformOrigin: 'left top', background: K.creme, border: `8px solid ${K.noir}`, boxShadow: `10px 10px 0 ${K.noir}`, padding: '14px 26px', fontFamily: F.mono, fontWeight: 700, fontSize: 96, color: K.noir}}>
              {t < ferme ? '23:00' : `0${Math.min(6, Math.floor(mix(0, 6.99, p(t, ferme, 0.7, E.inOut))))}:${t < ferme + 0.7 ? String(Math.floor((t * 97) % 60)).padStart(2, '0') : '00'}`}
            </div>
            <Perso look={POTES[0]} taille={720} x={x0 - 120} y={0} graine={1}
              pose={{corps: Math.sin(t * 9) * 6, tete: Math.sin(t * 9 + 1) * 8, brasD: -140 + Math.sin(t * 9) * 30, brasG: -130 + Math.cos(t * 9) * 30, bouche: t > ferme ? 'dents' : 'sourire', yeux: t > ferme ? 'plisses' : 'ouverts'}} />
          </>
        );
      })()}

      {/* ===== pote 2 : la demande au DJ ===== */}
      {(() => {
        const x0 = xZone(1), toutes = q('toutes', 2);
        const n = t < toutes ? 1 : 1 + Math.min(6, Math.floor((t - toutes) * 5));
        const tape = Math.abs(Math.sin(t * (t > toutes && t < S[3].start ? 16 : 3)));
        return (
          <>
            <Perso look={DJ} taille={640} x={x0 + 250} y={-60} flip graine={7} pose={{sourcils: n > 3 ? -1 : 0, bouche: n > 3 ? 'plat' : 'sourire', yeux: n > 4 ? 'plisses' : 'ouverts', brasD: 30, brasG: 30}} />
            <div style={{position: 'absolute', left: x0 - 20, top: -260, width: 560, height: 160, background: '#2b2b2b', border: `8px solid ${K.noir}`, borderRadius: 20, boxShadow: `10px 10px 0 ${K.noir}`}}>
              {[0, 1].map((i) => <div key={i} style={{position: 'absolute', left: 50 + i * 280, top: 20, width: 110, height: 110, borderRadius: '50%', background: '#111', border: '6px solid #555', transform: `rotate(${t * 400}deg)`}}><div style={{position: 'absolute', left: 48, top: 6, width: 8, height: 36, background: K.jaune}} /></div>)}
            </div>
            <Perso look={POTES[1]} taille={720} x={x0 - 200} y={0} graine={2} pose={{brasD: -40 - tape * 50, brasG: 10, parle: t > S[2].start && t < S[3].start && parle, bouche: 'sourire', tete: 6}} />
            {t > toutes ? <div style={{position: 'absolute', left: x0 + 260, top: -1040, transform: `scale(${1 + 0.15 * Math.max(0, Math.sin((t - toutes) * 31))})`, background: K.noir, color: K.vert, fontFamily: F.wide, fontWeight: 900, fontStretch: '120%', fontSize: 110, padding: '4px 24px'}}>×{n}</div> : null}
          </>
        );
      })()}

      {/* ===== pote 3 : disparaît… au kebab ===== */}
      {(() => {
        const x0 = xZone(2), pouf = q('disparaît', 3) + 0.25, kebab = q('kebab', 3);
        const revient = sp(t, kebab - 0.05, fps, SPR.pop);
        return (
          <>
            <div style={{position: 'absolute', left: x0 - 330, top: -1160, whiteSpace: 'nowrap', transform: `scale(${revient})`, transformOrigin: 'center bottom', fontFamily: F.wide, fontWeight: 900, fontStretch: '125%', fontSize: 150, color: K.jaune, textShadow: `0 0 30px ${K.jaune}, 8px 8px 0 ${K.noir}`, WebkitTextStroke: `5px ${K.noir}`, paintOrder: 'stroke fill'}}>KEBAB</div>
            {t < pouf + 0.2 ? <Perso look={POTES[2]} taille={720} x={x0} y={0} graine={3} style={{transform: `translate(-50%,-100%) scale(${1 - p(t, pouf, 0.2)})`, transformOrigin: 'center bottom'}} pose={{bouche: 'sourire', brasD: 20, brasG: 20}} /> : null}
            <Eclat t0={pouf} x={x0} y={-400} n={22} r={420} couleurs={['#fff', K.noir, K.jaune]} taille={46} />
            {t > pouf + 0.2 && t < kebab - 0.05 ? <div style={{position: 'absolute', left: x0 - 300, top: -560, whiteSpace: 'nowrap', fontFamily: F.serif, fontStyle: 'italic', fontSize: 120, color: K.noir}}>…où il est ?</div> : null}
            {t >= kebab - 0.05 ? (
              <>
                <Perso look={POTES[2]} taille={720} x={x0} y={0} graine={3} style={{transform: `translate(-50%,-100%) scale(${revient})`, transformOrigin: 'center bottom'}} pose={{bouche: 'o', yeux: 'ronds', brasD: -100, brasG: 12}} />
                <div style={{position: 'absolute', left: x0 + 230, top: -560, fontSize: 160, transform: `rotate(${Math.sin(t * 6) * 8}deg) scale(${revient})`}}>🥙</div>
              </>
            ) : null}
          </>
        );
      })()}

      {/* ===== pote 4 : « bien rentré ? », le vrai MVP ===== */}
      {(() => {
        const x0 = xZone(3), mvp = q('mvp', 4);
        return (
          <>
            <Perso look={POTES[3]} taille={720} x={x0 - 150} y={0} graine={4} pose={{bouche: t > mvp ? 'dents' : 'sourire', brasD: -60, brasG: 12, yeux: t > mvp ? 'plisses' : 'ouverts'}} />
            <div style={{position: 'absolute', left: x0 + 260, top: -520, transform: `rotate(6deg) scale(${sp(t, S[4].start + 0.1, fps, SPR.doux)})`}}>
              <Telephone w={400}>
                <div style={{position: 'absolute', inset: 0, background: '#f6f3ee', padding: '90px 18px', display: 'flex', flexDirection: 'column', gap: 14}}>
                  {['Max', 'Inès', 'Yanis', 'Léa', 'Sam'].map((nom, i) => {
                    const t0 = q('rentré', 4) + i * 0.22;
                    return t > t0 ? <div key={i} style={{alignSelf: 'flex-end', background: K.rose, color: '#fff', borderRadius: 22, padding: '12px 18px', fontFamily: F.wide, fontWeight: 800, fontSize: 28, transform: `scale(${sp(t, t0, fps, SPR.pop)})`, transformOrigin: 'right'}}>@{nom} bien rentré ?</div> : null;
                  })}
                </div>
              </Telephone>
            </div>
            <div style={{position: 'absolute', left: x0 - 150, top: mix(-1700, -1000, sp(t, mvp - 0.2, fps, SPR.pop)), transform: 'translate(-50%,0) rotate(-8deg)', fontSize: 190, opacity: t > mvp - 0.25 ? 1 : 0}}>👑</div>
            <Eclat t0={mvp} x={x0 - 150} y={-880} n={24} r={380} couleurs={[K.jaune, '#fff', K.rose, K.bleu]} taille={30} />
          </>
        );
      })()}

      {/* numéros au-dessus des têtes : visibles quand la caméra montre le groupe */}
      {POTES.map((_, i) => {
        const vis = c.z < 0.5 ? clamp((0.5 - c.z) / 0.12) : 0;
        return <div key={i} style={{position: 'absolute', left: xZone(i) - 130, top: -1260, width: 220, textAlign: 'center', opacity: vis, fontFamily: F.wide, fontWeight: 900, fontStretch: '120%', fontSize: 200, color: K.creme, WebkitTextStroke: `10px ${K.noir}`, paintOrder: 'stroke fill'}}>{i + 1}</div>;
      })}
    </div>
  );

  // ---------- premier plan (parallaxe) : silhouettes qui passent plus vite que le fond ----------
  const avant = (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: -40, height: 260, overflow: 'visible', pointerEvents: 'none'}}>
      {Array.from({length: 14}).map((_, i) => {
        const wx = i * 560 - 1400;
        const sx = 540 + (wx - c.x * 1.5) * Math.max(0.6, c.z);
        const h = 220 + rnd(i) * 120;
        return (
          <div key={i} style={{position: 'absolute', left: ((sx % 7840) + 7840) % 7840 - 1400, bottom: 0, width: 180, height: h, opacity: 0.92}}>
            <div style={{position: 'absolute', left: 50, top: 0, width: 80, height: 80, borderRadius: '50%', background: K.noir}} />
            <div style={{position: 'absolute', left: 10, top: 70, width: 160, height: h, borderRadius: 60, background: K.noir}} />
            {rnd(i * 3) > 0.5 ? <div style={{position: 'absolute', left: 130, top: -60 + Math.sin(t * 5 + i) * 14, width: 26, height: 150, borderRadius: 14, background: K.noir, transform: 'rotate(-18deg)'}} /> : null}
          </div>
        );
      })}
    </div>
  );

  // ---------- étiquette de la scène, en surimpression ----------
  const k = S.findIndex((s, i) => t >= s.start && (i === S.length - 1 || t < S[i + 1].start));
  const etiquette = k >= 1 && k <= 4 ? (() => {
    const a = sp(t, S[k].start + 0.2, fps, SPR.pop);
    const sortie = k < 5 && S[k + 1] ? p(t, S[k + 1].start - 0.3, 0.25, E.inCubic) : 0;
    return (
      <div style={{position: 'absolute', left: 70, top: 190, transform: `translateX(${-sortie * 1100}px) rotate(-3deg) scale(${a})`, transformOrigin: 'left top', display: 'flex', border: `7px solid ${K.noir}`, boxShadow: `10px 10px 0 ${K.noir}`, background: K.creme}}>
        <div style={{background: K.noir, color: COULEURS[k - 1], fontFamily: F.wide, fontWeight: 900, fontStretch: '120%', fontSize: 84, padding: '6px 22px', lineHeight: 1}}>0{k}</div>
        <div style={{fontFamily: F.wide, fontWeight: 900, fontStretch: '75%', fontSize: 58, color: K.noir, padding: '14px 24px', textTransform: 'uppercase', lineHeight: 1, maxWidth: 700}}>{ETIQ[k - 1]}</div>
      </div>
    );
  })() : null;

  // ---------- titre d'ouverture et fin ----------
  const titre = t < S[1].start ? (
    <div style={{position: 'absolute', left: 70, top: 220, fontFamily: F.wide, fontWeight: 900, fontStretch: '70%', fontSize: 150, color: K.creme, lineHeight: 0.9, textTransform: 'uppercase', WebkitTextStroke: `6px ${K.noir}`, paintOrder: 'stroke fill', textShadow: `10px 10px 0 ${K.noir}`,
      transform: `translateY(${-p(t, S[1].start - 0.4, 0.35, E.inCubic) * 700}px)`}}>
      {['les potes', "qu'on a", 'tous'].map((l, i) => <div key={i} style={{transform: `translateX(${(1 - sp(t, -0.15 + i * 0.1, fps, SPR.sec)) * -1100}px)`, color: i === 2 ? K.jaune : K.creme}}>{l}</div>)}
    </div>
  ) : null;
  const fin = t >= S[5].start ? (
    <>
      <div style={{position: 'absolute', left: 70, top: 220, fontFamily: F.wide, fontWeight: 900, fontStretch: '70%', fontSize: 170, color: K.noir, lineHeight: 0.88, textTransform: 'uppercase'}}>
        {['tague', 'ton', 'n°1'].map((l, i) => <div key={i} style={{transform: `scale(${sp(t, S[5].start + 0.3 + i * 0.12, fps, SPR.pop)})`, transformOrigin: 'left center', color: i === 2 ? K.creme : K.noir, WebkitTextStroke: i === 2 ? `6px ${K.noir}` : undefined, paintOrder: 'stroke fill'}}>{l}</div>)}
      </div>
      <Commentaire texte="@max c'est toi 💀" t0={S[5].start + 1} style={{left: 540, top: 1180, transform: `translate(-50%,-50%) scale(${sp(t, S[5].start + 0.8, fps, SPR.pop)})`}} pseudo="léa" />
    </>
  ) : null;

  return (
    <AbsoluteFill style={{background: K.violet, overflow: 'hidden', fontFamily: F.wide}}>
      <AbsoluteFill style={{filter: flou > 0.4 ? `blur(${flou}px)` : undefined}}>{monde}</AbsoluteFill>
      {avant}
      {titre}
      {etiquette}
      {fin}
      <SousTitres mots={spec.mots} y={1370} taille={70} style="contour" accent={K.jaune} cles={[]} />
      <Grain force={0.05} />
      <BandeSon spec={spec} />
    </AbsoluteFill>
  );
};
