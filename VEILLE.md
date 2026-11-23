# Veille quotidienne Teufy

Journal daté (le plus récent en premier) : changements des prestataires et des réseaux sociaux, règles de publication
mises à jour, sources de soirées réparées ou ajoutées, décisions prises. Tenu par la tâche programmée quotidienne
(demande du directeur du 20/11/2026), à partir de `contenus/veille-technique.json` et des annonces officielles.

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
