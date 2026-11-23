#!/usr/bin/env node
import { createHash } from 'node:crypto';
// Usage :
//   node src/run.mjs auto   [preparer|publier]   → la publication prévue aujourd'hui dans le calendrier (ou rien)
//   node src/run.mjs mois                          → aperçu des publications du mois (jamais publié)
//   node src/run.mjs collecter [--cerveau]         → relève les statistiques Instagram (apprentissage.json, RAPPORT.md)
//                                                    et, une fois par semaine, l'analyse IA gratuite (veille Meta, pourquoi, tests)
//   node src/run.mjs <type>[:variante] [preparer|publier]
//        types : incontournables:commercial, incontournables:techno, bonplan:petits-prix, bonplan:a-reserver,
//                debat, reel:weekend, reel:techno, reel:petits-prix
// Options : --dry-run  --now=2026-11-09T12:00:00Z  --fixtures=tests/fixtures
//           --quoi (affiche seulement la publication du jour)  --horaire (avec --quoi : attend l'heure apprise)
import { readFile, writeFile, rm, mkdir, appendFile, readdir, copyFile } from 'node:fs/promises';
import { existsSync, copyFileSync, readFileSync, readdirSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectEvents, filterEvents, enrich } from './sources.mjs';
import { windowFor, rolling, isoLocal, plage, slotOfDay, daysOfMonth } from './dates.mjs';
import { isTechno, isUnderground } from './genres.mjs';
import { captionIncontournables, captionBonPlan, captionDebat, captionReel, captionOrgas, captionExplicatif, rng } from './captions.mjs';
import { nettoyerComptes, legendeFinale, abonnesDe, comptesConfirmes } from './comptes.mjs';
import { igConfig, publishCarousel, publishSingle, publishReel, publishStory, permalink, insights, followers, businessDiscovery, compteMedia } from './instagram.mjs';
import { TENDANCES, analyserComptes } from './tendances.mjs';
import { buildModel, chooser, selectBest, eventFeatures, collect, hash, loadData } from './learn.mjs';
import { filtrerCoherentes, controlePost, choixLibre } from './coherence.mjs';
import { choisirMise, choisirPhoto, misesRecentes, photosRecentes } from './photos.mjs';
import { lirePlan, ecrirePlan, engouements, planifierSuite, extrasDu, nettoyer, jourSource, replanifier, sectionRapport, SERIES, serieEnEchec } from './reactif.mjs';
import { theme } from './theme.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
const val = (n) => flag(n)?.split('=').slice(1).join('=');
const [cible = 'auto', etape = 'tout'] = args.filter((a) => !a.startsWith('--'));
const DRY = !!flag('dry-run') || process.env.DRY_RUN === 'true' || cible === 'mois';
const NOW = val('now') ? new Date(val('now')) : new Date();
const MEDIA_DIR = path.join(ROOT, 'media');
const HIST_FILE = path.join(ROOT, 'historique.json');

const config = JSON.parse(await readFile(path.join(ROOT, 'config.json'), 'utf8'));
// Médias publiés sur Instagram : servis par le site (domaine propre s'il est branché, sinon l'adresse GitHub Pages).
const MEDIA_BASE = (config.site?.domaine ? `https://${config.site.domaine}/media` : process.env.MEDIA_BASE_URL || 'https://junior63122.github.io/teufy-instagram/media').replace(/\/$/, '');
// Crédit Gemini épuisé (config.llm.gemini_pause_jusqu_au) : la clé est retirée pour ce passage et tous les scripts lancés
// d'ici (décors, affiches, scénariste) ; les secours sans Gemini prennent le relais, les publications passent toujours.
{ const d = config.llm?.gemini_pause_jusqu_au; if (d && Date.now() < Date.parse(`${d}T00:00:00+01:00`) && process.env.GEMINI_API_KEY) { delete process.env.GEMINI_API_KEY; console.error(`Gemini en pause jusqu'au ${d} (crédit épuisé) : secours sans Gemini.`); } }
const R = config.reglages;
const hist = existsSync(HIST_FILE) ? JSON.parse(await readFile(HIST_FILE, 'utf8')) : [];
let PHOTO_COUV = null; // photo de couverture choisie pour la publication en cours (src/photos.mjs)
let COUV_SECOURS = false; // couverture de reel tombée en secours (image de la vidéo) : signalée par l'auto-contrôle
let MISE_COUV; // mise en page de la couverture de la publication en cours (null = à choisir ; undefined = hors publication)
const AMORCE_PHOTOS = (() => { try { return JSON.parse(readFileSync(path.join(ROOT, 'contenus', 'photos-grille.json'), 'utf8')).amorce || []; } catch { return []; } })();
const usedHere = new Set(); // débats / bons plans déjà pris dans ce lancement (aperçu du mois)
const MODEL = buildModel();
// Heures de publication (UTC) : seulement celles qui laissent au moins une heure de rattrapage avant l'heure limite à Paris
// (12/11/2026 : le créneau 20h UTC = 21h à Paris ne laissait qu'un seul passage, et 21h UTC = 22h ne publiait jamais).
const CRENEAUX = (() => {
  const [mh, mm] = String(config.instagram?.heure_max_paris || '21:30').split(':').map(Number);
  const paris = (h) => { const d = new Date(NOW); d.setUTCHours(h, 7, 0, 0); return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(d)); };
  const ok = (R.creneaux_utc || []).map(Number).filter((h) => paris(h) * 60 + 7 <= mh * 60 + (mm || 0) - 60);
  return (ok.length >= 2 ? ok : [15, 16, 17, 18, 19]).map(String);
})();
// Heure de publication du jour (UTC), choisie selon ce qui a le mieux marché.
const creneauDuJour = (d) => chooser(MODEL, rng(`${slotOfDay(d).date}-creneau`)).pick('creneau', CRENEAUX, (x) => x);

// --- Quelle(s) publication(s) ? --------------------------------------------

