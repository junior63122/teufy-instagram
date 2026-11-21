# Veille quotidienne Teufy

Journal daté (le plus récent en premier) : changements des prestataires et des réseaux sociaux, règles de publication
mises à jour, sources de soirées réparées ou ajoutées, décisions prises. Tenu par la tâche programmée quotidienne
(demande du directeur du 20/11/2026), à partir de `contenus/veille-technique.json` et des annonces officielles.

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
