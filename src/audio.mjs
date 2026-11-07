// Son des reels, 100 % gratuit et sans droits :
//  - voix off française générée par Piper (synthèse vocale open source, voix « siwis » et « tom ») ;
//  - bruitages fabriqués par ffmpeg (whoosh de transition, impact, pop) ;
//  - mixage : musique baissée automatiquement quand la voix parle (sidechain), volume égalisé.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const VOIX_DIR = process.env.TEUFY_VOIX_DIR || path.join(os.homedir(), '.teufy-voix');
const PIPER = process.env.PIPER_BIN || 'piper';

// Voix off : ElevenLabs (voix naturelles, clé ELEVENLABS_API_KEY) ; Piper seulement si activé dans config.json.
export function voixDisponibles(config = {}) {
  const v = config.voix_off || {};
  if (process.env.ELEVENLABS_API_KEY && v.fournisseur !== 'aucune') return ['elevenlabs'];
  if (v.piper === true) return ['siwis', 'tom'].filter((x) => existsSync(path.join(VOIX_DIR, `fr_FR-${x}-medium.onnx`)));
  return [];
}

// --- ElevenLabs -------------------------------------------------------------------

const EL = 'https://api.elevenlabs.io/v1';
let voixChoisie;
// Voix : celle de config.json (voix_off.voice_id ou secret ELEVENLABS_VOICE_ID), sinon une voix française du compte.
async function voiceId(config) {
  const fixe = (process.env.ELEVENLABS_VOICE_ID || config.voix_off?.voice_id || '').trim();
  if (fixe) return fixe;
  if (voixChoisie) return voixChoisie;
  const res = await fetch(`${EL}/voices`, { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY.trim() }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`ElevenLabs voix : HTTP ${res.status}`);
  const { voices = [] } = await res.json();
  const fr = (v) => /fr/i.test(JSON.stringify([v.labels?.language, v.labels?.accent, v.verified_languages?.map((l) => l.language)]));
  voixChoisie = (voices.find(fr) || voices[0])?.voice_id;
  if (!voixChoisie) throw new Error('Aucune voix ElevenLabs disponible');
  return voixChoisie;
}

// Mots et minutage à partir de l'alignement caractère par caractère renvoyé par ElevenLabs.
export function motsDepuisAlignement(al) {
  const mots = [];
  if (!al?.characters) return mots;
  let cur = null;
  al.characters.forEach((c, i) => {
    if (/\s/.test(c)) { if (cur) { mots.push(cur); cur = null; } return; }
    if (!cur) cur = { mot: '', debut: al.character_start_times_seconds[i], fin: 0 };
    cur.mot += c;
    cur.fin = al.character_end_times_seconds[i];
  });
  if (cur) mots.push(cur);
  return mots;
}

async function parlerElevenLabs(texte, { dossier, nom, config }) {
  const v = config.voix_off || {};
  const id = await voiceId(config);
  const res = await fetch(`${EL}/text-to-speech/${id}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY.trim(), 'content-type': 'application/json' },
    body: JSON.stringify({ text: texte, model_id: v.modele || 'eleven_v3', language_code: 'fr', voice_settings: { stability: v.stabilite ?? 0.4, similarity_boost: 0.8, style: v.style ?? 0.45, speed: v.vitesse ?? 1.05 } }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`ElevenLabs : HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const fichier = path.join(dossier, `${nom}.mp3`);
  await writeFile(fichier, Buffer.from(j.audio_base64, 'base64'));
  return { fichier, duree: await duree(fichier), mots: motsDepuisAlignement(j.alignment || j.normalized_alignment) };
}

function run(cmd, args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err = (err + d).slice(-2000); });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve(out) : reject(new Error(`${cmd} (${c}) : ${err}`))));
    if (input) { p.stdin.write(input); p.stdin.end(); }
  });
}

export async function duree(fichier) {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', fichier]);
  return parseFloat(out) || 0;
}

