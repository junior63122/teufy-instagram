import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, staticFile} from 'remotion';
import {BandeSon, Eclat, Grain, SousTitres, quand, useT} from '../ui/base';
import {Commentaire, Perso, Telephone} from '../ui/illus';
import type {Look, Pose} from '../ui/illus';
import {E, SPR, clamp, mix, p, rnd, sp} from '../lib/anim';
import {F} from '../lib/fonts';
import type {Spec} from '../lib/types';

// Moteur générique « plan continu illustré » (la règle des reels Teufy) :
// un monde par scène, décor illustré (Gemini) + personnages et objets animés en code, une seule caméra
// qui part du groupe, plonge sur le 1er monde, glisse de monde en monde et revient au groupe pour la fin.
// Tout est décrit par la spec (écrite par l'IA) et déclenché par les mots de la voix off.

type Prop = {
  type: 'texte' | 'compteur' | 'horloge' | 'telephone' | 'emoji' | 'tampon' | 'billet' | 'bulle' | 'enseigne';
  mot?: string; // mot qui déclenche l'apparition (sinon début de la scène)
  x?: number; y?: number; // position dans le monde, par rapport au centre du monde (sol = 0)
  texte?: string; de?: number; a?: number; suffixe?: string; heures?: [string, string]; lignes?: string[]; emoji?: string; couleur?: string; taille?: number; rot?: number;
};
type PersoSpec = {look: Look; x?: number; taille?: number; flip?: boolean; pose?: string; poseApres?: string; motApres?: string; disparait?: string; apparait?: string};
type Monde = {decor?: string; ambiance?: string; couleur?: string; etiquette?: string; persos?: PersoSpec[]; props?: Prop[]; zoom?: string};

const K = {noir: '#111', creme: '#fff4e0', jaune: '#ffd60a'};
const ZONE = 900;
const xZone = (k: number) => k * ZONE;
type Cam = {x: number; y: number; z: number};
const mixCam = (a: Cam, b: Cam, f: number): Cam => ({x: mix(a.x, b.x, f), y: mix(a.y, b.y, f), z: mix(a.z, b.z, f)});

/** Poses prêtes à l'emploi : l'IA choisit un nom, le moteur anime. */
const POSES = (nom: string | undefined, t: number, g: number): Pose => {
  const b = Math.sin(t * 9 + g);
  switch (nom) {
    case 'danse': return {corps: b * 6, tete: Math.sin(t * 9 + g + 1) * 8, brasD: -140 + b * 30, brasG: -130 + Math.cos(t * 9 + g) * 30, bouche: 'dents'};
    case 'choc': return {bouche: 'o', yeux: 'ronds', sourcils: 1, brasD: -100, brasG: -100};
    case 'rire': return {bouche: 'dents', yeux: 'plisses', corps: Math.sin(t * 14 + g) * 3, brasD: 20, brasG: 20};
    case 'pointe': return {brasD: -95, brasG: 12, bouche: 'sourire'};
    case 'fier': return {brasD: -150, brasG: -150, bouche: 'dents', yeux: 'plisses', tete: 6};
    case 'triste': return {bouche: 'triste', sourcils: -0.6, brasD: 8, brasG: 8, tete: -6};
    case 'agace': return {bouche: 'plat', sourcils: -1, yeux: 'plisses', brasD: 30, brasG: 30};
    case 'reflechit': return {bouche: 'plat', sourcils: 0.6, brasD: -150, brasG: 12, tete: -8};
    case 'telephone': return {brasD: -60, brasG: 12, bouche: 'sourire'};
    case 'salue': return {brasD: -140 + Math.sin(t * 10) * 20, brasG: 12, bouche: 'dents'};
    default: return {bouche: 'sourire', brasD: 15, brasG: 12};
  }
};

