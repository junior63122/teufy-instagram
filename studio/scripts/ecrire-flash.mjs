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
import {texteCible, lireCible} from '../../src/cible.mjs';
import {choisirGuide} from '../../src/guide.mjs';

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
// « Tendance » : seulement sur demande (le mercredi) — un format viral repéré par la veille, pensé pour les non-abonnés.
const TOUTES = [...RUBRIQUES, 'Tendance', 'Guide', 'Teufy'];
const recents = concepts.filter((c) => c.concept === 'reelflash').sort((a, b) => String(b.cree || '').localeCompare(String(a.cree || ''))).slice(0, 8).map((c) => c.rubrique);
let rubrique = TOUTES.includes(process.argv[2]) ? process.argv[2] : [...RUBRIQUES].sort((a, b) => recents.filter((x) => x === a).length - recents.filter((x) => x === b).length)[0];

const idees = lire(path.join(ROOT, 'contenus', 'idees.json'), []).filter((i) => new Date(i.ajout) > new Date(Date.now() - 10 * 864e5)).sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 15);
if (rubrique === 'Actu nuit' && !idees.length) rubrique = 'Explicatif'; // pas d'actu vérifiée sous la main
const dejaFaits = [...concepts.map((c) => c.titre), ...hist.map((h) => h.titre)].filter(Boolean).slice(-80);
const tendances = lire(path.join(ROOT, 'tendances-auto.json'), {});
const accroches = (tendances.accroches || []).slice(0, 8).map((a) => (typeof a === 'string' ? a : a.texte || a.accroche || '')).filter(Boolean);
const meilleurs = hist.filter((h) => h.publication?.type === 'reel' && h.note != null).sort((a, b) => b.note - a.note).slice(0, 3).map((h) => `${h.titre} (note ${h.note}/100)`);

