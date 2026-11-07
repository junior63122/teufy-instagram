// Bande son du reel immersif « Nuit » : musique étouffée (comme derrière la porte du club),
// puis la porte s'ouvre sur le temps fort : flash, impact, la musique éclate, la foule.
import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [bpm, debutMusique, total] = [118.1, 31.4, 23.6];
const b = 60 / bpm;
const T = +(12 * b).toFixed(3); // la porte s'ouvre au 13e temps
const pub = (f) => path.join(STUDIO, 'public', f);
mkdirSync(pub('nuit'), {recursive: true});
const coupes = [16, 20, 24, 26, 28, 30].map((n) => +(n * b).toFixed(3)); // whooshes des coupes (temps)
const f = [
  `[0:a]atrim=${debutMusique}:${debutMusique + total},asetpts=PTS-STARTPTS,asplit=2[m1][m2]`,
  `[m1]lowpass=f=320,lowpass=f=320,volume=0.9,afade=t=out:st=${T - 0.04}:d=0.08[etouffe]`,
  `[m2]afade=t=in:st=${T}:d=0.03,afade=t=out:st=${total - 1.6}:d=1.6[plein]`,
  `[1:a]aloop=loop=-1:size=2e9,atrim=0:${T},lowpass=f=700,volume=0.25,afade=t=out:st=${T - 0.1}:d=0.1[foule]`,
  `[2:a]adelay=${Math.round((T - 0.02) * 1000)}|${Math.round((T - 0.02) * 1000)},volume=0.7[flash]`,
  `[3:a]adelay=${Math.round(T * 1000)}|${Math.round(T * 1000)},volume=0.55[impact]`,
  `[4:a]adelay=${Math.round((T + 0.1) * 1000)}|${Math.round((T + 0.1) * 1000)},volume=0.35[cris]`,
  ...coupes.map((c, i) => `[5:a]adelay=${Math.round((c - 0.18) * 1000)}|${Math.round((c - 0.18) * 1000)},volume=0.25[w${i}]`),
  `[etouffe][plein][foule][flash][impact][cris]${coupes.map((_, i) => `[w${i}]`).join('')}amix=inputs=${6 + coupes.length}:normalize=0:duration=longest,atrim=0:${total},loudnorm=I=-14:TP=-1.5[a]`,
];
const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', pub('musique/hazy-after-hours.mp3'), '-i', pub('sfx/fete.mp3'), '-i', pub('sfx/flash.mp3'), '-i', pub('sfx/impact.mp3'), '-i', pub('sfx/acclamation.mp3'), '-i', pub('sfx/whoosh.mp3'),
  '-filter_complex', f.join(';'), '-map', '[a]', '-ar', '44100', '-ac', '2', pub('nuit/bande.wav')], {stdio: 'inherit'});
console.log(r.status === 0 ? `bande prête (porte à ${T} s)` : 'échec');
