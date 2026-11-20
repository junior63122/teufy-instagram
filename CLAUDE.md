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
  version suivante en tête de `contenus/version.json` (format « 1.13.02 » : corrections → dernier nombre +1 ; nouvelle
  fonctionnalité → nombre du milieu +1 et dernier à 01 ; énorme nouveauté → premier nombre +1, « 2.01.01 » ; date ; « public » : 1 à 3 phrases simples pour les visiteurs, sans détail technique, sans nom de prestataire ni de clé (directeur, 20/11/2026 : « pas autant de détails ») ; « notes » : détail interne, jamais affiché) et faire un rapport au directeur.
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
  Grille du profil (relevé du 20/11/2026) : vignettes recadrées en 3:4, icône Instagram en haut à droite, nombre de vues en bas
  à gauche ; rien d'important dans ces coins (posts : 150 px libres en bas ; reels : contenu entre y 300 et y 1500 sur 1920).
  Vérifier chaque nouvelle couverture dans les deux grilles (profil 3:4 et onglet Réels 9:16).
- **Auto-contrôle permanent** (directeur, 19/11/2026 : « tout ce qui doit être publié doit être publié, tu dois contrôler que ça
  l'a été, et si ce n'est pas fait, tout faire jusqu'à ce que ce soit publié ; un ok ne suffit pas, vérifie que chaque étape a
  fonctionné complètement ») : chaque publication est relue sur Instagram après l'envoi (`verifierMedia`) ; `node src/run.mjs
  controle` à chaque passage horaire (journal `contenus/controle-publication.json`) ; stories reprises tant qu'une image manque ;
  format de secours si un post ne se prépare pas ; quota de l'API gardé pour les publications. Contrôle quotidien par Claude
  (tâche programmée) : lire le journal et les passages du jour, réparer ce qui a cassé, et vérifier que la réparation marche.
  Les reels portent la pastille « RÉEL » sur leur couverture (on les distingue des posts dans la grille).
- **Planning et croissance confiés à Claude** (directeur, 20/11/2026 : « je te fais confiance, à toi de gérer le planning ; tous les
  2-3 jours vérifie les chiffres, vois ce que font les concurrents et prends des mesures de toi-même ; respecte toujours le design
  de la grille ; minimum 1 réel de promotion de Teufy par semaine ; les soirées tekno fonctionnent ; analyse bien les concurrents »).
  Tâche programmée (mardi et vendredi) : chiffres (`apprentissage.json`, `RAPPORT.md`), comptes comparables (`tendances-auto.json`,
  `contenus/tendances.json`), décisions écrites dans `ANALYSE-ENGAGEMENT.md` (journal daté), planning dans `config.json`, stock de
  vidéos prêtes (spots, « Tague ton pote ») tenu à 2 semaines d'avance. Ce qui marche le mieux (20/11) : actus « un nom vient de
  tomber », techno / Tekno, concours, posts où l'on se reconnaît et où l'on tague. Légendes sans emoji (`nettoyerLegende`).
- **Groq** (IA gratuite, secret `GROQ_API_KEY`, 20/11/2026 ; directeur : « aide-toi d'elle sur tout ce qui te semble pertinent,
  sauf les commentaires Instagram ») : secours gratuit de Gemini partout (veille et actus avec recherche web, vérification des
  affiches par lecture d'image, traductions du site, scénarios de reels, analyse, prospection, appels directs du site via
  `groqParties`). Jamais pour répondre aux commentaires Instagram. Une réponse vide ou non conforme n'est jamais prise pour un succès.
- **TikTok** (directeur, 20/11/2026 : il publie lui-même, 1 à 2 vidéos par jour ; « mets aussi les photos de couverture ») :
  planning automatique `src/tiktok.mjs` (12 h 30 et 19 h 30, page cachée `/tiktok/`, jamais la même vidéo en 14 jours). Chaque
  vidéo a sa couverture dans la charte (`media/tiktok/couvertures/<id>.jpg` : composition `couverture-reel`, mises en page qui
  tournent, sans pastille RÉEL ni bouton lecture) : à faire pour chaque nouvel épisode ou spot. Règles TikTok : accroche dans
  les 2 premières secondes, 7 à 15 s idéal, texte hors des zones de l'interface, mots-clés dans le texte et la légende, aucun
  alcool mis en avant, pas de musique sous droits dans le fichier (le directeur ajoute un son tendance dans TikTok), droit à
  l'image respecté pour les vidéos de soirée qu'il fournit.
- **Veille quotidienne** (directeur, 20/11/2026 : « surveille toutes les mises à jour de tout ce qu'on utilise pour ne jamais être
  pris de cours ; une fois par jour ; en cas de souci, répare sans me demander » ; idem pour les règles des réseaux sociaux et pour
  les soirées : « qu'il ne manque jamais d'informations » ; « connecte toutes les billetteries utiles ») : le robot
  `teufy-veille-technique.yml` (sans IA) écrit chaque matin `contenus/veille-technique.json` (API Instagram, modèles Groq et Gemini,
  actions GitHub, Node, failles npm, état de chaque billetterie de `config.json` `sources`, infos manquantes des soirées).
  Tâche programmée quotidienne de Claude : lire ce relevé, lire les annonces officielles (Meta / Instagram, TikTok, Groq, Google,
  GitHub, ElevenLabs), réparer et mettre à jour sans demander (tests, push, version), tenir `VEILLE.md` (journal daté :
  changements repérés, règles de publication mises à jour, décisions), puis compte rendu court au directeur.
