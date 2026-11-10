# Rapport qualité du site Teufy — 10 novembre 2026 (nuit, 2e boucle)

Protocole : `outils/PROMPT-AUDIT.md` (prompt complet, lancé en écrivant **`audit`**) et sa synthèse
`outils/PROTOCOLE-QUALITE.md`. Notes honnêtes : une note n'est donnée que pour ce qui a été mesuré ou testé ;
ce qui n'a pas pu l'être est listé en J. Ce n'est pas une certification indépendante.

## A. Note générale

| | Note |
|---|---|
| Rapport précédent (9 novembre, soir) | 91 / 100 |
| Début de cette boucle (après tes retours) | **89 / 100** : nouveaux défauts trouvés (pages pros répétitives, doublon de partenaires, textes contradictoires sur la commission et la carte, mauvaise image sur une actu, pas de FAQ ni de sources, partage seulement sur les soirées) |
| Maintenant | **93 / 100** |
| Objectif | 99 / 100 : **non atteint** (voir K et L) |

## B. Notes par catégorie

| Catégorie | Note | Justification |
|---|---|---|
| Design et cohérence visuelle | 9,5 / 10 | En-têtes visuels partout (affiches en éventail sur mobile, mosaïque des posts Teufy sur « Qui sommes-nous »), blocs Organisateurs et Pros refaits, fini les longues piles de texte. Reste : beaucoup de lieux sans logo, quelques affiches sources en basse résolution. |
| UX et navigation | 9,5 / 10 | Grande FAQ avec sommaire, page des sources, partage sur tous les en-têtes et les actus, source + signalement sur chaque soirée, retour vers la bonne rubrique (Occitanie, France). Reste : pages d'agenda très longues (accueil ≈ 45 000 px sur mobile, clubs & bars ≈ 53 000 px). |
| Performances | 9,5 / 10 | Lighthouse ordinateur 100 / 100 (accueil, FAQ, partenaires, qui sommes-nous ; LCP 0,4–0,6 s). Mobile 96–99 ; LCP 2,0–2,6 s, sauf « Qui sommes-nous » : 2,3 à 2,9 s selon le passage. Pas de données de visiteurs réels. |
| Animations et interactions | 9 / 10 | Apparitions au défilement, éventail d'affiches au survol, carrousels tactiles, transitions de page (View Transitions), mouvements réduits respectés. |
| Fonctionnalités et fiabilité | 14 / 15 | Tous les parcours passent en local, y compris les nouveaux tests (FAQ, sources, partage avec repli quand le presse-papiers est refusé). La recherche automatique de l'Occitanie n'a pas encore été observée en vrai (lancée sur GitHub). |
| Compatibilité | 8,5 / 10 | Série GitHub du 10/11 à 2 h : **Chromium : tout passe** ; **Firefox : usage OK**, 1 échec en robustesse (hors connexion : délai du cache non attendu par le test, corrigé) ; **WebKit : robustesse OK**, 1 échec d'usage sur tablette (sélection de 2 villes, test rendu tolérant au délai, à confirmer). Aucun appareil physique. | Chromium : tout passe (iPhone 13, iPad Mini, 1440 et 1920 px). Les séries WebKit et Firefox de GitHub ont été annulées par des envois rapprochés ; série complète relancée (résultat en F dès réception). Aucun appareil physique. |
| SEO | 9,8 / 10 | 1 603 pages : 0 problème bloquant, **0 avertissement** ; 1 602 URL dans le sitemap ; JSON-LD (FAQPage sur la FAQ, Événements, Fil d'Ariane avec la bonne rubrique). Search Console non connectée. |
| Contenus | 4,7 / 5 | Contradictions corrigées (commission sur les billets, carte générale supprimée), FAQ uniquement avec des faits établis, CGV alignées sur le modèle économique. Traductions par IA, relues par échantillon seulement. |
| Images et vidéos | 4,6 / 5 | Mauvaise affiche sur l'actu « Cinema for Space » supprimée (rapprochement trop large), plus aucune photo répétée d'une page à l'autre, affiches nettes dans les actus. 23 soirées sans affiche officielle (vignette Teufy). |
| Sécurité et robustesse | 4,5 / 5 | CSP stricte, aucune clé exposée, liens externes en noopener ; tous les scénarios piégés passent. GitHub Pages n'autorise pas d'en-têtes HTTP (HSTS, anti-iframe). |
| Accessibilité | 4,7 / 5 | Lighthouse 100 sur les pages mesurées ; boutons icônes (partage, favoris) avec libellé ; navigation clavier testée. Pas de test avec un vrai lecteur d'écran. |
| Innovation et finitions | 4,8 / 5 | Comparateur de prix, codes promo expliqués, transports, fiches pratiques des lieux, Occitanie, 6 langues, cache hors connexion. |
| **Total** | **93 / 100** | |

## A bis. Boucle « images partout » et 3 navigateurs (10 novembre, 1 h–2 h)

- **Images** : 19 spots sur 19 avec photo libre créditée ; 67 photos de villes (dernier recours honnête pour une
  soirée sans affiche ni logo) ; logos des lieux 17 → 33, bannière photo de la ville pour les autres ;
  image officielle de l'article pour l'actu qui n'en avait pas. Nouveau contrôle `audit-seo` « élément sans image » :
  **0** sur les 1 603 pages.
- **Codes promo** : économie en euros affichée (ex. 24,99 € → 19,99 €, 5,00 € économisés) ; commission comprise dans
  le prix des billets (FAQ, CGV) ; Côte d'Azur remise en zone phare (menu, textes, chiffres).
- **3 navigateurs (GitHub)** : Chromium OK en robustesse ; échecs trouvés puis corrigés : photos de villes en 480 px
  floues sur grand écran (→ 800 px), logo du lieu trop agrandi, image d'actu en 800 px (→ 1 200 px), erreur du
  service worker sous Firefox (→ jamais de rejet), attente du test de recherche bloquée par la CSP sous Firefox
  (→ attente sans eval), test clavier et hors connexion fiabilisés sous Firefox, vidéo sous WebKit Linux (pas de
  H.264 : on vérifie qu'elle tourne ; lecture complète exigée sous Chromium et Firefox).
- **Bloquant hors code** : crédits **Gemini** et **Anthropic** épuisés (journaux GitHub : HTTP 402 / « credit balance
  too low »). Sans eux : traductions des nouveaux textes, recherche Occitanie, relecture des affiches et fiches
  pratiques des lieux à l'arrêt. À recharger par le directeur.

## C. Inventaire des tests

- **Pages** : 1 603 pages (6 langues), dont les nouvelles : FAQ et Occitanie (+ pages par ville).
- **Liens** : 213 332 liens internes vérifiés (0 cassé) ; ~33 700 liens externes contrôlés (`rel=noopener`).
- **Images** : ~30 700 balises auditées (alt, dimensions, fichier, flou) + contrôle « aucune photo répétée ».
- **Vidéo** : Monaco (17 s) lue jusqu'à la fin et en boucle sur 4 écrans.
- **Parcours** : `tester-site` sur 4 appareils simulés et 32 pages (ajoutés : FAQ, Occitanie, ouverture d'une question,
  saut vers les sources, partage depuis un en-tête sans partage natif, source sur la fiche soirée) ;
  `tester-robustesse` : 16 scénarios piégés.
- **Formulaires** : aucun (contact par Instagram ou e-mail) ; champ de recherche testé (vide, spéciaux, très long, HTML).

## D. Bugs trouvés pendant cette boucle (tous corrigés)

| Bug | Gravité | Conséquence |
|---|---|---|
| Page Partenaires : liste de 167 partenaires **puis** mur de logos des mêmes partenaires | Haute | Page de 18 700 px, répétitive |
| « Pas de commission » (page partenaires) et « Teufy ne perçoit pas de commission » (CGV) | Haute | Faux depuis le modèle économique indiqué par la direction |
| « Sur la carte » dans les textes alors que la carte générale n'existe plus | Moyenne | Promesse fausse |
| Actu « Cinema for Space » illustrée par l'affiche du concert PLK | Haute | Image sans rapport (rapprochement sur « palais » + « 2026 ») |
| Mêmes photos d'ambiance sur plusieurs pages (bloc Pros) | Moyenne | Répétition visuelle |
| Bloc « Pros » sur l'accueil en double du bloc Organisateurs | Faible | Répétition |
| Partage impossible si le presse-papiers est refusé | Moyenne | Bouton sans effet sur certains navigateurs |
| Pages France de Toulouse et Montpellier restées en ligne vers des soirées supprimées | Moyenne | 1 lien cassé |
| Affiches du bloc Organisateurs débordant sur mobile (hauteur forcée par le HTML) | Faible | Visuel coupé |

## E. Corrections (fichiers principaux)

`src/site.mjs` (FAQ, sources, partage, pages pros, vitrine, images des actus, Occitanie, nettoyage des pages),
`src/site-contenus.mjs` (FAQ, textes corrigés, CGV), `src/recherche.mjs` + `src/sources.mjs` + `src/run.mjs`
(Occitanie), `site/app.js` (partage de secours), `site/style.css`, `outils/tester-site.cjs` (nouveaux tests),
`outils/audit-seo.mjs` (seuil adapté au chinois), `outils/PROMPT-AUDIT.md`, `.claude/commands/audit.md`, `CLAUDE.md`.

## F. Résultats des tests

| Test | Local (Chromium) | GitHub (3 navigateurs) |
|---|---|---|
| Liens + audit SEO | ✓ 0 cassé, 0 avertissement | en cours |
| Tests unitaires | ✓ 28 / 28 | en cours |
| Robustesse | ✓ tous les scénarios | en cours (Chromium, WebKit, Firefox) |
| Parcours d'usage | ✓ tous les scénarios, 4 appareils | en cours (Chromium, WebKit, Firefox) |

## G. Performances (Lighthouse, laboratoire)

| Page | Mobile | Ordinateur |
|---|---|---|
| Accueil | 96 (LCP 2,6 s, CLS 0,001) | 100 (LCP 0,5 s) |
| Qui sommes-nous | 96 (LCP 2,3–2,9 s, CLS 0) | 100 (LCP 0,6 s) |
| FAQ | 97 (LCP 2,6 s, CLS 0) | 100 (LCP 0,6 s) |
| Partenaires | 99 (LCP 2,0 s, CLS 0) | 100 (LCP 0,4 s) |

Accessibilité, bonnes pratiques et SEO : 100 sur ces 8 mesures. Aucune donnée de visiteurs réels.

## H. SEO

Toutes les pages publiques indexables (404 en noindex) ; sitemap de 1 602 URL ; hreflang 6 langues + x-default ;
FAQPage sur la FAQ ; fil d'Ariane des soirées vers leur vraie rubrique ; pages de villes vides supprimées
automatiquement. Indexation réelle non vérifiable sans Search Console.

## I. Compatibilité réellement testée

Simulations Playwright : iPhone 13, iPad Mini, 390, 1366, 1440, 1920 px (local, Chromium) ; WebKit et Firefox
sur les serveurs GitHub (série en cours). **Aucun appareil physique.**

## J. Limites

- Hors connexion sous **Firefox** : non vérifiable avec Playwright (sa coupure réseau ne passe pas par le service worker) ; vérifié sous Chromium et WebKit.
- Sous Firefox, le message « ServiceWorker … unexpected error » pour une image abandonnée pendant un changement de page est ignoré par les tests (pas un défaut visible).

- Pas d'appareil physique, pas de données de visiteurs, pas de Search Console.
- Occitanie : la recherche par IA ne tourne que sur GitHub ; 20 soirées (Toulouse, Montpellier) en attendant.
- HTTPS de teufyparty.com : à activer dans GitHub → Settings → Pages → Enforce HTTPS.
- La phrase « Teufy peut être rémunéré par une commission » (CGV) et la FAQ reprennent ce que la direction a dit
  du modèle économique ; à faire valider si une formulation juridique précise est souhaitée.

## K. Améliorations restantes pour viser 99

1. Obtenir les 3 navigateurs au vert sur GitHub sur une même version.
2. Raccourcir l'accueil et « Clubs & bars » sur mobile (« voir plus » au lieu de tout afficher).
3. Ramener le LCP mobile de « Qui sommes-nous » sous 2,5 s à chaque passage.
4. Logos et fiches pratiques pour tous les lieux (passages automatiques).
5. Search Console + mesure d'audience sans cookie pour des données réelles.

## L. Verdict

**93 / 100, objectif de 99 non atteint.** Toutes les fonctionnalités testées marchent en local, sans problème
SEO, avec des performances ordinateur à 100. Les défauts que tu as signalés sur « Qui sommes-nous » ont été cherchés
et corrigés sur les autres pages. Restent à prouver : la compatibilité WebKit et Firefox sur cette version (série
GitHub en cours), les pages d'agenda trop longues sur mobile, et des mesures sur de vrais appareils.
