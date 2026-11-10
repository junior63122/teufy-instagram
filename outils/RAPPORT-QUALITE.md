# Rapport qualité du site Teufy — audit du 10 novembre 2026 (nuit, 4ᵉ passage : navigation et offres)

Protocole : `outils/PROMPT-AUDIT.md`. Notes honnêtes : une note n'est donnée que pour ce qui a été mesuré ou testé ;
ce qui n'a pas pu l'être est listé en J. Ce n'est pas une certification indépendante.
Ce passage répond aux retours du directeur : « la navigation n'a aucun sens », « je veux devenir partenaire, je ne sais
pas où aller », « les abonnements ont l'air inutiles », « la TVA », « le retour en haut s'affiche une fois sur deux ».
Deux boucles complètes (analyser → corriger → tester) ont été faites.

## A. Note générale

| | Note |
|---|---|
| Rapport précédent (10/11, soir) | 96 / 100 |
| Début de cet audit | **92 / 100** : navigation confuse (13 rubriques à la file, pied de page mal rangé et cassé par une balise oubliée), pas d'accès clair aux offres partenaires ni aux tarifs, formules peu attractives, pas de TVA, bouton « haut » instable, pages interminables sur mobile (accueil 46 000 px), « Billets » invisible au premier écran d'une soirée |
| Fin de cet audit | **96 / 100** (les nouveautés sont mesurées et testées ; le plafond restant tient aux limites de J) |
| Objectif | 99 / 100 : **non atteint** (voir K et L) |

## B. Notes par catégorie

| Catégorie | Note | Justification |
|---|---|---|
| Design et cohérence | 9,7 / 10 | Offres partenaires refaites (preuves mesurées, Premium en vedette, prix au jour, unité compacte), pied de page sur une ligne, typographie française (plus de « ? » seul en début de ligne). |
| UX et navigation | 9,7 / 10 | Mobile : barre d'onglets (Agenda, Ce soir, Chercher, Favoris, Menu) + menu plein écran par rubriques ; ordinateur : Villes ▾ Sortir ▾ Lieux ▾ **Pros ▾** Teufy ▾. « Devenir partenaire » / « Nos tarifs » en un geste. « Chercher » ouvre recherche + filtres de partout. Premier écran : recherche visible sur l'accueil, barre « Billets » (prix, date) visible dès l'arrivée sur une soirée. |
| Performances | 9,6 / 10 | Production après déploiement : ordinateur 100 sur 6 pages ; mobile accueil 94 (était 87), Ce soir 92 (était 79), Partenaires 98, Toulon 97 (CLS 0), fiche soirée 99. Agenda en affichage progressif (accueil mobile 46 000 → 15 000 px). |
| Animations | 9 / 10 | Inchangées ; défilement doux réservé aux liens internes (arrivée immédiate sur une ancre), mouvements réduits respectés. |
| Fonctionnalités | 14,4 / 15 | Tous les parcours passent (4 écrans) dont les nouveaux : menu, onglets, listes déroulantes, tarifs, « Voir plus », favoris, retour en haut. Paiement en ligne prêt mais inactif (pas de compte de paiement). |
| Compatibilité | 9,3 / 10 | Chromium local (4 écrans) ✓ ; WebKit et Firefox via la CI sur la version précédente ✓ ; série sur cette version déclenchée par le push. Aucun appareil physique. |
| SEO | 9,9 / 10 | 2 935 pages, 622 248 liens internes, 0 cassé, 0 problème bloquant ; nouveau contrôle des balises déséquilibrées sur toutes les pages. SEO Lighthouse 100 sur 12 mesures. |
| Contenus | 4,8 / 5 | Offres claires, HT + TTC, CGV mises à jour. Libellés de navigation traduits en 6 langues ; textes des offres pas encore traduits (IA). |
| Images et vidéos | 4,8 / 5 | 0 image cassée ; logos ronds contrôlés ; affiche de soirée limitée à la moitié de l'écran sans déformer les visuels de ville. |
| Sécurité et robustesse | 4,8 / 5 | `tester-securite` 0 faille (5 731 fichiers, 5 injections) ; robustesse ✓. Pas d'en-têtes HTTP configurables (GitHub Pages). |
| Accessibilité | 4,9 / 5 | Lighthouse 100 sur 12 mesures en production ; menu en dialogue (Échap, focus), cibles ≥ 44 px dans le menu et les onglets. Pas de test avec un vrai lecteur d'écran. |
| Innovation et finitions | 4,9 / 5 | Navigation de type application, chiffres d'audience réels sur la page Partenaires (mis à jour par le robot), formulaire pré-rempli avec la formule choisie. |
| **Total** | **96 / 100** | (arrondi de 95,8) |

## C. Inventaire des tests

