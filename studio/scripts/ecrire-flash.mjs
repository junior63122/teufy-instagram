// Scénariste IA des reels « Flash » (le format validé : sujet utile, photo flash par scène, mots géants, objets
// qui portent l'info, voix expressive). Écrit :
//   scripts/concepts/<id>.json        concept prêt pour produire.mjs (moteur « reelflash »)
//   scripts/decors/reel-<id>.json     photos verticales à générer par decors.mjs (Gemini)
//   node scripts/ecrire-flash.mjs [rubrique]      (Explicatif | Astuce | Humour | Actu nuit)
// Dernière ligne affichée : chemin du concept.
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {json} from '../../src/llm.mjs';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(STUDIO, '..');
const lire = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
const config = lire(path.join(ROOT, 'config.json'), {});
const DIR_C = path.join(STUDIO, 'scripts', 'concepts');
const concepts = readdirSync(DIR_C).filter((f) => f.endsWith('.json')).map((f) => lire(path.join(DIR_C, f), {}));
const hist = lire(path.join(ROOT, 'historique.json'), []);
const STYLE_PHOTO = lire(path.join(STUDIO, 'scripts', 'decors', 'reel-paliers.json'), {}).style;

// Rubrique : la moins utilisée récemment (l'apprentissage peut la forcer en argument).
const RUBRIQUES = ['Explicatif', 'Astuce', 'Humour', 'Actu nuit'];
const recents = concepts.filter((c) => c.concept === 'reelflash').sort((a, b) => String(b.cree || '').localeCompare(String(a.cree || ''))).slice(0, 8).map((c) => c.rubrique);
let rubrique = RUBRIQUES.includes(process.argv[2]) ? process.argv[2] : [...RUBRIQUES].sort((a, b) => recents.filter((x) => x === a).length - recents.filter((x) => x === b).length)[0];

const idees = lire(path.join(ROOT, 'contenus', 'idees.json'), []).filter((i) => new Date(i.ajout) > new Date(Date.now() - 10 * 864e5)).sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 15);
if (rubrique === 'Actu nuit' && !idees.length) rubrique = 'Explicatif'; // pas d'actu vérifiée sous la main
const dejaFaits = [...concepts.map((c) => c.titre), ...hist.map((h) => h.titre)].filter(Boolean).slice(-80);
const tendances = lire(path.join(ROOT, 'tendances-auto.json'), {});
const accroches = (tendances.accroches || []).slice(0, 8).map((a) => (typeof a === 'string' ? a : a.texte || a.accroche || '')).filter(Boolean);
const meilleurs = hist.filter((h) => h.publication?.type === 'reel' && h.note != null).sort((a, b) => b.note - a.note).slice(0, 3).map((h) => `${h.titre} (note ${h.note}/100)`);

const SUJETS = [
  'les paliers de prix des billets (early, regular, last) et comment payer moins', 'comment passer le videur (dress code, attitude, groupe, liste)',
  'le vestiaire, les consignes, les objets perdus : les erreurs à éviter', 'rentrer en sécurité (dernier train, VTC, rester groupés, eau gratuite au bar)',
  'les types de soirées sur la Côte (club, rooftop, beach club, warehouse, open air) et à qui elles plaisent', 'pourquoi les soirées commencent si tard',
  'les codes d\'une soirée techno vs une soirée commerciale', 'organiser une sortie à plusieurs sans galère (budget, horaires, transport)',
  'les festivals de la région et quand prendre sa place', 'les phrases qu\'on dit tous en soirée vs ce qui se passe', 'le groupe de potes en soirée : les profils',
  'ce que le DJ pense de tes demandes', 'les erreurs qui coûtent cher en soirée', 'comment trouver les soirées gratuites ou pas chères',
];

