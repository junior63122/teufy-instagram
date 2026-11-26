# Veille quotidienne Teufy

Journal daté (le plus récent en premier) : changements des prestataires et des réseaux sociaux, règles de publication
mises à jour, sources de soirées réparées ou ajoutées, décisions prises. Tenu par la tâche programmée quotidienne
(demande du directeur du 20/11/2026), à partir de `contenus/veille-technique.json` et des annonces officielles.

## 26/11/2026 : veille quotidienne
- Relevé technique : celui de 6 h 17 pas encore passé à 7 h 50 (GitHub saute souvent cet horaire ; hier il a tourné à 16 h 37) ;
  relevé d'hier lu.
- API Instagram : Meta annonce la v27.0 (en-tête facebook-api-version des réponses). Teufy reste en v26.0, qui fonctionne
  (publications d'hier relues en ligne et conformes) ; le journal des changements de la v27.0 n'a pas pu être lu depuis la session
  (site de Meta non joignable d'ici). Bascule seulement après lecture, à la prochaine veille.
- Failles npm : 0 (racine et studio). Actions GitHub : toutes à jour (checkout v7, setup-node v7, upload-artifact v7, Pages v5,
  cache v6) ; fichier .well-known/tdmrep.json bien en ligne après le passage en Pages v5.
- Soirées des 7 prochains jours : 71 (Nice 24, Toulon 13, Cannes 10, Monaco 5, Juan-les-Pins 3, La Garde 3…) ; 18 sans heure,
  28 sans prix, 9 sans affiche, 2 sans billetterie. Sources muettes inchangées (Shotgun 429, pages Eventbrite 405 : remplacées par
  l'API officielle Eventbrite ; allevents 404).
- Rappels des changements d'hier (Instagram) : plus de réel promo, mercredi en carrousel « petits prix », pas de publication hors
  12 h - 21 h 30, garde-fou anti-doublon (profil relu avant envoi), grille toujours sombre, TikTok en pause.

## 25/11/2026 : veille quotidienne
- Relevé technique : celui de 6 h 17 pas encore passé à 7 h (le robot de veille le relance dès 7 h) ; relevé d'hier 19 h 12 lu.
- DATAtourisme : premier vrai relevé en JSON-LD réussi (9 soirées gardées : Réveillon au Bikini et Kalinka à Toulouse, concerts
  à Aix, Marseille, Tarbes, Cahors). « Reconversion au féminin » (Cahors) n'est pas une soirée : « reconversion » et « formation »
  ajoutés aux exclusions.
- Actions GitHub : upload-artifact v4 → v7 (robots Instagram et veille, aperçus seulement), cache v4 → v6 (contrôle qualité),
  upload-pages-artifact v3 → v5 et deploy-pages v4 → v5 (mise en ligne du site), avec include-hidden-files: true : depuis la v4,
  les fichiers cachés ne partaient plus et .well-known/tdmrep.json (pas d'entraînement des IA) aurait disparu. Vérification
  ajoutée après chaque mise en ligne. Changé à 7 h, hors des créneaux de publication.
- Meta (changelog) : 18/11, la recherche par hashtag (top_media) sera limitée à 200 résultats à partir du 16/02/2027 ; Teufy ne
  l'utilise pas. Rien d'autre depuis le 22/11 qui touche la publication.
- Soirées des 7 prochains jours : 68 (Nice 21, Toulon 13, Cannes 12, Monaco 3, Juan-les-Pins 3, La Garde 3…) ; 18 sans heure,
  25 sans prix, 7 sans affiche, 2 sans billetterie. Sources muettes inchangées (Shotgun 429, pages Eventbrite 405 : remplacées par
  l'API officielle Eventbrite).

## 24/11/2026 : veille quotidienne
- API Instagram (tâche programmée de 14 h 23) : documentation officielle relue (changelog Instagram, versions Graph API, référence
  POST /{ig-user-id}/media). Dernière version v26.0 (29/07/2026) ; v21.0 expire le 21/01/2027. Métriques supprimées depuis v22
  (impressions, plays, clips_replays_count, ig_reels_aggregated_all_plays_count) : aucune n'est demandée par Teufy (views, reach,
  saved, shares, total_interactions, ig_reels_avg_watch_time). Bascule en v26.0 par défaut (IG_API_VERSION), prospection comprise ;
  repli automatique sur v21.0 si Meta refuse la version. Étiquette « IA info » : paramètre is_ai_generated=true (changelog du
  22/06/2026, toutes versions ; carrousel : conteneur principal seulement), mis quand un visuel contient une photo de la DA
  (générée par Gemini) ; relu après publication (GET ?fields=is_ai_generated) ; champ « ia » dans l'historique. À vérifier au
  premier passage de publication de ce soir.
  Résultat (contrôle de 19 h 53) : passages de 16 h, 17 h et 18 h (UTC) en v26.0 sans repli ; carrousel bons plans et réel « Tague
  ton pote » publiés, relus en ligne et conformes (ia = true dans l'historique, aucune alerte « étiquette absente ») ; story repost
  refusée une fois par Instagram (code 2207076), reprise et en ligne au passage suivant. 2 tests de l'IA échouaient sur le robot
  (vrai compteur de dépense au plafond) : rendus indépendants du compteur.
- Relevé technique : celui de la veille a tourné à 16 h 59 (horaire de 6 h 17 sauté par GitHub, relancé ensuite) ; celui du jour sera
  relancé par le robot de veille à partir de 7 h.
- Actions GitHub : checkout et setup-node passés en v7 sur tous les robots (essayées 2 jours sur la veille technique sans souci).
  Restent en essai séparé : upload-artifact (v7), upload-pages-artifact (v5), deploy-pages (v5), cache (v6).
- DATAtourisme : 67 879 lignes lues, toutes écartées « sans nom ni date » (le découpage des lignes ne suit pas l'en-tête) :
  séparateur détecté automatiquement et aperçu brut des premières lignes dans le journal du prochain relevé.
  Suite (fin de matinée) : l'aperçu montre que le « CSV simplifié » publié sur data.gouv.fr (data.cquest.org) ne contient plus que
  l'identifiant, le titre et le type ; dates, villes et liens sont vides sur toutes les lignes. Réparé : lecture de l'export complet
  JSON-LD du même jeu de données (700 Mo, lu en flux en 10 s), heure prise sur la fiche ou ses horaires (jamais inventée), tri des
  vraies sorties (pas d'exposition, de marché, de visite, d'église ni de concert classique). Essai sur l'export du 23/11 : 67 301
  fiches, 12 638 dans les 60 jours, 9 soirées gardées (Toulouse, Cahors, Tarbes, Aix, Marseille) ; aucune sur la Côte, où l'agenda
  officiel ne recense presque pas la nuit. 2 517 fiches sans heure de début écartées (dont une dizaine de réveillons et bals).
  Au passage : villes reconnues en mot entier (« Rennes » trouvait Marennes, « la » de La Grande-Motte classait en Occitanie toute
  adresse contenant « la », dont deux soirées de Gênes).
- Meta : aucune dépréciation de publication annoncée ; nouveautés de l'API de publication (28/09/2026) : sondages et invitations à
  commenter en complément de légende, et paramètre is_ai_generated (étiquette IA) à la création du média (migration prévue aujourd'hui).
  Source : developers.facebook.com/docs/instagram-platform/changelog.
- Gemini rouvert hier soir (crédit rechargé par le directeur) : réels avec scénario et 2 nouvelles photos de la DA par jour.
- Soirées des 7 prochains jours (relevé de la veille) : 40, dont 12 sans heure, 12 sans prix, 11 sans affiche.

## 23/11/2026

- **Robot « Veille technique »** : relevé du jour pas encore fait à 7 h 50 (horaire GitHub sauté, comme souvent) ; la veille le relance
  dès 8 h. Premier passage des **agendas ouverts** (DATAtourisme, OpenAgenda) avec lui : contrôle prévu à 9 h 15.
- **Actions GitHub** : essai des nouvelles versions majeures sur le seul robot sans publication (checkout v7, setup-node v7 dans
  « Veille technique ») ; si son passage d'aujourd'hui est bon, généralisation aux autres robots, hors créneaux de publication.
- **Meta / Instagram** : pas d'annonce de novembre trouvée (dernière entrée du changelog : 05/10/2026). À retenir pour la migration
  du 24/11 : depuis le 28/09/2026, l'API de publication accepte le paramètre `is_ai_generated` à la création du conteneur
  (étiquette « contenu généré par IA », demandée par le directeur le 21/11), ainsi que des sondages en légende.
- **Failles npm** : 0 (racine et studio). **Groq** : toujours pas de modèle de lecture d'image ni de recherche web (secours en place).
- **Soirées** : 36 dans les 7 prochains jours (Nice 19, Toulon 4, Cannes 4…) ; Eventbrite par son API (clé du directeur) ajouté
  le 22/11, Ticketmaster et OpenAgenda en attente de leur clé.

## 22/11/2026

- **Eventbrite bloque nos robots** (HTTP 405, vérification anti-robot) sur ses 12 pages depuis le 20/11, et Shotgun (429) :
  c'étaient nos plus grosses sources ; le site est passé à 67 soirées. On ne contourne pas un blocage : leurs soirées passent
  désormais par le moteur de recherche (Tavily), ville par ville (3 recherches Eventbrite + 1 Shotgun Nice en plus), 12 recherches
  de soirées par jour au lieu de 6, 15 résultats par recherche au lieu de 8 (même coût). Budget : environ 22 recherches par jour
  sur 30 autorisées. État : PENDING_VERIFICATION (prochaine recherche complète demain matin).
- **Robot « Veille technique » : horaire de 6 h 17 encore sauté par GitHub** (dernier relevé le 21/11 à 14 h 29). Réparé : le robot
  de veille le relance maintenant dès 7 h (Paris) s'il n'a pas tourné le jour même (avant : seulement après 20 h sans passage).
  Sauvegarde du jour créée par ce passage. État : PENDING_VERIFICATION (premier passage de la veille vers 8 h).
- **Failles npm (studio)** : 10 « hautes » venant de zod < 4.6.6 (épuisement mémoire sur collections énormes, GHSA-mrhx-c7xc-m3w5),
  embarqué par Remotion. Corrigé en imposant zod 4.6.7 (publié le 12/10/2026, plus de 2 semaines) ; `npm audit` : 0 faille.
  Rendu d'une story vérifié à l'œil (Remotion signale qu'il attend zod 4.5.4 exact : avertissement seulement, rendu correct ;
  à revoir à la prochaine mise à jour de Remotion).
- **Node 20 en fin de vie** : les workflows Instagram, Contrôle qualité et Test IA passent à Node 22 (changé à 8 h, hors
  créneaux de publication). Actions GitHub (checkout, setup-node, cache, upload/deploy-pages) : nouvelles versions majeures
  publiées ; GitHub les fait déjà tourner sous Node 24 ; montée de version prévue à la veille hebdomadaire de lundi, une à la
  fois, hors créneaux de publication.
- **Billetteries** : DICE Monaco n'existe plus (404) : retirée. Bizouk répond mais n'a aucune soirée de la Côte en ce moment
  (lecture correcte, seulement des soirées d'Île-de-France et des Antilles). Shotgun bloque les robots (429), Allevents et Xceed
  Cannes/Monaco renvoient 0 : non joignables depuis l'environnement de Claude, à examiner depuis le robot (veille hebdomadaire).
- **Annonces officielles** : rien de nouveau trouvé pour Meta / Instagram (dernières entrées : v26 du 29/07/2026, réponses
  rapides désactivées le 05/10/2026) ni pour Groq (dernier retrait : groq/compound le 21/09/2026 ; gpt-oss-120b toujours ouvert).
  API Instagram v21 : migration toujours prévue le 24/11 (retrait le 21/01/2027).
- **Soirées** : 37 dans les 7 prochains jours (Nice 22, Cannes 5, Toulon 3, La Seyne 3, Roquebrune 2, Monaco 1) ; 11 sans affiche.
- **Hier soir aussi** : mise en ligne du site fiabilisée (deuxième essai si GitHub ne voit pas encore l'envoi : 9 échecs et
  autant de mails le 21/11), mise à jour du site plafonnée à 15 min, appels IA avec échéance, tableau de bord /pilotage/.

## 21/11/2026

- **Robot « Veille technique » : n'a jamais tourné** (GitHub n'a pas déclenché l'horaire de 6 h 17 du nouveau robot). Réparé :
  le robot de veille (toutes les 30 min) le relance s'il n'a pas tourné depuis 20 h. État : PENDING_VERIFICATION (premier relevé
  attendu au prochain passage de la veille, vers 8 h).
- **API Instagram (Meta Graph API)** : nous utilisons v21.0, **retirée le 21/01/2027** (source : blog développeurs Meta, annonce de la
  v26). Dernière version : v26.0 (juillet 2026). Décision : migration à préparer cette semaine (vérifier les métriques des
  statistiques, plusieurs ont changé depuis la v22), à tester sur un passage hors créneau de publication, avant le 15/12.
- **Instagram (changelog)** : nouveautés de 2026 utiles : étiquette « contenu généré par IA » à la publication (`is_ai_generated`),
  étiquette « Partenariat rémunéré », réels d'essai (Trial Reels), suppression de média par l'API, sondages en légende. À décider :
  marquer « IA » les visuels dont le décor est une photo générée par IA (règles de Meta sur les images réalistes générées).
- **Groq** : `groq/compound` (recherche web) retiré le 21/09/2026 (confirme l'absence de recherche web chez Groq → Tavily) ;
  `llama-3.3-70b-versatile` retiré le 16/08/2026 ; nos modèles principaux (gpt-oss-120b / 20b) restent ouverts. Aucune fin annoncée
  pour novembre.
- **Soirées** : 35 soirées dans les 7 prochains jours (Nice 20, Cannes 5, Toulon 3, La Seyne 3, Roquebrune 2, Monaco 1) : trop peu,
  surtout Monaco. Cause principale : recherche web arrêtée tant que la clé Tavily n'est pas ajoutée. Instagram des clubs : 93
  comptes relus en 24 h (rotation OK). Billetteries : 15 soirées (Allevents 10, Xceed 3, DICE 2) ; Eventbrite, Shotgun, Bizouk
  muets. Sites des clubs : 37 sites sur 68 lus, **0 soirée** extraite (les sites ne publient pas de données structurées) : lecture
  à améliorer (pages « événement » des clubs).

## 20/11/2026 — mise en place

- Relevé automatique quotidien créé (`outils/veille-technique.mjs`, workflow « Veille technique », 6 h 17 à Paris).
- Points déjà repérés, à traiter : Node 20 en fin de vie (workflows qualité, test IA et Instagram encore en Node 20) ;
  10 failles « hautes » dans les dépendances de `studio/` (npm audit) ; API Instagram en v21.0 (vérifier la date de fin de
  vie annoncée par Meta et monter de version après une publication de test) ; modèles Groq de lecture d'images
  (llama-4-scout / maverick) absents de la liste des modèles ouverts du compte : lecture des affiches par Groq à rebrancher.
- Billetteries ajoutées : Eventbrite (musique, Saint-Tropez, Fréjus), DICE Monaco, Allevents, Xceed, Shotgun Nice. Le relevé
  dira lesquelles donnent vraiment des soirées ; celles qui restent muettes seront réparées ou remplacées.

### 23/11/2026 (suite) : relevé des agendas ouverts
- Veille technique de 07 h 11 : échec à l'enregistrement (`git add` sur `contenus/visites.json`, absent tant que la clé GoatCounter
  n'est pas mise ; erreur de ma part). Rien n'a été enregistré (agendas, fiches des 40 vidéos du Drive, relevé). Corrigé : seuls les
  fichiers présents sont ajoutés. Les actions checkout@v7 / setup-node@v7 ont fonctionné.
- DATAtourisme : l'export « événements » est compressé (gzip) malgré son nom en .csv ; 52 166 lignes illisibles, 0 soirée gardée.
  Corrigé : décompression si besoin et lecture des champs sur plusieurs lignes (test ajouté). Vérification au prochain relevé.
- 10 h 30 : bilan des soirées. Le site affiche 108 soirées (67 le 22/11). Recherche web : 88 soirées à venir (Shotgun 34,
  Instagram 28, autres billetteries et sites) ; API Eventbrite : 28 ; Tavily : 30 recherches aujourd'hui (plafond atteint, pas
  dépassé). DATAtourisme : la décompression marche (69 771 événements lus) mais 0 gardé ; lecture des dates rendue tolérante
  (plusieurs dates dans une case, format français) et motifs de rejet écrits dans le journal. Vérification au relevé de demain matin.
- Veille hebdomadaire + audit du site (S48) : rapport `audits/2026-11-23.md`. Lecture des affiches par Groq rebranchée
  (`qwen/qwen3.8-27b`, les Llama 4 sont retirés) ; plus d'alerte quotidienne pour la recherche web de Groq (Tavily la remplace).
- Vérification de l'état réel des 142 lieux de l'annuaire (recherche web, sources citées : `audits/verif-lieux/2026-11-23.json`),
  après le signalement du directeur (Gotha fermé définitivement, Bâoli annoncé ouvert hors saison) : 17 lieux retirés (3 fermés
  définitivement : Gotha, MK Club Monaco, Explorers Pub ; 4 doublons ; 10 introuvables ou qui ne sont pas des lieux de nuit),
  27 saisons enregistrées (« Fermé hors saison » affiché hors période), 11 villes corrigées (Grimaud, Ramatuelle, Monaco).
  Restent 64 lieux « incertains » (pas de preuve datée 2025-2026) : à revérifier au prochain contrôle.
