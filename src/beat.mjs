// Musique générée par le code, sans droits (technique reprise du skill HyperFrames « motion reel ») :
// une boucle house (124 BPM) ou techno (132 BPM) synthétisée note par note — kick, hi-hats, clap,
// basse et accords — écrite en WAV. Le tempo sert aussi de grille : les coupes du reel tombent sur les temps.
import { writeFile } from 'node:fs/promises';

const SR = 44100;

export const STYLES = {
  club: { bpm: 124, racine: 45, accords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9], [-5, -1, 2, 5]], swing: 0.02 },
  techno: { bpm: 132, racine: 41, accords: null, swing: 0 },
};

export const tempsBeat = (style) => 60 / STYLES[style].bpm;
// Arrondit une durée au nombre de temps le plus proche (au moins `min` temps).
export const surLaGrille = (sec, style, min = 2) => Math.max(min, Math.round(sec / tempsBeat(style))) * tempsBeat(style);

function rng(seed) { let h = seed >>> 0 || 1; return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296 * 2 - 1); }
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

export async function genererBeat({ style = 'club', duree, sortie, seed = 7 }) {
  const S = STYLES[style];
  const b = 60 / S.bpm;
  const n = Math.ceil((duree + 1) * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  const bruit = rng(seed);
  const add = (t0, len, fn, pan = 0) => {
    const i0 = Math.floor(t0 * SR), m = Math.min(n - i0, Math.floor(len * SR));
    for (let i = 0; i < m; i++) { const v = fn(i / SR); L[i0 + i] += v * (1 - pan); R[i0 + i] += v * (1 + pan); }
  };
  const kick = (t0) => { let ph = 0; add(t0, 0.45, (t) => { const f = 45 + 110 * Math.exp(-t * 32); ph += (2 * Math.PI * f) / SR; return Math.sin(ph) * Math.exp(-t * 7) * 0.95; }); };
  const hat = (t0, ouvert, pan) => { let prev = 0; add(t0, ouvert ? 0.18 : 0.05, (t) => { const x = bruit(); const hp = x - prev; prev = x; return hp * Math.exp(-t * (ouvert ? 22 : 70)) * 0.22; }, pan); };
  const clap = (t0) => { let prev = 0; add(t0, 0.25, (t) => { const x = bruit(); const bp = x - prev * 0.6; prev = x; const env = t < 0.03 ? (Math.floor(t * 100) % 2 ? 0.6 : 1) : Math.exp(-(t - 0.03) * 18); return bp * env * 0.32; }); };
  const basse = (t0, note, len) => { let ph = 0; const f = hz(note); add(t0, len, (t) => { ph += f / SR; const saw = 2 * (ph % 1) - 1; return (Math.sin(2 * Math.PI * ph) * 0.7 + saw * 0.18) * Math.min(1, t * 200) * Math.exp(-t * 5) * 0.5; }); };
  const accord = (t0, notes, len) => notes.forEach((d, k) => { let ph = 0; const f = hz(S.racine + 24 + d); add(t0, len, (t) => { ph += f / SR; const v = 2 * (ph % 1) - 1; return v * 0.035 * Math.min(1, t * 60) * Math.exp(-t * 3); }, k % 2 ? 0.25 : -0.25); });
  const rumble = (t0) => { let ph = 0; add(t0 + b * 0.5, b * 0.5, (t) => { ph += hz(S.racine) / SR; return Math.sin(2 * Math.PI * ph) * Math.exp(-t * 6) * 0.35; }); };

  const temps = Math.ceil((duree + 1) / b);
  for (let k = 0; k < temps; k++) {
    const t = k * b;
    const mesure = Math.floor(k / 4), dansMesure = k % 4;
    const intro = k < 4; // une mesure plus légère au début
    kick(t);
    hat(t + b / 2 + S.swing, style === 'techno' ? false : dansMesure % 2 === 1, 0.3);
    if (style === 'techno') { hat(t + b / 4, false, -0.3); hat(t + (3 * b) / 4, false, 0.2); rumble(t); }
    if (!intro && (dansMesure === 1 || dansMesure === 3)) clap(t);
    if (style === 'club' && !intro) {
      const ac = S.accords[mesure % S.accords.length];
      basse(t + b / 2, S.racine + ac[0], b * 0.45);
      if (dansMesure === 0) accord(t, ac, b * 1.6);
    }
  }
  // Normalisation douce et écriture WAV 16 bits stéréo.
  let max = 0;
  for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(L[i]), Math.abs(R[i]));
  const g = max > 0 ? 0.89 / max : 1;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.tanh(L[i] * g * 1.2) * 32000), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.tanh(R[i] * g * 1.2) * 32000), 46 + i * 4);
  }
  await writeFile(sortie, buf);
  return sortie;
}
