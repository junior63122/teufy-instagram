// Monte le reel (MP4 H.264 1080×1920, 30 i/s) à partir des PNG, avec ffmpeg.
// Chaque image a un léger zoom, les transitions sont des fondus/glissés rapides.
// Musique : un fichier pris au hasard dans assets/musiques/techno/ (reel techno) ou
// assets/musiques/club/ (les autres), à défaut dans assets/musiques/ (mp3/m4a libres de droits),
// sinon une piste silencieuse (Instagram exige une piste audio).
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const FPS = 30;
const TRANSITIONS = ['slideleft', 'fade', 'slideup', 'circleopen', 'smoothleft', 'fadeblack'];

export async function buildReel(images, out, { root, durees, genre = 'club' }) {
  const T = 0.35; // durée d'une transition
  const inputs = [];
  const filters = [];
  images.forEach((img, i) => {
    const d = durees[i];
    inputs.push('-loop', '1', '-t', String(d + T), '-i', img);
    const frames = Math.round((d + T) * FPS);
    // Zoom doux 1.00 → 1.06 (alterné avant/arrière)
    const z = i % 2 ? `1.06-0.06*on/${frames}` : `1+0.06*on/${frames}`;
    filters.push(`[${i}:v]scale=1188:2112,zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=${FPS},setsar=1,format=yuv420p[v${i}]`);
  });

  let last = 'v0';
  let offset = 0;
  for (let i = 1; i < images.length; i++) {
    offset += durees[i - 1];
    const tr = TRANSITIONS[(i - 1) % TRANSITIONS.length];
    filters.push(`[${last}][v${i}]xfade=transition=${tr}:duration=${T}:offset=${offset.toFixed(3)}[x${i}]`);
    last = `x${i}`;
  }
  const total = durees.reduce((a, b) => a + b, 0) + T;

  const musique = (await pickMusic(path.join(root, 'assets', 'musiques', genre))) || (await pickMusic(path.join(root, 'assets', 'musiques')));
  const audioIdx = images.length;
  if (musique) inputs.push('-i', musique);
  else inputs.push('-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
  filters.push(`[${audioIdx}:a]atrim=0:${total.toFixed(3)},afade=t=in:d=0.3,afade=t=out:st=${Math.max(0, total - 1.2).toFixed(3)}:d=1.2,asetpts=PTS-STARTPTS[a]`);

  const args = [
    '-y', ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', `[${last}]`, '-map', '[a]',
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
    '-t', total.toFixed(3), '-movflags', '+faststart', out,
  ];
  await run('ffmpeg', args);
  return { out, total, musique };
}

async function pickMusic(dir) {
  if (!existsSync(dir)) return null;
  const files = (await readdir(dir)).filter((f) => /\.(mp3|m4a|aac|wav)$/i.test(f));
  if (!files.length) return null;
  return path.join(dir, files[Math.floor(Math.random() * files.length)]);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} a échoué (${code}) :\n${err}`))));
  });
}
