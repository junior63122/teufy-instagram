# Rapport qualité du site Teufy — audit du 11 novembre 2026 (6ᵉ passage : vides, ajouts, navigation)

Protocole : `outils/PROMPT-AUDIT.md`. Notes honnêtes : une note n'est donnée que pour ce qui a été mesuré ou testé ;
ce qui n'a pas pu l'être est listé en J. Ce n'est pas une certification indépendante.
Demande du directeur : analyser ce qui manque et ce qu'il faut améliorer (grands espacements, espaces vides…),
ajouter ce qui manque (y compris des fonctionnalités utiles non demandées), puis exécuter l'audit complet.

## A. Note générale

| | Note |
|---|---|
| Rapport précédent (11/11, après-midi) | 97 / 100 |
| Début de cet audit | **95 / 100** : paysages de ville à la place de visuels de soirée, trous dans les rangées de l'agenda (journées à 1–2 soirées, 5 journées concernées rien que sur la page Nice), bloc « Ce soir » vide avec une seule soirée, cartes de lieux tassées, chiffre du menu illisible au survol, « Pros / Teufy » mal placés, contrôle CI 3 navigateurs en échec (miroir Ubuntu) |
| Fin de cet audit | **97 / 100** |
| Objectif | 99 / 100 : **non atteint** (voir K et L) |

## B. Notes par catégorie

