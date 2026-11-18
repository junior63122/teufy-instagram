# Spot promo n°2 « Manger tard » (18/11/2026) — sources et fabrication

Vidéo : `spot.mp4` (copiée dans `media/spot-promo/02-manger-tard.mp4`), Reels 1080×1920, ≈ 14 s. Accroche : **POV**
(écran verrouillé à 04:00, notifications de potes qui ont faim). Une seule fonctionnalité : **Manger tard**.

| Ce qui est dit ou montré | Source |
|---|---|
| Filtre « Ouvert ce soir jusqu'à 2 h / 3 h / 4 h / 5 h et + » | vraie page teufyparty.com/manger-tard/ (captures du 18/11/2026) |
| « Près de moi » : le plus proche (« à 300 m ») | vraie page, bouton « Près de moi », position simulée à Nice (Promenade), horloge du navigateur réglée sur samedi 04:05 : c'est le site lui-même qui calcule ce qui est ouvert et la distance |
| « De Toulon à Menton » + liste des villes | villes listées sur la page (Nice, Cannes, Saint-Laurent-du-Var, Monaco, Saint-Tropez, Toulon… Menton, Fréjus, Bandol, Golfe-Juan) |
| Notifications (Yanis, Inès, Sami, groupe « Soirée ») | mise en scène (personnes fictives), aucune vraie conversation |

Pas d'affiche d'organisateur (haut de la page non utilisé), aucun chiffre qui pourrait vieillir, pas de fausse rareté.

Photos : Promenade des Anglais de nuit (Miguel Mendez, CC BY 2.0, crédit à l'écran) ; pizza, burger, frites, brochettes :
CC0 (WordPress Photo Directory via Openverse), auteurs dans `../promo-teufy/img/CREDITS.json`.
Son : voix ElevenLabs « Hugo » (entrée `pub` de `../voix.py`) ; musique `src/beat.mjs` (club, graine 23), étouffée sur
l'écran verrouillé ; bruitages synthétisés (`son/synthe.py` : kick, sub, claquement, souffle, montée, ding, tap) + Mixkit
(clic, swoosh, acclamation). Voix -13,6 LUFS, fond -20,2 LUFS ; final -14 LUFS.

Refaire : `node ../rendu.cjs . 1 video_silent.mp4 && python3 mix.py fr && ffmpeg … spot.mp4 && python3 ../controle.py spot.mp4 timeline_fr.json 1`
