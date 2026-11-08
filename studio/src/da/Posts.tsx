import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {B, C, Etiquette, Grain, Photo, Signature, T, Titre, Voile} from './charte';
import {nomCourt} from '../posts/Affiches';
import type {Soiree} from '../posts/Affiches';

// Gabarits de la DA « Flash nuit » (1080×1350). Même grammaire partout :
// photo plein cadre + titre Bricolage en bas à gauche + étiquette de rubrique + signature en haut.

/** Couverture générique (carrousel, débat, bon plan, actu, couverture de reel). */
export const Couverture: React.FC<{photo?: string; position?: string; rubrique: string; titre: string; sous?: string; fond?: 'photo' | 'creme' | 'nuit'; grand?: string; vignettes?: string[]; glisse?: boolean}> = ({photo, position, rubrique, titre, sous, fond = 'photo', grand, vignettes, glisse}) => {
  const clair = fond === 'creme';
  const encre = clair ? C.nuit : C.creme;
  return (
    <AbsoluteFill style={{background: clair ? C.papier : C.nuit, overflow: 'hidden'}}>
      {fond === 'photo' && photo ? <><Photo src={photo} position={position} /><Voile bas={0.92} haut={0.5} /></> : null}
      {fond === 'nuit' && photo ? <><Photo src={photo} position={position} assombrir={0.62} /><Voile bas={0.9} haut={0.4} /></> : null}
      <Signature sombre={clair} />
      {grand ? (
        <div style={{position: 'absolute', left: 50, top: 150, fontFamily: T, fontWeight: 800, fontStretch: '75%', fontSize: 420, lineHeight: 0.8, letterSpacing: '-0.04em', color: C.corail}}>{grand}</div>
      ) : null}
      <div style={{position: 'absolute', left: 56, right: 56, bottom: 64}}>
        {vignettes?.length ? (
          <div style={{display: 'flex', gap: 14, marginBottom: 34}}>
            {vignettes.slice(0, 5).map((v, i) => (
              <Img key={i} src={staticFile(v)} style={{width: 150, height: 190, objectFit: 'cover', borderRadius: 10, border: `3px solid ${C.creme}`, transform: `rotate(${[-4, 3, -2, 4, -3][i]}deg)`, boxShadow: '0 14px 30px rgba(0,0,0,.45)'}} />
            ))}
          </div>
        ) : null}
        <Etiquette style={{marginBottom: 26}} fond={clair ? C.nuit : C.corail} couleur={clair ? C.creme : C.nuit}>{rubrique}</Etiquette>
        <Titre taille={titre.length > 34 ? 104 : 128} couleur={encre}>{titre}</Titre>
        {sous || glisse ? <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: B, fontWeight: 500, fontSize: 36, color: encre, marginTop: 22, lineHeight: 1.25}}><span style={{opacity: 0.85}}>{sous}</span>{glisse ? <span style={{fontWeight: 700, fontSize: 30}}>glisse →</span> : null}</div> : null}
      </div>
      <Grain o={clair ? 0.12 : 0.08} />
    </AbsoluteFill>
  );
};

