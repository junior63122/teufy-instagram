# Rapport qualité du site Teufy — 9 novembre 2026 (soir)

Protocole : `outils/PROTOCOLE-QUALITE.md`. Notes honnêtes : une note n'est donnée que pour ce qui a été mesuré
ou testé ; ce qui n'a pas pu l'être est listé en J. Ce n'est pas une certification indépendante.

## A. Note générale

| | Note |
|---|---|
| Début de la boucle (fin d'après-midi) | **85 / 100** (estimation a posteriori : bugs visibles trouvés depuis — bouton illisible, page de soirée cassée, carte « API KEY REQUIRED », icône invisible, mauvais tags Instagram) |
| Maintenant | **91 / 100** |
| Objectif | 99 / 100 — **non atteint** : voir K et L |

## B. Notes par catégorie

| Catégorie | Note | Justification |
|---|---|---|
| Design et cohérence visuelle | 9 / 10 | DA nuit/corail cohérente sur toutes les pages, carte recolorée aux couleurs du site, fiches lieux homogènes. Reste : beaucoup de lieux sans logo (initiale à la place), quelques affiches sources de faible résolution. |
| UX et navigation | 9 / 10 | Menu, recherche, filtres multiples, favoris, « près de moi », fil d'Ariane, mini-carte + itinéraire. Reste : fiches pratiques des lieux encore partielles (5 renseignées), accueil très long. |
| Performances | 9,5 / 10 | Lighthouse ordinateur 100 partout (LCP 0,4–0,5 s, TBT 0 ms) ; mobile 4G lente 97–100 (LCP 1,7–2,6 s, CLS ≤ 0,016). Pas de données réelles de visiteurs (pas d'outil d'audience). |
| Animations et interactions | 9 / 10 | Apparitions au défilement, survols (souris seulement), feuille de filtres glissante, comptes à rebours, repère « en cours » qui pulse ; mouvements réduits respectés. Pas de transitions entre pages. |
| Fonctionnalités et fiabilité | 13,5 / 15 | Tous les parcours passent sous Chromium (local + GitHub). Comparateur de prix : seulement 3 soirées ; publication Instagram avec les nouveaux tags pas encore observée en vrai. |
| Compatibilité | 8,5 / 10 | Chromium : tout passe. WebKit (Safari) : robustesse OK, parcours d'usage relancés après correction du test. Firefox : 1 échec en robustesse, détail en cours. Aucun appareil physique testé. |
| SEO | 9,5 / 10 | 1 645 pages : 0 problème bloquant ; canonical, hreflang (6 langues), Open Graph, JSON-LD valides ; sitemap complet ; titres ≤ 65 car., descriptions ≤ 160. 3 avertissements (descriptions chinoises courtes). Search Console non connectée. |
| Contenus | 4,5 / 5 | Infos vérifiées depuis les sources officielles, rien d'inventé ; pages légales complètes. Traductions faites par IA (relues par échantillon seulement). |
| Images et vidéos | 4,5 / 5 | WebP en plusieurs tailles, dimensions déclarées, aucune image cassée ; vidéo de Monaco lue en entier (17 s) en boucle, version WebM ajoutée. Quelques affiches sources en 420 px. |
| Sécurité et robustesse | 4,5 / 5 | CSP, politique de référent, liens externes en noopener, aucune clé exposée, aucune saisie envoyée à un serveur. GitHub Pages n'autorise pas d'en-têtes HTTP (HSTS, anti-iframe). |
| Accessibilité | 4,7 / 5 | Lighthouse 100, navigation clavier testée, contrastes et boutons vides testés automatiquement, textes alternatifs. Pas de test manuel avec lecteur d'écran. |
| Innovation et finitions | 4,7 / 5 | Comparateur de prix, transports et parkings, fiches pratiques des lieux, tendance mesurée, mini-carte DA, 6 langues, cache hors connexion. |
| **Total** | **91 / 100** | |

## C. Inventaire des tests

- **Pages** : 1 645 pages générées (6 langues), toutes vérifiées par `verifier-liens` et `audit-seo`.
- **Liens** : ~217 600 liens internes vérifiés à chaque passage (0 cassé). Liens externes : 33 000 vérifiés pour `rel=noopener`.
- **Images** : ~34 700 balises image auditées (alt, dimensions, fichier existant, flou détecté par mesure).
- **Vidéos** : 1 (Monaco, 17,3 s) lue jusqu'à la fin et en boucle sur 4 écrans.
- **Parcours automatisés** : 52 contrôles dans `tester-site` × 4 appareils (iPhone 13, iPad Mini, 1440 px, 1920 px)
  sur 30 pages ; 27 contrôles dans `tester-robustesse` (16 scénarios : saisies piégées, clics frénétiques, rotation,
  retour arrière, stockage bloqué, sans JavaScript, géolocalisation refusée, hors connexion, clavier seul,
  écrans 320 à 2560 px, boutons recouverts / vides / illisibles, textes coupés, console et requêtes, cache, mini-carte).
- **Formulaires** : le site n'en a pas (contact par Instagram ou e-mail) ; le champ de recherche est testé
  (vide, caractères spéciaux, 400 caractères, injection HTML, emoji).

## D. Bugs trouvés pendant la boucle (tous corrigés)

| Bug | Gravité | Conséquence |
|---|---|---|
| Bouton « Voir la soirée » corail sur fond corail (actus) | Haute | Bouton invisible |
| Page de soirée cassée (nom de style `.fiche` réutilisé) | Haute | Cadre, fil d'Ariane coupés, boutons restylés |
| Fond de carte CARTO « API KEY REQUIRED » | Haute | Carte inutilisable |
| Icône d'onglet blanche sur transparent | Moyenne | Logo invisible dans l'onglet |
| Tags Instagram approximatifs / une erreur annulait tous les tags d'une slide | Haute | Comptes non identifiés |
| Badge « Très demandée » sur les boutons | Haute | « Billets » masqué |
| Mises à jour automatiques sans enregistrement (`git add`) ; budget de temps épuisé | Haute | Clubs, festivals, transports jamais remplis |
| Carte sans WebGL : erreur JavaScript (Firefox) | Moyenne | Erreur au lieu d'un repli |
| Service worker faisant échouer un script (Firefox) | Moyenne | Chargement bloqué |
| Vidéo illisible sans H.264 | Moyenne | Vidéo noire sur certains navigateurs |
| Petite affiche agrandie (floue) sur tablette | Faible | Image floue |
| Liens calendrier cassés (soirées France) | Moyenne | 404 |

## E. Corrections (fichiers principaux)

`src/site.mjs`, `src/site-contenus.mjs`, `src/site-langues.mjs` (pages, SEO, pages légales, fiches lieux, CSP),
`site/app.js` (mini-carte MapLibre, repli sans WebGL, préchargement, cache), `site/style.css`, `site/sw-source.js`,
`site/vendor/maplibre/` (bibliothèque + style recoloré), `src/comptes.mjs` + `src/instagram.mjs` (tags vérifiés),
`.github/workflows/*` (enregistrement, files d'attente, contrôle qualité multi-navigateurs), `outils/*` (tests).

## F. Résultats des tests (dernier passage)

| Test | Local (Chromium) | GitHub Chromium | GitHub WebKit | GitHub Firefox |
|---|---|---|---|---|
| Liens + audit SEO | ✓ | ✓ | — | — |
| Robustesse | ✓ | ✓ | ✓ | ✗ 1 échec (détail en attente) |
| Parcours d'usage | ✓ | ✓ | relancé (le test utilisait une molette, absente sur iPhone) | en cours |

## G. Performances (Lighthouse, laboratoire)

- Ordinateur : 100 / 100 sur accueil, soirée, clubs & bars, partenaires (LCP 0,4–0,5 s, CLS ≤ 0,016).
- Mobile (4G lente simulée) : 97–100 (accueil 97, soirée 98, clubs 99, actus 99, à propos 99, restos 99, CGU 100).
- Pas de mesure réelle des visiteurs (Core Web Vitals terrain) : aucun outil d'audience installé.

## H. SEO

Toutes les pages publiques sont indexables (sauf 404 en noindex) ; `robots.txt` exclut tests, aperçus, studio ;
sitemap de 1 644 URL sur teufyparty.com ; hreflang 6 langues + x-default ; JSON-LD (Organisation, Événements,
Fil d'Ariane, Articles, Listes de lieux). Indexation réelle par Google non vérifiable sans Search Console.

## I. Compatibilité réellement testée

Simulations Playwright : iPhone 13, iPad Mini, 1280–1920 px, 320 et 568 px, 2560 px ; moteurs Chromium, WebKit,
Firefox (sur serveurs GitHub). **Aucun appareil physique**, pas de Safari macOS réel ni d'Edge (même moteur que Chromium).

## J. Limites

- Pas d'appareil physique ; pas de données de visiteurs réels ; pas de Search Console.
- HTTPS de teufyparty.com : à activer par toi (GitHub → Settings → Pages → Enforce HTTPS), non vérifiable d'ici.
- Fiches pratiques, logos, comparateur et transports se remplissent au fil des passages (dépendent des sources).
- Firefox : 1 échec à analyser dès que le journal est disponible.

## K. Améliorations restantes pour viser 99

1. Corriger l'échec Firefox et obtenir les 3 navigateurs au vert.
2. Logos et fiches pratiques pour tous les clubs et bars (passages automatiques).
3. Alléger l'accueil (afficher moins de soirées d'un coup, « voir plus »).
4. Transitions entre pages (View Transitions) pour la finition premium.
5. Connecter Search Console et une mesure d'audience respectueuse (sans cookie) pour des données réelles.

## L. Verdict

Site fiable et rapide sous Chromium, sans problème SEO bloquant, robuste aux scénarios piégés sous Chromium et
WebKit. **91 / 100, objectif de 99 non atteint** : compatibilité Firefox à finir, données encore incomplètes,
aucun test sur appareil physique. Prochaine boucle dès les résultats Firefox.