// Planning réactif (src/reactif.mjs) : jours déplacés par le robot selon les résultats, suites des publications qui décollent.
const PLAN = lirePlan();
const slotFor = (d) => { const s = slotOfDay(d); const src = jourSource(PLAN, 'post', s.jour); return src == null ? undefined : config.calendrier.find((c) => c.jour === src && c.rang === s.rang); };
const slotId = (s) => [s.type, s.variante, s.suite && 'suite'].filter(Boolean).join('-');
// Deux publications le même jour possibles (13/11/2026, directeur : « au minimum 3 reels et 4 posts par semaine, même
// s'il faut une vidéo et un post le même jour ») : le post du calendrier, puis le reel de config.calendrier_reels, au
// moins config.reglages.ecart_reel_h heures plus tard (sans dépasser le dernier créneau).
// Épisodes du Grand Débat déposés à la main (media/grand-debat/*.mp4 + .txt), le plus ancien non publié d'abord.
// Spots promo de Teufy (18/11/2026, directeur : « minimum 2 par semaine, des spots créatifs qui ne se ressemblent pas,
// certains sur certaines fonctionnalités, d'autres sur d'autres ; essaie des hooks différents, vois ceux qui marchent le
// mieux et améliore-toi ») : vidéos motion design faites à part (studio/generateur-gsap) et déposées dans media/spot-promo/
// (NN-sujet.mp4 + .txt légende + .couverture.txt + .json { accroche, fonctionnalites }). Quand plusieurs attendent,
// l'apprentissage choisit (choix « accroche-spot ») : le type d'accroche qui a le mieux marché passe en premier, avec
// toujours une part d'essai pour les autres.
function episodeGrandDebat(serie = 'grand-debat', choisir = null) {
  const dir = path.join(ROOT, 'media', serie); if (!existsSync(dir)) return null;
  const faits = new Set(hist.map((h) => h.concept).filter(Boolean));
  const attente = readdirSync(dir).filter((x) => x.endsWith('.mp4')).sort().filter((x) => !faits.has(`${serie}-${x.replace(/\.mp4$/, '')}`));
  const meta = (x) => { try { return JSON.parse(readFileSync(path.join(dir, x.replace(/\.mp4$/, '.json')), 'utf8')); } catch { return {}; } };
  const f = choisir && attente.length > 1 ? choisir(attente.map((x) => ({ f: x, ...meta(x) }))).f : attente[0];
  if (!f) return null;
  const base = f.replace(/\.mp4$/, ''), txt = path.join(dir, `${base}.txt`);
  const nom = serie === 'serie-nuit' ? 'Et toi, t\'aurais fait quoi ?' : serie === 'spot-promo' ? 'Teufy' : serie === 'tague-ton-pote' ? 'Tague ton pote' : 'Le Grand Débat';
  const legende = existsSync(txt) ? readFileSync(txt, 'utf8').trim() : `${nom} Tu votes quoi ? Un mot en commentaire.`;
  // Couverture aux couleurs de la DA (15/11/2026, directeur : « ne ruine pas la DA de la grille ») : NN-sujet.couverture.txt
  // = 1re ligne le titre de la couverture, 2e ligne (facultative) la photo de decors/da/ (sans .jpg).
  const cf = path.join(dir, `${base}.couverture.txt`);
  const [couvTitre, couvPhoto] = existsSync(cf) ? readFileSync(cf, 'utf8').split('\n').map((x) => x.trim()) : [];
  const m = meta(f);
  return { id: `${serie}-${base}`, video: path.join(dir, f), legende, titre: `${nom} · ${base.replace(/[-_]/g, ' ')}`, nom, couvTitre: couvTitre || legende.split('\n')[0].replace(/^Le Grand Débat #\d+\s*\u{1F94A}?\s*/u, '').slice(0, 60), couvPhoto: couvPhoto || null, accroche: m.accroche || null, fonctionnalites: m.fonctionnalites || [] };
}
// Un épisode du Grand Débat n'est prévu que s'il y en a un en attente (sinon le créneau reste libre).
// Clé d'une soirée (pour ne pas remontrer les mêmes soirées dans deux posts rapprochés).
const cleSoiree = (e) => e.url || `${e.name || e.nom}|${String(e.start || e.debut || '').slice(0, 10)}`;
// Série en échec (src/reactif.mjs, serieEnEchec) : le créneau passe à son remplaçant dès qu'un épisode de celui-ci attend.
const ECHECS = Object.fromEntries((config.calendrier_reels || []).filter((c) => c.remplacant).map((c) => [c.variante, serieEnEchec(loadData().posts, c.variante, { now: NOW })]));
for (const [serie, e] of Object.entries(ECHECS)) if (e) console.error(`${serie} ne marche pas (note ${e.note} sur ${e.episodes} épisodes, contre ${e.reference} pour les autres reels) : remplacé quand un épisode du remplaçant est prêt.`);
const remplace = (c) => (c.remplacant && ECHECS[c.variante] && episodeGrandDebat(c.remplacant) ? { ...c, variante: c.remplacant } : c);
const slotsFor = (d) => {
  const s = slotOfDay(d), srcReel = jourSource(PLAN, 'reel', s.jour);
  // Série sans épisode en attente : le reel de secours (`secours`, ex. un guide en vraies images) part à la place, le créneau n'est jamais vide.
  // Créneau promo : un spot promo en attente (media/spot-promo/) passe avant la promo automatique du studio.
  const spot = (c) => (c.variante === 'promo' && episodeGrandDebat('spot-promo') ? { ...c, variante: 'spot-promo' } : c);
  const base = [slotFor(d), ...(config.calendrier_reels || []).filter((c) => c.jour === srcReel).map(spot).map(remplace).map((c) => (SERIES.includes(c.variante) && !episodeGrandDebat(c.variante) ? (c.secours ? { ...c, variante: c.secours } : null) : c)).filter(Boolean).map((c) => ({ ...c, second: true }))].filter(Boolean);
  // Suites programmées après un engouement : en plus du reste, après les publications prévues (même écart).
  // Extra « à la place de » (remplace: 'post' ou 'reel') : il prend la place du post ou du reel prévu ce jour-là, pour rester
  // à 2 publications par jour (19/11/2026 : concours Frigo 16 à la place du reel guide, l'Édition Tekno reste).
  // Post prêt : jamais publié sans la validation du directeur (publication.json « valide »: true ; consigne du 19/11/2026).
  const pretValide = (x) => x.type !== 'pret' || (() => { try { return JSON.parse(readFileSync(path.join(ROOT, 'media', 'posts-prets', String(x.variante).replace(/[^a-z0-9-]/gi, ''), 'publication.json'), 'utf8')).valide === true; } catch { return false; } })();
  const aLaPlace = extrasDu(PLAN, s.date).filter(pretValide).find((x) => ['post', 'reel'].includes(x.remplace));
  if (aLaPlace) {
    const nouveau = { type: aLaPlace.type, variante: aLaPlace.variante || undefined };
    const i = aLaPlace.remplace === 'reel' ? base.findIndex((c) => c.type === 'reel') : base.findIndex((c) => c.type !== 'reel');
    if (i >= 0) base[i] = { ...nouveau, ...(base[i].second ? { second: true } : {}) };
    else if (aLaPlace.remplace === 'post') base.unshift(nouveau); else base.push({ ...nouveau, second: true });
    // « premier »: true : cette publication passe en premier dans la journée, les autres deviennent secondes.
    if (aLaPlace.premier) { const k = base.findIndex((c) => c.type === nouveau.type && c.variante === nouveau.variante); if (k > 0) { const [x] = base.splice(k, 1); delete x.second; base.unshift(x); for (const c of base.slice(1)) c.second = true; } else if (k === 0) delete base[0].second; }
  }
  const extras = extrasDu(PLAN, s.date).filter(pretValide).filter((x) => x !== aLaPlace).map((x) => ({ type: x.type, variante: x.variante || undefined, suite: true, second: true, troisieme: base.length > 1 }))
    .filter((x) => !SERIES.includes(x.variante) || episodeGrandDebat(x.variante));
  // 23/11/2026 (directeur : « la dernière publication date d'il y a deux jours, c'est absolument pas normal ») : jamais un jour
  // sans publication dans le fil ; un jour sans rien de prévu reçoit un post libre.
  if (!base.length && !extras.length) base.push({ type: 'libre' });
  return [...base, ...extras];
};
const optionsLibre = (now) => choixLibre({ now, historique: hist, slots: slotsFor, jourDe: (d) => slotOfDay(d).date });
const dejaPublie = (s) => hist.some((h) => h.id === slotId(s) && h.date === slotOfDay(NOW).date);
const slotDuMoment = () => slotsFor(NOW).find((s) => !dejaPublie(s));

let jobs;
if (cible === 'collecter') {
  const ig = igConfig();
  if (!ig) { console.log('IG_ACCESS_TOKEN / IG_USER_ID absents : pas de statistiques.'); process.exit(0); }
  const t = await analyserComptes({ ig, api: { businessDiscovery }, force: !!flag('force') });
  if (!t.deja) console.log(`Tendances : ${Object.keys(t.comptes || {}).length} compte(s) analysé(s), ${Object.keys(t.hashtags || {}).length} hashtag(s) repéré(s).`);
  // Jeton Instagram : alerte (échec du workflow = e-mail de GitHub) s'il est invalide ou expire dans moins de 10 jours.
  const { etatJeton } = await import('./instagram.mjs');
  const jeton = await etatJeton(ig);
  if (jeton.permissions?.length) console.log(`Jeton Instagram : permissions ${jeton.permissions.join(', ')}`);
  if (!jeton.valide) { console.error(`::error::Jeton Instagram invalide (${jeton.message || 'expiré'}) : régénère IG_ACCESS_TOKEN dans les secrets GitHub.`); process.exitCode = 1; }
  else if (jeton.jours != null && jeton.jours < 10) { console.error(`::error::Le jeton Instagram expire dans ${jeton.jours} jour(s) (${jeton.expire.toISOString().slice(0, 10)}) : régénère IG_ACCESS_TOKEN dans les secrets GitHub.`); process.exitCode = 1; }
  else console.log(`Jeton Instagram valide${jeton.jours != null ? `, expire dans ${jeton.jours} jours` : ''}.`);
  const n = await collect({ hist, ig, api: { insights, followers, compteMedia } });
  console.log(`Statistiques mises à jour pour ${n} publication(s). Voir RAPPORT.md`);
  for (const c of replanifier(PLAN, loadData(), config, NOW)) console.log(`Planning réactif : ${c.texte}`);
  await ecrirePlan(PLAN);
  // Analyse hebdomadaire par IA gratuite (veille Meta, pourquoi, nouveaux tests), une fois par semaine.
  const derniere = TENDANCES.derniere_analyse ? new Date(TENDANCES.derniere_analyse) : null;
  // Rythme du « cerveau » (veille Instagram + analyse + nouveaux tests) : chaque jour par défaut (config.llm.cerveau_jours).
  const rythme = Number(config.llm?.cerveau_jours ?? 1);
  if (flag('cerveau') || !derniere || (NOW - derniere) / 86400e3 >= Math.max(0.9, rythme - 0.1)) {
    const { analyserSemaine } = await import('./cerveau.mjs');
    try {
      const res = await analyserSemaine({ now: NOW });
      if (res) {
        const f = path.join(ROOT, 'contenus', 'tendances.json');
        const t = JSON.parse(await readFile(f, 'utf8'));
        t.derniere_analyse = NOW.toISOString();
        await writeFile(f, JSON.stringify(t, null, 2) + '\n');
        await collect({ hist, ig, api: { insights, followers } }); // régénère RAPPORT.md avec l'analyse
      }
    } catch (err) { console.error(`Analyse hebdomadaire impossible : ${err.message}`); }
  }
  await appendFile(path.join(ROOT, 'RAPPORT.md'), sectionRapport(PLAN)); // ce que le robot a changé tout seul
  process.exit(0);
}
// Auto-contrôle du jour (19/11/2026, directeur : « tout ce qui doit être publié doit être publié, et tu dois contrôler que ça
// l'a été ; un ok ne suffit pas »). À chaque passage : ce qui était prévu aujourd'hui, ce qui est vraiment en ligne (relu sur
// Instagram), les couvertures, les stories. Journal dans contenus/controle-publication.json. Tout manque passé l'heure
// limite ou toute publication non conforme fait échouer l'étape (e-mail de GitHub) ; un manque avant l'heure limite est
// repris par le passage horaire suivant.
if (cible === 'controle') {
  const { verifierMedia } = await import('./instagram.mjs');
  const S = await import('./stories.mjs');
  const ig = igConfig();
  const jour = slotOfDay(NOW).date;
  const hp = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(NOW).split(':').map(Number);
  const [mh, mm] = String(config.instagram?.heure_max_paris || '21:30').split(':').map(Number);
  const passe = hp[0] * 60 + hp[1] > mh * 60 + (mm || 0);
  const lignes = [], problemes = [];
  for (const sl of slotsFor(NOW)) {
    const sid = slotId(sl), h = hist.find((x) => x.id === sid && x.date === jour);
    if (!h) { (passe ? problemes : lignes).push(`${sid} : ${passe ? 'PAS PUBLIÉ aujourd\'hui' : 'pas encore publié (repris au prochain passage)'}`); continue; }
    if (!ig || !h.media) { lignes.push(`${sid} : noté publié (${h.lien || 'sans lien'}), non relu (pas d'accès Instagram)`); continue; }
    const p = h.publication || {};
    const v = await verifierMedia(h.media, ig, { type: p.type === 'reel' || h.duree || /reel/.test(sid) ? 'reel' : p.nb_images > 1 ? 'carrousel' : 'image', images: p.nb_images > 1 ? p.nb_images : undefined, legende: p.legende });
    const pb = [...v.problemes, ...(Array.isArray(h.verifie) ? h.verifie.filter((x) => !v.problemes.includes(x)) : [])];
    if (pb.length) problemes.push(`${sid} (${h.lien || h.media}) : ${pb.join(' ; ')}`);
    else lignes.push(`${sid} : en ligne et conforme (${h.lien})`);
  }
  const fh = path.join(ROOT, S.FICHIER_HISTO);
  const histo = existsSync(fh) ? JSON.parse(readFileSync(fh, 'utf8')) : [];
  const hPar = hp[0];
  for (const st of S.planDuJour(NOW)) {
    if (hPar < st.h) continue;
    const b = S.bilanStory(st, histo.find((x) => x.jour === jour && x.type === st.type), hPar);
    if (b.probleme) problemes.push(b.probleme); else lignes.push(b.ok);
  }
  console.log(`Auto-contrôle du ${jour} (${hp[0]}h${String(hp[1]).padStart(2, '0')} à Paris) :`);
  for (const l of lignes) console.log(`  ok  ${l}`);
  for (const l of problemes) console.error(`::error::Auto-contrôle : ${l}`);
  const fj = path.join(ROOT, 'contenus', 'controle-publication.json');
  const journal = existsSync(fj) ? JSON.parse(readFileSync(fj, 'utf8')) : { _note: 'Auto-contrôle des publications (src/run.mjs controle), à chaque passage horaire. Le plus récent en dernier.', jours: [] };
  journal.jours = [...journal.jours.filter((x) => x.jour !== jour), { jour, le: NOW.toISOString(), ok: lignes, problemes }].slice(-30);
  await writeFile(fj, JSON.stringify(journal, null, 1) + '\n');
  if (problemes.length) process.exitCode = 1;
  else if (!ig) console.log('  Aucun manque dans le journal, mais rien n\'a été relu sur Instagram (pas d\'accès) : ce n\'est pas une preuve.');
  else console.log('  Tout ce qui devait être publié à cette heure est en ligne et conforme.');
  process.exit();
}
if (cible === 'reactif') {
  // Toutes les 2 h au plus (passages horaires) : chiffres frais des publications du robot de moins de 48 h.
  const ig = igConfig();
  if (!ig) { console.log('IG_ACCESS_TOKEN / IG_USER_ID absents : pas de contrôle réactif.'); process.exit(0); }
  if (PLAN.dernier_controle && (NOW - new Date(PLAN.dernier_controle)) / 3600e3 < 1.9 && !flag('force')) { console.log('Contrôle réactif déjà fait il y a moins de 2 h.'); process.exit(0); }
  PLAN.dernier_controle = NOW.toISOString();
  nettoyer(PLAN, NOW);
  const recents = [];
  for (const h of hist.filter((x) => x.media && x.publication && (NOW - new Date(x.le)) / 3600e3 >= 2 && (NOW - new Date(x.le)) / 3600e3 <= 48)) {
    const metrics = await insights(h.media, h.publication.type === 'reel', ig).catch(() => null);
    if (metrics) recents.push({ media: h.media, id: h.id, type: h.publication.type, variante: h.publication.variante, titre: h.titre || h.publication.titre, metrics });
  }
  const top = engouements(recents, loadData().posts);
  for (const e of top) { const r = planifierSuite(PLAN, e, NOW, { episodeDispo: (sr) => !!episodeGrandDebat(sr) }); if (r) console.log(r.texte || `Suite programmée le ${r.date} : ${slotId(r)} (${e.raison})`); if (r?.urgent) console.error(`::warning::${r.texte}`); }
  console.log(`Contrôle réactif : ${recents.length} publication(s) récente(s), ${top.length} engouement(s).`);
  await ecrirePlan(PLAN);
  process.exit(0);
}
// Planning Instagram des 14 prochains jours (22/11/2026, directeur : « mets-moi le planning Instagram dans la partie admin,
// comme pour TikTok ») : mêmes règles que le robot (slotsFor, heure apprise, écart du 2e créneau, stories du jour),
// écrit dans contenus/planning-instagram.json et affiché sur /pilotage/. Simple aperçu : rien n'est publié d'ici.
async function ecrirePlanningInstagram(jours = 14) {
  const { planDuJour } = await import('./stories.mjs');
  const parisH = (h) => { const d = new Date(NOW); d.setUTCHours(h, 7, 0, 0); return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(d).replace(':', ' h '); };
  const sortie = [];
  for (let k = 0; k < jours; k++) {
    const d = new Date(NOW.getTime() + k * 864e5);
    const date = slotOfDay(d).date;
    let pubs = [];
    try { pubs = slotsFor(d); } catch (err) { console.error(`Planning Instagram : ${date} illisible (${err.message})`); }
    const premier = +creneauDuJour(d), dernier = Math.max(...CRENEAUX.map(Number));
    sortie.push({ date, pause: R.pause_publication || null,
      publications: pubs.map((s) => {
        const h = s.second ? Math.min(premier + Number(R.ecart_reel_h ?? 2) * (s.troisieme ? 2 : 1), dernier) : premier;
        const fait = hist.find((x) => x.id === slotId(s) && x.date === date);
        return { id: slotId(s), type: s.type, variante: s.variante || null, heure: parisH(h), suite: !!s.suite, fait: !!fait, lien: fait?.permalink || fait?.lien || null };
      }),
      stories: planDuJour(d).map((x) => ({ heure: `${x.h} h`, type: x.type, cle: x.cle || null })) });
  }
  await writeFile(path.join(ROOT, 'contenus', 'planning-instagram.json'), JSON.stringify({ le: new Date().toISOString(), jours: sortie }, null, 1) + '\n');
  return sortie;
}
if (cible === 'planning') { const p = await ecrirePlanningInstagram(); for (const j of p) console.log(j.date, j.publications.map((x) => `${x.heure} ${x.id}`).join(' | ')); process.exit(0); }

if (cible === 'auto') {
  const s = slotDuMoment();
  if (flag('quoi')) {
    let rep = s ? slotId(s) : 'rien';
    // Pause : la nouvelle direction artistique doit être validée avant toute publication automatique.
    if (R.pause_publication) { console.error(`Publications automatiques en pause : ${R.pause_publication}`); rep = 'rien'; }
    if (s?.type === 'reel' && config.studio?.reels_en_pause) { console.error(`Reels en pause : ${config.studio.reels_en_pause}`); rep = 'rien'; }
    if (s && hist.some((h) => h.id === slotId(s) && h.date === slotOfDay(NOW).date)) rep = 'rien'; // déjà publié aujourd'hui
    else if (s && flag('horaire')) {
      const premier = +creneauDuJour(NOW), dernier = Math.max(...CRENEAUX.map(Number));
      const choisi = s?.second ? Math.min(premier + Number(R.ecart_reel_h ?? 2) * (s.troisieme ? 2 : 1), dernier) : premier;
      if (NOW.getUTCHours() < choisi) { console.error(`Publication prévue vers ${choisi}h UTC.`); rep = 'rien'; }
      // Jamais de post tard le soir (le 11/11, un rattrapage est parti à 22h58) : au-delà de 21h30 à Paris, le post du
      // jour n'est plus publié par les passages de rattrapage (config.instagram.heure_max_paris pour changer).
      const hp = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(NOW).split(':').map(Number);
      const [mh, mm] = String(config.instagram?.heure_max_paris || '21:30').split(':').map(Number);
      if (rep !== 'rien' && hp[0] * 60 + hp[1] > mh * 60 + (mm || 0)) { console.error(`Trop tard pour publier (${hp[0]}h${String(hp[1]).padStart(2, '0')} à Paris, limite ${mh}h${String(mm || 0).padStart(2, '0')}).`); rep = 'rien'; }
    }
    await output('slot', rep === 'rien' ? '' : rep);
    console.log(rep);
    process.exit(0);
  }
  if (!s) { console.log(`Rien de prévu le ${slotOfDay(NOW).date} dans le calendrier.`); process.exit(0); }
  jobs = [{ slot: s, now: NOW }];
} else if (cible === 'stories') {
  // Stories du jour (src/stories.mjs) : « stories --quoi » = nombre dues, « stories preparer », « stories publier ».
  jobs = [];
} else if (cible === 'mois') {
  jobs = daysOfMonth(NOW).flatMap((d) => slotsFor(d).map((slot) => ({ slot, now: d })));
  console.log(`Aperçu du mois : ${jobs.length} publications`);
} else {
  const [type, variante] = cible.split(':');
  jobs = [{ slot: { type, variante }, now: NOW }];
}

let cache;
async function events() {
  if (!cache) {
    const fixtures = val('fixtures');
    let webEvents = [];
    if (!fixtures) {
      // Soirées trouvées sur le web et chez les organisateurs Instagram (IA gratuite), cache de quelques jours.
      const { rechercherSoirees } = await import('./recherche.mjs');
      try {
        const ig = igConfig();
        webEvents = (await rechercherSoirees({ config, now: NOW, ig, api: ig ? { businessDiscovery } : {}, force: !!flag('recherche') })).evenements || [];
      } catch (err) { console.error(`Recherche web impossible : ${err.message}`); webEvents = (await import('./recherche.mjs')).lireCache().evenements || []; }
    }
    cache = await collectEvents(config, { root: ROOT, debugDir: path.join(ROOT, 'out', 'debug'), fixturesDir: fixtures && path.resolve(fixtures), webEvents });
    // Soirées démenties (contenus/soirees-retirees.json) : retirées partout, même si une billetterie les annonce encore.
    { const { estRetiree } = await import('./coherence.mjs'); const avant = cache.events.length; cache.events = cache.events.filter((e) => !estRetiree(e)); if (cache.events.length < avant) console.log(`  → ${avant - cache.events.length} soirée(s) démentie(s) retirée(s)`); }
    console.log('Sources :');
    for (const r of cache.report) console.log(`  ${r.source.padEnd(8)} ${r.erreur ? '✗ ' + r.erreur : `${r.evenements} événement(s)`}  ${r.url || ''}`);
    console.log(`  → ${cache.events.length} événement(s) uniques au total`);
  }
  return cache.events;
}

// Site internet : agenda des soirées vérifiées, régénéré chaque jour (index.html + site/).
if (cible === 'site') {
  // Planning TikTok (src/tiktok.mjs) : à chaque passage, même si le site est déjà à jour (créneaux du jour).
  try { (await import('./tiktok.mjs')).construireTiktok({ now: NOW }); } catch (err) { console.error(`TikTok : planning impossible (${err.message})`); }
  try { await ecrirePlanningInstagram(); } catch (err) { console.error(`Planning Instagram : impossible (${err.message})`); }
  // Tableau de bord du directeur (/pilotage/, même code que /tiktok/), à chaque passage.
  try { (await import('./pilotage.mjs')).construirePilotage({ now: NOW }); } catch (err) { console.error(`Pilotage : tableau de bord impossible (${err.message})`); }
  // Une fois par jour suffit (sauf --force) : l'agenda change peu dans la journée.
  const marque = path.join(ROOT, 'site', '.maj');
  // Une fois par jour, ou dès qu'une nouvelle actu ou une nouvelle soirée est arrivée (rubrique « Actus » alimentée par la veille).
  const actusF = path.join(ROOT, 'contenus', 'actus.json');
  const evF = path.join(ROOT, 'evenements-web.json');
  const empreinte = async (f) => (existsSync(f) ? createHash('sha1').update(await readFile(f)).digest('hex').slice(0, 10) : '');
  // 22/11/2026 : le code du site compte aussi (un changement de script ou de style n'était mis en ligne qu'au passage
  // suivant d'une nouvelle soirée : la mesure des visites est restée plusieurs heures sans effet).
  const code = (await Promise.all(['site/app.js', 'site/style.css', 'src/site.mjs', 'src/site-contenus.mjs', 'src/site-langues.mjs'].map((f) => empreinte(path.join(ROOT, f))))).join('');
  const signature = `${isoLocal(NOW)}|${await empreinte(actusF)}|${await empreinte(evF)}|${createHash('sha1').update(code).digest('hex').slice(0, 10)}`;
  if (!flag('force') && existsSync(marque) && (await readFile(marque, 'utf8')).trim() === signature) { console.log('Site déjà à jour.'); process.exit(0); }
  const { construireSite } = await import('./site.mjs');
  const LLM_SITE = await import('./llm.mjs');
  // Heure limite globale de la mise à jour (le passage de la veille coupe à 15 min) : toutes les étapes à IA s'arrêtent avant,
  // et la construction des pages garde au moins 4 minutes.
  const FIN_SITE = Date.now() + (Number(process.env.SITE_BUDGET_MIN) || 12) * 60e3;
  LLM_SITE.plafondGlobalIA(FIN_SITE - 4 * 60e3);
  const igSite = igConfig();
  const { rechercherFrance, rechercherOccitanie } = await import('./recherche.mjs');
  // Rubriques France et Occitanie (22/11/2026) : leur recherche se relançait à chaque passage tant qu'elle n'avait pas réussi,
  // et avec l'IA gratuite saturée elle prenait les 15 minutes du passage : le site n'était plus reconstruit. Désormais :
  // 5 minutes au plus, puis pas de nouvel essai avant 6 h (en attendant, leurs soirées déjà trouvées restent affichées).
  const ESSAI_REG = path.join(ROOT, 'contenus', 'regions-essai.json');
  const dernierEssai = (() => { try { return Date.parse(JSON.parse(readFileSync(ESSAI_REG, 'utf8')).le) || 0; } catch { return 0; } })();
  const sansRegions = Date.now() - dernierEssai < 6 * 3600e3 && !flag('force');
  const avant = process.env.SANS_RECHERCHE;
  if (sansRegions) process.env.SANS_RECHERCHE = '1';
  else { writeFileSync(ESSAI_REG, JSON.stringify({ le: new Date().toISOString() }) + '\n'); LLM_SITE.echeanceIA(Date.now() + 5 * 60e3); }
  const france = await rechercherFrance({ config, now: NOW }).catch((err) => { console.error(`France : ${err.message}`); return { evenements: [] }; });
  // Occitanie : rubrique du site uniquement (les posts Instagram restent 100 % Côte d'Azur).
  const occitanie = await rechercherOccitanie({ config, now: NOW }).catch((err) => { console.error(`Occitanie : ${err.message}`); return { evenements: [] }; });
  if (avant === undefined) delete process.env.SANS_RECHERCHE; else process.env.SANS_RECHERCHE = avant;
  // Soirées des API officielles (Eventbrite, Ticketmaster) des rubriques France et Occitanie (22/11/2026, directeur : « ce n'est pas
  // que la Côte d'Azur, mais aussi les grandes villes ») : ajoutées à leurs rubriques, sans doublon.
  try {
    const { rubriqueDe } = await import('./sources.mjs');
    const lireEv = (f) => { try { return JSON.parse(readFileSync(path.join(ROOT, 'contenus', f), 'utf8')).evenements || []; } catch { return []; } };
    const api = [...lireEv('api-billetteries.json'), ...lireEv('agendas.json')]; // + agendas ouverts (DATAtourisme, OpenAgenda)
    const ajouter = (cible, rub) => { const vus = new Set((cible.evenements ||= []).map((e) => e.url || `${e.name}|${String(e.start).slice(0, 10)}`));
      for (const e of api) if (rubriqueDe(e) === rub && Date.parse(e.start) > Date.now() - 6 * 3600e3 && !vus.has(e.url)) cible.evenements.push(e); };
    ajouter(france, 'france'); ajouter(occitanie, 'occitanie');
  } catch { /* pas encore de relevé des API */ }
  LLM_SITE.echeanceIA();
  // Soirées de la Côte (recherche, Instagram, billetteries) : 6 minutes d'IA au plus, le site doit sortir dans le passage.
  LLM_SITE.echeanceIA(Date.now() + 6 * 60e3);
  const evCote = await events();
  LLM_SITE.echeanceIA();
  await construireSite({ events: evCote, eventsFrance: france.evenements || [], eventsOccitanie: occitanie.evenements || [], hist, config, now: NOW, ig: igSite, api: igSite ? { businessDiscovery, compteMedia } : {} });
  await writeFile(marque, signature + '\n');
  process.exit(0);
}

// Aperçu du mois : on efface seulement les aperçus (dossiers datés), jamais les médias à garder (stories « à la une »…).
if (cible === 'mois') for (const d of await readdir(MEDIA_DIR).catch(() => [])) if (/^\d{4}-\d{2}-\d{2}-/.test(d)) await rm(path.join(MEDIA_DIR, d), { recursive: true, force: true });
const echecs = [];
if (cible === 'stories') {
  const S = await import('./stories.mjs');
  if (flag('quoi')) { console.log(S.storiesDues(NOW).length); process.exit(0); }
  if (etape === 'preparer' || etape === 'tout') await storiesPreparer(S);
  if (etape === 'publier' || etape === 'tout') await storiesPublier(S);
  process.exit(0);
}
for (const j of jobs) {
  const id = cible === 'mois' ? `${isoLocal(j.now)}-${slotId(j.slot)}` : slotId(j.slot);
  try {
    if (etape === 'preparer' || etape === 'tout') {
      try { await prepare(j.slot, j.now, id); }
      catch (err) {
        // Jour sans IA disponible (crédit épuisé, panne) : plutôt que de ne rien publier, le carrousel des soirées
        // à venir, construit sans IA, part à la place du reel (même créneau, même identifiant pour l'historique).
        // Texte refusé par le contrôle : le carrousel des soirées (déjà contrôlé) part à la place.
        if (cible === 'auto' && /Texte refusé|Post incohérent/.test(err.message) && j.slot.type !== 'incontournables') { console.error(`[${id}] ✗ ${err.message} → carrousel des soirées à la place.`); await prepare({ type: 'incontournables', variante: 'commercial' }, j.now, id); continue; }
        // Carrousel Guide sans 3 adresses vérifiées : reel Flash à la place (le post sort toujours).
        if (cible === 'auto' && ['guide', 'libre'].includes(j.slot.type) && /Guide/.test(err.message)) { console.error(`[${id}] ✗ ${err.message} → reel Flash à la place.`); await prepare({ type: 'reel', variante: 'flash' }, j.now, id); continue; }
        if (cible === 'auto' && j.slot.type === 'reel' && /IA|Scénariste|reel écrit/i.test(err.message)) {
          console.error(`[${id}] ✗ ${err.message} → carrousel des soirées à la place (sans IA).`);
          await prepare({ type: 'incontournables', variante: 'commercial' }, j.now, id);
          continue;
        }
        // Toute autre panne (bug, fichier abîmé…) : la publication du jour sort quand même (règle « les publications
        // passent toujours ») avec le premier format de secours qui se prépare, et l'erreur est signalée.
        if (cible !== 'auto' || /valid/i.test(err.message)) throw err;
        console.error(`::error::[${id}] préparation impossible : ${err.message}`);
        await prepareSecours(j, id, err);
      }
    }
    if (etape === 'publier' || etape === 'tout') await publishPrepared(id);
  } catch (err) {
    console.error(`[${id}] ✗ ${err.message}`);
    echecs.push(id);
  }
}
if (echecs.length) die(`Échec : ${echecs.join(', ')}`);

// --- Préparation ------------------------------------------------------------

// Formats de secours, dans l'ordre, sans IA : carrousel des soirées, puis vidéos déjà prêtes (spots, « Tague ton pote »).
const SECOURS = [{ type: 'incontournables', variante: 'commercial' }, { type: 'reel', variante: 'spot-promo' }, { type: 'reel', variante: 'tague-ton-pote' }];
async function prepareSecours(j, id, erreur) {
  let derniere = erreur;
  for (const sl of SECOURS) {
    if (sl.type === j.slot.type && sl.variante === j.slot.variante) continue;
    if (sl.type === 'incontournables' && j.slot.type === 'incontournables') continue; // même moteur que ce qui vient d'échouer
    try { await prepare(sl, j.now, id); console.error(`::warning::[${id}] publié en secours : ${sl.type} ${sl.variante}.`); return; }
    catch (err) { console.error(`[${id}] secours ${sl.type} ${sl.variante} impossible : ${err.message}`); derniere = err; }
  }
  throw derniere;
}

async function prepare(slot, now, id) {
  PHOTO_COUV = null; MISE_COUV = null; COUV_SECOURS = false;
  const { renderPages, carouselPages, reelPages, debatPage, bonPlanManuelPage, afficheProgramme } = await import('./render.mjs');
  const { photoSource } = await import('./photos.mjs');
  const dir = path.join(MEDIA_DIR, id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const stamp = isoLocal(now);
  const seed = `${stamp}-${id}`;
  const r = rng(seed);
  const ch = chooser(MODEL, r);
  // Reel « viral » (13/11/2026, directeur : « je cherche la viralité, garde tout et améliore avec ce qui marche ») :
  // guide (vraies adresses), humour / POV vécus, histoire illustrée ; l'apprentissage ramène plus souvent le format qui
  // marche le mieux chez nous, et la veille des concurrents (Le Bonbon…) nourrit les scénarios. Jamais de reel de soirées.
  // 16/11/2026 (directeur, chiffres du compte) : ce qui se partage = vraies infos et plans concrets en vraies images ;
  // plus de reels illustrés (humour, histoire) dans le tirage.
  if (slot.type === 'reel' && slot.variante === 'viral') slot = { ...slot, variante: val('format') || ch.pick('format-reel-viral', ['guide'], (x) => x) };
  // Post « libre » (14/11/2026, directeur : « le planning n'est pas fixe, tu es censé évoluer ») : les jeudis sans Édition
  // Tekno, l'apprentissage choisit entre un guide (manger tard / afters) et un bon plan, et ramène plus souvent ce qui marche.
  // Cohérence (18/11/2026, directeur : planning « plus cohérent ») : jamais deux guides ou deux bons plans d'affilée — le
  // type publié la veille, ou prévu le jour même ou le lendemain (post ou reel guide), est écarté s'il reste un autre choix.
  if (slot.type === 'libre') { const ok = optionsLibre(now); const o = ch.pick('post-libre', ok, (x) => x); slot = o === 'guide' ? { ...slot, type: 'guide' } : { ...slot, type: 'bonplan', variante: o }; }
  if (cible === 'auto') ch.choix.creneau = String(Math.min(Math.max(NOW.getUTCHours(), +CRENEAUX[0]), +CRENEAUX.at(-1)));
  const villes = config.villes;
  const debugDir = path.join(ROOT, 'out', 'debug');
  // Soirées de la période, complétées par leur page de détail (affiche, style, prix), puis filtrées.
  // Pas de soirée du soir même : au moins `delai_min_heures` entre la publication et le début.
  const debutMin = now.getTime() + (R.delai_min_heures ?? 24) * 3600e3;
  const pickEv = async (win, pred = () => true) => {
    const list = filterEvents(await events(), { ...win, villes }).filter((e) => Date.parse(e.start) >= debutMin);
    if (!val('fixtures')) await enrich(list.slice(0, 60), { debugDir });
    // Soirées trouvées sur le web : gardées seulement si leur page les confirme (ou très fiables).
    // Posts : soirées fiables ET pertinentes pour les 17-30 ans (le site, lui, recense plus large).
    return list.filter((e) => e.source !== 'web' || (!e.douteux && (e.verifie || (e.confiance ?? 0) >= 0.85) && (e.public_cible ?? 1) >= (config.recherche_web?.pertinence_min ?? 0.5))).filter(pred);
  };
  const best = (list, n) => selectBest(list, n, MODEL, r);
  // Carrousel : jusqu'à 8 soirées (10 diapos avec couverture et fin), mais seulement les bonnes. Le seuil de qualité
  // (potentiel de buzz minimum) est lui-même appris : le bot garde celui qui donne les meilleures notes.
  const lesBonnes = (list) => {
    const max = Math.min(8, R.soirees_par_carrousel ?? 8);
    // Rappel du directeur (12/11/2026) : toujours les soirées au plus fort potentiel de clics (buzz + audience des
    // comptes de l'organisateur et du lieu), pas les premières venues.
    const classees = best(list, Math.max(max * 3, 18)).filter((e) => e.image).sort((a, b) => potentiel(b) - potentiel(a));
    const seuil = ch.pick('seuil-qualite', [0.55, 0.6, 0.65, 0.7], (x) => x);
    const bonnes = classees.filter((e) => (e.buzz ?? 0.6) >= seuil);
    return (bonnes.length >= 3 ? bonnes : classees.slice(0, 3)).slice(0, max);
  };
  // Les programmes de soirées sont toujours en carrousel : le post unique est réservé aux annonces
  // exceptionnelles repérées par la veille (une vraie raison d'exister, pas une soirée parmi d'autres).
  const formatPost = () => 'carrousel';
  const programme = (pages, chosen, opts) => (formatPost(chosen.length) === 'unique' ? afficheProgramme({ ...opts, events: chosen }) : pages);
  const cheap = (e) => e.price != null && e.price <= R.petit_prix_max;
  const MOIS = (d) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', month: 'long' }).format(d);
  const sousPlage = (win) => plage(win.from, win.to).toUpperCase();
  const visuel = async (univers, opts = {}) => {
    const th = theme(now, univers);
    const photos = await photoSource({ univers, saison: th.saison, fetes: !!th.tempsFort?.fetes, ch, r, ...opts });
    return { th, photos };
  };
  let pub;

  // Conversation : débat, ou appel aux organisateurs #TeufyParty (le format qui fait le plus commenter).
  const format = slot.type === 'debat' ? ch.pick('format-conversation', ['debat', 'orgas'], (x) => x) : null;
  if (slot.type === 'pret') {
    // Post prêt (19/11/2026 : concours Frigo 16 demandé par le directeur) : media/posts-prets/<dossier>/ contient le
    // carrousel déjà fait (01.jpg, 02.jpg…), legende.txt et publication.json (titre, photo, story). Publié tel quel, à la
    // date prévue dans contenus/planning-auto.json ; les mentions passent par la même vérification des comptes.
    const src = path.join(ROOT, 'media', 'posts-prets', String(slot.variante || '').replace(/[^a-z0-9-]/gi, ''));
    if (!slot.variante || !existsSync(path.join(src, 'legende.txt'))) throw new Error(`Post prêt introuvable : ${slot.variante}`);
    const meta = existsSync(path.join(src, 'publication.json')) ? JSON.parse(readFileSync(path.join(src, 'publication.json'), 'utf8')) : {};
    if (meta.valide !== true) throw new Error(`Post prêt ${slot.variante} : pas encore validé par le directeur (publication.json « valide »).`);
    const images = [];
    for (const f of readdirSync(src).filter((x) => /^\d+[^/]*\.jpe?g$/i.test(x)).sort()) { const d = path.join(dir, `pret-${f}`); await copyFile(path.join(src, f), d); images.push(d); }
    if (!images.length || images.length > 10) throw new Error(`Post prêt ${slot.variante} : ${images.length} image(s) (1 à 10)`);
    pub = { images, legende: readFileSync(path.join(src, 'legende.txt'), 'utf8').trim(), titre: meta.titre || slot.variante, photo: meta.photo || null,
      ...(Array.isArray(meta.tags) ? { tags: meta.tags.slice(0, images.length) } : {}) }; // identifications par image (vérifiées avant publication)
    if (meta.story && existsSync(path.join(src, meta.story))) { await copyFile(path.join(src, meta.story), path.join(dir, 'story-pret.jpg')); pub.storyPrete = 'story-pret.jpg'; }
    console.log(`[${id}] post prêt « ${pub.titre} » (${images.length} images)`);
  } else if (slot.type === 'veille') {
    // Veille : un post unique tout de suite si une annonce exceptionnelle et vérifiée vient de tomber.
    // Jour de fête (Noël, Nouvel An…) : un post spécial bonus, à l'heure prévue, une seule fois par an.
    const fete = feteDue(now);
    if (fete && !R.pause_publication) {
      const an = String(new Date(now).getFullYear());
      const fichier = await couvertureDA({ theme: fete.id, photo: await photoFete(fete), rubrique: fete.rubrique, titre: fete.titre.replace('{annee}', an), sous: (fete.sous || '').replace('{annee}', an) }, path.join(dir, `fete-${stamp}.jpg`), 'special');
      pub = { images: [fichier], legende: fete.legende.replace(/\{annee\}/g, String(new Date(now).getFullYear())), titre: fete.titre.replace('{annee}', String(new Date(now).getFullYear())).replace(/[[\]]/g, ''), fete: `${fete.id}-${new Date(now).getFullYear()}` };
      console.log(`[${id}] post de fête : ${fete.id}`);
    }
    const { veiller } = await import('./veille.mjs');
    const ig = igConfig();
    const v = pub ? { apublier: null, fete: true } : await veiller({ config, now, ig, api: ig ? { businessDiscovery } : {}, dryRun: DRY });
    if (v.fete) { /* post de fête prêt */ } else {
    if (R.pause_publication) v.apublier = null; // pause : la veille note les sujets mais ne publie pas
    if (!v.apublier) { await output('rien', 'true'); console.log('Veille : rien à publier tout de suite.'); return; }
    const s = v.apublier;
    const STUDIO = path.join(ROOT, 'studio');
    let image;
    if (/^https?:/.test(s.image || '')) {
      // Délai maximum et vraie image (avant : sans délai, et une page HTML d'erreur pouvait être prise pour l'affiche).
      const res = await fetch(s.image, { signal: AbortSignal.timeout(30000) }).catch(() => null);
      if (res?.ok && /^image\//i.test(res.headers.get('content-type') || '')) { image = `evenements/auto/flash-${hash(s.titre)}.jpg`; await mkdir(path.join(STUDIO, 'public', 'evenements', 'auto'), { recursive: true }); await writeFile(path.join(STUDIO, 'public', image), Buffer.from(await res.arrayBuffer())); }
    }
    const jourH = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(s.date_publication)).toUpperCase();
    const domaine = (() => { try { return new URL(s.source_url).hostname.replace(/^www\./, ''); } catch { return s.source_url; } })();
    const f = { type: s.type, surtitre: s.post.surtitre.toUpperCase().slice(0, 22), titre: s.post.titre, sous_titre: s.post.sous_titre, faits: s.post.faits.slice(0, 4), source: s.comptes_instagram?.[0] ? `@${s.comptes_instagram[0]} · ${domaine}` : domaine, date: jourH, image };
    if (!existsSync(path.join(STUDIO, 'node_modules'))) spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: STUDIO, stdio: 'inherit' });
    const fichier = path.join(dir, `flash-${stamp}.jpg`);
    const B = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
    const rr = spawnSync(path.join(STUDIO, 'node_modules', '.bin', 'remotion'), ['still', 'src/index.ts', 'flash', fichier, `--props=${JSON.stringify((await import('./captions.mjs')).sansEmoji({ f }))}`, '--image-format=jpeg', '--jpeg-quality=92', '--log=error', ...(existsSync(B) ? [`--browser-executable=${B}`] : [])], { cwd: STUDIO, stdio: 'inherit' });
    if (rr.status !== 0) throw new Error('Rendu du post de veille impossible');
    pub = { images: [fichier], legende: s.post.legende, titre: s.post.titre, veille: { titre: s.titre, source: s.source_url, importance: s.importance }, tags: [(s.comptes_instagram || []).map((h) => h.replace(/^@/, '')).slice(0, 5)] };
    console.log(`[${id}] post de veille : « ${s.post.titre} » (${s.importance}/100, ${s.source_url})`);
    }
  } else if (format === 'orgas') {
    const th = theme(now, 'club');
    const nouvelAn = th.tempsFort?.titre?.includes('Nouvel An');
    const quand = nouvelAn ? 'pour le Nouvel An' : 'ce week-end';
    const photos = await photoSource({ univers: 'club', saison: th.saison, fetes: !!th.tempsFort?.fetes, ch, r });
    const files = [await couvertureDA({ photo: `decors/da/${photoCouv(['dj', 'foule', 'danse'])}.jpg`, rubrique: 'Organisateurs', titre: `Tu organises une soirée ${quand} ? [Poste-la ici]`, sous: `Mets le lien en commentaire avec ${th.hashtag}` }, path.join(dir, `orgas-${stamp}.jpg`))];
    pub = { images: files, legende: captionOrgas({ quand, ch, r }), format: 'orgas' };
  } else if (slot.type === 'guide') {
    // Carrousel « Guide » (idée du directeur) : « Où manger à Cannes après la boîte », « Les afters à Nice »… Le format
    // qu'on enregistre. Construit SANS IA à partir des vraies adresses et de leurs horaires publiés.
    const { choisirGuide } = await import('./guide.mjs');
    const G = choisirGuide({ now, deja: hist.map((h) => h.guide).filter(Boolean) });
    if (!G) throw new Error('Guide : pas encore 3 adresses vérifiées pour une ville');
    const L = G.lieux.slice(0, 5);
    // Contrôle de cohérence AVANT publication (18/11/2026) : chaque adresse doit correspondre au titre du carrousel.
    if (G.theme === 'manger') { const { ouvertApresBoite } = await import('./guide.mjs'); const hors = L.filter((l) => !ouvertApresBoite(l.horaires, l.quoi)); if (hors.length) throw new Error(`Guide incohérent : ${hors.map((l) => `${l.nom} (${l.horaires})`).join(', ')} pas ouvert(s) après la boîte`); }
    const titre = G.theme === 'manger' ? `Où manger à [${G.ville}] après la boîte ?` : `Les [afters] à ${G.ville}`;
    const photos = G.theme === 'manger' ? ['taxi', 'terrasse', 'rire', 'plage', 'rooftop', 'taxi', 'terrasse'] : ['dj', 'lasers', 'danse', 'rooftop', 'selfie', 'rire', 'terrasse']; // une photo différente par slide
    { const c = photoCouv(photos); photos.splice(photos.indexOf(c) >= 0 ? photos.indexOf(c) : 0, photos.includes(c) ? 1 : 0); photos.unshift(c); }
    const files = [await couvertureDA({ photo: `decors/da/${photos[0]}.jpg`, rubrique: 'Guide', titre, sous: G.theme === 'manger' ? 'Ouvert quand tout le reste est fermé. Enregistre-le.' : 'Pour ceux qui ne veulent pas rentrer. Enregistre-le.' }, path.join(dir, `guide-${stamp}-0.jpg`))];
    for (const [i, l] of L.entries()) files.push(await couvertureDA({ photo: `decors/da/${photos[(i + 1) % photos.length]}.jpg`, rubrique: `${i + 1}/${L.length} · ${l.quoi || (G.theme === 'manger' ? 'Manger tard' : 'After')}`, titre: l.nom.replace(/[[\]]/g, ''), sous: [l.lieu, l.horaires].filter(Boolean).join(' · ') }, path.join(dir, `guide-${stamp}-${i + 1}.jpg`)));
    files.push(await couvertureDA({ photo: `decors/da/${photos[L.length + 1] || photos.at(-1)}.jpg`, rubrique: 'La liste complète', titre: `Toutes les adresses sur [teufyparty.com]`, sous: 'Horaires publiés, mis à jour chaque jour. Vérifie avant d\'y aller.' }, path.join(dir, `guide-${stamp}-fin.jpg`)));
    const accroche = G.theme === 'manger' ? `4 h du matin à ${G.ville}, la boîte ferme et t'as faim. On a la liste.` : `La boîte ferme, mais toi tu ne rentres pas. Les afters à ${G.ville}.`;
    const legende = `${accroche}\n\n${L.map((l, i) => `${i + 1}. ${l.nom}${l.lieu ? ` @ ${l.lieu}` : l.quoi ? ` (${l.quoi})` : ''} · ${l.horaires}`).join('\n')}\n\nHoraires publiés : vérifie avant d'y aller. Toutes les adresses sur teufyparty.com (${G.theme === 'manger' ? 'Manger tard' : 'After'}).\n\n${ch.pick('cta-guide', ['Enregistre ce post pour ta prochaine sortie.', 'Envoie ça à ton pote qui a toujours faim à 4 h.', 'Envoie ça au groupe avant samedi.'])}\n\n#TeufyParty #${sansAccentTag(G.ville)} #cotedazur #nightlife #${G.theme === 'manger' ? 'streetfood' : 'afterparty'}`;
    pub = { images: files, legende, titre: titre.replace(/[[\]]/g, ''), guide: `${G.theme}|${G.ville}`, textes_visuels: [titre, ...L.flatMap((l) => [l.nom, [l.lieu, l.horaires].filter(Boolean).join(' · ')])] };
  } else if (slot.type === 'debat') {
    const used = new Set([...hist.map((h) => h.debat).filter(Boolean), ...usedHere]);
    const all = JSON.parse(await readFile(path.join(ROOT, 'contenus', 'debats.json'), 'utf8'));
    let pool = all.filter((d) => !used.has(d.id));
    if (!pool.length) pool = all; // tout a été utilisé : on recommence
    const debat = ch.pick('debat', pool, (d) => d.id);
    usedHere.add(debat.id);
    const files = [await couvertureDA({ photo: `decors/da/${photoCouv(['lasers', 'rooftop', 'foule', 'terrasse', 'rire'])}.jpg`, fond: 'nuit', rubrique: 'Débat', titre: debat.q, options: [debat.a, debat.b] }, path.join(dir, `debat-${stamp}.jpg`))];
    pub = { images: files, legende: captionDebat({ debat, ch, r }), debat: debat.id };
  } else if (slot.type === 'bonplan') {
    const manuel = await bonPlanManuel(now);
    if (manuel) {
      usedHere.add(manuel.titre);
      const files = [await couvertureDA({ fond: 'creme', rubrique: 'Bon plan', titre: manuel.titre, sous: String(manuel.texte).split(/(?<=[.!?])\s/)[0] }, path.join(dir, `bonplan-${stamp}.jpg`))];
      pub = { images: files, legende: captionBonPlan({ manuel, ch, r }), bonplan: manuel.titre };
    } else {
      let variante = slot.variante;
      // Deux bons plans par semaine possibles (mercredi + post libre) : pas les soirées déjà montrées ces 6 derniers jours.
      const vues = new Set(hist.filter((h) => (now - new Date(h.le)) / 86400e3 < 6).flatMap((h) => h.soirees || []));
      const pickEv0 = pickEv; const pickEvN = async (w, pr) => { const l = await pickEv0(w, pr); const f = l.filter((e) => !vues.has(cleSoiree(e))); return f.length >= 3 ? f : l; };
      let win = rolling(now, 0, 10);
      let list = variante === 'petits-prix' ? await pickEvN(win, cheap) : [];
      if (list.length < 3) { variante = 'a-reserver'; win = rolling(now, 7, 45); list = await pickEvN(win); }
      if (list.length < 3) { win = rolling(now, 2, 45); list = await pickEvN(win); }
      // Cohérence avec le titre (« moins de X € » = prix connu et sous le plafond ; « à réserver » = pas complet).
      const coh = { format: variante, fenetre: { from: win.from, to: win.to }, now, prixMax: R.petit_prix_max };
      list = filtrerCoherentes(list, coh);
      need(list, 2);
      const chosen = chrono(lesBonnes(list));
      const reserve = variante === 'a-reserver';
      const files = await carrouselDA({ chosen, id, dir, now, rubrique: 'Bon plan', question: reserve ? 'Tu prends [laquelle] ?' : 'Tu fais [laquelle] ?',
        titreFlash: reserve ? 'À réserver avant le [sold out]' : `Sortir à moins de [${R.petit_prix_max} €]`, titre: ['', reserve ? 'les grosses dates' : 'sans se ruiner'] });
      pub = { images: files, legende: captionBonPlan({ variante, events: chosen, ...win, ch, r }), soirees: chosen, coherence: coh };
    }
  } else if (slot.type === 'incontournables') {
    // « Édition Tekno » (chaque jeudi) : soirées techno UNDERGROUND des 7 prochains jours, jamais de house.
    const tekno = slot.variante === 'tekno';
    const techno = slot.variante === 'techno' || tekno;
    const pred = tekno ? isUnderground : techno ? isTechno : (e) => !isTechno(e);
    // Techno : un carrousel des incontournables techno DU MOIS (30 jours), pour avoir de vraies grosses dates.
    let win = tekno ? rolling(now, 0, 14) : techno ? rolling(now, 0, 30) : windowFor([1, 2, 3, 4, 5, 6, 7], now);
    win.from = new Date(Math.max(win.from.getTime(), now.getTime() - 6 * 3600e3));
    let list = await pickEv(win, pred);
    let elargi = false;
    const avecAffiche = (l) => l.filter((e) => e.image).length;
    if (avecAffiche(list) < 4) { win = rolling(now, 0, tekno ? 21 : techno ? 45 : 14); list = await pickEv(win, pred); elargi = true; }
    // Trop peu de dates de ce genre : on prend toutes les soirées plutôt qu'un carrousel maigre.
    let melange = false;
    if (!tekno && avecAffiche(list) < 4) { const tout = await pickEv(win); if (avecAffiche(tout) > avecAffiche(list)) { list = tout; melange = true; } } // l'édition Tekno ne se mélange jamais
    // Cohérence avec le titre : période annoncée, genre de l'édition (Tekno = underground, techno, commercial sans techno).
    const coh = { format: tekno ? 'tekno' : techno && !melange ? 'techno' : melange ? null : 'commercial', fenetre: { from: win.from, to: win.to }, now };
    list = filtrerCoherentes(list, coh);
    need(list, 3);
    const chosen = chrono(lesBonnes(list));
    const { th, photos } = await visuel(techno ? 'techno' : 'club');
    const fort = !techno && th.tempsFort?.titre;
    const enTechno = techno && !melange; // carrousel élargi à tous les genres : on ne l'annonce plus comme « techno »
    const titre = enTechno
      ? ch.pick('titre-techno', ['Les incontournables techno du mois', 'Les dates techno à ne pas manquer ce mois-ci'])
      : fort || ch.pick('titre-commercial', ['Nos événements coups de cœur de la semaine', 'Les soirées à ne pas manquer', 'Nos coups de cœur de la semaine']);
    const pages = carouselPages({ mise: ch.pick('mise-couverture', ['centre', 'bas'], (x) => x),
      th, photos, events: chosen, titre,
      sous: fort ? `En ${MOIS(now)}` : elargi ? 'Ces prochains jours' : 'Cette semaine',
      fin: techno
        ? { texte: 'On se voit sur le dancefloor.\nTu seras à laquelle ?', pied: 'Toutes les soirées sur teufyparty.com' }
        : { texte: 'Tu sors où cette semaine ?\nDis-le en commentaire.', pied: 'Toutes les soirées sur teufyparty.com' },
    });
    let files = null;
    // Carrousel du studio (affiches officielles, DA éditoriale) ; repli sur l'ancien gabarit si impossible.
    files = await carrouselDA({ chosen, id, dir, now, edition: tekno ? 'tekno' : enTechno ? 'techno' : 'commercial', titre: [titre, ''] });
    if (!files) throw new Error('Carrousel de la DA impossible (studio absent ou moins de 2 affiches) : rien n\'est publié.');
    files ||= await renderPages(programme(pages, chosen, { th, photos, titre, sous: fort ? `En ${MOIS(now)}` : elargi ? 'Ces prochains jours' : 'Cette semaine' }), dir, `incontournables-${stamp}`, { width: 1080, height: 1350 });
    pub = { images: files, legende: captionIncontournables({ variante: enTechno || !techno ? slot.variante : 'commercial', events: chosen, ...win, ch, r, periode: chosen.periode }), soirees: chosen, titre: chosen.titrePost || titre, coherence: coh };
  } else if (slot.type === 'reel' && ['grand-debat', 'serie-nuit', 'spot-promo', 'tague-ton-pote'].includes(slot.variante)) {
    // « Le Grand Débat » (14/11/2026, directeur : 2 épisodes par semaine) : épisodes fabriqués à part (série animée
    // Kévin / Léo) et déposés dans media/grand-debat/ : episode.mp4 + episode.txt (légende). Le plus ancien non publié part.
    // Spots promo (media/spot-promo/) : même principe, le spot est choisi par l'apprentissage selon son type d'accroche.
    const ep = episodeGrandDebat(slot.variante, slot.variante === 'spot-promo' ? (l) => (l.some((x) => MODEL.arms[`accroche-spot:${x.accroche || 'autre'}`]) ? ch.pick('accroche-spot', l, (x) => x.accroche || 'autre') : l[0]) : null);
    if (!ep) throw new Error(`${slot.variante} : aucun épisode en attente dans media/${slot.variante}/`);
    const video = path.join(dir, `reel-${stamp}.mp4`), cover = path.join(dir, `reel-${stamp}-couverture.jpg`);
    await copyFile(ep.video, video);
    // Couverture : jamais une image du dessin animé (elle casse la DA de la grille et de l'onglet Reels) ; gabarit de la DA
    // (photo de nuit sombre + titre), comme les autres reels. Image de l'épisode seulement si le gabarit échoue.
    await couvertureReel({ photo: `decors/da/${photoCouv([ep.couvPhoto || (slot.variante === 'serie-nuit' ? 'lasers' : slot.variante === 'spot-promo' ? 'foule' : slot.variante === 'tague-ton-pote' ? 'selfie' : 'rire')])}.jpg`, rubrique: ep.nom, titre: ep.couvTitre }, cover, id, video, 0.4);
    const d = parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]).stdout?.toString()) || 0;
    if (ep.accroche) ch.choix['accroche-spot'] = ep.accroche; // aussi quand un seul spot attendait : la mesure compte
    for (const f of ep.fonctionnalites) (ch.choix['fonction-spot'] ||= []).push(f);
    pub = { video, couverture: cover, legende: ep.legende, titre: ep.titre, concept: ep.id, duree: +d.toFixed(1), rubrique: slot.variante === 'serie-nuit' ? 'Et toi, t\'aurais fait quoi ?' : slot.variante === 'spot-promo' ? 'Spot Teufy' : slot.variante === 'tague-ton-pote' ? 'Tague ton pote' : 'Le Grand Débat', hors_grille: slot.variante === 'serie-nuit' }; // la série n'apparaît que dans l'onglet Reels
    console.log(`[${id}] Grand Débat : épisode « ${ep.titre} » (${d.toFixed(1)} s)`);
  } else if (slot.type === 'reel' && config.studio?.actif && ['flash', 'histoire', 'nouveau', 'tendance', 'explicatif', 'humour', 'immersif', 'guide', 'teufy', 'promo'].includes(slot.variante)) { // « guide » manquait : le reel Guide retombait sur un reel de soirées
    // Reels = créations du studio (Remotion) : explicatif, humour ou immersif, jamais un catalogue de soirées.
    const STUDIO = path.join(ROOT, 'studio');
    const dirC = path.join(STUDIO, 'scripts', 'concepts');
    const tous = await Promise.all((await readdir(dirC)).filter((f) => f.endsWith('.json')).map(async (f) => ({fichier: path.join(dirC, f), ...JSON.parse(await readFile(path.join(dirC, f), 'utf8'))})));
    const faits = new Set([...hist.map((h) => h.concept).filter(Boolean), ...usedHere]);
    // Les promos de Teufy (concepts « promo ») ne servent qu'au créneau promo, jamais comme reel Flash ordinaire.
    const dispo = tous.filter((c) => !faits.has(c.id) && !c.promo);
    // Promo de Teufy (20/11/2026, directeur : « tous les 2 jours une vidéo de promotion de Teufy, pour que les gens aillent
    // sur le site, suivent le compte et attendent l'appli ; mets en avant les fonctionnalités »). Scénarios écrits à
    // l'avance (studio/scripts/concepts/promo-*.json, sans IA), à tour de rôle : la moins publiée d'abord. Les images
    // sont des captures du vrai site prises juste avant le rendu (donc toujours à jour).
    const choisirPromo = async () => {
      const nb = (x) => hist.filter((h) => h.concept === x.id).length;
      const P = tous.filter((x) => x.promo).sort((a, b) => nb(a) - nb(b) || a.id.localeCompare(b.id));
      const c = P[0]; if (!c) return null;
      for (const pl of c.extra?.plans || []) if (pl.capture) { const f = path.join(STUDIO, 'public', pl.photo); try { await captureSite(pl.capture, f); } catch (err) { console.error(`[${id}] capture ${pl.capture} impossible : ${err.message}`); } if (!existsSync(f)) pl.photo = 'decors/da/foule.jpg'; }
      await writeFile(c.fichier, JSON.stringify(Object.fromEntries(Object.entries(c).filter(([k]) => k !== 'fichier')), null, 1));
      return c;
    };
    // reel:nouveau = forcer un reel inédit écrit par l'IA (sans passer par la banque).
    // Format validé : « Flash ». La rubrique est choisie par l'apprentissage (celle qui marche le mieux revient plus souvent).
    const rubriqueFlash = () => ch.pick('rubrique-reel', ['Explicatif', 'Astuce', 'Humour', 'Actu nuit'], (x) => x);
    // Tendance : format viral repéré par la veille, écrit à neuf ; si l'écriture échoue, reel Flash de la banque (le post sort toujours).
    let c = slot.variante === 'promo' ? await choisirPromo()
      : slot.variante === 'guide' ? await nouveauFlash(STUDIO, id, 'Guide').catch((err) => { console.error(`[${id}] reel Guide impossible (${err.message}) : reel Humour à la place.`); return DRY ? dispo.find((x) => x.concept === 'reelflash') : nouveauFlash(STUDIO, id, 'Humour').catch(() => dispo.find((x) => x.concept === 'reelflash') || null); })
      : slot.variante === 'tendance' ? await nouveauFlash(STUDIO, id, 'Tendance').catch((err) => { console.error(`[${id}] reel Tendance impossible (${err.message}) : reel Flash de la banque.`); return dispo.find((x) => x.concept === 'reelflash') || null; })
      : slot.variante === 'nouveau' ? await nouveauFlash(STUDIO, id, rubriqueFlash())
      : slot.variante === 'teufy' && !DRY ? await nouveauFlash(STUDIO, id, 'Teufy').catch((err) => { console.error(`[${id}] reel Teufy impossible (${err.message}) : reel Humour.`); return nouveauFlash(STUDIO, id, 'Humour').catch(() => null); })
      : slot.variante === 'humour' && !DRY ? await nouveauFlash(STUDIO, id, 'Humour').catch((err) => { console.error(`[${id}] reel Humour impossible (${err.message}) : histoire illustrée.`); return dispo.find((x) => ['histoire', 'potesfluide'].includes(x.concept)) || null; })
      : val('concept') ? tous.find((x) => x.id === val('concept'))
      // Flash (12/11/2026) : écrit à neuf avec la fiche cible (contenus/cible.json) ; la réserve ne sert qu'en secours.
      : slot.variante === 'flash' && !DRY ? await nouveauFlash(STUDIO, id, rubriqueFlash()).catch((err) => { console.error(`[${id}] reel Flash inédit impossible (${err.message}) : réserve.`); return dispo.find((x) => x.concept === 'reelflash') || null; })
      : slot.variante === 'flash' ? dispo.find((x) => x.concept === 'reelflash')
      : slot.variante === 'histoire' ? dispo.find((x) => ['histoire', 'potesfluide'].includes(x.concept))
      : dispo.find((x) => x.type === slot.variante) || dispo[0];
    if (!c && slot.variante === 'histoire') c = DRY ? tous.find((x) => x.concept === 'histoire') : await nouvelleHistoire(STUDIO, id);
    if (!c && slot.variante === 'flash' && DRY) c = tous.find((x) => x.concept === 'reelflash');
    // Deux tentatives (deux rubriques) si la relecture refuse le premier script : le reel du jour sort quand même.
    if (!c && slot.variante === 'flash') { try { c = await nouveauFlash(STUDIO, id, rubriqueFlash()); } catch (err) { console.error(`[${id}] ${err.message} : nouvel essai avec une autre rubrique.`); c = await nouveauFlash(STUDIO, id, ['Astuce', 'Explicatif', 'Humour'][new Date().getDay() % 3]); } }
    if (!c) throw new Error('Banque de concepts de reels épuisée : ajoute des concepts dans studio/scripts/concepts (voir studio/LISEZMOI.md).');
    usedHere.add(c.id);
    if (!existsSync(path.join(STUDIO, 'node_modules'))) spawnSync('npm', ['ci', '--no-audit', '--no-fund'], {cwd: STUDIO, stdio: 'inherit'});
    const dejaRendu = DRY && existsSync(path.join(STUDIO, 'out', `${c.id}.mp4`)); // aperçu du mois : pas de rendu en double
    const r = dejaRendu ? {status: 0} : spawnSync('node', [path.join(STUDIO, 'scripts', 'produire.mjs'), c.fichier], {cwd: STUDIO, stdio: 'inherit', env: {...process.env, NODE_USE_ENV_PROXY: '1'}});
    if (r.status !== 0) throw new Error(`Studio : rendu ou contrôle qualité en échec pour « ${c.id} »`);
    const video = path.join(dir, `reel-${stamp}.mp4`);
    await copyFile(path.join(STUDIO, 'out', `${c.id}.mp4`), video);
    const cover = path.join(dir, `reel-${stamp}-couverture.jpg`);
    // Couverture : gabarit de la DA (cohérent avec les posts dans la grille), sinon une image du reel.
    let couvDA = false;
    if (c.concept === 'reelflash') {
      const photo = c.extra?.plans?.[c.couverture_scene ?? 0]?.photo;
      const props = { photo, rubrique: c.rubrique || 'Explicatif', titre: c.titre_couverture || c.titre };
      couvDA = await couvertureDA(props, cover, 'couverture-reel').then(() => true, () => false);
      if (!couvDA) console.error(`[${id}] couverture DA non conforme, image du reel à la place.`);
    }
    // Toujours une couverture DA (directeur, 19/11/2026) : photo de la banque si le reel n'a pas sa propre photo.
    if (!couvDA) await couvertureReel({ photo: `decors/da/${photoCouv(['foule', 'dj', 'danse', 'rire'])}.jpg`, rubrique: c.rubrique || 'Teufy', titre: c.titre_couverture || c.titre }, cover, id, video, c.couverture ?? 1.5);
    const d = parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]).stdout?.toString()) || 0;
    pub = { video, couverture: cover, legende: c.legende, titre: c.titre, concept: c.id, duree: +d.toFixed(1), rubrique: c.rubrique };
    console.log(`[${id}] reel studio « ${c.id} » (${c.type}) ${d.toFixed(1)} s`);
  } else if (slot.type === 'reel') {
    let variante = slot.variante;
    // 3e reel du mois : petits prix ou explicatif (astuces, sujets du moment) ; le bot garde ce qui marche.
    if (variante === 'petits-prix') variante = ch.pick('format-reel-3', ['petits-prix', 'explicatif'], (x) => x);
    const motion = await import('./motion.mjs');
    // Voix off (Piper) : voix féminine, masculine ou sans voix ; le bot garde ce qui marche.
    const { voixDisponibles } = await import('./audio.mjs');
    const dispo = voixDisponibles(config);
    // ElevenLabs : voix off sur tous les reels (avec ou sans, le bot peut le tester via voix_off.tester_sans_voix).
    const choixVoix = val('voix') || (dispo.length ? (config.voix_off?.tester_sans_voix ? ch.pick('voix-off', [...dispo, 'aucune'], (x) => x) : dispo[0]) : 'aucune');
    const voix = choixVoix === 'aucune' ? null : choixVoix;
    const jourDit = (d) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long' }).format(new Date(Date.parse(d) - 5 * 3600e3));
    const tmp = path.join(ROOT, 'out', `reel-${id}`);
    const video = path.join(dir, `reel-${stamp}.mp4`);
    let res;
    // Montage sur vraies vidéos de soirée, calé sur un son Instagram du moment (sinon boucle générée).
    const { montageReel, GRAMMAIRES } = await import('./montage.mjs');
    const genreDe = (v) => (v === 'techno' ? 'techno' : 'club');
    const monter = async ({ th, contenu, genre }) => {
      const { rassemblerRushes } = await import('./rushes.mjs');
      const rushes = await rassemblerRushes({ r });
      if (rushes.length < 4) throw new Error(`pas assez de rushes vidéo (${rushes.length})`);
      const { choisirSon } = await import('./son.mjs');
      const son = await choisirSon({ ig: igConfig(), genre, dossier: `${tmp}-son`, r, deja: hist.slice(-12).map((h) => h.son?.audio_id).filter(Boolean) }).catch(() => null);
      const grammaire = val('grammaire') || ch.pick('grammaire-reel', GRAMMAIRES, (x) => x);
      const videoIG = son ? video.replace(/\.mp4$/, '-instagram.mp4') : null;
      // Sans son Instagram (pas de jeton, API indisponible) : boucle générée au tempo du montage.
      let musique = son?.fichier || null;
      if (!musique) {
        const { genererBeat } = await import('./beat.mjs');
        await mkdir(`${tmp}-son`, { recursive: true });
        musique = await genererBeat({ style: genre, duree: 30, sortie: path.join(`${tmp}-son`, 'beat.wav'), seed: hash(seed) });
      }
      const m = await montageReel({ th, contenu, rushes, out: video, outSansMusique: videoIG, tmp, genre, grammaire, seed: hash(seed), compte: config.compte, now,
        musique, tempo: son ? { bpm: son.bpm, phase: son.phase } : null });
      return { ...m, voix: null, musique: son ? `${son.titre} – ${son.artiste} (son Instagram, ${son.bpm} BPM)` : m.musique,
        son: son ? { audio_id: son.audio_id, titre: son.titre, artiste: son.artiste, bpm: son.bpm } : null, video_instagram: videoIG };
    };
    if (variante === 'explicatif') {
      const used = new Set([...hist.map((h) => h.sujet).filter(Boolean), ...usedHere]);
      const tous = JSON.parse(await readFile(path.join(ROOT, 'contenus', 'sujets-reels.json'), 'utf8'));
      const pool = tous.filter((x) => !used.has(x.id));
      const sujet = ch.pick('sujet-reel', pool.length ? pool : tous, (x) => x.id);
      usedHere.add(sujet.id);
      const { th, photos } = await visuel(/techno/.test(sujet.sous || '') ? 'techno' : 'club');
      try {
        res = await monter({ th, genre: 'club', contenu: { hook: { titre: sujet.titre, sous: sujet.sous }, points: sujet.points, fin: 'enregistre pour plus tard' } });
      } catch (err) {
        console.error(`[${id}] montage impossible (${err.message}), motion simple.`);
        const scenes = [...motion.scenesExplication(th, { titre: sujet.titre, sous: sujet.sous, points: sujet.points, photos }),
          motion.sceneFin(th, { compte: config.compte, photo: photos.next(), texte: 'Enregistre pour plus tard' })];
        res = await motion.motionReel({ scenes, out: video, root: ROOT, genre: 'club', tmp, voix, config });
      }
      pub = { video, video_instagram: res.video_instagram || undefined, son: res.son || undefined, legende: captionExplicatif({ sujet, ch, r }), duree: +res.total.toFixed(1), titre: sujet.titre, sujet: sujet.id };
    } else {
      // Week-end visé : celui de la semaine, ou le suivant s'il est déjà trop entamé (règle des 24 h).
      const weFor = () => { const w = windowFor([5, 6, 7], now); return w.to.getTime() - debutMin < 36 * 3600e3 ? windowFor([5, 6, 7], new Date(now.getTime() + 7 * 86400e3)) : w; };
      let win = weFor();
      const preds = { weekend: () => true, techno: isTechno, 'petits-prix': cheap };
      let list = await pickEv(win, preds[variante]);
      let elargi = false;
      if (list.length < 3 && variante !== 'weekend') { win = rolling(now, 0, 9); list = await pickEv(win, preds[variante]); elargi = true; }
      if (list.length < 3) { variante = 'weekend'; win = weFor(); list = await pickEv(win); elargi = false; }
      if (list.length < 2) { win = rolling(now, 1, 10); list = await pickEv(win); elargi = true; }
      need(list, 2);
      const chosen = pickReel(best(list, 40), voix ? Math.min(4, R.soirees_par_reel) : R.soirees_par_reel);
      const hooks = TENDANCES.accroches_reels;
      const sansWeekend = hooks[variante].filter((h) => !elargi || !/week-end/i.test(h.titre + h.sous));
      // Accroches tirées des vraies soirées de la semaine (chiffre, villes, prix), en plus de celles de tendances.json.
      const quand = elargi ? 'ces prochains jours' : 'ce week-end';
      const villes = [...new Set(chosen.map((e) => (e.city || 'Nice').replace(/^Saint-/i, 'St-')))].slice(0, 3);
      const prixMax = Math.max(...chosen.map((e) => e.price ?? 0));
      const generees = {
        weekend: [
          { titre: `${chosen.length} soirées où tu DOIS être ${quand}`, sous: villes.join(' · ') },
          { titre: `Arrête de scroller, ton plan ${quand} est là`, sous: villes.join(' · ') },
          { titre: `${villes[0]} ${quand}, c'est ça ou rien`, sous: `${chosen.length} soirées` },
        ],
        techno: [
          { titre: `${chosen.length} raves à pas rater ${quand}`, sous: villes.join(' · ') },
          { titre: `Techno ${quand} : voilà où ça tape`, sous: villes.join(' · ') },
        ],
        'petits-prix': [
          { titre: `${chosen.length} soirées à moins de ${Math.max(5, Math.ceil(prixMax))} €`, sous: quand },
          { titre: `Sortir ${quand} sans te ruiner`, sous: villes.join(' · ') },
        ],
      }[variante] || [];
      const pool = [...(sansWeekend.length ? sansWeekend : hooks[variante]), ...generees];
      const hook = ch.pick(`hook-${variante}`, pool, (h) => hash(h.titre));
      const { th, photos } = await visuel(variante === 'techno' ? 'techno' : 'club');
      const question = variante === 'techno' ? 'Tu seras où ?' : variante === 'petits-prix' ? 'Laquelle tu prends ?' : 'Laquelle tu choisis ?';
      // Motion design : accroche animée, une scène par soirée, question, fin.
      const scenes = [
        motion.sceneAccroche(th, { titre: hook.titre, sous: hook.sous, photo: photos.next(), duree: Math.max(1.6, TENDANCES.regles_instagram.accroche_max_s + 0.4) }),
        ...chosen.map((e, i) => motion.sceneSoiree(th, { e, n: i + 1, haut: photos.next(), bas: photos.next(), milieu: e.image ? undefined : photos.next(), duree: Math.max(1.8, R.secondes_par_soiree_reel),
          voix: `Numéro ${i + 1}. ${jourDit(e.start)}, ${e.name}${e.venue ? `, ${e.venue}` : ''}${e.city ? ` à ${e.city}` : ''}.${e.accroche && e.accroche.length <= 90 ? ` ${e.accroche}` : ''}` })),
        motion.sceneQuestion(th, { question, events: chosen, photo: photos.next() }),
        motion.sceneFin(th, { compte: config.compte, photo: photos.next() }),
      ];
      try {
        try {
          res = await monter({ th, genre: genreDe(variante), contenu: { hook, events: chosen, question } });
        } catch (err) {
          console.error(`[${id}] montage impossible (${err.message}), motion simple.`);
          res = await motion.motionReel({ scenes, out: video, root: ROOT, genre: genreDe(variante), tmp, voix, config });
        }
      } catch (err) {
        // Repli : diaporama simple si le rendu animé échoue.
        console.error(`[${id}] motion impossible (${err.message}), diaporama simple.`);
        const pages = reelPages({ th, photos, events: chosen, titre: hook.titre, sous: hook.sous, compte: config.compte, question });
        const imgs = await renderPages(pages, tmp, 'reel', { width: 1080, height: 1920, png: true });
        const { buildReel } = await import('./reel.mjs');
        res = await buildReel(imgs, video, { root: ROOT, durees: [1.6, ...chosen.map(() => 1.8), 2.6, 1.8], genre: variante === 'techno' ? 'techno' : 'club' });
      }
      pub = { video, video_instagram: res.video_instagram || undefined, son: res.son || undefined, legende: captionReel({ variante, events: chosen, ch, r, elargi }), soirees: chosen, duree: +res.total.toFixed(1), titre: hook.titre };
    }
    // Couverture DA (19/11/2026 : jamais une image tirée de la vidéo, sauf panne).
    const cover = path.join(dir, `reel-${stamp}-couverture.jpg`);
    await couvertureReel({ photo: `decors/da/${photoCouv(variante === 'techno' ? ['lasers', 'dj', 'foule'] : ['danse', 'foule', 'dj', 'lasers'])}.jpg`, rubrique: 'Sorties', titre: String(hook.titre || 'Les soirées de la semaine') }, cover, id, video, 1.2);
    pub.couverture = cover;
    console.log(`[${id}] reel ${variante} ${res.total.toFixed(1)} s${res.grammaire ? `, montage ${res.grammaire} (${res.etalonnage})` : ''}, musique : ${res.son ? res.musique : res.musique ? path.basename(String(res.musique)) : 'aucune'}`);
  } else {
    throw new Error(`Type inconnu : ${slot.type}`);
  }

  const rel = (f) => path.basename(f);
  // Identifications par image : diapo 1 = couverture, puis une diapo par soirée (même ordre que `soirees`).
  if (pub.images && pub.soirees) {
    pub.tags = pub.images.length === 1
      ? [[...new Set(pub.soirees.flatMap((e) => comptesConfirmes(e)))].slice(0, 5)] // post unique : tous les comptes sur l'image
      : [[], ...pub.soirees.slice(0, 8).map((e) => comptesConfirmes(e))];
  }
  // Collaboration : les organisateurs des 3 soirées vedettes (celles affichées sur la couverture).
  if (pub.soirees?.length && pub.images?.length > 1) { pub.collabs = comptesCollab(pub.soirees); console.error(`Collaborations proposées (du plus suivi au moins suivi) : ${pub.collabs.map((h) => `@${h} (${abonnesDe(h) || '?'})`).join(', ')}`); }
  // Dernière vérification avant publication : la moindre incohérence restante bloque le post.
  if (pub.soirees?.length && pub.coherence) { const pb = controlePost({ soirees: pub.soirees, ...pub.coherence }); if (pb.length) throw new Error(`Post incohérent, rien n'est publié : ${pb.join(' ; ')}`); }
  if (pub.coherence) delete pub.coherence;
  const out = { id, type: slot.type, variante: slot.variante || null, date: stamp, ...pub, photo: pub.photo || PHOTO_COUV, mise: pub.mise || MISE_COUV || undefined, couverture_secours: COUV_SECOURS || undefined, choix: ch.choix,
    features: (pub.soirees || []).flatMap(eventFeatures), nb_images: pub.images?.length || 0 };
  if (out.images) out.images = out.images.map(rel);
  if (out.video) { out.video = rel(out.video); out.couverture = rel(out.couverture); if (out.video_instagram) out.video_instagram = rel(out.video_instagram); }
  // Hashtags : 5 au maximum (règle Instagram), #TeufyParty en premier, sans doublon, regroupés en fin de légende.
  if (out.legende) out.legende = (await import('./captions.mjs')).nettoyerLegende(out.legende, hist.length); // sans emoji, appel au partage
  if (out.legende) {
    const tags = [...new Set(['#TeufyParty', ...(out.legende.match(/(?<=^|\s)#\p{L}[\p{L}\p{N}_]*/gmu) || [])].map((h) => (h.toLowerCase() === '#teufyparty' ? '#TeufyParty' : h)))].slice(0, R.hashtags_max ?? 5);
    out.legende = `${out.legende.replace(/(^|[ \t])#\p{L}[\p{L}\p{N}_]*(?=[ \t]*(\n|$|#))/gmu, '$1').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()}\n\n${tags.join(' ')}`;
  }
  // Story qui relaie la publication (image : visuel 9:16 de la DA ; reel : la vidéo elle-même).
  if (out.images?.length) {
    try {
      const STUDIO = path.join(ROOT, 'studio');
      const src = path.join('evenements', 'auto', `story-${id}.jpg`);
      await mkdir(path.join(STUDIO, 'public', 'evenements', 'auto'), { recursive: true });
      await copyFile(path.join(dir, out.images[0]), path.join(STUDIO, 'public', src));
      const texte = String(out.titre || pub.titre || '').replace(/[[\]]/g, '').trim();
      const props = { image: src, rubrique: out.fete ? 'Nouveau post' : slot.type === 'veille' ? 'Info de dernière minute' : 'Nouveau post', ...(texte ? { texte: `${texte} : le post complet est sur le profil` } : {}) };
      const B = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
      const rs = spawnSync(path.join(STUDIO, 'node_modules', '.bin', 'remotion'), ['still', 'src/index.ts', 'story', path.join(dir, 'story.jpg'), `--props=${JSON.stringify((await import('./captions.mjs')).sansEmoji(props))}`, '--image-format=jpeg', '--jpeg-quality=92', '--log=error', ...(existsSync(B) ? [`--browser-executable=${B}`] : [])], { cwd: STUDIO, stdio: 'inherit' });
      if (rs.status === 0) out.story = 'story.jpg'; else console.error(`[${id}] story non conforme : pas de story pour ce post.`);
    } catch (err) { console.error(`[${id}] story impossible : ${err.message}`); }
  } else if (out.video) out.story_video = out.video;
  if (pub.storyPrete) { out.story = pub.storyPrete; delete out.storyPrete; }
  // Débat en STORY (12/11/2026, directeur : « ça c'est une story à la rigueur, c'est nul pour un post ») : le jour
  // prévu (calendrier « story: debat »), le fil reçoit un vrai post et le débat part en story à côté.
  if (slot.story === 'debat') {
    try {
      const used = new Set([...hist.map((h) => h.debat).filter(Boolean), ...usedHere]);
      const all = JSON.parse(await readFile(path.join(ROOT, 'contenus', 'debats.json'), 'utf8'));
      // Test du partage (contenus/cible.json) : en story, seulement des situations VÉCUES par les fêtards de la Côte
      // (file d'attente, entrée à 20 €, retour en taxi…), pas des concepts imaginaires (« laser game dans un hangar »,
      // relu le 13/11/2026 : personne ne l'envoie à un pote). Les concepts restent pour les sondages de formats.
      const vecus = all.filter((d) => d.vecu !== false);
      let pool = vecus.filter((d) => !used.has(d.id));
      if (!pool.length) pool = vecus.length ? vecus : all;
      const debat = ch.pick('debat', pool, (d) => d.id);
      usedHere.add(debat.id);
      const img = await couvertureDA({ photo: `decors/da/${photoCouv(['lasers', 'rooftop', 'foule', 'terrasse', 'rire'])}.jpg`, fond: 'nuit', rubrique: 'Débat', titre: debat.q, options: [debat.a, debat.b] }, path.join(dir, `debat-${stamp}.jpg`));
      const STUDIO = path.join(ROOT, 'studio');
      const src = path.join('evenements', 'auto', `debat-${id}.jpg`);
      await mkdir(path.join(STUDIO, 'public', 'evenements', 'auto'), { recursive: true });
      await copyFile(img, path.join(STUDIO, 'public', src));
      const props = { image: src, rubrique: 'Ton avis', texte: 'A ou B ? Réponds en message' }; // « Débat » est déjà écrit sur la carte
      const B = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
      const rs = spawnSync(path.join(STUDIO, 'node_modules', '.bin', 'remotion'), ['still', 'src/index.ts', 'story', path.join(dir, 'story-debat.jpg'), `--props=${JSON.stringify(props)}`, '--image-format=jpeg', '--jpeg-quality=92', '--log=error', ...(existsSync(B) ? [`--browser-executable=${B}`] : [])], { cwd: STUDIO, stdio: 'inherit' });
      if (rs.status === 0) { out.story_debat = 'story-debat.jpg'; out.debat = debat.id; console.log(`[${id}] débat en story : « ${debat.q} »`); }
    } catch (err) { console.error(`[${id}] débat en story impossible : ${err.message}`); }
  }
  // Contrôle des textes (légende, titre, textes des visuels) : un texte cassé ne part jamais (directeur, 12/11/2026).
  { const { controlerPublication } = await import('./controle-texte.mjs'); controlerPublication(out, pub.textes_visuels || []); }
  // Dès la préparation (l'aperçu montre la vraie légende) ; refait juste avant de publier.
  { const igv = igConfig(); await nettoyerComptes(out, { ig: igv, businessDiscovery }); }
  await writeFile(path.join(dir, 'publication.json'), JSON.stringify(out, null, 2));
  await writeFile(path.join(dir, 'legende.txt'), out.legende + '\n');
  console.log(`\n[${id}] prêt dans media/${id}/\n${out.legende.split('\n').map((l) => '   ' + l).join('\n')}`);
}

async function bonPlanManuel(now) {
  const f = path.join(ROOT, 'contenus', 'bons-plans.json');
  if (!existsSync(f)) return null;
  const used = new Set([...hist.map((h) => h.bonplan).filter(Boolean), ...usedHere]);
  const list = JSON.parse(await readFile(f, 'utf8'));
  const today = isoLocal(now);
  return list.find((b) => b.titre && b.texte && !used.has(b.titre) && (!b.du || b.du <= today) && (!b.au || b.au >= today)) || null;
}

// Pour le reel : les plus belles affiches, une soirée différente par jour si possible, ordre chronologique.
function pickReel(list, max) {
  const withImg = list.filter((e) => e.image);
  const pool = withImg.length >= 3 ? withImg : list;
  const out = [];
  const days = new Set();
  for (const e of pool) { const d = isoLocal(new Date(Date.parse(e.start) - 5 * 3600e3)); if (!days.has(d)) { out.push(e); days.add(d); } if (out.length >= max) break; }
  for (const e of pool) { if (out.length >= max) break; if (!out.includes(e)) out.push(e); }
  return chrono(out);
}

function chrono(l) { return [...l].sort((a, b) => a.start.localeCompare(b.start)); }
function need(list, n) {
  if (list.length < n) throw new Error(`Pas assez de soirées trouvées (${list.length}). Rien n'est publié. Voir out/debug/ pour les pages récupérées.`);
}

// --- Publication ------------------------------------------------------------

async function publishPrepared(id) {
  const dir = path.join(MEDIA_DIR, id);
  const f = path.join(dir, 'publication.json');
  if (!existsSync(f)) { if (id === 'veille') return; throw new Error(`Rien de préparé (media/${id}/publication.json absent).`); }
  const p = JSON.parse(await readFile(f, 'utf8'));
  const ig = igConfig();
  if (DRY || !ig) { console.log(`[${id}] ${DRY ? 'Aperçu' : 'IG_ACCESS_TOKEN / IG_USER_ID absents'} : pas de publication Instagram.`); return; }
  if (hist.some((h) => h.id === id && h.date === p.date && (id !== 'veille' || (h.publication?.titre || h.titre) === p.titre)) && !process.env.FORCE) {
    console.log(`[${id}] Déjà publié le ${p.date}. (FORCE=1 pour republier)`);
    return;
  }

  // Comptes tagués, invités et mentionnés : uniquement ceux dont l'existence est confirmée (jamais d'identifiant inventé).
  await nettoyerComptes(p, { ig, businessDiscovery });
  await writeFile(f, JSON.stringify(p, null, 2));

  let base = MEDIA_BASE;
  const url = (name) => `${base}/${id}/${name}`;
  const urls = () => (p.video ? [url(p.video), url(p.couverture), ...(p.video_instagram ? [url(p.video_instagram)] : [])] : [...p.images.map(url), ...(p.story ? [url(p.story)] : []), ...(p.story_debat ? [url(p.story_debat)] : [])]);
  if (!(await waitOnline(urls(), 12 * 60e3))) {
    const fb = process.env.MEDIA_FALLBACK_URL;
    if (!fb) throw new Error(`Les fichiers ne sont pas en ligne sur ${MEDIA_BASE} après 12 min.`);
    console.log(`[${id}] GitHub Pages pas encore à jour, on utilise ${fb}`);
    base = fb.replace(/\/$/, '');
    if (!(await waitOnline(urls(), 3 * 60e3))) throw new Error(`Fichiers introuvables aussi sur ${fb}.`);
  }

  const publier = async () => (p.video
    ? await publishReel(url(p.son?.audio_id && p.video_instagram ? p.video_instagram : p.video), url(p.couverture), p.legende, ig,
      { essai: !!TENDANCES.reels_essai?.actif, audio: p.son?.audio_id ? { audio_id: p.son.audio_id } : null, videoSecours: url(p.video), grille: !p.hors_grille })
    : p.images.length === 1
      ? await publishSingle(url(p.images[0]), p.legende, ig, { tags: p.tags, legende: (ok) => legendeFinale(p.legende, p.a_tester, ok) })
      : await publishCarousel(p.images.map(url), p.legende, ig, { tags: p.tags, collabs: config.collaborations?.actif ? p.collabs : [], legende: (ok) => legendeFinale(p.legende, p.a_tester, ok) }));
  let res;
  const debutEnvoi = Date.now();
  // Erreur de l'API alors que le post est peut-être parti (réponse perdue, délai dépassé) : on regarde d'abord le profil,
  // pour ne jamais republier en double ni noter « échec » un post qui est en ligne.
  const dejaParti = async () => { try { const { correspondPublication } = await import('./instagram.mjs'); const m = correspondPublication(await compteMedia(ig, 5), p.legende, debutEnvoi); if (m) console.error(`::warning::[${id}] l'API a répondu par une erreur, mais le post est en ligne (${m.permalink || m.id}) : noté publié, pas de second envoi.`); return m ? { id: m.id } : null; } catch { return null; } };
  try { res = await publier(); } catch (err) {
    res = await dejaParti();
    if (res) { /* déjà en ligne */ } else {
    // Instagram n'arrive pas à télécharger les médias depuis teufyparty.com (pare-feu Cloudflare, panne du domaine…) :
    // une seconde tentative depuis l'adresse de secours GitHub, qui ne passe pas par le domaine.
    const fb = process.env.MEDIA_FALLBACK_URL;
    if (!fb || base === fb.replace(/\/$/, '') || !/(media|image|video|download|fetch|url|2207|9004|36000|36001|36003)/i.test(err.message)) throw err;
    console.log(`[${id}] Instagram n'a pas pu lire les médias sur ${base} (${err.message.slice(0, 120)}) : nouvel essai depuis ${fb}`);
    base = fb.replace(/\/$/, '');
    if (!(await waitOnline(urls(), 3 * 60e3))) throw err;
    try { res = await publier(); } catch (err2) { res = await dejaParti(); if (!res) throw err2; }
    }
  }
  // Historique écrit TOUT DE SUITE (20/11/2026) : avant, il ne l'était qu'après la relecture et les stories (jusqu'à
  // 20 min) ; un arrêt entre-temps (délai du job, panne) laissait un post en ligne sans trace, republié au passage suivant.
  const entreeHist = { id, date: p.date, media: res.id, lien: null, fete: p.fete, titre: p.titre, guide: p.guide, debat: p.debat, bonplan: p.bonplan, sujet: p.sujet, son: p.son, concept: p.concept, photo: p.photo || null, mise: p.mise || undefined, verifie: 'en cours', hors_grille: p.hors_grille || undefined, soirees: (p.soirees || []).map(cleSoiree), le: new Date().toISOString(),
    publication: { id: p.id, type: p.type, variante: p.variante, date: p.date, choix: p.choix, features: p.features, nb_images: p.nb_images, duree: p.duree, legende: p.legende, titre: p.titre } };
  hist.push(entreeHist);
  await writeFile(HIST_FILE, JSON.stringify(hist.slice(-300), null, 2));
  // Post de veille : le sujet ne compte comme publié qu'à partir d'ici (avant : dès la préparation, même si rien ne partait).
  if (p.veille?.titre) await (await import('./veille.mjs')).confirmerPublicationVeille(p.veille.titre).catch((err) => console.error(`Veille : sujet non confirmé (${err.message})`));
  const link = await permalink(res.id, ig);
  entreeHist.lien = link;
  // Auto-contrôle : on relit la publication sur Instagram (un « ok » de l'API ne suffit pas, directeur 19/11/2026).
  const { verifierMedia } = await import('./instagram.mjs');
  const attendu = { type: p.video ? 'reel' : p.images.length === 1 ? 'image' : 'carrousel', images: p.video ? undefined : p.images.length, legende: p.legende };
  let verif = await verifierMedia(res.id, ig, attendu);
  if (!verif.ok) { await new Promise((ok) => setTimeout(ok, 30e3)); verif = await verifierMedia(res.id, ig, attendu); } // le temps qu'Instagram termine
  if (p.couverture_secours) verif.problemes.push('couverture du reel tombée en secours (image de la vidéo au lieu de la couverture DA)');
  if (verif.problemes.length) console.error(`::error::[${id}] publication vérifiée avec ${verif.problemes.length} problème(s) : ${verif.problemes.join(' ; ')}`);
  else console.log(`[${id}] ✅ vérifié sur Instagram : ${attendu.type}${attendu.images ? ` de ${attendu.images} image(s)` : ''}, légende et lien en ligne${p.video ? ', couverture DA' : ''}.`);
  console.log(`[${id}] ✅ publié : ${link || res.id}`);
  // Relais en story (une erreur ici ne remet pas en cause la publication).
  if ((p.story || p.story_video) && config.stories?.actif !== false) {
    try {
      const st = await publishStory(url(p.story || p.story_video), ig, { video: !p.story });
      console.log(`[${id}] ✅ story publiée (${st.id})`);
    } catch (err) { console.error(`[${id}] story impossible : ${err.message}`); }
  }
  if (p.story_debat) {
    try { const st = await publishStory(url(p.story_debat), ig); console.log(`[${id}] ✅ débat publié en story (${st.id})`); }
    catch (err) { console.error(`[${id}] débat en story impossible : ${err.message}`); }
  }
  entreeHist.verifie = verif.problemes.length ? verif.problemes : true;
  await writeFile(HIST_FILE, JSON.stringify(hist.slice(-300), null, 2));
}

// GitHub Pages met 1 à 5 min à mettre les fichiers en ligne après le push.
async function waitOnline(urls, timeoutMs) {
  const t0 = Date.now();
  for (const u of urls) {
    for (;;) {
      const ok = await fetch(u, { method: 'HEAD', cache: 'no-store' }).then((r) => r.ok).catch(() => false);
      if (ok) break;
      if (Date.now() - t0 > timeoutMs) return false;
      await new Promise((r) => setTimeout(r, 15000));
    }
  }
  return true;
}

async function output(k, v) { if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); }
function die(msg) { console.error(msg); process.exit(1); }

// Reel « plan continu illustré » inédit : le scénariste IA écrit le sujet et le script, Gemini dessine les décors.
// Un décor qui n'a pas pu être généré est remplacé par un décor existant du même type de lieu.
async function nouvelleHistoire(STUDIO, id) {
  const env = { ...process.env, NODE_USE_ENV_PROXY: '1' };
  if (!existsSync(path.join(STUDIO, 'node_modules'))) spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: STUDIO, stdio: 'inherit' });
  const e = spawnSync('node', [path.join(STUDIO, 'scripts', 'ecrire.mjs')], { cwd: STUDIO, env, stdio: ['ignore', 'pipe', 'inherit'] });
  const sortie = (e.stdout?.toString() || '').trim().split('\n');
  console.log(sortie.slice(0, -1).join('\n'));
  const fichier = sortie.at(-1);
  if (e.status !== 0 || !fichier || !existsSync(fichier)) throw new Error('Scénariste : aucun script de reel écrit.');
  const c = JSON.parse(await readFile(fichier, 'utf8'));
  if (process.env.GEMINI_API_KEY) spawnSync('node', [path.join(STUDIO, 'scripts', 'decors.mjs'), path.join(STUDIO, 'scripts', 'decors', `${c.id}.json`)], { cwd: STUDIO, env, stdio: 'inherit' });
  else console.error(`[${id}] GEMINI_API_KEY absente : décors de secours.`);
  const SECOURS = { 'sfx/ambiance-club.mp3': ['decors/potes/dancefloor.jpg', 'decors/potes/dj.jpg'], 'sfx/ambiance-rue.mp3': ['decors/potes/kebab.jpg'], 'sfx/ambiance-mer.mp3': ['decors/potes/matin.jpg'] };
  c.extra.mondes.forEach((m, i) => {
    if (existsSync(path.join(STUDIO, 'public', m.decor))) return;
    const l = SECOURS[m.ambiance] || SECOURS['sfx/ambiance-club.mp3'];
    m.decor = l[i % l.length];
    console.error(`[${id}] décor ${i + 1} manquant, secours : ${m.decor}`);
  });
  await writeFile(fichier, JSON.stringify(c, null, 2) + '\n');
  return { fichier, ...c };
}

// --- DA « Flash nuit » : carrousels et couvertures rendus par le studio, avec contrôle visuel ----------------------
function sansAccentTag(x) { return String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); }
function photoDA(noms, now) { return `decors/da/${noms[Math.floor(now / (7 * 864e5)) % noms.length]}.jpg`; }
// Couverture de la grille : photo qui colle au sujet, jamais une des 9 dernières couvertures (src/photos.mjs).
function photoCouv(preferees) { PHOTO_COUV = choisirPhoto(preferees, photosRecentes([...AMORCE_PHOTOS, ...hist])); return PHOTO_COUV; }

