import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {B, C, Etiquette, Grain, Photo, Signature, T, Titre, Voile} from './charte';
import {Ajuste, ControleVisuel} from './controle';
import {nomCourt} from '../posts/Affiches';
import type {Soiree} from '../posts/Affiches';

// Gabarits de la DA « Flash nuit » (1080×1350). Même grammaire partout :
// photo plein cadre + titre Bricolage en bas à gauche + étiquette de rubrique + signature en haut.

/** Mises en page des couvertures (19/11/2026, directeur : « tous les posts ont la même couverture (image + texte en bas),
 *  triste et monotone »). Même DA (photos de nuit, Bricolage, nuit/crème/corail, étiquette), cinq compositions qui tournent
 *  dans la grille : jamais la même deux fois de suite (src/photos.mjs, choisirMise). */
export type Mise = 'bas' | 'haut' | 'cadre' | 'bandeau' | 'centre';

/** Couverture générique (carrousel, débat, bon plan, actu, couverture de reel). */
export const Couverture: React.FC<{photo?: string; position?: string; rubrique: string; titre: string; sous?: string; fond?: 'photo' | 'creme' | 'nuit'; grand?: string; vignettes?: string[]; glisse?: boolean; options?: string[]; mise?: Mise}> = ({photo, position, rubrique, titre, sous, fond = 'photo', grand, vignettes, glisse, options, mise = 'bas'}) => {
  // Sans photo (bon plan sur fond crème) : la composition d'origine.
  const m = (photo && fond !== 'creme' ? mise : 'bas') as Mise;
  const papier = fond === 'creme' || m === 'cadre';
  const encre = papier ? C.nuit : C.creme;
  const centre = m === 'centre';
  const debat = !!options?.length;
  const long = titre.length > 50; // question de débat sur 4 lignes : photo plus courte
  const hautCadre = debat ? (long ? 360 : 540) : 560; // hauteur de la photo encadrée
  const hautBandeau = debat ? (long ? 500 : 700) : 760; // hauteur de la photo du bandeau
  const vign = vignettes?.length ? vignettes.slice(0, 3) : [];
  const petites = m === 'cadre' || m === 'bandeau';
  const pile = vign.length ? (
    <div style={{display: 'flex', justifyContent: centre ? 'center' : 'flex-start', paddingLeft: 10}}>
      {vign.map((v, i) => (
        <Img key={i} src={staticFile(v)} style={{width: petites ? 190 : 270, height: petites ? 238 : 338, objectFit: 'cover', borderRadius: 12, border: `4px solid ${C.creme}`, marginLeft: i ? (petites ? -30 : -40) : 0, transform: `rotate(${[-5, 2, 6][i]}deg) translateY(${[10, -8, 6][i]}px)`, boxShadow: '0 18px 40px rgba(0,0,0,.5)', zIndex: 3 - i}} />
      ))}
    </div>
  ) : null;
  const texte = (
    <>
      <Etiquette style={{marginBottom: 26}} fond={papier ? C.nuit : C.corail} couleur={papier ? C.creme : C.nuit}>{rubrique}</Etiquette>
      <Titre taille={titre.length > 34 ? 104 : 128} lignes={debat ? 4 : 3} couleur={encre} style={centre ? {textAlign: 'center'} : undefined}>{titre}</Titre>
      {debat ? (
        <div style={{display: 'flex', flexDirection: 'column', gap: 14, marginTop: 30, textAlign: 'left'}}>
          {options!.slice(0, 2).map((o, i) => (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 18, background: papier ? '#fff' : 'rgba(244,239,230,.12)', border: `2px solid ${encre}33`, borderRadius: 14, padding: '14px 20px'}}>
              <span style={{fontFamily: T, fontWeight: 800, fontSize: 44, color: C.corail, width: 40}}>{'AB'[i]}</span>
              <Ajuste max={36} style={{flex: 1, minWidth: 0, fontFamily: B, fontWeight: 700, color: encre}}>{o}</Ajuste>
            </div>
          ))}
        </div>
      ) : null}
      {sous || glisse ? <div style={{display: 'flex', justifyContent: centre ? 'center' : 'space-between', alignItems: 'baseline', gap: 24, fontFamily: B, color: encre, marginTop: 22}}><Ajuste max={36} lignes={2} interligne={1.25} style={{flex: centre ? undefined : 1, minWidth: 0, maxWidth: centre ? 760 : undefined, fontWeight: 500, opacity: 0.85, textAlign: centre ? 'center' : 'left'}}>{sous ?? ''}</Ajuste>{glisse && !centre ? <span data-verif="bloc" style={{fontWeight: 700, fontSize: 30, whiteSpace: 'nowrap'}}>glisse →</span> : null}</div> : null}
    </>
  );
  return (
    <AbsoluteFill style={{background: papier ? C.papier : C.nuit, overflow: 'hidden'}}>
      {m === 'bas' && fond === 'photo' && photo ? <><Photo src={photo} position={position} /><Voile bas={0.92} haut={0.5} /></> : null}
      {m === 'bas' && fond === 'nuit' && photo ? <><Photo src={photo} position={position} assombrir={0.62} /><Voile bas={0.9} haut={0.4} /></> : null}
      {m === 'haut' ? <><Photo src={photo!} position={position} assombrir={fond === 'nuit' ? 0.4 : 0} /><AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(11,11,15,.93) 0%, rgba(11,11,15,.82) 38%, rgba(11,11,15,.15) 68%, rgba(11,11,15,.55) 100%)'}} /></> : null}
      {m === 'centre' ? <><Photo src={photo!} position={position} assombrir={0.58} /><AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(11,11,15,.35) 0%, rgba(11,11,15,.8) 75%)'}} /></> : null}
      {m === 'cadre' ? (
        <div style={{position: 'absolute', left: 56, right: 56, top: 128, height: hautCadre, borderRadius: 16, overflow: 'hidden', transform: 'rotate(-1.2deg)', boxShadow: '0 30px 70px rgba(11,11,15,.35)'}}>
          <Photo src={photo!} position={position} />
        </div>
      ) : null}
      {m === 'bandeau' ? (
        <>
          <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: hautBandeau, overflow: 'hidden'}}>
            <Photo src={photo!} position={position} />
            <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(11,11,15,.5) 0%, rgba(11,11,15,0) 30%)'}} />
          </div>
          <div style={{position: 'absolute', left: 0, right: 0, top: hautBandeau, height: 10, background: C.corail}} />
        </>
      ) : null}
      <Signature sombre={papier} />
      {grand ? (
        <div style={{position: 'absolute', left: 50, top: 150, fontFamily: T, fontWeight: 800, fontStretch: '75%', fontSize: 420, lineHeight: 0.8, letterSpacing: '-0.04em', color: C.corail}}>{grand}</div>
      ) : null}
      {m === 'haut' ? (
        <>
          <div style={{position: 'absolute', left: 56, right: 56, top: 150}}>{texte}</div>
          {pile ? <div style={{position: 'absolute', right: 70, bottom: 70, display: 'flex', justifyContent: 'flex-end'}}>{pile}</div> : null}
        </>
      ) : m === 'centre' ? (
        <div style={{position: 'absolute', left: 56, right: 56, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingTop: 60}}>
          {pile ? <div style={{marginBottom: 40}}>{pile}</div> : null}
          {texte}
        </div>
      ) : (
        <>
          {pile && petites ? <div style={{position: 'absolute', right: 70, top: (m === 'cadre' ? 128 + hautCadre : hautBandeau) - 200}}>{pile}</div> : null}
          <div style={{position: 'absolute', left: 56, right: 56, bottom: 64}}>
            {pile && !petites ? <div style={{marginBottom: 40}}>{pile}</div> : null}
            {texte}
          </div>
        </>
      )}
      <Grain o={papier ? 0.12 : 0.08} />
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
export const CarrouselFlash: React.FC<{soirees: Soiree[]; slide: number; titre: string; sous?: string; photo?: string; photoFin?: string; rubrique?: string; question?: string; mise?: Mise}> = ({soirees, slide, titre, sous, photo = 'decors/da/danse.jpg', photoFin = 'decors/da/selfie.jpg', rubrique = "Sorties · Côte d'Azur", question, mise}) => {
  const n = soirees.length;
  if (slide === 0) return <Couverture photo={photo} rubrique={rubrique} titre={titre} sous={sous} vignettes={[...soirees.filter((s: any) => s.vedette), ...soirees.filter((s: any) => !s.vedette)].map((s) => s.image)} glisse mise={mise} />;
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
export const StoryRelais: React.FC<{image: string; rubrique?: string; texte?: string; entier?: boolean}> = ({image, rubrique = 'Nouveau post', texte = 'Le post complet est sur le profil', entier = false}) => (
  <AbsoluteFill style={{background: C.nuit, overflow: 'hidden'}}>
    <Img src={staticFile(image)} style={{position: 'absolute', inset: -120, width: 1320, height: 2160, objectFit: 'cover', filter: 'blur(60px) saturate(1.3) brightness(0.45)'}} />
    <div style={entier ? {position: 'absolute', left: 0, right: 0, top: 150, bottom: 470, display: 'flex', alignItems: 'center', justifyContent: 'center'} : {position: 'absolute', left: 0, right: 0, top: 200, display: 'flex', justifyContent: 'center'}}>
      {/* entier : affiche de soirée montrée en entier (jamais recadrée), quelle que soit sa forme. */}
      <Img data-verif="image" src={staticFile(image)} style={entier ? {maxWidth: 980, maxHeight: 1300, width: 'auto', height: 'auto', borderRadius: 22, boxShadow: '0 40px 100px rgba(0,0,0,.6)', transform: 'rotate(-1.5deg)'} : {width: 860, height: 1075, objectFit: 'cover', borderRadius: 22, boxShadow: '0 40px 100px rgba(0,0,0,.6)', transform: 'rotate(-2deg)'}} />
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
// Bouton lecture (18/11/2026, directeur : couverture « qui corresponde au flux, mais qui montre quand même que c'est un
// réel ») : rond de verre dépoli + triangle crème, dans la zone visible de la grille (recadrage 4:5 : y 285 → 1635).
const Lecture: React.FC<{top?: number}> = ({top = 700}) => (
  <div style={{position: 'absolute', left: 540 - 92, top, width: 184, height: 184, borderRadius: '50%', background: 'rgba(11,11,15,.42)', backdropFilter: 'blur(14px)', border: '5px solid rgba(244,239,230,.9)', boxShadow: '0 18px 60px rgba(0,0,0,.45)'}}>
    <div style={{position: 'absolute', left: 70, top: 50, width: 0, height: 0, borderTop: '42px solid transparent', borderBottom: '42px solid transparent', borderLeft: `68px solid ${C.creme}`}} />
  </div>
);
// Zone vue dans la grille (recadrage 4:5) : y 285 → 1635. Tout le texte et le bouton lecture y tiennent, quelle que soit la mise.
export const CouvertureReel: React.FC<{photo: string; position?: string; rubrique: string; titre: string; sous?: string; lecture?: boolean; mise?: Mise}> = ({photo, position, rubrique, titre, sous, lecture = true, mise = 'bas'}) => {
  const papier = mise === 'cadre';
  const encre = papier ? C.nuit : C.creme;
  const centre = mise === 'centre';
  const texte = (
    <>
      <Etiquette style={{marginBottom: 26}} fond={papier ? C.nuit : C.corail} couleur={papier ? C.creme : C.nuit}>{rubrique}</Etiquette>
      <Titre taille={128} lignes={3} couleur={encre} style={centre ? {textAlign: 'center'} : undefined}>{titre}</Titre>
      {sous ? <Ajuste max={36} lignes={2} interligne={1.25} style={{fontFamily: B, fontWeight: 500, color: encre, opacity: 0.85, marginTop: 22, textAlign: centre ? 'center' : 'left'}}>{sous}</Ajuste> : null}
    </>
  );
  // position du bouton lecture selon la mise
  const yLecture = {bas: 700, haut: 1240, cadre: 708, bandeau: 680, centre: 480}[mise];
  return (
    <AbsoluteFill style={{background: papier ? C.papier : C.nuit, overflow: 'hidden'}}>
      {mise === 'bas' ? <><Photo src={photo} position={position} /><AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(11,11,15,.55) 0%, rgba(11,11,15,.2) 22%, rgba(11,11,15,0) 40%, rgba(11,11,15,.35) 58%, rgba(11,11,15,.92) 88%, rgba(11,11,15,.95) 100%)'}} /></> : null}
      {mise === 'haut' ? <><Photo src={photo} position={position} /><AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(11,11,15,.95) 0%, rgba(11,11,15,.9) 30%, rgba(11,11,15,.7) 45%, rgba(11,11,15,.05) 62%, rgba(11,11,15,.2) 85%, rgba(11,11,15,.6) 100%)'}} /></> : null}
      {mise === 'centre' ? <><Photo src={photo} position={position} assombrir={0.55} /><AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, rgba(11,11,15,.3) 0%, rgba(11,11,15,.85) 75%)'}} /></> : null}
      {mise === 'cadre' ? (
        <div style={{position: 'absolute', left: 56, right: 56, top: 350, height: 900, borderRadius: 18, overflow: 'hidden', transform: 'rotate(-1.2deg)', boxShadow: '0 30px 70px rgba(11,11,15,.35)'}}>
          <Photo src={photo} position={position} />
        </div>
      ) : null}
      {mise === 'bandeau' ? (
        <>
          <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 1280, overflow: 'hidden'}}>
            <Photo src={photo} position={position} />
            <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(11,11,15,.55) 0%, rgba(11,11,15,0) 35%)'}} />
          </div>
          <div style={{position: 'absolute', left: 0, right: 0, top: 1280, height: 10, background: C.corail}} />
        </>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, top: 240 - 48}}><Signature sombre={papier} /></div>
      {lecture ? <Lecture top={yLecture} /> : null}
      {mise === 'haut' ? <div style={{position: 'absolute', left: 56, right: 56, top: 330}}>{texte}</div>
        : centre ? <div style={{position: 'absolute', left: 56, right: 56, top: 720, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'}}>{texte}</div>
        : <div style={{position: 'absolute', left: 56, right: 56, bottom: 1920 - 1680 + 64}}>{texte}</div>}
      <Grain o={papier ? 0.12 : 0.08} />
      <ControleVisuel />
    </AbsoluteFill>
  );
};
