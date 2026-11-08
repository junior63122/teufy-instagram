import React from 'react';
import {Composition, Still, staticFile} from 'remotion';
import {Carrousel, PostFlash, PostSoiree} from './posts/Affiches';
import donnees from '../public/evenements/verifie.json';
import {Polices} from './lib/fonts';
import type {Spec} from './lib/types';
import {Paliers} from './concepts/Paliers';
import {Potes} from './concepts/Potes';
import {Nuit} from './concepts/Nuit';
import {Paliers2} from './concepts/Paliers2';
import {Marque} from './concepts/Marque';
import {PotesFluide} from './concepts/PotesFluide';
import {Histoire} from './concepts/Histoire';


// Une composition par concept. La durée vient de la spec (voix off + scènes), lue au rendu.
const CONCEPTS: Record<string, React.FC<{spec: Spec}>> = {paliers: Paliers, potes: Potes, nuit: Nuit, paliers2: Paliers2, marque: Marque, potesfluide: PotesFluide, histoire: Histoire};

const vide: Spec = {id: 'vide', concept: 'paliers', duree: 3, mots: [], scenes: []};

export const Root: React.FC = () => (
  <>
    {Object.entries(CONCEPTS).map(([id, Comp]) => (
      <Composition
        key={id}
        id={id}
        component={((props: {spec: Spec}) => <Polices><Comp spec={props.spec} /></Polices>) as React.FC<any>}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={90}
        defaultProps={{spec: vide, specFile: ''}}
        calculateMetadata={async ({props}) => {
          const p = props as {spec: Spec; specFile?: string};
          const spec: Spec = p.specFile ? await (await fetch(staticFile(p.specFile))).json() : p.spec;
          const fps = spec.fps ?? 30;
          return {fps, durationInFrames: Math.ceil(spec.duree * fps), props: {...p, spec}};
        }}
      />
    ))}
    <Still id="post" component={((p: any) => <Polices><PostSoiree s={p.s} /></Polices>) as React.FC<any>} width={1080} height={1350} defaultProps={{s: donnees.soirees[1]}} />
    <Still id="flash" component={((p: any) => <Polices><PostFlash f={p.f} /></Polices>) as React.FC<any>} width={1080} height={1350} defaultProps={{f: {type: 'annonce', surtitre: "C'EST OFFICIEL", titre: 'Titre', sous_titre: '', faits: [], source: '', date: ''}}} />
    <Still id="carrousel" component={((p: any) => <Polices><Carrousel soirees={p.soirees ?? donnees.soirees} slide={p.slide} titre={p.titre ?? ["5 soirées à pas rater", "avant noël"]} lieu={p.lieu ?? "FRIGO 16"} pied={p.pied} fond={p.fond} /></Polices>) as React.FC<any>} width={1080} height={1350} defaultProps={{slide: 0}} />
  </>
);
