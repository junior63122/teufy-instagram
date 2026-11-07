// Musique des reels : les sons d'Instagram (API Audio de Meta, juin 2026).
//  - recherche des musiques autorisées pour les publications par API (recherche vide = tendances) ;
//  - téléchargement de l'extrait pour caler le montage sur les vrais temps du morceau
//    (tempo et premier temps détectés ici) ;
//  - à la publication, le son est attaché au reel par son audio_id (Instagram le joue lui-même).
import { writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { chercherSons } from './instagram.mjs';

const REQUETES = {
  club: ['', 'afro house', 'amapiano', 'shatta', 'dancehall', 'tech house', 'house'],
  techno: ['techno', 'hard techno', 'tech house', 'rave', ''],
};

function pcm(fichier, sr) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-i', fichier, '-t', '60', '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const parts = [];
    p.stdout.on('data', (d) => parts.push(d));
    p.on('error', reject);
    p.on('close', (c) => { if (c) return reject(new Error('décodage audio impossible')); const b = Buffer.concat(parts); resolve(new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4))); });
  });
}

// Tempo et phase : enveloppe d'attaques (énergie des graves et des aigus), autocorrélation entre
// 85 et 160 BPM, puis le décalage qui aligne le mieux la grille sur les attaques.
export function detecterTempo(x, sr = 11025) {
  const hop = 256, fen = 512;
  const env = [];
  let prev = 0;
  for (let i = 0; i + fen < x.length; i += hop) {
    let e = 0;
    for (let k = 0; k < fen; k++) e += x[i + k] * x[i + k];
    e = Math.log(1e-9 + e);
    env.push(Math.max(0, e - prev));
    prev = e;
  }
  const fps = sr / hop;
  const moy = env.reduce((a, b) => a + b, 0) / (env.length || 1);
  const o = env.map((v) => v - moy);
  let best = { bpm: 120, s: -Infinity };
  const score = (bpm) => {
    const lag = (60 / bpm) * fps;
    let s = 0;
    for (const m of [1, 2, 4, 8]) {
      const L = lag * m, l0 = Math.floor(L), fr = L - l0;
      for (let i = 0; i + l0 + 1 < o.length; i++) s += o[i] * (o[i + l0] * (1 - fr) + o[i + l0 + 1] * fr) / Math.sqrt(m);
    }
    // Léger penchant pour la zone des musiques de club.
    return s * (1 + 0.15 * Math.exp(-(((bpm - 124) / 18) ** 2)));
  };
  for (let bpm = 85; bpm <= 160; bpm += 0.5) { const s = score(bpm); if (s > best.s) best = { bpm, s }; }
  for (let bpm = best.bpm - 0.5; bpm <= best.bpm + 0.5; bpm += 0.05) { const s = score(bpm); if (s > best.s) best = { bpm: +bpm.toFixed(2), s }; }
  const per = (60 / best.bpm) * fps;
  let phase = { p: 0, s: -Infinity };
  for (let p = 0; p < per; p += 0.5) {
    let s = 0;
    for (let t = p; t < env.length; t += per) s += env[Math.round(t)] || 0;
    if (s > phase.s) phase = { p, s };
  }
  return { bpm: best.bpm, phase: +(phase.p / fps).toFixed(3) };
}

export async function analyserSon(fichier) {
  return detecterTempo(await pcm(fichier, 11025), 11025);
}

// Choisit un son Instagram pour le reel et le prépare. Renvoie null si l'API n'est pas disponible.
export async function choisirSon({ ig, genre = 'club', dossier, r = Math.random, deja = [], log = console.log }) {
  if (!ig) return null;
  const requetes = REQUETES[genre === 'techno' ? 'techno' : 'club'];
  const vus = new Map();
  for (const q of requetes) {
    try {
      for (const a of await chercherSons(ig, { type: 'music', requete: q })) if (a.download_url && !vus.has(a.audio_id)) vus.set(a.audio_id, { ...a, requete: q });
    } catch (err) { log(`Sons Instagram (${q || 'tendances'}) : ${err.message}`); if (/permission|OAuth|\(#10\)|\(#200\)/i.test(err.message)) break; }
    if (vus.size >= 40) break;
  }
  const dejaVus = new Set(deja);
  const liste = [...vus.values()].filter((a) => !dejaVus.has(a.audio_id) && (a.duration_in_ms || 0) >= 20000);
  if (!liste.length) return null;
  // Les tendances (recherche vide) et le style de la soirée d'abord, avec un peu de hasard.
  const poids = (a) => (a.requete === '' ? 2 : 1) * (0.5 + r());
  liste.sort((a, b) => poids(b) - poids(a));
  await mkdir(dossier, { recursive: true });
  for (const a of liste.slice(0, 5)) {
    try {
      const res = await fetch(a.download_url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) continue;
      const fichier = path.join(dossier, `son-${a.audio_id}.m4a`);
      await writeFile(fichier, Buffer.from(await res.arrayBuffer()));
      const tempo = await analyserSon(fichier);
      return { audio_id: a.audio_id, titre: a.title, artiste: a.display_artist || a.ig_username || '', requete: a.requete, fichier, ...tempo };
    } catch (err) { log(`Son ${a.audio_id} inutilisable : ${err.message}`); }
  }
  return null;
}
