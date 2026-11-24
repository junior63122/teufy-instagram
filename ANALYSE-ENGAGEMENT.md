# Journal des revues de croissance

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
