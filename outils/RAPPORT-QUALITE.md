# Rapport qualité du site Teufy — audit du 10 novembre 2026 (matin)

Protocole : `outils/PROMPT-AUDIT.md` (lancé en écrivant **`audit`**). Notes honnêtes : une note n'est donnée que pour
ce qui a été mesuré ou testé ; ce qui n'a pas pu l'être est listé en J. Ce n'est pas une certification indépendante.
Nouveauté de cet audit : **la version en production (teufyparty.com) a été testée directement** (accès réseau ajouté).

## A. Note générale

| | Note |
|---|---|
| Rapport précédent (10/11, nuit) | 93 / 100 |
| Début de cet audit | **92 / 100** : visuels d'en-tête étirés et flous sur ordinateur (nouveau défaut), blocage mobile de l'accueil (~300 ms), aperçus de partage identiques sur presque toutes les pages, comparateur de prix trompeur (corrigé juste avant) |
| Fin de cet audit | **95 / 100** |
| Objectif | 99 / 100 : **non atteint** (voir K et L) |

## B. Notes par catégorie

| Catégorie | Note | Justification |
|---|---|---|
| Design et cohérence | 9,6 / 10 | En-têtes liés au contenu de chaque page (actus, Occitanie, France, festivals, BDE, spots, lieux, posts Teufy), images partout (0 élément sans image), grille de chiffres sans trou. Reste : quelques lieux affichent la photo de leur ville faute de logo. |
| UX et navigation | 9,5 / 10 | FAQ + sources, partage partout, retour vers la bonne rubrique, Côte d'Azur en zone phare, code promo chiffré en euros. Reste : agenda et « Clubs & bars » très longs sur mobile. |
| Performances | 9,5 / 10 | Production : ordinateur 100 / 100 (4 pages), mobile 91–97 (LCP 1,7–2,4 s, CLS ≤ 0,016). Correctif « rendu à l'approche » : blocage mobile de l'accueil 290–310 ms → 30–170 ms en local (à confirmer en production). |
| Animations | 9 / 10 | Éventails d'affiches, apparitions, carrousels, transitions de page, mouvements réduits respectés. |
| Fonctionnalités | 14 / 15 | Tous les parcours passent en local (Chromium) ; robustesse OK sur les 3 navigateurs en CI. L'IA de recherche est à court de crédit (Gemini 402, Claude à sec) : agenda maintenu sur les dernières données ; secours gratuit GitHub Models en cours de correction. |
| Compatibilité | 9 / 10 | CI : robustesse ✓ Chromium/WebKit/Firefox ; usage ✓ Chromium ; seul échec restant = netteté des en-têtes, corrigé et vérifié en local (série de confirmation en cours). Aucun appareil physique. |
| SEO | 9,9 / 10 | 1 777 pages, 0 problème bloquant, sitemap de 1 776 URL, canonical correct en production, aperçus de partage propres à chaque rubrique. Search Console non connectée. |
| Contenus | 4,8 / 5 | Chiffres de la direction (CA ≈ 350 k€, bénéfice ≈ 100 k€, 15 000 téléchargements, 247 soirées), commission comprise dans le prix, prix trompeur Instagram retiré. Nouveaux textes pas encore traduits (IA à court de crédit). |
| Images et vidéos | 4,8 / 5 | 0 image cassée en production, 0 image floue dans les en-têtes, 0 élément sans image, photos libres créditées. |
| Sécurité et robustesse | 4,6 / 5 | CSP stricte, aucune clé exposée, robustesse OK sur 3 navigateurs, IA sans crédit sautée sans boucle. GitHub Pages : pas d'en-têtes HTTP de sécurité configurables. |
| Accessibilité | 4,8 / 5 | Lighthouse 100 sur les 8 mesures de production ; boutons icônes libellés ; navigation clavier testée. Pas de test avec un vrai lecteur d'écran. |
| Innovation et finitions | 4,8 / 5 | Relais automatique entre 3 IA, plafonds anti-emballement, économie en euros des codes promo, en-têtes vivants. |
| **Total** | **95 / 100** | |

## C. Inventaire des tests

- **Pages** : 1 777 (6 langues) ; 11 pages testées **en production** sur iPhone simulé (FR, EN, AR).
- **Liens** : 256 664 liens internes (0 cassé) ; 37 170 liens externes contrôlés.
- **Images** : 40 855 balises auditées ; netteté des en-têtes vérifiée sur 9 rubriques × 2 écrans (0 floue).
- **Vidéo** : Monaco (17 s), lecture complète et boucle (Chromium, Firefox) ; lecture vérifiée sous WebKit.
- **Parcours** : `tester-site` sur 4 appareils simulés, 32 pages ; `tester-robustesse` : 16 scénarios piégés.
- **Production** : redirections (www → racine, dossiers sans « / »), 404, sitemap, robots, console, requêtes HTTP.

