# Promo Teufy (motion GSAP) — sources et fabrication

Vidéo : `promo-teufy.mp4` — 1080×1920, 22 s, voix off ElevenLabs (exception du directeur, 18/11/2026), non publiée.

## Chiffres affichés (tous relevés sur teufyparty.com le 18 novembre 2026)
| Chiffre | Où | D'où il vient |
|---|---|---|
| **94** soirées à venir | compteur scène 2, carte récap | accueil de teufyparty.com : menu « Toute la Côte d'Azur et le Var 94 » et texte « 94 soirées à venir » (site généré par `src/site.mjs` à partir de nos données du jour) |
| **49** soirées à Nice | étiquette « Nice · 49 soirées » | page `soirees-nice/` : « 49 soirées » |
| Techno **22**, House **48**, Afro **15**, Shatta **13** | étiquettes des styles | menu du site (« Techno 22 », « House 48 », « Afro 15 », « Shatta · Dancehall 13 ») ; page `soirees-techno/` : « 22 soirées à venir » |
| **103** clubs & bars | compteur scène 5, carte récap ; voix : « plus de cent » | nombre de fiches liées sur la page `clubs-bars/` (103 liens `clubs-bars/<lieu>/` distincts) |
| **43** gratuit & bons plans | carte récap | menu du site : « Gratuit et bons plans 43 » |
| ouvert jusqu'à **2 h → 5 h** | horloge scène 6 | page `manger-tard/` : rubrique « Manger tard (2 h–5 h) » ; à l'écran : Castel « jusqu'à 4 h », Royal Food by Night « jusqu'à 5 h » (horaires publiés OpenStreetMap) |

Aucune fonctionnalité inventée : agenda par ville et par style, pages « Ce soir », fiches clubs & bars, « Manger tard », abonnement au compte, site teufyparty.com. Pas de partenaire cité, pas de fausse rareté.

## Images
- Captures de teufyparty.com (Playwright, mobile 390 px × 2,77) : accueil, soirees-nice, soirees-techno, clubs-bars, manger-tard, ce-soir. **Affiches des organisateurs masquées** (remplacées par un dégradé aux couleurs de Teufy).
- Photos libres : voir `img/CREDITS.json` (Miguel Mendez CC BY 2.0 ; Spike CC BY-SA 4.0), crédit affiché à l'écran.
- Logo et polices (Bricolage, Inter Tight) : direction artistique de Teufy.

## Son
- Voix : ElevenLabs, voix « Hugo » (3Tp5mYhT9wrfnry9pzvV), eleven_multilingual_v2, stabilité 0,3, style 0,7, vitesse 1,1 (entrée `pub` de `../voix.py`).
- Musique : `son/beat.wav` généré par `src/beat.mjs` (house 124 BPM, synthèse, sans droits), s'efface sous la voix (compression déclenchée par la voix).
- Bruitages : Mixkit (licence gratuite, usage commercial) : pop, whoosh, impact.
- Volume final : -14,1 LUFS.

## Refaire la vidéo
```bash
cd studio/generateur-gsap/promo-teufy
node ../rendu.cjs . 1 video_silent.mp4          # ✅ ZONE SÛRE attendu
python3 mix.py fr
ffmpeg -i video_silent.mp4 -i mix_fr.m4a -filter:a "loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart promo-teufy.mp4
python3 ../controle.py promo-teufy.mp4 timeline_fr.json 1
```
(Ne pas relancer `voix.py` sans accord : la voix est déjà dans `seg_fr/` et `timeline_fr.json`.)