const OBJET = {
  type: 'object', additionalProperties: false,
  required: ['type', 'mot', 'mot_apres', 'de', 'a', 'paliers', 'mots', 'libelle', 'titre', 'texte'],
  properties: {
    type: {type: 'string', enum: ['aucun', 'prix', 'paliers', 'jauge', 'notif'], description: 'prix : un montant barré remplacé par un autre (de → a, bascule sur mot_apres) ; paliers : 3 billets qui montent (paliers + mots, un mot par billet) ; jauge : barre qui se remplit jusqu\'à SOLD OUT (de mot à mot_apres, libelle) ; notif : notification de téléphone (titre, texte) ; aucun.'},
    mot: {type: 'string', description: 'Mot EXACT de la réplique qui fait apparaître l\'objet (ou « debut » pour la 1re scène = visible dès la 1re image).'},
    mot_apres: {type: 'string', description: 'prix : mot de la bascule ; jauge : mot où la jauge atteint 100 %. Sinon vide.'},
    de: {type: 'string', description: 'prix : montant de départ, ex. « 12 € ». Sinon vide.'},
    a: {type: 'string', description: 'prix : montant d\'arrivée. Sinon vide.'},
    paliers: {type: 'array', maxItems: 3, items: {type: 'object', additionalProperties: false, required: ['nom', 'prix'], properties: {nom: {type: 'string'}, prix: {type: 'string'}}}},
    mots: {type: 'array', maxItems: 3, items: {type: 'string'}, description: 'paliers : un mot exact de la réplique par billet.'},
    libelle: {type: 'string', description: 'jauge : légende courte, ex. « Places early vendues ».'},
    titre: {type: 'string', description: 'notif : expéditeur court.'},
    texte: {type: 'string', description: 'notif : message ≤ 45 caractères.'},
  },
};
const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['id', 'titre', 'titre_couverture', 'source', 'musique', 'scenes', 'legende'],
  properties: {
    id: {type: 'string', description: 'identifiant court en minuscules et tirets'},
    titre: {type: 'string'},
    titre_couverture: {type: 'string', description: 'Titre de la couverture (≤ 55 caractères), UN mot clé entre [crochets], ex. « Ton billet passe de 12 à [25 €] en une nuit ? ».'},
    source: {type: 'string', description: 'URL de la source officielle si actu, sinon vide.'},
    musique: {type: 'string', enum: ['trap', 'electro', 'festive', 'chill']},
    scenes: {
      type: 'array', minItems: 5, maxItems: 7,
      items: {
        type: 'object', additionalProperties: false, required: ['texte', 'photo', 'gros', 'objet', 'son', 'mot_son'],
        properties: {
          texte: {type: 'string', description: 'Réplique voix off (≤ 110 caractères), écrite pour l\'oral, avec 1 balise d\'émotion eleven_v3 au début ([excited] [shocked] [curious] [laughs] [whispers] [sighs] [surprised]) et des MAJUSCULES sur le mot à appuyer.'},
          photo: {type: 'string', description: 'Photo de la scène, en ANGLAIS : qui, où, quelle émotion (soirée, rue la nuit, club, plage, téléphone…). Pas de texte lisible, pas de logo.'},
          gros: {type: 'array', maxItems: 2, items: {type: 'object', additionalProperties: false, required: ['mot', 'texte', 'style'], properties: {
            mot: {type: 'string', description: 'mot EXACT de la réplique où le mot géant claque'},
            texte: {type: 'string', description: '2 à 4 mots, un mot entre [crochets] passe en corail'},
            style: {type: 'string', enum: ['titre', 'sticker', 'chiffre'], description: 'chiffre seulement pour un nombre court (« +7 € », « 3h »)'},
          }}},
          objet: OBJET,
          son: {type: 'string', enum: ['aucun', 'basse', 'pop', 'tampon', 'message', 'caisse', 'impact']},
          mot_son: {type: 'string', description: 'mot EXACT où tombe le bruitage'},
        },
      },
    },
    legende: {type: 'string', description: 'Légende Instagram : 1re ligne accrocheuse, l\'info utile en 3-5 lignes aérées, une question pour faire commenter, 4-6 hashtags dont #TeufyParty. Si des chiffres sont des exemples, le dire.'},
  },
};

const system = `Tu es le scénariste des reels Instagram de Teufy (@teufy_official), le guide des soirées de la Côte d'Azur, public 17-30 ans.
Format « Flash » (validé par la marque) : 20 à 28 s, 5 à 7 scènes, une photo flash par scène, une voix off française TRÈS expressive (ElevenLabs eleven_v3).
Règles :
- Le reel doit APPORTER quelque chose : une info utile, une astuce concrète, une actu expliquée, ou une situation drôle très reconnaissable. Jamais de remplissage.
- Accroche dans la 1re réplique (≤ 2 s) : un chiffre choc, une contradiction, une question qui pique. Jamais « salut » ni « dans cette vidéo ».
- Chaque scène a au moins un temps fort visuel : un mot géant (gros) ou un objet. Il doit se passer quelque chose toutes les 1 à 2 secondes.
- La 1re scène a un objet ou un mot géant visible dès la 1re image (objet.mot = « debut » pour un prix).
- Phrases courtes, rythme rapide, tutoiement, ton complice. Pas d'alcool glorifié, pas de drogue, pas de marque citée sans raison.
- Chiffres : vrais et vérifiables, ou présentés comme des exemples. Jamais de statistique, multiplicateur (« ×2 », « le double ») ou pourcentage inventé. Rien d'inventé sur une soirée ou un lieu réel.
- La dernière scène est l'appel à l'action (s'abonner, commenter un mot-clé ou taguer un pote).
- Tous les « mot », « mot_apres », « mots », « mot_son » sont des mots EXACTS de la réplique de leur scène.
- Si le titre ou l'accroche annonce un nombre d'éléments (« 3 erreurs »), le reel en donne exactement ce nombre, numérotés.
- Jamais de conseil ni de blague fondés sur le genre, l'origine, l'apparence physique ou le poids ; pas de stéréotypes ; pas de « règle » de videur présentée comme une vérité générale.
- La rubrique doit correspondre au contenu (Astuce = conseils concrets ; Explicatif = un mécanisme expliqué ; Humour = situations ; Actu nuit = une actu sourcée).`;

