import React from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

// Polices libres embarquées : Archivo (largeur variable 62 à 125 %), Instrument Serif, Space Mono.
export const F = {
  wide: "'Archivo', sans-serif",
  serif: "'InstrumentSerif', serif",
  mono: "'SpaceMono', monospace",
};

const CSS = () => `
@font-face{font-family:'Archivo';src:url(${staticFile('fonts/archivo.woff2')}) format('woff2');font-weight:100 900;font-stretch:62% 125%}
@font-face{font-family:'Archivo';src:url(${staticFile('fonts/archivo-ext.woff2')}) format('woff2');font-weight:100 900;font-stretch:62% 125%;unicode-range:U+0100-024F,U+1E00-1EFF,U+20A0-20CF}
@font-face{font-family:'InstrumentSerif';src:url(${staticFile('fonts/serif-italic.woff2')}) format('woff2');font-style:italic}
@font-face{font-family:'InstrumentSerif';src:url(${staticFile('fonts/serif.woff2')}) format('woff2');font-style:normal}
@font-face{font-family:'SpaceMono';src:url(${staticFile('fonts/mono.woff2')}) format('woff2');font-weight:700}`;

/** Déclare les polices et retient le rendu tant qu'elles ne sont pas chargées (dans chaque onglet de rendu). */
export const Polices: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [h] = React.useState(() => delayRender('polices'));
  React.useEffect(() => {
    let fini = false;
    const ok = () => { if (!fini) { fini = true; continueRender(h); } };
    Promise.all(['900 125% 40px Archivo', 'italic 40px InstrumentSerif', '700 40px SpaceMono'].map((f) => document.fonts.load(f))).then(ok, ok);
    const tm = setTimeout(ok, 8000);
    return () => clearTimeout(tm);
  }, [h]);
  return React.createElement(React.Fragment, null, React.createElement('style', null, CSS()), children);
};
