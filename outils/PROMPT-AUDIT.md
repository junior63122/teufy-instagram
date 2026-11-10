# PROMPT CLAUDE CODE — AUDIT INTÉGRAL, OPTIMISATION ET VALIDATION EXHAUSTIVE DU SITE INTERNET

> Prompt complet fourni par le directeur de Teufy. Il se lance en écrivant simplement **`audit`** (ou `/audit`)
> dans une session Claude Code (voir `CLAUDE.md` et `.claude/commands/audit.md`). Synthèse : `PROTOCOLE-QUALITE.md`.

## 1. MISSION PRINCIPALE

Tu es chargé d’effectuer un audit technique, fonctionnel, visuel et stratégique extrêmement approfondi de l’intégralité de mon site internet.

Ton objectif est d’atteindre une qualité de niveau professionnel exceptionnel, avec une note minimale de 99/100 pour chaque catégorie et une note globale cible de 100/100.

Il ne s’agit pas simplement d’inspecter le site ou de me transmettre une liste de recommandations.

Tu dois analyser, tester, identifier les problèmes, les corriger directement dans le code, puis recommencer l’ensemble des vérifications jusqu’à obtenir le meilleur résultat possible.

Aucune anomalie connue ne doit être volontairement laissée sans traitement.

Je ne souhaite pas avoir à te demander plusieurs fois de corriger les mêmes problèmes.

Travaille de manière autonome et méthodique, sans demander systématiquement mon intervention.

Ne considère jamais qu’une fonctionnalité fonctionne uniquement parce que son code semble correct : vérifie son comportement réel.

## 2. SYSTÈME DE NOTATION SUR 100

Évalue systématiquement le site selon cette grille :

| Catégorie | Points |
|---|---|
| Design, esthétique et cohérence visuelle | 10 |
| Expérience utilisateur (UX) et navigation | 10 |
| Performances, vitesse et chargement | 10 |
| Animations, transitions et interactions | 10 |
| Fonctionnalités et fiabilité technique | 15 |
| Compatibilité mobile, tablette et ordinateur | 10 |
| SEO, référencement et indexabilité | 10 |
| Qualité, exactitude et pertinence des contenus | 5 |
| Images, vidéos et médias | 5 |
| Sécurité, robustesse et gestion des erreurs | 5 |
| Accessibilité et bonnes pratiques | 5 |
| Innovation, originalité et finitions premium | 5 |
| **TOTAL** | **100** |

Pour chaque catégorie, fournis :

* Une note justifiée.
* Les problèmes identifiés.
* Leur gravité et leur impact.
* Les corrections réalisées.
* Les résultats des tests après correction.
* Les améliorations supplémentaires possibles.

Important : aucune note ne doit être artificiellement augmentée.

Une note de 100/100 doit correspondre à un résultat démontrable, pas à une simple appréciation subjective.

Si un point ne peut pas être testé ou vérifié, signale-le explicitement.

## 3. AUDIT COMPLET DE TOUTES LES PAGES

Analyse absolument toutes les pages du site, y compris les sous-pages, les pages dynamiques, les formulaires, les menus, les fenêtres modales, les pages d’erreur et les éléments accessibles depuis la navigation.

Vérifie notamment :

* La cohérence entre les différentes pages.
* La qualité des compositions visuelles.
* Les espacements, marges et alignements.
* Les proportions des éléments.
* La hiérarchie des informations.
* La lisibilité et les contrastes.
* La qualité des typographies.
* Les éléments trop grands ou trop petits.
* Les débordements horizontaux et verticaux.
* Les éléments masqués ou coupés.
* Les sections répétitives ou inutiles.
* Les incohérences graphiques.
* Le comportement des menus.
* Les transitions entre les pages.
* La cohérence des en-têtes et pieds de page.
* Les liens internes et externes.
* La présence et le fonctionnement des éléments interactifs.

Chaque page doit présenter une expérience premium, fluide, intuitive et cohérente avec l’identité du site.

Évite absolument les rendus génériques, les compositions approximatives et les effets visuels qui ressemblent à des modèles basiques de sites internet.

## 4. TESTS EXHAUSTIFS DE TOUTES LES FONCTIONNALITÉS

Tu dois tester chaque bouton, chaque lien, chaque clic et chaque interaction du site. Sans exception.

Ne te limite pas au parcours utilisateur idéal.

Teste également les comportements inhabituels, les erreurs et les situations extrêmes.

Pour chaque élément interactif, vérifie :

