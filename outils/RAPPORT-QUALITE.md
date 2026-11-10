# Rapport qualité du site Teufy — audit du 10 novembre 2026 (matinée, 2ᵉ passage)

Protocole : `outils/PROMPT-AUDIT.md` (lancé en écrivant **`audit`**). Notes honnêtes : une note n'est donnée que pour
ce qui a été mesuré ou testé ; ce qui n'a pas pu l'être est listé en J. Ce n'est pas une certification indépendante.
Nouveautés de ce passage : **contrôle visuel automatique** (images déformées, rubrique visible dans le menu, vides dans
les cartes, formulaires) ajouté aux tests, après des défauts repérés à l'œil par le directeur et passés entre les mailles.

## A. Note générale

| | Note |
|---|---|
| Rapport précédent (10/11, matin) | 95 / 100 |
| Début de cet audit | **93 / 100** : défauts visibles signalés par le directeur (logos ovales, menu qui revient au début, boutons « Devenir partenaire » sans action, vide dans les cartes « Ce soir », glisser qui ouvrait une soirée), affiches paysage floues (régression), WebKit en échec sur la FAQ |
| Fin de cet audit | **96 / 100** |
| Objectif | 99 / 100 : **non atteint** (voir K et L) |

## B. Notes par catégorie

| Catégorie | Note | Justification |
|---|---|---|
| Design et cohérence | 9,6 / 10 | Logos ronds partout (0 image déformée sur 30 pages × 4 écrans), carrousel « Ce soir » uniforme (cadre 4/5, affiches paysage entières), cartes sans grand vide (≤ 30 px). Reste : 59 affiches sources de petite taille (correctif poussé, à appliquer au prochain passage du robot). |
| UX et navigation | 9,7 / 10 | Rubrique ouverte centrée et surlignée dans le menu, y compris sur les fiches soirées et les articles (rubrique parente) ; glisser n'ouvre plus de soirée ; formulaire « Passer à l'action » sur les 3 pages pros, atteint directement depuis les boutons. |
| Performances | 9,6 / 10 | Production, après déploiement : ordinateur 100 / 100 (5 pages) ; mobile accueil 94–95, Occitanie 92 → **97** (TBT 270 → 20 ms), Clubs & bars 99, FAQ 97, fiche soirée 98. CLS ≤ 0,016. |
| Animations | 9 / 10 | Éventails, apparitions, carrousels, transitions, mouvements réduits respectés. |
| Fonctionnalités | 14,3 / 15 | Tous les parcours passent en local (Chromium), dont le nouveau formulaire (vide refusé, caractères spéciaux, 3 000 caractères, HTML non interprété, e-mail pré-rempli). IA payantes toujours à court de crédit. |
| Compatibilité | 9,3 / 10 | CI version précédente : Chromium ✓, Firefox ✓ (robustesse + usage) ; WebKit : robustesse ✓, usage ✗ sur un clic FAQ (correctif poussé, série en cours). Aucun appareil physique. |
| SEO | 9,9 / 10 | 1 776 pages, 0 problème bloquant, sitemap de 1 776 URL, SEO Lighthouse 100 sur les 10 mesures. Search Console non connectée. |
| Contenus | 4,8 / 5 | Doublon « Postuler sur Instagram » supprimé au profit du formulaire. Nouveaux textes du formulaire pas encore traduits (IA à court de crédit) : affichés en français dans les autres langues. |
| Images et vidéos | 4,7 / 5 | 0 image cassée, 0 déformée, 0 floue (contrôle 4 écrans) ; vidéo Monaco lue en entier et en boucle. Bonnes pratiques Lighthouse à 96 sur une fiche (affiche source de 420 px). |
| Sécurité et robustesse | 4,7 / 5 | GitHub Models réservé à GitHub Actions (le jeton d'une session locale ne sert plus jamais) ; formulaire sans HTML interprété ; robustesse ✓ sur 3 navigateurs. GitHub Pages : pas d'en-têtes HTTP de sécurité configurables. |
| Accessibilité | 4,8 / 5 | Lighthouse 100 sur les 10 mesures ; champs du formulaire libellés, message d'état annoncé (`role="status"`). Pas de test avec un vrai lecteur d'écran. |
| Innovation et finitions | 4,8 / 5 | Formulaire qui prépare le message (Instagram ou e-mail) sans serveur, menu contextuel, garde anti-glissement. |
| **Total** | **96 / 100** | (arrondi de 95,9) |

## C. Inventaire des tests

- **Pages** : 1 776 (6 langues), 30 types de pages × 4 écrans (iPhone 13, iPad Mini, 1440, 1920) ; 10 mesures Lighthouse en production.
- **Liens** : 256 280 liens internes (0 cassé) ; liens externes contrôlés par l'audit SEO.
- **Images** : 41 113 balises ; contrôles de flou, de déformation et d'images cassées sur chaque page testée.
- **Formulaires** : 3 (partenaires, ambassadeurs, BDE) × 4 écrans : vide, caractères spéciaux, texte très long, injection HTML, e-mail pré-rempli, message copié pour Instagram.
- **Parcours** : `tester-site` (recherche, filtres, favoris, partage, ce soir, FAQ, formulaires, vidéo) ; `tester-robustesse` (16 scénarios piégés) ; test du glisser (souris et tactile).
- **Revue visuelle** : planches de captures mobile et ordinateur (pages pros, sorties, fiche soirée, actu, festivals, Occitanie, accueil, qui sommes-nous).

## D. Bugs trouvés pendant cet audit (corrigés)

| Bug | Gravité | Conséquence |
|---|---|---|
| Glisser le carrousel ouvrait parfois une soirée | Haute | Navigation involontaire |
| Grand vide en bas des cartes courtes du carrousel « Ce soir » | Moyenne | Rendu peu soigné |
| Affiches paysage recadrées et agrandies (250 %) dans le carrousel — régression de la correction précédente | Moyenne | Images floues sur grand écran |
| 2ᵉ logo de l'en-tête étiré en ovale (Wayne's, Beau Rivage) | Moyenne | Logos déformés |
| Menu revenu au début : rubrique ouverte hors écran ; aucune rubrique sur les fiches et articles | Moyenne | On ne sait pas où l'on est |
| Boutons « Devenir partenaire / Postuler / Organiser » sans action concrète | Haute | Conversions perdues |
| Ancien bloc « Postuler sur Instagram » en double du formulaire | Faible | Répétition |
| Occitanie : 48 cartes mises en page d'un coup | Moyenne | Blocage mobile 270 ms |
| FAQ rendue en différé : clic qui expire sous WebKit (CI) | Moyenne | Risque sur Safari |
| Secours GitHub Models pouvant utiliser le jeton d'une session locale | Moyenne (règle de sécurité) | Clé non prévue pour Teufy |
| Affiches Shotgun téléchargées en miniature (384 px, qualité 5 %) | Moyenne | 52 fiches avec affiche peu nette |

