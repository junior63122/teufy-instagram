import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {B, C, T, Titre, Etiquette} from './charte';
import {Couverture, DiapoFin, DiapoSoiree} from './Posts';
import type {Soiree} from '../posts/Affiches';

const D = (x: string) => `decors/da/${x}.jpg`;

/** Le plan du feed : quoi publier, dans quel ordre, pour un profil cohérent (3 colonnes, du plus récent au plus ancien). */
export const FEED: {type: string; el: (s: Soiree[]) => React.ReactNode}[] = [
  {type: 'reel', el: () => <Couverture photo={D('rire')} rubrique="Humour" titre="Les 4 potes qu'on a [tous] en soirée" />},
  {type: 'carrousel', el: (s) => <Couverture photo={D('danse')} rubrique="Sorties · Côte d'Azur" titre="5 soirées à ne pas [rater]" sous="du 10 au 16 novembre" vignettes={s.map((x) => x.image)} glisse />},
  {type: 'reel', el: () => <Couverture photo={D('file')} rubrique="Astuce" titre="Rentrer en boîte [sans galère]" />},
  {type: 'debat', el: () => <Couverture photo={D('lasers')} fond="nuit" rubrique="Débat" titre="L'after : [indispensable] ou erreur ?" sous="Réponds en commentaire" />},
  {type: 'reel', el: () => <Couverture photo={D('taxi')} rubrique="Explicatif" titre="Le vrai coût d'une [soirée] à Nice" />},
  {type: 'bonplan', el: () => <Couverture fond="creme" grand="10€" rubrique="Bon plan" titre="Sortir à moins de [10 €] ce week-end" sous="4 soirées · Nice & Cannes" />},
  {type: 'carrousel', el: (s) => <Couverture photo={D('foule')} rubrique="Sorties · Côte d'Azur" titre="Le week-end est [chargé]" sous="du 20 au 23 novembre" vignettes={s.map((x) => x.image)} glisse />},
  {type: 'reel', el: () => <Couverture photo={D('plage')} rubrique="Immersion" titre="Une nuit sur la [Côte]" />},
  {type: 'actu', el: () => <Couverture photo={D('dj')} fond="nuit" rubrique="Actu nuit" titre="Ce qui change pour tes [soirées] en décembre" sous="Source officielle citée" />},
  {type: 'reel', el: () => <Couverture photo={D('baskets')} rubrique="Humour" titre="Ce que tu dis vs ce qui se [passe]" />},
  {type: 'debat', el: () => <Couverture photo={D('rooftop')} rubrique="Débat" titre="Rooftop ou club : tu choisis [quoi] ?" />},
  {type: 'carrousel', el: (s) => <Couverture photo={D('terrasse')} rubrique="Sorties · Côte d'Azur" titre="Spécial [beach clubs]" sous="les dernières de la saison" vignettes={s.map((x) => x.image)} glisse />},
];

const Tuile: React.FC<{children: React.ReactNode; w: number; type: string}> = ({children, w, type}) => {
  const h = (w * 4) / 3; // vignette du profil Instagram (3:4)
  const k = h / 1350;
  return (
    <div style={{width: w, height: h, overflow: 'hidden', position: 'relative', background: C.nuit}}>
      <div style={{position: 'absolute', left: (w - 1080 * k) / 2, top: 0, width: 1080, height: 1350, transform: `scale(${k})`, transformOrigin: 'top left'}}>{children}</div>
      {type === 'reel' ? <svg style={{position: 'absolute', right: 12, top: 12}} width={30} height={30} viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="#fff" strokeWidth="2" /><path d="M10 8.5v7l6-3.5z" fill="#fff" /></svg> : null}
      {type === 'carrousel' ? <svg style={{position: 'absolute', right: 12, top: 12}} width={30} height={30} viewBox="0 0 24 24"><rect x="6" y="2" width="16" height="16" rx="3" fill="none" stroke="#fff" strokeWidth="2" /><path d="M2 7v13a2 2 0 0 0 2 2h13" fill="none" stroke="#fff" strokeWidth="2" /></svg> : null}
    </div>
  );
};

