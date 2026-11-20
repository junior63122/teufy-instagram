# Veille quotidienne Teufy

Journal daté (le plus récent en premier) : changements des prestataires et des réseaux sociaux, règles de publication
mises à jour, sources de soirées réparées ou ajoutées, décisions prises. Tenu par la tâche programmée quotidienne
(demande du directeur du 20/11/2026), à partir de `contenus/veille-technique.json` et des annonces officielles.

## 20/11/2026 — mise en place

- Relevé automatique quotidien créé (`outils/veille-technique.mjs`, workflow « Veille technique », 6 h 17 à Paris).
- Points déjà repérés, à traiter : Node 20 en fin de vie (workflows qualité, test IA et Instagram encore en Node 20) ;
  10 failles « hautes » dans les dépendances de `studio/` (npm audit) ; API Instagram en v21.0 (vérifier la date de fin de
  vie annoncée par Meta et monter de version après une publication de test) ; modèles Groq de lecture d'images
  (llama-4-scout / maverick) absents de la liste des modèles ouverts du compte : lecture des affiches par Groq à rebrancher.
- Billetteries ajoutées : Eventbrite (musique, Saint-Tropez, Fréjus), DICE Monaco, Allevents, Xceed, Shotgun Nice. Le relevé
  dira lesquelles donnent vraiment des soirées ; celles qui restent muettes seront réparées ou remplacées.
