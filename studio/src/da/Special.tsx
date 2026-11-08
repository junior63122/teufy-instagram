import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {B, C, Grain, Photo, T} from './charte';
import {Ajuste, ControleVisuel} from './controle';

// « Édition spéciale » des jours de fête : la grammaire Teufy (photo, Bricolage, signature) + un habillage propre à
// chaque fête (couleur, décor dessiné, cadre, tampon « édition spéciale »), pour qu'on la reconnaisse au premier coup d'œil.

export type Theme = 'noel' | 'halloween' | 'reveillon' | 'nouvelan' | 'saintvalentin' | 'fetemusique' | '14juillet';
const THEMES: Record<Theme, {accent: string; accent2: string; encre: string; deco: Deco; voile: string}> = {
  noel: {accent: '#D62828', accent2: '#F4EFE6', encre: '#F4EFE6', deco: 'neige', voile: 'rgba(10,30,40,'},
  halloween: {accent: '#FF7A00', accent2: '#8E44FF', encre: '#F4EFE6', deco: 'halloween', voile: 'rgba(20,6,30,'},
  reveillon: {accent: '#E9C46A', accent2: '#F4EFE6', encre: '#F4EFE6', deco: 'paillettes', voile: 'rgba(11,11,15,'},
  nouvelan: {accent: '#E9C46A', accent2: '#FF5A3C', encre: '#F4EFE6', deco: 'paillettes', voile: 'rgba(11,11,15,'},
  saintvalentin: {accent: '#FF2E6E', accent2: '#FFD1DC', encre: '#F4EFE6', deco: 'coeurs', voile: 'rgba(40,6,18,'},
  fetemusique: {accent: '#FFD60A', accent2: '#FF5A3C', encre: '#F4EFE6', deco: 'notes', voile: 'rgba(11,11,15,'},
  '14juillet': {accent: '#3A86FF', accent2: '#E63946', encre: '#F4EFE6', deco: 'feux', voile: 'rgba(6,12,32,'},
};
type Deco = 'neige' | 'halloween' | 'paillettes' | 'coeurs' | 'notes' | 'feux';

const hasard = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const Flocon: React.FC<{t: number; c: string}> = ({t, c}) => (
  <svg width={t} height={t} viewBox="-12 -12 24 24">{[0, 60, 120].map((a) => <g key={a} transform={`rotate(${a})`} stroke={c} strokeWidth={1.6} strokeLinecap="round"><line x1={0} y1={-11} x2={0} y2={11} /><line x1={-3} y1={-8} x2={0} y2={-5} /><line x1={3} y1={-8} x2={0} y2={-5} /><line x1={-3} y1={8} x2={0} y2={5} /><line x1={3} y1={8} x2={0} y2={5} /></g>)}</svg>
);
const Coeur: React.FC<{t: number; c: string}> = ({t, c}) => <svg width={t} height={t} viewBox="0 0 24 24"><path d="M12 21s-8-5.3-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.7-8 11-8 11z" fill={c} /></svg>;
const Etoile: React.FC<{t: number; c: string}> = ({t, c}) => <svg width={t} height={t} viewBox="0 0 24 24"><path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" fill={c} /></svg>;
const Note: React.FC<{t: number; c: string}> = ({t, c}) => <svg width={t} height={t} viewBox="0 0 24 24"><path d="M9 18a3 3 0 1 1-2-2.8V5l12-3v11a3 3 0 1 1-2-2.8V6.5L9 8.5z" fill={c} /></svg>;
const Citrouille: React.FC<{t: number}> = ({t}) => (
  <svg width={t} height={t} viewBox="0 0 24 24"><path d="M12 6c-2-2-9-1-9 7s7 9 9 7c2 2 9 1 9-7s-7-9-9-7z" fill="#FF7A00" /><path d="M12 6c-1 3-1 11 0 14M8 7c-2 3-2 9 0 12M16 7c2 3 2 9 0 12" stroke="#B85400" strokeWidth={1} fill="none" /><path d="M12 6c0-2 1-3 2-4" stroke="#2D6A4F" strokeWidth={1.6} fill="none" /><path d="M8.5 12l1.5-2 1.5 2zM12.5 12l1.5-2 1.5 2zM9 15.5c1.5 1 4.5 1 6 0l-1 1.5-1-1-1 1-1-1-1 1z" fill="#2B1300" /></svg>
);
const ChauveSouris: React.FC<{t: number; c: string}> = ({t, c}) => <svg width={t} height={t * 0.5} viewBox="0 0 24 12"><path d="M12 4c1-2 2-2 2 0 3-3 7-3 10 1-3-1-4 1-5 3-1-1-3-1-3 1-1-1-3-1-4 1-1-2-3-2-4-1 0-2-2-2-3-1-1-2-2-4-5-3 3-4 7-4 10-1 0-2 1-2 2 0z" fill={c} /></svg>;
const Gerbe: React.FC<{t: number; c: string}> = ({t, c}) => (
  <svg width={t} height={t} viewBox="-12 -12 24 24">{Array.from({length: 16}).map((_, i) => { const a = (i / 16) * Math.PI * 2; return <line key={i} x1={Math.cos(a) * 3} y1={Math.sin(a) * 3} x2={Math.cos(a) * 11} y2={Math.sin(a) * 11} stroke={c} strokeWidth={1.2} strokeLinecap="round" />; })}</svg>
);

