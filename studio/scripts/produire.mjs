// Production d'un reel du studio : script → voix off (ElevenLabs, minutage au mot) → spec → rendu Remotion.
//   node scripts/produire.mjs scripts/concepts/paliers.json [--sans-voix] [--still=12]
import {readFileSync, existsSync} from 'node:fs';
import {writeFile, mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}`))?.split('=')[1] ?? (process.argv.includes(`--${n}`) ? true : undefined);
const fichier = process.argv[2];
const C = JSON.parse(readFileSync(fichier, 'utf8'));
const pub = path.join(STUDIO, 'public', C.id);
await mkdir(pub, {recursive: true});

const duree = (f) => parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout.toString()) || 0;

// 0. Préparatifs : rushes vidéo (Mixkit, recadrés en vertical) et script préalable (bande son…).
const pubDir = path.join(STUDIO, 'public');
for (const id of C.rushes || []) {
  const dest = path.join(pubDir, 'rushes', `${id}.mp4`);
  if (existsSync(dest)) continue;
  await mkdir(path.dirname(dest), {recursive: true});
  for (const q of [1080, 720]) {
    const res = await fetch(`https://assets.mixkit.co/videos/${id}/${id}-${q}.mp4`).catch(() => null);
    if (!res?.ok) continue;
    const brut = dest.replace(/\.mp4$/, '-brut.mp4');
    await writeFile(brut, Buffer.from(await res.arrayBuffer()));
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.5', '-t', '9', '-i', brut, '-vf', 'scale=-2:1920,crop=1080:1920,fps=30', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', dest]);
    spawnSync('rm', ['-f', brut]);
    break;
  }
}
if (C.avant) spawnSync('node', [path.join(STUDIO, C.avant)], {stdio: 'inherit'});

// 1. Voix off ElevenLabs avec minutage caractère par caractère (une seule prise pour tout le texte :
//    l'intonation reste continue d'une scène à l'autre).
// Les balises d'émotion d'eleven_v3 ([excited], [laughs]…) guident la voix mais ne sont ni dites ni sous-titrées.
const TAG = /^\[[^\]]*\]$/;
const texte = C.scenes.map((s) => s.texte).join(' ');
const jetons = C.scenes.flatMap((s, k) => s.texte.split(/\s+/).filter((w) => w && !TAG.test(w)).map((w) => ({w, scene: k})));
let mots = [];
const voixMp3 = path.join(pub, 'voix.mp3');
const cacheTexte = path.join(pub, 'voix.txt');
if (!arg('sans-voix') && C.voix && texte.trim()) {
  const deja = existsSync(voixMp3) && existsSync(cacheTexte) && readFileSync(cacheTexte, 'utf8') === `${C.voix.voice_id}|${C.voix.modele}|${texte}`;
  let al;
  if (deja) al = JSON.parse(readFileSync(path.join(pub, 'alignement.json'), 'utf8'));
  else {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${C.voix.voice_id}/with-timestamps?output_format=mp3_44100_192`, {
      method: 'POST',
      headers: {'xi-api-key': (process.env.ELEVENLABS_API_KEY || 'proxy-injected').trim(), 'content-type': 'application/json'},
      body: JSON.stringify({text: texte, model_id: C.voix.modele || 'eleven_multilingual_v2', language_code: 'fr',
        voice_settings: {stability: C.voix.stabilite ?? 0.35, similarity_boost: 0.8, style: C.voix.style ?? 0.5, speed: C.voix.vitesse ?? 1.05, use_speaker_boost: true}}),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status} ${(await res.text()).slice(0, 300)}`);
    const j = await res.json();
    await writeFile(voixMp3, Buffer.from(j.audio_base64, 'base64'));
    al = j.alignment;
    await writeFile(path.join(pub, 'alignement.json'), JSON.stringify(al));
    await writeFile(cacheTexte, `${C.voix.voice_id}|${C.voix.modele}|${texte}`);
  }
  // Mots = suites de caractères non blancs, dans le même ordre que les jetons du script.
  let cur = null;
  const bruts = [];
  al.characters.forEach((c, i) => {
    if (/\s/.test(c)) { if (cur) { bruts.push(cur); cur = null; } return; }
    if (!cur) cur = {w: '', start: al.character_start_times_seconds[i], end: 0};
    cur.w += c; cur.end = al.character_end_times_seconds[i];
  });
  if (cur) bruts.push(cur);
  for (let i = bruts.length - 1; i >= 0; i--) if (TAG.test(bruts[i].w)) bruts.splice(i, 1);
  if (bruts.length !== jetons.length) console.warn(`Attention : ${bruts.length} mots minutés pour ${jetons.length} mots écrits.`);
  mots = jetons.map((j, i) => ({...j, start: +(bruts[Math.min(i, bruts.length - 1)]?.start ?? 0).toFixed(3), end: +(bruts[Math.min(i, bruts.length - 1)]?.end ?? 0).toFixed(3)}));
}

