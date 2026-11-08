#!/usr/bin/env node
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
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectEvents, filterEvents, enrich } from './sources.mjs';
import { windowFor, rolling, isoLocal, plage, slotOfDay, daysOfMonth } from './dates.mjs';
import { isTechno } from './genres.mjs';
import { captionIncontournables, captionBonPlan, captionDebat, captionReel, captionOrgas, captionExplicatif, rng } from './captions.mjs';
import { igConfig, publishCarousel, publishSingle, publishReel, publishStory, permalink, insights, followers, businessDiscovery, compteMedia } from './instagram.mjs';
import { TENDANCES, analyserComptes } from './tendances.mjs';
import { buildModel, chooser, selectBest, eventFeatures, collect, hash } from './learn.mjs';
import { theme } from './theme.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
const val = (n) => flag(n)?.split('=').slice(1).join('=');
const [cible = 'auto', etape = 'tout'] = args.filter((a) => !a.startsWith('--'));
const DRY = !!flag('dry-run') || process.env.DRY_RUN === 'true' || cible === 'mois';
const NOW = val('now') ? new Date(val('now')) : new Date();
const MEDIA_DIR = path.join(ROOT, 'media');
const MEDIA_BASE = (process.env.MEDIA_BASE_URL || 'https://junior63122.github.io/teufy-instagram/media').replace(/\/$/, '');
const HIST_FILE = path.join(ROOT, 'historique.json');

const config = JSON.parse(await readFile(path.join(ROOT, 'config.json'), 'utf8'));
const R = config.reglages;
const hist = existsSync(HIST_FILE) ? JSON.parse(await readFile(HIST_FILE, 'utf8')) : [];
const usedHere = new Set(); // débats / bons plans déjà pris dans ce lancement (aperçu du mois)
const MODEL = buildModel();
const CRENEAUX = (R.creneaux_utc || [15, 16, 17, 18, 19]).map(String);
// Heure de publication du jour (UTC), choisie selon ce qui a le mieux marché.
const creneauDuJour = (d) => chooser(MODEL, rng(`${slotOfDay(d).date}-creneau`)).pick('creneau', CRENEAUX, (x) => x);

// --- Quelle(s) publication(s) ? --------------------------------------------

const slotFor = (d) => { const s = slotOfDay(d); return config.calendrier.find((c) => c.jour === s.jour && c.rang === s.rang); };
const slotId = (s) => [s.type, s.variante].filter(Boolean).join('-');

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
  // Analyse hebdomadaire par IA gratuite (veille Meta, pourquoi, nouveaux tests), une fois par semaine.
  const derniere = TENDANCES.derniere_analyse ? new Date(TENDANCES.derniere_analyse) : null;
  if (flag('cerveau') || !derniere || (NOW - derniere) / 86400e3 >= 6.5) {
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
  process.exit(0);
}
if (cible === 'auto') {
  const s = slotFor(NOW);
  if (flag('quoi')) {
    let rep = s ? slotId(s) : 'rien';
    // Pause : la nouvelle direction artistique doit être validée avant toute publication automatique.
    if (R.pause_publication) { console.error(`Publications automatiques en pause : ${R.pause_publication}`); rep = 'rien'; }
    if (s?.type === 'reel' && config.studio?.reels_en_pause) { console.error(`Reels en pause : ${config.studio.reels_en_pause}`); rep = 'rien'; }
    if (s && hist.some((h) => h.id === slotId(s) && h.date === slotOfDay(NOW).date)) rep = 'rien'; // déjà publié aujourd'hui
    else if (s && flag('horaire')) {
      const choisi = +creneauDuJour(NOW);
      if (NOW.getUTCHours() < choisi) { console.error(`Publication prévue vers ${choisi}h UTC.`); rep = 'rien'; }
    }
    await output('slot', rep === 'rien' ? '' : rep);
    console.log(rep);
    process.exit(0);
  }
  if (!s) { console.log(`Rien de prévu le ${slotOfDay(NOW).date} dans le calendrier.`); process.exit(0); }
  jobs = [{ slot: s, now: NOW }];
} else if (cible === 'mois') {
  jobs = daysOfMonth(NOW).map((d) => ({ slot: slotFor(d), now: d })).filter((j) => j.slot);
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
    console.log('Sources :');
    for (const r of cache.report) console.log(`  ${r.source.padEnd(8)} ${r.erreur ? '✗ ' + r.erreur : `${r.evenements} événement(s)`}  ${r.url || ''}`);
    console.log(`  → ${cache.events.length} événement(s) uniques au total`);
  }
  return cache.events;
}

