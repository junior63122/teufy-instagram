# Promo Teufy (motion GSAP) — sources et fabrication

Vidéo : `promo-teufy.mp4` — **format Instagram Reels 1080×1920 (9:16)**, ≈ 19,7 s, voix off ElevenLabs (exception du directeur, 18/11/2026), **non publiée**.

## v3 (18/11/2026, soir) — retours du directeur sur la v2
- « Tu sais jamais où sortir **le** soir ? » (voix régénérée pour cette réplique et pour les styles : 63 caractères).
- 3 premières secondes choc : la boîte change d'angle à chaque mot (flash + secousse), la vitre se fissure sur « soir ? » et éclate quand le téléphone la traverse sur « Ouvre Teufy ». Musique étouffée pendant l'accroche puis qui éclate.
- Une relance visuelle chaque seconde environ (20 plans, 0,9 s en moyenne au contrôle qualité).
- « Près de toi » : plongée de drone sur une ville néon en 3D, faisceaux lumineux au-dessus des lieux ouverts (illustration, aucun nom de lieu).
- Styles raccourcis (« Techno, house, afro, shatta ! », 1,9 s au lieu de 3,5 s) : 4 plans plein écran, un par mot, couleur et motif propres.
- Boîte 3D : les danseurs en panneaux plats (ombres bizarres) sont retirés ; foule en contre-jour au premier plan, qui saute en rythme.
- Manger : « FERMÉ » en néon et musique coupée, puis vraies photos (pizza, burger, frites, brochettes) en rafale, horloge jusqu'à 05:00 et la vraie fiche Royal Food by Night (Nice, jusqu'à 5 h).
- Plus de « klaxon » : les deux « pop » Mixkit étaient des notes tenues (555 et 661 Hz) ; remplacés par des bruitages synthétisés (kick, sub, claquement, vitre, souffle, montée, coupure de courant).

## v2 (18/11/2026) — retours du directeur sur la v1
- Prononciation : plus aucun nom de ville dans la voix (« Nice » était lu comme l'adjectif anglais) ; l'adresse est dite « Teufy party point com » en mots séparés.
- Image ≠ voix : chaque élément tombe sur le mot qui le dit (horloge qui passe de 01 h à **05 h** sur « cinq heures », compteurs sur « gratuites » / « bons plans », « Abonné ✓ » sur « abonne-toi »).
- Plus seulement des captures : boîte de nuit en 3D (lasers, foule), téléphone, radar « près de toi », grands mots de styles, ticket « 0 € » tamponné GRATUIT, carte de la côte tracée de Toulon à Monaco, confettis.
- Musique plus présente et 14 bruitages calés sur l'image.
- Toute la Côte d'Azur : 7 villes à l'écran (Toulon, Saint-Tropez, Fréjus, Cannes, Antibes, Nice, Monaco), toutes couvertes par le site.

## Ce qui est dit et montré (fonctionnalités réelles du site)
| Phrase | Fonction du site |
|---|---|
| « Toutes les soirées de ce soir » | page `ce-soir/` (soirées de ce soir + boîtes ouvertes ce soir) |
| « Les boîtes ouvertes, juste à côté de toi » | page `ce-soir/` et bouton « Près de moi » (géolocalisation) des pages lieux |
| « Techno, house, afro, shatta ! » | pages par style |
| « Les soirées gratuites, et les bons plans » | rubrique « Gratuit et bons plans » |
| « On te trouve à manger jusqu'à cinq heures » | page `manger-tard/` (filtre « 5 h et + », horaires OpenStreetMap) |
| « De Toulon à Monaco » | pages villes Côte d'Azur et Var |

Le radar avec les pastilles « Ouvert » est une **illustration** (pas une capture) ; aucun nom de lieu n'y figure.

## Chiffres affichés (relevés sur teufyparty.com le 18 novembre 2026)
| Chiffre | Où | D'où il vient |
|---|---|---|
| **94** soirées à venir | carte de la côte | accueil : « 94 soirées à venir » / menu « Toute la Côte d'Azur et le Var 94 » |
| Techno **22**, House **48**, Afro **15**, Shatta **13** (« soirées à venir ») | plans des styles | menu du site (« Techno 22 », « House 48 », « Afro 15 », « Shatta · Dancehall 13 ») |
| **43** gratuit & bons plans | compteur scène gratuit | menu du site : « Gratuit et bons plans 43 » |
| **0 €** | ticket | entrée des soirées de la rubrique gratuite (pas de prix inventé) |
| **05 h** / « jusqu'à 5 h » | horloge, fiche Royal Food by Night | page `manger-tard/` : Royal Food by Night « jusqu'à 5 h » (horaires publiés OpenStreetMap) |

Aucune fonctionnalité, aucun partenaire, aucun chiffre inventé ; pas de fausse rareté ; aucune affiche d'organisateur.

## Images
- Capture de teufyparty.com (page ce-soir) dans un téléphone. Affiches masquées.
- Photos de nourriture : CC0 (WordPress Photo Directory via Openverse), auteurs dans `img/CREDITS.json`.
- Photo libre : Monaco (Spike, CC BY-SA 4.0), crédit affiché à l'écran.
- Boîte en 3D : `club3d.js` (three.js 0.149, MIT), création maison ; ville néon et foule dessinées par le code.
- Logo et polices (Bricolage, Inter Tight) : DA Teufy.

## Son
- Voix : ElevenLabs « Hugo » (3Tp5mYhT9wrfnry9pzvV), eleven_multilingual_v2, stabilité 0,3, style 0,7, vitesse 1,1 (entrée `pub` de `../voix.py`). Comparée à Léo et Victor : Hugo a la voix la plus vivante (écart de hauteur 12,3 demi-tons contre 3,9 et 6,0).
- Musique : `son/beat.wav` (src/beat.mjs, house 124 BPM, synthèse, sans droits), baisse légèrement sous la voix (compression déclenchée par la voix).
- Bruitages : synthétisés par `son/synthe.py` (kick, sub, claquement, vitre, souffle, montée, coupure) + Mixkit sans note tenue (swoosh, glitch, tampon, clic, acclamation).
- Musique étouffée pendant l'accroche, pleine dès « Ouvre Teufy », coupée sur « la boîte ferme » ; voix -13 LUFS, fond -19,6 LUFS (6,5 dB d'écart).
- Volume final : -14 LUFS.

## Refaire la vidéo
```bash
cd studio/generateur-gsap/promo-teufy
node ../rendu.cjs . 1 video_silent.mp4          # ✅ ZONE SÛRE attendu
python3 son/synthe.py   # bruitages
python3 mix.py fr
ffmpeg -i video_silent.mp4 -i mix_fr.m4a -filter:a "loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart promo-teufy.mp4
python3 ../controle.py promo-teufy.mp4 timeline_fr.json 1
```
(Ne pas relancer `voix.py` sans accord : la voix est déjà dans `seg_fr/` et `timeline_fr.json`.)
