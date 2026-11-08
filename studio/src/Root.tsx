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
import {Flash} from './concepts/Flash';
import {CarrouselFlash, Couverture, CouvertureReel, PostFlashDA, StoryRelais} from './da/Posts';
import {Planche, Storyboard} from './da/Storyboard';
import {PostSpecial} from './da/Special';


// Une composition par concept. La durée vient de la spec (voix off + scènes), lue au rendu.
const CONCEPTS: Record<string, React.FC<{spec: Spec}>> = {paliers: Paliers, potes: Potes, nuit: Nuit, paliers2: Paliers2, marque: Marque, potesfluide: PotesFluide, histoire: Histoire, reelflash: Flash};

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
    <Still id="flash" component={((p: any) => <Polices><PostFlashDA f={p.f} photo={p.photo} /></Polices>) as React.FC<any>} width={1080} height={1350} defaultProps={{f: {type: 'annonce', surtitre: "C'EST OFFICIEL", titre: 'Titre', sous_titre: '', faits: [], source: '', date: ''}}} />
    <Still id="carrousel-flash" component={((p: any) => <Polices><CarrouselFlash soirees={p.soirees ?? donnees.soirees} slide={p.slide} titre={p.titre ?? "5 soirées à ne pas [rater]"} sous={p.sous} photo={p.photo} photoFin={p.photoFin} rubrique={p.rubrique} question={p.question} /></Polices>) as React.FC<any>} width={1080} height={1350} defaultProps={{slide: 0}} />
    <Still id="couverture" component={((p: any) => <Polices><Couverture {...p} /></Polices>) as React.FC<any>} width={1080} height={1350} defaultProps={{rubrique: 'Débat', titre: 'Titre', photo: 'decors/da/danse.jpg'}} />
    <Still id="story" component={((p: any) => <Polices><StoryRelais {...p} /></Polices>) as React.FC<any>} width={1080} height={1920} defaultProps={{image: 'decors/da/danse.jpg'}} />
    <Still id="couverture-reel" component={((p: any) => <Polices><CouvertureReel {...p} /></Polices>) as React.FC<any>} width={1080} height={1920} defaultProps={{photo: 'decors/da/danse.jpg', rubrique: 'Explicatif', titre: 'Titre'}} />
    <Still id="special" component={((p: any) => <Polices><PostSpecial {...p} /></Polices>) as React.FC<any>} width={1080} height={1350} defaultProps={{theme: 'noel', photo: 'decors/fetes/noel.jpg', titre: 'Joyeux [Noël]', rubrique: 'Joyeux Noël'}} />
    <Still id="storyboard" component={((p: any) => <Polices><Storyboard soirees={p.soirees ?? donnees.soirees} /></Polices>) as React.FC<any>} width={1080} height={2190} defaultProps={{}} />
    <Still id="planche" component={(() => <Polices><Planche /></Polices>) as React.FC<any>} width={1080} height={1600} defaultProps={{}} />
    <Still id="carrousel" component={((p: any) => <Polices><Carrousel soirees={p.soirees ?? donnees.soirees} slide={p.slide} titre={p.titre ?? ["5 soirées à pas rater", "avant noël"]} lieu={p.lieu ?? "FRIGO 16"} pied={p.pied} fond={p.fond} /></Polices>) as React.FC<any>} width={1080} height={1350} defaultProps={{slide: 0}} />
  </>
);
