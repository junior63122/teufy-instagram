import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {F} from '../lib/fonts';

// Publications statiques (1080×1350) : un post unique et un carrousel, avec les visuels officiels
// des organisateurs et uniquement des infos vérifiées sur leurs pages (Panda Events / Le 109).

export type Soiree = {id: string; nom: string; citation?: string; sous?: string; genre: string; jour: string; heures?: string; prix: string; lieu: string; image: string; couleur: string; encre?: string; ig?: string[]};

const Grain: React.FC<{o?: number}> = ({o = 0.12}) => (
  <AbsoluteFill style={{mixBlendMode: 'overlay', opacity: o, pointerEvents: 'none'}}>
    <svg width="100%" height="100%"><filter id="gp"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={3} /><feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter="url(#gp)" /></svg>
  </AbsoluteFill>
);

const Logo: React.FC<{h?: number; style?: React.CSSProperties}> = ({h = 70, style}) => <Img src={staticFile('logo.png')} style={{height: h, filter: 'drop-shadow(4px 4px 0 #ff6b4a)', position: 'absolute', ...style}} />;

/** Post unique « premium » : affiche officielle en tirage photo, typo condensée + serif, bandeau d'infos. */
export const PostSoiree: React.FC<{s: Soiree}> = ({s}) => (
  <AbsoluteFill style={{background: '#160804', fontFamily: F.wide, overflow: 'hidden'}}>
    {/* l'affiche floutée sert de matière de fond : couleurs en accord avec le visuel */}
    <Img src={staticFile(s.image)} style={{position: 'absolute', inset: -120, width: 1320, height: 1590, objectFit: 'cover', filter: 'blur(70px) saturate(1.6) brightness(0.55)'}} />
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 75% 30%, ${s.couleur}66, transparent 55%), linear-gradient(180deg, rgba(10,4,2,.2), rgba(10,4,2,.85) 78%)`}} />
    {/* titre */}
    <div style={{position: 'absolute', left: 64, top: 120, width: 960}}>
      <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 26, letterSpacing: '0.18em', color: '#ffe9d6cc'}}>{s.sous ?? 'CE MOIS-CI À NICE'}</div>
      <div style={{fontWeight: 900, fontStretch: '62%', fontSize: 236, lineHeight: 0.8, color: '#fff3e6', textTransform: 'uppercase', marginTop: 18, letterSpacing: '-0.01em'}}>{s.genre.split(' ')[0]}</div>
      <div style={{fontFamily: F.serif, fontStyle: 'italic', fontSize: 92, color: s.couleur, lineHeight: 1, marginTop: 6}}>{s.genre.split(' ').slice(1).join(' ')}</div>
    </div>
    {s.citation ? (
      <div style={{position: 'absolute', left: 64, top: 560, width: 400}}>
        <div style={{width: 80, height: 6, background: s.couleur, marginBottom: 26}} />
        <div style={{fontFamily: F.serif, fontStyle: 'italic', fontSize: 58, lineHeight: 1.05, color: '#fff3e6'}}>« {s.citation} »</div>
        <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 20, letterSpacing: '0.12em', color: '#ffe9d699', marginTop: 20}}>— L'ORGANISATEUR</div>
      </div>
    ) : null}
    {/* affiche officielle, comme un tirage posé de biais */}
    <div style={{position: 'absolute', right: 70, top: 300, width: 470, transform: 'rotate(4deg)', background: '#fff8ef', padding: '16px 16px 64px', boxShadow: '0 40px 90px rgba(0,0,0,.6)'}}>
      <Img src={staticFile(s.image)} style={{width: '100%', display: 'block'}} />
      <div style={{position: 'absolute', left: 18, bottom: 18, fontFamily: F.serif, fontStyle: 'italic', fontSize: 30, color: '#2a1a12'}}>{s.nom.toLowerCase()}</div>
    </div>
    {/* bandeau d'infos */}
    <div style={{position: 'absolute', left: 64, right: 64, bottom: 96, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderTop: '3px solid #fff3e6'}}>
      {[['quand', s.jour], ['heures', s.heures ?? '—'], ['où', s.lieu], ['entrée', s.prix]].map(([k, v], i) => (
        <div key={i} style={{padding: '22px 0 0', paddingRight: 20}}>
          <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 22, letterSpacing: '0.16em', color: s.couleur, textTransform: 'uppercase'}}>{k}</div>
          <div style={{fontWeight: 800, fontStretch: '100%', fontSize: 40, color: '#fff3e6', lineHeight: 1.1, marginTop: 6}}>{v}</div>
        </div>
      ))}
    </div>
    <Logo h={64} style={{left: 64, top: 36}} />
    <div style={{position: 'absolute', right: 64, top: 52, fontFamily: F.mono, fontWeight: 700, fontSize: 20, color: '#ffe9d699', letterSpacing: '0.1em'}}>VISUEL : {s.ig?.[0] ? `@${s.ig[0]}` : 'ORGANISATEUR'}</div>
    <Grain />
  </AbsoluteFill>
);

/** Carrousel : couverture, une diapo par soirée, diapo finale « laquelle tu fais ? ». */
export const Carrousel: React.FC<{soirees: Soiree[]; slide: number; titre: string[]; lieu: string; pied?: string}> = ({soirees, slide, titre, lieu, pied}) => {
  const n = soirees.length;
  const fondBeton = (
    <>
      <AbsoluteFill style={{background: 'linear-gradient(160deg, #2a2a2e, #121214 70%)'}} />
      <Grain o={0.22} />
    </>
  );
  if (slide === 0) {
    return (
      <AbsoluteFill style={{fontFamily: F.wide, overflow: 'hidden'}}>
        {fondBeton}
        {/* éventail des affiches */}
        {soirees.slice(0, 3).map((s, i) => (
          <Img key={i} src={staticFile(s.image)} style={{position: 'absolute', width: 380, left: 360 + (i - 1) * 250, top: 560 + Math.abs(i - 1) * 40, transform: `rotate(${(i - 1) * 9}deg)`, boxShadow: '0 30px 80px rgba(0,0,0,.6)', border: '10px solid #f2efe9', zIndex: i === 1 ? 2 : 1}} />
        ))}
        <div style={{position: 'absolute', left: 64, top: 70, fontWeight: 900, fontStretch: '62%', fontSize: 300, lineHeight: 0.78, color: 'transparent', WebkitTextStroke: '3px #f2efe955', textTransform: 'uppercase', whiteSpace: 'nowrap'}}>{lieu}</div>
        <div style={{position: 'absolute', left: 64, top: 180, width: 950}}>
          <div style={{fontWeight: 900, fontStretch: '115%', fontSize: 96, lineHeight: 0.92, color: '#f2efe9', textTransform: 'uppercase'}}>{titre[0]}</div>
          <div style={{fontFamily: F.serif, fontStyle: 'italic', fontSize: 96, color: '#ff6b4a', lineHeight: 1}}>{titre[1]}</div>
        </div>
        <div style={{position: 'absolute', left: 64, bottom: 70, fontFamily: F.mono, fontWeight: 700, fontSize: 28, color: '#f2efe9cc', letterSpacing: '0.14em'}}>{pied ?? 'FRIGO 16 · LE 109 · NICE'}</div>
        <div style={{position: 'absolute', right: 64, bottom: 62, fontFamily: F.wide, fontWeight: 900, fontSize: 40, color: '#0b0b0f', background: '#ff6b4a', padding: '10px 24px', borderRadius: 999}}>swipe →</div>
        <Logo h={60} style={{right: 64, top: 40}} />
      </AbsoluteFill>
    );
  }
  if (slide > n) {
    return (
      <AbsoluteFill style={{fontFamily: F.wide, overflow: 'hidden', background: '#ff6b4a'}}>
        <Grain o={0.15} />
        <div style={{position: 'absolute', left: 64, top: 110, fontWeight: 900, fontStretch: '62%', fontSize: 210, lineHeight: 0.82, color: '#0b0b0f', textTransform: 'uppercase'}}>laquelle<br />tu fais<span style={{fontFamily: F.serif, fontStyle: 'italic', fontWeight: 400}}> ?</span></div>
        <div style={{position: 'absolute', left: 64, right: 64, top: 560}}>
          {soirees.map((s, i) => (
            <div key={i} style={{display: 'flex', alignItems: 'baseline', gap: 24, borderTop: '3px solid #0b0b0f', padding: '16px 0'}}>
              <span style={{fontFamily: F.mono, fontWeight: 700, fontSize: 30, color: '#0b0b0f'}}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{fontWeight: 900, fontStretch: '80%', fontSize: 50, color: '#0b0b0f', textTransform: 'uppercase', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{s.nom}</span>
              <span style={{fontFamily: F.mono, fontWeight: 700, fontSize: 26, color: '#0b0b0f'}}>{s.jour.split(' ').slice(0, 3).join(' ')}</span>
            </div>
          ))}
        </div>
        <div style={{position: 'absolute', left: 64, bottom: 80, fontFamily: F.serif, fontStyle: 'italic', fontSize: 60, color: '#0b0b0f'}}>réponds en commentaire, et enregistre pour plus tard.</div>
        <Logo h={56} style={{right: 64, top: 40}} />
      </AbsoluteFill>
    );
  }
  const s = soirees[slide - 1];
  return (
    <AbsoluteFill style={{fontFamily: F.wide, overflow: 'hidden', background: '#121214'}}>
      <Img src={staticFile(s.image)} style={{position: 'absolute', inset: -100, width: 1280, height: 1550, objectFit: 'cover', filter: 'blur(60px) saturate(1.4) brightness(0.45)'}} />
      <AbsoluteFill style={{background: `linear-gradient(180deg, transparent 40%, rgba(10,10,12,.9) 75%)`}} />
      {/* affiche officielle encadrée */}
      <div style={{position: 'absolute', left: 64, top: 64, width: 600, boxShadow: '0 30px 80px rgba(0,0,0,.55)', border: `8px solid ${s.couleur}`}}>
        <Img src={staticFile(s.image)} style={{width: '100%', display: 'block'}} />
      </div>
      <div style={{position: 'absolute', right: 64, top: 70, textAlign: 'right'}}>
        <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 30, color: s.couleur, letterSpacing: '0.1em'}}>{String(slide).padStart(2, '0')}/{String(n).padStart(2, '0')}</div>
        <div style={{fontWeight: 900, fontStretch: '62%', fontSize: 120, lineHeight: 0.85, color: '#f2efe9', marginTop: 18, textTransform: 'uppercase', width: 300}}>{s.jour.split(' ')[0]}<br /><span style={{color: s.couleur}}>{s.jour.split(' ').slice(1, 3).join(' ')}</span></div>
      </div>
      <div style={{position: 'absolute', left: 64, right: 64, bottom: 70}}>
        <div style={{fontFamily: F.serif, fontStyle: 'italic', fontSize: 64, color: s.couleur, lineHeight: 1}}>{s.genre}</div>
        <div style={{fontWeight: 900, fontStretch: '80%', fontSize: s.nom.length > 18 ? 84 : 112, lineHeight: 0.9, color: '#f2efe9', textTransform: 'uppercase', marginTop: 10}}>{s.nom}</div>
        <div style={{display: 'flex', gap: 34, marginTop: 24, fontFamily: F.mono, fontWeight: 700, fontSize: 30, color: '#f2efe9', letterSpacing: '0.04em'}}>
          {s.heures ? <span>{s.heures}</span> : null}<span>{s.prix}</span><span style={{opacity: 0.7}}>{s.lieu.split('·')[0].trim()}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
