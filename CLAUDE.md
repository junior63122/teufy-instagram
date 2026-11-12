# Teufy — consignes pour les sessions Claude

- Textes destinés au directeur et au site : en français. Pousser directement sur `main` (pas de PR sauf demande).
- Site internet (teufyparty.com, généré par `src/site.mjs`) : à chaque modification importante, appliquer le
  protocole qualité `outils/PROTOCOLE-QUALITE.md` (tests, notes honnêtes sur 100, rapport A à L).
- **Commande « audit »** : quand le directeur écrit simplement `audit` (ou `/audit`), lancer immédiatement l'audit
  intégral décrit dans `outils/PROMPT-AUDIT.md` (prompt complet du directeur) en suivant `.claude/commands/audit.md`.
- Ne jamais demander ni afficher de clé secrète dans la conversation ; ne jamais utiliser une clé trouvée ailleurs.
- Instagram : ne taguer / mentionner que des comptes vérifiés (`src/comptes.mjs`).
- Pas de fausse rareté (jamais « plus que X places ») ; ne jamais inventer d'informations.
- **Crédit IA (Gemini, Claude) réservé aux robots automatiques** (règle du directeur, tous dépôts et tous projets) :
  posts, veille, prospection, site, lancés par l'horaire GitHub ou par le déclencheur externe. Tout le reste (développement,
  demandes faites dans la conversation, lancements manuels) utilise uniquement des solutions gratuites. Ne jamais lancer à
  la main un workflow qui utilise une IA ; tester en local (aucune clé IA ici). Seule exception : quand le directeur écrit
  explicitement que c'est une exception (case « exception_ia » des workflows). Garde-fous dans le code : les workflows
  lancés à la main n'ont pas les clés IA (TEUFY_IA_MANUEL=1) ; seul le workflow « Lieux (images, carte, transports) » peut
  être lancé, il n'a pas de clé IA.
- **Les publications passent toujours** : le plafond IA du jour ne doit jamais empêcher de créer ou de poster
  (TEUFY_PUBLICATION=1 : dépassement du plafond du jour en exception ; sans IA du tout, carrousel des soirées de secours).
