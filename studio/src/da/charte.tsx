import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Ajuste} from './controle';

// Charte Teufy (DA « Flash nuit ») : une seule grammaire pour tout le compte.
//  - 3 couleurs seulement : nuit, crème, corail (le corail = la marque, jamais plus d'un élément corail par visuel).
//  - 2 polices : Bricolage Grotesque (titres, très gras, serré) + Inter Tight (texte, infos).
//  - Les photos font le travail : flash argentique, grain, noirs profonds. Le texte se pose sur la photo, jamais dans des cadres colorés.
export const C = {
  nuit: '#0B0B0F',
  nuit2: '#16161C',
  creme: '#F4EFE6',
  papier: '#EDE6DA',
  corail: '#FF5A3C',
  gris: '#8C877F',
};
export const T = "'Bricolage', sans-serif"; // titres
export const B = "'InterTight', sans-serif"; // texte

export const policesCharte = () => `
@font-face{font-family:'Bricolage';src:url(${staticFile('fonts/bricolage.woff2')}) format('woff2');font-weight:200 800;font-stretch:75% 100%}
@font-face{font-family:'Bricolage';src:url(${staticFile('fonts/bricolage-ext.woff2')}) format('woff2');font-weight:200 800;font-stretch:75% 100%;unicode-range:U+0100-024F,U+1E00-1EFF,U+20A0-20CF,U+2000-206F}
@font-face{font-family:'InterTight';src:url(${staticFile('fonts/inter-tight.woff2')}) format('woff2');font-weight:100 900}
@font-face{font-family:'InterTight';src:url(${staticFile('fonts/inter-tight-ext.woff2')}) format('woff2');font-weight:100 900;unicode-range:U+0100-024F,U+1E00-1EFF,U+20A0-20CF,U+2000-206F}`;

/** Titre de la charte : Bricolage 800, serré. Les mots entre [crochets] passent en corail.
 *  `taille` = taille maximale : le titre rétrécit tout seul pour tenir en `lignes` lignes, jamais coupé. */
export const Titre: React.FC<{children: string; taille?: number; couleur?: string; style?: React.CSSProperties; largeur?: number; lignes?: number}> = ({children, taille = 120, couleur = C.creme, style, largeur = 80, lignes = 3}) => (
  <Ajuste max={taille} min={40} lignes={lignes} interligne={0.92} style={{fontFamily: T, fontWeight: 800, fontStretch: `${largeur}%`, fontVariationSettings: '"opsz" 96', letterSpacing: '-0.02em', color: couleur, ...style}}>
    {children.split(/(\[[^\]]+\])/).map((p, i) => (p.startsWith('[') ? <span key={i} style={{color: C.corail}}>{p.slice(1, -1)}</span> : <React.Fragment key={i}>{p}</React.Fragment>))}
  </Ajuste>
);

/** Étiquette de rubrique : le repère qui rend le feed lisible (SORTIES, DÉBAT, BON PLAN, ACTU…). */
export const Etiquette: React.FC<{children: string; fond?: string; couleur?: string; style?: React.CSSProperties}> = ({children, fond = C.corail, couleur = C.nuit, style}) => (
  <div data-verif="bloc" style={{display: 'inline-block', whiteSpace: 'nowrap', fontFamily: B, fontWeight: 800, fontSize: 26, letterSpacing: '0.14em', textTransform: 'uppercase', background: fond, color: couleur, padding: '10px 18px 9px', borderRadius: 6, ...style}}>{children}</div>
);

/** Photo plein cadre, étalonnée pareil partout (contraste, noirs denses, grain). */
export const Photo: React.FC<{src: string; position?: string; assombrir?: number; style?: React.CSSProperties}> = ({src, position = 'center', assombrir = 0, style}) => (
  <>
    <Img src={staticFile(src)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: position, filter: 'contrast(1.08) saturate(1.05)', ...style}} />
    {assombrir ? <AbsoluteFill style={{background: `rgba(11,11,15,${assombrir})`}} /> : null}
  </>
);

export const Grain: React.FC<{o?: number}> = ({o = 0.1}) => (
  <AbsoluteFill style={{mixBlendMode: 'overlay', opacity: o, pointerEvents: 'none'}}>
    <svg width="100%" height="100%"><filter id="grainCharte"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={7} /><feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter="url(#grainCharte)" /></svg>
  </AbsoluteFill>
);

/** Signature : logo + @compte, toujours au même endroit (en haut à gauche). */
export const Signature: React.FC<{sombre?: boolean; droite?: React.ReactNode}> = ({sombre = false, droite}) => (
  <div style={{position: 'absolute', left: 56, right: 56, top: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
      <Img src={staticFile('logo.png')} style={{height: 40, filter: sombre ? 'brightness(0)' : 'none'}} />
      <span style={{fontFamily: B, fontWeight: 700, fontSize: 24, color: sombre ? C.nuit : C.creme, opacity: 0.85}}>@teufy_official</span>
    </div>
    {droite}
  </div>
);

/** Dégradé de lisibilité en bas (ou en haut) d'une photo. */
export const Voile: React.FC<{bas?: number; haut?: number}> = ({bas = 0.85, haut = 0.45}) => (
  <AbsoluteFill style={{background: `linear-gradient(180deg, rgba(11,11,15,${haut}) 0%, rgba(11,11,15,0) 28%, rgba(11,11,15,0) 45%, rgba(11,11,15,${bas}) 100%)`}} />
);
