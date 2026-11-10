import React from 'react';
import {AbsoluteFill} from 'remotion';
import {B, C, Etiquette, Grain, Photo, Signature, Titre, Voile} from './charte';
import {Ajuste, ControleVisuel} from './controle';

// Stories « à la une » (1080×1920) : couvertures rondes et stories d'explication, dans la DA « Flash nuit ».
// Instagram ne permet pas de créer les « à la une » par son API : on les produit, Junior les épingle.

const ICONES: Record<string, React.ReactNode> = {
  agenda: <><rect x="14" y="20" width="72" height="66" rx="10" /><path d="M14 40h72M32 12v16M68 12v16" /><circle cx="36" cy="58" r="4" fill={C.corail} stroke="none" /><circle cx="50" cy="58" r="4" fill={C.corail} stroke="none" /><circle cx="64" cy="58" r="4" fill={C.corail} stroke="none" /><circle cx="36" cy="72" r="4" fill={C.corail} stroke="none" /></>,
  infos: <><circle cx="50" cy="50" r="38" /><path d="M50 44v26" /><circle cx="50" cy="31" r="4" fill={C.corail} stroke="none" /></>,
  avantages: <><path d="M12 34a8 8 0 0 0 0 32v12h76V66a8 8 0 0 1 0-32V22H12z" /><path d="M38 62l24-24" /><circle cx="40" cy="40" r="4" /><circle cx="60" cy="60" r="4" /></>,
  themes: <><circle cx="50" cy="46" r="30" /><path d="M20 46h60M50 16c-12 16-12 44 0 60M50 16c12 16 12 44 0 60M26 30h48M26 62h48" /><path d="M50 6v10" /></>,
  partenaires: <><path d="M50 14l10 22 24 3-18 16 5 24-21-12-21 12 5-24-18-16 24-3z" /></>,
  'ce-soir': <><path d="M62 16a34 34 0 1 0 22 52A28 28 0 0 1 62 16z" /><circle cx="74" cy="28" r="3" fill={C.corail} stroke="none" /></>,
};

/** Couverture ronde : seul le cercle central est visible sur le profil. Une icône corail au trait, rien d'autre. */
export const CouvertureUne: React.FC<{icone: string}> = ({icone}) => (
  <AbsoluteFill style={{background: `radial-gradient(60% 40% at 50% 50%, ${C.nuit2}, ${C.nuit})`}}>
    <div style={{position: 'absolute', left: 140, top: 560, width: 800, height: 800, borderRadius: '50%', border: `6px solid ${C.creme}33`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <svg data-verif="bloc" viewBox="0 0 100 100" width={420} height={420} fill="none" stroke={C.corail} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">{ICONES[icone] || ICONES.infos}</svg>
    </div>
    <Grain o={0.06} />
  </AbsoluteFill>
);

/** Story d'explication : photo de la banque, rubrique, titre, 2 à 4 lignes, pied (souvent teufyparty.com). */
export const StoryUne: React.FC<{photo: string; rubrique: string; titre: string; lignes?: string[]; pied?: string; num?: string}> = ({photo, rubrique, titre, lignes = [], pied, num}) => (
  <AbsoluteFill style={{background: C.nuit, overflow: 'hidden'}}>
    <Photo src={photo} assombrir={0.55} />
    <Voile bas={0.97} haut={0.7} />
    <Signature droite={num ? <span style={{fontFamily: B, fontWeight: 700, fontSize: 26, color: C.creme, opacity: 0.8}}>{num}</span> : undefined} />
    <div style={{position: 'absolute', left: 70, right: 70, top: 260, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 30}}>
      <Etiquette>{rubrique}</Etiquette>
      <div style={{alignSelf: 'stretch'}}><Titre taille={128} lignes={4}>{titre}</Titre></div>
    </div>
    <div style={{position: 'absolute', left: 70, right: 70, bottom: 330, display: 'flex', flexDirection: 'column', gap: 0}}>
      {lignes.map((l, i) => (
        <div key={i} style={{display: 'flex', gap: 22, alignItems: 'baseline', padding: '20px 0', borderTop: `1.5px solid ${C.creme}44`}}>
          <span style={{fontFamily: B, fontWeight: 900, fontSize: 38, color: C.corail, width: 34}}>✓</span>
          <Ajuste max={44} lignes={2} interligne={1.2} style={{flex: 1, minWidth: 0, fontFamily: B, fontWeight: 600, color: C.creme}}>{l}</Ajuste>
        </div>
      ))}
    </div>
    {pied ? <div data-verif="bloc" style={{position: 'absolute', left: 70, right: 70, bottom: 200, fontFamily: B, fontWeight: 800, fontSize: 50, color: C.corail, whiteSpace: 'nowrap'}}>{pied}</div> : null}
    <Grain o={0.08} />
    <ControleVisuel />
  </AbsoluteFill>
);