const Decor: React.FC<{deco: Deco; a: string; b: string}> = ({deco, a, b}) => {
  const n = deco === 'neige' ? 70 : deco === 'paillettes' ? 60 : deco === 'feux' ? 7 : 26;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {Array.from({length: n}).map((_, i) => {
        const x = hasard(i) * 1080, y = hasard(i * 3 + 1) * 1350, r = hasard(i * 7 + 2);
        // moins de décor sur la zone du titre (bas de l'image) : lisibilité d'abord
        const surTitre = y > 820 && deco !== 'halloween';
        const style: React.CSSProperties = {position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) rotate(${r * 360}deg)`, opacity: surTitre ? 0.18 : 0.55 + r * 0.45};
        if (deco === 'neige') return <div key={i} style={style}><Flocon t={14 + r * 30} c="#ffffff" /></div>;
        if (deco === 'paillettes') return <div key={i} style={style}>{i % 3 ? <Etoile t={10 + r * 26} c={i % 2 ? a : '#fff8e1'} /> : <div style={{width: 10 + r * 10, height: 5, background: i % 2 ? a : b, borderRadius: 2}} />}</div>;
        if (deco === 'coeurs') return <div key={i} style={style}><Coeur t={18 + r * 34} c={i % 3 ? a : b} /></div>;
        if (deco === 'notes') return <div key={i} style={style}><Note t={22 + r * 34} c={i % 2 ? a : b} /></div>;
        if (deco === 'feux') return <div key={i} style={{...style, top: hasard(i * 3 + 1) * 520, opacity: 0.9}}><Gerbe t={140 + r * 160} c={i % 2 ? a : b} /></div>;
        // halloween : citrouilles en bas, chauves-souris en haut
        return i % 3 === 0
          ? <div key={i} style={{...style, top: 1350 - 40 - r * 60, transform: 'translate(-50%,-50%)'}}><Citrouille t={70 + r * 50} /></div>
          : <div key={i} style={{...style, top: 60 + r * 420, transform: `translate(-50%,-50%) rotate(${(r - 0.5) * 30}deg)`}}><ChauveSouris t={50 + r * 50} c="#120814" /></div>;
      })}
    </AbsoluteFill>
  );
};

export const PostSpecial: React.FC<{theme: Theme; photo: string; titre: string; sous?: string; rubrique: string}> = ({theme, photo, titre, sous, rubrique}) => {
  const th = THEMES[theme] || THEMES.noel;
  const mots = titre.split(/(\[[^\]]+\])/).map((x, i) => (x.startsWith('[') ? <span key={i} style={{color: th.accent}}>{x.slice(1, -1)}</span> : <React.Fragment key={i}>{x}</React.Fragment>));
  return (
    <AbsoluteFill style={{background: C.nuit, overflow: 'hidden'}}>
      <Photo src={photo} />
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${th.voile}.55) 0%, ${th.voile}0) 30%, ${th.voile}.15) 55%, ${th.voile}.92) 100%)`}} />
      <Decor deco={th.deco} a={th.accent} b={th.accent2} />
      {/* cadre de l'édition spéciale */}
      <div style={{position: 'absolute', inset: 26, border: `6px solid ${th.accent}`, borderRadius: 26, boxShadow: `0 0 40px ${th.accent}88, inset 0 0 40px ${th.accent}44`}} />
      {/* en-tête : signature + tampon « édition spéciale » */}
      <div style={{position: 'absolute', left: 64, right: 64, top: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <Img src={staticFile('logo.png')} style={{height: 40}} />
          <span style={{fontFamily: B, fontWeight: 700, fontSize: 24, color: C.creme}}>@teufy_official</span>
        </div>
        <div data-verif="bloc" style={{background: th.accent, color: theme === 'reveillon' || theme === 'nouvelan' || theme === 'fetemusique' ? C.nuit : C.creme, fontFamily: B, fontWeight: 900, fontSize: 24, letterSpacing: '0.16em', padding: '10px 18px', borderRadius: 8, transform: 'rotate(3deg)', whiteSpace: 'nowrap'}}>ÉDITION SPÉCIALE</div>
      </div>
      {/* titre central, très grand */}
      <div style={{position: 'absolute', left: 70, right: 70, bottom: 110, textAlign: 'center'}}>
        <div style={{fontFamily: B, fontWeight: 800, fontSize: 28, letterSpacing: '0.28em', color: th.accent, textTransform: 'uppercase', marginBottom: 14}}>{rubrique}</div>
        <Ajuste max={168} min={60} lignes={2} interligne={0.9} style={{fontFamily: T, fontWeight: 800, fontStretch: '80%', fontVariationSettings: '"opsz" 96', letterSpacing: '-0.025em', color: th.encre, textShadow: `0 6px 0 ${C.nuit}, 0 18px 60px rgba(0,0,0,.6)`}}>{mots}</Ajuste>
        {sous ? <Ajuste max={36} lignes={2} interligne={1.25} style={{fontFamily: B, fontWeight: 600, color: C.creme, marginTop: 22}}>{sous}</Ajuste> : null}
      </div>
      <Grain o={0.08} />
      <ControleVisuel />
    </AbsoluteFill>
  );
};
