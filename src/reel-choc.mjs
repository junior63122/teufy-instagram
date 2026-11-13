// Reels « choc » (13/11/2026, directeur : « une bombe atomique chaque seconde, comme un mini-film », « de vraies vidéos
// de club de folie, des bruitages, des accroches comme des épées »). Remplace les reels en photos fixes + voix off.
// Principe :
//  - de VRAIES vidéos de soirée (banque Mixkit / Coverr, contenus/banque-medias.json), plein écran 1080×1920,
//    jamais une image qui ne remplit pas l'écran, jamais une vidéo déjà utilisée dans les 30 derniers reels ;
//  - accroche géante dès l'image 0 (c'est aussi la couverture), puis un plan toutes les 0,7 à 1,2 s sur le rythme ;
//  - chaque coupe frappe : flash, zoom, décalage RVB, secousse, + un bruitage (impact, whoosh, montée, foule) ;
//  - texte en phrases entières, énorme, contour noir, une couleur Teufy sur deux ; musique énergique, son normalisé.
// Sans IA : le concept (accroche, plans, appel final) vient de contenus/concepts-reels.json (inventé par la veille) ou
// d'un concept écrit à la main.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache', 'banque');
const POLICE = path.join(ROOT, 'studio', 'polices', 'InterDisplay-Black.otf'); // très grasse : lisible en 0,3 s sur un téléphone
const UTILISES = path.join(ROOT, 'contenus', 'clips-utilises.json');
const W = 1080, H = 1920, FPS = 30;
const lire = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
const ff = (args) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { maxBuffer: 1 << 26 }); if (r.status !== 0) throw new Error(`ffmpeg : ${String(r.stderr).slice(-600)}`); };
const duree = (f) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim() || 0;
const taille = (f) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]).toString().trim().split(',').map(Number);

function telecharger(url, f, referer) {
  if (existsSync(f) && statSync(f).size > 10000) return f;
  mkdirSync(path.dirname(f), { recursive: true });
  const r = spawnSync('curl', ['-sL', '--fail', '--max-time', '90', ...(referer ? ['-e', referer] : []), '-A', 'TeufyBot/1.0 (+https://teufyparty.com)', '-o', f, url]);
  return r.status === 0 && existsSync(f) && statSync(f).size > 10000 ? f : null;
}

/** Vidéo d'une banque, en 1080p si possible (Mixkit : lien de téléchargement Full HD, sinon l'aperçu 720p). */
function fichierVideo(v) {
  if (v.source === 'mixkit') {
    return telecharger(v.mp4.replace('-720.mp4', '-1080.mp4'), path.join(CACHE, `mixkit-${v.id}-1080.mp4`), `https://mixkit.co/free-stock-video/download/${v.id}/?context=sidebar&type=1080p`)
      || telecharger(v.mp4, path.join(CACHE, `mixkit-${v.id}-720.mp4`));
  }
  return telecharger(v.mp4, path.join(CACHE, `${v.source}-${v.id}.mp4`));
}

const mots = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((x) => x.length > 2);
/** Choisit la vidéo la plus proche des mots-clés du plan, verticale de préférence, jamais déjà prise. */
export function choisirClip(banque, motsCles, pris, aleas = Math.random) {
  const cles = new Set(mots(motsCles));
  const notes = banque.videos.filter((v) => !pris.has(v.id) && !/screen|app |interface|social media|tiktok|smartphone screen|green screen|chroma/i.test(v.titre)).map((v) => {
    const t = new Set([...mots(v.titre), ...(v.themes || []).flatMap(mots)]);
    let n = 0; for (const c of cles) if (t.has(c) || [...t].some((x) => x.startsWith(c) || c.startsWith(x))) n += 2;
    if (/club|party|danc|dj|crowd|laser|neon|concert|festival|night/.test(v.titre)) n += 1;
    if (v.vertical) n += 1.5;
    return { v, n: n + aleas() * 0.9 };
  }).sort((a, b) => b.n - a.n);
  return notes[0]?.v || null;
}

/** Découpe une phrase en lignes courtes (≤ 13 caractères à cette taille), sans couper un mot. */
export function lignes(texte, max = 13) {
  const out = []; let l = '';
  // Guillemets, deux-points et signes collés à leur mot (jamais un « » » seul en début de ligne).
  const t = String(texte).trim().replace(/«\s+/g, '«\u00a0').replace(/\s+([»:?!=])/g, '\u00a0$1').replace(/([=])\s+/g, '$1\u00a0').replace(/(\d)\s+(h|min|€)\b/g, '$1\u00a0$2');
  for (const m of t.split(/[ \t\n]+/)) { if ((l + ' ' + m).trim().length > max && l) { out.push(l); l = m; } else l = (l + ' ' + m).trim(); }
  if (l) out.push(l);
  return out.join('\n');
}

