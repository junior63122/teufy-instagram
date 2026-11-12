import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {B, C, Etiquette, Grain, Photo, Signature, T, Titre, Voile} from './charte';
import {Ajuste, ControleVisuel} from './controle';
import {nomCourt} from '../posts/Affiches';
import type {Soiree} from '../posts/Affiches';

// Gabarits de la DA « Flash nuit » (1080×1350). Même grammaire partout :
// photo plein cadre + titre Bricolage en bas à gauche + étiquette de rubrique + signature en haut.

/** Couverture générique (carrousel, débat, bon plan, actu, couverture de reel). */
export const Couverture: React.FC<{photo?: string; position?: string; rubrique: string; titre: string; sous?: string; fond?: 'photo' | 'creme' | 'nuit'; grand?: string; vignettes?: string[]; glisse?: boolean; options?: string[]}> = ({photo, position, rubrique, titre, sous, fond = 'photo', grand, vignettes, glisse, options}) => {
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
          <div style={{display: 'flex', marginBottom: 40, paddingLeft: 10}}>
            {vignettes.slice(0, 3).map((v, i) => (
              <Img key={i} src={staticFile(v)} style={{width: 270, height: 338, objectFit: 'cover', borderRadius: 12, border: `4px solid ${C.creme}`, marginLeft: i ? -40 : 0, transform: `rotate(${[-5, 2, 6][i]}deg) translateY(${[10, -8, 6][i]}px)`, boxShadow: '0 18px 40px rgba(0,0,0,.5)', zIndex: 3 - i}} />
            ))}
          </div>
        ) : null}
        <Etiquette style={{marginBottom: 26}} fond={clair ? C.nuit : C.corail} couleur={clair ? C.creme : C.nuit}>{rubrique}</Etiquette>
        <Titre taille={titre.length > 34 ? 104 : 128} lignes={options?.length ? 4 : 3} couleur={encre}>{titre}</Titre>
        {options?.length ? (
          <div style={{display: 'flex', flexDirection: 'column', gap: 14, marginTop: 30}}>
            {options.slice(0, 2).map((o, i) => (
              <div key={i} style={{display: 'flex', alignItems: 'center', gap: 18, background: clair ? '#fff' : 'rgba(244,239,230,.12)', border: `2px solid ${encre}33`, borderRadius: 14, padding: '14px 20px'}}>
                <span style={{fontFamily: T, fontWeight: 800, fontSize: 44, color: C.corail, width: 40}}>{'AB'[i]}</span>
                <Ajuste max={36} style={{flex: 1, minWidth: 0, fontFamily: B, fontWeight: 700, color: encre}}>{o}</Ajuste>
              </div>
            ))}
          </div>
        ) : null}
        {sous || glisse ? <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24, fontFamily: B, color: encre, marginTop: 22}}><Ajuste max={36} lignes={2} interligne={1.25} style={{flex: 1, minWidth: 0, fontWeight: 500, opacity: 0.85}}>{sous ?? ''}</Ajuste>{glisse ? <span data-verif="bloc" style={{fontWeight: 700, fontSize: 30, whiteSpace: 'nowrap'}}>glisse →</span> : null}</div> : null}
      </div>
      <Grain o={clair ? 0.12 : 0.08} />
      <ControleVisuel />
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
      <Signature sombre />{/* pas de compteur maison : Instagram affiche déjà le sien, au même endroit (chevauchement, nombres différents) */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 112, height: 880, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <Img data-verif="image" src={staticFile(s.image)} style={w ? {width: w, height: w / s.ratio!, borderRadius: 14, boxShadow: '0 30px 70px rgba(11,11,15,.35)'} : {maxWidth: 960, maxHeight: 860, borderRadius: 14, boxShadow: '0 30px 70px rgba(11,11,15,.35)'}} />
      </div>
      <div style={{position: 'absolute', left: 56, right: 56, bottom: 60, display: 'flex', gap: 34, alignItems: 'flex-end'}}>
        <div style={{textAlign: 'center', minWidth: 170}}>
          <div style={{fontFamily: B, fontWeight: 800, fontSize: 28, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.nuit}}>{jour}</div>
          <div style={{fontFamily: T, fontWeight: 800, fontStretch: '75%', fontSize: 170, lineHeight: 0.82, color: C.corail, letterSpacing: '-0.03em'}}>{num}</div>
          <div style={{fontFamily: B, fontWeight: 800, fontSize: 28, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.nuit}}>{mois}</div>
        </div>
        <div style={{flex: 1, borderLeft: `3px solid ${C.nuit}`, paddingLeft: 32, paddingBottom: 6}}>
          <Ajuste max={26} style={{fontFamily: B, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.gris}}>{s.genre}</Ajuste>
          <Titre taille={92} lignes={2} couleur={C.nuit} style={{marginTop: 8}}>{nom}</Titre>
          <Ajuste max={30} lignes={2} interligne={1.3} style={{fontFamily: B, fontWeight: 600, color: C.nuit, marginTop: 16}}>
            {[s.heures?.replace(/^dès /, ''), s.prix, s.lieu.split('·')[0].replace(/\s*\([^)]*\)/g, '').trim()].filter(Boolean).join('  ·  ')}
          </Ajuste>
        </div>
      </div>
      <Grain o={0.12} />
      <ControleVisuel />
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
    <div style={{position: 'absolute', left: 56, right: 56, bottom: 270}}>
      {soirees.map((s, i) => (
        <div key={i} style={{display: 'flex', alignItems: 'baseline', gap: 26, padding: soirees.length > 6 ? '9px 0' : '18px 0', borderTop: `1.5px solid ${C.creme}55`}}>
          <span style={{fontFamily: T, fontWeight: 800, fontStretch: '75%', fontSize: soirees.length > 6 ? 44 : 52, color: C.corail, width: 60}}>{i + 1}</span>
          <Ajuste max={38} style={{fontFamily: B, fontWeight: 700, color: C.creme, flex: 1, minWidth: 0, whiteSpace: 'nowrap'}}>{nomCourt(s.nom, s.lieu)}</Ajuste>
          <span style={{fontFamily: B, fontWeight: 500, fontSize: 28, color: C.creme, opacity: 0.75, whiteSpace: 'nowrap'}}>{s.jour.split(' ').slice(0, 2).join(' ').toLowerCase()}</span>
        </div>
      ))}
    </div>
    {/* Renvoi vers le site : l'agenda complet (toutes les soirées, filtres par ville, style et prix). */}
    <div data-verif="bloc" style={{position: 'absolute', left: 56, right: 56, bottom: 150, display: 'flex', alignItems: 'center', gap: 16, padding: '18px 0', borderTop: `1.5px solid ${C.creme}55`, fontFamily: B, color: C.creme, whiteSpace: 'nowrap'}}>
      <span style={{fontWeight: 500, fontSize: 30, opacity: 0.85}}>Toutes les soirées de la Côte sur</span>
      <span style={{fontWeight: 800, fontSize: 36, color: C.corail}}>teufyparty.com</span>
    </div>
    <div style={{position: 'absolute', left: 56, right: 56, bottom: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
      <Etiquette>Commente le numéro</Etiquette>
      <span data-verif="bloc" style={{fontFamily: B, fontWeight: 600, fontSize: 28, color: C.creme, opacity: 0.85, whiteSpace: 'nowrap'}}>et enregistre pour plus tard</span>
    </div>
    <Grain o={0.08} />
    <ControleVisuel />
  </AbsoluteFill>
);

/** Carrousel complet des sorties (même props que l'ancien, plus les photos de la DA). */
export const CarrouselFlash: React.FC<{soirees: Soiree[]; slide: number; titre: string; sous?: string; photo?: string; photoFin?: string; rubrique?: string; question?: string}> = ({soirees, slide, titre, sous, photo = 'decors/da/danse.jpg', photoFin = 'decors/da/selfie.jpg', rubrique = "Sorties · Côte d'Azur", question}) => {
  const n = soirees.length;
  if (slide === 0) return <Couverture photo={photo} rubrique={rubrique} titre={titre} sous={sous} vignettes={[...soirees.filter((s: any) => s.vedette), ...soirees.filter((s: any) => !s.vedette)].map((s) => s.image)} glisse />;
  if (slide > n) return <DiapoFin soirees={soirees} photo={photoFin} question={question} />;
  return <DiapoSoiree s={soirees[slide - 1]} i={slide} n={n} />;
};

/** Post « flash » de la veille (annonce exceptionnelle ou actu nuit) dans la DA : photo de nuit, visuel officiel, titre, source. */
const ALERTE = '#E3261B'; // rouge d'alerte : réservé aux infos de dernière minute
export type FlashDA = {type: 'annonce' | 'actu'; surtitre: string; titre: string; sous_titre: string; faits: string[]; source: string; date: string; image?: string};
export const PostFlashDA: React.FC<{f: FlashDA; photo?: string}> = ({f, photo}) => {
  const fond = photo || (f.type === 'actu' ? 'decors/da/foule.jpg' : 'decors/da/lasers.jpg');
  return (
    <AbsoluteFill style={{background: C.nuit, overflow: 'hidden'}}>
      <Photo src={fond} assombrir={0.66} />
      <Voile bas={0.95} haut={0.6} />
      {/* Bandeau d'alerte : on comprend au premier coup d'œil que c'est une info importante qui vient de tomber */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 150, background: ALERTE, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', boxShadow: '0 12px 40px rgba(0,0,0,.45)'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <svg width={54} height={54} viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill={C.creme} /></svg>
          <span style={{fontFamily: T, fontWeight: 800, fontStretch: '80%', fontSize: 64, color: C.creme, letterSpacing: '-0.01em', lineHeight: 1}}>INFO DE DERNIÈRE MINUTE</span>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 150, height: 22, background: `repeating-linear-gradient(-45deg, ${C.nuit} 0 22px, ${C.creme} 22px 44px)`}} />
      <div style={{position: 'absolute', left: 48, right: 48, top: 200, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(11,11,15,.7)', border: `2px solid ${ALERTE}`, borderRadius: 999, padding: '8px 20px'}}>
          <span style={{width: 18, height: 18, borderRadius: '50%', background: ALERTE, boxShadow: `0 0 0 6px ${ALERTE}55`}} />
          <span style={{fontFamily: B, fontWeight: 800, fontSize: 26, letterSpacing: '0.12em', color: C.creme}}>EN DIRECT · {f.date}</span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <Img src={staticFile('logo.png')} style={{height: 38}} />
          <span style={{fontFamily: B, fontWeight: 700, fontSize: 24, color: C.creme}}>@teufy_official</span>
        </div>
      </div>
      {f.image ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 280, height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Img data-verif="image" src={staticFile(f.image)} style={{maxWidth: 860, maxHeight: 470, minHeight: 430, borderRadius: 14, boxShadow: '0 30px 80px rgba(0,0,0,.6)', transform: 'rotate(-2deg)'}} />
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 56, right: 56, bottom: 64}}>
        <Etiquette style={{marginBottom: 24}} fond={ALERTE} couleur={C.creme}>{f.surtitre}</Etiquette>
        <Titre taille={f.titre.length > 45 ? 92 : 112}>{f.titre}</Titre>
        {f.sous_titre ? <Ajuste max={38} lignes={2} interligne={1.25} style={{fontFamily: B, fontWeight: 600, color: C.creme, marginTop: 20}}>{f.sous_titre}</Ajuste> : null}
        {!f.image && f.faits.length ? (
          <div style={{marginTop: 26}}>
            {f.faits.slice(0, 3).map((x, i) => (
              <div key={i} style={{display: 'flex', gap: 18, padding: '12px 0', borderTop: `1.5px solid ${C.creme}44`, fontFamily: B, fontWeight: 500, fontSize: 30, color: C.creme, lineHeight: 1.25}}>
                <span style={{fontFamily: T, fontWeight: 800, color: C.corail}}>{i + 1}</span>{x}
              </div>
            ))}
          </div>
        ) : null}
        <Ajuste max={24} style={{fontFamily: B, fontWeight: 600, color: C.creme, opacity: 0.7, marginTop: 24, letterSpacing: '0.04em', whiteSpace: 'nowrap'}}>{`Source : ${f.source}`}</Ajuste>
      </div>
      <Grain o={0.08} />
      <ControleVisuel />
    </AbsoluteFill>
  );
};

/** Story qui relaie un nouveau post (1080×1920) : la couverture du post en grand, « Nouveau post », renvoi vers le profil. */
export const StoryRelais: React.FC<{image: string; rubrique?: string; texte?: string}> = ({image, rubrique = 'Nouveau post', texte = 'Le post complet est sur le profil'}) => (
  <AbsoluteFill style={{background: C.nuit, overflow: 'hidden'}}>
    <Img src={staticFile(image)} style={{position: 'absolute', inset: -120, width: 1320, height: 2160, objectFit: 'cover', filter: 'blur(60px) saturate(1.3) brightness(0.45)'}} />
    <div style={{position: 'absolute', left: 0, right: 0, top: 200, display: 'flex', justifyContent: 'center'}}>
      <Img data-verif="image" src={staticFile(image)} style={{width: 860, height: 1075, objectFit: 'cover', borderRadius: 22, boxShadow: '0 40px 100px rgba(0,0,0,.6)', transform: 'rotate(-2deg)'}} />
    </div>
    <div style={{position: 'absolute', left: 70, right: 70, bottom: 230, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 22}}>
      <Etiquette>{rubrique}</Etiquette>
      <Ajuste max={52} lignes={2} interligne={1.15} style={{alignSelf: 'stretch', fontFamily: B, fontWeight: 700, color: C.creme}}>{texte}</Ajuste>
    </div>
    <Grain o={0.08} />
    <ControleVisuel />
  </AbsoluteFill>
);

/** Couverture de reel (1080×1920) : même grammaire que les posts, tout le texte dans la zone 3:4 centrale
 *  (y 240 → 1680) que la grille du profil affiche. Le feed reste cohérent entre posts et reels. */
export const CouvertureReel: React.FC<{photo: string; position?: string; rubrique: string; titre: string; sous?: string}> = ({photo, position, rubrique, titre, sous}) => (
  <AbsoluteFill style={{background: C.nuit, overflow: 'hidden'}}>
    <Photo src={photo} position={position} />
    <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(11,11,15,.55) 0%, rgba(11,11,15,.2) 22%, rgba(11,11,15,0) 40%, rgba(11,11,15,.35) 58%, rgba(11,11,15,.92) 88%, rgba(11,11,15,.95) 100%)'}} />
    <div style={{position: 'absolute', left: 0, right: 0, top: 240 - 48}}><Signature /></div>
    <div style={{position: 'absolute', left: 56, right: 56, bottom: 1920 - 1680 + 64}}>
      <Etiquette style={{marginBottom: 26}}>{rubrique}</Etiquette>
      <Titre taille={128} lignes={3}>{titre}</Titre>
      {sous ? <Ajuste max={36} lignes={2} interligne={1.25} style={{fontFamily: B, fontWeight: 500, color: C.creme, opacity: 0.85, marginTop: 22}}>{sous}</Ajuste> : null}
    </div>
    <Grain o={0.08} />
    <ControleVisuel />
  </AbsoluteFill>
);