/** Diapo soirée : fond papier, affiche officielle en grand, date corail, infos en Inter. */
export const DiapoSoiree: React.FC<{s: Soiree; i: number; n: number}> = ({s, i, n}) => {
  const nom = nomCourt(s.nom, s.lieu);
  const [jour, num, mois] = s.jour.replace(/\./g, '').split(' ');
  const w = s.ratio ? Math.min(960, 860 * s.ratio) : undefined;
  return (
    <AbsoluteFill style={{background: C.papier, overflow: 'hidden'}}>
      <Signature sombre droite={<span style={{fontFamily: B, fontWeight: 700, fontSize: 24, color: C.nuit}}>{String(i).padStart(2, '0')} / {String(n).padStart(2, '0')}</span>} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 112, height: 880, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <Img src={staticFile(s.image)} style={w ? {width: w, height: w / s.ratio!, borderRadius: 14, boxShadow: '0 30px 70px rgba(11,11,15,.35)'} : {maxWidth: 960, maxHeight: 860, borderRadius: 14, boxShadow: '0 30px 70px rgba(11,11,15,.35)'}} />
      </div>
      <div style={{position: 'absolute', left: 56, right: 56, bottom: 60, display: 'flex', gap: 34, alignItems: 'flex-end'}}>
        <div style={{textAlign: 'center', minWidth: 170}}>
          <div style={{fontFamily: B, fontWeight: 800, fontSize: 28, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.nuit}}>{jour}</div>
          <div style={{fontFamily: T, fontWeight: 800, fontStretch: '75%', fontSize: 170, lineHeight: 0.82, color: C.corail, letterSpacing: '-0.03em'}}>{num}</div>
          <div style={{fontFamily: B, fontWeight: 800, fontSize: 28, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.nuit}}>{mois}</div>
        </div>
        <div style={{flex: 1, borderLeft: `3px solid ${C.nuit}`, paddingLeft: 32, paddingBottom: 6}}>
          <div style={{fontFamily: B, fontWeight: 700, fontSize: 26, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.gris}}>{s.genre}</div>
          <Titre taille={nom.length > 20 ? 72 : 92} couleur={C.nuit} style={{marginTop: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{nom}</Titre>
          <div style={{fontFamily: B, fontWeight: 600, fontSize: 30, color: C.nuit, marginTop: 16, lineHeight: 1.3}}>
            {[s.heures?.replace(/^dès /, ''), s.prix, s.lieu.split('·')[0].replace(/\s*\([^)]*\)/g, '').trim()].filter(Boolean).join('  ·  ')}
          </div>
        </div>
      </div>
      <Grain o={0.12} />
    </AbsoluteFill>
  );
};

/** Dernière diapo : photo, question, liste numérotée, appel à commenter. */
export const DiapoFin: React.FC<{soirees: Soiree[]; photo: string; question?: string}> = ({soirees, photo, question = 'Tu vas [où] cette semaine ?'}) => (
  <AbsoluteFill style={{background: C.nuit, overflow: 'hidden'}}>
    <Photo src={photo} assombrir={0.62} />
    <Voile bas={0.95} haut={0.6} />
    <Signature />
    <div style={{position: 'absolute', left: 56, right: 56, top: 170}}>
      <Titre taille={130}>{question}</Titre>
    </div>
    <div style={{position: 'absolute', left: 56, right: 56, bottom: 200}}>
      {soirees.map((s, i) => (
        <div key={i} style={{display: 'flex', alignItems: 'baseline', gap: 26, padding: '18px 0', borderTop: `1.5px solid ${C.creme}55`}}>
          <span style={{fontFamily: T, fontWeight: 800, fontStretch: '75%', fontSize: 52, color: C.corail, width: 60}}>{i + 1}</span>
          <span style={{fontFamily: B, fontWeight: 700, fontSize: 38, color: C.creme, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{nomCourt(s.nom, s.lieu)}</span>
          <span style={{fontFamily: B, fontWeight: 500, fontSize: 28, color: C.creme, opacity: 0.75}}>{s.jour.split(' ').slice(0, 2).join(' ').toLowerCase()}</span>
        </div>
      ))}
    </div>
    <div style={{position: 'absolute', left: 56, right: 56, bottom: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
      <Etiquette>Commente le numéro</Etiquette>
      <span style={{fontFamily: B, fontWeight: 600, fontSize: 28, color: C.creme, opacity: 0.85}}>et enregistre pour plus tard</span>
    </div>
    <Grain o={0.08} />
  </AbsoluteFill>
);

/** Carrousel complet des sorties (même props que l'ancien, plus les photos de la DA). */
export const CarrouselFlash: React.FC<{soirees: Soiree[]; slide: number; titre: string; sous?: string; photo?: string; photoFin?: string}> = ({soirees, slide, titre, sous, photo = 'decors/da/danse.jpg', photoFin = 'decors/da/selfie.jpg'}) => {
  const n = soirees.length;
  if (slide === 0) return <Couverture photo={photo} rubrique="Sorties · Côte d'Azur" titre={titre} sous={sous} vignettes={soirees.map((s) => s.image)} glisse />;
  if (slide > n) return <DiapoFin soirees={soirees} photo={photoFin} />;
  return <DiapoSoiree s={soirees[slide - 1]} i={slide} n={n} />;
};
