# Teufy · Instagram automatique (Shotgun + DICE)

L'automate publie 9 contenus par mois sur Instagram. Il mesure les résultats de chaque post et ajuste la suite pour gagner en engagement et en abonnés.

| Quand (vers 17h-20h, heure apprise) | Publication |
| --- | --- |
| 1er lundi du mois | **Les incontournables de la semaine** : soirées commerciales (house, shatta, afro, électro…) |
| 1er jeudi | **Reel** : les soirées du week-end, numérotées (« Laquelle tu choisis ? ») |
| 2e mercredi | **Conversation** : un débat (A ou B ?) ou un appel aux organisateurs #TeufyParty (« Vous organisez une soirée ce week-end ? Postez-la ici 👇 ») |
| 2e vendredi | **Bon plan** : sortir sans se ruiner (gratuit ou moins de 10 €) |
| 3e lundi | **Les incontournables techno** : univers visuel à part |
| 3e jeudi | **Reel techno** |
| 4e mardi | **Bon plan** : les grosses dates à réserver avant qu'elles soient sold out |
| 4e mercredi | **Conversation** (débat ou #TeufyParty) |
| 4e vendredi | **Reel petits prix** |

Le calendrier se modifie dans `config.json` (`calendrier`).

## Les infos viennent de Shotgun et DICE

Pour chaque soirée, le bot récupère sur Shotgun et DICE l'**affiche**, le **titre**, le **style musical** (tags de la billetterie), la **date et l'heure**, le **lieu**, le **prix** et, quand la billetterie l'affiche, la **popularité** (nombre d'intéressés ou de participants). Si la liste ne donne pas tout, il ouvre la page de la soirée pour compléter.

Sur les visuels, l'affiche est montrée **en entier**, sans recadrage, avec le style musical par-dessus. Dessous figurent le nom de la soirée, puis Quand / Où / Prix / Billets. L'agenda reprend chaque soirée avec sa vignette, l'heure, le style, le lieu et le prix.

Tes propres soirées vont dans `evenements-manuels.json` et passent toujours en tête.

## Toutes les soirées de la Côte d'Azur

Shotgun protège ses pages par une vérification anti-robot, que le bot ne contourne pas. Les soirées viennent donc de quatre sources :
1. **Recherche web par Claude**, tous les 3 jours, sur les 45 jours à venir : agendas des villes (Nice, Cannes, Antibes, Monaco, Menton…), offices de tourisme, billetteries (Shotgun via les moteurs de recherche, DICE, Resident Advisor, Weezevent, Billetweb, Eventbrite, HelloAsso, Fever…), sites des clubs, collectifs, presse locale, festivals.
2. **Posts Instagram des organisateurs et clubs** listés dans `contenus/organisateurs.json`. Le bot lit leurs posts des 3 dernières semaines via l'API officielle et en tire les soirées annoncées, avec l'affiche du post. L'API ne donne pas la liste des comptes que Teufy suit : ajoute-les dans `comptes`. Ceux que la recherche web découvre arrivent dans `suggeres` et sont aussi lus.
3. **DICE**, directement.
4. **Tes soirées** dans `evenements-manuels.json`, toujours prioritaires.

**Tri pour les 17-30 ans** : chaque soirée trouvée sur le web reçoit une note de pertinence (clubs, DJ, techno, afro, shatta, rap, soirées étudiantes, open airs… en tête ; théâtre, classique, enfants, seniors écartés) et une note de fiabilité. En dessous de 0,5 de pertinence ou 0,6 de fiabilité, la soirée est écartée. Les soirées gardées sont mises en cache dans `evenements-web.json`.

Coût indicatif : 1 à 3 € par recherche, deux par semaine environ (réglages dans `config.json` → `recherche_web`).

## Des posts qui donnent envie (et des infos justes)

- **Jamais de soirée du soir même** : une soirée n'est montrée que si elle commence au moins 24 h après la publication (`reglages.delai_min_heures`).
- **Infos vérifiées** : chaque soirée trouvée sur le web est contrôlée sur sa page. Le nom doit y figurer et la date concorder, sinon elle est écartée, sauf si elle est confirmée par une billetterie officielle.
- **Accroche par soirée** : une phrase qui donne envie, uniquement à partir de faits (line-up, concept, lieu), dans la légende.
- **Organisateurs et lieux tagués** : @mention dans la légende et identification sur la diapo de leur soirée, pour qu'ils soient prévenus et repartagent. Si Instagram refuse une identification, le post part sans elle.

