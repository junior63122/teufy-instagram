// Scénariste IA des reels « plan continu illustré » (la règle des reels Teufy).
//   node scripts/ecrire.mjs [type]            type : humour | explicatif | actu (sinon : choisi selon l'historique)
// Trouve un sujet (veille du jour, idées en banque, sujets de soirée intemporels), écrit le script voix off,
// les mondes (décors, personnages, objets animés, sons), la légende, puis écrit :
//   scripts/concepts/<id>.json   (concept prêt pour produire.mjs, moteur « histoire »)
//   scripts/decors/<id>.json     (décors à générer par decors.mjs)
// Affiche le chemin du concept sur la dernière ligne.
import {readFileSync, existsSync, readdirSync} from 'node:fs';
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

// Type : alterne humour / explicatif / actu selon ce qui a été fait récemment.
const TYPES = ['humour', 'explicatif', 'actu'];
const recents = concepts.filter((c) => c.concept === 'histoire').sort((a, b) => String(b.cree || '').localeCompare(String(a.cree || ''))).slice(0, 6).map((c) => c.type);
const type = TYPES.includes(process.argv[2]) ? process.argv[2] : [...TYPES].sort((a, b) => recents.filter((x) => x === a).length - recents.filter((x) => x === b).length)[0];

const idees = lire(path.join(ROOT, 'contenus', 'idees.json'), []).filter((i) => new Date(i.ajout) > new Date(Date.now() - 10 * 864e5)).sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 15);
const dejaFaits = [...concepts.map((c) => c.titre), ...hist.map((h) => h.titre)].filter(Boolean).slice(-80);

const INTEMPORELS = [
  'les types de personnes en soirée (videur, pote bourré, couple qui se dispute…)', 'ce que tu dis vs ce qui se passe vraiment',
  'les étapes d\'une soirée de 22h à 6h', 'les erreurs qui coûtent cher (prix des billets, vestiaire, taxi)', 'comment rentrer en boîte (dress code, videur, liste)',
  'pourquoi les billets augmentent (paliers early, regular, last)', 'les soirées de la Côte d\'Azur expliquées (plage, rooftop, warehouse, club)',
  'les excuses pour ne pas aller au travail le lendemain', 'le groupe WhatsApp de la soirée', 'les galères du retour (dernier train, Uber à 60 €)',
  'la soirée en été vs en hiver sur la Côte', 'les festivals de l\'été dans le Sud', 'ce que le DJ pense vraiment de tes demandes',
  'la sécurité en soirée (rester groupés, eau gratuite, verre surveillé), ton bienveillant',
];

// Personnages (looks prêts à l'emploi, trait noir épais comme les décors).
const TRAIT = {trait: '#141414', epaisseur: 7};
const LOOKS = [
  {peau: '#f2c09b', cheveux: '#3b2416', haut: '#3a86ff', coiffure: 'court'},
  {peau: '#c98b62', cheveux: '#111111', haut: '#2ec4b6', coiffure: 'casquette'},
  {peau: '#8d5a3b', cheveux: '#1a1a1a', haut: '#ffd60a', coiffure: 'bouclé'},
  {peau: '#f6d1b3', cheveux: '#b5532c', haut: '#ff4d8d', coiffure: 'long', lunettes: true},
  {peau: '#e0a77f', cheveux: '#222222', haut: '#222222', coiffure: 'rasé', lunettes: true},
  {peau: '#6b4228', cheveux: '#0d0d0d', haut: '#ff8c42', coiffure: 'chignon'},
  {peau: '#f9dcc4', cheveux: '#e8c15a', haut: '#9b5de5', coiffure: 'long'},
  {peau: '#a8693f', cheveux: '#2a1a10', haut: '#f15bb5', coiffure: 'court', lunettes: true},
].map((l) => ({...l, ...TRAIT}));
const LOOKS_TXT = ['garçon brun pull bleu', 'garçon casquette t-shirt turquoise', 'garçon cheveux bouclés t-shirt jaune', 'fille rousse cheveux longs lunettes haut rose',
  'DJ crâne rasé lunettes tout en noir (aussi videur, barman)', 'fille chignon haut orange', 'fille blonde cheveux longs haut violet', 'garçon lunettes t-shirt rose'];