// Mise en page de la couverture : choisie une fois par publication (toutes les images d'un même post gardent la même),
// celle qui n'a pas servi depuis le plus longtemps dans la grille (src/photos.mjs).
function miseCouv() { if (MISE_COUV === null) MISE_COUV = choisirMise(misesRecentes([...AMORCE_PHOTOS, ...hist])); return MISE_COUV || 'bas'; }

// Couverture de reel : gabarit de la DA (bouton lecture, mise en page qui tourne), deux essais ; l'image de la vidéo
// seulement en dernier recours, et alors signalée (::error:: dans le journal + auto-contrôle du jour).
async function couvertureReel(props, cover, id, video, ss) {
  for (const essai of [1, 2]) {
    try { await couvertureDA(props, cover, 'couverture-reel'); return true; }
    catch (err) { console.error(`[${id}] couverture DA, essai ${essai} : ${err.message}`); if (essai === 1) MISE_COUV = 'bas'; }
  }
  console.error(`::error::[${id}] couverture DA impossible : image de la vidéo à la place (à corriger).`);
  COUV_SECOURS = true;
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(ss), '-i', video, '-frames:v', '1', '-q:v', '2', cover]);
  return false;
}

async function couvertureDA(props, fichier, composition = 'couverture') {
  if (MISE_COUV !== undefined && !props.mise && /^couverture/.test(composition) && props.photo && props.fond !== 'creme') {
    try { return await rendreCouverture({ ...props, mise: miseCouv() }, fichier, composition); }
    catch (err) { if (MISE_COUV === 'bas') throw err; console.error(`Couverture « ${MISE_COUV} » refusée par le contrôle visuel : mise « bas » à la place.`); MISE_COUV = 'bas'; }
    return rendreCouverture({ ...props, mise: 'bas' }, fichier, composition);
  }
  return rendreCouverture(props, fichier, composition);
}
async function rendreCouverture(props, fichier, composition) {
  props = (await import('./captions.mjs')).sansEmoji(props); // aucun emoji dans les visuels (directeur, 19/11/2026)
  const STUDIO = path.join(ROOT, 'studio');
  if (!existsSync(path.join(STUDIO, 'node_modules'))) spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: STUDIO, stdio: 'inherit' });
  const B = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
  const r = spawnSync(path.join(STUDIO, 'node_modules', '.bin', 'remotion'), ['still', 'src/index.ts', composition, fichier, `--props=${JSON.stringify(props)}`, '--image-format=jpeg', '--jpeg-quality=92', '--log=error', ...(existsSync(B) ? [`--browser-executable=${B}`] : [])], { cwd: STUDIO, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('Visuel non conforme à la DA (contrôle visuel en échec) : rien n\'est publié plutôt qu\'un visuel raté.');
  return fichier;
}

async function carrouselDA({ chosen, id, dir, now, titre = [], titreFlash, rubrique, question, edition }) {
  const STUDIO = path.join(ROOT, 'studio');
  if (!existsSync(path.join(STUDIO, 'node_modules'))) spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: STUDIO, stdio: 'inherit' });
  if (chosen.filter((e) => e.image).length < 2) throw new Error('Moins de 2 soirées avec affiche officielle : pas de carrousel.');
      const { heure } = await import('./dates.mjs');
      const { genresList } = await import('./genres.mjs');
      const jourC = (d) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(Date.parse(d) - 5 * 3600e3)).replace(/^./, (c) => c.toUpperCase());
      // Contrôle qualité des affiches (12/11/2026, sans IA) : seulement des affiches dont on est sûr qu'elles annoncent
      // CETTE soirée (mêmes règles que le site : saisie de l'équipe, affiche lue et conforme, ou billetterie/organisateur),
      // jamais la même image pour deux soirées, et en haute définition (vignettes Shotgun 384 px floues remplacées).
      const { afficheFiable } = await import('./site.mjs');
      const hd = (u) => String(u || '').replace(/(assets\.shotgun\.live\/image\/upload\/)[^/]*\//, '$1c_limit,w_1920,fl_lossy,f_jpg,q_auto/');
      // Image partagée par plusieurs soirées : gardée seulement pour celle dont elle est vraiment l'affiche (vérifiée),
      // et pour aucune si plusieurs passent (ambigu).
      const fiable = new Map(chosen.filter((e) => e.image).map((e) => [e, afficheFiable(e)]));
      const okParImage = {}; for (const [e, ok] of fiable) if (ok) okParImage[e.image] = (okParImage[e.image] || 0) + 1;
      const refus = chosen.filter((e) => e.image && (!fiable.get(e) || okParImage[e.image] > 1));
      for (const e of refus) console.error(`Affiche écartée (non vérifiée ou partagée par plusieurs soirées) : ${e.name}`);
      // Affiche déjà vérifiée et téléchargée par le site (même fichier net que sur teufyparty.com) : réutilisée telle quelle.
      const { createHash } = await import('node:crypto');
      const autoDir = path.join(ROOT, 'studio', 'public', 'evenements', 'auto');
      await mkdir(autoDir, { recursive: true });
      const locale = (e) => { const f = path.join(ROOT, 'site', 'affiches', `${createHash('sha1').update(String(e.image)).digest('hex').slice(0, 12)}.jpg`);
        if (!existsSync(f)) return ''; const dst = path.join(autoDir, path.basename(f)); copyFileSync(f, dst); return `evenements/auto/${path.basename(f)}`; };
      const avecImage = chosen.filter((e) => e.image && !refus.includes(e)).map((e) => ({ ...e, image: locale(e) || hd(e.image) })).slice(0, 8);
      const villes = [...new Set(avecImage.map((e) => e.city).filter(Boolean))];
      // Titres calculés sur les dates RÉELLES des soirées gardées (jamais « cette semaine » pour des dates du mois).
      const { periodeDe } = await import('./periode.mjs');
      const P = periodeDe(avecImage.map((e) => e.start), now); chosen.periode = P;
      if (edition) {
        const nb = avecImage.length, sem = Math.floor(now / (7 * 864e5));
        const T = edition === 'tekno' ? ['Édition [Tekno]', 'Spécial [underground]', 'Ça tape [fort]']
          : P.cle === 'semaine' ? ['Où sortir [cette semaine]', 'Ta semaine est [réglée]', `${nb} soirées à ne pas [rater]`]
          : P.cle === 'weekend' ? ['Ton week-end est [réglé]', 'Où sortir [ce week-end]', `${nb} soirées à ne pas [rater]`]
          : P.cle === 'mois' ? [`Où sortir en [${P.mois}]`, `${nb} dates à ne pas rater en [${P.mois}]`]
          : [`${nb} soirées à ne pas [rater]`, `${nb} sorties qu'on [valide]`];
        if (edition === 'techno') T.splice(0, T.length, P.cle === 'mois' ? `La techno en [${P.mois}]` : `${nb} dates techno à ne pas [rater]`);
        titreFlash ||= T[sem % T.length];
        question ||= edition === 'tekno' ? `Tu vas raver [où] ${P.label} ?` : `Tu vas [où] ${P.label} ?`;
        rubrique ||= edition === 'tekno' ? "Édition Tekno · Côte d'Azur" : undefined;
        chosen.titrePost = titreFlash.replace(/[[\]]/g, '');
        console.log(`Carrousel : période « ${P.label} », titre « ${chosen.titrePost} »`);
      }
      const dts = avecImage.map((e) => new Date(Date.parse(e.start) - 5 * 3600e3)).sort((a, b) => a - b);
      const fmt = (d, o) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', ...o }).format(d);
      const sous = dts.length ? (fmt(dts[0], { day: 'numeric', month: 'long' }) === fmt(dts.at(-1), { day: 'numeric', month: 'long' }) ? `le ${fmt(dts[0], { weekday: 'long', day: 'numeric', month: 'long' })}`
        : `du ${fmt(dts[0], { day: 'numeric', ...(fmt(dts[0], { month: 'long' }) === fmt(dts.at(-1), { month: 'long' }) ? {} : { month: 'long' }) })} au ${fmt(dts.at(-1), { day: 'numeric', month: 'long' })}`) : '';
      const entree = { photo: `decors/da/${photoCouv(edition === 'tekno' || edition === 'techno' ? ['lasers', 'dj', 'foule', 'danse'] : ['danse', 'foule', 'dj', 'rire', 'terrasse', 'plage', 'lasers'])}.jpg`, sous, titre, titreFlash, rubrique, question, lieu: (villes.length === 1 ? villes[0] : "CÔTE D'AZUR").toUpperCase(), pied: villes.slice(0, 3).map((v) => v.replace(/-du-.*$/i, '')).join(' · ').toUpperCase(),
        soirees: avecImage.map((e, i) => ({ id: `${i}-${hash(e.name)}`, vedette: vedettes(avecImage).includes(e), nom: e.name, genre: (genresList(e).slice(0, 2).join(' & ') || 'soirée').toLowerCase(), jour: jourC(e.start), debut: e.start, heures: `dès ${heure(e.start)}`, // « dès minuit » pour 23h59 (voir dates.mjs)
          prix: e.price == null ? 'prix sur la billetterie' : e.price === 0 ? 'gratuit' : `dès ${String(Math.round(e.price * 100) / 100).replace('.', ',')} €`, lieu: [e.venue, e.city && !String(e.venue || '').toLowerCase().includes(String(e.city).toLowerCase().split(/[\s-]/)[0]) ? e.city : ''].filter(Boolean).join(' · '), image: e.image })) };
      const fe = path.join(ROOT, 'out', `carrousel-${id}.json`);
      await mkdir(path.dirname(fe), { recursive: true });
      entree.mise = miseCouv();
      const lancer = async () => { await writeFile(fe, JSON.stringify(entree)); return spawnSync('node', [path.join(ROOT, 'studio', 'scripts', 'affiches.mjs'), fe, dir], { cwd: path.join(ROOT, 'studio'), stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1', GEMINI_EN_PAUSE: (await import('./llm.mjs')).geminiEnPause(config) ? '1' : '0' } }); };
      let r = await lancer();
      // Mise en page refusée par le contrôle visuel (texte trop long…) : on refait avec la composition d'origine.
      if (r.status !== 0 && r.status !== 3 && entree.mise !== 'bas') { console.error(`Couverture « ${entree.mise} » refusée : mise « bas » à la place.`); entree.mise = MISE_COUV = 'bas'; r = await lancer(); }
      if (r.status === 0) {
        const fichiers = JSON.parse(await readFile(path.join(dir, 'carrousel.json'), 'utf8')).fichiers;
        const gardesIds = new Set(JSON.parse(await readFile(path.join(dir, 'carrousel.json'), 'utf8')).soirees);
        chosen.splice(0, chosen.length, ...avecImage.filter((e, i) => gardesIds.has(`${i}-${hash(e.name)}`)));
        return fichiers;
      }
      throw new Error('Carrousel non conforme à la DA (contrôle visuel en échec ou moins de 2 affiches officielles) : rien n\'est publié plutôt qu\'un visuel raté.');
}

// Reel « Flash » inédit : le scénariste IA écrit (sujet utile, script, plans), Gemini fait les photos verticales.
// Une photo manquante est remplacée par une photo de la banque de la DA (même style).
// Capture d'une page du site, comme sur un téléphone, au format du reel (1080×1920).
async function captureSite(pageDemandee, f) {
  // « page@2 » : même page, faite défiler de 2 écrans (pour ne pas montrer deux fois la même image dans un reel).
  const [page, defile] = String(pageDemandee).split('@');
  const { chromium } = await import('playwright');
  const PAGES = { accueil: '', 'ce-soir': 'ce-soir/', 'pres-de-moi': 'ce-soir/', 'manger-tard': 'manger-tard/', avantages: 'avantages/', 'clubs-bars': 'clubs-bars/' };
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 693 }, deviceScaleFactor: 1080 / 390, isMobile: true, hasTouch: true, geolocation: { latitude: 43.6961, longitude: 7.2718 }, permissions: ['geolocation'], locale: 'fr-FR' });
    const p = await ctx.newPage();
    await p.goto(`https://teufyparty.com/${PAGES[page] ?? ''}`, { waitUntil: 'networkidle', timeout: 60000 });
    await p.waitForTimeout(1200);
    if (page === 'pres-de-moi') { await p.click('[data-pres]').catch(() => {}); await p.waitForTimeout(1500); await p.evaluate(() => document.querySelector('.dist-moi')?.closest('section')?.scrollIntoView()); await p.waitForTimeout(800); }
    else if (page !== 'accueil' || defile) { const k = Number(defile || 1); await p.evaluate((k) => scrollBy(0, innerHeight * 0.9 * k), k); await p.waitForTimeout(900); }
    mkdirSync(path.dirname(f), { recursive: true });
    await p.screenshot({ path: f, type: 'jpeg', quality: 92 });
  } finally { await b.close(); }
}

