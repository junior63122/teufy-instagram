import React from 'react';
import {AbsoluteFill} from 'remotion';
import {BandeSon, Eclat, Grain, SousTitres, quand, useT} from '../ui/base';
import {Commentaire, Perso, Telephone} from '../ui/illus';
import type {Look} from '../ui/illus';
import {E, SPR, clamp, mix, p, sp} from '../lib/anim';
import {F} from '../lib/fonts';
import type {Spec} from '../lib/types';

// Concept « humour » : les 4 potes qu'on a tous en soirée. DA pop cartoon : aplats saturés, gros
// contours noirs, zooms « dramatiques », arrêt sur image. Rien à voir avec le style de l'explicatif.

const K = {noir: '#111', jaune: '#ffd60a', bleu: '#3a86ff', rose: '#ff4d9d', vert: '#2ec27e', orange: '#ff7a1a', creme: '#fff4e0', violet: '#7b2cff'};
const TRAIT = {trait: K.noir, epaisseur: 9};
const POTES: Look[] = [
  {peau: '#f2c09b', cheveux: '#3b2416', haut: K.bleu, coiffure: 'court', ...TRAIT},
  {peau: '#c98b62', cheveux: '#111', haut: K.vert, coiffure: 'casquette', ...TRAIT},
  {peau: '#8d5a3b', cheveux: '#1a1a1a', haut: K.jaune, coiffure: 'bouclé', ...TRAIT},
  {peau: '#f6d1b3', cheveux: '#b5532c', haut: K.rose, coiffure: 'long', lunettes: true, ...TRAIT},
];
const DJ: Look = {peau: '#e0a77f', cheveux: '#222', haut: '#222', coiffure: 'rasé', lunettes: true, ...TRAIT};

const dans = (spec: Spec, k: number, t: number) => t >= spec.scenes[k].start - 0.02 && t < spec.scenes[k].end;

/** Fond aplat + trame de points (demi-teinte) qui défile. */
const Aplat: React.FC<{c: string; t: number}> = ({c, t}) => (
  <AbsoluteFill style={{background: c}}>
    <svg width="100%" height="100%" style={{position: 'absolute', opacity: 0.16}}>
      <defs><pattern id="ht" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform={`rotate(20) translate(${(t * 30) % 36} 0)`}><circle cx="9" cy="9" r="6" fill={K.noir} /></pattern></defs>
      <rect width="100%" height="100%" fill="url(#ht)" />
    </svg>
  </AbsoluteFill>
);

/** Étiquette « 01 · celui qui… » en haut, collée comme un sticker. */
const Etiquette: React.FC<{n: string; texte: string; t0: number; couleur: string}> = ({n, texte, t0, couleur}) => {
  const {t, fps} = useT();
  const a = sp(t, t0, fps, SPR.pop);
  return (
    <div style={{position: 'absolute', left: 80, top: 190, transform: `rotate(-3deg) scale(${a})`, transformOrigin: 'left top', display: 'flex', alignItems: 'stretch', border: `7px solid ${K.noir}`, boxShadow: `10px 10px 0 ${K.noir}`, background: K.creme}}>
      <div style={{background: K.noir, color: couleur, fontFamily: F.wide, fontWeight: 900, fontStretch: '120%', fontSize: 88, padding: '6px 22px', lineHeight: 1}}>{n}</div>
      <div style={{fontFamily: F.wide, fontWeight: 900, fontStretch: '75%', fontSize: 62, color: K.noir, padding: '14px 24px', textTransform: 'uppercase', lineHeight: 1, maxWidth: 680}}>{texte}</div>
    </div>
  );
};

/** Zoom « dramatique » (le mème) : à t0 la caméra fonce sur le visage puis revient. */
const zoomDrame = (t: number, t0: number, d = 0.9) => (t < t0 || t > t0 + d ? 1 : 1 + 0.9 * E.outExpo(clamp((t - t0) / 0.15)) * (1 - E.inOut(clamp((t - t0 - 0.55) / 0.35))));

