# Générateur motion GSAP (copie de riviera-studio)

Générateur de vidéos verticales 1080×1920 en **motion design** : une page HTML animée par une **timeline GSAP**, capturée image par image avec Playwright, puis montée en MP4 avec ffmpeg. Il permet de mélanger **vraies photos** (panoramiques, zooms), **cartes en verre**, **schémas et trajets qui se tracent** (MotionPathPlugin), **compteurs**, **personnages** (images détourées) et **sous-titres mot par mot avec le mot clé surligné**, calés sur une voix off.

Il est indépendant de `src/motion.mjs` (le système de reels existant de Teufy) : rien n'est modifié ailleurs.

## Installer
```bash
cd studio/generateur-gsap && npm install
```
Playwright et Chromium sont ceux du dépôt.

## Fabriquer une vidéo
1. **Copier `exemple-monaco/`** dans un nouveau dossier (par exemple `episodes/mon-sujet/`).
2. **Écrire `script_fr.json`** : une liste de `["narr", "phrase"]` (personnages possibles : `narr`, `leo`, `kevin`, `patron`, `ines`, `videur`).
3. **Générer les voix** : `python3 ../voix.py fr` dans le dossier de l'épisode. Ça crée `seg_fr/` et `timeline_fr.json`, avec le minutage de chaque mot et les silences resserrés.
   ⚠️ **Règle Teufy sur les crédits IA** : les voix ElevenLabs (abonnement Riviera) sont autorisées sans redemander **pour Le Grand Débat**. Pour tout autre usage, il faut l'accord explicite du directeur. Sinon, faire une vidéo sans voix (musique et sous-titres seulement).
4. **Adapter `index.html`** : les scènes (`#s0`, `#s1`…) et la fonction `build()`, qui place chaque animation sur la timeline à partir des débuts de répliques (`S[i]`).
5. **Rendre** : `node ../rendu.cjs . 1.15 video_silent.mp4` (1.15 = vitesse, le bon rythme validé par le directeur). Pour vérifier quelques images : `node ../rendu.cjs . 1 x stills=1.2,5.5,9.4`.
6. **Mixer le son** (voix, bruitages, musique, `atempo` à la même vitesse, `loudnorm` à -14 LUFS), puis assembler avec ffmpeg.
7. **Contrôle qualité** : `python3 ../controle.py video.mp4 timeline_fr.json 1.15`.

## Règles intégrées
- **Zone sûre TikTok/Reels** : `rendu.cjs` mesure chaque texte de chaque image et signale ceux qui sortent de la zone visible (bords recadrés, barre du haut, icônes à droite, description en bas). Il faut zéro alerte avant de publier. Pour un texte purement décoratif, mettre l'attribut `data-deco` sur son élément.
- **Le contrôle qualité** vérifie l'accroche avant 1,5 s, les silences, le volume, la durée et les « secondes mortes » (aucune seconde sans mouvement).
- **Vraies photos** : uniquement sous licence libre (Wikimedia Commons, Openverse…), avec **le crédit affiché à l'écran**. Les crédits sont rangés dans `img/CREDITS.json`.
- **Ne jamais inventer d'information** : chaque chiffre affiché doit avoir sa source.

## Exemple fourni
`exemple-monaco/` : 17 secondes (Objectif Monaco) avec vraies photos de Nice et Monaco (Wikimedia, Spike, CC BY-SA 4.0), carte bancaire en verre, trajet Nice → Monaco tracé avec un train qui le suit, prix au m² qui défile, transition en cercle, calendrier, choix final, sous-titres surlignés.