export const Histoire: React.FC<{spec: Spec}> = ({spec}) => {
  const {t, fps} = useT();
  const S = spec.scenes;
  const mondes = (spec.mondes as Monde[]) || [];
  const n = mondes.length;
  const q = (w: string | undefined, k: number) => (w ? quand(spec, w, k) : S[k]?.start ?? 0);
  const parle = spec.mots.some((m) => t >= m.start && t <= m.end + 0.04);
  const fin = S.length - 1; // dernière scène = retour au groupe
  const sceneDe = (i: number) => i + 1; // monde i ↔ scène i+1

  // ---------- caméra ----------
  const GROUPE: Cam = {x: ((n - 1) * ZONE) / 2, y: -470, z: Math.min(0.42, 1080 / ((n - 1) * ZONE + 1500))};
  const sur = (i: number): Cam => ({x: xZone(i) + 60, y: -430, z: 1});
  const cam = (tt: number): Cam => {
    const pts: [number, Cam][] = [[0, {...GROUPE, z: GROUPE.z * 0.93}], [S[1].start - 0.45, {...GROUPE, z: GROUPE.z * 1.08}], [S[1].start + 0.35, sur(0)]];
    for (let i = 1; i < n; i++) pts.push([S[sceneDe(i)].start - 0.3, sur(i - 1)], [S[sceneDe(i)].start + 0.4, sur(i)]);
    pts.push([S[fin].start - 0.25, sur(n - 1)], [S[fin].start + 0.7, GROUPE]);
    if (tt <= pts[0][0]) return pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) if (tt < pts[i + 1][0]) {
      const f = E.inOut(clamp((tt - pts[i][0]) / Math.max(0.01, pts[i + 1][0] - pts[i][0])));
      const c = mixCam(pts[i][1], pts[i + 1][1], f);
      const glisse = pts[i][1].x !== pts[i + 1][1].x && pts[i][1].z === pts[i + 1][1].z ? Math.sin(f * Math.PI) * 0.12 : 0;
      return {...c, z: c.z * (1 - glisse)};
    }
    return pts[pts.length - 1][1];
  };
  let c = cam(t);
  mondes.forEach((m, i) => {
    if (!m.zoom) return;
    const t0 = q(m.zoom, sceneDe(i)) + 0.05;
    if (t > t0 && t < t0 + 0.95) {
      const a = E.outExpo(clamp((t - t0) / 0.18)) * (1 - E.inOut(clamp((t - t0 - 0.6) / 0.35)));
      const px = (m.persos?.[0]?.x ?? -120) + xZone(i);
      c = {x: mix(c.x, px, a), y: mix(c.y, -760, a), z: c.z * (1 + 0.85 * a)};
    }
  });
  const base = cam(t), prev = cam(t - 1 / fps);
  const flou = Math.min(10, Math.abs(base.x - prev.x) * base.z * 0.06);

  const couleurs = mondes.map((m) => m.couleur || '#7b2cff');
  const fond = `linear-gradient(90deg, ${couleurs.map((col, i) => `${col} ${xZone(i) + 2400}px`).join(', ')})`;

  const accroche = (prop: Prop, i: number) => q(prop.mot, sceneDe(i));

  const rendreProp = (prop: Prop, i: number, k: number) => {
    const x0 = xZone(i) + clamp(prop.x ?? 120, -260, 150), y0 = clamp(prop.y ?? -880, -1150, -250);
    const t0 = accroche(prop, i);
    if (t < t0 - 0.05) return null;
    const a = sp(t, t0 - 0.05, fps, SPR.pop);
    const coul = prop.couleur || K.jaune;
    const style: React.CSSProperties = {position: 'absolute', left: x0, top: y0, transform: `translate(-50%,-50%) rotate(${prop.rot ?? 0}deg) scale(${a})`, whiteSpace: 'nowrap'};
    switch (prop.type) {
      case 'texte':
        return <div key={k} style={{...style, fontFamily: F.wide, fontWeight: 900, fontStretch: '110%', fontSize: prop.taille ?? 120, color: K.creme, WebkitTextStroke: `9px ${K.noir}`, paintOrder: 'stroke fill', textTransform: 'uppercase'}}>{prop.texte}</div>;
      case 'compteur': {
        const v = Math.round(mix(prop.de ?? 0, prop.a ?? 100, E.outExpo(clamp((t - t0) / 0.8))));
        return <div key={k} style={{...style, background: K.noir, color: coul, fontFamily: F.wide, fontWeight: 900, fontStretch: '120%', fontSize: prop.taille ?? 110, padding: '4px 26px'}}>{v}{prop.suffixe ?? ''}</div>;
      }
      case 'horloge': {
        const [h1, h2] = prop.heures ?? ['23:00', '06:00'];
        const roule = t > t0 + 0.2 && t < t0 + 0.9;
        return <div key={k} style={{...style, background: K.creme, border: `8px solid ${K.noir}`, boxShadow: `10px 10px 0 ${K.noir}`, padding: '14px 26px', fontFamily: F.mono, fontWeight: 700, fontSize: prop.taille ?? 96, color: K.noir}}>{t < t0 + 0.2 ? h1 : roule ? `${String(Math.floor(rnd(Math.floor(t * 20)) * 24)).padStart(2, '0')}:${String(Math.floor(rnd(Math.floor(t * 20) + 1) * 60)).padStart(2, '0')}` : h2}</div>;
      }
      case 'telephone':
        return (
          <div key={k} style={{position: 'absolute', left: x0, top: y0, transform: `rotate(${prop.rot ?? 6}deg) scale(${a})`}}>
            <Telephone w={400}>
              <div style={{position: 'absolute', inset: 0, background: '#f6f3ee', padding: '90px 18px', display: 'flex', flexDirection: 'column', gap: 14}}>
                {(prop.lignes || []).map((l, j) => (t > t0 + j * 0.22 ? <div key={j} style={{alignSelf: 'flex-end', background: coul, color: '#fff', borderRadius: 22, padding: '12px 18px', fontFamily: F.wide, fontWeight: 800, fontSize: 28, transform: `scale(${sp(t, t0 + j * 0.22, fps, SPR.pop)})`, transformOrigin: 'right'}}>{l}</div> : null))}
              </div>
            </Telephone>
          </div>
        );
      case 'emoji':
        return <div key={k} style={{...style, fontSize: prop.taille ?? 170, transform: `translate(-50%,-50%) rotate(${Math.sin(t * 6 + k) * 8}deg) scale(${a})`}}>{prop.emoji}</div>;
      case 'tampon':
        return <div key={k} style={{...style, transform: `translate(-50%,-50%) rotate(${prop.rot ?? -8}deg) scale(${mix(2.2, 1, a)})`, opacity: clamp(a * 3), fontFamily: F.wide, fontWeight: 900, fontStretch: '110%', fontSize: prop.taille ?? 110, color: coul, border: `12px solid ${coul}`, borderRadius: 20, padding: '0 30px', background: '#ffffffd9', textTransform: 'uppercase'}}>{prop.texte}</div>;
      case 'billet':
        return (
          <div key={k} style={{...style, width: 460, background: '#fff', borderRadius: 26, overflow: 'hidden', border: `7px solid ${K.noir}`, boxShadow: `10px 10px 0 ${K.noir}`, whiteSpace: 'normal'}}>
            <div style={{background: coul, padding: '16px 24px', fontFamily: F.mono, fontWeight: 700, fontSize: 26, color: K.noir}}>{prop.texte ?? 'BILLET'}</div>
            <div style={{padding: '18px 24px', fontFamily: F.wide, fontWeight: 900, fontStretch: '120%', fontSize: 90, color: K.noir}}>{Math.round(mix(prop.de ?? prop.a ?? 0, prop.a ?? 0, E.outExpo(clamp((t - t0) / 0.7))))}{prop.suffixe ?? ' €'}</div>
          </div>
        );
      case 'bulle':
        return (
          <div key={k} style={{...style, maxWidth: 560, whiteSpace: 'normal', background: '#fff', border: `7px solid ${K.noir}`, borderRadius: 40, padding: '20px 30px', fontFamily: F.wide, fontWeight: 800, fontSize: prop.taille ?? 50, color: K.noir, lineHeight: 1.1, boxShadow: `8px 8px 0 ${K.noir}`}}>
            {prop.texte}
            <div style={{position: 'absolute', left: 60, bottom: -38, width: 0, height: 0, borderLeft: '22px solid transparent', borderRight: '22px solid transparent', borderTop: `38px solid ${K.noir}`}} />
          </div>
        );
      case 'enseigne':
        return <div key={k} style={{...style, fontFamily: F.wide, fontWeight: 900, fontStretch: '125%', fontSize: prop.taille ?? 150, color: coul, textShadow: `0 0 30px ${coul}, 8px 8px 0 ${K.noir}`, WebkitTextStroke: `5px ${K.noir}`, paintOrder: 'stroke fill', opacity: (t * 7) % 3 < 0.2 && t < t0 + 1 ? 0.4 : 1}}>{prop.texte}</div>;
      default: return null;
    }
  };

  const monde = (
    <div style={{position: 'absolute', left: 540, top: 960, width: 0, height: 0, transform: `scale(${c.z}) translate(${-c.x}px, ${-c.y}px)`}}>
      <div style={{position: 'absolute', left: -2400, top: -7000, width: 2400 * 2 + n * ZONE + 2400, height: 10000, background: fond}} />
      {mondes.map((m, i) => (m.decor ? (
        <Img key={i} src={staticFile(m.decor)} style={{position: 'absolute', left: xZone(i) + 60 - 680, top: -1960, width: 1360, height: 2418, objectFit: 'cover',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 17%, #000 83%, transparent 100%)', maskImage: 'linear-gradient(90deg, transparent 0%, #000 17%, #000 83%, transparent 100%)'}} />
      ) : null))}
      <svg style={{position: 'absolute', left: -2400, top: -3000, opacity: 0.07}} width={n * ZONE + 4800} height={6000}>
        <defs><pattern id="htH" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(20)"><circle cx="10" cy="10" r="7" fill={K.noir} /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#htH)" />
      </svg>
      <div style={{position: 'absolute', left: -2400, top: 0, width: n * ZONE + 4800, height: 3000, background: 'linear-gradient(rgba(0,0,0,.15), rgba(0,0,0,.45) 400px)'}} />
      <div style={{position: 'absolute', left: -2400, top: -6, width: n * ZONE + 4800, height: 12, background: K.noir}} />

      {mondes.map((m, i) => (
        <React.Fragment key={i}>
          {(m.persos || []).map((pp, j) => {
            const ki = sceneDe(i);
            const tDisp = pp.disparait ? q(pp.disparait, ki) + 0.25 : Infinity;
            const tApp = pp.apparait ? q(pp.apparait, ki) - 0.05 : -Infinity;
            if (t > tDisp + 0.2 && t < tApp) return null;
            const echelle = t > tDisp ? 1 - p(t, tDisp, 0.2) : t > tApp && pp.apparait ? sp(t, tApp, fps, SPR.pop) : 1;
            const apres = pp.motApres && t > q(pp.motApres, ki);
            const pose = POSES(apres ? pp.poseApres : pp.pose, t, i * 3 + j);
            const actif = t >= S[ki].start && t < S[ki].end && j === 0 && parle && !['danse', 'rire', 'choc'].includes(apres ? pp.poseApres || '' : pp.pose || '');
            return (
              <React.Fragment key={j}>
                <Perso look={{trait: K.noir, epaisseur: 9, ...pp.look}} taille={pp.taille ?? 720} x={xZone(i) + (pp.x ?? -120)} y={0} flip={pp.flip} graine={i * 5 + j + 1}
                  style={{transform: `translate(-50%,-100%) scale(${echelle})`, transformOrigin: 'center bottom'}} pose={{...pose, parle: actif}} />
                {pp.disparait ? <Eclat t0={tDisp} x={xZone(i) + (pp.x ?? -120)} y={-400} n={22} r={420} couleurs={['#fff', K.noir, K.jaune]} taille={46} /> : null}
              </React.Fragment>
            );
          })}
          {(m.props || []).map((pr, k) => rendreProp(pr, i, k))}
        </React.Fragment>
      ))}
      {mondes.map((_, i) => {
        const vis = c.z < 0.55 ? clamp((0.55 - c.z) / 0.12) : 0;
        return <div key={`n${i}`} style={{position: 'absolute', left: xZone(i) - 130, top: -1260, width: 220, textAlign: 'center', opacity: vis, fontFamily: F.wide, fontWeight: 900, fontStretch: '120%', fontSize: 200, color: K.creme, WebkitTextStroke: `10px ${K.noir}`, paintOrder: 'stroke fill'}}>{i + 1}</div>;
      })}
    </div>
  );

  const avant = (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: -40, height: 260, pointerEvents: 'none'}}>
      {Array.from({length: 14}).map((_, i) => {
        const sx = 540 + (i * 560 - 1400 - c.x * 1.5) * Math.max(0.6, c.z);
        const h = 220 + rnd(i) * 120;
        return (
          <div key={i} style={{position: 'absolute', left: ((sx % 7840) + 7840) % 7840 - 1400, bottom: 0, width: 180, height: h}}>
            <div style={{position: 'absolute', left: 50, top: 0, width: 80, height: 80, borderRadius: '50%', background: K.noir}} />
            <div style={{position: 'absolute', left: 10, top: 70, width: 160, height: h, borderRadius: 60, background: K.noir}} />
            {rnd(i * 3) > 0.5 ? <div style={{position: 'absolute', left: 130, top: -60 + Math.sin(t * 5 + i) * 14, width: 26, height: 150, borderRadius: 14, background: K.noir, transform: 'rotate(-18deg)'}} /> : null}
          </div>
        );
      })}
    </div>
  );

  const k = S.findIndex((s, i) => t >= s.start && (i === S.length - 1 || t < S[i + 1].start));
  const iM = k - 1;
  const etiquette = iM >= 0 && iM < n && mondes[iM].etiquette ? (() => {
    const a = sp(t, S[k].start + 0.2, fps, SPR.pop);
    const sortie = S[k + 1] ? p(t, S[k + 1].start - 0.3, 0.25, E.inCubic) : 0;
    return (
      <div style={{position: 'absolute', left: 70, top: 190, transform: `translateX(${-sortie * 1100}px) rotate(-3deg) scale(${a})`, transformOrigin: 'left top', display: 'flex', border: `7px solid ${K.noir}`, boxShadow: `10px 10px 0 ${K.noir}`, background: K.creme}}>
        <div style={{background: K.noir, color: couleurs[iM], fontFamily: F.wide, fontWeight: 900, fontStretch: '120%', fontSize: 84, padding: '6px 22px', lineHeight: 1}}>0{iM + 1}</div>
        <div style={{fontFamily: F.wide, fontWeight: 900, fontStretch: '75%', fontSize: 58, color: K.noir, padding: '14px 24px', textTransform: 'uppercase', lineHeight: 1, maxWidth: 700}}>{mondes[iM].etiquette}</div>
      </div>
    );
  })() : null;

  const titre = (spec.titreLignes as string[]) || [];
  const finLignes = (spec.finLignes as string[]) || [];
  const ouverture = t < S[1].start ? (
    <div style={{position: 'absolute', left: 70, right: 70, top: 220, fontFamily: F.wide, fontWeight: 900, fontStretch: '70%', fontSize: titre.some((l) => l.length > 12) ? 120 : 150, color: K.creme, lineHeight: 0.9, textTransform: 'uppercase', WebkitTextStroke: `6px ${K.noir}`, paintOrder: 'stroke fill', textShadow: `10px 10px 0 ${K.noir}`,
      transform: `translateY(${-p(t, S[1].start - 0.4, 0.35, E.inCubic) * 700}px)`}}>
      {titre.map((l, i) => <div key={i} style={{transform: `translateX(${(1 - sp(t, -0.15 + i * 0.1, fps, SPR.sec)) * -1100}px)`, color: i === titre.length - 1 ? K.jaune : K.creme}}>{l}</div>)}
    </div>
  ) : null;
  const cloture = t >= S[fin].start ? (
    <>
      <div style={{position: 'absolute', left: 70, right: 70, top: 220, fontFamily: F.wide, fontWeight: 900, fontStretch: '70%', fontSize: 150, color: K.noir, lineHeight: 0.88, textTransform: 'uppercase'}}>
        {finLignes.map((l, i) => <div key={i} style={{transform: `scale(${sp(t, S[fin].start + 0.3 + i * 0.12, fps, SPR.pop)})`, transformOrigin: 'left center', color: i === finLignes.length - 1 ? K.creme : K.noir, WebkitTextStroke: i === finLignes.length - 1 ? `6px ${K.noir}` : undefined, paintOrder: 'stroke fill'}}>{l}</div>)}
      </div>
      {spec.commentaire ? <Commentaire texte={String(spec.commentaire)} t0={S[fin].start + 1} style={{left: 540, top: 1180, transform: `translate(-50%,-50%) scale(${sp(t, S[fin].start + 0.8, fps, SPR.pop)})`}} pseudo="un pote" /> : null}
    </>
  ) : null;

  return (
    <AbsoluteFill style={{background: couleurs[0], overflow: 'hidden', fontFamily: F.wide}}>
      <AbsoluteFill style={{filter: flou > 0.4 ? `blur(${flou}px)` : undefined}}>{monde}</AbsoluteFill>
      {avant}
      {ouverture}
      {etiquette}
      {cloture}
      <SousTitres mots={spec.mots.map((m) => ({...m, w: m.w.replace(/[«»“”"]/g, '').trim()})).filter((m) => m.w && !/^[.,!?:;…'’]+$/.test(m.w))} y={1370} taille={70} style="contour" accent={K.jaune} cles={[]} />
      <Grain force={0.05} />
      <BandeSon spec={spec} />
      {/* ambiance de chaque monde, qui suit la caméra */}
      {mondes.map((m, i) => (m.ambiance ? (
        <Audio key={`amb${i}`} src={staticFile(m.ambiance)} loop volume={(f) => {
          const cc = cam(f / fps);
          const proche = clamp(1 - Math.abs(cc.x - (xZone(i) + 60)) / 1100);
          const tt = f / fps;
          const parleF = spec.mots.some((mm) => tt >= mm.start - 0.1 && tt <= mm.end + 0.2);
          return 0.55 * proche * (cc.z < 0.55 ? 0.35 : 1) * (parleF ? 0.55 : 1) * clamp((spec.duree - tt) / 1.2);
        }} />
      ) : null))}
      {mondes.slice(1).map((_, i) => (
        <Sequence key={`w${i}`} from={Math.max(0, Math.round((S[sceneDe(i + 1)].start - 0.38) * fps))} layout="none"><Audio src={staticFile('sfx/whoosh.mp3')} volume={0.55} /></Sequence>
      ))}
      <Sequence from={Math.max(0, Math.round((S[1].start - 0.5) * fps))} layout="none"><Audio src={staticFile('sfx/aspiration.mp3')} volume={0.55} /></Sequence>
      <Sequence from={Math.max(0, Math.round((S[fin].start - 1.6) * fps))} layout="none"><Audio src={staticFile('sfx/riser.mp3')} volume={0.45} /></Sequence>
      <Sequence from={Math.max(0, Math.round((S[fin].start + 0.3) * fps))} layout="none"><Audio src={staticFile('sfx/impact.mp3')} volume={0.5} /></Sequence>
      {mondes.map((m, i) => (m.zoom ? <Sequence key={`z${i}`} from={Math.max(0, Math.round((q(m.zoom, sceneDe(i)) + 0.05) * fps))} layout="none"><Audio src={staticFile('sfx/zoom.mp3')} volume={0.6} /></Sequence> : null))}
    </AbsoluteFill>
  );
};
