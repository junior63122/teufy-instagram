import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {BandeSon, Bruitage, SousTitres, quand, useT} from '../ui/base';
import {E, SPR, clamp, mix, p, sp} from '../lib/anim';
import {B, C, T} from '../da/charte';

// Reel « Flash » (DA Flash nuit) : il se passe quelque chose toutes les secondes.
//  - une photo flash par scène (Ken Burns), un FLASH blanc + déclencheur entre les scènes,
//  - un coup de zoom sur la photo à chaque mot clé, et le mot clé qui CLAQUE en géant,
//  - des objets animés qui portent l'info (prix barré, paliers de billets, jauge sold out, notification),
//  - sous-titres mot à mot, barre de progression, sons sur chaque temps fort.
// Tout est décrit dans la spec (extra.plans), déclenché par les mots de la voix off.

type Gros = {mot: string; texte: string; style?: 'titre' | 'sticker' | 'chiffre'; y?: number};
type Objet =
  | {type: 'prix'; mot: string; motApres: string; de: string; a: string}
  | {type: 'paliers'; mots: string[]; paliers: {nom: string; prix: string}[]}
  | {type: 'jauge'; mot: string; motFin: string; libelle: string}
  | {type: 'notif'; mot: string; titre: string; texte: string};
type Plan = {photo: string; position?: string; gros?: Gros[]; objet?: Objet; sombre?: number};

const FLASH = 0.16; // durée du flash blanc (s)

export const Flash: React.FC<{spec: any}> = ({spec}) => {
  const {t, fps} = useT();
  const S = spec.scenes as {start: number; end: number}[];
  const plans = (spec.plans as Plan[]) || [];
  const k = Math.max(0, S.findIndex((s, i) => t >= s.start && (i === S.length - 1 || t < S[i + 1].start)));
  const plan = plans[k] || plans[plans.length - 1];
  const q = (w: string, sc = k) => quand(spec, w, sc);

  // Mots clés de la scène, avec leur instant.
  const gros = (plan.gros || []).map((g) => ({...g, t0: q(g.mot)})).sort((a, b) => a.t0 - b.t0);
  const actif = [...gros].reverse().find((g) => t >= g.t0 - 0.02);
  // Coup de zoom à chaque mot clé : la photo « saute » (effet de coupe sans changer de plan).
  const sauts = gros.filter((g) => t >= g.t0).length;
  const debut = S[k].start;
  const kb = 1.06 + 0.05 * clamp((t - debut) / Math.max(1, S[k].end - debut)) + sauts * 0.07;
  const choc = actif ? (1 - p(t, actif.t0, 0.18)) * 0.05 : 0;

  // Flash blanc à chaque changement de scène (sauf la toute première image).
  const flash = k > 0 ? 1 - clamp((t - debut) / FLASH) : 0;

  return (
    <AbsoluteFill style={{background: C.nuit, overflow: 'hidden'}}>
      {/* photo de la scène */}
      <AbsoluteFill style={{transform: `scale(${kb + choc}) rotate(${(k % 2 ? -1 : 1) * 0.6}deg)`}}>
        <Img src={staticFile(plan.photo)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: plan.position || 'center', filter: 'contrast(1.08) saturate(1.08)'}} />
      </AbsoluteFill>
      <AbsoluteFill style={{background: `linear-gradient(180deg, rgba(11,11,15,.55) 0%, rgba(11,11,15,${plan.sombre ?? 0.15}) 30%, rgba(11,11,15,${plan.sombre ?? 0.15}) 55%, rgba(11,11,15,.85) 100%)`}} />

      {/* mot clé géant */}
      {actif ? <MotGeant g={actif} t={t} fps={fps} /> : null}

      {/* objet qui porte l'info */}
      {plan.objet ? <ObjetAnime o={plan.objet} t={t} fps={fps} q={q} /> : null}

      <SousTitres mots={spec.mots} y={1440} taille={58} style="contour" accent={C.corail} cles={[]} />

      {/* barre de progression + signature */}
      <div style={{position: 'absolute', left: 0, top: 0, height: 8, width: `${clamp(t / spec.duree) * 100}%`, background: C.corail}} />
      <div style={{position: 'absolute', left: 48, top: 44, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.9}}>
        <Img src={staticFile('logo.png')} style={{height: 36}} />
        <span style={{fontFamily: B, fontWeight: 700, fontSize: 24, color: C.creme}}>@teufy_official</span>
      </div>

      {flash > 0 ? <AbsoluteFill style={{background: '#fff', opacity: flash}} /> : null}
      <Grain />
      <BandeSon spec={spec} />
      {S.slice(1).map((s, i) => <Bruitage key={`f${i}`} spec={spec} src="sfx/flash.mp3" at={s.start - 0.02} duree={0.3} volume={0.55} sousVoix={0.8} />)}
    </AbsoluteFill>
  );
};