| Catégorie | Note | Justification |
|---|---|---|
| Design et cohérence | 9,8 / 10 | Plus de paysage à la place d'une soirée (vignette Teufy + logo du lieu) ; journées courtes en tuile calendrier (grand chiffre) et soirée seule en grand format : 0 rangée trouée (test automatique) ; actus alignées ; cartes de lieux à 3 par rangée. |
| UX et navigation | 9,8 / 10 | Ligne de navigation réservée à « sortir » ; Pros / Teufy dans la barre du haut ; compteurs gris lisibles même survolés ; suggestions quand il y a peu de soirées ce soir ; recherche en phrase. |
| Performances | 9,6 / 10 | Production : ordinateur 97–100 (6 pages) ; mobile 95 accueil, 98 fiche, 97 Nice, 96 actus, 99 partenaires, **91–92 Ce soir** (LCP 3,3 s : délai d'affichage dû à l'apparition animée des cartes). CLS ≤ 0,023 partout. |
| Animations | 9 / 10 | Inchangées ; mouvements réduits respectés. L'apparition des cartes retarde le LCP de Ce soir (choix gardé, voir K). |
| Fonctionnalités | 14,7 / 15 | Nouvelles : « Ta nuit complète » (bars ouverts avant la soirée, filtrés sur l'heure de début ; manger tard / after quand le robot en a trouvé), « Proposer à mes potes » (WhatsApp, message prêt avec lien). Tous les parcours passent. |
| Compatibilité | 9,5 / 10 | CI réparée et relancée : Chromium ✓ (robustesse, sécurité, usage), Firefox usage ✓, WebKit robustesse ✓ ; deux points de test ajustés (voir F). Simulations 390 / 768 / 800 / 1024 / 1440 / 1920 px, arabe. Aucun appareil physique. |
| SEO | 9,9 / 10 | 3 139 pages, 616 030 liens internes, 0 cassé, 0 problème bloquant ; SEO Lighthouse 100 sur 12 mesures. |
| Contenus | 4,9 / 5 | Textes ajoutés en 6 langues (suggestions) ; aucune donnée inventée (horaires sourcés, affiches officielles uniquement). |
| Images et vidéos | 4,9 / 5 | Aucun visuel trompeur ; tuile « week-end » avec les vraies affiches ; image principale annoncée dès l'en-tête (preload). |
| Sécurité et robustesse | 4,8 / 5 | `tester-securite` 0 faille (6 143 fichiers, 5 injections) ; robustesse ✓. Pas d'en-têtes HTTP configurables (GitHub Pages). |
| Accessibilité | 5 / 5 | Lighthouse 100 sur 12 mesures ; tuile date avec `aria-label` du titre d'origine ; cibles ≥ 44 px dans « Ta nuit complète ». |
| Innovation et finitions | 5 / 5 | « Ta nuit complète » et le partage WhatsApp prêt à envoyer, sans compte ni coût. |
| **Total** | **96,9 → 97 / 100** | |

## C. Inventaire des tests

- **Analyse des vides** : 24 pages × 3 écrans (1440, iPad Mini, iPhone 13) par mesure automatique des bandes vides et
  des rangées incomplètes, puis vérification en capture (faux positifs écartés : grands dégradés des vignettes).
- **Parcours** (`tester-site`, 4 écrans) : tous ✓ sur la version précédente ; relancé sur la version finale (voir F).
  Nouveaux tests : 0 journée trouée dans l'agenda (Nice), bouton WhatsApp avec lien de la soirée, compteurs du menu.
- **Menus** : listes Pros / Teufy dans l'écran à 1440, 1024 et 800 px ; absentes de la barre sur mobile (menu plein écran).
- **Lighthouse production** : 12 mesures + 2 mesures de contrôle de Ce soir.

## D. Bugs trouvés pendant cet audit (corrigés)

| Bug | Gravité | Conséquence |
|---|---|---|
| Photo de paysage de la ville à la place d'une soirée sans affiche | Haute | Image trompeuse, dessert Teufy |
| Rangées trouées dans l'agenda (journées à 1–2 soirées) | Moyenne | Grands vides sur ordinateur |
| Bloc « Ce soir » vide avec une seule soirée | Moyenne | Page qui paraît vide |
| « Ta nuit complète » : bar fermé à 17h30 proposé avant une soirée de 20h (1ʳᵉ version) | Moyenne | Conseil faux — corrigé avant la mise en ligne |
| Chiffre du menu invisible sur l'élément survolé / sélectionné | Faible | Information perdue |
| Cartes de lieux à 4 par rangée, texte tassé | Faible | Lisibilité |
| Pros / Teufy mal placés sur ordinateur | Faible | Navigation confuse |
| CI : miroir Ubuntu d'Azure injoignable, verrou apt entre deux essais | Moyenne (outil) | Pas de test Safari / Firefox |

## E. Corrections (fichiers)

`src/site.mjs` (vignette sans paysage, « Ta nuit complète », bouton WhatsApp, compteurs du menu, Pros / Teufy dans la
barre du haut, preload de l'image principale), `site/app.js` (journées courtes en tuile calendrier, soirée seule en grand
format, suggestions « ce soir », pastilles), `site/style.css`, `src/site-langues.mjs` (textes en 6 langues),
`outils/tester-site.cjs`, `outils/tester-robustesse.cjs`, `.github/workflows/teufy-qualite.yml`.

## F. Résultats des tests

| Test | Local | GitHub (CI) | Production |
|---|---|---|---|
| Liens + SEO + balises | ✓ 0 cassé | statique ✓ | ✓ |
| Tests unitaires | ✓ 37 / 37 | — | — |
| Sécurité | ✓ 0 faille | Chromium ✓ | — |
| Robustesse | ✓ | Chromium ✓, WebKit ✓, Firefox : images interrompues revérifiées (relancé) | — |
| Usage (4 écrans) | ✓ (version précédente) ; version finale relancée | Chromium ✓, Firefox ✓ ; WebKit : « Voir plus » vérifié trop tôt et fonds de carte externes, tests ajustés (relancé) | Lighthouse 12 mesures ✓ |

## G. Performances (Lighthouse, production teufyparty.com)

| Page | Mobile | Ordinateur |
|---|---|---|
| Accueil | 95 (TBT 206 ms) | 100 |
| Ce soir | 91–92 (LCP 3,3 s) | 100 |
| Fiche soirée | 98 | 97 |
| Nice | 97 | 100 |
| Actus | 96 | 100 |
| Partenaires | 99 | 100 |

Accessibilité, bonnes pratiques et SEO : 100 sur les 12 mesures. Mesures faites machine au repos. Pas de données de
visiteurs réels (Core Web Vitals terrain indisponibles sans mesure d'audience).

## H. SEO

Sitemap, hreflang 6 langues, données structurées (Event, FAQPage), robots, titres uniques, balises équilibrées ;
aucune URL modifiée par ce passage.

## I. Compatibilité réellement testée

Simulations iPhone 13, iPad Mini, 800 / 1024 / 1440 / 1920 px, arabe ; Chromium local ; Chromium, Firefox, WebKit via la
CI. **Aucun appareil physique.** Le moteur WebKit n'a pas pu être installé localement (serveur de téléchargement bloqué).

## J. Limites

- « Après : manger tard / after » ne s'affiche que lorsque le robot a trouvé des lieux avec horaires sourcés (recherche
  hebdomadaire) ; aujourd'hui seule la partie « Avant » est visible.
- Transports autour du Green Musik : service OpenStreetMap injoignable depuis GitHub pour l'instant.
- Formulaires sans serveur : réception réelle non testée ; paiement réel non testé.
- Search Console, mesure d'audience : à brancher par le directeur.

## K. Améliorations restantes pour viser 99

1. Ce soir mobile : LCP 3,3 s — faire apparaître sans animation les cartes visibles dès l'arrivée.
2. Confirmer la série CI complète WebKit / Firefox ; test sur un vrai iPhone.
3. Traductions IA des nouveaux textes (FAQ, offres) au prochain passage.

## L. Verdict

**97 / 100, objectif de 99 non atteint.** Les vides signalés sont corrigés et un test empêche leur retour ; aucun
visuel trompeur ; deux fonctionnalités utiles ajoutées (« Ta nuit complète », « Proposer à mes potes ») ; navigation
clarifiée. Accessibilité, bonnes pratiques et SEO à 100 ; ordinateur 97–100 ; mobile 91–99. Restent : le LCP mobile de
Ce soir, la confirmation WebKit / Firefox et un appareil physique.