1. Son fonctionnement normal.
2. Son comportement au premier clic.
3. Les clics multiples et rapides.
4. Les doubles clics.
5. Les interactions successives.
6. Les retours en arrière.
7. Les changements de page.
8. Les actualisations de page.
9. Les chargements lents.
10. Les interruptions réseau.
11. Les connexions instables.
12. Les saisies invalides.
13. Les champs vides.
14. Les caractères spéciaux.
15. Les textes très longs.
16. Les changements de résolution.
17. Les interactions au clavier.
18. Les interactions tactiles.
19. Les erreurs de serveur.
20. Les actions effectuées dans un ordre inhabituel.

Teste les formulaires de bout en bout : validation, envoi réel dans un environnement de test autorisé, réception, messages de confirmation, protection contre les doublons et gestion des erreurs.

Un formulaire qui affiche simplement « Envoyé » sans transmettre correctement les informations n’est pas fonctionnel.

Teste aussi les cas où l’utilisateur quitte une page, revient, clique rapidement ou utilise plusieurs onglets.

L’objectif est d’identifier non seulement les bugs évidents, mais également ceux qui apparaissent dans des circonstances particulières.

## 5. TESTS AUTOMATISÉS ET SIMULATION D’UTILISATEURS

Utilise les outils adaptés à l’environnement technique du projet, notamment Playwright, Lighthouse, les outils de développement des navigateurs et les tests unitaires ou d’intégration lorsque cela est pertinent.

Crée ou complète une suite de tests automatisés couvrant :

* Tous les parcours utilisateurs principaux.
* Les liens et boutons.
* Les formulaires.
* Les menus et sous-menus.
* Les interactions JavaScript.
* Les animations importantes.
* Les changements de langue.
* Les routes et les pages dynamiques.
* Les états de chargement.
* Les erreurs et les messages de confirmation.
* Les usages sur mobile.
* Les parcours de navigation complexes.

Effectue également des tests exploratoires et de robustesse pour chercher activement à faire dysfonctionner le site.

Chaque bug découvert doit être documenté, reproduit, corrigé et vérifié à nouveau.

Ajoute un test de non-régression lorsque cela est possible pour empêcher le problème de réapparaître.

## 6. VÉRIFICATION INTÉGRALE DES IMAGES ET VIDÉOS

Cette partie est particulièrement importante.

Chaque image et chaque vidéo doit fonctionner parfaitement, être visible correctement et remplir sa fonction réelle.

### Images

Vérifie :

* Que chaque image existe.
* Qu’aucune image n’est cassée.
* Que son chargement fonctionne.
* Que sa résolution est suffisante.
* Que son cadrage est adapté.
* Qu’aucun visage ou élément important n’est coupé.
* Que le format est optimisé.
* Que la compression ne dégrade pas visiblement la qualité.
* Que le chargement différé fonctionne lorsqu’il est pertinent.
* Que les attributs ALT sont correctement renseignés.
* Que les images s’adaptent à toutes les tailles d’écran.
* Que leurs dimensions ne provoquent pas de décalages de mise en page.

### Vidéos

Vérifie pour chaque vidéo :

* Qu’elle se charge réellement.
* Qu’elle démarre correctement.
* Qu’elle ne se coupe pas au bout de quelques secondes sans raison.
* Qu’elle peut être lue jusqu’à la fin lorsqu’une lecture complète est prévue.
* Qu’elle n’est pas bloquée par un problème de navigateur.
* Que sa durée est correctement interprétée.
* Que son cadrage est cohérent.
* Que sa résolution reste satisfaisante.
* Que le son fonctionne lorsque nécessaire.
* Que les contrôles sont fonctionnels.
* Que le plein écran fonctionne lorsqu’il est proposé.
* Que son comportement est correct sur iPhone, Android et ordinateur.
* Que les éventuelles boucles sont fluides.
* Que son chargement ne ralentit pas excessivement la page.

Une vidéo de 30 secondes ne doit pas être considérée comme fonctionnelle si seules les deux premières secondes sont visibles.

Teste réellement sa lecture, son comportement et sa fin.

Distingue les vidéos décoratives volontairement courtes ou en boucle des vidéos destinées à être visionnées intégralement.

Respecte également les contraintes de lecture automatique propres aux navigateurs.

## 7. OPTIMISATION DES PERFORMANCES

Cherche à rendre le site extrêmement rapide, sans sacrifier sa qualité visuelle.

Analyse notamment :

* Les temps de chargement.
* Le poids des pages.
* Le poids des images et vidéos.
* Les requêtes réseau.
* Les ressources bloquantes.
* Les scripts inutiles.
* Les dépendances trop lourdes.
* Les problèmes JavaScript.
* La mise en cache.
* La compression des fichiers.
* Le chargement différé.
* Les décalages visuels.
* La réactivité des interfaces.
* Les performances des animations.
* La consommation excessive de mémoire.