export const Potes: React.FC<{spec: Spec}> = ({spec}) => {
  const {t, fps} = useT();
  const S = spec.scenes;
  const q = (w: string, k: number) => quand(spec, w, k);
  const fonds = [K.violet, K.bleu, K.vert, K.orange, K.rose, K.jaune];
  const k = Math.max(0, S.findIndex((s, i) => t >= s.start - 0.02 && (i === S.length - 1 || t < S[i + 1].start)));
  // Arrêt sur image : à « quatre-là », tout se fige 0,5 s (avec le scratch).
  const gel = q('quatre', 0);
  const tg = t > gel + 0.1 && t < gel + 0.6 ? gel + 0.1 : t;

  return (
    <AbsoluteFill style={{background: K.noir, fontFamily: F.wide}}>
      {/* volet de couleur qui balaie à chaque nouveau pote */}
      <Aplat c={fonds[k] ?? K.violet} t={t} />
      {k > 0 ? <AbsoluteFill style={{background: fonds[k - 1], clipPath: `inset(0 0 ${p(t, S[k].start - 0.02, 0.3, E.inOut) * 100}% 0)`}} /> : null}

      {/* ---------- 0 : la bande des 4 ---------- */}
      {dans(spec, 0, t) ? (
        <AbsoluteFill style={{filter: t > gel + 0.1 && t < gel + 0.6 ? 'saturate(0.2) contrast(1.2)' : undefined}}>
          <div style={{position: 'absolute', left: 80, top: 230, fontFamily: F.wide, fontWeight: 900, fontStretch: '70%', fontSize: 150, color: K.creme, lineHeight: 0.9, textTransform: 'uppercase', WebkitTextStroke: `6px ${K.noir}`, paintOrder: 'stroke fill', textShadow: `10px 10px 0 ${K.noir}`}}>
            {['les potes', "qu'on a", 'TOUS'].map((l, i) => <div key={i} style={{transform: `translateX(${(1 - sp(tg, 0.05 + i * 0.12, fps, SPR.sec)) * -1100}px)`, color: i === 2 ? K.jaune : K.creme}}>{l}</div>)}
          </div>
          {POTES.map((look, i) => (
            <Perso key={i} look={look} taille={400} x={150 + i * 260} y={1290 + (1 - sp(tg, q('groupe', 0) + i * 0.13, fps, SPR.pop)) * 900} graine={i + 1}
              pose={{bouche: i % 2 ? 'dents' : 'sourire', brasD: i === 1 ? -120 : 15, brasG: i === 2 ? -140 : 12, yeux: t > gel + 0.1 && t < gel + 0.6 ? 'ronds' : 'ouverts'}} />
          ))}
          {t > gel + 0.1 && t < gel + 0.6 ? <div style={{position: 'absolute', left: 540, top: 760, transform: 'translate(-50%,-50%) rotate(-4deg)', background: K.noir, color: K.jaune, fontFamily: F.mono, fontWeight: 700, fontSize: 48, padding: '14px 26px'}}>lequel c'est toi ?</div> : null}
        </AbsoluteFill>
      ) : null}

      {/* ---------- 1 : « je reste une heure » ---------- */}
      {dans(spec, 1, t) ? (() => {
        const ferme = q('ferme', 1);
        const nuit = p(t, ferme - 0.3, 0.8, E.inOut);
        const z = zoomDrame(t, ferme + 0.1);
        return (
          <AbsoluteFill>
            <AbsoluteFill style={{background: `linear-gradient(${K.bleu}, #ffb86b)`, opacity: nuit}} />
            <Etiquette n="01" texte="« je reste une heure »" t0={S[1].start} couleur={K.bleu} />
            <div style={{position: 'absolute', left: 760, top: 620, transform: `translate(-50%,-50%) rotate(4deg) scale(${sp(t, q('heure', 1) - 0.2, fps, SPR.pop)})`, background: K.creme, border: `8px solid ${K.noir}`, boxShadow: `12px 12px 0 ${K.noir}`, padding: '20px 30px', fontFamily: F.mono, fontWeight: 700, fontSize: 110, color: K.noir}}>
              {t < ferme ? '23:00' : `0${Math.min(6, Math.floor(mix(0, 6.99, p(t, ferme, 0.7, E.inOut))))}:${t < ferme + 0.7 ? String(Math.floor((t * 97) % 60)).padStart(2, '0') : '00'}`}
            </div>
            <AbsoluteFill style={{transform: `scale(${z})`, transformOrigin: '420px 760px'}}>
              <Perso look={POTES[0]} taille={820} x={420} y={1420} graine={1}
                pose={{corps: Math.sin(t * 9) * 6, tete: Math.sin(t * 9 + 1) * 8, brasD: -140 + Math.sin(t * 9) * 30, brasG: -130 + Math.cos(t * 9) * 30, bouche: t > ferme ? 'dents' : 'sourire', yeux: t > ferme ? 'plisses' : 'ouverts'}} />
            </AbsoluteFill>
            {t > ferme + 0.7 ? <div style={{position: 'absolute', left: 720, top: 900, transform: `translate(-50%,-50%) rotate(-6deg) scale(${sp(t, ferme + 0.7, fps, SPR.pop)})`, fontFamily: F.serif, fontStyle: 'italic', fontSize: 120, color: K.noir}}>il ferme.</div> : null}
          </AbsoluteFill>
        );
      })() : null}

      {/* ---------- 2 : la demande au DJ ---------- */}
      {dans(spec, 2, t) ? (() => {
        const toutes = q('toutes', 2);
        const n = t < toutes ? 1 : 1 + Math.min(6, Math.floor((t - toutes) * 5));
        const tape = Math.abs(Math.sin(t * (t > toutes ? 16 : 6)));
        const z = zoomDrame(t, q('minutes', 2) + 0.1);
        return (
          <AbsoluteFill>
            <Etiquette n="02" texte="celui qui demande SA musique" t0={S[2].start} couleur={K.vert} />
            <AbsoluteFill style={{transform: `scale(${z})`, transformOrigin: '800px 700px'}}>
              <Perso look={DJ} taille={700} x={790} y={1260} flip graine={7} pose={{sourcils: n > 3 ? -1 : 0, bouche: n > 3 ? 'plat' : 'sourire', yeux: n > 4 ? 'plisses' : 'ouverts', brasD: 30, brasG: 30}} />
            </AbsoluteFill>
            {/* platines */}
            <div style={{position: 'absolute', left: 470, top: 1130, width: 600, height: 170, background: '#2b2b2b', border: `8px solid ${K.noir}`, borderRadius: 20, boxShadow: `10px 10px 0 ${K.noir}`}}>
              {[0, 1].map((i) => <div key={i} style={{position: 'absolute', left: 50 + i * 300, top: 22, width: 120, height: 120, borderRadius: '50%', background: '#111', border: '6px solid #555', transform: `rotate(${t * 400}deg)`}}><div style={{position: 'absolute', left: 52, top: 6, width: 8, height: 40, background: K.jaune}} /></div>)}
            </div>
            <Perso look={POTES[1]} taille={720} x={270} y={1440} graine={2} pose={{brasD: -40 - tape * 50, brasG: 10, bouche: 'parle', parle: true, tete: 6}} />
            <div style={{position: 'absolute', left: 860, top: 520, transform: `translate(-50%,-50%) scale(${1 + 0.15 * Math.max(0, Math.sin((t - toutes) * 31))})`, background: K.noir, color: K.vert, fontFamily: F.wide, fontWeight: 900, fontStretch: '120%', fontSize: 120, padding: '6px 26px', opacity: t > toutes ? 1 : 0}}>×{n}</div>
          </AbsoluteFill>
        );
      })() : null}

      {/* ---------- 3 : celui qui disparaît… au kebab ---------- */}
      {dans(spec, 3, t) ? (() => {
        const pouf = q('disparaît', 3) + 0.25;
        const kebab = q('kebab', 3);
        const z = zoomDrame(t, kebab + 0.05);
        return (
          <AbsoluteFill>
            <Etiquette n="03" texte="celui qui disparaît" t0={S[3].start} couleur={K.orange} />
            {t < pouf + 0.2 ? <Perso look={POTES[2]} taille={820} x={540} y={1420} graine={3} style={{transform: `translate(-50%,-100%) scale(${1 - p(t, pouf, 0.2)})`}} pose={{bouche: 'sourire', brasD: 20, brasG: 20}} /> : null}
            <Eclat t0={pouf} x={540} y={1000} n={22} r={420} couleurs={['#fff', K.noir, K.jaune]} taille={46} />
            {t > pouf + 0.2 && t < kebab - 0.1 ? <div style={{position: 'absolute', left: 540, top: 1000, transform: 'translate(-50%,-50%)', fontFamily: F.serif, fontStyle: 'italic', fontSize: 130, color: K.noir}}>…où il est ?</div> : null}
            {t >= kebab - 0.1 ? (
              <AbsoluteFill style={{transform: `scale(${z})`, transformOrigin: '540px 900px'}}>
                <div style={{position: 'absolute', left: 540, top: 560, transform: 'translate(-50%,-50%)', fontFamily: F.wide, fontWeight: 900, fontStretch: '125%', fontSize: 170, color: K.jaune, textShadow: `0 0 30px ${K.jaune}, 8px 8px 0 ${K.noir}`, WebkitTextStroke: `5px ${K.noir}`, paintOrder: 'stroke fill'}}>KEBAB</div>
                <Perso look={POTES[2]} taille={820} x={540} y={1460} graine={3} pose={{bouche: 'o', yeux: 'ronds', brasD: -100, brasG: 12}} />
                <div style={{position: 'absolute', left: 820, top: 980, fontSize: 170, transform: `rotate(${Math.sin(t * 6) * 8}deg)`}}>🥙</div>
              </AbsoluteFill>
            ) : null}
          </AbsoluteFill>
        );
      })() : null}

      {/* ---------- 4 : « bien rentré ? », le vrai MVP ---------- */}
      {dans(spec, 4, t) ? (() => {
        const mvp = q('mvp', 4);
        return (
          <AbsoluteFill>
            <Etiquette n="04" texte="« bien rentré ? »" t0={S[4].start} couleur={K.rose} />
            <Perso look={POTES[3]} taille={760} x={330} y={1440} graine={4} pose={{bouche: t > mvp ? 'dents' : 'sourire', brasD: -60, brasG: 12, yeux: t > mvp ? 'plisses' : 'ouverts'}} />
            <div style={{position: 'absolute', left: 790, top: 900, transform: `rotate(6deg) scale(${sp(t, S[4].start + 0.2, fps, SPR.doux)})`}}>
              <Telephone w={430}>
                <div style={{position: 'absolute', inset: 0, background: '#f6f3ee', padding: '90px 18px', display: 'flex', flexDirection: 'column', gap: 14}}>
                  {['Max', 'Inès', 'Yanis', 'Léa', 'Sam'].map((nom, i) => {
                    const t0 = q('rentré', 4) + i * 0.22;
                    return t > t0 ? (
                      <div key={i} style={{alignSelf: 'flex-end', background: K.rose, color: '#fff', borderRadius: 22, padding: '12px 18px', fontFamily: F.wide, fontWeight: 800, fontSize: 30, transform: `scale(${sp(t, t0, fps, SPR.pop)})`, transformOrigin: 'right'}}>
                        @{nom} bien rentré ?
                      </div>
                    ) : null;
                  })}
                </div>
              </Telephone>
            </div>
            {/* la couronne tombe */}
            <div style={{position: 'absolute', left: 330, top: mix(-200, 470, sp(t, mvp - 0.2, fps, SPR.pop)), transform: 'translate(-50%,0) rotate(-8deg)', fontSize: 200, opacity: t > mvp - 0.25 ? 1 : 0}}>👑</div>
            <Eclat t0={mvp} x={330} y={560} n={24} r={380} couleurs={[K.jaune, '#fff', K.rose, K.bleu]} taille={30} />
          </AbsoluteFill>
        );
      })() : null}

      {/* ---------- 5 : tague-le ---------- */}
      {t >= S[5].start - 0.02 ? (
        <AbsoluteFill>
          <div style={{position: 'absolute', left: 80, top: 220, fontFamily: F.wide, fontWeight: 900, fontStretch: '70%', fontSize: 190, color: K.noir, lineHeight: 0.88, textTransform: 'uppercase'}}>
            {['tague', 'ton', 'n°1'].map((l, i) => <div key={i} style={{transform: `scale(${sp(t, S[5].start + i * 0.12, fps, SPR.pop)})`, transformOrigin: 'left center', color: i === 2 ? K.creme : K.noir, WebkitTextStroke: i === 2 ? `6px ${K.noir}` : undefined, paintOrder: 'stroke fill'}}>{l}</div>)}
          </div>
          {POTES.map((look, i) => (
            <Perso key={i} look={look} taille={330} x={170 + i * 250} y={1240} graine={i + 1} pose={{bouche: 'dents', brasD: -130 + Math.sin(t * 8 + i) * 25, brasG: 12, corps: Math.sin(t * 8 + i) * 4}} />
          ))}
          <Commentaire texte="@max c'est toi 💀" t0={S[5].start + 0.9} style={{left: 540, top: 840}} pseudo="léa" />
        </AbsoluteFill>
      ) : null}

      <SousTitres mots={spec.mots} y={1350} taille={72} style="contour" accent={K.jaune} cles={[]} />
      <Grain force={0.06} />
      <BandeSon spec={spec} />
    </AbsoluteFill>
  );
};