if (cible === 'mois') await rm(MEDIA_DIR, { recursive: true, force: true });
const echecs = [];
for (const j of jobs) {
  const id = cible === 'mois' ? `${isoLocal(j.now)}-${slotId(j.slot)}` : slotId(j.slot);
  try {
    if (etape === 'preparer' || etape === 'tout') await prepare(j.slot, j.now, id);
    if (etape === 'publier' || etape === 'tout') await publishPrepared(id);
  } catch (err) {
    console.error(`[${id}] ✗ ${err.message}`);
    echecs.push(id);
  }
}
if (echecs.length) die(`Échec : ${echecs.join(', ')}`);

// --- Préparation ------------------------------------------------------------

async function prepare(slot, now, id) {
  const { renderPages, carouselPages, reelPages, debatPage, bonPlanManuelPage, afficheProgramme } = await import('./render.mjs');
  const { photoSource } = await import('./photos.mjs');
  const dir = path.join(MEDIA_DIR, id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const stamp = isoLocal(now);
  const seed = `${stamp}-${id}`;
  const r = rng(seed);
  const ch = chooser(MODEL, r);
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
    return list.filter((e) => e.source !== 'web' || (!e.douteux && (e.verifie || (e.confiance ?? 0) >= 0.85))).filter(pred);
  };
  const best = (list, n) => selectBest(list, n, MODEL, r);
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
  if (slot.type === 'veille') {
    // Veille : un post unique tout de suite si une annonce exceptionnelle et vérifiée vient de tomber.
    const { veiller } = await import('./veille.mjs');
    const ig = igConfig();
    const v = await veiller({ config, now, ig, api: ig ? { businessDiscovery } : {}, dryRun: DRY });
    if (R.pause_publication) v.apublier = null; // pause : la veille note les sujets mais ne publie pas
    if (!v.apublier) { await output('rien', 'true'); console.log('Veille : rien à publier tout de suite.'); return; }
    const s = v.apublier;
    const STUDIO = path.join(ROOT, 'studio');
    let image;
    if (/^https?:/.test(s.image || '')) {
      const res = await fetch(s.image).catch(() => null);
      if (res?.ok) { image = `evenements/auto/flash-${hash(s.titre)}.jpg`; await mkdir(path.join(STUDIO, 'public', 'evenements', 'auto'), { recursive: true }); await writeFile(path.join(STUDIO, 'public', image), Buffer.from(await res.arrayBuffer())); }
    }
    const jourH = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(s.date_publication)).toUpperCase();
    const domaine = (() => { try { return new URL(s.source_url).hostname.replace(/^www\./, ''); } catch { return s.source_url; } })();
    const f = { type: s.type, surtitre: s.post.surtitre.toUpperCase().slice(0, 22), titre: s.post.titre, sous_titre: s.post.sous_titre, faits: s.post.faits.slice(0, 4), source: s.comptes_instagram?.[0] ? `@${s.comptes_instagram[0]} · ${domaine}` : domaine, date: jourH, image };
    if (!existsSync(path.join(STUDIO, 'node_modules'))) spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: STUDIO, stdio: 'inherit' });
    const fichier = path.join(dir, `flash-${stamp}.jpg`);
    const B = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
    const rr = spawnSync(path.join(STUDIO, 'node_modules', '.bin', 'remotion'), ['still', 'src/index.ts', 'flash', fichier, `--props=${JSON.stringify({ f })}`, '--image-format=jpeg', '--jpeg-quality=92', '--log=error', ...(existsSync(B) ? [`--browser-executable=${B}`] : [])], { cwd: STUDIO, stdio: 'inherit' });
    if (rr.status !== 0) throw new Error('Rendu du post de veille impossible');
    pub = { images: [fichier], legende: s.post.legende, titre: s.post.titre, veille: { titre: s.titre, source: s.source_url, importance: s.importance }, tags: [(s.comptes_instagram || []).map((h) => h.replace(/^@/, '')).slice(0, 5)] };
    console.log(`[${id}] post de veille : « ${s.post.titre} » (${s.importance}/100, ${s.source_url})`);
  } else if (format === 'orgas') {
    const th = theme(now, 'club');
    const nouvelAn = th.tempsFort?.titre?.includes('Nouvel An');
    const quand = nouvelAn ? 'pour le Nouvel An' : 'ce week-end';
    const photos = await photoSource({ univers: 'club', saison: th.saison, fetes: !!th.tempsFort?.fetes, ch, r });
    const files = [await couvertureDA({ photo: photoDA(['dj', 'foule', 'danse'], now), rubrique: 'Organisateurs', titre: `Tu organises une soirée ${quand} ? [Poste-la ici]`, sous: `Mets le lien en commentaire avec ${th.hashtag}` }, path.join(dir, `orgas-${stamp}.jpg`))];
    pub = { images: files, legende: captionOrgas({ quand, ch, r }), format: 'orgas' };
  } else if (slot.type === 'debat') {
    const used = new Set([...hist.map((h) => h.debat).filter(Boolean), ...usedHere]);
    const all = JSON.parse(await readFile(path.join(ROOT, 'contenus', 'debats.json'), 'utf8'));
    let pool = all.filter((d) => !used.has(d.id));
    if (!pool.length) pool = all; // tout a été utilisé : on recommence
    const debat = ch.pick('debat', pool, (d) => d.id);
    usedHere.add(debat.id);
    const files = [await couvertureDA({ photo: photoDA(['lasers', 'rooftop', 'foule', 'terrasse', 'rire'], now), fond: 'nuit', rubrique: 'Débat', titre: debat.q, options: [debat.a, debat.b] }, path.join(dir, `debat-${stamp}.jpg`))];
    pub = { images: files, legende: captionDebat({ debat, ch, r }), debat: debat.id };
  } else if (slot.type === 'bonplan') {
    const manuel = await bonPlanManuel(now);
    if (manuel) {
      usedHere.add(manuel.titre);
      const files = [await couvertureDA({ fond: 'creme', rubrique: 'Bon plan', titre: manuel.titre, sous: String(manuel.texte).split(/(?<=[.!?])\s/)[0] }, path.join(dir, `bonplan-${stamp}.jpg`))];
      pub = { images: files, legende: captionBonPlan({ manuel, ch, r }), bonplan: manuel.titre };
    } else {
      let variante = slot.variante;
      let win = rolling(now, 0, 10);
      let list = variante === 'petits-prix' ? await pickEv(win, cheap) : [];
      if (list.length < 3) { variante = 'a-reserver'; win = rolling(now, 7, 45); list = await pickEv(win); }
      if (list.length < 3) { win = rolling(now, 2, 45); list = await pickEv(win); }
      need(list, 2);
      const chosen = chrono(best(list, R.soirees_par_carrousel));
      const reserve = variante === 'a-reserver';
      const files = await carrouselDA({ chosen, id, dir, now, rubrique: 'Bon plan', question: reserve ? 'Tu prends [laquelle] ?' : 'Tu fais [laquelle] ?',
        titreFlash: reserve ? 'À réserver avant le [sold out]' : `Sortir à moins de [${R.petit_prix_max} €]`, titre: ['', reserve ? 'les grosses dates' : 'sans se ruiner'] });
      pub = { images: files, legende: captionBonPlan({ variante, events: chosen, ...win, ch, r }), soirees: chosen };
    }
  } else if (slot.type === 'incontournables') {
    const techno = slot.variante === 'techno';
    const pred = techno ? isTechno : (e) => !isTechno(e);
    let win = windowFor([1, 2, 3, 4, 5, 6, 7], now);
    win.from = new Date(Math.max(win.from.getTime(), now.getTime() - 6 * 3600e3));
    let list = await pickEv(win, pred);
    let elargi = false;
    const avecAffiche = (l) => l.filter((e) => e.image).length;
    if (avecAffiche(list) < 4) { win = rolling(now, 0, 14); list = await pickEv(win, pred); elargi = true; }
    // Trop peu de dates de ce genre : on prend toutes les soirées plutôt qu'un carrousel maigre.
    let melange = false;
    if (avecAffiche(list) < 4) { const tout = await pickEv(win); if (avecAffiche(tout) > avecAffiche(list)) { list = tout; melange = true; } }
    need(list, 3);
    const chosen = chrono(best(list, R.soirees_par_carrousel));
    const { th, photos } = await visuel(techno ? 'techno' : 'club');
    const fort = !techno && th.tempsFort?.titre;
    const enTechno = techno && !melange; // carrousel élargi à tous les genres : on ne l'annonce plus comme « techno »
    const titre = enTechno
      ? ch.pick('titre-techno', ['Les événements techno', 'Les dates techno à ne pas manquer'])
      : fort || ch.pick('titre-commercial', ['Nos événements coups de cœur de la semaine', 'Les soirées à ne pas manquer', 'Nos coups de cœur de la semaine']);
    const pages = carouselPages({ mise: ch.pick('mise-couverture', ['centre', 'bas'], (x) => x),
      th, photos, events: chosen, titre,
      sous: fort ? `En ${MOIS(now)}` : elargi ? 'Ces prochains jours' : 'Cette semaine',
      fin: techno
        ? { texte: 'On se voit sur le dancefloor.\nTu seras à laquelle ?', pied: `Abonne-toi à ${config.compte} 👇` }
        : { texte: 'Tu sors où cette semaine ?\nDis-le en commentaire.', pied: `Abonne-toi à ${config.compte} 👇` },
    });
    let files = null;
    // Carrousel du studio (affiches officielles, DA éditoriale) ; repli sur l'ancien gabarit si impossible.
    files = await carrouselDA({ chosen, id, dir, now, titre: [titre, fort ? `en ${MOIS(now)}` : elargi ? 'ces prochains jours' : 'cette semaine'] });
    if (!files) throw new Error('Carrousel de la DA impossible (studio absent ou moins de 2 affiches) : rien n\'est publié.');
    files ||= await renderPages(programme(pages, chosen, { th, photos, titre, sous: fort ? `En ${MOIS(now)}` : elargi ? 'Ces prochains jours' : 'Cette semaine' }), dir, `incontournables-${stamp}`, { width: 1080, height: 1350 });
    pub = { images: files, legende: captionIncontournables({ variante: enTechno || !techno ? slot.variante : 'commercial', events: chosen, ...win, ch, r }), soirees: chosen, titre };
  } else if (slot.type === 'reel' && config.studio?.actif && ['flash', 'histoire', 'nouveau', 'explicatif', 'humour', 'immersif'].includes(slot.variante)) {
    // Reels = créations du studio (Remotion) : explicatif, humour ou immersif, jamais un catalogue de soirées.
    const STUDIO = path.join(ROOT, 'studio');
    const dirC = path.join(STUDIO, 'scripts', 'concepts');
    const tous = await Promise.all((await readdir(dirC)).filter((f) => f.endsWith('.json')).map(async (f) => ({fichier: path.join(dirC, f), ...JSON.parse(await readFile(path.join(dirC, f), 'utf8'))})));
    const faits = new Set([...hist.map((h) => h.concept).filter(Boolean), ...usedHere]);
    const dispo = tous.filter((c) => !faits.has(c.id));
    // reel:nouveau = forcer un reel inédit écrit par l'IA (sans passer par la banque).
    // Format validé : « Flash ». La rubrique est choisie par l'apprentissage (celle qui marche le mieux revient plus souvent).
    const rubriqueFlash = () => ch.pick('rubrique-reel', ['Explicatif', 'Astuce', 'Humour', 'Actu nuit'], (x) => x);
    let c = slot.variante === 'nouveau' ? await nouveauFlash(STUDIO, id, rubriqueFlash())
      : val('concept') ? tous.find((x) => x.id === val('concept'))
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
      const B = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
      const rc = spawnSync(path.join(STUDIO, 'node_modules', '.bin', 'remotion'), ['still', 'src/index.ts', 'couverture-reel', cover, `--props=${JSON.stringify(props)}`, '--image-format=jpeg', '--jpeg-quality=92', '--log=error', ...(existsSync(B) ? [`--browser-executable=${B}`] : [])], { cwd: STUDIO, stdio: 'inherit' });
      couvDA = rc.status === 0;
      if (!couvDA) console.error(`[${id}] couverture DA non conforme, image du reel à la place.`);
    }
    if (!couvDA) spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(c.couverture ?? 1.5), '-i', video, '-frames:v', '1', '-q:v', '2', cover]);
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
    const jourDit = (d) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long' }).format(new Date(Date.parse(d) - 6 * 3600e3));
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
        res = await monter({ th, genre: 'club', contenu: { hook: { titre: sujet.titre, sous: sujet.sous }, points: sujet.points, fin: 'enregistre pour plus tard 📌' } });
      } catch (err) {
        console.error(`[${id}] montage impossible (${err.message}), motion simple.`);
        const scenes = [...motion.scenesExplication(th, { titre: sujet.titre, sous: sujet.sous, points: sujet.points, photos }),
          motion.sceneFin(th, { compte: config.compte, photo: photos.next(), texte: 'Enregistre pour plus tard 📌' })];
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
    // Couverture : une image de l'accroche, une fois le titre affiché.
    const cover = path.join(dir, `reel-${stamp}-couverture.jpg`);
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1.2', '-i', video, '-frames:v', '1', '-q:v', '2', cover]);
    pub.couverture = cover;
    console.log(`[${id}] reel ${variante} ${res.total.toFixed(1)} s${res.grammaire ? `, montage ${res.grammaire} (${res.etalonnage})` : ''}, musique : ${res.son ? res.musique : res.musique ? path.basename(String(res.musique)) : 'aucune'}`);
  } else {
    throw new Error(`Type inconnu : ${slot.type}`);
  }

  const rel = (f) => path.basename(f);
  // Identifications par image : diapo 1 = couverture, puis une diapo par soirée (même ordre que `soirees`).
  if (pub.images && pub.soirees) {
    pub.tags = pub.images.length === 1
      ? [[...new Set(pub.soirees.flatMap((e) => e.instagram || []))].slice(0, 5)] // post unique : tous les comptes sur l'image
      : [[], ...pub.soirees.slice(0, 8).map((e) => e.instagram || [])];
  }
  const out = { id, type: slot.type, variante: slot.variante || null, date: stamp, ...pub, choix: ch.choix,
    features: (pub.soirees || []).flatMap(eventFeatures), nb_images: pub.images?.length || 0 };
  if (out.images) out.images = out.images.map(rel);
  if (out.video) { out.video = rel(out.video); out.couverture = rel(out.couverture); if (out.video_instagram) out.video_instagram = rel(out.video_instagram); }
  // Story qui relaie la publication (image : visuel 9:16 de la DA ; reel : la vidéo elle-même).
  if (out.images?.length) {
    try {
      const STUDIO = path.join(ROOT, 'studio');
      const src = path.join('evenements', 'auto', `story-${id}.jpg`);
      await mkdir(path.join(STUDIO, 'public', 'evenements', 'auto'), { recursive: true });
      await copyFile(path.join(dir, out.images[0]), path.join(STUDIO, 'public', src));
      const texte = String(out.titre || pub.titre || '').replace(/[[\]]/g, '').trim();
      const props = { image: src, rubrique: slot.type === 'veille' ? 'Info de dernière minute' : 'Nouveau post', ...(texte ? { texte: `${texte} : le post complet est sur le profil` } : {}) };
      const B = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
      const rs = spawnSync(path.join(STUDIO, 'node_modules', '.bin', 'remotion'), ['still', 'src/index.ts', 'story', path.join(dir, 'story.jpg'), `--props=${JSON.stringify(props)}`, '--image-format=jpeg', '--jpeg-quality=92', '--log=error', ...(existsSync(B) ? [`--browser-executable=${B}`] : [])], { cwd: STUDIO, stdio: 'inherit' });
      if (rs.status === 0) out.story = 'story.jpg'; else console.error(`[${id}] story non conforme : pas de story pour ce post.`);
    } catch (err) { console.error(`[${id}] story impossible : ${err.message}`); }
  } else if (out.video) out.story_video = out.video;
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
  for (const e of pool) { const d = isoLocal(new Date(Date.parse(e.start) - 6 * 3600e3)); if (!days.has(d)) { out.push(e); days.add(d); } if (out.length >= max) break; }
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
  if (hist.some((h) => h.id === id && h.date === p.date) && !process.env.FORCE) {
    console.log(`[${id}] Déjà publié le ${p.date}. (FORCE=1 pour republier)`);
    return;
  }

  let base = MEDIA_BASE;
  const url = (name) => `${base}/${id}/${name}`;
  const urls = () => (p.video ? [url(p.video), url(p.couverture), ...(p.video_instagram ? [url(p.video_instagram)] : [])] : [...p.images.map(url), ...(p.story ? [url(p.story)] : [])]);
  if (!(await waitOnline(urls(), 12 * 60e3))) {
    const fb = process.env.MEDIA_FALLBACK_URL;
    if (!fb) throw new Error(`Les fichiers ne sont pas en ligne sur ${MEDIA_BASE} après 12 min.`);
    console.log(`[${id}] GitHub Pages pas encore à jour, on utilise ${fb}`);
    base = fb.replace(/\/$/, '');
    if (!(await waitOnline(urls(), 3 * 60e3))) throw new Error(`Fichiers introuvables aussi sur ${fb}.`);
  }

  const res = p.video
    ? await publishReel(url(p.son?.audio_id && p.video_instagram ? p.video_instagram : p.video), url(p.couverture), p.legende, ig,
      { essai: !!TENDANCES.reels_essai?.actif, audio: p.son?.audio_id ? { audio_id: p.son.audio_id } : null, videoSecours: url(p.video) })
    : p.images.length === 1
      ? await publishSingle(url(p.images[0]), p.legende, ig, { tags: p.tags })
      : await publishCarousel(p.images.map(url), p.legende, ig, { tags: p.tags });
  const link = await permalink(res.id, ig);
  console.log(`[${id}] ✅ publié : ${link || res.id}`);
  // Relais en story (une erreur ici ne remet pas en cause la publication).
  if ((p.story || p.story_video) && config.stories?.actif !== false) {
    try {
      const st = await publishStory(url(p.story || p.story_video), ig, { video: !p.story });
      console.log(`[${id}] ✅ story publiée (${st.id})`);
    } catch (err) { console.error(`[${id}] story impossible : ${err.message}`); }
  }
  hist.push({ id, date: p.date, media: res.id, lien: link, debat: p.debat, bonplan: p.bonplan, sujet: p.sujet, son: p.son, concept: p.concept, le: new Date().toISOString(),
    publication: { id: p.id, type: p.type, variante: p.variante, date: p.date, choix: p.choix, features: p.features, nb_images: p.nb_images, duree: p.duree, legende: p.legende, titre: p.titre } });
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
function photoDA(noms, now) { return `decors/da/${noms[Math.floor(now / (7 * 864e5)) % noms.length]}.jpg`; }