Mesure les Core Web Vitals.

Objectifs indicatifs au 75e percentile des visites réelles :

* LCP inférieur ou égal à 2,5 secondes.
* INP inférieur ou égal à 200 millisecondes.
* CLS inférieur ou égal à 0,1.

Vise également un score Lighthouse Performance de 95 à 100 sur mobile et ordinateur, lorsque cela est techniquement réaliste.

Ne confonds pas les mesures de laboratoire avec les performances réelles des utilisateurs.

## 8. ANIMATIONS, MOTION DESIGN ET INTERACTIONS

Le site doit proposer des animations sophistiquées, modernes et fluides, sans devenir excessif ou fatigant.

Analyse et améliore :

* Les transitions de pages.
* Les apparitions des sections.
* Les effets au défilement.
* Les animations des boutons.
* Les menus interactifs.
* Les effets de survol.
* Les mouvements des images.
* Les transitions typographiques.
* Les effets de profondeur.
* Les changements d’état.
* Les micro-interactions.
* Les transitions entre les contenus.

Les animations doivent être suffisamment travaillées pour produire une véritable sensation de qualité et de modernité.

Elles ne doivent jamais empêcher l’utilisateur de lire, cliquer ou naviguer.

Vérifie notamment qu’elles restent fluides sur les smartphones moins puissants et qu’elles respectent les préférences de réduction des mouvements.

Ne rajoute pas des animations uniquement pour augmenter artificiellement la note.

## 9. RESPONSIVE DESIGN ET COMPATIBILITÉ MULTI-APPAREILS

Le site doit être entièrement vérifié sur ordinateur, tablette et smartphone.

Teste plusieurs résolutions et formats d’écran, en portrait et en paysage lorsque cela est pertinent.

Vérifie en particulier :

* iPhone et Safari iOS.
* Smartphones Android et Chrome.
* Tablettes.
* Ordinateurs Windows.
* macOS et Safari.
* Chrome.
* Firefox.
* Edge.

Teste les tailles intermédiaires, pas uniquement quelques résolutions standards.

Aucun texte ne doit être coupé, aucun bouton inaccessible, aucune image mal dimensionnée et aucun élément important masqué.

Vérifie aussi le zoom navigateur, les variations de taille de police et les changements d’orientation.

Ne prétends pas avoir testé physiquement un appareil si tu as uniquement utilisé une simulation.

## 10. SEO, INDEXATION ET VISIBILITÉ GOOGLE

Je souhaite que le site soit techniquement optimisé pour les moteurs de recherche.

Analyse et corrige :

* Les balises Title.
* Les meta descriptions.
* La hiérarchie H1, H2 et H3.
* Les URL.
* Les liens internes.
* Les redirections.
* Les balises canonical.
* Le fichier robots.txt.
* Le sitemap.xml.
* Les erreurs 404.
* Les pages inutilement dupliquées.
* Les pages bloquées à l’indexation.
* Les attributs ALT.
* Les données structurées Schema.org.
* Les balises Open Graph.
* Les aperçus de partage.
* Les versions linguistiques et hreflang lorsque nécessaires.
* L’accessibilité du contenu aux robots.
* Le référencement des images.
* Le référencement des vidéos.
* La qualité du contenu textuel.
* Les performances ayant un impact sur l’expérience de recherche.

Vérifie que toutes les pages publiques destinées à apparaître dans les moteurs de recherche sont explorables et indexables.

Cela ne signifie pas que toutes les URL doivent être indexées : les pages techniques, privées, dupliquées ou sans valeur SEO doivent être traitées correctement.

Ne confonds pas éligibilité à l’indexation et indexation réellement effectuée par Google.

Si Search Console est disponible, utilise ses informations pour vérifier la couverture, les erreurs et les performances de recherche.

## 11. SÉCURITÉ ET ROBUSTESSE

Effectue un audit des principaux risques de sécurité, dans le périmètre autorisé du projet.

Vérifie notamment :

* Les entrées utilisateur.
* La validation côté serveur.
* Les risques XSS.
* Les protections CSRF lorsque nécessaires.
* La gestion des sessions.
* Les permissions.
* La confidentialité des informations.
* L’exposition des clés API.
* Les variables d’environnement.
* Les dépendances vulnérables.
* Les en-têtes HTTP de sécurité.
* HTTPS.
* Les liens externes.
* Les routes sensibles.
* Les messages d’erreur.
* Les mécanismes anti-spam.
* Les limitations de requêtes lorsque pertinentes.

