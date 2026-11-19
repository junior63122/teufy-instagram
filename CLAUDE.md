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
- **Série animée Le Grand Débat** (« Et toi, t'aurais fait quoi ? » abandonnée le 16/11/2026) : produire les épisodes avec le moteur de `riviera-studio` et
  les voix ElevenLabs (crédits de l'abonnement Riviera) est autorisé **sans redemander** (directeur, 14/11/2026). Livrer dans
  `media/grand-debat/` (`NN-sujet.mp4` + `.txt` + `.couverture.txt`), après vérification à l'œil et contrôle qualité.
- **Cohérence des posts avec leur titre** (directeur, 18/11/2026) : chaque format a sa promesse (période, genre, prix, « après la
  boîte »…). `src/coherence.mjs` et `src/guide.mjs` (`ouvertApresBoite`) retirent ce qui ne colle pas, et le post est bloqué
  juste avant publication s'il reste une incohérence. Tout nouveau format doit ajouter sa règle et son test.
- **Spots promo de Teufy** (directeur, 18/11/2026 : « minimum 2 par semaine de ce style, des spots créatifs qui ne se
  ressemblent pas, certains sur certaines fonctionnalités, d'autres sur d'autres ; essaie des hooks différents, vois ceux qui
  marchent le mieux et améliore-toi ») : motion design GSAP (`studio/generateur-gsap/`, modèle `promo-teufy/`). Voix ElevenLabs
  (crédits de l'abonnement Riviera) autorisée **sans redemander** (réponse du directeur le 18/11/2026 : « Oui, sans
  redemander »). Livrer dans `media/spot-promo/` (`NN-sujet.mp4` + `.txt` + `.couverture.txt` + `.json`
  `{accroche, fonctionnalites}`) après zone sûre, `controle.py` et vérification à l'œil. Ils passent dans les créneaux promo
  (avant la promo automatique) ; l'apprentissage choisit d'abord le type d'accroche qui marche (`accroche-spot`). Avant d'en
  produire : `node outils/bilan-spots.mjs`, puis varier accroche, décor, rythme et fonctionnalités par rapport aux précédents.
  Couverture DA avec bouton lecture (photo de `decors/da/`). Chiffres affichés : relevés sur le site le jour même, sinon pas de chiffre.
- **Mise à jour hebdomadaire** (directeur, 19/11/2026 : « toutes les semaines, vois s'il y a des mises à jour à faire, des
  fonctionnalités à rajouter ; contrôle complet, tests de hacking, de pénétration, de contrôle d'accès et de tentative malveillante
  de modification des textes ou images ; si tu trouves des failles, répare-les dans la mise à jour ; mets le numéro de la mise à jour
  sur le site ») : chaque semaine, `node outils/tester-securite.cjs` (site servi par `outils/serveur-local.cjs`),
  `node outils/tester-donnees-piegees.mjs`, `npm audit --omit=dev` (racine et `studio/`, versions corrigées publiées depuis plus de
  2 semaines), recherche de clés dans le code et l'historique, revue des workflows (aucune entrée collée dans une commande),
  vérification que la veille et les posts actus tournent, idées de fonctionnalités ; puis réparer, tester (`npm test`), ajouter la
  version suivante en tête de `contenus/version.json` (numéro +1, date, notes en français simple) et faire un rapport au directeur.
  Ne jamais committer les pages reconstruites localement par les tests (le robot reconstruit le site).
- **Concours** (directeur, 19/11/2026, valable pour tous les concours) : on doit comprendre **tout de suite** que c'est un
  concours (le mot « Concours » et le lot visibles sur la couverture), mais le visuel **reste dans la DA du flux** (couverture
  standard du studio : photo de nuit, étiquette corail, titre, affiches en vignettes). **Le directeur valide les visuels avant
  toute publication** : un post prêt (`media/posts-prets/<date-nom>/`) et ses stories (`contenus/stories-pretes.json`) ne partent
  que si `"valide": true`, mis seulement après son accord écrit. Toujours : règlement (gratuit, 18 ans et plus, date et heure du
  tirage, nombre de gagnants et de places, « Instagram n'est ni organisateur ni partenaire »), mise en garde contre les faux
  comptes, tags vérifiés seulement. Rendu **pro** : aucun cadeau, gadget ou décor fantaisie (directeur : « fais que ça fasse
  pro ») ; **dès la couverture**, on voit quelles soirées sont en jeu (affiche, date, nom, style de chacune) et ce qu'on gagne.
  Modèle : `media/posts-prets/2026-11-19-concours-frigo16/sources/visuels.html`.
- **Pas d'emoji** (directeur, 19/11/2026 : « pas d'emoji bizarre, ça fait IA ») : aucun emoji dans les visuels (couvertures,
  slides, stories, vidéos), ni dans les légendes des concours et des posts prêts ; on compte avec « 1. », « 2. ».
- **Couvertures de la grille** (directeur, 19/11/2026 : « tu devais faire une image de couverture pour les réels », « tous les
  posts ont la même couverture (image + texte en bas), triste et monotone ») : chaque reel a sa couverture DA avec bouton lecture
  (jamais une image tirée de la vidéo, sauf panne, signalée dans le journal). Cinq mises en page de la DA tournent (`bas`, `haut`,
  `cadre`, `bandeau`, `centre` : `studio/src/da/Posts.tsx`, choix dans `src/photos.mjs` `choisirMise`) : jamais la même deux fois
  de suite, en plus de la règle des photos. Toute nouvelle mise est vérifiée à l'œil (texte long, débat, vignettes, reel).
