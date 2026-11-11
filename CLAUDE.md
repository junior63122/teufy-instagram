# Teufy — consignes pour les sessions Claude

- Textes destinés au directeur et au site : en français. Pousser directement sur `main` (pas de PR sauf demande).
- Site internet (teufyparty.com, généré par `src/site.mjs`) : à chaque modification importante, appliquer le
  protocole qualité `outils/PROTOCOLE-QUALITE.md` (tests, notes honnêtes sur 100, rapport A à L).
- **Commande « audit »** : quand le directeur écrit simplement `audit` (ou `/audit`), lancer immédiatement l'audit
  intégral décrit dans `outils/PROMPT-AUDIT.md` (prompt complet du directeur) en suivant `.claude/commands/audit.md`.
- Ne jamais demander ni afficher de clé secrète dans la conversation ; ne jamais utiliser une clé trouvée ailleurs.
- Instagram : ne taguer / mentionner que des comptes vérifiés (`src/comptes.mjs`).
- Pas de fausse rareté (jamais « plus que X places ») ; ne jamais inventer d'informations.
- **Crédit IA (Gemini, Claude) réservé aux robots automatiques** (posts, veille, prospection, site, programmés par cron
  ou par le déclencheur externe). Pendant le développement : ne jamais lancer à la main un workflow qui utilise une IA
  (Instagram automatique, Veille, Prospection, Paiements, Studio, tester les IA) ; tester en local (aucune clé IA ici)
  ou attendre le passage programmé. Seul le workflow « Lieux (images, carte, transports) » peut être lancé : il n'a pas
  de clé IA.