## D. Bugs trouvés pendant cet audit (corrigés)

| Bug | Gravité | Conséquence |
|---|---|---|
| Visuels d'en-tête étirés par leur hauteur HTML sur ordinateur | Moyenne | Images floues (115–240 %), signalées par les 3 navigateurs |
| Affiche trop petite (384 px) choisie pour un en-tête | Faible | Flou |
| Mise en page de toutes les sections au chargement | Moyenne | Blocage mobile ~300 ms sur l'accueil |
| Même aperçu de partage (photo de Monaco) sur presque toutes les pages | Faible | Partages WhatsApp / LinkedIn peu parlants |
| Comparateur : prix lu dans un post Instagram présenté comme billet (corrigé juste avant l'audit) | Haute | Prix faux affiché |
| GitHub Models : point d'accès retiré + réponse non JSON | Moyenne | Pas de secours gratuit quand les IA payantes sont à sec |

## E. Corrections (fichiers)

`site/style.css` (hauteur des visuels, rendu à l'approche des sections), `src/site.mjs` (images d'en-tête ≥ 480 px,
aperçus de partage par rubrique, comparateur réservé aux billetteries), `src/recherche.mjs` (exclusion des réseaux
sociaux), `src/llm.mjs` (rôles des IA, relais, GitHub Models), `config.json`, `outils/RAPPORT-QUALITE.md`.

## F. Résultats des tests

| Test | Local | GitHub (CI) | Production |
|---|---|---|---|
| Liens + SEO | ✓ 0 cassé, 0 bloquant | ✓ | ✓ canonical, 404, redirections |
| Tests unitaires | ✓ 28 / 28 | ✓ | — |
| Robustesse | ✓ | ✓ Chromium, WebKit, Firefox | — |
| Usage (4 écrans) | ✓ après correction de la netteté | Chromium ✓ ; WebKit/Firefox : seul échec = netteté, corrigé (série de confirmation en cours) | ✓ 11 pages sans erreur |

## G. Performances (Lighthouse, production teufyparty.com)

| Page | Mobile | Ordinateur |
|---|---|---|
| Accueil | 91 (LCP 2,2 s, TBT 330 ms) → correctif poussé (local : TBT 30–170 ms) | 100 (LCP 0,5 s) |
| Occitanie | 95 (LCP 2,3 s) | 100 (LCP 0,5 s) |
| Qui sommes-nous | 97 (LCP 2,4 s) | 100 (LCP 0,5 s) |
| Fiche soirée | 94 (LCP 1,7 s) | 100 (LCP 0,4 s) |

Accessibilité, bonnes pratiques, SEO : 100 sur les 8 mesures. Pas de données de visiteurs réels.

## H. SEO

Pages publiques indexables ; 404 en noindex ; sitemap 1 776 URL ; hreflang 6 langues ; données structurées
(Événements, FAQPage, fil d'Ariane, Organisation) ; aperçus de partage propres à chaque rubrique.

## I. Compatibilité réellement testée

Simulations : iPhone 13, iPad Mini, 390 / 1366 / 1440 / 1920 px ; moteurs Chromium (local + CI), WebKit et Firefox
(CI) ; production testée sous Chromium (iPhone simulé). **Aucun appareil physique.**

## J. Limites

- **Crédits IA épuisés** (Gemini à 05 h 04 : « prepayment credits are depleted » ; Anthropic : « credit balance too
  low ») : pas de recherche web, pas de traduction des nouveaux textes, pas de relecture d'affiches tant que non rechargé.
- Eventbrite bloque désormais les robots (HTTP 405) ; Ticketmaster aussi. Pas de contournement (règle).
- Hors connexion non vérifiable sous Playwright-Firefox (vérifié sous Chromium et WebKit).
- HTTP → HTTPS non testable d'ici (le proxy ne laisse passer que HTTPS) ; Search Console non connectée.

## K. Améliorations restantes pour viser 99

1. Confirmer en CI les 3 navigateurs au vert sur cette version (série en cours).
2. Recharger Gemini (et Anthropic) pour relancer recherches et traductions ; valider le secours GitHub Models.
3. Raccourcir l'accueil et « Clubs & bars » sur mobile.
4. Confirmer le gain de performance mobile en production.
5. Search Console + mesure d'audience sans cookie.

## L. Verdict

**95 / 100, objectif de 99 non atteint.** Le site en production est sain (0 erreur, 0 image cassée, ordinateur
100/100, accessibilité/SEO 100), les défauts trouvés ont été corrigés et vérifiés en local. Restent à prouver :
la série 3 navigateurs sur la dernière version, le gain mobile en production, et le retour des IA (crédits).