// Sujets (12/11/2026, directeur : « mets-toi à la place des fêtards de la Côte ») : des situations VÉCUES par la cible,
// locales et qu'on envoie à son pote, plutôt que des cours (vestiaire, paliers de prix…). Complétés par contenus/cible.json.
const SUJETS = [
  ...(lireCible()?.situations || []),
  'Nice contre Cannes contre Monaco : où on sort le mieux (chacun défend sa ville)',
  'les types de fêtards de la Côte d\'Azur (on tague son pote)', 'tu sais que t\'es de la Côte d\'Azur quand…',
  'ce que tu prévois vs comment finit vraiment ta soirée', 'devine le prix d\'une soirée complète à Monaco vs à Nice (exemple réaliste, réponse à la fin)',
  'les phrases qu\'on entend dans toutes les files d\'attente', 'comment éviter de se faire refouler (les vrais conseils)',
  'les soirées techno vs commerciales : les codes de chaque camp', 'trouver une soirée gratuite ou pas chère en fin de mois',
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
      type: 'array', minItems: 7, maxItems: 9,
      items: {
        type: 'object', additionalProperties: false, required: ['texte', 'photo', 'gros', 'objet', 'son', 'mot_son'],
        properties: {
          texte: {type: 'string', description: 'Réplique voix off COURTE (≤ 12 mots, ≤ 75 caractères ; la 1re ≤ 8 mots), écrite pour l\'oral, sans « … » (pas de pause), avec 1 balise d\'émotion eleven_v3 au début ([excited] [shocked] [curious] [laughs] [whispers] [sighs] [surprised]) et des MAJUSCULES sur le mot à appuyer.'},
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
${texteCible()}
Format « Flash » (validé par la marque) : 18 à 24 s, 7 à 9 scènes courtes, une photo flash par scène, une voix off française TRÈS expressive et RAPIDE (ElevenLabs eleven_v3).
Le public décroche en moins d'une seconde : CHAQUE seconde doit relancer l'attention. Règles de rétention (prioritaires) :
- Scène 1 (≤ 1,5 s, ≤ 8 mots) : le CHOC tout de suite (le chiffre, la contradiction, la situation gênante), pas d'introduction. Le mot géant de la scène 1 apparaît dès la 1re image.
- Raconte une HISTOIRE avec de l'émotion : un personnage (« toi », ton pote, une fille dans la file), une tension (le problème, la gêne, l'injustice), un retournement, puis la solution. On doit vouloir connaître la suite.
- Boucle ouverte dans les 3 premières secondes (« et la 3e, personne ne la connaît », « attends la fin ») UNIQUEMENT si la suite la tient vraiment.
- Une réplique = une idée = 2 s maximum (≤ 12 mots). Jamais de « … », jamais de phrase longue.
- Varie les émotions d'une scène à l'autre (choc, rire, chuchotement, excitation) et alterne questions et affirmations.
- La dernière réplique boucle avec la première (on a envie de revoir) puis l'appel à l'action en 5 mots.
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
- La rubrique doit correspondre au contenu (Astuce = conseils concrets ; Explicatif = un mécanisme expliqué ; Humour = situations ; Actu nuit = une actu sourcée ; Tendance = un format viral reconnaissable, fait pour être partagé).`;

// Formats viraux : ceux que la veille hebdomadaire a repérés (cerveau), plus des structures qui se partagent en DM.
const FORMATS_VIRAUX = [
  ...(tendances.formats_a_tester || []).map((f) => `${f.format} (${f.pourquoi})`),
  'POV ultra reconnaissable (« POV : t\'es le pote qui dit « on rentre tôt » à 23h ») : on tague son pote',
  '« Les X types de personnes » dans une soirée / une file d\'attente / un groupe WhatsApp du vendredi : chacun s\'y reconnaît',
  '« Tu sais que t\'es de la Côte d\'Azur quand… » : fierté locale, partage entre gens du coin',
  'Avant / après (ce que tu prévois vs comment finit la soirée) avec un retournement drôle',
  'Défi ou devinette (« devine le prix d\'un verre à Monaco », réponse à la fin) : on regarde jusqu\'au bout',
];
// Guide (idée du directeur) : « Où manger à Cannes après la boîte », « Les afters de Nice »… avec de VRAIES adresses.
const GUIDE = rubrique === 'Guide' ? choisirGuide({deja: [...concepts.filter((c) => c.guide).map((c) => `${c.guide.theme}|${c.guide.ville}`), ...hist.map((h) => h.guide).filter(Boolean)]}) : null;
if (rubrique === 'Guide' && !GUIDE) { console.error('Guide : pas encore 3 adresses vérifiées pour une ville (OpenStreetMap, fiches des clubs).'); process.exit(1); }
const blocGuide = GUIDE ? `\nRUBRIQUE GUIDE : « ${GUIDE.theme === 'manger' ? `Où manger à ${GUIDE.ville} après la boîte` : `Les afters à ${GUIDE.ville}`} ». Le reel qu'on enregistre et qu'on envoie au groupe à 4 h du matin.
Utilise UNIQUEMENT ces adresses, avec leur nom EXACT et leurs horaires tels qu'écrits (n'invente ni adresse, ni horaire, ni prix, ni avis) :
${GUIDE.lieux.map((l, i) => `${i + 1}. ${l.nom} — ${l.quoi} — ${l.horaires}`).join('\n')}
Présente 3 à 5 adresses numérotées (une par scène, le nom en mot géant), la scène 1 part d'une situation vécue (la faim de 4 h, la boîte qui ferme et personne ne veut rentrer). Dernière scène : « la liste complète est sur teufyparty.com » et « envoie ça à ton pote qui… ». Légende : les adresses avec leurs horaires, puis « Horaires publiés : vérifie avant d'y aller ». Photos des scènes : des ambiances génériques (rue la nuit, néons, groupe de potes, assiette à emporter), JAMAIS la devanture ou l'intérieur d'une adresse citée (on ne montre pas un faux lieu).\n` : '';
const blocTendance = rubrique === 'Tendance' ? `\nRUBRIQUE TENDANCE : objectif = être partagé en message privé et vu par des gens qui ne suivent pas Teufy.
Choisis UN de ces formats et applique-le à la nuit de la Côte d'Azur (situations vraies, pas de fausse info) :
${FORMATS_VIRAUX.map((f) => `- ${f}`).join('\n')}
La dernière scène pousse à envoyer le reel à quelqu'un (« envoie ça à ton pote qui… ») plutôt qu'à s'abonner.\n` : '';
// « Teufy » (13/11/2026, directeur : « donner envie d'aller sur Teufy : tu cherches des soirées ? Y'a Teufy ») : à la
// manière des pubs d'applis américaines, un problème vécu puis le site qui le règle, montré en VRAIES captures du site.
const blocTeufy = rubrique === 'Teufy' ? `\nRUBRIQUE TEUFY : donner envie d'ouvrir teufyparty.com, comme les pubs d'applis américaines (Duolingo, Hinge, Partiful) : drôle, rapide, jamais publicitaire.
Structure : 1) un problème que TOUT fêtard de la Côte a vécu (« samedi 23 h, personne ne sait où sortir », « la boîte ferme, t'as faim, tout est fermé », « t'arrives devant le club : complet ») ; 2) « Y'a Teufy. » ; 3) 2 à 4 scènes qui MONTRENT le site ; 4) dernière scène : « teufyparty.com » + « envoie ça à ton pote qui demande toujours "on fait quoi ce soir ?" ».
Pour les scènes qui montrent le site, le champ photo doit être EXACTEMENT une de ces captures (rien d'autre) : capture:accueil (toutes les soirées), capture:ce-soir (ce soir, boîtes ouvertes), capture:pres-de-moi (tout trié par distance), capture:manger-tard (où manger à 4 h), capture:avantages (codes promo, verres offerts). Les autres scènes ont une photo normale (en anglais).
N'invente aucune fonction : le site a l'agenda des soirées, « Ce soir », « Près de moi », « Manger tard », les afters, les clubs et bars avec horaires, les avantages et codes promo, l'abonnement à l'agenda.\n` : '';
const prompt = `Rubrique demandée : ${rubrique}.${blocTendance}${blocGuide}${blocTeufy}
${idees.length ? `Actualité vérifiée de la veille (prioritaire pour « Actu nuit » et « Explicatif ») :\n${idees.map((i) => `- ${i.titre} — ${i.angle || i.resume || ''} (${i.source || 'sans source'})`).join('\n')}\n` : ''}Sujets possibles : ${SUJETS.join(' ; ')}.
${meilleurs.length ? `Nos reels les mieux notés (inspire-toi de ce qui marche) : ${meilleurs.join(' ; ')}.\n` : ''}${accroches.length ? `Accroches qui marchent chez les comptes suivis : ${accroches.join(' | ')}.\n` : ''}Déjà publiés ou en banque (ne refais pas le même sujet) :\n${dejaFaits.map((t) => `- ${t}`).join('\n') || '- aucun'}
Date : ${new Date().toISOString().slice(0, 10)}. Écris un reel selon le schéma.`;

// Écriture, puis relecture critique par l'IA (note /10) : en dessous de 7, le script est réécrit avec les remarques.
const CRITIQUE = {type: 'object', additionalProperties: false, required: ['note', 'problemes'], properties: {
  note: {type: 'number', description: 'note sur 10'}, problemes: {type: 'array', items: {type: 'string'}, description: 'problèmes précis à corriger'}}};
const relire = (script) => json({config, nom: 'relecture', gratuit: true, schema: CRITIQUE,
  system: `Tu es rédacteur en chef exigeant des reels de Teufy (soirées Côte d'Azur, 17-30 ans). TEST DU PARTAGE (éliminatoire) : un fêtard de 22 ans de Nice l'enverrait-il à son pote ou dans son groupe WhatsApp ? Sujet scolaire, générique (valable pour n'importe quelle ville) ou sans situation vécue = note maximum 6. Note le script sur 10 : rétention (le public décroche en 1 s : la scène 1 fait-elle ≤ 8 mots avec un choc immédiat ? chaque réplique ≤ 12 mots ? une histoire avec tension et retournement ? une raison de rester jusqu'à la fin ?), accroche (2 premières secondes), valeur apportée (on apprend ou on rit vraiment), rythme (un temps fort toutes les 1-2 s), exactitude (nombre d'éléments annoncé = nombre donné ; TOUTE affirmation chiffrée ou présentée comme un fait — « ×2 », « le double », « 80 % », une règle générale — sans source ni mention d'exemple est une faute grave : note 5 maximum), ton (complice, inclusif, sans stéréotype de genre, d'origine ou d'apparence), cohérence rubrique/contenu, appel à l'action. Sois sévère : 7 = publiable.`,
  prompt: `Rubrique : ${rubrique}\nScript :\n${JSON.stringify({titre: script.titre, titre_couverture: script.titre_couverture, scenes: script.scenes.map((x) => ({texte: x.texte, gros: x.gros, objet: x.objet?.type})), legende: script.legende})}`});
let r = process.env.ECRIRE_REPONSE ? lire(process.env.ECRIRE_REPONSE, {}) : await json({config, system, prompt, schema: SCHEMA, nom: 'reel_flash'});
// Contrôles de rythme mesurables (avant l'avis de l'IA) : accroche courte, répliques courtes, pas de pauses.
const mots = (x) => String(x || '').replace(/\[[^\]]*\]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
const rythme = (sc) => [
  ...(mots(sc.scenes?.[0]?.texte) > 8 ? [`la 1re réplique fait ${mots(sc.scenes[0].texte)} mots (8 maximum, le choc d'abord)`] : []),
  ...(sc.scenes || []).flatMap((x, i) => (mots(x.texte) > 13 ? [`la réplique ${i + 1} fait ${mots(x.texte)} mots (12 maximum)`] : [])),
  ...((sc.scenes || []).some((x) => /…|\.\.\./.test(x.texte)) ? ['des « … » ralentissent la voix : les supprimer'] : []),
];
if (!process.env.ECRIRE_REPONSE && r?.scenes?.length) {
  for (let essai = 0; essai < 3; essai++) {
    let avis;
    const lent = rythme(r);
    try { avis = lent.length ? {note: 5, problemes: lent} : await relire(r); } catch (err) { console.error(`Relecture impossible : ${err.message}`); break; }
    console.error(`Relecture : ${avis.note}/10${avis.problemes?.length ? ` — ${avis.problemes.join(' ; ')}` : ''}`);
    if (avis.note >= 7) break;
    if (essai === 2) { console.error('Script refusé par la relecture : pas de reel.'); process.exit(1); }
    r = await json({config, system, schema: SCHEMA, nom: 'reel_flash', prompt: `${prompt}\n\nUne première version a été refusée par la relecture (${avis.note}/10). Problèmes à corriger : ${avis.problemes.join(' ; ')}.\nVersion refusée : ${JSON.stringify(r).slice(0, 6000)}\nRéécris un reel meilleur selon le schéma.`});
  }
}
if (!r?.scenes?.length) { console.error('Scénariste : aucune réponse exploitable.'); process.exit(1); }
if (GUIDE) {
  const tout = (r.scenes || []).map((x) => x.texte).join(' ') + ' ' + (r.legende || '');
  const simple = (x) => String(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const cites = GUIDE.lieux.filter((l) => simple(tout).includes(simple(l.nom.replace(/\s*\(.*\)$/, ''))));
  if (cites.length < 3) { console.error(`Guide : seulement ${cites.length} adresse(s) vérifiée(s) citée(s), il en faut 3 : refusé.`); process.exit(1); }
}

// --- vérifications ---------------------------------------------------------------------
const sansTags = (s) => String(s || '').replace(/\[[^\]]*\]/g, ' ');
const norm = (s) => sansTags(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9' ]/g, ' ');
const motDans = (m, texte) => {
  const w = norm(m).trim().split(/\s+/)[0]?.replace(/^(l|d|qu|j|m|t|s|c|n)'/, '');
  return w && norm(texte).split(/\s+/).some((x) => x.replace(/^(l|d|qu|j|m|t|s|c|n)'/, '') === w) ? w : undefined;
};
let id = String(r.id || 'reel').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'reel';
while (concepts.some((c) => c.id === id) || existsSync(path.join(DIR_C, `${id}.json`))) id = `${id}-${Math.floor(Math.random() * 90 + 10)}`;
// Les « … » font marquer une pause à la voix : remplacés par une virgule (rythme continu).
const scenes = r.scenes.slice(0, 9).map((x) => ({...x, texte: String(x.texte).replace(/\s*(…|\.\.\.)\s*(?=[?!.,]|$)/g, '').replace(/\s*(…|\.\.\.)\s*/g, ', ')}));
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
  id, concept: 'reelflash', type: 'explicatif', rubrique, ...(GUIDE ? {guide: {theme: GUIDE.theme, ville: GUIDE.ville}} : {}), titre: r.titre, titre_couverture: r.titre_couverture, cree: new Date().toISOString(), source: r.source || undefined,
  voix: config.studio?.voix || {voice_id: '3Tp5mYhT9wrfnry9pzvV', nom: 'Hugo', modele: 'eleven_v3', stabilite: 0.0, style: 0.85, vitesse: 1.2},
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
