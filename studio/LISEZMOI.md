# Studio Teufy (Remotion)

Le studio produit les **reels créatifs** (explicatif, humour, immersif) et les **affiches premium**
(post unique, carrousel). Les soirées vont dans les posts et carrousels, jamais en catalogue dans les reels.

## Chaîne de production d'un reel

`node scripts/produire.mjs scripts/concepts/<id>.json`

1. **Préparatifs** : rushes vidéo Mixkit recadrés en vertical, script préalable (bande son…).
2. **Voix off ElevenLabs** (`eleven_v3`, voix françaises natives : Anatole, Victor, Adina), une seule prise
   pour tout le texte, avec minutage caractère par caractère. La voix est gardée en cache tant que le texte ne change pas.
3. **Scènes calées sur la voix** : chaque scène commence au premier mot de sa phrase. Les animations sont
   déclenchées par les mots (`quand(spec, 'mot', scène)`), pas par des secondes.
4. **Bruitages posés sur les mots** (`"sons": [{"son": "tampon", "mot": "arnaque"}]`) + souffle à chaque
   changement de scène ; musique baissée automatiquement sous la voix.
5. **Rendu Remotion** (1080×1920, 30 i/s) avec le Chromium local, puis **mastering** (yuv420p, −14 LUFS,
   crêtes limitées) et **contrôle qualité** (`scripts/controle.mjs`) : l'export est refusé s'il y a un défaut bloquant.

## Composants (src/)

- `ui/base.tsx` : caméra virtuelle, sous-titres mot à mot (pastille ou contour), mots masqués, tampon,
  éclats de particules, grain, vignettage, bande son (voix, musique avec ducking, bruitages).
- `ui/illus.tsx` : personnage articulé (coiffures, expressions, bouche qui parle, bras, clignements),
  téléphone, billet, oiseau, foule, bulle de commentaire qui se tape.
- `concepts/` : une composition par concept, chacune avec sa propre direction artistique.
  - `Paliers` (explicatif) : nuit + corail, caméra qui plonge dans le téléphone et monte l'escalier des paliers.
  - `Potes` (humour) : cartoon pop, aplats saturés, zooms « dramatiques », arrêt sur image.
  - `Nuit` (immersif) : vraies vidéos, format cinéma, vidéo dans les lettres, coupes sur les temps, ralentis.
- `posts/Affiches.tsx` : post unique et carrousel (affiches officielles, infos vérifiées).

## Ajouter un concept

1. Écrire le script `scripts/concepts/<id>.json` (type, voix, musique, scènes avec texte et sons, légende).
2. Si le concept a une mise en scène nouvelle, créer `src/concepts/<Nom>.tsx` et l'enregistrer dans `src/Root.tsx`.
3. `node scripts/produire.mjs scripts/concepts/<id>.json --still=3` pour vérifier une image, puis sans `--still`.

Le bot (`src/run.mjs`) prend le prochain concept non publié du type prévu au calendrier.

## Droits

Musiques et bruitages : Mixkit (licence gratuite, usage commercial, sans attribution), voir `public/*/CREDITS.json`.
Rushes : Mixkit. Polices : Archivo, Instrument Serif, Space Mono (OFL). Affiches : visuels officiels des
organisateurs, uniquement pour leurs propres soirées. Remotion : gratuit pour une structure de 3 personnes maximum.