async function nouveauFlash(STUDIO, id, rubrique) {
  const env = { ...process.env, NODE_USE_ENV_PROXY: '1' };
  if (!existsSync(path.join(STUDIO, 'node_modules'))) spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: STUDIO, stdio: 'inherit' });
  const e = spawnSync('node', [path.join(STUDIO, 'scripts', 'ecrire-flash.mjs'), rubrique], { cwd: STUDIO, env, stdio: ['ignore', 'pipe', 'inherit'] });
  const sortie = (e.stdout?.toString() || '').trim().split('\n');
  console.log(sortie.slice(0, -1).join('\n'));
  const fichier = sortie.at(-1);
  if (e.status !== 0 || !fichier || !existsSync(fichier)) throw new Error('Scénariste : aucun reel écrit.');
  const c = JSON.parse(await readFile(fichier, 'utf8'));
  // Captures du vrai site (rubrique « Teufy ») : nettes, 1080×1920, prises avant les décors générés.
  const fd = path.join(STUDIO, 'scripts', 'decors', `reel-${c.id}.json`);
  const decorsC = existsSync(fd) ? JSON.parse(await readFile(fd, 'utf8')) : { decors: [] };
  for (const d of decorsC.decors || []) {
    const m = String(d.prompt || '').match(/^capture:([a-z-]+)/); if (!m) continue;
    const f = path.join(STUDIO, 'public', 'decors', `reel-${c.id}`, `${d.id}.jpg`);
    try { await captureSite(m[1], f); console.log(`[${id}] capture du site « ${m[1]} »`); } catch (err) { console.error(`[${id}] capture ${m[1]} impossible : ${err.message}`); }
  }
  if (process.env.GEMINI_API_KEY) spawnSync('node', [path.join(STUDIO, 'scripts', 'decors.mjs'), fd], { cwd: STUDIO, env, stdio: 'inherit' });
  // Sans Gemini (crédit épuisé) : tout le stock d'images déjà générées, jamais une image prise dans les 40 derniers plans
  // (avant : toujours les 6 mêmes photos, d'un reel à l'autre — remarque du directeur 13/11/2026).
  const fu = path.join(ROOT, 'contenus', 'decors-utilises.json');
  const utilises = existsSync(fu) ? JSON.parse(readFileSync(fu, 'utf8')) : [];
  const stock = [];
  const fouille = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) fouille(p); else if (/\.jpg$/.test(e.name) && !/couv|carrousel|logo/.test(p)) stock.push(path.relative(path.join(STUDIO, 'public'), p)); } };
  fouille(path.join(STUDIO, 'public', 'decors'));
  const libres = stock.filter((x) => !utilises.slice(-40).includes(x) && !x.includes(`reel-${c.id}/`)).sort(() => Math.random() - 0.5);
  c.extra.plans.forEach((pl, i) => {
    if (existsSync(path.join(STUDIO, 'public', pl.photo))) return;
    pl.photo = libres[i % Math.max(1, libres.length)] || 'decors/da/danse.jpg';
    console.error(`[${id}] photo ${i + 1} manquante : ${pl.photo} (stock, pas encore utilisée récemment).`);
  });
  writeFileSync(fu, JSON.stringify([...utilises, ...c.extra.plans.map((pl) => pl.photo)].slice(-200)) + '\n');
  await writeFile(fichier, JSON.stringify(c, null, 2) + '\n');
  return { fichier, ...c };
}