## Reels en motion design

Les reels sont animés : accroche mot par mot, affiches qui tombent, numéros qui apparaissent, bandeaux qui glissent, transitions « whip », glitch et stroboscope pour la techno, et décor animé selon le moment de l'année.

Les **temps forts** sont dans `contenus/da.json` → `temps_forts` : Nouvel An ✨🎆, Noël ❄️🎄, Halloween 🎃🦇, Saint-Valentin 💘, Carnaval de Nice 🎭, Pâques 🐣 (date calculée chaque année), Fête de la musique 🎶, ski ❄️🎿, printemps 🌸, été ☀️🌴. Pour chacun : couleur, décor animé et parfois un titre spécial. Le décor apparaît aussi sur les couvertures.

Le 3e reel du mois alterne entre « petits prix » et **reel explicatif** : astuces et sujets du moment (payer moins cher, éviter les arnaques aux billets, rentrer en sécurité, dress code, première rave…), dans `contenus/sujets-reels.json`. L'analyse hebdomadaire propose de nouveaux sujets d'actualité, et le bot garde le format qui marche le mieux.

**Musique** : dépose des .mp3 dans `assets/musiques/club/` et `assets/musiques/techno/`. Par exemple, la bibliothèque musicale de Pixabay (pixabay.com/music) est gratuite et autorisée pour un usage commercial. Les morceaux trop courts sont mis en boucle et le volume est égalisé. Sans musique, les reels sont muets.

## Voix off, sous-titres, musique et formats

- **Voix off ElevenLabs** (modèle `eleven_v3`, voix naturelles en français). Elle lit l'accroche, présente chaque soirée et les points des reels explicatifs. Secret GitHub `ELEVENLABS_API_KEY`. L'usage commercial demande au moins l'offre Starter (environ 6 $/mois). Choisis une voix française dans la bibliothèque ElevenLabs et mets son identifiant dans le secret `ELEVENLABS_VOICE_ID` ou dans `config.json` → `voix_off.voice_id`. Sans identifiant, le bot prend une voix française du compte. Sans clé, les reels n'ont pas de voix off : les voix de synthèse gratuites (Piper) sont désactivées.
- **Sous-titres karaoké** synchronisés mot à mot sur la voix (minutage fourni par ElevenLabs) : par groupes de 3 mots, le mot prononcé passe en corail.
- **Musique** : un .mp3 de `assets/musiques/club/` ou `techno/` s'il y en a. Sinon, une boucle house (124 BPM) ou techno (132 BPM) générée par le code, sans droits. Les coupes tombent sur les temps de la musique, comme dans HyperFrames.
- **Bruitages** générés par ffmpeg (whoosh, impact, pop) et **mixage** : la musique baisse quand la voix parle, et le volume est réglé au niveau Instagram.
- **Carrousel ou post unique** : avec 1 ou 2 soirées, post unique « programme ». Au-delà, le bot teste les deux formats.

### Outils utilisés (tous gratuits)

| Besoin | Outil |
| --- | --- |
| Animation des reels | Pages HTML/CSS animées, capturées image par image avec Chromium : même principe que HyperFrames (Apache 2.0), dont j'ai repris la grille de tempo et la musique générée |
| Montage, son, bruitages | ffmpeg |
| Voix off | ElevenLabs (payant, offre Starter minimum pour un usage commercial) |
| Musique | Boucles générées par le code au tempo des coupes, ou tes .mp3 |
| Photos | Banque CC0 (StockSnap via Openverse), Pexels en option |
| Recherche des soirées, analyse | Claude (clé API, payant à l'usage) |

Règles de légende reprises de sergebulaev/instagram-skills (MIT) : accroche dans les 125 premiers caractères, 3 à 5 hashtags ciblés, jamais de chiffre inventé.

Pas utilisés : OpenMontage (licence AGPL, pensé pour être piloté à la main), yt-dlp, pour ne pas reprendre de vidéos d'autres comptes (droits d'auteur, et Instagram pénalise le contenu non original), et les générateurs vidéo IA payants (Higgsfield…).

## Visuels qui s'adaptent