const POSES = ['danse', 'choc', 'rire', 'pointe', 'fier', 'triste', 'agace', 'reflechit', 'telephone', 'salue', 'normal'];
const AMBIANCES = {club: 'sfx/ambiance-club.mp3', rue: 'sfx/ambiance-rue.mp3', mer: 'sfx/ambiance-mer.mp3', aucune: null};
const MUSIQUES = {festive: 'musique/odd-beats.mp3', electro: 'musique/electro-dreams.mp3', chill: 'musique/hazy-after-hours.mp3', trap: 'musique/trap.mp3'};
const COULEURS = ['#3a86ff', '#2ec4b6', '#ff8c42', '#ff4d8d', '#9b5de5', '#ffbe0b', '#00bbf9', '#f15bb5'];

const S = (description, extra = {}) => ({type: 'string', description, ...extra});
const PROP = {
  type: 'object', additionalProperties: false, required: ['type', 'mot', 'texte', 'de', 'a', 'suffixe', 'emoji', 'heure1', 'heure2'],
  properties: {
    type: S('Objet animé qui apparaît sur le mot : compteur (chiffre qui défile de « de » à « a »), billet (prix qui défile), horloge (heure1 → heure2), tampon (mot géant tamponné), bulle (phrase dite par le perso), enseigne (mot en néon), emoji, texte (mot géant), telephone (messages dans « texte », séparés par |)', {enum: ['compteur', 'billet', 'horloge', 'tampon', 'bulle', 'enseigne', 'emoji', 'texte', 'telephone']}),
    mot: S('UN mot exact de la réplique du monde, qui déclenche l\'apparition.'),
    texte: S('Texte court affiché (≤ 22 caractères ; pour telephone : 2-3 messages séparés par |). Vide si inutile.'),
    de: {type: 'number', description: 'Valeur de départ (compteur, billet), sinon 0.'},
    a: {type: 'number', description: 'Valeur finale (compteur, billet), sinon 0.'},
    suffixe: S('Suffixe du chiffre : « € », « % », « MIN », « 🍹 »… Vide sinon.'),
    emoji: S('Un emoji (type emoji), sinon vide.'),
    heure1: S('HH:MM pour horloge, sinon vide.'), heure2: S('HH:MM pour horloge, sinon vide.'),
  },
};
const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['id', 'titre', 'source', 'accroche', 'titre_lignes', 'mondes', 'fin', 'fin_lignes', 'commentaire', 'musique', 'decor_lieu', 'legende'],
  properties: {
    id: S('Identifiant court en minuscules et tirets, unique (ex. « galeres-retour »).'),
    titre: S('Titre interne du reel.'),
    source: S('URL de la source officielle si le sujet vient de l\'actualité, sinon vide.'),
    accroche: S('Réplique d\'ouverture (≤ 90 caractères), commence par une balise d\'émotion eleven_v3 comme [excited]. Doit accrocher en 2 secondes : chiffre choc, contradiction, « arrête de… », scène en plein milieu. Jamais bonjour ni « dans cette vidéo ».'),
    titre_lignes: {type: 'array', items: S('Ligne du titre à l\'écran (2 à 4 mots, capitales pour la 1re).'), minItems: 2, maxItems: 2},
    mondes: {
      type: 'array', minItems: 3, maxItems: 4,
      items: {
        type: 'object', additionalProperties: false,
        required: ['replique', 'etiquette', 'decor', 'ambiance', 'perso', 'pose', 'pose_apres', 'mot_apres', 'zoom', 'objets', 'son', 'mot_son'],
        properties: {
          replique: S('Réplique voix off de ce monde (≤ 110 caractères), punchline à la fin. Balises d\'émotion permises : [laughs] [surprised] [curious] [excited] [sighs].'),
          etiquette: S('Étiquette courte à l\'écran (≤ 26 caractères), ex. « je reste une heure ».'),
          decor: S('Décor en ANGLAIS : le lieu précis de ce monde (club, plage, rue, appartement, file d\'attente, taxi…), éléments reconnaissables, couleur dominante. Sans personnage ni texte.'),
          ambiance: S('Ambiance sonore du lieu.', {enum: Object.keys(AMBIANCES)}),
          perso: {type: 'integer', minimum: 0, maximum: LOOKS.length - 1, description: `Personnage : ${LOOKS_TXT.map((t, i) => `${i} = ${t}`).join(' ; ')}. Varie d'un monde à l'autre.`},
          pose: S('Pose au début.', {enum: POSES}), pose_apres: S('Pose après le mot de bascule (la chute).', {enum: POSES}),
          mot_apres: S('Mot exact de la réplique où la pose bascule (la chute).'),
          zoom: S('Mot exact de la réplique où la caméra zoome brutalement sur le visage (le moment drôle ou choquant), ou vide.'),
          objets: {type: 'array', items: PROP, minItems: 1, maxItems: 2},
          son: S('Bruitage du temps fort (sobre, jamais cartoon).', {enum: ['impact', 'zoom', 'pop', 'message', 'acclamation', 'tampon', 'caisse', 'flash', 'swoosh', 'aucun']}),
          mot_son: S('Mot exact de la réplique où le bruitage tombe.'),
        },
      },
    },
    fin: S('Réplique finale : appel à commenter avec un mot-clé ou à taguer un pote (≤ 70 caractères).'),
    fin_lignes: {type: 'array', items: S('Ligne de fin à l\'écran (2 à 4 mots).'), minItems: 2, maxItems: 2},
    commentaire: S('Faux commentaire drôle qui se tape à la fin (≤ 30 caractères, emoji permis).'),
    musique: S('Musique de fond.', {enum: Object.keys(MUSIQUES)}),
    decor_lieu: S('Ville ou cadre commun des décors en anglais (ex. « French Riviera, Nice »).'),
    legende: S('Légende Instagram en français : 1re ligne accrocheuse, 3-6 lignes aérées avec emojis, question finale, puis 4-6 hashtags dont #TeufyParty. Si actu : cite la source.'),
  },
};