const Grain: React.FC = () => (
  <AbsoluteFill style={{mixBlendMode: 'overlay', opacity: 0.12, pointerEvents: 'none'}}>
    <svg width="100%" height="100%"><filter id="gF"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={4} /><feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter="url(#gF)" /></svg>
  </AbsoluteFill>
);

const accent = (texte: string) => texte.split(/(\[[^\]]+\])/).map((x, i) => (x.startsWith('[') ? <span key={i} style={{color: C.corail}}>{x.slice(1, -1)}</span> : <React.Fragment key={i}>{x}</React.Fragment>));

const MotGeant: React.FC<{g: Gros & {t0: number}; t: number; fps: number}> = ({g, t, fps}) => {
  const a = sp(t, g.t0 - 0.02, fps, SPR.pop);
  const s = mix(1.5, 1, Math.min(1, a));
  const style = g.style || 'titre';
  const y = g.y ?? (style === 'chiffre' ? 330 : 250);
  if (style === 'sticker') {
    return (
      <div style={{position: 'absolute', left: 60, right: 60, top: y, display: 'flex', justifyContent: 'center'}}>
        <div style={{transform: `scale(${s}) rotate(-3deg)`, background: C.corail, color: C.nuit, fontFamily: T, fontWeight: 800, fontStretch: '80%', fontSize: 104, lineHeight: 0.95, padding: '18px 34px 22px', borderRadius: 12, textTransform: 'uppercase', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,.45)', maxWidth: 940}}>{g.texte.split(/(\[[^\]]+\])/).map((x, i) => (x.startsWith('[') ? <span key={i} style={{color: C.creme}}>{x.slice(1, -1)}</span> : <React.Fragment key={i}>{x}</React.Fragment>))}</div>
      </div>
    );
  }
  if (style === 'chiffre') {
    return (
      <div style={{position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', transform: `scale(${s})`, fontFamily: T, fontWeight: 800, fontStretch: '75%', fontSize: 400, lineHeight: 0.85, letterSpacing: '-0.04em', color: C.creme, textShadow: '0 20px 60px rgba(0,0,0,.6)'}}>{accent(g.texte)}</div>
    );
  }
  return (
    <div style={{position: 'absolute', left: 60, right: 60, top: y, transform: `scale(${s})`, transformOrigin: 'left top', fontFamily: T, fontWeight: 800, fontStretch: '80%', fontSize: 150, lineHeight: 0.9, letterSpacing: '-0.025em', color: C.creme, textShadow: '0 14px 50px rgba(0,0,0,.6)'}}>{accent(g.texte)}</div>
  );
};

const Carte: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{background: C.creme, color: C.nuit, borderRadius: 26, boxShadow: '0 30px 80px rgba(0,0,0,.55)', ...style}}>{children}</div>
);

const ObjetAnime: React.FC<{o: Objet; t: number; fps: number; q: (w: string) => number}> = ({o, t, fps, q}) => {
  if (o.type === 'prix') {
    const t0 = o.mot === 'debut' ? 0 : q(o.mot), t1 = q(o.motApres); // « debut » : visible dès la 1re image (accroche)
    if (t < t0 - 0.05) return null;
    const a = sp(t, t0, fps, SPR.pop), b = sp(t, t1, fps, SPR.pop), barre = p(t, t1 - 0.1, 0.25);
    return (
      <div style={{position: 'absolute', left: 0, right: 0, top: 760, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
        <div style={{position: 'relative', transform: `scale(${a * (t > t1 ? 0.7 : 1)})`, opacity: t > t1 ? 0.75 : 1, fontFamily: T, fontWeight: 800, fontStretch: '75%', fontSize: 230, color: C.creme, lineHeight: 0.9, textShadow: '0 16px 50px rgba(0,0,0,.6)'}}>
          {o.de}
          <div style={{position: 'absolute', left: -10, top: '48%', height: 22, width: `${barre * 110}%`, background: C.corail, transform: 'rotate(-8deg)', borderRadius: 6}} />
        </div>
        {t >= t1 ? <div style={{transform: `scale(${b}) rotate(-4deg)`, fontFamily: T, fontWeight: 800, fontStretch: '75%', fontSize: 330, color: C.corail, lineHeight: 0.85, textShadow: '0 16px 50px rgba(0,0,0,.6)'}}>{o.a}</div> : null}
      </div>
    );
  }
  if (o.type === 'paliers') {
    const ts = o.mots.map((m) => q(m));
    return (
      <div style={{position: 'absolute', left: 90, right: 90, top: 640, height: 720}}>
        {o.paliers.map((pl, i) => {
          if (t < ts[i] - 0.05) return null;
          const a = sp(t, ts[i], fps, SPR.pop);
          const vendu = ts[i + 1] !== undefined && t > ts[i + 1];
          return (
            <Carte key={i} style={{position: 'absolute', left: i * 70, right: (o.paliers.length - 1 - i) * 70, top: 470 - i * 230, height: 210, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 44px', transform: `translateY(${(1 - a) * 220}px) rotate(${(i - 1) * 2}deg)`, opacity: Math.min(1, a * 1.5)}}>
              <div>
                <div style={{fontFamily: B, fontWeight: 800, fontSize: 30, letterSpacing: '0.16em', color: C.gris}}>BILLET</div>
                <div style={{fontFamily: T, fontWeight: 800, fontStretch: '80%', fontSize: 84, lineHeight: 1}}>{pl.nom}</div>
              </div>
              <div style={{fontFamily: T, fontWeight: 800, fontStretch: '75%', fontSize: 130, color: i === o.paliers.length - 1 ? C.corail : C.nuit}}>{pl.prix}</div>
              {vendu ? <div style={{position: 'absolute', left: 300, top: 60, transform: `rotate(-10deg) scale(${mix(1.6, 1, p(t, ts[i + 1], 0.2))})`, border: `6px solid ${C.corail}`, color: C.corail, fontFamily: B, fontWeight: 900, fontSize: 34, padding: '4px 14px', borderRadius: 8, background: '#fffffff0'}}>SOLD OUT</div> : null}
            </Carte>
          );
        })}
      </div>
    );
  }
  if (o.type === 'jauge') {
    const t0 = q(o.mot), t1 = q(o.motFin);
    if (t < t0 - 0.05) return null;
    const a = sp(t, t0, fps, SPR.pop);
    const f = E.inOut(clamp((t - t0) / Math.max(0.3, t1 - t0)));
    const plein = f >= 1;
    return (
      <Carte style={{position: 'absolute', left: 90, right: 90, top: 800, padding: '40px 44px', transform: `scale(${a})`}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <div style={{fontFamily: B, fontWeight: 800, fontSize: 36}}>{o.libelle}</div>
          <div style={{fontFamily: T, fontWeight: 800, fontStretch: '75%', fontSize: 96, color: plein ? C.corail : C.nuit}}>{Math.round(f * 100)} %</div>
        </div>
        <div style={{height: 46, background: '#0b0b0f18', borderRadius: 99, marginTop: 20, overflow: 'hidden'}}>
          <div style={{height: '100%', width: `${f * 100}%`, background: plein ? C.corail : C.nuit, borderRadius: 99}} />
        </div>
        {plein ? <div style={{position: 'absolute', right: 40, top: -50, transform: `rotate(-8deg) scale(${mix(1.8, 1, p(t, t1, 0.2))})`, background: C.corail, color: C.nuit, fontFamily: B, fontWeight: 900, fontSize: 48, padding: '8px 22px', borderRadius: 10}}>SOLD OUT</div> : null}
      </Carte>
    );
  }
  // notification qui descend du haut de l'écran
  const t0 = q(o.mot);
  if (t < t0 - 0.05) return null;
  const a = sp(t, t0, fps, SPR.pop);
  return (
    <Carte style={{position: 'absolute', left: 60, right: 60, top: 140 + (1 - Math.min(1, a)) * -300, padding: '26px 30px', display: 'flex', gap: 24, alignItems: 'center', background: '#f4efe6f2'}}>
      <div style={{width: 96, height: 96, borderRadius: 22, background: C.nuit, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
        <Img src={staticFile('logo.png')} style={{width: 66}} />
      </div>
      <div style={{flex: 1}}>
        <div style={{display: 'flex', justifyContent: 'space-between'}}>
          <span style={{fontFamily: B, fontWeight: 800, fontSize: 34}}>{o.titre}</span>
          <span style={{fontFamily: B, fontWeight: 600, fontSize: 26, color: C.gris}}>maintenant</span>
        </div>
        <div style={{fontFamily: B, fontWeight: 500, fontSize: 32, marginTop: 4, lineHeight: 1.2}}>{o.texte}</div>
      </div>
    </Carte>
  );
};
