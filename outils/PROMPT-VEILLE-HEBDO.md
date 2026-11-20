# PROMPT 3 — VEILLE HEBDOMADAIRE : SITE, BOTS INSTAGRAM, CONNECTEURS ET INFRASTRUCTURE

> Protocole fourni par le directeur le 20/11/2026 (« projet Henrique » = Teufy). Appliqué chaque semaine (tâche
> programmée du lundi), avec en alternance l'audit du site (`PROMPT-AUDIT.md`) et les parcours + bots
> (`PROMPT-PARCOURS-BOTS.md`). Rapports : `audits/AAAA-MM-JJ.md`, registre : `audits/REGISTRE.md`.
> Particularités de Teufy : il n'existe pas de compte Instagram de test ; les contrôles Instagram se font en lecture seule
> sur le compte réel (jamais de publication pendant la veille). Texte intégral du directeur ci-dessous.

## 0. RÔLE ET CADRE

Tu réalises la veille hebdomadaire du projet Henrique : site internet, bots et connecteurs Instagram, automatisations, infrastructure et services tiers.

Les prompts 1 (audit intégral du site) et 2 (1 000 parcours et fiabilisation des bots) restent les références de qualité. Ce prompt 3 ne les remplace pas : il sert à vérifier chaque semaine que rien ne s'est dégradé, que rien n'a été oublié et que rien n'est sur le point de casser.

Règles permanentes, identiques aux prompts 1 et 2 :
- Aucun test non exécuté ne doit être présenté comme réussi.
- Aucune absence d'erreur ne vaut preuve de succès.
- Les états SUCCESS_VERIFIED / PENDING_VERIFICATION / FAILED / PARTIAL_SUCCESS / UNKNOWN / BLOCKED s'appliquent aussi à la veille elle-même : chaque point contrôlé reçoit l'un de ces états.
- Ne publie rien, n'envoie aucun message et ne modifie rien sur le compte Instagram de production. Utilise un compte ou un environnement de test.
- Ne modifie pas la production sans point de restauration ni validation. Pour une correction risquée, prépare-la sur une branche et demande-moi validation.

⸻

## 1. REGISTRE MAÎTRE (POUR NE RIEN OUBLIER)

C'est le cœur de la veille. Si le fichier `audits/REGISTRE.md` n'existe pas, crée-le. S'il existe, mets-le à jour.

Il doit lister TOUT ce qui compose le projet, avec pour chaque élément : nom, emplacement, rôle, propriétaire, dépendances, date de dernière vérification et état.

