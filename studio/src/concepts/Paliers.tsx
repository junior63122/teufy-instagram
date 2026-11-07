import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {evolvePath} from '@remotion/paths';
import {BandeSon, Eclat, Grain, MotsMasques, SousTitres, Tampon, Vignette, quand, useT} from '../ui/base';
import {Billet, Commentaire, Foule, Oiseau, Perso, Telephone} from '../ui/illus';
import {E, SPR, clamp, compteur, mix, p, piste, sp} from '../lib/anim';
import {F} from '../lib/fonts';
import type {Spec} from '../lib/types';

// Concept « explicatif » : pourquoi le prix d'une place augmente (billetterie par paliers).
// Chaque apparition est déclenchée par le mot prononcé (quand(spec, 'mot', scène)).

const C = {nuit: '#0c0b1d', nuit2: '#1a1440', corail: '#ff6b4a', jaune: '#ffd23f', rose: '#ff4fa3', blanc: '#fff8f0', encre: '#141414'};
const ORGA = {peau: '#f1c7a2', cheveux: '#2b1d16', haut: '#ff6b4a', bas: '#23232c', coiffure: 'casquette' as const};

const Fond: React.FC<{t: number; teinte?: string}> = ({t, teinte = C.nuit2}) => (
  <AbsoluteFill style={{background: `radial-gradient(ellipse at ${50 + Math.sin(t * 0.4) * 12}% ${40 + Math.cos(t * 0.3) * 8}%, ${teinte} 0%, ${C.nuit} 70%)`}}>
    <svg width="100%" height="100%" style={{position: 'absolute', opacity: 0.18}}>
      <defs><pattern id="pts" width="54" height="54" patternUnits="userSpaceOnUse" patternTransform={`translate(${(t * 18) % 54} ${(t * 9) % 54})`}><circle cx="2" cy="2" r="2" fill="#fff" /></pattern></defs>
      <rect width="100%" height="100%" fill="url(#pts)" />
    </svg>
  </AbsoluteFill>
);

/** visible pendant la scène k (avec un léger débord pour les transitions) */
const dans = (spec: Spec, k: number, t: number, avant = 0.25, apres = 0.25) => t >= spec.scenes[k].start - avant && t < spec.scenes[k].end + apres;