// Prononciation : on lit les sigles et symboles comme on les dit.
const dire = (t) => String(t)
  .replace(/@([a-z0-9._]+)/gi, '')
  .replace(/\bDJ\b/g, 'didjé').replace(/€/g, ' euros').replace(/&/g, ' et ')
  .replace(/\bst-/gi, 'Saint-').replace(/[«»"#*_]/g, '').replace(/\s+/g, ' ').trim();

// Synthèse d'une phrase ; renvoie { fichier, duree } ou null si Piper n'est pas installé.
export async function parler(texte, { voix = 'siwis', dossier, nom, vitesse = 0.9, config = {} }) {
  if (voix === 'elevenlabs') {
    if (!texte) return null;
    await mkdir(dossier, { recursive: true });
    try { return await parlerElevenLabs(dire(texte), { dossier, nom, config }); } catch (err) { console.error(`Voix off ElevenLabs impossible : ${err.message}`); return null; }
  }
  const modele = path.join(VOIX_DIR, `fr_FR-${voix}-medium.onnx`);
  if (!existsSync(modele) || !texte) return null;
  await mkdir(dossier, { recursive: true });
  const fichier = path.join(dossier, `${nom}.wav`);
  try {
    await run(PIPER, ['-m', modele, '-f', fichier, '--length-scale', String(vitesse), '--sentence-silence', '0.15'], dire(texte));
    return { fichier, duree: await duree(fichier) };
  } catch (err) {
    console.error(`Voix off impossible : ${err.message.slice(0, 200)}`);
    return null;
  }
}

// Bruitages générés une fois (aucun fichier externe).
export async function bruitages(dossier) {
  await mkdir(dossier, { recursive: true });
  const defs = {
    whoosh: 'anoisesrc=d=0.5:c=pink:a=0.6,highpass=f=300,lowpass=f=7000,afade=t=in:d=0.3:curve=exp,afade=t=out:st=0.3:d=0.2,volume=0.9',
    impact: 'sine=f=52:d=0.7,volume=2.2,afade=t=out:st=0.05:d=0.65:curve=exp',
    pop: 'sine=f=880:d=0.09,afade=t=out:st=0.01:d=0.08,volume=0.6',
    riser: 'anoisesrc=d=1.2:c=white:a=0.35,highpass=f=1200,afade=t=in:d=1.1:curve=exp,afade=t=out:st=1.1:d=0.1',
  };
  const out = {};
  for (const [nom, src] of Object.entries(defs)) {
    const f = path.join(dossier, `${nom}.wav`);
    if (!existsSync(f)) await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', src, '-ar', '44100', '-ac', '2', f]);
    out[nom] = f;
  }
  return out;
}

// Mixage final : musique (en boucle, baissée sous la voix), voix et bruitages placés dans le temps.
// pistes = [{ fichier, debut (s), volume }] ; voix = [{ fichier, debut }]
export async function mixer({ total, musique, voix = [], sfx = [], sortie, niveau = -14 }) {
  const inputs = [];
  const filtres = [];
  let i = 0;
  if (musique) { inputs.push('-stream_loop', '-1', '-i', musique); } else { inputs.push('-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'); }
  filtres.push(`[0:a]atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo,volume=${voix.length ? 0.55 : 0.8}[mus]`);
  i = 1;
  const placer = (liste, prefixe) => liste.map((p, k) => {
    inputs.push('-i', p.fichier);
    const ms = Math.round(p.debut * 1000);
    filtres.push(`[${i}:a]aresample=44100,aformat=channel_layouts=stereo,volume=${p.volume ?? 1},adelay=${ms}|${ms}[${prefixe}${k}]`);
    i++;
    return `[${prefixe}${k}]`;
  });
  const v = placer(voix, 'v');
  const s = placer(sfx, 's');
  let musique2 = '[mus]';
  if (v.length) {
    filtres.push(`${v.join('')}amix=inputs=${v.length}:normalize=0:duration=longest,volume=1.6[voixbus]`, '[voixbus]asplit=2[vx][vsc]',
      '[mus][vsc]sidechaincompress=threshold=0.03:ratio=10:attack=15:release=350[musd]');
    musique2 = '[musd]';
  }
  const tous = [musique2, ...(v.length ? ['[vx]'] : []), ...s];
  filtres.push(`${tous.join('')}amix=inputs=${tous.length}:normalize=0:duration=first,atrim=0:${total.toFixed(3)},loudnorm=I=${niveau}:TP=-1.5,afade=t=out:st=${Math.max(0, total - 0.8).toFixed(3)}:d=0.8[a]`);
  await run('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filtres.join(';'), '-map', '[a]', '-ar', '44100', '-c:a', 'pcm_s16le', sortie]);
  return sortie;
}
