---
description: Lance l'audit intégral du site Teufy (protocole qualité 99/100, boucle analyser → corriger → tester → noter, rapport A à L)
---
Lance maintenant l'audit intégral du site Teufy, en suivant **à la lettre** le prompt complet du directeur :
`outils/PROMPT-AUDIT.md` (version intégrale) et sa synthèse `outils/PROTOCOLE-QUALITE.md`.

Déroulé attendu :
1. Régénérer le site (`node src/run.mjs site --force`), démarrer `node outils/serveur-local.cjs` (port 8765).
2. Analyser toutes les pages (captures mobile, tablette, ordinateur) et noter sur 100 avec la grille des 12 catégories.
3. Corriger directement dans le code, puis relancer : `node outils/verifier-liens.mjs`, `node outils/audit-seo.mjs`,
   `npm test`, `node outils/tester-robustesse.cjs`, `node outils/tester-site.cjs` (et les 3 navigateurs en CI :
   workflow « Teufy — contrôle qualité du site »).
4. Recommencer tant qu'une catégorie est sous 99 % de son maximum, sans gonfler les notes.
5. Mettre à jour `outils/RAPPORT-QUALITE.md` (rapport A à L), committer et pousser sur `main`, puis remettre le
   rapport au directeur en français.

$ARGUMENTS
