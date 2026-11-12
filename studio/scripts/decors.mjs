// Décors illustrés générés par Gemini (images), pour enrichir les concepts du studio.
//   node scripts/decors.mjs scripts/decors/<concept>.json
// Le fichier liste les décors : { concept, style, decors: [{ id, prompt, format }] }.
// Les images existantes sont gardées (pas de dépense inutile). Sortie : public/decors/<concept>/<id>.jpg
import {readFileSync, existsSync} from 'node:fs';
import {writeFile, mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://generativelanguage.googleapis.com/v1beta';
const CLE = (process.env.GEMINI_API_KEY || '').trim();
if (!CLE) { console.error('GEMINI_API_KEY absent.'); process.exit(1); }
// Budget commun (contenus/budget-ia.json) : chaque image est comptée ; lancement manuel = aucune image payante.
const LLM = await import('../../src/llm.mjs');
const CONFIG_L = (() => { try { return JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'config.json'), 'utf8')).llm || {}; } catch { return {}; } })();
LLM.reglerCouts(CONFIG_L);
if (!LLM.budgetOk('gemini', CONFIG_L)) { console.error('Images Gemini non générées (lancement manuel ou budget atteint) : décors de secours.'); process.exit(1); }
const def = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const dir = path.join(STUDIO, 'public', 'decors', def.concept);
await mkdir(dir, {recursive: true});
const h = {'content-type': 'application/json', 'x-goog-api-key': CLE};

// Modèles d'image disponibles pour cette clé, du meilleur au plus courant.
const liste = await (await fetch(`${API}/models?pageSize=200`, {headers: h})).json();
const noms = (liste.models || []).map((m) => ({nom: m.name.replace('models/', ''), methodes: m.supportedGenerationMethods || []}));
// Qualité « eco » (photos des reels, renouvelées 3 fois par semaine) : modèle flash, environ 3 fois moins cher.
// Qualité « premium » (DA, fêtes, couvertures) : modèle pro.
// Économie (12/11/2026) : modèle « flash » par défaut, environ 3 fois moins cher ; le modèle pro seulement si le concept
// le demande explicitement (qualite: 'premium').
const ECO = def.qualite !== 'premium' || process.env.IMAGES_ECO === '1';
const PREF = ECO
  ? [/gemini-3.*flash.*image(?!.*lite)/, /gemini-2\.5-flash-image(?!.*preview)/, /gemini-2\.5-flash-image/, /gemini-3.*pro.*image/, /imagen-4/]
  : [/gemini-3.*pro.*image/, /gemini-3.*image/, /gemini-2\.5-flash-image(?!.*preview)/, /gemini-2\.5-flash-image/, /imagen-4\.0-ultra/, /imagen-4/, /imagen-3/];
const candidats = PREF.flatMap((re) => noms.filter((m) => re.test(m.nom))).filter((m, i, a) => a.indexOf(m) === i);
console.log(`Modèles d'image disponibles : ${candidats.map((m) => m.nom).join(', ') || 'aucun'}`);
if (!candidats.length) { console.error('Aucun modèle d\'image accessible avec cette clé.'); process.exit(1); }

async function generer(prompt, format) {
  for (const m of candidats) {
    try {
      if (m.methodes.includes('predict')) {
        const r = await fetch(`${API}/models/${m.nom}:predict`, {method: 'POST', headers: h, body: JSON.stringify({instances: [{prompt}], parameters: {sampleCount: 1, aspectRatio: format}})});
        const j = await r.json();
        const b64 = j.predictions?.[0]?.bytesBase64Encoded;
        if (b64) return {b64, modele: m.nom};
        console.log(`${m.nom} : ${JSON.stringify(j.error || j).slice(0, 200)}`);
      } else {
        const r = await fetch(`${API}/models/${m.nom}:generateContent`, {method: 'POST', headers: h, body: JSON.stringify({
          contents: [{role: 'user', parts: [{text: prompt}]}], generationConfig: {responseModalities: ['IMAGE'], imageConfig: {aspectRatio: format}}})});
        const j = await r.json();
        const part = (j.candidates?.[0]?.content?.parts || []).find((x) => x.inlineData?.data);
        if (part) return {b64: part.inlineData.data, modele: m.nom};
        console.log(`${m.nom} : ${JSON.stringify(j.error || j.candidates?.[0]?.finishReason || j).slice(0, 200)}`);
      }
    } catch (err) { console.log(`${m.nom} : ${err.message}`); }
  }
  return null;
}

const credits = {};
for (const d of def.decors) {
  const f = path.join(dir, `${d.id}.jpg`);
  if (existsSync(f) && !process.env.REFAIRE) { console.log(`${d.id} : déjà là`); continue; }
  if (!LLM.budgetOk('gemini', CONFIG_L)) { console.error(`${d.id} : budget atteint, décor de secours.`); break; }
  const r = await generer(`${def.style}\n\n${d.prompt}`, d.format || '16:9');
  if (!r) { console.error(`${d.id} : échec`); continue; }
  LLM.compter('gemini', /pro|ultra/.test(r.modele) ? 'image_pro' : 'image');
  const png = f.replace(/\.jpg$/, '.png');
  await writeFile(png, Buffer.from(r.b64, 'base64'));
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-q:v', '3', f]);
  spawnSync('rm', ['-f', png]);
  credits[d.id] = {modele: r.modele, le: new Date().toISOString()};
  console.log(`${d.id} : ok (${r.modele})`);
}
const fc = path.join(dir, 'CREDITS.json');
const anciens = existsSync(fc) ? JSON.parse(readFileSync(fc, 'utf8')) : {};
await writeFile(fc, JSON.stringify({...anciens, ...credits, _note: 'Images générées par Google Gemini (API) pour Teufy.'}, null, 1));
