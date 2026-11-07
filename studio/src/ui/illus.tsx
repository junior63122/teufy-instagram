import React from 'react';
import {noise2D} from '@remotion/noise';
import {useT} from './base';
import {F} from '../lib/fonts';
import {clamp, rnd} from '../lib/anim';

// Illustrations vectorielles dessinées en code : personnages, objets. Tout est paramétrable
// (couleurs, pose, expression), donc chaque reel peut avoir ses propres personnages.

export type Pose = {brasG?: number; brasD?: number; tete?: number; corps?: number; sourcils?: number; bouche?: 'parle' | 'sourire' | 'o' | 'dents' | 'plat' | 'triste'; yeux?: 'ouverts' | 'fermes' | 'ronds' | 'plisses'; parle?: boolean};
export type Look = {peau: string; cheveux: string; haut: string; bas?: string; coiffure?: 'court' | 'long' | 'bouclé' | 'chignon' | 'casquette' | 'rasé'; lunettes?: boolean; trait?: string; epaisseur?: number};

/** Personnage « pantin » : tête, coiffure, yeux qui clignent, bouche qui parle, bras articulés. */
export const Perso: React.FC<{look: Look; pose?: Pose; taille?: number; x?: number; y?: number; flip?: boolean; style?: React.CSSProperties; graine?: number}> = ({look, pose = {}, taille = 600, x = 0, y = 0, flip = false, style, graine = 1}) => {
  const {t} = useT();
  const k = taille / 600;
  const trait = look.trait ?? '#141414';
  const ep = look.epaisseur ?? 7;
  const respire = Math.sin(t * 2.4 + graine) * 4;
  const clign = (t * 1.0 + graine * 0.37) % 3.4 < 0.12;
  const yeux = clign && pose.yeux !== 'fermes' ? 'fermes' : pose.yeux ?? 'ouverts';
  // Bouche qui parle : ouverture modulée par un bruit, seulement quand pose.parle.
  const ouv = pose.parle ? clamp(0.25 + 0.75 * Math.abs(noise2D('b' + graine, t * 9, 0))) : 0;
  const bouche = pose.parle ? 'parle' : pose.bouche ?? 'sourire';
  const tete = (pose.tete ?? 0) + Math.sin(t * 1.3 + graine) * 2;
  const sourc = pose.sourcils ?? 0;
  const bras = (angle: number, cote: 1 | -1) => (
    <g transform={`translate(${300 + cote * 112} 470) rotate(${angle * cote})`}>
      <path d={`M0 0 Q ${cote * 30} 90 ${cote * 18} 175`} stroke={trait} strokeWidth={46 + ep * 2} strokeLinecap="round" fill="none" />
      <path d={`M0 0 Q ${cote * 30} 90 ${cote * 18} 175`} stroke={look.haut} strokeWidth={46} strokeLinecap="round" fill="none" />
      <circle cx={cote * 18} cy={188} r={26} fill={look.peau} stroke={trait} strokeWidth={ep} />
    </g>
  );
  return (
    <div style={{position: 'absolute', left: x, top: y, width: taille, height: taille * 1.25, transform: `translate(-50%,-100%) scaleX(${flip ? -1 : 1})`, ...style}}>
      <svg viewBox="0 0 600 750" width={taille} height={taille * 1.25} style={{overflow: 'visible'}}>
        <g transform={`translate(0 ${respire}) rotate(${pose.corps ?? 0} 300 700)`}>
          {/* jambes */}
          <rect x={235} y={600} width={55} height={150} rx={26} fill={look.bas ?? '#26262e'} stroke={trait} strokeWidth={ep} />
          <rect x={310} y={600} width={55} height={150} rx={26} fill={look.bas ?? '#26262e'} stroke={trait} strokeWidth={ep} />
          {/* bras arrière */}
          {bras(pose.brasG ?? 12, -1)}
          {/* buste */}
          <path d="M185 470 Q190 430 240 418 L360 418 Q410 430 415 470 L425 640 Q300 668 175 640 Z" fill={look.haut} stroke={trait} strokeWidth={ep} strokeLinejoin="round" />
          {bras(pose.brasD ?? 12, 1)}
          {/* cou */}
          <rect x={272} y={380} width={56} height={52} rx={18} fill={look.peau} stroke={trait} strokeWidth={ep} />
          {/* tête */}
          <g transform={`rotate(${tete} 300 330)`}>
            {look.coiffure === 'long' ? <path d="M178 250 Q170 420 210 470 L390 470 Q430 420 422 250 Z" fill={look.cheveux} stroke={trait} strokeWidth={ep} /> : null}
            <ellipse cx={300} cy={270} rx={120} ry={132} fill={look.peau} stroke={trait} strokeWidth={ep} />
            <ellipse cx={180} cy={285} rx={16} ry={24} fill={look.peau} stroke={trait} strokeWidth={ep} />
            <ellipse cx={420} cy={285} rx={16} ry={24} fill={look.peau} stroke={trait} strokeWidth={ep} />
            {/* coiffures */}
            {look.coiffure === 'casquette' ? (
              <g><path d="M178 230 Q190 120 300 118 Q410 120 422 230 Z" fill={look.cheveux} stroke={trait} strokeWidth={ep} /><path d="M300 222 Q420 214 480 238 Q430 250 300 240 Z" fill={look.cheveux} stroke={trait} strokeWidth={ep} /></g>
            ) : look.coiffure === 'bouclé' ? (
              <g>{Array.from({length: 11}).map((_, i) => <circle key={i} cx={190 + i * 22} cy={175 + Math.sin(i * 1.7) * 18 + Math.abs(i - 5) * 6} r={38} fill={look.cheveux} stroke={trait} strokeWidth={ep} />)}</g>
            ) : look.coiffure === 'chignon' ? (
              <g><circle cx={300} cy={120} r={52} fill={look.cheveux} stroke={trait} strokeWidth={ep} /><path d="M180 260 Q182 150 300 146 Q418 150 420 260 Q390 200 300 196 Q210 200 180 260 Z" fill={look.cheveux} stroke={trait} strokeWidth={ep} /></g>
            ) : look.coiffure === 'rasé' ? (
              <path d="M184 240 Q190 140 300 138 Q410 140 416 240 Q380 196 300 192 Q220 196 184 240 Z" fill={look.cheveux} opacity={0.55} />
            ) : (
              <path d="M180 262 Q170 140 300 136 Q440 140 420 262 Q400 196 330 206 Q300 170 250 210 Q206 214 180 262 Z" fill={look.cheveux} stroke={trait} strokeWidth={ep} strokeLinejoin="round" />
            )}
            {/* sourcils */}
            <path d={`M232 ${232 - sourc * 10} L280 ${238 + sourc * 6}`} stroke={trait} strokeWidth={ep * 1.4} strokeLinecap="round" />
            <path d={`M320 ${238 + sourc * 6} L368 ${232 - sourc * 10}`} stroke={trait} strokeWidth={ep * 1.4} strokeLinecap="round" />
            {/* yeux */}
            {yeux === 'fermes' ? (
              <g><path d="M240 276 Q256 288 272 276" stroke={trait} strokeWidth={ep} fill="none" strokeLinecap="round" /><path d="M328 276 Q344 288 360 276" stroke={trait} strokeWidth={ep} fill="none" strokeLinecap="round" /></g>
            ) : yeux === 'plisses' ? (
              <g><path d="M238 280 L274 272" stroke={trait} strokeWidth={ep * 1.2} strokeLinecap="round" /><path d="M326 272 L362 280" stroke={trait} strokeWidth={ep * 1.2} strokeLinecap="round" /></g>
            ) : (
              <g>
                <ellipse cx={256} cy={276} rx={yeux === 'ronds' ? 22 : 15} ry={yeux === 'ronds' ? 24 : 19} fill="#fff" stroke={trait} strokeWidth={ep * 0.7} />
                <ellipse cx={344} cy={276} rx={yeux === 'ronds' ? 22 : 15} ry={yeux === 'ronds' ? 24 : 19} fill="#fff" stroke={trait} strokeWidth={ep * 0.7} />
                <circle cx={259} cy={280} r={yeux === 'ronds' ? 8 : 9} fill={trait} />
                <circle cx={347} cy={280} r={yeux === 'ronds' ? 8 : 9} fill={trait} />
              </g>
            )}
            {look.lunettes ? <g fill="none" stroke={trait} strokeWidth={ep}><rect x={222} y={250} width={70} height={54} rx={16} /><rect x={308} y={250} width={70} height={54} rx={16} /><path d="M292 270 L308 270" /></g> : null}
            {/* bouche */}
            {bouche === 'parle' ? <ellipse cx={300} cy={345} rx={30} ry={6 + 26 * ouv} fill="#5a1520" stroke={trait} strokeWidth={ep} />
              : bouche === 'o' ? <ellipse cx={300} cy={348} rx={20} ry={26} fill="#5a1520" stroke={trait} strokeWidth={ep} />
              : bouche === 'dents' ? <g><path d="M250 330 Q300 390 350 330 Z" fill="#fff" stroke={trait} strokeWidth={ep} strokeLinejoin="round" /><path d="M262 340 L338 340" stroke={trait} strokeWidth={ep * 0.5} /></g>
              : bouche === 'plat' ? <path d="M268 345 L332 345" stroke={trait} strokeWidth={ep} strokeLinecap="round" />
              : bouche === 'triste' ? <path d="M262 356 Q300 326 338 356" stroke={trait} strokeWidth={ep} fill="none" strokeLinecap="round" />
              : <path d="M258 332 Q300 372 342 332" stroke={trait} strokeWidth={ep} fill="none" strokeLinecap="round" />}
            <ellipse cx={226} cy={316} rx={20} ry={11} fill="#ff6b6b" opacity={0.28} />
            <ellipse cx={374} cy={316} rx={20} ry={11} fill="#ff6b6b" opacity={0.28} />
          </g>
        </g>
      </svg>
    </div>
  );
};

