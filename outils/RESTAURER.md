# Revenir à une version précédente du site (sauvegardes)

Mis en place le 21/11/2026 à la demande du directeur (« des sauvegardes du site pour revenir à une version précédente en cas
de souci grave »).

## Ce qui est sauvegardé

- **Chaque jour** (robot « Veille technique », vers 6 h 17), une sauvegarde nommée `sauvegarde-AAAA-MM-JJ` est posée sur
  tout le dépôt : pages du site, images, médias Instagram, données des soirées, code des robots et réglages. Elles sont
  gardées **90 jours**.
- **En plus**, tout l'historique est gardé par Git : chaque changement depuis le début du projet peut être retrouvé.
- Les clés secrètes ne sont pas dans les sauvegardes (elles restent dans les réglages GitHub).

## Remettre le site en ligne tel qu'il était (souci grave, 2 minutes)

1. GitHub → dépôt teufy-instagram → **Actions** → **Teufy - Mise en ligne du site (GitHub Pages)** → **Run workflow**.
2. Dans « sauvegarde », écrire le nom de la sauvegarde voulue, par exemple `sauvegarde-2026-11-21`, puis **Run workflow**.
3. Le site d'avant est en ligne en 2 à 3 minutes.

Attention : au passage suivant d'un robot (30 min au plus), la version actuelle reviendrait. Pour **garder** la sauvegarde en
ligne le temps de réparer : créer le fichier `contenus/gel-site.txt` avec le nom de la sauvegarde sur sa première ligne (ou
demander à Claude « gèle le site sur la sauvegarde du 21/11 »). Les robots continuent leur travail, mais c'est la sauvegarde
qui reste visible. Pour revenir à la normale : supprimer `contenus/gel-site.txt`.

## Revenir en arrière sur le code ou les données (pas seulement l'affichage)

Demander à Claude : « reviens à la sauvegarde du JJ/MM pour … » ; il annule les changements fautifs (sans effacer
l'historique), relance les tests et vérifie le site, puis retire le gel.

## Contrôles

- La veille hebdomadaire vérifie que la sauvegarde du jour existe et, une fois par mois, fait un essai de retour sur une
  copie (sans toucher au site en ligne).