const system = `Tu es le scénariste des reels Instagram de Teufy (@teufy_official), le guide des soirées de la Côte d'Azur (Nice, Cannes, Monaco, Antibes), public 17-30 ans.
Format imposé : « plan continu illustré » de 18 à 28 secondes. Une voix off française énergique (ElevenLabs eleven_v3, balises d'émotion), un décor illustré par monde, un personnage cartoon par monde, une caméra qui glisse sans coupure de monde en monde.
Structure : accroche (le groupe des personnages, titre à l'écran) → 3 ou 4 mondes (une réplique chacun, chute à la fin) → retour au groupe et appel à commenter.
Ton : complice, drôle, jamais vulgaire, jamais de drogue ni d'alcool glorifié, pas de marque citée sans raison. Phrases courtes à l'oral, rythme rapide.
Type « humour » : situations que tout le monde a vécues en soirée. Type « explicatif » : une info utile expliquée en 3-4 étapes avec des chiffres (vrais et vérifiables, sinon reste qualitatif). Type « actu » : une actualité vérifiée vue sous l'angle de la nuit (prix, transports, lois, grèves, festivals) en citant la source.
Les mots de déclenchement (mot, mot_apres, zoom, mot_son) doivent être des mots EXACTS de la réplique du monde concerné.`;

const prompt = `Type demandé : ${type}.
${idees.length ? `Idées de la veille (actualité vérifiée, à privilégier pour « actu » et « explicatif ») :\n${idees.map((i) => `- [${i.type}] ${i.titre} — ${i.angle || i.resume || ''} (${i.source || 'sans source'})`).join('\n')}\n` : ''}
Sujets intemporels possibles : ${INTEMPORELS.join(' ; ')}.
Déjà publiés ou en banque (ne refais pas le même sujet ni la même chute) :\n${dejaFaits.map((t) => `- ${t}`).join('\n') || '- aucun'}
Date : ${new Date().toISOString().slice(0, 10)}.
Écris un reel original selon le schéma.`;

// ECRIRE_REPONSE=<fichier.json> : réponse toute faite (tests, sans appel à l'IA).
const r = process.env.ECRIRE_REPONSE ? lire(process.env.ECRIRE_REPONSE, {}) : await json({config, system, prompt, schema: SCHEMA, nom: 'reel_illustre'});
if (!r?.mondes?.length) { console.error('Scénariste : aucune réponse exploitable.'); process.exit(1); }