const prompt = `Rubrique demandée : ${rubrique}.
${idees.length ? `Actualité vérifiée de la veille (prioritaire pour « Actu nuit » et « Explicatif ») :\n${idees.map((i) => `- ${i.titre} — ${i.angle || i.resume || ''} (${i.source || 'sans source'})`).join('\n')}\n` : ''}Sujets possibles : ${SUJETS.join(' ; ')}.
${meilleurs.length ? `Nos reels les mieux notés (inspire-toi de ce qui marche) : ${meilleurs.join(' ; ')}.\n` : ''}${accroches.length ? `Accroches qui marchent chez les comptes suivis : ${accroches.join(' | ')}.\n` : ''}Déjà publiés ou en banque (ne refais pas le même sujet) :\n${dejaFaits.map((t) => `- ${t}`).join('\n') || '- aucun'}
Date : ${new Date().toISOString().slice(0, 10)}. Écris un reel selon le schéma.`;

// Écriture, puis relecture critique par l'IA (note /10) : en dessous de 7, le script est réécrit avec les remarques.
const CRITIQUE = {type: 'object', additionalProperties: false, required: ['note', 'problemes'], properties: {
  note: {type: 'number', description: 'note sur 10'}, problemes: {type: 'array', items: {type: 'string'}, description: 'problèmes précis à corriger'}}};
const relire = (script) => json({config, nom: 'relecture', gratuit: true, schema: CRITIQUE,
  system: `Tu es rédacteur en chef exigeant des reels de Teufy (soirées Côte d'Azur, 17-30 ans). Note le script sur 10 : accroche (2 premières secondes), valeur apportée (on apprend ou on rit vraiment), rythme (un temps fort toutes les 1-2 s), exactitude (nombre d'éléments annoncé = nombre donné ; TOUTE affirmation chiffrée ou présentée comme un fait — « ×2 », « le double », « 80 % », une règle générale — sans source ni mention d'exemple est une faute grave : note 5 maximum), ton (complice, inclusif, sans stéréotype de genre, d'origine ou d'apparence), cohérence rubrique/contenu, appel à l'action. Sois sévère : 7 = publiable.`,
  prompt: `Rubrique : ${rubrique}\nScript :\n${JSON.stringify({titre: script.titre, titre_couverture: script.titre_couverture, scenes: script.scenes.map((x) => ({texte: x.texte, gros: x.gros, objet: x.objet?.type})), legende: script.legende})}`});
let r = process.env.ECRIRE_REPONSE ? lire(process.env.ECRIRE_REPONSE, {}) : await json({config, system, prompt, schema: SCHEMA, nom: 'reel_flash'});
if (!process.env.ECRIRE_REPONSE && r?.scenes?.length) {
  for (let essai = 0; essai < 3; essai++) {
    let avis;
    try { avis = await relire(r); } catch (err) { console.error(`Relecture impossible : ${err.message}`); break; }
    console.error(`Relecture : ${avis.note}/10${avis.problemes?.length ? ` — ${avis.problemes.join(' ; ')}` : ''}`);
    if (avis.note >= 7) break;
    if (essai === 2) { console.error('Script refusé par la relecture : pas de reel.'); process.exit(1); }
    r = await json({config, system, schema: SCHEMA, nom: 'reel_flash', prompt: `${prompt}\n\nUne première version a été refusée par la relecture (${avis.note}/10). Problèmes à corriger : ${avis.problemes.join(' ; ')}.\nVersion refusée : ${JSON.stringify(r).slice(0, 6000)}\nRéécris un reel meilleur selon le schéma.`});
  }
}
if (!r?.scenes?.length) { console.error('Scénariste : aucune réponse exploitable.'); process.exit(1); }