Ne réalise pas de tests destructifs ou agressifs sur des services tiers ou en production.

Pour les essais présentant un risque, privilégie un environnement local ou de préproduction.

## 12. ACCESSIBILITÉ ET INCLUSION

Vise la conformité WCAG 2.2 niveau AA pour les éléments applicables.

Vérifie :

* Le contraste des textes.
* La navigation au clavier.
* Les indicateurs de focus.
* Les libellés des formulaires.
* Les alternatives textuelles.
* La structure sémantique.
* La compatibilité avec les lecteurs d’écran.
* La taille des zones cliquables.
* Les messages d’erreur accessibles.
* La gestion des modales.
* Les sous-titres lorsque requis.
* Les préférences de mouvement réduit.

Combine les tests automatisés avec des vérifications manuelles : un score automatique ne garantit pas à lui seul l’accessibilité.

## 13. VÉRIFICATION DES CONTENUS ET INFORMATIONS

Relis et contrôle l’intégralité des textes du site.

Corrige :

* Les fautes d’orthographe.
* Les erreurs grammaticales.
* Les maladresses rédactionnelles.
* Les répétitions.
* Les textes peu compréhensibles.
* Les intitulés incohérents.
* Les appels à l’action peu clairs.
* Les informations contradictoires.
* Les dates incohérentes.
* Les contenus laissés en placeholder.
* Les traductions incomplètes.

Vérifie que chaque section apporte une véritable valeur à l’utilisateur.

Respecte strictement les informations validées et existantes.

N’invente jamais de chiffres, références, réalisations, témoignages, partenaires ou informations commerciales.

N’effectue pas non plus de modification substantielle des informations importantes sans disposer d’une source fiable dans le projet.

## 14. VÉRIFICATIONS SUPPLÉMENTAIRES OBLIGATOIRES

Contrôle également les points souvent oubliés :

* Favicon et icônes du site.
* Affichage dans les résultats de recherche.
* Aperçus lors du partage sur WhatsApp, LinkedIn et réseaux sociaux.
* Comportement du bouton retour.
* Liens profonds vers les pages internes.
* Actualisation directe d’une sous-page.
* Cookies et consentement lorsqu’ils sont requis.
* Pages de confidentialité et mentions légales.
* Espacement du contenu avec les encoches des smartphones.
* Claviers mobiles et champs de formulaire.
* Z-index et superposition des éléments.
* Images de secours lorsque les médias échouent.
* Messages de chargement.
* Gestion des erreurs réseau.
* États vides.
* Événements et outils d’analyse d’audience.
* Absence d’erreurs critiques dans la console.
* Absence de requêtes réseau inutilement échouées.
* Fonctionnement après compilation pour la production.
* Conservation de l’état utilisateur lorsque nécessaire.
* Fonctionnement des URL après déploiement.
* Absence de régressions sur les fonctionnalités déjà validées.

## 15. PROCESSUS DE CORRECTION EN BOUCLE

C’est l’une des exigences les plus importantes de toute cette mission.

Tu dois fonctionner selon ce cycle :

**BOUCLE 1 — ANALYSER.** Explore l’intégralité du site. Identifie les anomalies techniques, visuelles, fonctionnelles et éditoriales. Attribue une première note sur 100 en justifiant précisément les résultats.

**BOUCLE 2 — CORRIGER.** Corrige directement les anomalies découvertes. Priorise les erreurs critiques, puis les problèmes fonctionnels, les performances et les finitions.

**BOUCLE 3 — TESTER.** Relance l’ensemble des tests nécessaires. Contrôle particulièrement les éléments modifiés et ceux susceptibles d’avoir été affectés indirectement.

**BOUCLE 4 — ÉVALUER.** Attribue une nouvelle note sur 100. Compare les résultats avant et après correction, avec des mesures réelles lorsque cela est possible.

**BOUCLE 5 — RECOMMENCER.** Si la note globale reste inférieure à 99/100, ou si une catégorie est inférieure à 99 % de son maximum, recommence le cycle d’amélioration.

Même après avoir atteint 99/100, recherche les améliorations raisonnables permettant de se rapprocher de 100/100.

Ne t’arrête pas au premier résultat satisfaisant.

Effectue autant de cycles que nécessaire et techniquement possible pendant l’exécution.

Si la progression se bloque, ne répète pas indéfiniment les mêmes opérations : identifie les causes, change de méthode et documente les limites.

