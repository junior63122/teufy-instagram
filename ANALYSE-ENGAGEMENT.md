# Journal des revues de croissance

## Revue du 24/11/2026, 11 h (mardi)
- Chiffres : identiques à l'analyse complète de 10 h 40 (ci-dessous) ; abonnés 14 426 le 23/11 (−48 depuis le 08/11).
- Stock de vidéos : « Tague ton pote » 6 épisodes en attente (6 mardis) ; spots promo : 0 en attente (les 3 publiés).
- Mesure prise : 2 spots promo montés avec les vraies vidéos de soirée du Drive du directeur (« Envoie ça à ton groupe qui dit
  « on verra » » et « POV : t'as enfin trouvé où sortir ce week-end »), 11 à 13 s, musique libre de droits (Mixkit) pour Instagram,
  carte de fin teufyparty.com, couvertures Instagram et TikTok de la DA vérifiées à l'œil. Avec 1 spot par semaine, stock jusqu'au
  09/12. Hypothèse testée : de vraies images de soirée retiennent mieux que le motion design (spots 01-03 : 3 à 4 s regardées).
- Prochaine revue (vendredi 27/11) : durée regardée du spot 04 (objectif : plus de 5 s), comptes touchés du carrousel du vendredi.

## Analyse complète des publications, 24/11/2026 (tâche programmée)

**Données** : 78 publications mesurées (`apprentissage.json`, de décembre 2024 au 21/11/2026), dont 61 faites à la main
(2024-2026) et 17 par le robot (depuis le 08/11/2026) ; abonnés relevés du 08 au 23/11. Limites : statistiques relues dans le
relevé du robot, pas en direct sur l'API (pas d'accès réseau à Instagram depuis la session d'analyse) ; les 3 publications du
22 au 24/11 ne sont pas encore mesurées ; rétention des réels = durée moyenne regardée seulement (pas de courbe).

| Moyennes par publication | Comptes touchés | Vues (réels) | J'aime | Enregistrements | Partages |
|---|---|---|---|---|---|
| Posts faits à la main (51) | 1 863 | — | 41,8 | 7,7 | 13,5 |
| dont listes à thème (Halloween, Nouvel An, techno, été) (23) | 2 287 | — | 59,8 | 13,8 | 21,8 |
| Réels faits à la main (10) | 2 528 | 3 944 | 42,5 | 7,9 | 4,7 |
| Posts du robot (9) | 697 | — | 6,7 | 0,8 | 2,9 |
| Réels du robot (7) | 491 | 655 | 2,3 | 0,1 | 0,9 |

Abonnés : 14 474 le 08/11, 14 426 le 23/11 (−48, environ −3 par jour). Avec 14 400 abonnés, un réel du robot touche 2 à 6 %
d'entre eux : la base est en grande partie inactive (beaucoup d'abonnés viennent d'anciens concours).

**Ce qui marche** (toutes périodes) : les listes de soirées à thème daté avec une promesse claire (été 2025 : 7 772 comptes,
116 enregistrements ; Halloween : 5 442 comptes, 174 partages ; Nouvel An : 3 900, 58 partages ; techno de janvier : 3 821,
80 partages) ; côté robot, les petits prix (« Fin de mois difficile ? », 1 292 comptes), le guide « Où manger à Monaco après la
boîte » (1 088), l'actu HUGEL (977, 8 partages) et le réel « Pourquoi l'entrée est gratuite avant 1 h » (1 140 vues, 6,8 s).

**Ce qui ne marche pas du tout** : les spots promo de l'appli (268 à 524 vues, 0 à 3 j'aime, 3 à 4 s regardées sur 13 : on
décroche avant la moitié), le Grand Débat (550 et 942 vues, 0 et 2 j'aime), les carrousels « coups de cœur » génériques
(355 comptes, le pire), et les publications de minuit (deux réels partis vers 0 h 50 à Paris le 11 et le 18/11).

**Les 3 causes principales**
1. **Trop de publicité pour l'appli, pas assez de soirées concrètes.** Sur les 16 publications mesurées du robot, 5 ne
   montrent aucune soirée (3 promos de l'appli, 2 Grand Débat) ; ce sont les moins vues. Ce qui a fait le succès du compte, ce sont des listes datées
   (« les soirées d'Halloween », « du Nouvel An », « la techno d'octobre ») qu'on enregistre et qu'on partage.
2. **Les réels perdent le spectateur dès les premières secondes** : 2,9 à 4,8 s regardées en moyenne pour le robot, contre 5 à
   7,6 s pour les réels faits à la main (images réelles de soirée, visages). Les visuels animés et les écrans de l'appli ne
   retiennent pas.
3. **Une base d'abonnés peu active et un compte relancé après un an de silence** : chaque publication peu engageante réduit
   encore la diffusion (moins de 5 % des abonnés touchés), d'où la baisse continue des abonnés.

**Comparaison avec les comptes de la Côte** (`tendances-auto.json`, 40 comptes, 15 analysés en détail) : les clubs locaux
(Down Town, Uptown, Nice) font environ 2 % de j'aime par abonné avec 1 à 2 publications par semaine, presque toujours de
vraies photos ou vidéos de leurs soirées (foule, DJ, visages) et une info pratique (heure, prix, adresse). Teufy (robot) est à
environ 0,03 % de j'aime par abonné. Les comptes d'événements qui marchent le plus (Partiful) jouent sur l'humour et la reconnaissance
(« situe-toi sur le tableau »), en carrousel.

**Correctifs mis en place le 24/11** (poussés sur `main`, 184 tests verts, couvertures vérifiées à l'œil)
- Décembre : le carrousel du vendredi devient « Les soirées du Nouvel An » (nuit du 31) une fois par semaine dès qu'il y a
  4 soirées du 31 avec affiche (`src/themes-posts.mjs`, `fenetreNouvelAn`, testé).
- Spots promo : 2 → 1 par semaine (le mercredi, minimum fixé par le directeur) ; le samedi passe en réel « tendance », le
  format réel du robot qui marche le mieux.
- Titres de secours concrets (« Où sortir cette semaine sur la Côte »…) au lieu de « Nos coups de cœur ».
- Scénarios et légendes des réels écrits d'abord par Gemini (essai d'une semaine, voir plus bas).
- Les événements de journée et ceux qui ne parlent pas aux 18-30 ans (orgue, classique, thé dansant) ne sont plus proposés aux posts.

**Signalé au directeur (ne coûte rien, mais demande sa participation)** : les vidéos de vraies soirées (Drive) sont ce qui
retient le mieux ; plus il y en a, plus le robot peut faire de réels « soirée réelle » au lieu de réels animés.

**À mesurer aux revues du 27/11 et du 01/12** : comptes touchés et partages du carrousel du vendredi (objectif : plus de
1 000 comptes, comme les meilleurs posts du robot) ; durée regardée des réels « tendance » du samedi contre les spots
(objectif : plus de 5 s) ; courbe des abonnés (objectif : arrêter la baisse) ; aucune publication après 21 h 30 à Paris (les deux
réels de 0 h 50 sont à expliquer : le garde-fou existe depuis le 12/11).

## Décision du 24/11/2026 : Gemini écrit les réels (essai d'une semaine)
- Directeur : « Gemini doit surtout servir au marketing ». Scénarios et légendes des réels (`studio/scripts/ecrire*.mjs`) :
  Gemini d'abord, Claude en secours ; Claude gardé pour l'analyse et la stratégie ; Groq pour le site, la veille, les traductions.
- À comparer aux revues du 27/11 et du 01/12 : vues, partages et enregistrements des réels écrits par Gemini contre ceux des
  deux semaines précédentes (écrits par Claude). Si l'engagement baisse nettement, remettre Claude en premier.
- Réponses aux commentaires : faites par le directeur lui-même pour le moment (`config.json`, commentaires.actif reste à false).

## Revue du 20/11/2026, 11 h (1re revue programmée)

- **Chiffres :** rien de nouveau depuis l'analyse de ce matin (dernier relevé du robot le 19/11 ; 11 posts du robot notés, abonnés 14 441). Les premiers effets du nouveau planning (version 1.14.03) seront visibles à partir du 24/11.
- **Concurrents :** l'analyse ne gardait que des moyennes, et la protection du quota d'API la limitait à 20 comptes par passage sur 40. Corrigé : les comptes sont relus à tour de rôle et le détail de leurs posts est gardé 10 jours ; le rapport quotidien (RAPPORT.md) donne maintenant, pour chaque compte, le rythme de publication, les likes et commentaires habituels, le taux d'interaction, la part de reels et leur meilleur post.
- **Décisions :** pas de changement de planning (trop tôt pour mesurer). Stock prêt : 6 « Tague ton pote », 3 spots promo, soit environ 3 semaines.
- **À mesurer à la prochaine revue (mardi 24/11) :** likes et partages des Tekno et techno du jeudi, premier « Tague ton pote » (commentaires avec tags), effet des légendes sans emoji ; comparaison de notre taux d'interaction avec celui des comptes locaux (nouveau tableau). Vérifier aussi que la clé Groq a été ajoutée et que les actus repartent.

---

## Analyse de départ : pourquoi si peu de likes et d'abonnés ? (20/11/2026)

Données : `apprentissage.json` (75 publications mesurées), `RAPPORT.md`, `tendances-auto.json` (40 comptes comparables analysés).

## Les chiffres

| | Posts du robot (8-18/11, 11 mesurés) | Posts de l'équipe (nov.-déc. 2025) | Meilleurs posts de l'équipe |
|---|---|---|---|
| Personnes touchées | 470 (médiane) | 1 000 à 2 300 | 3 800 à 5 400 |
| Likes | 5 (médiane), 0,7 pour 100 personnes touchées | 20 à 40, environ 2 pour 100 | 80 à 120, environ 3 pour 100 |
| Commentaires | 0,5 en moyenne | 1 à 4 (concours : 18 à 28) | |
| Abonnés gagnés | 0,4 en moyenne | 0 à 9 | 10 à 13 |

- 14 441 abonnés, mais chaque post n'en touche que 3 % environ. Les abonnés sont passés de 14 474 le 08/11 à 14 441 le 19/11 (-33).
- Chez les comptes comparables, le carrousel marche presque 4 fois mieux que le reel (score 10 contre 2,6).

## Hypothèses (de la plus probable à la moins probable)

1. **Une grande partie des abonnés ne regarde plus le compte.** Beaucoup sont venus par les concours (« abonne-toi + tague 2 potes »). Le compte n'a presque rien publié de janvier à novembre 2026 (5 concours seulement). Instagram montre un post d'abord à ceux qui interagissent avec le compte : avec peu d'abonnés actifs, chaque post démarre bas, puis s'arrête.
2. **Trop de contenus « pub » ou hors sujet, pas assez de contenus qu'on envoie à un pote.** Notes des formats : spots promo et « Grand Débat » en dessin animé (3 et 22/100, 0 like), guides « où manger » (15 et 16/100, 0 partage), carrousel commercial (6/100). Seuls la techno et les annonces d'artistes sont partagés (Édition Tekno 99/100, actu HUGEL 100/100). Les meilleurs posts de l'équipe étaient des sélections au bon moment (techno, Nouvel An, Halloween) et des textes où l'on se reconnaît (« La vérité, c'est qu'on a tous déjà eu cette… » : 67 likes, 8 commentaires).
3. **Des visuels qui font « robot ».** Mêmes photos d'illustration de foules, légendes pleines d'emojis et formules d'agence. Les comptes locaux qui marchent (clubs, DJ) montrent leurs vraies soirées et de vraies vidéos.
4. **Aucune réponse aux commentaires.** La réponse automatique est coupée depuis le 08/11 : le jeton Instagram n'a pas la permission `instagram_manage_comments`. Un commentaire sans réponse n'en appelle pas d'autre.
5. **Beaucoup de publications d'un coup.** On est passé de 0 à 12 publications par semaine, plus 4 à 5 stories par jour. Si chaque post fait peu de réactions, Instagram en montre moins les suivants. Le directeur a demandé de ne rien enlever au planning : on agit sur la qualité, pas sur le nombre.
6. **Des stories qui ne partaient pas.** Plusieurs stories ont échoué sans être reprises (quota de l'API Instagram dépassé). Réparé dans la version 1.13.02.

## Mesures prises par le robot (version 1.14.02)

- Légendes : plus aucun emoji (« ça fait IA »). Chaque légende se termine par un appel à **envoyer le post** à un pote (Instagram compte d'abord les envois en message privé). L'appel à s'abonner des promos est gardé.
- Couvertures : vraies affiches mises en avant, cinq mises en page qui tournent, coins de la grille libres (versions 1.13.02 et 1.14.01).
- Le Grand Débat est remplacé automatiquement par « Tague ton pote » après 3 épisodes nettement sous les autres reels (déjà en place). Le choix des formats, des accroches et des heures suit les notes.

## Ce qui dépend de l'équipe

1. **Valider le concours Frigo 16.** Les concours font 18 à 28 commentaires et 4 à 8 abonnés chacun : c'est notre meilleur levier mesuré.
2. **Donner la permission des commentaires** au jeton Instagram (`instagram_manage_comments`), pour que le robot réponde à chaque commentaire.
3. **Interagir 15 minutes par jour depuis le compte** sur les posts des organisateurs, des clubs et des DJ de la Côte : likes, commentaires, partages en story. L'API ne permet pas de le faire automatiquement.
4. **Des vraies vidéos de soirée.** La story du lundi « envoie ta meilleure vidéo » en récolte : les reposter en reel, en créditant les auteurs.

## 23/11/2026 : plus aucun jour sans publication
- Constat du directeur : « la dernière publication date d'il y a deux jours, c'est absolument pas normal ». Vérifié : le planning
  du 20/11 (écrit par moi) ne prévoyait rien le dimanche ; samedi 21 seul le réel promo est parti, dimanche 22 seulement des
  stories, prochain post lundi 23 à 17 h 07 (près de 48 h sans post dans le fil). Le contrôle n'a rien signalé car il ne vérifie
  que ce qui est prévu.
- Décision : un post chaque dimanche (créneau libre, choisi par l'apprentissage), et règle générale dans le code : un jour sans
  rien de prévu reçoit un post libre. Test `tests/planning-chaque-jour.test.mjs`. Semaine : lun 2, mar 2, mer 1, jeu 2, ven 1,
  sam 1, dim 1 publications dans le fil.