// Les 3 soirées vedettes d'un carrousel : meilleur potentiel de buzz parmi celles dont l'organisateur a un compte
// Instagram certain. Elles sont en couverture ET leurs organisateurs sont invités en collaboration.
function vedettes(soirees) {
  return [...soirees].filter((e) => comptesConfirmes(e).length).sort((a, b) => potentiel(b) - potentiel(a)).slice(0, 3);
}
// Potentiel de clics d'une soirée : buzz estimé (tête d'affiche, lieu, événement unique…) et audience des comptes
// Instagram liés (organisateur, lieu, artistes) — un compte suivi par 30 000 personnes qui partage le post en
// collaboration, c'est autant de vues en plus.
function potentiel(e) {
  const aud = Math.max(0, ...comptesConfirmes(e).map(abonnesDe)); // comptes vérifiés seulement
  return 0.6 * (e.buzz ?? 0.5) + 0.4 * Math.min(1, Math.log10(1 + aud) / 5); // 100 000 abonnés = audience maximale
}
// Comptes à inviter en collaboration : tous les comptes liés aux soirées du carrousel, du plus suivi au moins suivi
// (la vérification garde ensuite les 3 premiers comptes confirmés).
function comptesCollab(soirees) {
  const tous = [...new Set(soirees.flatMap((e) => comptesConfirmes(e)))]; // jamais un pseudo deviné
  return tous.sort((a, b) => abonnesDe(b) - abonnesDe(a)).slice(0, 8);
}