Le bot teste lui-même plusieurs options et garde celles qui ont la meilleure note : mise en page de la couverture (titre centré ou en bas), accroches, intros, photos, format du 3e reel, heure de publication. L'analyse hebdomadaire peut aussi proposer de nouveaux tests.

## Il choisit les meilleures soirées et apprend tout seul

Chaque jour, le bot relève les statistiques des posts des 3 dernières semaines : portée, likes, commentaires, enregistrements, partages, abonnements gagnés, visites du profil et temps de visionnage des reels. Il note aussi le nombre d'abonnés. Tout est enregistré dans `apprentissage.json`, avec un résumé lisible dans **`RAPPORT.md`**.

- **Score d'un post** : likes + 2× commentaires + 3× enregistrements + 4× partages + 10× abonnements gagnés, rapporté à la portée et comparé aux autres posts du même format. Bonus pour la portée (nouveaux publics) et pour les reels regardés jusqu'au bout (rétention).
- **Choix des soirées** : qualité des infos (affiche, style, prix), popularité, soirées en vente sur les deux billetteries… plus ce que le public a aimé : les styles, lieux, villes, gammes de prix et horaires qui ont fait réagir remontent. Deux soirées maximum par lieu dans un même post, pour garder de la variété.
- **Textes et horaires** : accroches des reels, intros, questions, appels à s'abonner, sujets de débat et heure de publication (entre 16h et 20h). Le bot privilégie ce qui marche, tout en continuant à tester les autres options pour ne pas tourner en rond (échantillonnage de Thompson).

Il faut environ 4 à 6 semaines de publications pour que l'apprentissage commence à peser vraiment.

## Direction artistique (reprise de @teufy_official)

- **Couverture** : photo de soirée plein cadre, passée en noir et blanc puis teintée de la couleur de la saison. Par-dessus, grand titre blanc en capitales très larges (« NOS ÉVÉNEMENTS COUPS DE CŒUR DE LA SEMAINE », « LES ÉVÉNEMENTS TECHNO »…) et sous-titre corail (« DU 7 AU 13 DÉCEMBRE », « EN DÉCEMBRE »).
- **Une diapo par soirée, en 3 bandeaux** : en haut, photo + **date · logo TF · ville** ; au milieu, **l'affiche Shotgun/DICE** en entier ; en bas, photo + **styles musicaux** (« Afro House, Indie, Progressive ») + nom · lieu · heure · prix.
- **Dernière diapo, débats et bons plans** : photo, logo TF en haut, pastille corail **#TeufyParty** / **#TeufyDébat** / **#BonPlan**, texte en gras.
- **Logo** : `assets/logo.png` (le TF blanc détouré du logo officiel), avec l'ombre corail.
- **Police** : Archivo très large (`assets/fonts/`), proche des titres Teufy.
- **Teinte des photos selon la saison** : rouge l'hiver (comme les posts de décembre), rose au printemps, corail l'été, violet l'automne. La techno passe en noir et blanc contrasté.
- **Temps forts** : Nouvel An, Halloween, Saint-Valentin et Fête de la musique changent le titre (« LES SOIRÉES DU NOUVEL AN À NE PAS MANQUER ») et les photos.

Tout se règle dans `contenus/da.json`.

### Les photos d'ambiance

Le bot est livré avec **79 photos libres de droits (CC0)** sélectionnées à la main : concerts, foules, DJ, feux d'artifice, fêtes de fin d'année, plages au coucher du soleil (`assets/photos/`, crédits dans `assets/photos/CREDITS.md`). Il choisit selon le contenu et la saison : feux d'artifice et champagne en décembre, plages l'été, clubs sombres et DJ pour la techno. Les photos restent en couleur, avec une légère touche de la couleur de saison. Pour la techno, les bandeaux passent en noir et blanc.

Tu peux ajouter tes propres photos dans ces dossiers. Pinterest n'est pas une banque libre de droits, donc le bot ne s'en sert pas.

## Notes /100, objectif et analyse hebdomadaire

**Chaque post reçoit une note sur 100**, qu'il soit publié par le bot ou à la main par l'équipe (les anciens posts du compte sont importés et notés aussi) :
- 50 = la performance habituelle du compte pour ce format, 100 = deux fois mieux ;
- la note combine likes, commentaires (×2), enregistrements (×3), partages (×4), abonnés gagnés (×10), visites du profil et portée, et pour les reels la part de la vidéo regardée.

