// Veille événementielle, toutes les heures en journée :
//  1. Signaux : posts Instagram récents des organisateurs, clubs et festivals suivis (API officielle,
//     gratuit) + recherche web (Gemini gratuit en priorité) sur deux axes :
//       - annonces de la Côte d'Azur (nouvelle édition, line-up, ouverture, fermeture, date ajoutée…) ;
//       - actualité générale qui touche les sorties (prix, lois, réglementation, grèves, transports de
//         nuit, sécurité, habitudes des jeunes), à traiter sous l'angle de la nuit et de la fête.
//  2. Tri par l'IA : importance /100, fraîcheur, vérification (source officielle), angle Teufy.
//  3. Décision : une annonce exceptionnelle, vérifiée et nouvelle est publiée tout de suite en post
//     unique (1 par jour max, 8h-23h) ; le reste part dans la banque d'idées (reels, carrousels).
// Rien n'est inventé : sans source officielle datée, pas de publication.
import { readFileSync, existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as LLM from './llm.mjs';
import { hash } from './learn.mjs';
import { dateParis } from './dates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VUS = path.join(ROOT, 'contenus', 'veille-vus.json');
const IDEES = path.join(ROOT, 'contenus', 'idees.json');
const lire = (f, def) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : def);

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['sujets'],
  properties: {
    sujets: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['titre', 'type', 'resume', 'date_publication', 'source_url', 'source_officielle', 'importance', 'raison', 'angle', 'format', 'post', 'comptes_instagram', 'image', 'article', 'soirees'],
        properties: {
          titre: { type: 'string', description: 'Titre factuel court.' },
          type: { type: 'string', enum: ['annonce', 'actu'], description: 'annonce = événement / lieu / line-up ; actu = actualité générale qui touche les sorties.' },
          resume: { type: 'string', description: 'Ce qui est annoncé, en 2 phrases, uniquement des faits sourcés.' },
          date_publication: { type: 'string', description: "Date et heure de l'annonce (ISO 8601), telle que publiée par la source." },
          source_url: { type: 'string', description: "URL de la source la plus officielle (compte ou site de l'organisateur, institution, média reconnu)." },
          source_officielle: { type: 'boolean', description: "true seulement si la source est l'organisateur, le lieu, l'artiste, une institution, ou un média reconnu qui cite l'annonce officielle." },
          importance: { type: 'integer', description: "0-100 pour les 17-30 ans de la Côte d'Azur. ≥ 80 : exceptionnel (nouvelle édition d'un festival majeur, édition inédite, très grosse tête d'affiche, ouverture ou fermeture d'un lieu emblématique, loi ou règle qui change les sorties). 50-79 : intéressant. < 50 : banal (une soirée parmi d'autres)." },
          raison: { type: 'string', description: "Pourquoi cette note, en une phrase." },
          angle: { type: 'string', description: "L'angle Teufy : ce que ça change pour ceux qui sortent." },
          format: { type: 'string', enum: ['post-annonce', 'carrousel-decryptage', 'reel-idee', 'aucun'] },
          post: {
            type: 'object', additionalProperties: false, required: ['surtitre', 'titre', 'sous_titre', 'faits', 'legende'],
            properties: {
              surtitre: { type: 'string', description: "2 à 3 mots en capitales : C'EST OFFICIEL, NOUVEAU, ÇA CHANGE TOUT, ACTU NUIT…" },
              titre: { type: 'string', description: 'Titre du visuel, 4 à 9 mots, percutant, sans point final. Mets UN mot clé entre crochets pour la couleur de la marque, ex. « Le tram roule jusqu\'à [2h] le samedi ».' },
              sous_titre: { type: 'string', description: 'Une phrase courte (≤ 70 caractères).' },
              faits: { type: 'array', items: { type: 'string' }, description: '2 à 4 faits courts et sourcés (date, lieu, prix, ce qui change).' },
              legende: { type: 'string', description: "Légende Instagram : accroche dans la 1re ligne, faits sourcés, question pour faire réagir, mention de la source (« Source : … »), 3 à 5 hashtags dont #TeufyParty. Ton Teufy, pas de tiret cadratin, pas d'invitation à télécharger une app." },
            },
          },
          comptes_instagram: { type: 'array', items: { type: 'string' }, description: 'Comptes Instagram officiels concernés, certains seulement (sans @).' },
          image: { type: 'string', description: "URL de l'image officielle de l'annonce si connue (post Instagram, affiche), sinon chaîne vide." },
          soirees: {
            type: 'array',
            description: "Soirées précises annoncées dans ce sujet (nom, date, heure, lieu certains), pour l'agenda du site. Tableau vide si le sujet n'annonce pas une soirée datée. N'invente rien.",
            items: { type: 'object', additionalProperties: false, required: ['nom', 'debut', 'lieu', 'ville', 'billetterie', 'prix', 'affiche', 'styles', 'accroche'],
              properties: {
                nom: { type: 'string' }, debut: { type: 'string', description: 'Date et heure de début (ISO 8601, heure de Paris).' },
                lieu: { type: 'string' }, ville: { type: 'string' }, billetterie: { type: 'string', description: 'URL de la billetterie ou de la page officielle, sinon vide.' },
                prix: { type: ['number', 'null'] }, affiche: { type: 'string', description: "URL de l'affiche si connue, sinon vide." },
                styles: { type: 'array', items: { type: 'string' } }, accroche: { type: 'string', description: 'Une phrase courte et factuelle (≤ 100 caractères), sans tiret cadratin.' },
              } },
          },
          article: {
            type: 'object', additionalProperties: false, required: ['titre', 'chapo', 'paragraphes', 'ville'],
            description: "Article pour la rubrique « Actus » du site, écrit pour quelqu'un qui n'a jamais entendu parler du sujet : simple, clair, factuel, sans jargon.",
            properties: {
              titre: { type: 'string', description: 'Titre clair et informatif (8 à 14 mots), ex. « Le Delta Festival n\'aura pas lieu cette année : ce que l\'on sait ».' },
              chapo: { type: 'string', description: "L'essentiel en une ou deux phrases (qui, quoi, quand, où)." },
              paragraphes: { type: 'array', items: { type: 'string' }, description: "3 à 5 paragraphes courts : le contexte (c'est quoi, depuis quand), ce qui se passe exactement, pourquoi, ce que ça change concrètement pour ceux qui sortent (billets, remboursement, dates, alternatives), ce qu'on ne sait pas encore. Uniquement des faits sourcés." },
              ville: { type: 'string', description: 'Ville ou zone concernée (ex. Nice, Côte d\'Azur, France).' },
            },
          },
        },
      },
    },
  },
};