Inventaire minimum :
- Toutes les pages et routes du site (publiques, privées, dynamiques, pages d'erreur).
- Tous les formulaires et leur destination réelle (email, base de données, CRM, webhook).
- Tous les bots, scripts, tâches planifiées (cron, workers, files d'attente) et webhooks.
- Tous les connecteurs et API tiers (Meta Graph API, Instagram, hébergeur, email, paiement, analytics, IA, etc.).
- Tous les jetons, clés API et secrets : emplacement (jamais la valeur), date de création, date d'expiration, date de dernière rotation.
- Nom de domaine, DNS, certificat SSL : dates d'expiration.
- Comptes et accès : qui a accès à quoi, double authentification activée ou non.
- Sauvegardes : où, à quelle fréquence, date du dernier test de restauration.
- Abonnements et services payants : échéances, quotas, coûts.
- Outils de monitoring et d'alerte en place.

Chaque semaine :
1. Compare le registre à l'état réel du code et de l'infrastructure.
2. Signale tout élément nouveau, disparu ou modifié qui n'est pas dans le registre.
3. Tout élément non vérifié cette semaine doit apparaître comme tel.

⸻

## 2. CE QUI A CHANGÉ DEPUIS LA SEMAINE DERNIÈRE

Avant tout test :
- Lis le rapport de la semaine précédente (`audits/AAAA-MM-JJ.md`).
- Liste les commits, déploiements, mises à jour de dépendances et changements de configuration depuis cette date.
- Liste les problèmes laissés ouverts la semaine dernière et vérifie s'ils sont résolus.
- Concentre les tests de non-régression sur les zones modifiées, sans négliger le reste.

⸻

## 3. CONTRÔLES DU SITE (CHAQUE SEMAINE)

- Build de production : il compile sans erreur ni avertissement critique.
- Suite de tests automatisés complète (unitaires, intégration, Playwright) : résultats exacts, aucun test désactivé ou ignoré en silence. Si un test a été désactivé, signale-le.
- Parcours critiques réellement exécutés sur le site déployé : accueil, navigation, formulaires de bout en bout, changement de langue, pages clés.
- Formulaires : envoi test réel, vérification que le message arrive réellement à destination (boîte mail, base, CRM). Vérifie aussi que les emails ne tombent pas en spam (SPF, DKIM, DMARC).
- Liens : aucun lien interne ou externe cassé, y compris dans les nouveaux contenus.
- Images et vidéos : toutes chargées, vidéos lues jusqu'à la fin quand c'est prévu.
- Console navigateur et logs serveur : aucune nouvelle erreur.
- Performances : Lighthouse mobile et ordinateur, Core Web Vitals. Compare aux valeurs de la semaine précédente et signale toute dégradation de plus de 5 %.
- Captures d'écran des pages principales en mobile, tablette et ordinateur, comparées à celles de la semaine précédente pour détecter les régressions visuelles.
- Accessibilité : contrôle automatisé (axe ou équivalent) et vérification clavier des parcours critiques.
- Scripts tiers (analytics, widgets, polices, CDN) : aucun ajout ou changement non prévu.

⸻

## 4. CONTRÔLES SEO ET VISIBILITÉ

- robots.txt et sitemap.xml accessibles et à jour, aucune page importante bloquée par erreur (noindex, canonical incorrect).
- Si Search Console est accessible : erreurs de couverture, pages exclues, baisse anormale des clics ou impressions, problèmes Core Web Vitals.
- Titres, meta descriptions, Open Graph des pages nouvelles ou modifiées.
- Aperçus de partage (WhatsApp, LinkedIn, Instagram) toujours corrects.

⸻

## 5. CONTRÔLES DES BOTS ET CONNECTEURS INSTAGRAM

### 5.1 Santé technique
- Chaque bot et chaque tâche planifiée a-t-il réellement tourné à la fréquence prévue cette semaine ? Compare le nombre d'exécutions attendu au nombre constaté.
- Taux de SUCCESS_VERIFIED, FAILED, UNKNOWN, PENDING_VERIFICATION, BLOCKED cette semaine, comparé à la semaine précédente.
- Aucune opération restée bloquée en PENDING_VERIFICATION ou UNKNOWN plus longtemps que prévu.
- Aucune action exécutée en double.
- Files d'attente : pas d'accumulation anormale, pas de tâches abandonnées.

### 5.2 Spécificités Meta / Instagram (souvent oubliées)
- Date d'expiration des jetons d'accès : alerte si l'un expire dans les 14 prochains jours.
- Permissions de l'application Meta : toujours accordées, aucune révoquée.
- Version de la Graph API utilisée : vérifie si elle approche de sa date de fin de support.
- Webhooks : abonnement toujours actif, réception effective d'un événement récent.
- Consommation des quotas et limites de taux (en-têtes d'usage renvoyés par l'API) : signale si on dépasse 70 %.
- Quotas de publication et règles de messagerie (fenêtre de réponse, politiques de Meta) toujours respectés.
- Changements récents dans la documentation ou les règles de Meta pouvant affecter les bots.
- État du compte Instagram : aucune restriction, avertissement ou blocage signalé.

### 5.3 Anti-faux-positifs
- Rejoue chaque semaine les scénarios anti-faux-positifs du prompt 2 (API qui répond OK mais action échouée, timeout, doublon, donnée ancienne prise pour nouvelle, etc.).
- Vérifie qu'un test qui devrait échouer échoue bien (injecte volontairement une anomalie et confirme que la validation la détecte).
- Contrôle par échantillonnage : prends au hasard au moins 10 opérations marquées SUCCESS_VERIFIED cette semaine et vérifie indépendamment, via une source distincte, que le résultat est réellement observable.

### 5.4 Coûts et ressources
- Coût des API payantes (y compris IA) cette semaine, comparé à la semaine précédente.
- Consommation serveur, mémoire, stockage, base de données.

⸻

## 6. SÉCURITÉ ET CONFORMITÉ

- Audit des dépendances (npm audit, pip-audit ou équivalent) : nouvelles vulnérabilités, mises à jour de sécurité disponibles.
- Recherche de secrets exposés dans le code, l'historique git, les logs et les fichiers publics.
- En-têtes de sécurité HTTP et HTTPS toujours en place.
- Certificat SSL et nom de domaine : alerte si expiration dans moins de 30 jours.
- Accès : aucun nouvel accès non prévu, double authentification active sur les comptes critiques (hébergeur, registrar, Meta, GitHub, email).
- Formulaires et bots : anti-spam et limitation de requêtes toujours actifs, aucun pic suspect.
- RGPD / CNIL : bandeau cookies fonctionnel (refus aussi simple qu'accepter, aucun cookie non essentiel déposé avant consentement), mentions légales et politique de confidentialité à jour, données personnelles collectées par le site et les bots conservées uniquement le temps prévu.

⸻

## 7. SAUVEGARDES ET CONTINUITÉ

- La dernière sauvegarde existe, est récente et complète (code, base de données, médias, configuration).
- Une fois par mois : test réel de restauration dans un environnement séparé.
- Procédure documentée pour remettre en service le site et les bots en cas de panne.

⸻

## 8. ROTATION D'APPROFONDISSEMENT

Chaque semaine, en plus des contrôles ci-dessus, réalise un audit approfondi d'un seul domaine, en rotation :
- Semaine 1 : UX et parcours utilisateurs (échantillon de profils du prompt 2).
- Semaine 2 : qualité visuelle et responsive (toutes les tailles d'écran).
- Semaine 3 : bots Instagram en profondeur (logique, cas limites, performances).
- Semaine 4 : sécurité et contenus (relecture des textes, informations obsolètes, dates).
Indique dans le rapport quel domaine a été approfondi et lequel sera le suivant.

⸻

## 9. CORRECTIONS

- Corrige directement les problèmes simples et sans risque, avec un test de non-régression.
- Pour les corrections risquées ou touchant la production, prépare-les sur une branche dédiée et liste-les dans le rapport pour validation.
- Après chaque correction, relance les tests concernés et les parcours critiques.
- Ne désactive, n'assouplis ni ne supprimes aucun test pour obtenir un résultat vert.

⸻

## 10. ALERTES ET ANTICIPATION

Liste tout ce qui risque de casser dans les 30 prochains jours :
- Expirations (jetons, certificats, domaine, abonnements, cartes de paiement).
- Versions d'API ou de dépendances bientôt obsolètes.
- Quotas ou coûts en hausse.
- Tendances inquiétantes sur plusieurs semaines (taux d'échec, performances, erreurs).

⸻

## 11. RAPPORT HEBDOMADAIRE

Enregistre le rapport dans `audits/AAAA-MM-JJ.md` et mets à jour `audits/REGISTRE.md`.

Commence par un résumé lisible en 30 secondes :
- Feu vert / orange / rouge pour : site, bots Instagram, connecteurs, sécurité, SEO, sauvegardes.
- Les 3 actions prioritaires qui me concernent.
- Ce qui expire ou risque de casser bientôt.

Puis le détail :
1. Changements depuis la semaine dernière.
2. Résultats de chaque contrôle avec son état (SUCCESS_VERIFIED, FAILED, UNKNOWN, etc.) et la preuve (sortie de test, capture, log).
3. Comparaison chiffrée avec la semaine précédente (performances, taux de réussite des bots, erreurs, coûts).
4. Problèmes découverts, gravité, corrections faites, corrections en attente de validation.
5. Éléments non vérifiés et pourquoi (accès manquant, outil indisponible, etc.).
6. Éléments du registre ajoutés, modifiés ou disparus.
7. Domaine approfondi cette semaine et conclusions.
8. Notes sur 100 par catégorie, justifiées, comparées à la semaine précédente. Aucune note ne doit être gonflée.

## RÈGLE FINALE

Si un contrôle n'a pas pu être fait, il apparaît en rouge ou en UNKNOWN, jamais en vert.
Je préfère un rapport honnête avec des zones d'ombre qu'un rapport parfait non vérifié.
