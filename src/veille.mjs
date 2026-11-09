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
  const comptes = [...new Set([...(orgas.comptes || []), ...(orgas.suggeres || [])])].slice(0, 45);
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

const texteOk = (s, max) => typeof s === 'string' && s.trim().length > 2 && s.length <= max && !/—|lien en bio|t[ée]l[ée]charg/i.test(s);

/** Analyse de veille. Renvoie { sujets, apublier (ou null), idees } et met à jour les fichiers de suivi. */
export async function veiller({ config, now = new Date(), ig = null, api = {}, ia = LLM, log = console.log, dryRun = false } = {}) {
  const V = config.veille || {};
  const vus = lire(VUS, {});
  const jour = now.toISOString().slice(0, 10);
  const heureParis = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(now), 10);

  // 1. Signaux.
  const posts = ig && api.businessDiscovery ? await postsRecents({ ig, api, now, heures: V.fenetre_heures ?? 36, log }) : [];
  log(`Veille : ${posts.length} post(s) Instagram récents chez les comptes suivis.`);
  const web = await ia.rechercher({
    config, gratuit: true,
    system: `Tu fais la veille d'un média Instagram. ${CIBLE} Tu ne rapportes que des faits publiés, datés et sourcés.`,
    prompt: `Nous sommes le ${now.toISOString()} (heure de Paris : ${heureParis}h). Cherche ce qui a été annoncé ou publié dans les dernières ${V.fenetre_heures ?? 36} heures :
1. Annonces de la Côte d'Azur et alentours : nouvelle édition ou date d'un festival, line-up, tête d'affiche, ouverture, réouverture ou fermeture d'un club ou d'un lieu, soirée inédite, billetterie qui ouvre, événement annulé.
2. Actualité en France qui touche les sorties des 17-30 ans : prix (billets, boissons, transports), lois et règlements (horaires, sécurité, alcool, bruit), grèves ou manifestations qui perturbent des événements, transports de nuit, nouvelles habitudes.
Pour chaque point : titre, date et heure de publication, URL de la source la plus officielle, résumé factuel. Ignore ce qui a plus de ${V.fenetre_heures ?? 36} heures et les soirées ordinaires sans rien de spécial.`,
  });

  // 2. Tri.
  let d;
  try {
    d = await ia.json({
      config, gratuit: true, nom: 'veille', schema: SCHEMA,
      system: `Tu es rédacteur en chef d'un média Instagram. ${CIBLE} Tu notes l'importance avec exigence : une soirée ordinaire parmi des centaines ne dépasse pas 40. N'invente rien ; sans source officielle datée, source_officielle = false.`,
      prompt: `Signaux de la veille (web) :\n${web || '(aucun)'}\n\nPosts Instagram récents des organisateurs et lieux suivis (sources officielles) :\n${JSON.stringify(posts).slice(0, 40000)}\n\nDéjà traités (ne les reprends pas) :\n${Object.keys(vus).slice(-200).join('\n')}\n\nListe les sujets nouveaux selon le schéma.`,
    });
  } catch (err) { log(`Veille : tri impossible (${err.message}).`); return { sujets: [], apublier: null, idees: [] }; }

  const frais = (s) => { const t = Date.parse(s.date_publication); return !isNaN(t) && now - t <= (V.fenetre_heures ?? 36) * 3600e3 && t <= now.getTime() + 3600e3; };
  const cle = (s) => `${jour.slice(0, 7)}|${s.titre.toLowerCase().replace(/[^a-z0-9àâçéèêëîïôûùüÿœ]+/g, ' ').trim().slice(0, 80)}`;
  const sujets = (d.sujets || []).filter((s) => s.titre && !vus[cle(s)] && !Object.keys(vus).some((k) => k.split('|')[1] === cle(s).split('|')[1]));

  // 3. Décision.
  const publiesAujourdhui = Object.values(vus).filter((v) => v.publie && v.le?.startsWith(jour)).length;
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
    for (const s of sujets) vus[cle(s)] = { le: now.toISOString(), importance: s.importance, source: s.source_url, publie: s === apublier };
    const banque = lire(IDEES, []);
    for (const s of idees) banque.push({ id: `idee-${hash(s.titre)}`, ajout: now.toISOString(), type: s.type, format: s.format, titre: s.titre, angle: s.angle, resume: s.resume, source: s.source_url, importance: s.importance });
    await mkdir(path.dirname(VUS), { recursive: true });
    await writeFile(VUS, JSON.stringify(Object.fromEntries(Object.entries(vus).slice(-1500)), null, 1) + '\n');
    await writeFile(IDEES, JSON.stringify(banque.slice(-300), null, 1) + '\n');
    // Soirées annoncées (source officielle, date et lieu certains) : ajoutées tout de suite à l'agenda du site.
    try {
      const { lireCache, fusionner, FICHIER_CACHE } = await import('./recherche.mjs');
      const cacheEv = lireCache();
      const ajouts = sujets.filter((x) => x.source_officielle && /^https?:\/\//.test(x.source_url)).flatMap((x) => (x.soirees || []).map((e) => ({ e, x })))
        .filter(({ e }) => e.nom && e.lieu && !isNaN(Date.parse(e.debut)) && Date.parse(e.debut) > now.getTime() && Date.parse(e.debut) < now.getTime() + 120 * 864e5)
        .map(({ e, x }) => ({
          source: 'web', source_site: (() => { try { return new URL(x.source_url).hostname.replace(/^www\./, ''); } catch { return 'veille'; } })(), via_veille: true,
          name: e.nom.trim(), start: new Date(e.debut).toISOString(), venue: e.lieu, city: e.ville || '', address: '',
          url: /^https?:\/\//.test(e.billetterie) ? e.billetterie : x.source_url, image: /^https?:\/\//.test(e.affiche) ? e.affiche : (x.image || ''),
          price: typeof e.prix === 'number' && e.prix >= 0 && e.prix < 500 ? e.prix : null, tags: e.styles || [], description: '', public_cible: 0.6,
          confiance: 0.9, accroche: e.accroche && e.accroche.length <= 120 && !/—/.test(e.accroche) ? e.accroche : '',
          instagram: (x.comptes_instagram || []).map((h) => String(h).replace(/^@/, '').toLowerCase()).filter((h) => /^[a-z0-9._]{2,30}$/.test(h)).slice(0, 3),
        }));
      if (ajouts.length && cacheEv.evenements) {
        const avant = cacheEv.evenements.length;
        cacheEv.evenements = fusionner([...cacheEv.evenements, ...ajouts]);
        await writeFile(FICHIER_CACHE, JSON.stringify(cacheEv, null, 2));
        log(`Veille : ${cacheEv.evenements.length - avant} nouvelle(s) soirée(s) ajoutée(s) à l'agenda (${ajouts.length} repérée(s)).`);
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