/** Téléphone (maquette) avec un contenu libre à l'écran. */
export const Telephone: React.FC<{w?: number; children?: React.ReactNode; style?: React.CSSProperties}> = ({w = 520, children, style}) => (
  <div style={{position: 'absolute', width: w, height: w * 2.05, borderRadius: w * 0.14, background: '#0d0d12', padding: w * 0.035, boxShadow: '0 40px 120px rgba(0,0,0,.55), inset 0 0 0 3px #2b2b35', transform: 'translate(-50%,-50%)', ...style}}>
    <div style={{position: 'relative', width: '100%', height: '100%', borderRadius: w * 0.11, overflow: 'hidden', background: '#f6f3ee'}}>
      <div style={{position: 'absolute', top: w * 0.03, left: '50%', width: w * 0.3, height: w * 0.07, borderRadius: 99, background: '#0d0d12', transform: 'translateX(-50%)', zIndex: 5}} />
      {children}
    </div>
  </div>
);

/** Billet d'entrée (carte) : titre, prix, palier. */
export const Billet: React.FC<{titre: string; prix: React.ReactNode; palier?: string; couleur?: string; w?: number; style?: React.CSSProperties}> = ({titre, prix, palier, couleur = '#ff6b4a', w = 440, style}) => (
  <div style={{position: 'absolute', width: w, transform: 'translate(-50%,-50%)', ...style}}>
    <div style={{background: '#fff', borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.35)'}}>
      <div style={{background: couleur, padding: '22px 28px', fontFamily: F.mono, fontWeight: 700, fontSize: 26, color: '#0b0b0f', letterSpacing: '0.08em', textTransform: 'uppercase'}}>{palier ?? 'billet'}</div>
      <div style={{padding: '24px 28px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, borderTop: '3px dashed #ddd'}}>
        <div style={{fontFamily: F.wide, fontWeight: 800, fontStretch: '100%', fontSize: 34, color: '#141414', lineHeight: 1.05}}>{titre}</div>
        <div style={{fontFamily: F.wide, fontWeight: 900, fontStretch: '115%', fontSize: 82, color: '#141414', lineHeight: 0.9, whiteSpace: 'nowrap'}}>{prix}</div>
      </div>
    </div>
  </div>
);

/** Oiseau stylisé (early bird) qui bat des ailes. */
export const Oiseau: React.FC<{taille?: number; couleur?: string; style?: React.CSSProperties}> = ({taille = 200, couleur = '#ffd23f', style}) => {
  const {t} = useT();
  const aile = Math.sin(t * 22) * 30;
  return (
    <svg viewBox="0 0 200 160" width={taille} height={taille * 0.8} style={{position: 'absolute', overflow: 'visible', transform: 'translate(-50%,-50%)', ...style}}>
      <g stroke="#141414" strokeWidth={6} strokeLinejoin="round">
        <ellipse cx={100} cy={95} rx={62} ry={46} fill={couleur} />
        <circle cx={150} cy={66} r={30} fill={couleur} />
        <path d="M176 64 L204 72 L176 80 Z" fill="#ff8a3d" />
        <circle cx={156} cy={60} r={6} fill="#141414" />
        <path d={`M90 80 Q60 ${30 - aile} 30 ${50 - aile} Q70 90 100 92 Z`} fill="#fff3c4" />
        <path d="M40 100 L8 92 L36 118 Z" fill={couleur} />
      </g>
    </svg>
  );
};

/** Foule de silhouettes (bras levés qui bougent). */
export const Foule: React.FC<{n?: number; w?: number; couleur?: string; hauteur?: number; style?: React.CSSProperties; seed?: number}> = ({n = 18, w = 1000, couleur = '#1b1b24', hauteur = 260, style, seed = 1}) => {
  const {t} = useT();
  return (
    <svg viewBox={`0 0 ${w} ${hauteur}`} width={w} height={hauteur} style={{position: 'absolute', overflow: 'visible', ...style}}>
      {Array.from({length: n}).map((_, i) => {
        const x = (i + 0.5) * (w / n) + (rnd(i + seed) - 0.5) * 30;
        const h = hauteur * (0.62 + rnd(i * 3 + seed) * 0.3);
        const bras = rnd(i * 7 + seed) > 0.55;
        const b = Math.sin(t * 5 + i) * 12;
        return (
          <g key={i} fill={couleur}>
            <circle cx={x} cy={hauteur - h + 30} r={26} />
            <rect x={x - 34} y={hauteur - h + 58} width={68} height={h} rx={30} />
            {bras ? <rect x={x + 18} y={hauteur - h - 40 + b} width={18} height={110} rx={9} transform={`rotate(${-20 + b / 2} ${x + 27} ${hauteur - h + 70})`} /> : null}
          </g>
        );
      })}
    </svg>
  );
};

/** Bulle de commentaire Instagram qui se tape lettre par lettre. */
export const Commentaire: React.FC<{texte: string; t0: number; vitesse?: number; pseudo?: string; style?: React.CSSProperties}> = ({texte, t0, vitesse = 22, pseudo = 'toi', style}) => {
  const {t} = useT();
  const n = Math.max(0, Math.floor((t - t0) * vitesse));
  const curseur = Math.floor(t * 2) % 2 === 0 && n < texte.length;
  return (
    <div style={{position: 'absolute', display: 'flex', gap: 22, alignItems: 'center', background: '#fff', borderRadius: 999, padding: '22px 34px 22px 22px', boxShadow: '0 20px 60px rgba(0,0,0,.35)', transform: 'translate(-50%,-50%)', ...style}}>
      <div style={{width: 70, height: 70, borderRadius: '50%', background: 'linear-gradient(135deg,#ff6b4a,#c837ab)', flex: '0 0 auto'}} />
      <div style={{fontFamily: F.wide, fontStretch: '100%', color: '#141414', lineHeight: 1.2}}>
        <div style={{fontWeight: 800, fontSize: 28, opacity: 0.6}}>{pseudo}</div>
        <div style={{fontWeight: 700, fontSize: 44, whiteSpace: 'nowrap'}}>{texte.slice(0, n)}<span style={{opacity: curseur ? 1 : 0}}>|</span></div>
      </div>
    </div>
  );
};
