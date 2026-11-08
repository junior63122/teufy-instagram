import React from 'react';
import {cancelRender, continueRender, delayRender, useVideoConfig} from 'remotion';

// Garde-fous de mise en page de la DA :
//  - <Ajuste> : le texte rétrécit jusqu'à tenir entièrement dans sa boîte (jamais coupé, jamais de « … »).
//  - <ControleVisuel> : après le chargement des polices, vérifie toute la page ; si un texte dépasse du cadre ou de sa
//    boîte, ou si une image est trop petite, le rendu ÉCHOUE (et le bot ne publie pas un visuel raté).

const policesPretes = () => (document as any).fonts?.ready ?? Promise.resolve();

/** Texte qui s'ajuste : taille max, au plus `lignes` lignes, jamais plus large que sa boîte. */
export const Ajuste: React.FC<{children: React.ReactNode; max: number; min?: number; lignes?: number; interligne?: number; style?: React.CSSProperties}> = ({children, max, min = 18, lignes = 1, interligne = 1.1, style}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [taille, setTaille] = React.useState(max);
  const [h] = React.useState(() => delayRender('ajuste'));
  React.useLayoutEffect(() => {
    let fini = false;
    policesPretes().then(() => {
      const el = ref.current;
      if (!el || fini) return;
      let t = max;
      const tient = () => {
        el.style.fontSize = `${t}px`;
        // les lettres d'un titre serré débordent un peu de leur ligne : marge de 0,3 × la taille
        return el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= Math.ceil(t * interligne * lignes + t * 0.3);
      };
      while (t > min && !tient()) t -= Math.max(1, Math.round(t * 0.04));
      setTaille(t);
      continueRender(h);
    });
    return () => { fini = true; };
  }, [max, min, lignes, interligne, h]);
  return (
    <div ref={ref} data-verif="texte" data-lignes={lignes} style={{...style, fontSize: taille, lineHeight: interligne, overflow: 'hidden', overflowWrap: 'normal', wordBreak: 'keep-all', hyphens: 'none'}}>
      {children}
    </div>
  );
};

/** Vérifie la page rendue. `imageMin` : largeur minimale (px) des images marquées data-verif="image". */
export const ControleVisuel: React.FC<{imageMin?: number}> = ({imageMin = 420}) => {
  const {width, height} = useVideoConfig();
  const [h] = React.useState(() => delayRender('controle-visuel'));
  React.useEffect(() => {
    policesPretes().then(() => new Promise((r) => setTimeout(r, 120))).then(() => {
      const erreurs: string[] = [];
      const racine = document.getElementById('remotion-root') || document.body;
      const base = racine.getBoundingClientRect();
      const k = base.width / width || 1;
      document.querySelectorAll<HTMLElement>('[data-verif]').forEach((el) => {
        const r = el.getBoundingClientRect();
        const x = (r.left - base.left) / k, y = (r.top - base.top) / k, w = r.width / k, hh = r.height / k;
        const nom = (el.innerText || el.getAttribute('src') || '').slice(0, 40).replace(/\s+/g, ' ');
        if (w > 0 && (x < -1 || y < -1 || x + w > width + 1 || y + hh > height + 1)) erreurs.push(`sort du cadre : « ${nom} »`);
        if (el.dataset.verif === 'texte') {
          const fs = parseFloat(getComputedStyle(el).fontSize) || 20;
          const lh = parseFloat(getComputedStyle(el).lineHeight) || fs;
          const max = Number(el.dataset.lignes || 1);
          if (el.scrollWidth > el.clientWidth + 2) erreurs.push(`texte trop large : « ${nom} »`);
          else if (el.scrollHeight > lh * max + fs * 0.35) erreurs.push(`texte trop long (plus de ${max} ligne(s)) : « ${nom} »`);
        }
        if (el.dataset.verif === 'image' && w < imageMin && hh < imageMin) erreurs.push(`image trop petite (${Math.round(w)}×${Math.round(hh)} px) : ${nom}`);
      });
      if (erreurs.length) cancelRender(new Error(`Contrôle visuel : ${erreurs.join(' ; ')}`));
      else continueRender(h);
    });
  }, [h, width, height, imageMin]);
  return null;
};