## E. Corrections (fichiers)

`site/app.js` (garde anti-glissement, menu centré, formulaire), `site/style.css` (carrousel, logos, formulaire, rendu à
l'approche des journées, FAQ toujours rendue), `src/site.mjs` (formulaire `blocContact`, liens `#contact`, rubrique parente
du menu, classe `entiere` des affiches, `versionGrande` / `agrandirAffiche`), `src/llm.mjs` (GitHub Models seulement
dans GitHub Actions), `outils/tester-site.cjs` (contrôles déformation, menu, vides, formulaires),
`tests/llm.test.mjs`, `tests/images-site.test.mjs`, `outils/RAPPORT-QUALITE.md`.

## F. Résultats des tests

| Test | Local | GitHub (CI) | Production |
|---|---|---|---|
| Liens + SEO | ✓ 0 cassé, 0 bloquant | ✓ | ✓ |
| Tests unitaires | ✓ 30 / 30 | ✓ | — |
| Robustesse | ✓ | ✓ Chromium, Firefox, WebKit (version précédente) | — |
| Usage (4 écrans) | ✓ (avec les nouveaux contrôles) | Version précédente : Chromium ✓, Firefox ✓, WebKit ✗ (clic FAQ, corrigé) ; dernière version : série en cours | ✓ Lighthouse 10 pages |

## G. Performances (Lighthouse, production teufyparty.com)

| Page | Mobile avant → après | Ordinateur |
|---|---|---|
| Accueil | 91 → 94–95 (LCP 2,0–2,2 s, TBT 220–250 ms) | 100 (LCP 0,5 s) |
| Occitanie | 92 → 97 (TBT 270 → 20 ms) | 100 |
| Clubs & bars | 99 | 100 |
| FAQ | 97 | 100 |
| Fiche soirée | 98 (bonnes pratiques 96 : affiche source 420 px) | 100 |

Accessibilité et SEO : 100 sur les 10 mesures. Pas de données de visiteurs réels (pas de mesure d'audience).

## H. SEO

Pages publiques indexables ; 404 en noindex ; sitemap 1 776 URL ; hreflang 6 langues ; données structurées
(Événements, FAQPage, fil d'Ariane, Organisation) ; aperçus de partage propres à chaque rubrique.

## I. Compatibilité réellement testée

Simulations : iPhone 13, iPad Mini, 390 / 1440 / 1920 px ; moteurs Chromium (local + CI), WebKit et Firefox (CI) ;
production sous Chromium (Lighthouse mobile et ordinateur). **Aucun appareil physique.** WebKit n'est pas installé
dans l'environnement local : ses résultats viennent uniquement de la CI.

## J. Limites

- **Crédits IA** : Gemini et Anthropic toujours à court ; pas de traduction des nouveaux textes.
- **Formulaire sans serveur** (GitHub Pages) : l'envoi passe par Instagram (message copié) ou l'e-mail (pré-rempli) ; la
  réception réelle n'a pas été testée (pas d'envoi de vrai message, règle « aucun message sans accord »).
- Shotgun n'est pas joignable depuis l'environnement local : l'agrandissement des affiches sera vérifié au prochain
  passage du robot sur GitHub.
- Eventbrite et Ticketmaster bloquent les robots ; pas de contournement.
- HTTP → HTTPS et Search Console non vérifiables d'ici.

## K. Améliorations restantes pour viser 99

1. Confirmer la série 3 navigateurs sur la dernière version (WebKit / FAQ).
2. Vérifier l'agrandissement des 59 petites affiches au prochain passage du robot.
3. Accueil mobile : TBT encore 220–250 ms (agenda très long) ; raccourcir l'accueil et « Clubs & bars » sur mobile.
4. Recharger les IA pour traduire les nouveaux textes ; Search Console + mesure d'audience sans cookie.

## L. Verdict

**96 / 100, objectif de 99 non atteint.** Tous les défauts signalés et trouvés ont été corrigés, testés et protégés
par de nouveaux contrôles automatiques ; la production mesurée est rapide (ordinateur 100, mobile 94–99) et sans erreur.
Restent à prouver : WebKit sur la dernière version, l'agrandissement des affiches et la traduction des nouveaux textes.
