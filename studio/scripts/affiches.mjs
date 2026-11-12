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
// Vérification par Gemini (vision) : l'affiche correspond-elle bien à CETTE soirée (nom, artiste, date, lieu) ?
// Une affiche d'une autre soirée = soirée retirée du carrousel (jamais de visuel trompeur).
async function verifierAffiche(s) {
  const CLE = (process.env.GEMINI_API_KEY || '').trim();
  if (!CLE || process.env.TEUFY_IA_MANUEL === '1') return {ok: true, raison: 'pas de clé Gemini, non vérifié'};
  const API = 'https://generativelanguage.googleapis.com/v1beta/models';
  try {
    const liste = await (await fetch(`${API}?pageSize=200&key=${CLE}`)).json();
    const noms = (liste.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace('models/', ''))
      .filter((n) => /^gemini-[\d.]+-flash/.test(n) && !/image|tts|audio|live|lite/.test(n)).sort((a, b) => parseFloat(b.slice(7)) - parseFloat(a.slice(7)));
    const brut = readFileSync(path.join(STUDIO, 'public', s.image)); const img = brut.toString('base64');
    const mime = brut[0] === 0x89 ? 'image/png' : brut.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : 'image/jpeg';
    const consigne = `Voici l'affiche censée illustrer cette soirée : « ${s.nom} », ${s.jour}, ${s.lieu}. ` +
      `Regarde le texte et les noms sur l'image. Réponds en JSON {"correspond": true|false, "raison": "..."} : false seulement si l'affiche annonce clairement une AUTRE soirée (autre nom, autre artiste principal, autre lieu ou autre date). ` +
      `Une affiche sans texte, un visuel d'artiste ou de lieu cohérent = true.`;
    for (const m of noms.slice(0, 3)) {
      const r = await fetch(`${API}/${m}:generateContent?key=${CLE}`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({
        contents: [{role: 'user', parts: [{inline_data: {mime_type: mime, data: img}}, {text: consigne}]}], generationConfig: {responseMimeType: 'application/json'}})});
      if (r.status === 404) continue;
      const j = await r.json();
      const t = (j.candidates?.[0]?.content?.parts || []).map((x) => x.text || '').join('');
      const v = JSON.parse(t || '{}');
      return {ok: v.correspond !== false, raison: v.raison || ''};
    }
  } catch (err) { return {ok: true, raison: `vérification impossible (${err.message})`}; }
  return {ok: true, raison: 'aucun modèle'};
}
for (let i = soirees.length - 1; i >= 0; i--) {
  const v = await verifierAffiche(soirees[i]);
  console.log(`Affiche « ${soirees[i].nom} » : ${v.ok ? 'ok' : 'NE CORRESPOND PAS, soirée retirée'} (${v.raison})`);
  if (!v.ok) soirees.splice(i, 1);
}
const MINI = E.minimum ?? 3;
if (soirees.length < MINI) { console.error(`Seulement ${soirees.length} soirée(s) avec une affiche officielle vérifiée (minimum ${MINI}) : carrousel annulé.`); process.exit(3); }
// DA « Flash nuit » : photo de couverture et de fin tirées de la banque (decors/da), qui tourne d'une semaine à l'autre.
const d0 = new Date(); const semaine = Math.floor(d0 / (7 * 864e5));
const COUV = ['danse', 'foule', 'dj', 'rire', 'terrasse', 'plage', 'lasers'];
const FIN = ['selfie', 'rooftop', 'taxi', 'baskets', 'file'];
const dispo = (l) => l.filter((x) => existsSync(path.join(STUDIO, 'public', 'decors', 'da', `${x}.jpg`)));
const pick = (l, k) => (l.length ? `decors/da/${l[k % l.length]}.jpg` : undefined);
const photo = E.photo || pick(dispo(COUV), semaine);
const photoFin = E.photoFin || pick(dispo(FIN), semaine);
const n = soirees.length;
const TITRES = [`${n} soirées à ne pas [rater]`, 'Ta semaine est [réglée]', 'Où sortir [cette semaine]', `${n} sorties qu'on [valide]`];
const titre = E.titreFlash || TITRES[semaine % TITRES.length];
const sous = E.sous || (Array.isArray(E.titre) ? E.titre[1] : '') || '';
const B = process.env.CHROME_HEADLESS_SHELL || '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const bin = path.join(STUDIO, 'node_modules', '.bin', 'remotion');
const fichiers = [];
for (let k = 0; k <= soirees.length + 1; k++) {
  const props = JSON.stringify({slide: k, soirees, titre, sous, photo, photoFin, rubrique: E.rubrique, question: E.question});
  const f = path.resolve(sortie, `carrousel-${String(k).padStart(2, '0')}.jpg`);
  const r = spawnSync(bin, ['still', 'src/index.ts', E.ancien ? 'carrousel' : 'carrousel-flash', f, `--props=${props}`, '--image-format=jpeg', '--jpeg-quality=92', '--log=error', ...(existsSync(B) ? [`--browser-executable=${B}`] : [])], {cwd: STUDIO, stdio: 'inherit'});
  if (r.status !== 0) process.exit(r.status || 1);
  fichiers.push(f);
}
await writeFile(path.join(sortie, 'carrousel.json'), JSON.stringify({fichiers, soirees: soirees.map((s) => s.id)}, null, 1));
console.log(`${fichiers.length} diapositives → ${sortie}`);
