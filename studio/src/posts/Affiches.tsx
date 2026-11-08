import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {F} from '../lib/fonts';

// Publications statiques (1080×1350) : un post unique et un carrousel, avec les visuels officiels
// des organisateurs et uniquement des infos vérifiées sur leurs pages (Panda Events / Le 109).

export type Soiree = {ratio?: number; id: string; nom: string; citation?: string; sous?: string; genre: string; jour: string; heures?: string; prix: string; lieu: string; image: string; couleur: string; encre?: string; ig?: string[]};

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

/** Nom d'affiche lisible : sans le lieu (« @ … », « - Vice Club… »), sans parenthèses, sans « w/ … » trop long. */
export const nomCourt = (nom: string, lieu = '') => {
  let n = nom.replace(/\s*\([^)]*\)/g, '').replace(/\s+@\s+.*$/, '').trim();
  const motsLieu = lieu.toLowerCase().split(/[\s,·]+/).filter((w) => w.length > 3);
  n = n.split(/\s+[-–—|]\s+/).filter((part, i) => i === 0 || !motsLieu.some((w) => part.toLowerCase().includes(w))).join(' · ');
  if (n.length > 30) n = n.replace(/\s+(w\/|x|feat\.?|avec)\s+.*$/i, '');
  // jamais de « … » : si c'est encore long, on garde le nom entier et le texte s'ajuste à la place disponible
  return n;
};

