# Rapport qualité du site Teufy — audit du 11 novembre 2026 (5ᵉ passage : recherche, organisateurs, menus)

Protocole : `outils/PROMPT-AUDIT.md`. Notes honnêtes : une note n'est donnée que pour ce qui a été mesuré ou testé ;
ce qui n'a pas pu l'être est listé en J. Ce n'est pas une certification indépendante.
Ce passage suit les retours du directeur de la journée : fiche « La Tocardise » erronée (mauvaise affiche, texte,
transports), barre « Billets » qui chevauchait le texte, menus « Pros » / « Teufy » hors écran, filtres en phrase,
compte Instagram de l'organisateur peu visible, actus sans image, FAQ trop courte, pastilles de nombre dans le menu.

## A. Note générale

| | Note |
|---|---|
| Rapport précédent (10/11, nuit) | 96 / 100 |
| Début de cet audit | **93 / 100** : fiche soirée fausse (affiche d'une autre soirée), barre Billets qui coupait le texte, menus hors écran sur ordinateur, recherche mot à mot seulement, 11 actus sur 16 sans image, FAQ courte, contrôle CI 3 navigateurs en échec (installation bloquée), contraste insuffisant sur un nouvel élément |
| Fin de cet audit | **97 / 100** |
| Objectif | 99 / 100 : **non atteint** (voir K et L) |

## B. Notes par catégorie

| Catégorie | Note | Justification |
|---|---|---|
| Design et cohérence | 9,8 / 10 | Barre « Billets » collée aux onglets (plus de texte coupé entre deux barres), carte « Organisé par » sous le titre, affiche paysage sans cadre vide, pastilles cohérentes avec celle des favoris. |
| UX et navigation | 9,8 / 10 | Recherche en phrase (« techno ce soir à Cannes ») traduite en filtres, avec soirées les plus proches et ce qui a été élargi ; pastilles Ce soir / Actus ; listes de droite jamais hors écran (testé 800 → 1920 px, arabe, italien) ; exemple de phrase dans le champ. |
| Performances | 9,6 / 10 | Production : ordinateur 97–100 sur 6 pages ; mobile 92 (accueil 93, Ce soir 92), 95–100 ailleurs. Image principale de Ce soir / Actus chargée en priorité (délai 1,9 s → 1,1 s). LCP mobile de Ce soir encore à 3,2 s. |
| Animations | 9 / 10 | Inchangées ; la barre Billets glisse avec les onglets ; mouvements réduits respectés. |
| Fonctionnalités | 14,6 / 15 | Tous les parcours passent sur 4 écrans + nouveaux tests (phrase, pastilles, organisateur). Paiement Stripe relié et lu par le robot (aucun paiement réel testé). |
| Compatibilité | 9,3 / 10 | Chromium local (4 écrans) ✓ ; série CI WebKit / Firefox relancée sur cette version (l'installation des navigateurs bloquait : cache + 3 essais ajoutés). Aucun appareil physique. |
| SEO | 9,9 / 10 | 3 139 pages, 667 104 liens internes, 0 cassé, 0 problème bloquant ; SEO Lighthouse 100 sur 12 mesures. |
| Contenus | 4,9 / 5 | FAQ 33 questions détaillées, sans promesse non tenue ; fiche Tocardise exacte (affiche officielle, 23h–5h, adresse, 12 €, line-up) ; une soirée saisie par l'équipe l'emporte sur le web. |
| Images et vidéos | 4,9 / 5 | Toutes les actus illustrées (photo de ville signalée « Photo d'illustration ») ; une affiche trouvée par le web n'est plus montrée sans vérification ; aucune photo répétée. |
| Sécurité et robustesse | 4,8 / 5 | `tester-securite` 0 faille (6 141 fichiers, 5 injections) ; robustesse ✓ (dont retour arrière avec recherche en phrase). Pas d'en-têtes HTTP configurables (GitHub Pages). |
| Accessibilité | 5 / 5 | Lighthouse 100 sur les 12 mesures après correction d'un contraste (pseudo Instagram 3,5:1 → lisible). |
| Innovation et finitions | 4,9 / 5 | Recherche en langage naturel sans IA ni coût, pastilles « non lues », carte de l'organisateur. |
| **Total** | **96,7 → 97 / 100** | |

## C. Inventaire des tests

- **Pages** : 3 139 (6 langues) ; revue visuelle de 8 pages × 3 écrans (iPhone 13, iPad Mini, 1440 px) : accueil, Ce soir,
  fiche soirée, FAQ, Actus, Partenaires, Avantages, page lieu ; 0 débordement horizontal, 0 erreur console.
- **Parcours** (`tester-site`, 4 écrans) : tous ✓, + nouveaux : phrase « techno ce week-end à Nice » (7 soirées, 0 hors
  critères), nom de soirée non transformé en filtres, données des pastilles, carte organisateur.
- **Recherche en phrase** : 9 phrases (ce soir, samedi, demain, gratuit, pas cher, Toulon → Var, restaurant, nom de soirée,
  texte introuvable) + saisie dans le champ, bouton Effacer, retour arrière.
- **Menus** : 5 listes × 6 configurations (1920, 1440, 1024, 800 px, arabe, italien) : toutes dans l'écran.
- **Lighthouse production** : 12 mesures (6 pages × mobile / ordinateur).

## D. Bugs trouvés pendant cet audit (corrigés)

| Bug | Gravité | Conséquence |
|---|---|---|
| Affiche d'une autre soirée sur « La Tocardise » (recherche web + vérification sautée sans IA) | Haute | Information fausse |
| Barre « Billets » flottante : texte visible et coupé entre elle et les onglets | Moyenne | Lecture gênée, effet « décalé » |
| Listes « Pros » / « Teufy » sortant de l'écran sur ordinateur | Moyenne | Liens inaccessibles |
| Adresse « Antibes, Antibes » sur les fiches | Faible | Finition |
| Styles du web mélangés aux styles saisis (« House » ajouté) | Faible | Info inexacte |
| Pseudo Instagram de la carte organisateur trop peu contrasté | Faible | Accessibilité 96 |
| Image principale de Ce soir / Actus chargée en différé | Faible | LCP mobile |
| Page lieu : « vérifie sur son Instagram » sans Instagram connu | Faible | Texte trompeur |
| Recherche en phrase entièrement convertie : phrase perdue au retour arrière | Moyenne | Détecté par la robustesse, corrigé |
| Contrôle CI 3 navigateurs : installation bloquée 10 à 50 min | Moyenne (outil) | Pas de vérification WebKit / Firefox |

## E. Corrections (fichiers)

`src/site.mjs` (affiches non vérifiées, affiche d'équipe locale, carte organisateur, cadre paysage, pastilles, actus
illustrées, géocodage par adresse exacte via la Base Adresse Nationale, itinéraire vers l'adresse, lieux d'équipe,
image prioritaire), `src/recherche.mjs` (soirée d'équipe prioritaire, styles non mélangés, `SANS_RECHERCHE`),
`src/sources.mjs`, `site/app.js` (recherche en phrase, pastilles, listes recalées, hauteur des onglets),
`site/style.css`, `src/site-langues.mjs`, `src/site-contenus.mjs` (FAQ), `evenements-manuels.json`,
`contenus/lieux-manuels.json`, `contenus/affiches-manuelles/`, `outils/geo-proches.mjs`, `outils/tester-site.cjs`,
`.github/workflows/teufy-qualite.yml`, `.github/workflows/teufy-site.yml`.

## F. Résultats des tests

| Test | Local | GitHub (CI) | Production |
|---|---|---|---|
| Liens + SEO + balises | ✓ 0 cassé | statique ✓ | ✓ |
| Tests unitaires | ✓ 37 / 37 | — | — |
| Sécurité | ✓ 0 faille | relancé | — |
| Robustesse | ✓ | relancé (3 navigateurs) | — |
| Usage (4 écrans) | ✓ tous les scénarios | relancé (Chromium, WebKit, Firefox) | Lighthouse 12 mesures ✓ |

## G. Performances (Lighthouse, production teufyparty.com, après correction)

| Page | Mobile | Ordinateur |
|---|---|---|
| Accueil | 93 (TBT 253 ms) | 100 |
| Ce soir | 92 (LCP 3,2 s) | 100 |
| Fiche soirée | 97 | 97 |
| FAQ | 98 | 100 |
| Actus | 95 | 100 |
| Partenaires | 100 | 100 |

Accessibilité, bonnes pratiques et SEO : 100 sur les 12 mesures. Mesures faites machine au repos (une première série,
prise pendant les tests longs, était faussée : accueil mobile 86). Pas de données de visiteurs réels.

## H. SEO

Sitemap, hreflang 6 langues, données structurées (Event, FAQPage enrichie à 33 questions), robots, titres uniques,
balises équilibrées. Changement d'adresse de la fiche Tocardise (`…/la-tocardise-2026-11-14/`) : l'ancienne adresse
n'existe plus (fiche publiée moins d'un jour).

## I. Compatibilité réellement testée

Simulations iPhone 13, iPad Mini, 800 / 1024 / 1440 / 1920 px, arabe (droite à gauche) ; Chromium local ; WebKit et
Firefox via la CI. **Aucun appareil physique.**

## J. Limites

- **Transports autour du Green Musik** : position trouvée, mais le service OpenStreetMap (Overpass) n'a pas répondu
  depuis GitHub ; arrêts et parkings s'afficheront au prochain passage qui l'atteint.
- **Passage complet du robot « site »** en CI : bloqué avant la construction (collecte des sources ou Instagram) ;
  contourné par le workflow « Carte et transports » + construction locale. Cause à isoler.
- Paiement : aucun paiement réel testé ; TVA à confirmer par le comptable ; e-mails de facture Stripe à activer.
- Textes nouveaux (FAQ, offres) traduits par l'IA au prochain passage ; en attendant affichés en français ailleurs.
- Search Console, Bing, mesure d'audience : à brancher par le directeur.

## K. Améliorations restantes pour viser 99

1. LCP mobile de « Ce soir » (3,2 s) et TBT de l'accueil (253 ms) : alléger le premier écran.
2. Confirmer la série CI WebKit / Firefox sur cette version ; test sur un vrai iPhone.
3. Débloquer le passage complet du robot « site » en CI (journal par étape).
4. Paiement réel de bout en bout ; traductions des nouveaux textes.

## L. Verdict

**97 / 100, objectif de 99 non atteint.** Les erreurs signalées par le directeur sont corrigées et couvertes par des
tests : fiche Tocardise exacte, barre Billets propre, menus dans l'écran, recherche en phrase, organisateur mis en
avant, pastilles, actus illustrées, FAQ complète. Accessibilité, bonnes pratiques et SEO à 100 partout ; ordinateur
97–100 ; mobile 92–100. Restent : le premier écran mobile de Ce soir, la confirmation WebKit / Firefox, un appareil
physique et le passage complet du robot en CI.
