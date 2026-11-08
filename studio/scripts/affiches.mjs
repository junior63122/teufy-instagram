// Rend un carrousel du studio à partir d'une liste de soirées (déjà vérifiées par le bot).
//   node scripts/affiches.mjs entree.json dossierSortie
// entree.json = { titre: [ligne1, ligne2], lieu: 'NICE', pied: 'CÔTE D'AZUR', soirees: [{ id, nom, genre, jour, heures, prix, lieu, image (URL ou chemin) }] }
import {readFileSync, existsSync} from 'node:fs';
import {writeFile, mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [entree, sortie] = process.argv.slice(2);
const E = JSON.parse(readFileSync(entree, 'utf8'));
await mkdir(sortie, {recursive: true});
const dir = path.join(STUDIO, 'public', 'evenements', 'auto');
await mkdir(dir, {recursive: true});

// Couleur d'accent tirée de l'affiche : teinte moyenne, éclaircie et saturée pour rester lisible sur fond sombre.
function accent(f) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', 'scale=1:1,format=rgb24', '-f', 'rawvideo', '-'], {maxBuffer: 1e6});
  const [R, G, B] = r.stdout?.length >= 3 ? [...r.stdout.subarray(0, 3)] : [255, 107, 74];
  const max = Math.max(R, G, B) || 1;
  const k = 235 / max;
  const sat = (c) => Math.round(Math.min(255, Math.max(40, (c * k - 128) * 1.5 + 128)));
  return `#${[sat(R), sat(G), sat(B)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

const soirees = [];
for (const [i, s] of E.soirees.entries()) {
  let image = s.image;
  if (/^https?:/.test(image)) {
    const f = path.join(dir, `${i}-${(s.id || 'soiree').replace(/[^a-z0-9-]/gi, '').slice(0, 40)}.jpg`);
    const res = await fetch(image).catch(() => null);
    if (!res?.ok) continue; // pas d'affiche officielle : on n'invente pas d'image
    await writeFile(f, Buffer.from(await res.arrayBuffer()));
    image = path.relative(path.join(STUDIO, 'public'), f);
  }
  if (!existsSync(path.join(STUDIO, 'public', image))) continue;
  // format d'origine de l'affiche (pour l'afficher en grand même si l'image source est petite)
  const dims = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(STUDIO, 'public', image)]).stdout?.toString().trim().split(',').map(Number);
  const ratio = dims?.length === 2 && dims[1] ? dims[0] / dims[1] : undefined;
  soirees.push({...s, image, ratio, couleur: s.couleur || accent(path.join(STUDIO, 'public', image))});
}
if (soirees.length < 2) { console.error('Moins de 2 soirées avec affiche officielle : carrousel studio annulé.'); process.exit(3); }
// Couverture : fond illustré généré par Gemini (un par semaine, gardé ensuite), sinon fond béton.
let fond = E.fond;
if (!fond && process.env.GEMINI_API_KEY) {
  const d = new Date(); const semaine = `${d.getUTCFullYear()}-s${String(Math.ceil(((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 864e5 + 1) / 7)).padStart(2, '0')}`;
  const id = `couverture-${semaine}`;
  const def = path.join(dir, 'couverture.json');
  await writeFile(def, JSON.stringify({concept: 'carrousel', style: '', decors: [{id, format: '4:5', prompt:
    'Premium cinematic night scene of the French Riviera nightlife, seen from a rooftop: Nice bay and Promenade des Anglais glowing at night, palm trees, warm city lights reflected on the sea, ' +
    'a stylish club terrace with string lights and soft haze, colorful stage light beams in coral, magenta and electric blue rising into the sky. ' +
    'Photorealistic editorial look with rich colors and film grain, like a luxury magazine cover. No text, no letters, no logos, no recognizable faces (people only as distant silhouettes). ' +
    'Vertical 4:5 composition; keep the top 35% darker and calm (night sky) for a big title, and the bottom 15% darker for small text.'}]}));
  spawnSync('node', [path.join(STUDIO, 'scripts', 'decors.mjs'), def], {cwd: STUDIO, stdio: 'inherit', env: process.env});
  if (existsSync(path.join(STUDIO, 'public', 'decors', 'carrousel', `${id}.jpg`))) fond = `decors/carrousel/${id}.jpg`;
}
const B = process.env.CHROME_HEADLESS_SHELL || '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const bin = path.join(STUDIO, 'node_modules', '.bin', 'remotion');
const fichiers = [];
for (let k = 0; k <= soirees.length + 1; k++) {
  const props = JSON.stringify({slide: k, soirees, titre: E.titre, lieu: E.lieu, pied: E.pied, fond});
  const f = path.resolve(sortie, `carrousel-${String(k).padStart(2, '0')}.jpg`);
  const r = spawnSync(bin, ['still', 'src/index.ts', 'carrousel', f, `--props=${props}`, '--image-format=jpeg', '--jpeg-quality=92', '--log=error', ...(existsSync(B) ? [`--browser-executable=${B}`] : [])], {cwd: STUDIO, stdio: 'inherit'});
  if (r.status !== 0) process.exit(r.status || 1);
  fichiers.push(f);
}
await writeFile(path.join(sortie, 'carrousel.json'), JSON.stringify({fichiers, soirees: soirees.map((s) => s.id)}, null, 1));
console.log(`${fichiers.length} diapositives → ${sortie}`);