/** Maquette du profil Instagram avec le feed planifié. */
export const Storyboard: React.FC<{soirees: Soiree[]}> = ({soirees}) => {
  const w = 356;
  return (
    <AbsoluteFill style={{background: '#000', fontFamily: B, color: '#fff'}}>
      <div style={{padding: '40px 40px 24px', display: 'flex', gap: 40, alignItems: 'center'}}>
        <div style={{width: 170, height: 170, borderRadius: '50%', background: C.corail, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 6px #000, 0 0 0 9px ${C.corail}`}}>
          <Img src={staticFile('logo.png')} style={{width: 110, filter: 'brightness(0)'}} />
        </div>
        <div>
          <div style={{fontWeight: 700, fontSize: 40}}>teufy_official</div>
          <div style={{fontSize: 24, marginTop: 10, fontWeight: 700, letterSpacing: '0.12em', color: C.corail}}>MAQUETTE DU FEED · 4 SEMAINES</div>
          <div style={{fontSize: 27, marginTop: 14, lineHeight: 1.35, opacity: 0.92}}>Teufy · Les soirées de la Côte d'Azur 🌙<br />Nice · Cannes · Monaco — chaque semaine, où sortir</div>
        </div>
      </div>
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 0'}}>
        {FEED.map((f, i) => <Tuile key={i} w={w} type={f.type}>{f.el(soirees)}</Tuile>)}
      </div>
    </AbsoluteFill>
  );
};

/** Planche de la charte : couleurs, polices, photos, règles. */
export const Planche: React.FC = () => (
  <AbsoluteFill style={{background: C.papier, padding: 70, fontFamily: B, color: C.nuit}}>
    <Etiquette fond={C.nuit} couleur={C.creme}>Direction artistique · Teufy</Etiquette>
    <Titre taille={150} couleur={C.nuit} style={{marginTop: 30}}>Flash [nuit]</Titre>
    <div style={{fontSize: 34, lineHeight: 1.35, marginTop: 24, maxWidth: 900}}>Des vraies photos de soirée au flash, du grain, des noirs profonds. Trois couleurs, deux polices, une seule façon de poser le texte.</div>
    <div style={{display: 'flex', gap: 22, marginTop: 50}}>
      {[[C.nuit, 'Nuit', '#0B0B0F', C.creme], [C.creme, 'Crème', '#F4EFE6', C.nuit], [C.papier, 'Papier', '#EDE6DA', C.nuit], [C.corail, 'Corail', '#FF5A3C', C.nuit]].map(([bg, nom, hex, fg]) => (
        <div key={nom} style={{flex: 1, height: 220, background: bg, borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', color: fg, border: `2px solid ${C.nuit}22`}}>
          <div style={{fontFamily: T, fontWeight: 800, fontSize: 40}}>{nom}</div>
          <div style={{fontSize: 22, fontWeight: 600, opacity: 0.8}}>{hex}</div>
        </div>
      ))}
    </div>
    <div style={{display: 'flex', gap: 40, marginTop: 50, alignItems: 'flex-end'}}>
      <div style={{flex: 1}}>
        <div style={{fontSize: 22, fontWeight: 800, letterSpacing: '0.14em', color: C.gris}}>TITRES · BRICOLAGE GROTESQUE</div>
        <Titre taille={110} couleur={C.nuit} style={{marginTop: 10}}>Aa Soirée</Titre>
      </div>
      <div style={{flex: 1}}>
        <div style={{fontSize: 22, fontWeight: 800, letterSpacing: '0.14em', color: C.gris}}>TEXTE · INTER TIGHT</div>
        <div style={{fontSize: 44, fontWeight: 600, marginTop: 14, lineHeight: 1.2}}>23h59 · dès 15 € · Twiga Monte-Carlo</div>
      </div>
    </div>
    <div style={{display: 'flex', gap: 14, marginTop: 50}}>
      {['danse', 'dj', 'rooftop', 'rire', 'taxi', 'plage'].map((x) => <Img key={x} src={staticFile(D(x))} style={{flex: 1, width: 0, height: 210, objectFit: 'cover', borderRadius: 12}} />)}
    </div>
    <div style={{marginTop: 46, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 40px', fontSize: 28, lineHeight: 1.3}}>
      {[
        'Une photo plein cadre sur chaque couverture',
        'Titre en bas à gauche, toujours',
        'Un seul élément corail par visuel',
        'Une étiquette de rubrique : Sorties, Débat, Bon plan…',
        'Affiches officielles des soirées, jamais retouchées',
        'Logo + @teufy_official en haut, toujours',
      ].map((r) => <div key={r} style={{display: 'flex', gap: 16}}><span style={{color: C.corail, fontWeight: 900}}>●</span>{r}</div>)}
    </div>
  </AbsoluteFill>
);

export {DiapoFin, DiapoSoiree};