Ne déclare jamais 100/100 pour simplement mettre fin au processus.

Les erreurs bloquantes, les tests échoués et les vérifications non réalisées doivent rester visibles dans le rapport.

## 16. CRITÈRES DE VALIDATION FINALE

Le travail ne peut être considéré comme intégralement validé que lorsque :

* Toutes les pages identifiées ont été auditées.
* Tous les éléments interactifs répertoriés ont été testés.
* Tous les liens ont été vérifiés.
* Tous les formulaires ont été testés de bout en bout.
* Toutes les vidéos ont été vérifiées selon leur durée et leur comportement attendu.
* Toutes les images sont correctement affichées.
* Les parcours utilisateurs critiques fonctionnent.
* Les tests automatisés passent.
* Aucune erreur critique connue ne subsiste.
* Les performances ont été mesurées.
* Les principaux problèmes SEO sont traités.
* Les principales exigences d’accessibilité sont vérifiées.
* Les comportements mobiles sont validés.
* La version de production a été testée.
* Les corrections ont été contrôlées contre les régressions.

Une note élevée ne remplace jamais ces conditions fonctionnelles.

## 17. RAPPORT FINAL OBLIGATOIRE

À la fin de chaque exécution, remets-moi un rapport structuré comprenant :

* **A. Note générale** : score initial, score final et évolution.
* **B. Notes détaillées** : évaluation de chacune des 12 catégories.
* **C. Inventaire des tests** : nombre de pages, boutons, liens, formulaires, médias et parcours contrôlés.
* **D. Bugs identifiés** : problèmes découverts, gravité et conséquences.
* **E. Corrections effectuées** : fichiers modifiés et nature des changements.
* **F. Résultats des tests** : tests réussis, échoués, non exécutés et raisons éventuelles.
* **G. Performances** : mesures avant/après sur mobile et ordinateur.
* **H. SEO** : état de l’indexabilité, du sitemap et des principales optimisations.
* **I. Compatibilité** : appareils, navigateurs et résolutions réellement testés.
* **J. Limites** : vérifications impossibles, accès manquants ou risques résiduels.
* **K. Améliorations restantes** : éléments pouvant encore être perfectionnés.
* **L. Verdict final** : niveau de qualité réellement atteint, preuves associées et éventuels critères de validation encore non satisfaits.

Pour les problèmes importants, conserve des captures d’écran, journaux ou résultats de tests permettant de vérifier la correction.

## 18. RÈGLES IMPÉRATIVES

1. Ne te contente jamais d’une analyse superficielle.
2. Ne t’arrête pas à la simple identification des problèmes.
3. Corrige directement ce qui peut l’être.
4. Teste le résultat réel après modification.
5. Ne suppose jamais qu’un bouton fonctionne sans le vérifier.
6. N’oublie aucune page ou fonctionnalité identifiable.
7. Ne sacrifie jamais la fiabilité pour l’esthétique.
8. Ne sacrifie jamais les performances pour des animations inutiles.
9. Ne supprime aucune fonctionnalité validée pour masquer un problème.
10. Ne remplace pas des contenus réels par des données fictives.
11. Ne modifie pas inutilement les éléments déjà parfaitement fonctionnels.
12. Ne revendique aucun test non exécuté.
13. Conserve une trace des modifications et des résultats.
14. Préserve une version restaurable avant toute modification importante.
15. Ne déploie pas de changement sensible en production sans validation appropriée.
16. Ne considère pas un site comme terminé simplement parce qu’il est visuellement réussi.
17. Réexécute les tests de non-régression après les corrections.
18. Cherche activement les défauts les plus difficiles à détecter.
19. Privilégie les corrections durables aux solutions temporaires.
20. Ne présente jamais une note subjective comme une certification indépendante.

## 19. INSTRUCTION PERMANENTE

Ce protocole doit devenir ton processus de contrôle qualité de référence.

À chaque nouvelle modification importante du site, utilise-le pour vérifier que les changements n’ont pas dégradé le fonctionnement, l’apparence, les performances ou le référencement.

Le standard recherché est un site d’une qualité exceptionnelle : rapide, élégant, innovant, fiable, entièrement fonctionnel et parfaitement maîtrisé.

**OBJECTIF : 99/100 MINIMUM DANS CHAQUE CATÉGORIE NORMALISÉE, AVEC UNE CIBLE GLOBALE DE 100/100.**

Ne te satisfais pas d’un résultat moyen.

Analyse. Teste. Corrige. Mesure. Recommence.

Ton travail consiste à livrer le meilleur site possible, pas simplement à affirmer qu’il est terminé.