// --- vérifications ---------------------------------------------------------------------
const sansTags = (s) => String(s || '').replace(/\[[^\]]*\]/g, ' ');
const norm = (s) => sansTags(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9' ]/g, ' ');
const motDans = (m, texte) => {
  const w = norm(m).trim().split(/\s+/)[0]?.replace(/^(l|d|qu|j|m|t|s|c|n)'/, '');
  return w && norm(texte).split(/\s+/).some((x) => x.replace(/^(l|d|qu|j|m|t|s|c|n)'/, '') === w) ? w : undefined;
};
let id = String(r.id || 'reel').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'reel';
while (concepts.some((c) => c.id === id) || existsSync(path.join(DIR_C, `${id}.json`))) id = `${id}-${Math.floor(Math.random() * 90 + 10)}`;
const scenes = r.scenes.slice(0, 7);
const total = scenes.map((s) => sansTags(s.texte)).join(' ').length;

const MUSIQUES = {trap: 'musique/trap.mp3', electro: 'musique/electro-dreams.mp3', festive: 'musique/odd-beats.mp3', chill: 'musique/hazy-after-hours.mp3'};
const plans = scenes.map((s, i) => {
  const gros = (s.gros || []).map((g) => ({mot: motDans(g.mot, s.texte), texte: String(g.texte).slice(0, 40), style: g.style === 'chiffre' && String(g.texte).replace(/\[|\]/g, '').length > 6 ? 'sticker' : g.style}))
    .filter((g) => g.mot).map((g, k) => ({...g, ...(k ? {y: g.style === 'sticker' ? 820 : 700} : {})}));
  const o = s.objet || {};
  let objet;
  if (o.type === 'prix' && o.de && o.a && motDans(o.mot_apres, s.texte)) objet = {type: 'prix', mot: i === 0 && o.mot === 'debut' ? 'debut' : motDans(o.mot, s.texte) || 'debut', motApres: motDans(o.mot_apres, s.texte), de: o.de, a: o.a};
  if (o.type === 'paliers' && o.paliers?.length === 3) { const mots = (o.mots || []).map((m) => motDans(m, s.texte)); if (mots.length === 3 && mots.every(Boolean)) objet = {type: 'paliers', mots, paliers: o.paliers.map((p) => ({nom: String(p.nom).toUpperCase().slice(0, 10), prix: String(p.prix).slice(0, 6)}))}; }
  if (o.type === 'jauge' && motDans(o.mot, s.texte) && motDans(o.mot_apres, s.texte)) objet = {type: 'jauge', mot: motDans(o.mot, s.texte), motFin: motDans(o.mot_apres, s.texte), libelle: String(o.libelle || '').slice(0, 30)};
  if (o.type === 'notif' && motDans(o.mot, s.texte)) objet = {type: 'notif', mot: motDans(o.mot, s.texte), titre: String(o.titre || 'Teufy').slice(0, 24), texte: String(o.texte || '').slice(0, 50)};
  // Les objets du milieu d'écran et un mot géant « chiffre » se gênent : on remonte le mot géant.
  if (objet && objet.type !== 'notif') gros.forEach((g) => { if (g.style !== 'chiffre') g.y = 250; else g.y = 300; });
  if (objet?.type === 'notif') gros.forEach((g) => { g.y = 640; }); // la notification occupe le haut de l'écran
  return {photo: `decors/reel-${id}/s${i + 1}.jpg`, gros, ...(objet ? {objet} : {}), sombre: objet ? 0.4 : 0.15};
});
const vides = plans.filter((p) => !p.gros.length && !p.objet).length;
if (vides > 1) console.warn(`Scénariste : ${vides} scène(s) sans temps fort visuel.`);

const concept = {
  id, concept: 'reelflash', type: 'explicatif', rubrique, titre: r.titre, titre_couverture: r.titre_couverture, cree: new Date().toISOString(), source: r.source || undefined,
  voix: config.studio?.voix || {voice_id: '3Tp5mYhT9wrfnry9pzvV', nom: 'Hugo', modele: 'eleven_v3', stabilite: 0.0, style: 0.85, vitesse: 1.1},
  musique: {src: MUSIQUES[r.musique] || MUSIQUES.trap, volume: 0.42, ducking: 0.3},
  queue: 1.6, whooshEntreScenes: false,
  scenes: scenes.map((s, i) => {
    const w = s.son !== 'aucun' ? motDans(s.mot_son, s.texte) : undefined;
    return {id: `s${i + 1}`, texte: s.texte, sons: w ? [{son: s.son, mot: w, volume: s.son === 'impact' ? 0.4 : 0.6}] : []};
  }),
  extra: {plans},
  legende: r.legende,
};
const decors = {concept: `reel-${id}`, qualite: 'eco', style: STYLE_PHOTO, decors: scenes.map((s, i) => ({id: `s${i + 1}`, format: '9:16', prompt: s.photo}))};
await writeFile(path.join(STUDIO, 'scripts', 'decors', `reel-${id}.json`), JSON.stringify(decors, null, 2) + '\n');
const fichier = path.join(DIR_C, `${id}.json`);
await writeFile(fichier, JSON.stringify(concept, null, 2) + '\n');
console.log(`Scénariste : « ${r.titre} » (${rubrique}, ${scenes.length} scènes, ${total} caractères de voix)`);
console.log(fichier);
