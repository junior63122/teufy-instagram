# Rapport qualité du site Teufy — audit du 10 novembre 2026 (soir, 3ᵉ passage)

Protocole : `outils/PROMPT-AUDIT.md` (lancé en écrivant **`audit`**). Notes honnêtes : une note n'est donnée que pour
ce qui a été mesuré ou testé ; ce qui n'a pas pu l'être est listé en J. Ce n'est pas une certification indépendante.
Ce passage porte surtout sur les nouveautés de la journée (page « Ce soir », pages lieux, pages Var, saisons, favoris
partagés), mesurées en production avec Lighthouse.

## A. Note générale

| | Note |
|---|---|
| Rapport précédent (10/11, matinée) | 96 / 100 |
| Début de cet audit | **93 / 100** : en production, la page Toulon « sautait » au chargement (CLS 0,41, ordinateur), page « Ce soir » lente sur mobile (79 / 100), titres de cartes illisibles (vert sur crème) dès qu'une soirée est en cours, une soirée en double, WebKit en échec sur un contrôle |
| Fin de cet audit | **96 / 100** |
| Objectif | 99 / 100 : **non atteint** (voir K et L) |

## B. Notes par catégorie

| Catégorie | Note | Justification |
|---|---|---|
| Design et cohérence | 9,6 / 10 | Bloc « Ce soir » sans saut (pré-rempli), titres de cartes lisibles et limités à 2 lignes dans le carrousel (règle de style trop large corrigée). Reste : quelques affiches sources de petite taille. |
| UX et navigation | 9,6 / 10 | Plus de page qui bouge sous le doigt (Toulon, accueil, villes, styles) ; boutons de villes lisibles sur « Ce soir ». |
| Performances | 9,4 / 10 | Mesures en local après correction : « Ce soir » mobile 79 → 98 (TBT 530 → 70 ms), accueil mobile 91, Clubs & bars 95, CLS ≤ 0,024 partout. Production avant correction : ordinateur 100 sauf Toulon (81, corrigé), mobile 87–99. Production après déploiement : pas encore remesurée. |
| Animations | 9 / 10 | Inchangées ; mouvements réduits respectés. |
| Fonctionnalités | 14,3 / 15 | Tous les parcours passent (Chromium, 4 écrans) ; doublons de soirées mieux détectés (même billetterie, ou heure « bouche-trou » 00:00 / 23:59). |
| Compatibilité | 9,3 / 10 | CI version précédente : WebKit usage ✓, robustesse ✗ sur un faux positif (corrigé : les blocs sont maintenant tous mis en page avant la mesure, contrôle plus strict). Aucun appareil physique. |
| SEO | 9,9 / 10 | 2 935 pages, 0 lien cassé (482 803), 0 problème bloquant, plus aucun titre en double (doublon Honey Club fusionné). SEO Lighthouse 100. |
| Contenus | 4,8 / 5 | 161 soirées, sans doublon détecté. Textes du formulaire pro pas encore traduits. |
| Images et vidéos | 4,7 / 5 | 0 image cassée, 0 déformée. |
| Sécurité et robustesse | 4,8 / 5 | `tester-securite` : 0 faille (5 702 fichiers, 5 injections) ; robustesse ✓ avec le contrôle renforcé. Pas d'en-têtes HTTP configurables (GitHub Pages). |
| Accessibilité | 4,8 / 5 | « Ce soir » 91 → 100 (contraste des boutons de villes, liens du pied de page portés à 24 px) ; accueil : contraste des titres en direct corrigé. Pas de test avec un vrai lecteur d'écran. |
| Innovation et finitions | 4,8 / 5 | « Ce soir » pré-calculé à la génération puis remis à l'heure du visiteur, sans saut. |
| **Total** | **96 / 100** | (arrondi de 95,8) |

## C. Inventaire des tests

- **Pages** : 2 935 (6 langues) ; 30+ types de pages × 4 écrans (iPhone 13, iPad Mini, 1440, 1920).
- **Liens** : 482 803 liens internes (0 cassé).
- **Lighthouse** : production 8 mesures (accueil, Ce soir, High Club, Toulon × mobile / ordinateur) ; local 3 mesures après correction.
- **Sauts de mise en page** : mesurés image par image (Toulon, accueil, Ce soir) avant / après.
- **Parcours** : `tester-site` (4 écrans), `tester-robustesse` (scénarios piégés, textes coupés avec tous les blocs mis en page), `tester-securite`.
- **Tests unitaires** : 37 / 37, dont 6 nouveaux sur les doublons de soirées.
- **Revue visuelle** : bloc « Ce soir » ordinateur et mobile après correction.

## D. Bugs trouvés pendant cet audit (corrigés)