export const Paliers: React.FC<{spec: Spec}> = ({spec}) => {
  const {t, fps} = useT();
  const S = spec.scenes;
  const q = (w: string, k: number) => quand(spec, w, k);

  // --- Plan 1 : le téléphone (scènes 0 et 1), puis on plonge dedans (fin de scène 1) -------------------
  const plongee = p(t, S[2].start - 0.35, 0.5, E.inCubic);
  const entreeTel = sp(t, -0.15, fps, SPR.doux);
  const jeudi = q('jeudi', 0);
  const prix = t < jeudi ? 12 : compteur(t, jeudi + 0.1, 0.7, 12, 20);
  const choc = t > jeudi + 0.1 && t < jeudi + 0.5 ? Math.sin(t * 90) * 10 * (1 - (t - jeudi - 0.1) / 0.4) : 0;
  const arnaque = q('arnaque', 1);
  const non = q('non', 1);
  const telVisible = t < S[2].start + 0.1;

  // --- Plan 2 : l'escalier des paliers, caméra qui monte (scènes 2 et 6) ---------------------------------
  const marches = [
    {nom: 'early bird', prix: 12, c: C.jaune},
    {nom: 'release 1', prix: 15, c: '#ffb347'},
    {nom: 'release 2', prix: 18, c: C.corail},
    {nom: 'last release', prix: 20, c: C.rose},
  ];
  const sc6 = S[6];
  const etape = t < sc6.start ? 0 : clamp(Math.floor(interpolate(t, [sc6.start, sc6.end - 0.3], [0, 3.999], {extrapolateRight: 'clamp'})), 0, 3);
  const cam = piste(t, [
    [S[2].start, {x: 0, y: 0, z: 1.25}],
    [S[2].end, {x: 0, y: 0, z: 1}],
    [sc6.start, {x: -260, y: 120, z: 1.35}],
    [sc6.end, {x: 260, y: -240, z: 1.35}],
  ], E.inOut);

  return (
    <AbsoluteFill style={{background: C.nuit, fontFamily: F.wide}}>
      <Fond t={t} teinte={t > S[8].start - 0.2 && t < S[8].end + 0.2 ? '#5a1e14' : C.nuit2} />
      {/* caméra vivante : petit « punch » à chaque nouvelle phrase, dérive lente le reste du temps */}
      <AbsoluteFill style={{transform: (() => {
        const k = S.findIndex((sc, n) => t >= sc.start && (n === S.length - 1 || t < S[n + 1].start));
        const t0 = S[Math.max(0, k)]?.start ?? 0;
        const punch = 1 + 0.06 * (1 - p(t, t0, 0.45, E.outExpo));
        return `scale(${punch * (1.02 + 0.015 * Math.sin(t * 0.7))}) translate(${Math.sin(t * 0.5) * 10}px, ${Math.cos(t * 0.43) * 8}px)`;
      })()}}>

      {/* ---------- SCÈNES 0-1 : le prix qui grimpe, « arnaque ? » ---------- */}
      {telVisible ? (
        <AbsoluteFill style={{transform: `scale(${mix(1, 9, plongee)})`, transformOrigin: '540px 760px', filter: plongee > 0.05 ? `blur(${plongee * 18}px)` : undefined, opacity: 1 - plongee * 0.9}}>
          <div style={{position: 'absolute', left: 540 + choc, top: mix(1500, 760, entreeTel), transform: `rotate(${mix(-14, -3, entreeTel)}deg)`}}>
            <Telephone w={470}>
              <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#2a1b5e,#120d2a)'}}>
                {/* lumières de club dessinées */}
                {[0, 1, 2, 3].map((i) => <div key={i} style={{position: 'absolute', left: 60 + i * 90, top: -40, width: 30, height: 520, background: `linear-gradient(${[C.rose, C.jaune, C.corail, '#7b5cff'][i]}, transparent)`, opacity: 0.55, transform: `rotate(${Math.sin(t * 1.5 + i) * 18}deg)`, transformOrigin: 'top', filter: 'blur(6px)'}} />)}
                <Foule n={9} w={440} hauteur={190} couleur="#07060f" style={{left: -2, top: 300}} seed={4} />
              </div>
              <div style={{position: 'absolute', left: 26, right: 26, top: 520, background: '#fff', borderRadius: 30, padding: '26px 28px', boxShadow: '0 20px 50px rgba(0,0,0,.25)'}}>
                <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 22, color: '#8a8a8a', letterSpacing: '0.1em'}}>{t < jeudi ? 'LUNDI' : 'JEUDI'} · BILLETTERIE</div>
                <div style={{fontWeight: 900, fontStretch: '110%', fontSize: 44, color: C.encre, textTransform: 'uppercase', marginTop: 8}}>Ta soirée</div>
                <div style={{display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 14}}>
                  <span style={{fontWeight: 900, fontStretch: '125%', fontSize: 150, lineHeight: 0.85, color: t > jeudi + 0.1 ? '#e8372c' : C.encre, transform: `scale(${t > jeudi + 0.1 && t < jeudi + 0.9 ? 1 + 0.12 * Math.sin((t - jeudi) * 12) : 1})`, display: 'inline-block', transformOrigin: 'left bottom'}}>{prix}</span>
                  <span style={{fontWeight: 900, fontSize: 70, color: C.encre}}>€</span>
                </div>
              </div>
            </Telephone>
          </div>
          {/* +8 € qui s'envole */}
          {t > jeudi + 0.3 && t < S[1].end ? <div style={{position: 'absolute', left: 700, top: 520 - p(t, jeudi + 0.3, 1.2) * 120, opacity: 1 - p(t, jeudi + 1.2, 0.6), fontWeight: 900, fontStretch: '115%', fontSize: 90, color: '#e8372c', textShadow: '0 6px 30px rgba(232,55,44,.6)'}}>+8 €</div> : null}
          {/* étiquette du jour */}
          <div style={{position: 'absolute', left: 540, top: 250, transform: `translate(-50%,-50%) scale(${sp(t, q('lundi', 0) - 0.1, fps, SPR.pop)})`}}>
            <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 40, background: t < jeudi ? C.jaune : '#e8372c', color: C.encre, padding: '12px 26px', borderRadius: 999, transform: `rotateX(${t > jeudi - 0.15 && t < jeudi + 0.15 ? 90 : 0}deg)`}}>{t < jeudi ? 'LUNDI' : 'JEUDI'}</div>
          </div>
          {/* ARNAQUE ? barré, puis NON. */}
          <Tampon t0={arnaque - 0.05} texte="arnaque ?" taille={130} style={{left: 540, top: 820}} />
          {t > non - 0.05 ? (() => {
            const ev = evolvePath(p(t, non - 0.05, 0.3), 'M150 860 L930 760');
            return <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}><path d="M150 860 L930 760" stroke={C.jaune} strokeWidth={30} strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} fill="none" /></svg>;
          })() : null}
          {t > non ? <div style={{position: 'absolute', left: 540, top: 1080, transform: `translate(-50%,-50%) scale(${sp(t, non, fps, SPR.pop)})`, fontFamily: F.serif, fontStyle: 'italic', fontSize: 240, color: C.jaune}}>non.</div> : null}
        </AbsoluteFill>
      ) : null}

      {/* ---------- SCÈNES 2 et 6 : l'escalier des paliers ---------- */}
      {(dans(spec, 2, t, 0.25, 0.45) || dans(spec, 6, t)) ? (
        <AbsoluteFill style={{opacity: dans(spec, 2, t, 0.25, 0.45) ? p(t, S[2].start - 0.2, 0.3) * (1 - p(t, S[2].end + 0.2, 0.2)) : p(t, sc6.start - 0.2, 0.3) * (1 - p(t, sc6.end - 0.1, 0.3))}}>
          {dans(spec, 2, t, 0.25, 0.45) ? (
            <div style={{position: 'absolute', left: 90, top: 250}}>
              <MotsMasques taille={190} largeur="68%" mots={[{w: 'le', t: S[2].start}, {w: 'système', t: S[2].start + 0.08}, {w: 'des', t: S[2].start + 0.16}, {w: 'paliers', t: q('paliers', 2) - 0.1, accent: true}]} italiqueAccent accent={C.jaune} style={{width: 900}} />
            </div>
          ) : null}
          <div style={{position: 'absolute', left: 540, top: 1150, transform: `scale(${cam.z}) translate(${-cam.x}px, ${-cam.y}px)`}}>
            {marches.map((m, i) => {
              const t0 = dans(spec, 2, t) ? S[2].start + 0.25 + i * 0.16 : sc6.start - 0.3;
              const a = sp(t, t0, fps, SPR.pop);
              const on = dans(spec, 6, t) && i <= etape;
              return (
                <div key={i} style={{position: 'absolute', left: -520 + i * 260, top: -i * 170 - 120 + (1 - a) * 400, width: 250, height: 120 + i * 170 + 300, background: on || dans(spec, 2, t) ? m.c : '#2b2650', borderRadius: 18,
                  boxShadow: on ? `0 0 60px ${m.c}88` : '0 20px 40px rgba(0,0,0,.4)', opacity: clamp(a * 2), transition: 'none'}}>
                  <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 24, color: C.encre, padding: '18px 18px 0', textTransform: 'uppercase', letterSpacing: '0.06em'}}>{m.nom}</div>
                  <div style={{fontWeight: 900, fontStretch: '120%', fontSize: 74, color: C.encre, padding: '0 18px', lineHeight: 1}}>{m.prix} €</div>
                </div>
              );
            })}
            {/* le billet qui grimpe les marches */}
            {dans(spec, 6, t) ? (() => {
              const pos = interpolate(t, [sc6.start, sc6.end - 0.3], [0, 3], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
              const i = Math.floor(pos), f = pos - i;
              const saut = Math.sin(f * Math.PI) * 120;
              const x = -395 + mix(i, Math.min(3, i + 1), E.inOut(f)) * 260;
              const y = -mix(i, Math.min(3, i + 1), E.inOut(f)) * 170 - 230 - saut;
              return <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) rotate(${f * 360}deg)`, width: 120, height: 80, background: '#fff', borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50}}>🎟️</div>;
            })() : null}
          </div>
          {dans(spec, 6, t) ? <div style={{position: 'absolute', left: 90, top: 260, fontFamily: F.mono, fontWeight: 700, fontSize: 30, color: '#ffffffaa', letterSpacing: '0.1em'}}>PRIX D'EXEMPLE</div> : null}
        </AbsoluteFill>
      ) : null}

      {/* ---------- SCÈNE 3 : l'organisateur ne sait pas combien viendront ---------- */}
      {(dans(spec, 3, t) || dans(spec, 4, t) || dans(spec, 5, t)) ? (
        <AbsoluteFill style={{opacity: p(t, S[3].start + 0.3, 0.3) * (1 - p(t, S[5].end - 0.1, 0.3))}}>
          <Perso look={ORGA} taille={760} x={dans(spec, 3, t) ? 360 : mix(360, 280, p(t, S[4].start, 0.6))} y={1290 + (1 - sp(t, S[3].start + 0.4, fps, SPR.doux)) * 800}
            pose={{parle: spec.mots.some((m) => t >= m.start && t <= m.end + 0.04), sourcils: dans(spec, 3, t) ? -0.6 : 0.6, bouche: dans(spec, 5, t) ? 'dents' : dans(spec, 3, t) ? 'plat' : 'sourire', brasD: dans(spec, 4, t) ? -110 : 15, brasG: dans(spec, 3, t) ? -150 : 12, tete: dans(spec, 3, t) ? -8 : 4, yeux: dans(spec, 5, t) ? 'plisses' : 'ouverts'}} />
          {dans(spec, 3, t) ? (
            <>
              {[0, 1, 2].map((i) => {
                const t0 = q('combien', 3) - 0.1 + i * 0.12;
                return <div key={i} style={{position: 'absolute', left: 560 + i * 150, top: 360 - i * 50, transform: `translate(-50%,-50%) scale(${sp(t, t0, fps, SPR.pop)}) rotate(${Math.sin(t * 3 + i) * 10}deg)`, fontFamily: F.serif, fontStyle: 'italic', fontSize: 260 - i * 40, color: [C.jaune, C.corail, C.rose][i]}}>?</div>;
              })}
              <div style={{position: 'absolute', left: 540, top: 600, width: 520, opacity: 0.35 + 0.35 * Math.abs(Math.sin(t * 3))}}>
                <Foule n={7} w={520} hauteur={260} couleur="#8f86c9" seed={9} />
              </div>
              <div style={{position: 'absolute', left: 560, top: 900, fontFamily: F.wide, fontWeight: 900, fontStretch: '110%', fontSize: 70, color: '#fff'}}>??? <span style={{fontFamily: F.serif, fontStyle: 'italic', fontWeight: 400}}>personnes</span></div>
            </>
          ) : null}
          {/* scène 4 : l'oiseau de l'early bird se pose sur le billet */}
          {dans(spec, 4, t) || dans(spec, 5, t) ? (() => {
            const t0 = q('early', 4) - 0.6;
            const f = p(t, t0, 0.9, E.outQuint);
            return (
              <>
                <Billet titre="Ta soirée" prix={<span>12 €</span>} palier="early bird" couleur={C.jaune} w={540} style={{left: 740, top: 640, transform: `translate(-50%,-50%) rotate(-4deg) scale(${sp(t, S[4].start + 0.1, fps, SPR.pop)})`}} />
                <Oiseau taille={250} style={{left: mix(1300, 660, f), top: mix(150, 470, f) - Math.sin(f * Math.PI) * 140}} />
                <Eclat t0={t0 + 0.9} x={760} y={620} couleurs={[C.jaune, '#fff', C.corail]} />
              </>
            );
          })() : null}
          {/* scène 5 : la jauge se remplit, SOLD OUT */}
          {dans(spec, 5, t) ? (() => {
            const fin = q('vite', 5);
            const r = interpolate(t, [S[5].start, fin], [0.15, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.inOut});
            return (
              <>
                <div style={{position: 'absolute', left: 500, top: 900, width: 520, height: 64, borderRadius: 99, background: '#ffffff22', overflow: 'hidden'}}>
                  <div style={{width: `${r * 100}%`, height: '100%', background: `linear-gradient(90deg, ${C.jaune}, ${C.corail})`}} />
                </div>
                <div style={{position: 'absolute', left: 500, top: 985, fontFamily: F.mono, fontWeight: 700, fontSize: 42, color: '#fff'}}>{Math.round(r * 100)} % vendu</div>
                <Tampon t0={fin} texte="sold out" couleur={C.corail} taille={100} style={{left: 770, top: 700}} />
              </>
            );
          })() : null}
        </AbsoluteFill>
      ) : null}

      {/* ---------- SCÈNE 7 : sur place, le prix fort ---------- */}
      {dans(spec, 7, t) ? (
        <AbsoluteFill style={{opacity: p(t, S[7].start - 0.2, 0.3) * (1 - p(t, S[7].end - 0.1, 0.3))}}>
          <div style={{position: 'absolute', left: 290, top: 380, width: 500, height: 760, borderRadius: '250px 250px 20px 20px', background: '#07060f', border: '14px solid #2b2650', boxShadow: `0 0 ${80 + 40 * Math.sin(t * 8)}px ${C.rose}55`}}>
            <div style={{position: 'absolute', left: '50%', top: -110, transform: 'translateX(-50%)', fontFamily: F.wide, fontWeight: 900, fontStretch: '110%', fontSize: 70, color: C.rose, whiteSpace: 'nowrap',
              textShadow: `0 0 18px ${C.rose}, 0 0 50px ${C.rose}`, opacity: (t * 7) % 3 < 0.25 && t < S[7].start + 1 ? 0.3 : 1}}>SUR PLACE</div>
            <div style={{position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 70%, ${C.rose}55, transparent 60%)`, borderRadius: 'inherit'}} />
          </div>
          <Foule n={6} w={760} hauteur={300} couleur="#05040b" seed={21} style={{left: 160, top: 1000}} />
          {(() => {
            const fort = q('prix', 7);
            const balance = Math.sin((t - fort) * 5) * 18 * Math.exp(-Math.max(0, t - fort) * 1.2);
            return (
              <div style={{position: 'absolute', left: 700, top: 560, transformOrigin: '50% -120px', transform: `rotate(${balance}deg) scale(${sp(t, fort - 0.15, fps, SPR.pop)})`}}>
                <div style={{width: 4, height: 120, background: '#fff', position: 'absolute', left: '50%', top: -120}} />
                <div style={{background: C.jaune, color: C.encre, fontWeight: 900, fontStretch: '120%', fontSize: 120, padding: '10px 36px', borderRadius: 22, transform: 'translateX(-50%)', whiteSpace: 'nowrap', boxShadow: '0 20px 50px rgba(0,0,0,.5)'}}>25 €</div>
              </div>
            );
          })()}
        </AbsoluteFill>
      ) : null}

      {/* ---------- SCÈNE 8 : la règle ---------- */}
      {dans(spec, 8, t) ? (
        <AbsoluteFill style={{clipPath: `circle(${p(t, S[8].start - 0.2, 0.55, E.outQuint) * 150}% at 50% 50%)`, background: C.corail}}>
          <div style={{position: 'absolute', left: 90, top: 420}}>
            <div style={{fontFamily: F.serif, fontStyle: 'italic', fontSize: 96, color: C.encre, marginBottom: 30, opacity: p(t, S[8].start + 0.1, 0.5), transform: `translateY(${(1 - p(t, S[8].start + 0.1, 0.6)) * 40}px)`}}>si une soirée te tente…</div>
            <MotsMasques taille={230} largeur="66%" couleur={C.encre} accent={C.blanc} style={{width: 900}}
              mots={[{w: 'prends', t: q('prends', 8) - 0.1}, {w: 'ta', t: q('ta', 8, ) - 0.05}, {w: 'place', t: q('place', 8) - 0.05}, {w: 'tôt.', t: q('tôt', 8) - 0.1, accent: true}]} italiqueAccent />
          </div>
          <div style={{position: 'absolute', left: 90, top: 300, fontFamily: F.mono, fontWeight: 700, fontSize: 34, color: C.encre, letterSpacing: '0.12em', opacity: p(t, S[8].start, 0.4)}}>LA RÈGLE</div>
        </AbsoluteFill>
      ) : null}

      {/* ---------- SCÈNE 9 : la question ---------- */}
      {dans(spec, 9, t, 0.2, 2) ? (
        <AbsoluteFill style={{opacity: p(t, S[9].start - 0.2, 0.3)}}>
          {[{txt: "team à l'avance", c: C.jaune, w: 'avance'}, {txt: 'team dernière minute', c: C.rose, w: 'dernière'}].map((b, i) => (
            <div key={i} style={{position: 'absolute', left: 540, top: 470 + i * 200, transform: `translate(-50%,-50%) scale(${sp(t, q(b.w, 9) - 0.2, fps, SPR.pop)}) rotate(${i ? 2 : -2}deg)`,
              background: b.c, color: C.encre, fontWeight: 900, fontStretch: '110%', fontSize: 66, padding: '22px 44px', borderRadius: 999, whiteSpace: 'nowrap', textTransform: 'uppercase'}}>{b.txt}</div>
          ))}
          <div style={{position: 'absolute', left: 540, top: 820, fontFamily: F.serif, fontStyle: 'italic', fontSize: 90, color: '#fff', transform: 'translate(-50%,0)', opacity: p(t, q('dernière', 9) + 0.3, 0.4)}}>ou</div>
          {t > q('minute', 9) + 0.2 ? <Commentaire texte="dernière minute, toujours 😅" t0={q('minute', 9) + 0.4} style={{left: 540, top: 1060, transform: `translate(-50%,-50%) scale(${sp(t, q('minute', 9) + 0.2, fps, SPR.pop)})`}} pseudo="un pote" /> : null}
        </AbsoluteFill>
      ) : null}

      </AbsoluteFill>
      <SousTitres mots={spec.mots} y={1330} taille={70} cles={['arnaque', 'paliers', 'early', 'bird', 'vite', 'cher', 'fort', 'tôt']} accent={dans(spec, 8, t, 0, 0) ? C.encre : C.corail} couleur={dans(spec, 8, t, 0, 0) ? C.blanc : '#fff'} />
      <Vignette force={0.5} />
      <Grain force={0.07} />
      <BandeSon spec={spec} />
    </AbsoluteFill>
  );
};