const EFFETS = ['zoom', 'glitch', 'secousse', 'zoom', 'flash'];
/** Un plan : vidéo plein écran + effet de coupe + texte qui « tombe » (pop d'échelle). */
function rendrePlan({ clip, debut, d, texte, couleur, effet, sortie, taillePolice = 118, tmp, i }) {
  const tf = path.join(tmp, `t${i}.txt`); writeFileSync(tf, lignes(texte, taillePolice > 120 ? 10 : 12));
  const [w0, h0] = taille(clip);
  const marge = effet === 'secousse' ? 1.08 : 1.02;
  const z = effet === 'zoom' ? `scale=w='trunc(${W * marge}*(1+0.10*t/${d})/2)*2':h=-2:eval=frame` : `scale=${Math.round(W * marge / 2) * 2}:-2`;
  const v = [
    `scale=w=${W}:h=${H}:force_original_aspect_ratio=increase`, `crop=${W}:${H}`, // plein écran, toujours
    z, effet === 'secousse' ? `crop=${W}:${H}:x='(iw-${W})/2+14*sin(t*55)':y='(ih-${H})/2+10*cos(t*47)'` : `crop=${W}:${H}`,
    'eq=contrast=1.14:saturation=1.35:brightness=-0.02', 'unsharp=5:5:0.7', 'vignette=PI/5',
    effet === 'glitch' ? "rgbashift=rh=-14:bh=14:enable='lt(t,0.14)'" : null,
    effet === 'flash' || i === 0 ? 'fade=in:st=0:d=0.07:color=white' : null,
    `drawtext=fontfile=${POLICE}:textfile=${tf}:fontcolor=${couleur}:fontsize='if(lt(t,0.12),${taillePolice}*(1.35-2.9*t),${taillePolice})':borderw=12:bordercolor=black:line_spacing=4:text_align=C:x=(w-text_w)/2:y=h*0.36-text_h/2:shadowx=0:shadowy=8:shadowcolor=black@0.5`,
    `fps=${FPS}`, 'format=yuv420p', `setsar=1`,
  ].filter(Boolean).join(',');
  if (w0 < 640) throw new Error('vidéo trop petite');
  ff(['-ss', String(debut), '-t', String(d), '-i', clip, '-vf', v, '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', sortie]);
}

/** Luminosité moyenne (0-255) d'un extrait. */
function luminosite(f, debut, d) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-ss', String(debut), '-t', String(d), '-i', f, '-vf', 'scale=160:-2,signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-an', '-f', 'null', '-'], { maxBuffer: 1 << 26 });
  const v = [...String(r.stderr).matchAll(/YAVG=([\d.]+)/g)].map((m) => +m[1]);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 128;
}

/** Départ de musique : la première seconde où le morceau est déjà « lancé » (pas de longue intro). */
function departMusique(f) {
  try {
    const r = spawnSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'ebur128=framelog=verbose', '-f', 'null', '-'], { maxBuffer: 1 << 26 });
    const pts = [...String(r.stderr).matchAll(/t:\s*([\d.]+)\s+TARGET.*?M:\s*(-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]);
    const fort = pts.find(([t, m], k) => m > -13 && pts.slice(k, k + 30).every(([, x]) => x > -18));
    return Math.max(0, (fort?.[0] ?? 0) - 0.2);
  } catch { return 0; }
}

/**
 * Rend un reel choc. concept : { accroche, plans: [{ texte, video }], cta, musique }.
 * Retourne { video, couverture, duree, clips }.
 */