async function couvertureDA(props, fichier) {
  const STUDIO = path.join(ROOT, 'studio');
  if (!existsSync(path.join(STUDIO, 'node_modules'))) spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: STUDIO, stdio: 'inherit' });
  const B = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
  const r = spawnSync(path.join(STUDIO, 'node_modules', '.bin', 'remotion'), ['still', 'src/index.ts', 'couverture', fichier, `--props=${JSON.stringify(props)}`, '--image-format=jpeg', '--jpeg-quality=92', '--log=error', ...(existsSync(B) ? [`--browser-executable=${B}`] : [])], { cwd: STUDIO, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('Visuel non conforme à la DA (contrôle visuel en échec) : rien n\'est publié plutôt qu\'un visuel raté.');
  return fichier;
}

async function carrouselDA({ chosen, id, dir, now, titre = [], titreFlash, rubrique, question }) {
  const STUDIO = path.join(ROOT, 'studio');
  if (!existsSync(path.join(STUDIO, 'node_modules'))) spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: STUDIO, stdio: 'inherit' });
  if (chosen.filter((e) => e.image).length < 2) throw new Error('Moins de 2 soirées avec affiche officielle : pas de carrousel.');
      const { heure } = await import('./dates.mjs');
      const { genresList } = await import('./genres.mjs');
      const jourC = (d) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(Date.parse(d) - 6 * 3600e3)).replace(/^./, (c) => c.toUpperCase());
      const avecImage = chosen.filter((e) => e.image).slice(0, 8);
      const villes = [...new Set(avecImage.map((e) => e.city).filter(Boolean))];
      const dts = avecImage.map((e) => new Date(Date.parse(e.start) - 6 * 3600e3)).sort((a, b) => a - b);
      const fmt = (d, o) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', ...o }).format(d);
      const sous = dts.length ? (fmt(dts[0], { day: 'numeric', month: 'long' }) === fmt(dts.at(-1), { day: 'numeric', month: 'long' }) ? `le ${fmt(dts[0], { weekday: 'long', day: 'numeric', month: 'long' })}`
        : `du ${fmt(dts[0], { day: 'numeric', ...(fmt(dts[0], { month: 'long' }) === fmt(dts.at(-1), { month: 'long' }) ? {} : { month: 'long' }) })} au ${fmt(dts.at(-1), { day: 'numeric', month: 'long' })}`) : '';
      const entree = { sous, titre, titreFlash, rubrique, question, lieu: (villes.length === 1 ? villes[0] : "CÔTE D'AZUR").toUpperCase(), pied: villes.slice(0, 3).map((v) => v.replace(/-du-.*$/i, '')).join(' · ').toUpperCase(),
        soirees: avecImage.map((e, i) => ({ id: `${i}-${hash(e.name)}`, nom: e.name, genre: (genresList(e).slice(0, 2).join(' & ') || 'soirée').toLowerCase(), jour: jourC(e.start), heures: `dès ${heure(e.start)}`,
          prix: e.price == null ? 'prix sur la billetterie' : e.price === 0 ? 'gratuit' : `dès ${String(Math.round(e.price * 100) / 100).replace('.', ',')} €`, lieu: [e.venue, e.city].filter(Boolean).join(' · '), image: e.image })) };
      const fe = path.join(ROOT, 'out', `carrousel-${id}.json`);
      await mkdir(path.dirname(fe), { recursive: true });
      await writeFile(fe, JSON.stringify(entree));
      const r = spawnSync('node', [path.join(ROOT, 'studio', 'scripts', 'affiches.mjs'), fe, dir], { cwd: path.join(ROOT, 'studio'), stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
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
async function nouveauFlash(STUDIO, id, rubrique) {
  const env = { ...process.env, NODE_USE_ENV_PROXY: '1' };
  if (!existsSync(path.join(STUDIO, 'node_modules'))) spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: STUDIO, stdio: 'inherit' });
  const e = spawnSync('node', [path.join(STUDIO, 'scripts', 'ecrire-flash.mjs'), rubrique], { cwd: STUDIO, env, stdio: ['ignore', 'pipe', 'inherit'] });
  const sortie = (e.stdout?.toString() || '').trim().split('\n');
  console.log(sortie.slice(0, -1).join('\n'));
  const fichier = sortie.at(-1);
  if (e.status !== 0 || !fichier || !existsSync(fichier)) throw new Error('Scénariste : aucun reel écrit.');
  const c = JSON.parse(await readFile(fichier, 'utf8'));
  if (process.env.GEMINI_API_KEY) spawnSync('node', [path.join(STUDIO, 'scripts', 'decors.mjs'), path.join(STUDIO, 'scripts', 'decors', `reel-${c.id}.json`)], { cwd: STUDIO, env, stdio: 'inherit' });
  const BANQUE = ['decors/reel-paliers/foule.jpg', 'decors/reel-paliers/potes.jpg', 'decors/reel-paliers/file.jpg', 'decors/reel-paliers/dj.jpg', 'decors/da/danse.jpg', 'decors/da/rire.jpg'];
  c.extra.plans.forEach((pl, i) => {
    if (existsSync(path.join(STUDIO, 'public', pl.photo))) return;
    pl.photo = BANQUE[i % BANQUE.length];
    console.error(`[${id}] photo ${i + 1} manquante, photo de la banque à la place.`);
  });
  await writeFile(fichier, JSON.stringify(c, null, 2) + '\n');
  return { fichier, ...c };
}