// --- Jours de fête : posts spéciaux bonus (hors calendrier) ------------------------------------
function feteDue(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', month: '2-digit', day: '2-digit', hour: 'numeric', hourCycle: 'h23', year: 'numeric' }).formatToParts(now).map((x) => [x.type, x.value]));
  const jour = `${parts.month}-${parts.day}`;
  const f = (config.fetes?.liste || []).find((x) => x.date === jour);
  if (!f || config.fetes?.actif === false) return null;
  if (+parts.hour < (f.heure ?? 12) || +parts.hour > 22) return null;
  if (hist.some((h) => h.fete === `${f.id}-${parts.year}`)) return null; // déjà fait cette année
  return f;
}

// Photo de la fête : générée une fois par Gemini dans le style de la DA (puis gardée), sinon une photo de la banque.
async function photoFete(f) {
  const STUDIO = path.join(ROOT, 'studio');
  const rel = `decors/fetes/${f.id}.jpg`;
  if (!existsSync(path.join(STUDIO, 'public', rel)) && process.env.GEMINI_API_KEY) {
    const da = JSON.parse(await readFile(path.join(STUDIO, 'scripts', 'decors', 'da.json'), 'utf8'));
    const def = path.join(ROOT, 'out', `fete-${f.id}.json`);
    await mkdir(path.dirname(def), { recursive: true });
    await writeFile(def, JSON.stringify({ concept: 'fetes', style: da.style, decors: [{ id: f.id, format: '4:5', prompt: f.photo }] }));
    spawnSync('node', [path.join(STUDIO, 'scripts', 'decors.mjs'), def], { cwd: STUDIO, stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
  }
  return existsSync(path.join(STUDIO, 'public', rel)) ? rel : 'decors/da/danse.jpg';
}

// --- Stories du jour (sans IA) ------------------------------------------------------------------------------
async function storyStill(props, fichier) {
  props = (await import('./captions.mjs')).sansEmoji(props); // aucun emoji dans les visuels (directeur, 19/11/2026)
  const STUDIO = path.join(ROOT, 'studio');
  if (!existsSync(path.join(STUDIO, 'node_modules'))) spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: STUDIO, stdio: 'inherit' });
  const B = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
  const r = spawnSync(path.join(STUDIO, 'node_modules', '.bin', 'remotion'), ['still', 'src/index.ts', 'story', fichier, `--props=${JSON.stringify(props)}`, '--image-format=jpeg', '--jpeg-quality=92', '--log=error', ...(existsSync(B) ? [`--browser-executable=${B}`] : [])], { cwd: STUDIO, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('story non conforme au contrôle visuel');
  return fichier;
}
function versStudio(fichier) { const rel = path.join('evenements', 'auto', path.basename(fichier)); mkdirSync(path.join(ROOT, 'studio', 'public', 'evenements', 'auto'), { recursive: true }); copyFileSync(fichier, path.join(ROOT, 'studio', 'public', rel)); return rel; }

async function storiesPreparer(S) {
  const histo = existsSync(path.join(ROOT, S.FICHIER_HISTO)) ? JSON.parse(readFileSync(path.join(ROOT, S.FICHIER_HISTO), 'utf8')) : [];
  const dues = S.storiesDues(NOW, histo);
  const dir = path.join(MEDIA_DIR, 'stories');
  await mkdir(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (/^\d{4}-\d{2}-\d{2}/.test(f) && f.slice(0, 10) < S.jourParis(new Date(NOW - 3 * 864e5))) rmSync(path.join(dir, f), { force: true });
  const { fautesTexte } = await import('./controle-texte.mjs');
  const { afficheFiable, tailleJpeg } = await import('./site.mjs');
  const { createHash } = await import('node:crypto');
  const { heure } = await import('./dates.mjs');
  const evts = (await import('./recherche.mjs')).lireCache().evenements || [];
  // Affiche vérifiée, déjà téléchargée nette par le site (même règle que les carrousels).
  const affiche = (e) => { if (!e.image || !afficheFiable(e)) return ''; const f = path.join(ROOT, 'site', 'affiches', `${createHash('sha1').update(String(e.image)).digest('hex').slice(0, 12)}.jpg`); if (!existsSync(f)) return ''; const d = tailleJpeg(f); return d && Math.max(d[0], d[1]) < 420 ? '' : f; }; // trop petite = floue en story
  const jour = S.jourParis(NOW), plan = [];
  const lieuDe = (e) => [e.venue, e.city && !String(e.venue || '').toLowerCase().includes(String(e.city).toLowerCase()) ? e.city : ''].filter(Boolean).join(', ');
  const cadre = async (props, nom) => { for (const t of [props.rubrique, props.texte]) { const f = fautesTexte(t); if (f.length) throw new Error(`texte refusé (${f.join(', ')}) : « ${t} »`); } return path.basename(await storyStill(props, path.join(dir, `${jour}-${nom}.jpg`))); };
  const question = async (cle) => {
    const q = S.questionDuJour(NOW.getTime(), histo, { postes: hist.map((h) => h.debat).filter(Boolean) });
    if (!q) return null;
    const carte = await couvertureDA(q.debat ? { photo: photoDA(['rire', 'selfie', 'danse', 'terrasse'], NOW), fond: 'nuit', rubrique: 'Débat', titre: q.q, options: [q.a, q.b] } : { photo: photoDA(['rire', 'selfie', 'danse', 'terrasse'], NOW), rubrique: 'Question', titre: q.q }, path.join(dir, `${jour}-${cle}-carte.jpg`));
    return { cles: [q.cle], frames: [{ image: await cadre({ image: versStudio(carte), rubrique: 'Ton avis', texte: q.debat ? 'A ou B ? Réponds en message' : 'Réponds en message' }, cle) }] };
  };
  for (const s of dues) {
    let r = null;
    try {
      if (s.fichiers) {
        // Story prête : fichiers déjà faits (contenus/stories-pretes.json), seulement dans media/ (jamais un chemin hors du dépôt).
        r = { cles: [s.type], frames: [] };
        for (const [i, f] of s.fichiers.entries()) {
          const srcF = path.resolve(ROOT, f);
          if (!srcF.startsWith(path.join(ROOT, 'media') + path.sep) || !existsSync(srcF)) { console.error(`Story prête introuvable : ${f}`); continue; }
          const nom = `${jour}-${s.type}-${i + 1}.jpg`; copyFileSync(srcF, path.join(dir, nom)); r.frames.push({ image: nom });
        }
      } else if (s.type === 'soirees') {
        const x = S.soireesDuSoir(evts, NOW.getTime(), { potentiel, afficheOk: (e) => !!affiche(e) });
        if (x) r = { cles: x.soirees.map((e) => e.name), frames: [] };
        // Une affiche refusée (trop petite, texte trop long) n'emporte plus toute la story (20/11/2026 : une affiche de
        // 155×200 px a privé la story de ses 15 soirées) : on l'écarte et on garde les autres.
        for (const [i, e] of (x?.soirees || []).entries()) {
          try { r.frames.push({ image: await cadre({ image: versStudio(affiche(e)), entier: true, rubrique: `${x.quand} · ${heure(e.start)}`, texte: `${e.name} · ${lieuDe(e)}` }, `soirees-${i}`) }); }
          catch (err) { r.cles = r.cles.filter((c) => c !== e.name); r.erreur = err.message; console.error(`Story soirees : « ${e.name} » écartée (${err.message})`); }
        }
      } else if (s.type === 'offre') {
        const o = S.offreDuJour(config, NOW.getTime(), histo);
        if (o) {
          const carte = await couvertureDA({ photo: photoDA(['terrasse', 'rooftop', 'rire'], NOW), rubrique: 'Avantage Teufy', titre: o.titre, sous: [o.partenaire, o.ville, o.conditions].filter(Boolean).join(' · ') }, path.join(dir, `${jour}-offre-carte.jpg`));
          r = { cles: [o.cle], frames: [{ image: await cadre({ image: versStudio(carte), rubrique: 'Bon plan', texte: o.code ? `Code ${o.code} sur la billetterie` : 'Montre cette story sur place' }, 'offre') }] };
        }
      } else if (s.type === 'repost') {
        const ig = igConfig();
        const medias = ig ? await compteMedia(ig, 50, 'media_url,like_count,comments_count') : [];
        const x = S.repostDuJour(hist, medias, NOW.getTime(), histo);
        // La vidéo est copiée chez nous (21/11/2026 : le lien temporaire d'Instagram expirait et l'envoi échouait, erreur 2207076).
        let local = '';
        if (x) { try { const rep = await fetch(x.url, { signal: AbortSignal.timeout(60000) }); const b = Buffer.from(await rep.arrayBuffer()); if (rep.ok && b.length > 50000 && /video|octet/.test(rep.headers.get('content-type') || 'video')) { local = `${jour}-repost.mp4`; writeFileSync(path.join(dir, local), b); } } catch (err) { console.error(`Story repost : vidéo non téléchargée (${err.message})`); } }
        r = x && local ? { cles: [x.cle], frames: [{ video: local, local: true }] } : await question('repost'); // rien à reposter (ou vidéo introuvable) : une question
      } else if (s.type === 'question') {
        r = await question('question');
      } else if (s.type === 'videos') {
        const mail = config.site?.email || 'teufy.app@gmail.com';
        const carte = await couvertureDA({ photo: photoDA(['foule', 'danse', 'lasers', 'selfie'], NOW), rubrique: 'Ta vidéo', titre: 'Ta meilleure vidéo de soirée ?', sous: `Envoie-la en WeTransfer à ${mail} : on la reposte en te créditant` }, path.join(dir, `${jour}-videos-carte.jpg`));
        r = { cles: [`v-${jour}`], frames: [{ image: await cadre({ image: versStudio(carte), rubrique: 'Qualité originale', texte: 'WeTransfer, en HD : ta soirée sur Teufy' }, 'videos') }] };
      } else if (s.type === 'astuce') {
        const a = S.astuceDuJour(NOW.getTime(), histo);
        if (a) {
          const carte = await couvertureDA({ photo: photoDA(['rire', 'terrasse', 'foule', 'rooftop'], NOW), rubrique: 'Astuce', titre: a.titre, sous: a.sous }, path.join(dir, `${jour}-astuce-carte.jpg`));
          r = { cles: [a.cle], frames: [{ image: await cadre({ image: versStudio(carte), rubrique: 'Le bon réflexe', texte: 'Envoie-la à ton pote qui en a besoin' }, 'astuce') }] };
        }
      } else if (s.type === 'coeur') {
        const montrees = new Set([...histo.filter((h) => h.type === 'soirees' && Date.parse(h.le) > NOW - 3 * 864e5).flatMap((h) => h.cles || []), ...plan.filter((p) => p.type === 'soirees').flatMap((p) => p.cles)]);
        const x = S.coupDeCoeur(evts.filter((e) => !montrees.has(e.name)), NOW.getTime(), histo, { potentiel, afficheOk: (e) => !!affiche(e), comptes: comptesConfirmes });
        if (x) r = { cles: [x.cle], frames: [{ image: await cadre({ image: versStudio(affiche(x.soiree)), entier: true, rubrique: `Coup de cœur · ${S.quandTexte(x.soiree.start)}`, texte: `${x.soiree.name} · @${x.compte}` }, 'coeur') }] };
      }
    } catch (err) { console.error(`Story ${s.type} : ${err.message}`); r = { cles: [], frames: [], erreur: err.message }; }
    // Panne (rendu, API, quota) : notée, pour que la story soit reprise au passage suivant au lieu d'être notée « vide ».
    plan.push({ type: s.type, cles: r?.cles || [], frames: r?.frames || [], ...(r?.erreur && !r.frames?.length ? { erreur: String(r.erreur).slice(0, 200) } : {}) });
    console.log(`Story ${s.type} : ${r?.frames?.length || 0} image(s)${r?.cles?.length ? ` (${r.cles.join(', ')})` : ''}`);
  }
  await writeFile(path.join(dir, 'plan.json'), JSON.stringify({ jour, plan }, null, 2));
}

async function storiesPublier(S) {
  const f = path.join(MEDIA_DIR, 'stories', 'plan.json');
  if (!existsSync(f)) return console.log('Stories : rien de préparé.');
  const { jour, plan } = JSON.parse(await readFile(f, 'utf8'));
  // Plan d'un autre jour (préparation du jour en échec) : jamais publié (« Ce soir » d'hier montré aujourd'hui).
  if (jour !== S.jourParis(NOW)) { console.error(`::warning::Stories : le plan préparé date du ${jour}, pas d'aujourd'hui : rien n'est publié.`); return; }
  const ig = igConfig();
  const fh = path.join(ROOT, S.FICHIER_HISTO);
  const histo = existsSync(fh) ? JSON.parse(readFileSync(fh, 'utf8')) : [];
  let base = MEDIA_BASE;
  const url = (n) => `${base}/stories/${n}`;
  const images = plan.flatMap((p) => p.frames.filter((x) => x.image).map((x) => url(x.image)));
  if (images.length && !DRY && ig && !(await waitOnline(images, 4 * 60e3))) { // sinon l'adresse de secours GitHub, en ligne dès l'envoi
    const fb = process.env.MEDIA_FALLBACK_URL;
    if (!fb) throw new Error('Stories : fichiers pas en ligne.');
    base = fb.replace(/\/$/, '');
    if (!(await waitOnline(plan.flatMap((p) => p.frames.filter((x) => x.image || x.local).map((x) => url(x.image || x.video))), 3 * 60e3))) throw new Error('Stories : fichiers introuvables.');
  }
  // Auto-contrôle (19/11/2026) : une story n'est notée « faite » que si TOUTES ses images sont en ligne ; sinon le passage
  // suivant republie seulement celles qui manquent (avant, une story ratée était notée faite et jamais refaite).
  const { storiesEnLigne } = await import('./instagram.mjs');
  for (const p of plan) {
    const deja = histo.find((x) => x.jour === jour && x.type === p.type);
    if (S.storyFaite(deja)) continue;
    // Story sans aucune image : notée « vide », jamais « faite ». Vide à cause d'une panne (`erreur`) : reprise au passage
    // suivant tant que sa fenêtre est ouverte ; vide faute de contenu conforme : rien d'autre à faire aujourd'hui.
    if (!p.frames?.length) {
      if (!DRY && ig) { if (deja) Object.assign(deja, { erreur: p.erreur || undefined, le: new Date().toISOString() }); else histo.push({ jour, type: p.type, vide: true, ids: [], ...(p.erreur ? { erreur: p.erreur } : {}), le: new Date().toISOString() }); }
      console.error(p.erreur ? `::warning::Story ${p.type} : panne (${p.erreur}), reprise au prochain passage.` : `Story ${p.type} : aucune image conforme, pas publiée aujourd'hui.`);
      continue;
    }
    if (deja?.vide) { delete deja.vide; delete deja.erreur; deja.cles = p.cles; } // story reprise après une panne
    const entree = deja || { jour, type: p.type, cles: p.cles, ids: [], faites: [] };
    entree.faites ||= entree.ids.map((_, k) => k); // anciennes entrées : tout ce qui a un id
    for (const [k, fr] of p.frames.entries()) {
      if (entree.faites.includes(k)) continue;
      if (DRY || !ig) { console.log(`Story ${p.type} (aperçu) : ${fr.image || fr.video}`); continue; }
      try { const st = await publishStory(fr.image ? url(fr.image) : fr.local ? url(fr.video) : fr.video, ig, { video: !!fr.video }); entree.ids.push(st.id); entree.faites.push(k); console.log(`✅ story ${p.type} publiée (${st.id})`); }
      catch (err) { console.error(`Story ${p.type} impossible : ${err.message}`); }
    }
    if (DRY || !ig) continue;
    // Relecture sur Instagram : une story acceptée par l'API mais absente des stories en ligne n'est jamais dite « en ligne »
    // (avant le 20/11/2026 : erreur affichée puis « ✅ vérifiée » juste après). Un second essai laisse à Instagram le temps.
    let enLigne = await storiesEnLigne(ig);
    if (enLigne && entree.ids.some((sid) => !enLigne.includes(sid))) { await new Promise((ok) => setTimeout(ok, 20e3)); enLigne = await storiesEnLigne(ig); }
    entree.relue = !!enLigne;
    entree.absentes = enLigne ? entree.ids.filter((sid) => !enLigne.includes(sid)) : [];
    for (const sid of entree.absentes) console.error(`::error::Story ${p.type} ${sid} : publiée selon l'API mais absente des stories en ligne.`);
    entree.manquantes = p.frames.map((_, k) => k).filter((k) => !entree.faites.includes(k));
    if (entree.manquantes.length) console.error(`::error::Story ${p.type} : ${entree.manquantes.length} image(s) pas publiée(s), nouvel essai au prochain passage.`);
    else if (!enLigne) console.error(`::warning::Story ${p.type} : ${entree.ids.length} image(s) acceptée(s) par l'API, liste des stories illisible : pas relue.`);
    else if (!entree.absentes.length) console.log(`✅ story ${p.type} vérifiée : ${entree.ids.length} image(s) en ligne.`);
    entree.le = new Date().toISOString();
    if (!deja) histo.push(entree);
  }
  await writeFile(fh, JSON.stringify(histo.slice(-400), null, 1) + '\n');
}