/** Carrousel : couverture, une diapo par soirée, diapo finale « laquelle tu fais ? ». */
export const Carrousel: React.FC<{soirees: Soiree[]; slide: number; titre: string[]; lieu: string; pied?: string; fond?: string}> = ({soirees, slide, titre, lieu, pied, fond}) => {
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
        {fond ? (
          <>
            <Img src={staticFile(fond)} style={{position: 'absolute', inset: 0, width: 1080, height: 1350, objectFit: 'cover'}} />
            <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(8,8,12,.88) 0%, rgba(8,8,12,.35) 38%, rgba(8,8,12,.15) 60%, rgba(8,8,12,.8) 100%)'}} />
            <Grain o={0.12} />
          </>
        ) : null}
        {/* éventail des affiches */}
        {soirees.slice(0, 3).map((s, i) => (
          <Img key={i} src={staticFile(s.image)} style={{position: 'absolute', width: 380, left: 360 + (i - 1) * 250, top: 560 + Math.abs(i - 1) * 40, transform: `rotate(${(i - 1) * 9}deg)`, boxShadow: '0 30px 80px rgba(0,0,0,.6)', border: '10px solid #f2efe9', zIndex: i === 1 ? 2 : 1}} />
        ))}
        <div style={{position: 'absolute', left: 64, top: 70, fontWeight: 900, fontStretch: '62%', fontSize: 300, lineHeight: 0.78, color: 'transparent', WebkitTextStroke: '3px #f2efe955', textTransform: 'uppercase', whiteSpace: 'nowrap'}}>{lieu}</div>
        <div style={{position: 'absolute', left: 64, top: 180, width: 950}}>
          <div style={{fontWeight: 900, fontStretch: '115%', fontSize: 96, lineHeight: 0.92, color: '#f2efe9', textTransform: 'uppercase'}}>{titre[0]}</div>
          <div style={{fontFamily: F.serif, fontStyle: 'italic', fontSize: 96, color: '#ff6b4a', lineHeight: 1}}>{titre[1]}</div>
        </div>
        <div style={{position: 'absolute', left: 64, bottom: 70, fontFamily: F.mono, fontWeight: 700, fontSize: 28, color: '#f2efe9cc', letterSpacing: '0.14em', maxWidth: 680, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{pied ?? 'FRIGO 16 · LE 109 · NICE'}</div>
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
              <span style={{fontWeight: 900, fontStretch: '72%', fontSize: 46, color: '#0b0b0f', textTransform: 'uppercase', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{nomCourt(s.nom, s.lieu)}</span>
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
  const nom = nomCourt(s.nom, s.lieu);
  const [j1, ...jr] = s.jour.split(' ');
  return (
    <AbsoluteFill style={{fontFamily: F.wide, overflow: 'hidden', background: '#0e0e11'}}>
      {/* l'affiche officielle, floutée, donne la couleur de toute la diapo */}
      <Img src={staticFile(s.image)} style={{position: 'absolute', inset: -120, width: 1320, height: 1590, objectFit: 'cover', filter: 'blur(70px) saturate(1.5) brightness(0.5)'}} />
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 30%, ${s.couleur}40, transparent 60%), linear-gradient(180deg, rgba(10,10,12,.35) 0%, rgba(10,10,12,0) 30%, rgba(10,10,12,.92) 70%)`}} />
      {/* haut : compteur + logo */}
      <div style={{position: 'absolute', left: 64, top: 52, fontFamily: F.mono, fontWeight: 700, fontSize: 28, color: '#f2efe9', letterSpacing: '0.12em'}}>
        <span style={{color: s.couleur}}>{String(slide).padStart(2, '0')}</span> / {String(n).padStart(2, '0')}
      </div>
      <Logo h={54} style={{right: 64, top: 40}} />
      {/* affiche officielle en grand, centrée, au format d'origine */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 104, height: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{position: 'relative', boxShadow: '0 40px 100px rgba(0,0,0,.65)', border: '6px solid #f2efe9', lineHeight: 0}}>
          <Img src={staticFile(s.image)} style={s.ratio ? {display: 'block', width: Math.min(940, 688 * s.ratio), height: Math.min(940, 688 * s.ratio) / s.ratio} : {display: 'block', maxWidth: 940, maxHeight: 688, width: 'auto', height: 'auto'}} />
          <div style={{position: 'absolute', left: -6, bottom: -34, background: s.couleur, color: '#0b0b0f', fontWeight: 900, fontStretch: '80%', fontSize: 44, lineHeight: 1, padding: '12px 22px', textTransform: 'uppercase', boxShadow: '0 10px 30px rgba(0,0,0,.4)'}}>
            {j1} <span style={{fontStretch: '100%'}}>{jr.slice(0, 2).join(' ')}</span>
          </div>
        </div>
      </div>
      {/* bas : genre, nom, infos */}
      <div style={{position: 'absolute', left: 64, right: 64, bottom: 60}}>
        <div style={{fontFamily: F.serif, fontStyle: 'italic', fontSize: 54, color: s.couleur, lineHeight: 1}}>{s.genre}</div>
        <div style={{fontWeight: 900, fontStretch: '80%', fontSize: nom.length > 22 ? 76 : 100, lineHeight: 0.92, color: '#f2efe9', textTransform: 'uppercase', marginTop: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{nom}</div>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 24}}>
          {[s.heures, s.prix, s.lieu.split('·')[0].replace(/\s*\([^)]*\)/g, '').trim().slice(0, 30)].filter(Boolean).map((x, i) => (
            <span key={i} style={{fontFamily: F.mono, fontWeight: 700, fontSize: 28, color: '#f2efe9', border: '2px solid #f2efe966', borderRadius: 999, padding: '8px 20px'}}>{x}</span>
          ))}
        </div>
      </div>
      <Grain o={0.1} />
    </AbsoluteFill>
  );
};

/** Post unique « flash » de la veille : une annonce exceptionnelle (fond nuit) ou une actu décryptée (papier). */
export type Flash = {type: 'annonce' | 'actu'; surtitre: string; titre: string; sous_titre: string; faits: string[]; source: string; date: string; image?: string; maquette?: boolean};
export const PostFlash: React.FC<{f: Flash}> = ({f}) => {
  const papier = f.type === 'actu';
  const fond = papier ? '#f3eee4' : '#0b0a10';
  const encre = papier ? '#121212' : '#f6f1ea';
  const accent = papier ? '#e5372a' : '#ff6b4a';
  return (
    <AbsoluteFill style={{background: fond, fontFamily: F.wide, overflow: 'hidden'}}>
      {!papier ? <AbsoluteFill style={{background: 'radial-gradient(circle at 80% 15%, #ff6b4a40, transparent 45%), radial-gradient(circle at 10% 90%, #7b2cff30, transparent 50%)'}} /> : null}
      {f.image ? (
        <div style={{position: 'absolute', right: 60, top: 150, width: 430, transform: 'rotate(3deg)', background: papier ? '#fff' : '#f6f1ea', padding: '14px 14px 14px', boxShadow: '0 30px 70px rgba(0,0,0,.45)'}}>
          <Img src={staticFile(f.image)} style={{width: '100%', display: 'block', maxHeight: 560, objectFit: 'cover'}} />
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 64, top: 70, display: 'flex', gap: 16, alignItems: 'center'}}>
        <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 30, letterSpacing: '0.14em', background: accent, color: papier ? '#fff' : '#0b0a10', padding: '10px 22px', borderRadius: 999}}>{f.surtitre}</div>
        <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 24, color: papier ? '#12121299' : '#f6f1ea99', letterSpacing: '0.1em'}}>{f.date}</div>
      </div>
      <div style={{position: 'absolute', left: 64, top: f.image ? 760 : 230, right: f.image ? 64 : 64, fontWeight: 900, fontStretch: '70%', fontSize: f.titre.length > 40 ? 104 : 128, lineHeight: 0.9, color: encre, textTransform: 'uppercase', maxWidth: f.image ? 950 : 950}}>
        {f.image ? null : null}{f.titre}
      </div>
      <div style={{position: 'absolute', left: 64, right: 64, top: f.image ? 1010 : 640, fontFamily: F.serif, fontStyle: 'italic', fontSize: 58, color: accent, lineHeight: 1.05}}>{f.sous_titre}</div>
      {!f.image ? (
        <div style={{position: 'absolute', left: 64, right: 64, top: 780}}>
          {f.faits.slice(0, 4).map((x, i) => (
            <div key={i} style={{display: 'flex', gap: 22, alignItems: 'baseline', borderTop: `2px solid ${papier ? '#12121233' : '#f6f1ea33'}`, padding: '18px 0'}}>
              <span style={{fontFamily: F.mono, fontWeight: 700, fontSize: 28, color: accent}}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{fontWeight: 700, fontStretch: '100%', fontSize: 40, color: encre, lineHeight: 1.15}}>{x}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{position: 'absolute', left: 64, top: 160, width: 470}}>
          {f.faits.slice(0, 4).map((x, i) => (
            <div key={i} style={{borderTop: `2px solid ${papier ? '#12121233' : '#f6f1ea33'}`, padding: '16px 0'}}>
              <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 24, color: accent}}>{String(i + 1).padStart(2, '0')}</div>
              <div style={{fontWeight: 700, fontStretch: '100%', fontSize: 36, color: encre, lineHeight: 1.15, marginTop: 6}}>{x}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{position: 'absolute', left: 64, right: 64, bottom: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 22, color: papier ? '#12121299' : '#f6f1ea99', letterSpacing: '0.06em', maxWidth: 780}}>SOURCE : {f.source}</div>
        <Img src={staticFile('logo.png')} style={{height: 56, filter: 'drop-shadow(3px 3px 0 #ff6b4a)'}} />
      </div>
      {f.maquette ? <div style={{position: 'absolute', left: -120, top: 600, width: 1400, transform: 'rotate(-28deg)', textAlign: 'center', fontFamily: F.mono, fontWeight: 700, fontSize: 90, color: 'rgba(255,0,0,.28)', letterSpacing: '0.2em'}}>MAQUETTE · EXEMPLE FICTIF</div> : null}
      <Grain o={papier ? 0.18 : 0.1} />
    </AbsoluteFill>
  );
};
