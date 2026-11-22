// Dossiers Drive du directeur (22/11/2026) : vidéos de soirée (« je vais en ajouter presque chaque jour : analyse-les chaque
// jour pour ne pas louper les nouvelles, et sauvegarde-les ailleurs pour pouvoir travailler même si Drive est inaccessible »,
// accord des créateurs obtenu par le directeur) et musiques (repères de rythme pour les montages TikTok ; le directeur remet le
// même son depuis la bibliothèque TikTok). Sans IA : lecture de la vue publique du dossier, téléchargement, fiche qualité
// (studio/montage/analyse_video.py) ou tempo (rythme.py). Sauvegarde des vidéos : jamais dans ce dépôt ni ses « releases »
// (publics : visages des clients) ; elle attend un espace privé choisi par le directeur.
// Les musiques ne sont jamais recopiées (morceaux du commerce) : seul leur tempo est gardé.
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHIER = path.join(ROOT, 'contenus', 'drive.json');
const lire = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Fichiers et sous-dossiers d'un dossier Drive partagé par lien (vue « embeddedfolderview », sans clé). */
export function lireVueDossier(html) {
  const out = [];
  for (const m of html.matchAll(/<a href="([^"]+)"[^>]*>[\s\S]*?<div class="flip-entry-title">([^<]+)<\/div>/g)) {
    const url = decode(m[1]), nom = decode(m[2]).trim();
    const f = url.match(/\/file\/d\/([\w-]+)/), d = url.match(/\/folders\/([\w-]+)/);
    if (f) out.push({ id: f[1], nom, type: 'fichier' });
    else if (d) out.push({ id: d[1], nom, type: 'dossier' });
  }
  return out;
}

async function listerDossier(id, profondeur = 0, chemin = '') {
  const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`Drive HTTP ${r.status}`);
  const res = [];
  for (const e of lireVueDossier(await r.text())) {
    if (e.type === 'dossier') { if (profondeur < 3) res.push(...await listerDossier(e.id, profondeur + 1, `${chemin}${e.nom}/`)); }
    else res.push({ ...e, chemin: chemin + e.nom });
  }
  return res;
}

function telecharger(id, dest) {
  const r = spawnSync('curl', ['-sSL', '--max-time', '600', '-o', dest, `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`]);
  if (r.status !== 0 || !existsSync(dest) || statSync(dest).size < 20000) throw new Error('téléchargement impossible');
}
const python = (script, f) => {
  const r = spawnSync('python3', [path.join(ROOT, 'studio', 'montage', script), f], { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error((r.stderr || '').slice(-300));
  return JSON.parse(r.stdout);
};

/** Relève les deux dossiers ; traite au plus `max` nouveautés par passage (le reste au passage suivant). */
export async function releverDrive({ config = lire(path.join(ROOT, 'config.json'), {}), log = console.log, max = 40, cache = '/tmp/teufy-drive' } = {}) {
  const C = config.drive || {};
  const etat = lire(FICHIER, { _note: 'Dossiers Drive du directeur (src/drive.mjs) : vidéos (fiche qualité, sauvegarde) et musiques (tempo).', videos: {}, musiques: {} });
  mkdirSync(cache, { recursive: true });
  const bilan = { nouvelles_videos: 0, nouvelles_musiques: 0, erreurs: 0, absentes: 0 };
  let n = 0;
  for (const [cle, idDossier, ext] of [['videos', C.videos, /\.(mp4|mov|m4v|webm)$/i], ['musiques', C.musique, /\.(mp3|m4a|wav|flac|aac|ogg)$/i]]) {
    if (!idDossier) continue;
    let liste;
    try { liste = (await listerDossier(idDossier)).filter((e) => ext.test(e.nom)); } catch (err) { log(`Drive (${cle}) : dossier illisible (${err.message}).`); bilan.erreurs++; continue; }
    const vus = new Set(liste.map((e) => e.id));
    for (const id of Object.keys(etat[cle])) if (!vus.has(id) && !etat[cle][id].retire_le) { etat[cle][id].retire_le = new Date().toISOString(); bilan.absentes++; }
    for (const e of liste) {
      const x = etat[cle][e.id];
      if (x?.fiche || x?.rythme || (x?.essais || 0) >= 3) continue;
      if (n++ >= max) break;
      const dest = path.join(cache, `${e.id}${path.extname(e.nom) || ''}`);
      const ent = { nom: e.nom, chemin: e.chemin, vu_le: x?.vu_le || new Date().toISOString(), essais: (x?.essais || 0) + 1 };
      try {
        if (!existsSync(dest)) telecharger(e.id, dest);
        ent.octets = statSync(dest).size;
        if (cle === 'videos') {
          const f = python('analyse_video.py', dest);
          delete f.parsec;
          ent.fiche = f;
          ent.utilisable = f.luma >= 0.07 && f.nettete >= 0.015; // trop sombre ou trop flou : gardée mais pas proposée
          bilan.nouvelles_videos++;
        } else {
          const r = python('rythme.py', dest);
          ent.rythme = { bpm: r.bpm, duree: r.duree, meilleur: r.meilleur };
          bilan.nouvelles_musiques++;
        }
        delete ent.essais;
      } catch (err) { ent.erreur = String(err.message).slice(0, 200); bilan.erreurs++; }
      etat[cle][e.id] = { ...x, ...ent };
    }
  }
  // doublons (même empreinte d'image et même durée) : signalés, jamais montés deux fois
  const v = Object.entries(etat.videos).filter(([, e]) => e.fiche);
  for (const [id, e] of v) e.doublon_de = v.find(([j, f]) => j < id && f.fiche.empreinte === e.fiche.empreinte && Math.abs(f.fiche.duree - e.fiche.duree) < 1.5)?.[0] || undefined;
  etat.le = new Date().toISOString();
  etat.bilan = bilan;
  writeFileSync(FICHIER, JSON.stringify(etat, null, 1) + '\n');
  log(`Drive : ${bilan.nouvelles_videos} nouvelle(s) vidéo(s), ${bilan.nouvelles_musiques} nouvelle(s) musique(s), ${bilan.erreurs} erreur(s).`);
  return etat;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await releverDrive();
