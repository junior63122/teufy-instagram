// Description d'un reel : produite par le script (narration, scènes) puis complétée par la voix off.
export type Mot = {w: string; start: number; end: number; scene: number};
export type Scene = {id: string; texte: string; start: number; end: number; [k: string]: unknown};
export type Bruit = {src: string; at: number; volume?: number};
export type Spec = {
  id: string;
  concept: string;
  fps?: number;
  duree: number;
  voix?: {src: string; volume?: number};
  musique?: {src: string; volume?: number; debut?: number; ducking?: number};
  bande?: {src: string; volume?: number};
  bruits?: Bruit[];
  mots: Mot[];
  scenes: Scene[];
  palette?: Record<string, string>;
  sousTitres?: boolean;
  [k: string]: unknown;
};