**Objectif** : chaque post doit battre la note médiane des 10 derniers posts (+5 points). `RAPPORT.md` montre ✅ ou ❌ pour chaque post récent, compare la moyenne du bot à celle de l'équipe, et liste **ce qui fait monter ou baisser la note** : heure, jour, format, type de post, style musical, lieu, ville, source (Shotgun/DICE), prix, hashtags, forme de la légende, accroche, titre, photos…

**Analyse hebdomadaire par Claude** (si le secret `ANTHROPIC_API_KEY` est défini), une fois par semaine :
1. **Veille** : recherche sur le web des nouveautés Instagram et Meta des 14 derniers jours (sources officielles en priorité : about.instagram.com, creators.instagram.com, about.fb.com, changelog développeurs Meta, Adam Mosseri).
2. **Pourquoi** : explication des meilleurs et moins bons posts, chiffres à l'appui, avec une action pour chaque constat.
3. **Tests** : nouvelles accroches de reels, intros de légende, sujets de débat et hashtags à essayer, ajoutés automatiquement au bot. L'apprentissage les garde s'ils font mieux. Les options testées au moins 4 fois et nettement sous la moyenne sont retirées.
4. **Règles** : hashtags max, durée des reels et durée de l'accroche ne sont changés que si une **source officielle** Instagram ou Meta le confirme.

Garde-fous : rien n'est publié sans passer par le code. Pas de tiret « — », pas de « lien en bio », pas d'invitation à télécharger l'app, longueurs limitées, hashtags valides. Tout est journalisé dans `ANALYSE.md` (repris en haut de `RAPPORT.md`) et dans `veille/AAAA-MM-JJ.md`.

Coût : deux appels à Claude par semaine (dont une recherche web), soit quelques dizaines de centimes à environ 1 € par semaine selon la quantité de veille.

## Tendances et règles Instagram

Le fichier **`contenus/tendances.json`** regroupe ce que le bot applique, et tu peux le modifier :

- **Règles Instagram 2026** :
  - 5 hashtags maximum par post et par reel (annonce @creators du 18/12/2025) ;
  - ce qui compte le plus : partages en message, enregistrements, reels regardés jusqu'au bout ;
  - pas de repost brut ni de filigrane (contenus non originaux pénalisés, y compris les carrousels depuis avril 2026) ;
  - format 4:5 (1080×1350), le seul accepté de façon sûre par l'API.
- **Hashtags** : toujours #TeufyParty, plus 2 hashtags locaux et 2 du style de soirée. Le bot choisit ceux qui ont le mieux marché sur ton compte, et ceux qui accompagnent les meilleurs posts des autres comptes.
- **Accroches de reels** : courtes, lisibles sans le son, et qui créent une tension dès la 1re seconde (« Ne me dis pas que tu restes chez toi », « 3 soirées. 1 seule nuit. Tu choisis laquelle ? », « Ceux qui savent, savent »…). Le bot garde celles qui retiennent le mieux.
- **Rythme des reels** : accroche de 1,6 s, puis une soirée toutes les 1,8 s, soit environ 12 s au total. La zone de 7 à 30 s est celle qui touche le plus de non-abonnés.
- **Veille des autres comptes** : chaque semaine, le bot analyse les 25 derniers posts publics des comptes listés dans `comptes_a_suivre` (clubs, organisateurs, médias nightlife de la Côte). Il passe par l'API officielle Instagram « Business Discovery », sans scraping. Il en tire les formats qui marchent, les meilleures heures, les hashtags des meilleurs posts et leurs accroches. Tout apparaît dans `RAPPORT.md` (section « Tendances des autres comptes ») et sert au choix des hashtags. Ajoute les comptes que tu veux suivre.
- **Reels d'essai** (Trial Reels) : `reels_essai.actif` à `true` pour tester chaque reel d'abord auprès des non-abonnés. Si l'API refuse, le reel est publié normalement.

Limites de l'API : impossible d'ajouter un son tendance de la bibliothèque Instagram ou de la musique sur un carrousel. Pour surfer sur un son viral, ajoute la musique à la main dans l'app après publication, ou dépose un .mp3 libre de droits dans `assets/musiques/`.

## Pas d'invitation à télécharger l'app