export async function reelChoc(concept, { sortie, tmp, banque = lire(path.join(ROOT, 'contenus', 'banque-medias.json'), null), aleas = Math.random } = {}) {
  if (!banque?.videos?.length) throw new Error('Banque de médias vide : node outils/banque-medias.mjs');
  mkdirSync(tmp, { recursive: true });
  const deja = lire(UTILISES, []);
  const pris = new Set(deja.slice(-90));
  // Plans : accroche (image 0 = couverture), plans du concept, appel final.
  const sequence = [
    { texte: concept.accroche, video: concept.plans?.[0]?.video || 'crowd party club lights', d: 1.6, taille: 128, couleur: 'white' },
    ...(concept.plans || []).slice(0, 8).map((p, k) => ({ texte: p.texte, video: p.video, d: Math.min(1.6, Math.max(0.85, 0.55 + 0.03 * String(p.texte).length)), taille: 104, couleur: k % 2 ? 'white' : '#ffd23f' })),
    { texte: concept.cta || 'Tague ton pote 👇', video: 'crowd cheering confetti party', d: 1.9, taille: 100, couleur: '#ffd23f' },
  ];
  const fichiers = [], clips = [];
  let i = 0;
  for (const p of sequence) {
    let ok = false;
    for (let essai = 0; essai < 10 && !ok; essai++) {
      const v = choisirClip(banque, p.video, pris, aleas); if (!v) break;
      pris.add(v.id);
      const f = fichierVideo(v); if (!f) { if (process.env.DEBUG) console.error('téléchargement raté', v.id); continue; }
      const D = duree(f); if (D < p.d + 0.3) { if (process.env.DEBUG) console.error('trop court', v.id, D); continue; }
      const debut = Math.max(0, Math.min(D - p.d - 0.2, 0.5 + aleas() * Math.max(0, D - p.d - 1)));
      { const L = luminosite(f, debut, p.d); if (process.env.DEBUG) console.error('lum', v.id, v.titre, L.toFixed(0)); if (L < (essai < 6 ? 42 : 28)) continue; } // plan trop sombre : on n'y voit rien sur un téléphone
      const out = path.join(tmp, `p${i}.mp4`);
      try { rendrePlan({ clip: f, debut, d: p.d, texte: p.texte.replace(/[👇👀🔥🙌]/gu, '').trim(), couleur: p.couleur, effet: i === 0 ? 'zoom' : EFFETS[i % EFFETS.length], sortie: out, taillePolice: p.taille, tmp, i }); }
      catch (e) { if (process.env.DEBUG) console.error('plan raté', v.id, e.message.slice(-300)); continue; }
      fichiers.push({ f: out, d: p.d }); clips.push(v.id); ok = true;
    }
    if (!ok) throw new Error(`aucune vidéo utilisable pour « ${p.texte} »`);
    i++;
  }
  // Montage
  const liste = path.join(tmp, 'liste.txt');
  writeFileSync(liste, fichiers.map((x) => `file '${x.f}'`).join('\n'));
  const muet = path.join(tmp, 'muet.mp4');
  ff(['-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', muet]);
  const total = fichiers.reduce((a, x) => a + x.d, 0);
  // Son : musique énergique (départ sur la partie forte) + bruitages calés sur chaque coupe.
  const musiques = banque.musiques.filter((m) => !concept.musique || mots(concept.musique).some((x) => m.style.includes(x))).concat(banque.musiques);
  let musique = null;
  for (const m of musiques.slice(0, 12).sort(() => aleas() - 0.5)) { musique = telecharger(m.mp3, path.join(CACHE, `musique-${m.id}.mp3`)); if (musique) break; }
  const son = (types) => { for (const t of types) { const l = banque.sons.filter((s) => s.type === t); if (!l.length) continue; const s = l[Math.floor(aleas() * l.length)]; const f = telecharger(s.mp3, path.join(CACHE, `son-${s.id}.mp3`)); if (f) return f; } return null; };
  const coupes = []; let t = 0; for (const x of fichiers) { coupes.push(t); t += x.d; }
  const evts = [
    { f: son(['impact', 'boom', 'drop']), t: 0, vol: 1.0 },
    ...coupes.slice(1, -1).map((c, k) => ({ f: son(k % 3 === 2 ? ['glitch', 'swoosh'] : ['whoosh', 'transition', 'swoosh']), t: Math.max(0, c - 0.08), vol: 0.75 })),
    { f: son(['riser']), t: Math.max(0, coupes.at(-1) - 1.1), vol: 0.6 },
    { f: son(['cheering', 'crowd', 'applause']), t: coupes.at(-1), vol: 0.8 },
  ].filter((e) => e.f);
  const entrees = ['-i', muet, ...(musique ? ['-ss', String(departMusique(musique)), '-i', musique] : []), ...evts.flatMap((e) => ['-i', e.f])];
  const base = musique ? 2 : 1;
  const filtres = [
    ...(musique ? [`[1:a]atrim=0:${total},afade=t=in:d=0.05,afade=t=out:st=${total - 0.6}:d=0.6,volume=0.9[m]`] : []),
    ...evts.map((e, k) => `[${base + k}:a]atrim=0:2.5,adelay=${Math.round(e.t * 1000)}|${Math.round(e.t * 1000)},volume=${e.vol}[s${k}]`),
    `${musique ? '[m]' : ''}${evts.map((_, k) => `[s${k}]`).join('')}amix=inputs=${(musique ? 1 : 0) + evts.length}:normalize=0:duration=longest,atrim=0:${total},loudnorm=I=-12:TP=-1:LRA=9[a]`,
  ];
  mkdirSync(path.dirname(sortie), { recursive: true });
  ff([...entrees, '-filter_complex', filtres.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', sortie]);
  const couverture = sortie.replace(/\.mp4$/, '-couverture.jpg');
  ff(['-ss', '0.35', '-i', sortie, '-frames:v', '1', '-q:v', '2', couverture]);
  writeFileSync(UTILISES, JSON.stringify([...deja, ...clips].slice(-300)) + '\n');
  return { video: sortie, couverture, duree: +total.toFixed(1), clips };
}

// Ligne de commande : node src/reel-choc.mjs concept.json sortie.mp4
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [, , fc, so] = process.argv;
  const concept = JSON.parse(readFileSync(fc, 'utf8'));
  const r = await reelChoc(concept, { sortie: path.resolve(so), tmp: path.join(ROOT, 'out', 'reel-choc', path.basename(so, '.mp4')) });
  console.log(`Reel : ${r.video} (${r.duree} s, ${r.clips.length} vidéos)`);
}