const CIBLE = "Teufy est un média Instagram sur les sorties et la nuit de la Côte d'Azur (Nice, Cannes, Antibes, Monaco, Menton…), pour les 17-30 ans.";

// Posts Instagram récents (moins de `heures`) des comptes suivis : organisateurs, clubs, festivals.
async function postsRecents({ ig, api, now, heures = 36, log }) {
  const orgas = lire(path.join(ROOT, 'contenus', 'organisateurs.json'), { comptes: [], suggeres: [] });
  // Partenaires + organisateurs, par roulement : 40 comptes par passage (limite de l'API), tous vus en quelques heures.
  const tous = [...new Set([...(orgas.partenaires || []), ...(orgas.comptes || []), ...(orgas.suggeres || [])])];
  const depart = tous.length > 40 ? (Math.floor(now.getTime() / 1800e3) * 40) % tous.length : 0;
  const comptes = [...tous.slice(depart), ...tous.slice(0, depart)].slice(0, 40);
  const out = [];
  for (const c of comptes) {
    try {
      const d = await api.businessDiscovery(c, ig);
      for (const m of d?.media?.data || []) {
        if (now - new Date(m.timestamp) > heures * 3600e3) continue;
        out.push({ compte: c, date: m.timestamp, texte: (m.caption || '').slice(0, 700), lien: m.permalink, image: m.media_type === 'VIDEO' ? '' : m.media_url || '' });
      }
    } catch (err) { if (/rate|limit|\(#4\)|\(#32\)/i.test(err.message)) { log(`Limite Instagram atteinte après ${c}.`); break; } }
  }
  return out;
}

// Clé d'un sujet dans contenus/veille-vus.json (mois + titre normalisé).
export const cleSujet = (titre, jour) => `${String(jour).slice(0, 7)}|${String(titre || '').toLowerCase().replace(/[^a-z0-9àâçéèêëîïôûùüÿœ]+/g, ' ').trim().slice(0, 80)}`;
// Sujet déjà traité : vu un autre passage, SAUF s'il avait été retenu pour un post qui n'est jamais parti (rendu ou
// publication en échec) : il reste alors candidat (20/11/2026 : avant, il était noté « publié » dès la préparation,
// comptait dans le quota du jour et n'était plus jamais repris).
export function dejaTraite(vus, titre, jour) {
  const k = cleSujet(titre, jour).split('|')[1];
  return Object.entries(vus).some(([cle, v]) => !cle.startsWith('_') && cle.split('|')[1] === k && !(v?.prevu && !v.publie));
}
/** Appelé après la publication RÉELLE du post de veille (src/run.mjs) : le sujet compte enfin comme publié. */
export function marquerPublie(vus, titre, { jour = new Date().toISOString().slice(0, 10), le = new Date().toISOString() } = {}) {
  const k = cleSujet(titre, jour).split('|')[1];
  let n = 0;
  for (const [cle, v] of Object.entries(vus)) if (!cle.startsWith('_') && cle.split('|')[1] === k && v?.prevu) { v.publie = true; v.publie_le = le; n++; }
  if (!n) vus[cleSujet(titre, jour)] = { le, publie: true, publie_le: le };
  return vus;
}
export async function confirmerPublicationVeille(titre, now = new Date()) {
  const vus = lire(VUS, {});
  marquerPublie(vus, titre, { jour: now.toISOString().slice(0, 10), le: now.toISOString() });
  await writeFile(VUS, JSON.stringify(vus, null, 1) + '\n');
}

const texteOk = (s, max) => typeof s === 'string' && s.trim().length > 2 && s.length <= max && !/—|lien en bio|t[ée]l[ée]charg/i.test(s);

/** Analyse de veille. Renvoie { sujets, apublier (ou null), idees } et met à jour les fichiers de suivi. */
// Rattrapage des actus (21/11/2026, directeur : « dans la page Actus il y en a vraiment pas beaucoup ») : les idées notées
// 60/100 et plus (contenus/idees.json) n'avaient jamais d'article, seuls les sujets tout juste détectés en recevaient un.
// À chaque passage, au plus `max` idées récentes deviennent un article, écrit UNIQUEMENT à partir de la page source relue
// maintenant (si la page ne confirme pas l'info, ou n'est pas lisible, rien n'est publié et l'idée est marquée).
export async function rattraperActus({ config, ia = LLM, now = new Date(), log = console.log, max = 2, lirePage } = {}) {
  const V = config.veille || {};
  const IDEES = path.join(ROOT, 'contenus', 'idees.json'), ACTUS = path.join(ROOT, 'contenus', 'actus.json');
  const idees = lire(IDEES, []), actus = lire(ACTUS, []);
  const liste = Array.isArray(idees) ? idees : [];
  // 21/11/2026 : une info déjà en actu sous une autre clé (même page source) n'est pas réécrite ; une source par passage.
  const deja = new Set(actus.flatMap((a) => [a.cle, a.source].filter(Boolean).map(String)));
  const sources = new Set();
  const cand = liste.filter((x) => (x.importance ?? 0) >= (V.seuil_site ?? 60) && /^https?:\/\//.test(x.source || '') && !x.actu_refusee && !deja.has(String(x.id)) && !deja.has(x.source)
    && /^https?:\/\/[^/]+\/.+/.test(x.source) && !/\.(webp|jpe?g|png|gif|mp4)(\?|$)/i.test(x.source) // page d'accueil ou image : rien à vérifier
    && (!x.ajout || now - Date.parse(x.ajout) < 30 * 864e5)).sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
    .filter((x) => !sources.has(x.source) && sources.add(x.source)).slice(0, max);
  if (!cand.length) return 0;
  const page = lirePage || (async (u) => { const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; TeufyVeille/1.0)' }, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();
    // Posts Instagram : la légende n'est lisible que dans les métadonnées (og:description) ; on la garde en tête du texte.
    const meta = [...html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:title|og:description|description)["'][^>]*content=["']([^"']+)["']/gi)].map((m) => m[1]).join(' \n ')
      .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&');
    return (meta + ' \n ' + html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').slice(0, 9000); });
  const SCHEMA_ART = { type: 'object', additionalProperties: false, required: ['confirme', 'titre', 'chapo', 'paragraphes', 'ville'], properties: {
    confirme: { type: 'boolean', description: 'true seulement si le texte de la page confirme l\'information.' }, titre: { type: 'string' }, chapo: { type: 'string' },
    paragraphes: { type: 'array', items: { type: 'string' } }, ville: { type: 'string' } } };
  let n = 0;
  for (const x of cand) {
    let texte = '';
    try { texte = await page(x.source); } catch (err) { log(`Actus : source illisible pour « ${x.titre} » (${err.message}).`); }
    if (texte.length < 300) { x.actu_essais = (x.actu_essais || 0) + 1; if (x.actu_essais >= 3) x.actu_refusee = 'source illisible'; log(`Actus : source illisible pour « ${x.titre} » (essai ${x.actu_essais}/3).`); continue; }
    try {
      const a = await ia.json({ config, gratuit: true, secondaire: true, nom: 'article', schema: SCHEMA_ART,
        system: `Tu écris une courte actu pour le site d'un guide des soirées de la Côte d'Azur (17-30 ans), en français simple. N'utilise QUE les faits présents dans le texte de la page fournie : aucun chiffre, date, nom ou lieu qui n'y figure pas. Si la page ne confirme pas l'information, ou si l'événement est déjà passé (nous sommes le ${now.toISOString().slice(0, 10)}), confirme = false.`,
        prompt: `Information repérée : ${x.titre}\nRésumé : ${x.resume || x.angle || ''}\nSource : ${x.source}\n\nTexte de la page :\n${texte}\n\nÉcris : un titre (70 caractères au plus), un chapô d'une phrase, 2 à 4 paragraphes courts (ce qui se passe, quand, où, pour qui, comment y aller ou réserver si la page le dit), la ville.` });
      const ok = a && a.confirme === true && a.titre && a.chapo && Array.isArray(a.paragraphes) && a.paragraphes.filter((p) => String(p).trim().length > 40).length >= 2;
      if (!ok) { x.actu_refusee = 'non confirmée par la source'; log(`Actus : « ${x.titre} » non confirmée par sa source, pas publiée.`); continue; }
      actus.push({ cle: String(x.id), date: x.ajout || now.toISOString(), ajout: now.toISOString(), type: x.type, importance: x.importance, source: x.source, image: '', titre: a.titre, chapo: a.chapo, paragraphes: a.paragraphes.slice(0, 4), ville: a.ville });
      n++; log(`Actus : article ajouté (rattrapage) : « ${a.titre} ».`);
    } catch (err) { log(`Actus : rédaction impossible pour « ${x.titre} » (${err.message}).`); }
  }
  await writeFile(ACTUS, JSON.stringify(actus.slice(-200), null, 1) + '\n');
  await writeFile(IDEES, JSON.stringify(idees, null, 1) + '\n');
  return n;
}

export async function veiller({ config, now = new Date(), ig = null, api = {}, ia = LLM, log = console.log, dryRun = false } = {}) {
  const V = config.veille || {};
  const vus = lire(VUS, {});
  const jour = now.toISOString().slice(0, 10);
  const heureParis = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(now), 10);

  // Rythme (20/11/2026) : le déclencheur externe passe toutes les 30 min ; la veille ne travaille qu'une fois par
  // config.veille.intervalle_minutes (60 par défaut) et dort la nuit (config.veille.nuit, 2 h à 8 h à Paris) : moins
  // d'appels à l'API Instagram et à l'IA, sans rater une annonce (elles tombent en journée).
  const [nDeb, nFin] = V.nuit || [2, 8];
  if (!V.toujours && heureParis >= nDeb && heureParis < nFin) { log(`Veille : pause de nuit (${nDeb} h à ${nFin} h).`); return { sujets: [], apublier: null, idees: [] }; }
  const dernierPassage = vus._dernier_passage ? Date.parse(vus._dernier_passage) : 0;
  if (process.env.VEILLE_FORCER !== '1' && dernierPassage <= now.getTime() && now - dernierPassage < ((V.intervalle_minutes ?? 60) - 5) * 60e3) { log(`Veille : dernier passage il y a ${Math.round((now - dernierPassage) / 60e3)} min (rythme : ${V.intervalle_minutes ?? 60} min).`); return { sujets: [], apublier: null, idees: [] }; }
  if (!dryRun) { vus._dernier_passage = now.toISOString(); await mkdir(path.dirname(VUS), { recursive: true }); await writeFile(VUS, JSON.stringify(vus, null, 1) + '\n'); }
  if (!dryRun) { try { await rattraperActus({ config, ia, now, log }); } catch (err) { log(`Actus : rattrapage impossible (${err.message}).`); } }

  // 1. Signaux.
  const posts = ig && api.businessDiscovery ? await postsRecents({ ig, api, now, heures: V.fenetre_heures ?? 36, log }) : [];
  log(`Veille : ${posts.length} post(s) Instagram récents chez les comptes suivis.`);
  // Budget : la recherche web (payante) au plus toutes les N minutes (config.veille.recherche_minutes, 120 par défaut) ;
  // entre deux, la veille lit seulement les comptes Instagram suivis (gratuit).
  const dernier = vus._derniere_recherche ? Date.parse(vus._derniere_recherche) : 0;
  const attendre = dernier > now.getTime() ? 0 : (V.recherche_minutes ?? 120) * 60e3 - (now - dernier); // date future (horloge, test) : on ne bloque pas
  if (attendre > 0 && !posts.length) { log(`Veille : prochaine recherche web dans ${Math.ceil(attendre / 60e3)} min (budget).`); return { sujets: [], apublier: null, idees: [] }; }
  const web = attendre > 0 ? '' : await ia.rechercher({
    config, gratuit: true, secondaire: true,
    system: `Tu fais la veille d'un média Instagram. ${CIBLE} Tu ne rapportes que des faits publiés, datés et sourcés.`,
    prompt: `Nous sommes le ${now.toISOString()} (heure de Paris : ${heureParis}h). Cherche ce qui a été annoncé ou publié dans les dernières ${V.fenetre_heures ?? 36} heures :
1. Annonces de la Côte d'Azur et alentours : nouvelle édition ou date d'un festival, line-up, tête d'affiche, ouverture, réouverture ou fermeture d'un club ou d'un lieu, soirée inédite, billetterie qui ouvre, événement annulé.
2. Actualité en France qui touche les sorties des 17-30 ans : prix (billets, boissons, transports), lois et règlements (horaires, sécurité, alcool, bruit), grèves ou manifestations qui perturbent des événements, transports de nuit, nouvelles habitudes.
Pour chaque point : titre, date et heure de publication, URL de la source la plus officielle, résumé factuel. Ignore ce qui a plus de ${V.fenetre_heures ?? 36} heures et les soirées ordinaires sans rien de spécial.`,
  });

  // Le minuteur de la recherche web n'avance que si elle a vraiment répondu (avant : une recherche vide ou en panne
  // comptait comme faite et la suivante attendait 2 h).
  if (attendre <= 0 && String(web || '').trim()) vus._derniere_recherche = now.toISOString();
  else if (attendre <= 0) log('Veille : recherche web sans résultat (IA indisponible ?) : nouvel essai au prochain passage.');
  // Aucun signal (recherche vide, aucun post) : on ne demande pas à l'IA de trier du vide (elle inventerait des sujets).
  if (!String(web || '').trim() && !posts.length) return { sujets: [], apublier: null, idees: [] };

  // 2. Tri.
  let d;
  try {
    d = await ia.json({
      config, gratuit: true, secondaire: true, nom: 'veille', schema: SCHEMA,
      system: `Tu es rédacteur en chef d'un média Instagram. ${CIBLE} Tu notes l'importance avec exigence : une soirée ordinaire parmi des centaines ne dépasse pas 40. N'invente rien ; sans source officielle datée, source_officielle = false.`,
      prompt: `Signaux de la veille (web) :\n${web || '(aucun)'}\n\nPosts Instagram récents des organisateurs et lieux suivis (sources officielles) :\n${JSON.stringify(posts).slice(0, 12000)}\n\nDéjà traités (ne les reprends pas) :\n${Object.keys(vus).filter((k) => !k.startsWith("_")).slice(-60).join('\n')}\n\nListe les sujets nouveaux selon le schéma.`,
    });
  } catch (err) { log(`Veille : tri impossible (${err.message}).`); return { sujets: [], apublier: null, idees: [] }; }

  const frais = (s) => { const t = Date.parse(s.date_publication); return !isNaN(t) && now - t <= (V.fenetre_heures ?? 36) * 3600e3 && t <= now.getTime() + 3600e3; };
  const cle = (s) => cleSujet(s.titre, jour);
  const sujets = (d.sujets || []).filter((s) => s.titre && !dejaTraite(vus, s.titre, jour));

  // 3. Décision.
  // Seulement les posts vraiment partis (confirmés après publication), pas ceux seulement préparés.
  const publiesAujourdhui = Object.values(vus).filter((v) => v?.publie && (v.publie_le || v.le)?.startsWith(jour)).length;
  // Fenêtre de publication (heure de Paris), qui peut passer minuit (ex. 7h → 1h).
  const hMin = V.heure_min ?? 8, hMax = V.heure_max ?? 23;
  const fenetreOk = hMin <= hMax ? heureParis >= hMin && heureParis <= hMax : heureParis >= hMin || heureParis <= hMax;
  const eligibles = sujets
    .filter((s) => s.importance >= (V.seuil ?? 80) && s.source_officielle && /^https?:\/\//.test(s.source_url) && frais(s) && s.format === 'post-annonce')
    .filter((s) => texteOk(s.post.titre, 70) && texteOk(s.post.legende, 2000) && (s.post.faits || []).length >= 2)
    .sort((a, b) => b.importance - a.importance);
  const apublier = fenetreOk && publiesAujourdhui < (V.max_par_jour ?? 1) ? eligibles[0] || null : null;
  const idees = sujets.filter((s) => s !== apublier && s.importance >= 50);

  if (!dryRun) {
    // « prevu » : retenu pour un post ; « publie » n'est mis qu'après la publication réelle (confirmerPublicationVeille).
    for (const s of sujets) vus[cle(s)] = { le: now.toISOString(), importance: s.importance, source: s.source_url, publie: vus[cle(s)]?.publie || false, ...(s === apublier ? { prevu: true } : {}) };
    const banque = lire(IDEES, []);
    for (const s of idees) banque.push({ id: `idee-${hash(s.titre)}`, ajout: now.toISOString(), type: s.type, format: s.format, titre: s.titre, angle: s.angle, resume: s.resume, source: s.source_url, importance: s.importance });
    await mkdir(path.dirname(VUS), { recursive: true });
    const derniere = vus._derniere_recherche, passage = vus._dernier_passage; delete vus._derniere_recherche; delete vus._dernier_passage; // gardés à part (sinon élagués avec les anciens sujets)
    await writeFile(VUS, JSON.stringify({ ...Object.fromEntries(Object.entries(vus).slice(-1500)), ...(derniere ? { _derniere_recherche: derniere } : {}), ...(passage ? { _dernier_passage: passage } : {}) }, null, 1) + '\n');
    await writeFile(IDEES, JSON.stringify(banque.slice(-300), null, 1) + '\n');
    // Soirées annoncées (source officielle, date et lieu certains) : ajoutées tout de suite à l'agenda du site.
    try {
      const { lireCache, fusionner, FICHIER_CACHE } = await import('./recherche.mjs');
      const cacheEv = lireCache();
      const ajouts = sujets.filter((x) => x.source_officielle && /^https?:\/\//.test(x.source_url)).flatMap((x) => (x.soirees || []).map((e) => ({ e, x })))
        .filter(({ e }) => { const t = dateParis(e.debut, { dateSeule: 'minuit' }).getTime(); return e.nom && e.lieu && !isNaN(t) && t > now.getTime() && t < now.getTime() + 120 * 864e5; })
        .map(({ e, x }) => ({
          source: 'web', source_site: (() => { try { return new URL(x.source_url).hostname.replace(/^www\./, ''); } catch { return 'veille'; } })(), via_veille: true,
          name: e.nom.trim(), start: dateParis(e.debut, { dateSeule: 'minuit' }).toISOString(), venue: e.lieu, city: e.ville || '', address: '',
          url: /^https?:\/\//.test(e.billetterie) ? e.billetterie : x.source_url, image: /^https?:\/\//.test(e.affiche) ? e.affiche : (x.image || ''),
          price: typeof e.prix === 'number' && e.prix >= 0 && e.prix < 500 ? e.prix : null, tags: e.styles || [], description: '', public_cible: 0.6,
          confiance: 0.9, accroche: e.accroche && e.accroche.length <= 120 && !/—/.test(e.accroche) ? e.accroche : '',
          instagram: (x.comptes_instagram || []).map((h) => String(h).replace(/^@/, '').toLowerCase()).filter((h) => /^[a-z0-9._]{2,30}$/.test(h)).slice(0, 3),
        }));
      if (ajouts.length && cacheEv.evenements) {
        const avant = cacheEv.evenements.length;
        cacheEv.evenements = fusionner([...cacheEv.evenements, ...ajouts]);
        await writeFile(FICHIER_CACHE, JSON.stringify(cacheEv, null, 2));
        log(`Veille : ${Math.max(0, cacheEv.evenements.length - avant)} nouvelle(s) soirée(s) ajoutée(s) à l'agenda (${ajouts.length} repérée(s)).`);
      }
    } catch (err) { log(`Veille : ajout à l'agenda impossible (${err.message}).`); }

    // Rubrique « Actus » du site : sujets sourcés et assez importants, expliqués simplement.
    const ACTUS = path.join(ROOT, 'contenus', 'actus.json');
    const actus = lire(ACTUS, []);
    for (const s of sujets.filter((x) => x.importance >= (V.seuil_site ?? 60) && x.source_officielle && /^https?:\/\//.test(x.source_url) && x.article?.paragraphes?.length >= 2)) {
      if (actus.some((a) => a.cle === cle(s))) continue;
      actus.push({ cle: cle(s), date: s.date_publication || now.toISOString(), ajout: now.toISOString(), type: s.type, importance: s.importance, source: s.source_url, image: s.image || '', ...s.article });
    }
    await writeFile(ACTUS, JSON.stringify(actus.slice(-200), null, 1) + '\n');
    await mkdir(path.join(ROOT, 'veille'), { recursive: true });
    const md = `## Veille du ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC\n\n${sujets.map((s) => `- **${s.importance}/100** · ${s.type} · ${s.titre} (${s.source_officielle ? 'source officielle' : 'à confirmer'} : ${s.source_url})\n  ${s.raison}`).join('\n') || '- Rien de nouveau.'}\n\n${apublier ? `**Publié tout de suite : ${apublier.titre}**` : eligibles.length ? '_Sujet exceptionnel trouvé, mais hors créneau ou quota du jour atteint._' : '_Rien d\'assez exceptionnel pour un post immédiat._'}\n`;
    const f = path.join(ROOT, 'veille', `${jour}-flash.md`);
    await writeFile(f, (existsSync(f) ? readFileSync(f, 'utf8') + '\n' : '') + md);
  }
  log(`Veille : ${sujets.length} sujet(s) nouveau(x), ${eligibles.length} exceptionnel(s) vérifié(s)${apublier ? ` → publication : « ${apublier.titre} »` : ''}.`);
  return { sujets, apublier, idees };
}
