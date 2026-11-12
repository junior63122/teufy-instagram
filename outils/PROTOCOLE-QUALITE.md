# Protocole qualité du site Teufy (référence permanente)

Demandé par le directeur de Teufy : à **chaque modification importante du site**, appliquer ce protocole
et viser **99/100 minimum dans chaque catégorie**, cible 100/100. Analyser → corriger → tester → noter → recommencer.
Aucune note gonflée : une note n'est valable que si elle est démontrée par des tests ou des mesures.

## Grille de notation (100 points)

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

## Outils (tous dans `outils/`)

```bash
node outils/serveur-local.cjs &        # imite GitHub Pages (gzip, 404, redirections, vidéos par morceaux)
node outils/verifier-liens.mjs         # tous les liens internes, images, photos non répétées
node outils/audit-seo.mjs              # title, description, H1, hiérarchie, canonical, hreflang, OG, JSON-LD,
                                       # sitemap/robots, alt et dimensions des images, noopener, secrets exposés
node outils/controle-donnees.mjs --ocr  # données affichées : texte cassé (undefined, 23h59…), dates du titre et de l'affiche (OCR), doublons, billetterie, comptes Instagram non vérifiés
node outils/tester-robustesse.cjs      # « casser le site » : saisies piégées, clics frénétiques, rotation, retour,
                                       # stockage bloqué, sans JS, géoloc refusée, hors ligne, clavier, écrans 320–2560,
                                       # boutons recouverts / illisibles / vides, textes coupés, console et requêtes,
                                       # cache hors connexion, mini-carte
node outils/tester-site.cjs            # tous les parcours sur mobile, tablette, ordinateur, grand écran
NAVIGATEUR=webkit node outils/tester-site.cjs   # idem avec le moteur de Safari (ou firefox)
```

Le workflow `.github/workflows/teufy-qualite.yml` relance tout automatiquement (Chromium, WebKit, Firefox)
à chaque modification du code du site. Lighthouse (mobile et ordinateur) en complément.

## Règles

1. Tester le comportement réel (Playwright, captures), jamais supposer qu'un bouton marche.
2. Chaque bug : reproduire, corriger, ajouter un test de non-régression, retester.
3. Ne rien inventer (chiffres, partenaires, infos des lieux) ; ne rien supprimer pour masquer un problème.
4. Ne revendiquer aucun test non exécuté ; signaler ce qui n'a pas pu être vérifié (appareils physiques,
   données réelles des visiteurs, Search Console…).
5. Rapport à chaque exécution : A note générale, B notes par catégorie, C inventaire des tests, D bugs,
   E corrections, F résultats des tests, G performances, H SEO, I compatibilité, J limites,
   K améliorations restantes, L verdict.