// --- Vérifications et mise en forme -------------------------------------------------------
const sansTags = (s) => String(s || '').replace(/\[[^\]]*\]/g, ' ');
const norm = (s) => sansTags(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9' ]/g, ' ');
const motDans = (m, texte) => {
  const w = norm(m).trim().split(/\s+/)[0]?.replace(/^(l|d|qu|j|m|t|s|c|n)'/, '');
  return w && norm(texte).split(/\s+/).some((x) => x.replace(/^(l|d|qu|j|m|t|s|c|n)'/, '') === w) ? w : undefined;
};
let id = String(r.id || 'reel').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'reel';
while (concepts.some((c) => c.id === id) || existsSync(path.join(DIR_C, `${id}.json`))) id = `${id}-${Math.floor(Math.random() * 90 + 10)}`;
const mondes = r.mondes.slice(0, 4);
const total = [r.accroche, ...mondes.map((m) => m.replique), r.fin].map(sansTags).join(' ').length;
if (total > 520) console.warn(`Scénariste : script long (${total} caractères), le reel dépassera 30 s.`);

const persos = mondes.map((m, i) => LOOKS[(Number.isInteger(m.perso) ? m.perso : i) % LOOKS.length]);
const concept = {
  id, concept: 'histoire', type: type === 'actu' ? 'explicatif' : type, genre: type, titre: r.titre, cree: new Date().toISOString(), source: r.source || undefined,
  voix: {voice_id: 'IHngRooVccHyPqB4uQkG', nom: 'Corentin', modele: 'eleven_v3', stabilite: 0.0, style: 0.8, vitesse: 1.08},
  musique: {src: MUSIQUES[r.musique] || MUSIQUES.festive, volume: 0.5, ducking: 0.55},
  queue: 2.6, whooshEntreScenes: false,
  scenes: [
    {id: 'accroche', texte: r.accroche, sons: [{son: 'impact', volume: 0.5}]},
    ...mondes.map((m, i) => {
      const w = motDans(m.mot_son, m.replique);
      return {id: `monde-${i + 1}`, texte: m.replique, sons: m.son !== 'aucun' && w ? [{son: m.son, mot: w, decalage: 0.05, volume: 0.65}] : []};
    }),
    {id: 'fin', texte: r.fin, sons: [{son: 'clavier', decalage: 1.0, volume: 0.56}]},
  ],
  extra: {
    titreLignes: r.titre_lignes, finLignes: r.fin_lignes, commentaire: r.commentaire,
    mondes: mondes.map((m, i) => ({
      decor: `decors/${id}/monde-${i + 1}.jpg`, ambiance: AMBIANCES[m.ambiance] || undefined, couleur: COULEURS[(persos.indexOf(persos[i]) + i) % COULEURS.length],
      etiquette: m.etiquette, zoom: motDans(m.zoom, m.replique),
      persos: [{look: persos[i], x: -120, pose: m.pose === 'normal' ? undefined : m.pose, poseApres: m.pose_apres === 'normal' ? undefined : m.pose_apres, motApres: motDans(m.mot_apres, m.replique)}],
      props: (m.objets || []).slice(0, 2).map((o, k) => {
        const p = {type: o.type, mot: motDans(o.mot, m.replique), x: 150, y: k ? -620 : -940};
        if (['texte', 'tampon', 'bulle', 'enseigne'].includes(o.type)) p.texte = String(o.texte || '').slice(0, 30);
        if (['compteur', 'billet'].includes(o.type)) Object.assign(p, {de: o.de, a: o.a, suffixe: o.suffixe ? ` ${o.suffixe.trim()}` : undefined, texte: o.texte || undefined});
        if (o.type === 'horloge') p.heures = [o.heure1 || '23:00', o.heure2 || '05:00'];
        if (o.type === 'emoji') p.emoji = o.emoji || '🔥';
        if (o.type === 'telephone') { p.lignes = String(o.texte || '').split('|').map((x) => x.trim()).filter(Boolean).slice(0, 3); p.x = 60; p.y = -1250; }
        return p;
      }).filter((p) => p.type !== 'emoji' || p.emoji),
    })),
  },
  legende: r.legende,
};

const decorsDef = {
  concept: id,
  style: `Flat 2D cartoon illustration in a bold pop-art style: thick black outlines, flat saturated colors, subtle halftone dot texture, clean shapes, playful and premium, like a modern animated series background. Setting: ${r.decor_lieu || 'French Riviera'}. Background plate only: absolutely NO people, NO characters, NO text, NO letters, NO logos. Vertical 9:16 composition. Keep the lower third of the image as a clear, open, flat floor so characters can stand in front; put the main recognizable element in the middle third, fully visible. Camera at standing eye level.`,
  decors: mondes.map((m, i) => ({id: `monde-${i + 1}`, format: '9:16', prompt: m.decor})),
};

await writeFile(path.join(STUDIO, 'scripts', 'decors', `${id}.json`), JSON.stringify(decorsDef, null, 2) + '\n');
const fichier = path.join(DIR_C, `${id}.json`);
await writeFile(fichier, JSON.stringify(concept, null, 2) + '\n');
console.log(`Scénariste : « ${r.titre} » (${type}, ${mondes.length} mondes, ${total} caractères de voix)`);
console.log(fichier);