L'app n'est pas encore disponible. Les visuels et légendes poussent à **s'abonner au compte**, à enregistrer, à partager et à commenter. Le test `npm test` vérifie qu'aucune légende ne parle de téléchargement ou de « lien en bio ».

## Contenus écrits à la main

- **Débats** : `contenus/debats.json`, 36 sujets (soirée pyjama Mario Kart en boîte, Just Dance à 2h du matin, Nice ou Cannes, filmer le set, dress code…). Aucun n'est republié avant que la liste soit épuisée.
- **Bons plans** : calculés à partir des prix et des grosses dates. Un vrai bon plan (code promo, entrée offerte…) se met dans `contenus/bons-plans.json` et passe en priorité :
  ```json
  [{ "titre": "Entrée offerte avant minuit", "texte": "Tous les jeudis au Ghost avec le code TEUFY.", "du": "2026-11-01", "au": "2026-11-30" }]
  ```
- **Légendes** : plusieurs versions humaines par format, dans le ton du compte (« Cette semaine, la Côte d'Azur ne dort pas… »), avec peu d'emojis, pas de tiret « — » et 7 hashtags qui tournent, dont #TeufyParty.

## Mise en route (une seule fois, ~20 min)

1. **Compte Instagram Professionnel** (Créateur ou Entreprise) relié à une Page Facebook.
2. **Jeton Meta qui n'expire pas** :
   - Sur <https://developers.facebook.com/apps>, crée une app **Business** et ajoute le produit Instagram.
   - Dans Meta Business Suite → Paramètres → Utilisateurs système, crée un utilisateur **Admin** et donne-lui accès à la Page et au compte Instagram.
   - Génère un jeton qui n'expire **jamais**, avec ces autorisations : `instagram_basic`, `instagram_content_publish`, **`instagram_manage_insights`** (indispensable pour l'apprentissage), `pages_show_list`, `pages_read_engagement`, `business_management`.
   - Trouve l'identifiant du compte avec `https://graph.facebook.com/v21.0/me/accounts?fields=name,instagram_business_account&access_token=TON_JETON`. La valeur `instagram_business_account.id` est ton IG_USER_ID.
3. **Secrets GitHub** (Settings → Secrets and variables → Actions) : `IG_ACCESS_TOKEN` et `IG_USER_ID` (sans eux, rien n'est publié), `ANTHROPIC_API_KEY` pour l'analyse hebdomadaire (clé sur <https://console.anthropic.com>), et `PEXELS_API_KEY` en option.
4. **GitHub Pages** : Settings → Pages → Source « Deploy from a branch », branche `main`, dossier `/ (root)`. Instagram a besoin d'une adresse publique pour récupérer les images et vidéos : elles sont servies depuis `https://junior63122.github.io/teufy-instagram/media/…`.
5. **Actions** : Settings → Actions → General → « Workflow permissions » sur **Read and write**, pour que le bot puisse enregistrer médias, historique et statistiques.
6. **Aperçu** : Actions → « Teufy - Instagram automatique » → Run workflow → **mois**. Les 9 publications sont générées avec les vraies soirées, sans rien publier. Tout est dans l'artefact `teufy-…`.

Avec « Instagram API with Instagram Login » (sans Page Facebook), ajoute la variable de dépôt `IG_API_HOST` = `graph.instagram.com`.

## Musique des reels

L'API Instagram ne permet pas d'utiliser les sons tendance. Dépose des `.mp3` libres de droits dans `assets/musiques/techno/` et `assets/musiques/club/` (ou `assets/musiques/` pour tous).

## En local

```sh
cd teufy-instagram
npm install && npx playwright install chromium   # ffmpeg doit être installé
node src/run.mjs mois                            # aperçu des 9 publications du mois
node src/run.mjs reel:techno --dry-run           # un seul contenu
node src/run.mjs collecter                       # statistiques (avec IG_ACCESS_TOKEN et IG_USER_ID)
npm test
```

## Si quelque chose casse

- **« Pas assez de soirées trouvées »** : rien n'est publié et GitHub envoie un e-mail. Les pages récupérées sont dans l'artefact (`out/debug/`).
- **Erreur Instagram** : le message de l'API est dans le journal du workflow (jeton ou autorisation manquante, le plus souvent).
- **Pas de double publication** : `historique.json` garde tout ce qui a été publié.