// 2. Scènes calées sur la voix : une scène commence au premier mot de sa phrase.
const fin = (mots.at(-1)?.end ?? C.scenes.reduce((a, s) => a + (s.duree || 2), 0)) + (C.queue ?? 1.6);
let t = 0;
const scenes = C.scenes.map((s, k) => {
  const premier = mots.find((m) => m.scene === k);
  const start = k === 0 ? 0 : premier ? Math.max(0, premier.start - (s.avance ?? 0.12)) : t;
  t = start + (s.duree || 2);
  return {...s, start: +start.toFixed(3)};
});
scenes.forEach((s, k) => { s.end = +(k + 1 < scenes.length ? scenes[k + 1].start : fin).toFixed(3); });

// 3. Bruitages : posés sur un mot (« mot ») ou au début d'une scène, avec un décalage.
const norm = (w) => w.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/^(?:\p{L}{1,2}|qu)['’]/u, '').replace(/[^\p{L}\p{N}']/gu, '');
const bruits = [];
for (const [k, s] of C.scenes.entries()) {
  for (const b of s.sons || []) {
    const m = b.mot ? mots.find((x) => x.scene === k && norm(x.w).startsWith(norm(b.mot))) : null;
    const at = (m ? m.start : scenes[k].start) + (b.decalage ?? 0);
    bruits.push({src: `sfx/${b.son}.mp3`, at: +Math.max(0, at).toFixed(3), volume: b.volume ?? 0.6});
  }
}
// Un souffle à chaque changement de scène, sauf indication contraire.
if (C.whooshEntreScenes !== false) scenes.slice(1).forEach((s) => bruits.push({src: 'sfx/swoosh.mp3', at: Math.max(0, s.start - 0.18), volume: 0.35}));

const spec = {id: C.id, concept: C.concept, fps: C.fps ?? 30, duree: +fin.toFixed(3), mots, scenes, bruits,
  voix: mots.length ? {src: `${C.id}/voix.mp3`, volume: C.voix?.volume ?? 1} : undefined,
  musique: C.musique ? {src: C.musique.src, volume: C.musique.volume ?? 0.35, debut: C.musique.debut ?? 0, ducking: C.musique.ducking ?? 0.4, ...(await tempoMusique(C.musique.src, C.musique.debut ?? 0))} : undefined,
  bande: C.bande, ...(C.extra || {})};
await writeFile(path.join(pub, 'spec.json'), JSON.stringify(spec, null, 1));
console.log(`${C.id} : ${spec.duree.toFixed(1)} s, ${mots.length} mots, ${scenes.length} scènes, ${bruits.length} bruitages`);

// 4. Rendu.
const browser = process.env.CHROME_HEADLESS_SHELL || '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const props = JSON.stringify({specFile: `${C.id}/spec.json`});
const bin = path.join(STUDIO, 'node_modules', '.bin', 'remotion');
const commun = ['src/index.ts', C.concept, ...(existsSync(browser) ? [`--browser-executable=${browser}`] : []), `--props=${props}`];
const sortie = path.join(STUDIO, 'out', `${C.id}.mp4`);
const still = arg('still');
const r = still
  ? spawnSync(bin, ['still', ...commun, path.join(STUDIO, 'out', `${C.id}-${still}.png`), `--frame=${Math.round(+still * (C.fps ?? 30))}`], {cwd: STUDIO, stdio: 'inherit'})
  : spawnSync(bin, ['render', ...commun, sortie, '--log=error'], {cwd: STUDIO, stdio: 'inherit'});
if (r.status !== 0) process.exit(r.status || 1);
if (!still) {
  // 5. Mastering : couleurs en plage vidéo (yuv420p), volume au niveau Instagram, crêtes limitées.
  const brut = sortie.replace(/\.mp4$/, '-brut.mp4');
  spawnSync('mv', [sortie, brut]);
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', brut, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-maxrate', '14M', '-bufsize', '28M', '-pix_fmt', 'yuv420p', '-color_range', 'tv',
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-movflags', '+faststart', sortie], {stdio: 'inherit'});
  spawnSync('rm', ['-f', brut]);
  console.log(`→ ${sortie} (${duree(sortie).toFixed(1)} s)`);
  // 6. Contrôle qualité : on refuse l'export s'il y a un défaut bloquant.
  const qc = spawnSync('node', [path.join(STUDIO, 'scripts', 'controle.mjs'), sortie], {stdio: 'inherit'});
  if (qc.status !== 0) { console.error('Contrôle qualité : export refusé.'); process.exit(2); }
}

// Tempo de la musique (bpm + premier temps), pour caler les pulsations et lumières des reels sur le beat.
async function tempoMusique(src, debut = 0) {
  try {
    const {analyserSon} = await import('../../src/son.mjs');
    const t = await analyserSon(path.join(STUDIO, 'public', src));
    // phase ramenée au début de l'extrait utilisé
    const per = 60 / t.bpm;
    return {bpm: t.bpm, phase: ((t.phase - debut) % per + per) % per};
  } catch (err) { console.error(`Tempo de la musique inconnu : ${err.message}`); return {}; }
}