| Bug | Gravité | Conséquence |
|---|---|---|
| Bloc « Ce soir » (≈ 850 px) construit après l'affichage : l'agenda sautait vers le bas (CLS 0,41 sur Toulon) | Haute | Clic au mauvais endroit, Google pénalise |
| Titres des cartes « En ce moment » verts sur fond crème (contraste 1,06) | Haute | Illisibles pendant les soirées en cours |
| Titres du carrousel « Ce soir » sans limite de 2 lignes (règle de style trop large) | Faible | Cartes inégales |
| Page « Ce soir » : 99 fiches de lieux mises en page d'un coup | Moyenne | Mobile 79 / 100, blocage 530 ms |
| Boutons de villes en texte noir sur fond sombre | Moyenne | Illisibles |
| Liens du pied de page trop petits pour le doigt (21 px) | Faible | Accessibilité |
| Même soirée publiée deux fois (Honey Club, 00:00 et 23:59 le même samedi) | Moyenne | Doublon, titres en double |
| Contrôle « texte rogné » faussé sous WebKit | Faible (outil) | Échec CI à tort |

## E. Corrections (fichiers)

`src/site.mjs` (« Ce soir » pré-rempli, fusion des doublons à la génération), `site/app.js` (remise à l'heure du
visiteur, masquage s'il n'y a plus rien), `site/style.css` (sélecteurs `>h3`, boutons de villes, liens du pied,
fiches de lieux rendues à l'approche), `src/recherche.mjs` (`memeSoiree` : même page de billetterie, heures
bouche-trou), `tests/doublons.test.mjs`, `outils/tester-robustesse.cjs`, `outils/RAPPORT-QUALITE.md`.

## F. Résultats des tests

| Test | Local | GitHub (CI) | Production |
|---|---|---|---|
| Liens + SEO | ✓ 0 cassé, 0 bloquant | à confirmer sur cette version | ✓ |
| Tests unitaires | ✓ 37 / 37 | à confirmer | — |
| Sécurité | ✓ 0 faille | à confirmer | — |
| Robustesse | ✓ | version précédente : Chromium ✓, Firefox ✓, WebKit ✗ (faux positif, corrigé) | — |
| Usage (4 écrans) | ✓ | version précédente : WebKit ✓ | Lighthouse 8 mesures |

## G. Performances (Lighthouse)

| Page | Production mobile (avant) | Local mobile (après) | Production ordinateur (avant) |
|---|---|---|---|
| Accueil | 87 (TBT 410 ms) | 91 (TBT 150 ms) | 100 |
| Ce soir | 79 (TBT 530 ms) | 98 (TBT 70 ms) | 100 |
| Fiche lieu (High Club) | 99 | — | 100 |
| Toulon | 94 | — | 81 (CLS 0,41) → CLS 0,015 mesuré en local |
| Clubs & bars | — | 95 | — |

Les mesures locales ne sont pas strictement comparables à la production (réseau simulé de la même façon, mais serveur
différent). Pas de données de visiteurs réels (pas de mesure d'audience).

## H. SEO

Pages indexables ; 404 en noindex ; sitemap ; hreflang 6 langues ; données structurées (Événements, FAQPage, fil
d'Ariane, Organisation, NightClub / BarOrPub avec horaires) ; robots : moteurs de recherche et de citation acceptés,
robots d'entraînement refusés ; `llms.txt`. Aucun titre en double.

## I. Compatibilité réellement testée

Simulations iPhone 13, iPad Mini, 390 / 1440 / 1920 px ; Chromium (local + CI), WebKit et Firefox (CI uniquement).
**Aucun appareil physique.**

## J. Limites

- Production après ce déploiement pas encore remesurée (Lighthouse) ; série CI 3 navigateurs à confirmer.
- Le bloc « Ce soir » est calculé à la génération puis corrigé à l'heure du visiteur : si le site n'a pas été régénéré
  depuis la veille, le bloc peut encore changer de taille au chargement (rare : le robot régénère plusieurs fois par jour).
- Formulaires pros sans serveur : réception réelle non testée (aucun envoi sans accord).
- IA : budget limité à 2,50 €/jour ; traductions des nouveaux textes en attente.
- Eventbrite et Ticketmaster bloquent les robots ; pas de contournement.
- Search Console, Bing, mesure d'audience : à brancher par le directeur.

## K. Améliorations restantes pour viser 99

1. Confirmer la CI 3 navigateurs et remesurer la production sur cette version.
2. Accueil mobile (91) : raccourcir l'agenda affiché d'emblée sur mobile.
3. Faire relire les CGV par un juriste ; Search Console + mesure d'audience sans cookie.
4. Traduire les textes du formulaire pro.

## L. Verdict

**96 / 100, objectif de 99 non atteint.** Les défauts trouvés en production (page qui saute, page « Ce soir » lente,
titres illisibles en direct, doublon) sont corrigés et couverts par des tests ; reste à confirmer en production et
sur les 3 navigateurs.