- **Pages** : 2 935 (6 langues) ; 30+ types × 4 écrans (iPhone 13, iPad Mini, 1440, 1920) ; premiers écrans sur iPhone 13, iPhone SE, Pixel 7.
- **Liens** : 622 248 internes, 0 cassé. **Balises** : équilibre div/section/nav/main/footer/details/article sur toutes les pages.
- **Navigation testée** : 5 onglets, menu (ouverture, croix, Échap, lien « Nos tarifs »), 5 listes déroulantes (une seule ouverte, Échap), retour en haut (montée/descente), « Voir plus de soirées », favoris, recherche depuis l'onglet.
- **Formulaires** : 3 × 4 écrans (vide, caractères spéciaux, 3 000 caractères, HTML, e-mail pré-rempli) + formule choisie pré-remplie.
- **Lighthouse production** : 12 mesures (6 pages × mobile / ordinateur).
- **Revue visuelle** : accueil, Ce soir, Nice, soirées (3 types d'affiche), Clubs & bars, Partenaires, FAQ, Qui sommes-nous, pied de page, menus (mobile, tablette espagnole, ordinateur).

## D. Bugs trouvés pendant cet audit (corrigés)

| Bug | Gravité | Conséquence |
|---|---|---|
| Balise oubliée dans le pied de page (toutes les pages) | Haute | Pied de page désordonné |
| Nom de fonction en double dans le script (pendant la refonte) | Haute | Tout le JavaScript arrêté — détecté par les tests avant mise en ligne |
| Liste « Villes » cachée sur ordinateur (ancienne règle) | Moyenne | Villes introuvables |
| « Billets » à deux écrans de l'arrivée sur une soirée | Haute | Conversions perdues |
| Arrivée sur …/#tarifs ou #contact : défilement lent de près d'une seconde | Moyenne | Mauvais endroit, attente |
| Boutons de cartes recouverts par la barre d'onglets lors d'un saut | Faible | Bouton masqué |
| Bouton « haut » qui disparaît selon le sens du défilement | Faible | Instable |
| Pages de 15 000 à 88 000 px sur mobile | Moyenne | Introuvable, lent (TBT) |
| Tests de veille dépendants de l'état réel du robot | Faible (outil) | Faux échecs |

## E. Corrections (fichiers)

`src/site.mjs` (navigation unique `groupesNav`, menu plein écran, onglets, pied de page, `blocTarifs` v2 avec preuves
mesurées, typographie, actions du hero Partenaires), `site/app.js` (menu, onglets, Chercher, Favoris, affichage
progressif, repli des lieux, barre Billets, défilement doux), `site/style.css`, `src/site-langues.mjs`,
`src/site-contenus.mjs` (CGV art. 7), `config.json` (`site.tarifs` : formules, TVA, étapes), `src/veille.mjs`,
`outils/audit-seo.mjs`, `outils/tester-site.cjs`, `outils/tester-robustesse.cjs`, `tests/veille.test.mjs`,
`studio/scripts/une.mjs`, `media/a-la-une/`.

## F. Résultats des tests

| Test | Local | GitHub (CI) | Production |
|---|---|---|---|
| Liens + SEO + balises | ✓ | déclenché par le push | ✓ |
| Tests unitaires | ✓ 37 / 37 | idem | — |
| Sécurité | ✓ 0 faille | idem | — |
| Robustesse | ✓ | idem | — |
| Usage (4 écrans) | ✓ tous les scénarios | idem (Chromium, WebKit, Firefox) | Lighthouse 12 mesures ✓ |

## G. Performances (Lighthouse, production teufyparty.com)

| Page | Mobile avant → après | Ordinateur |
|---|---|---|
| Accueil | 87 → **94** (TBT 410 → 240 ms) | 100 |
| Ce soir | 79 → **92** | 100 |
| Partenaires | — → 98 | 100 |
| Toulon | 94 → **97** (ordinateur CLS 0,41 → 0,008) | 81 → **100** |
| Fiche soirée | — → 99 | 100 |

Accessibilité, bonnes pratiques et SEO : 100 sur les 12 mesures. Pas de données de visiteurs réels.

## H. SEO

Toutes les soirées restent dans le HTML (l'affichage progressif ne cache qu'à l'écran) ; sitemap, hreflang 6 langues,
données structurées, robots (moteurs acceptés, entraînement IA refusé), aucun titre en double, balises équilibrées.

## I. Compatibilité réellement testée

Simulations iPhone 13, iPhone SE, Pixel 7, iPad Mini, 800 / 1440 / 1920 px ; Chromium local ; WebKit et Firefox via la
CI. **Aucun appareil physique.**

## J. Limites

- **Paiement** : boutons « Payer en ligne » prêts, mais aucun compte de paiement (Stripe ou autre) n'est relié ; d'ici
  là « Choisir … » prépare le message. TVA affichée à 20 % : à confirmer par le comptable.
- Formules : les contenus promis (stories, posts, bilans) sont publiés par l'équipe, pas par le robot.
- Formulaires sans serveur : réception réelle non testée (aucun envoi sans accord).
- Textes des offres pas encore traduits (IA) ; affichés en français dans les autres langues.
- Search Console, Bing, mesure d'audience : à brancher par le directeur.

## K. Améliorations restantes pour viser 99

1. Relier un compte de paiement et tester un paiement réel.
2. Confirmer la série CI 3 navigateurs sur cette version ; test sur un vrai iPhone (barre d'onglets + barre Safari).
3. Accueil mobile : TBT 240 ms (cartes « Ce soir » + agenda) → viser < 150 ms.
4. Traduire les offres ; Search Console + mesure d'audience sans cookie.

## L. Verdict

**96 / 100, objectif de 99 non atteint.** La navigation est refaite et testée sur mobile et ordinateur, les offres
partenaires sont trouvables en un geste, lisibles et attractives avec HT/TTC, et la production est rapide (ordinateur
100, mobile 92–99, accessibilité 100). Restent hors de portée du code : le compte de paiement, un test sur appareil
physique et la traduction des nouveaux textes.
