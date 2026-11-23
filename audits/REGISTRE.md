# Registre maître du projet Teufy

> Tenu par la veille hebdomadaire (`outils/PROMPT-VEILLE-HEBDO.md`). Jamais de valeur de secret ici : seulement leur nom
> et leur emplacement. « Vérifié le » = date du dernier contrôle réel ; « non vérifié » si le contrôle n'a pas pu être fait.
> Créé le 20/11/2026. Mis à jour le 23/11/2026 (veille hebdomadaire S48).

## 1. Site teufyparty.com

| Élément | Emplacement | Rôle | Vérifié le | État |
|---|---|---|---|---|
| Générateur du site | `src/site.mjs`, `src/site-contenus.mjs`, `src/site-langues.mjs` | pages statiques en 6 langues (fr, en, it, es, zh, ar) | 23/11/2026 | SUCCESS_VERIFIED (construction locale : 3 024 pages, 108 soirées) |
| Pages publiques | racine du dépôt (environ 3 240 `index.html`) : accueil, `ce-soir/`, `soiree/<id>/`, `soirees-<ville\|style>/`, `clubs-bars/<lieu>/`, `actus/`, `festivals/`, `manger-tard/`, `after/`, `dates/`, `restaurants/`, `activites/`, `artistes/`, `avantages/`, `bien-sortir/`, `mises-a-jour/`, `partenaires/`, `ambassadeurs/`, `bde/`, `faq/`, `a-propos/`, `occitanie/`, `france/`, pages légales | agenda et guide | 23/11/2026 | SUCCESS_VERIFIED (0 lien cassé sur 610 164, tester-site 4 écrans) |
| Page cachée | `tiktok/` (chiffrée, code `TIKTOK_CODE`) | planning TikTok du directeur | 23/11/2026 | SUCCESS_VERIFIED (code exigé, noindex) |
| Tableau de bord (nouveau 21/11) | `pilotage/` (`src/pilotage.mjs`, chiffré, même code) | robots, plannings Instagram et TikTok, chiffres, alertes | 23/11/2026 | SUCCESS_VERIFIED (noindex, contenu chiffré, aucune faille tester-securite) |
| Mesure des visites (nouveau 22/11) | `site/app.js` → GoatCounter (sans cookie) | pages vues, provenance, clics Billets | 23/11/2026 | PARTIAL_SUCCESS (pixel en place ; relevé des chiffres bloqué : secret `GOATCOUNTER_TOKEN` absent) |
| Page d'erreur | `404.html` | page introuvable | 20/11/2026 | SUCCESS_VERIFIED (21 clients simulés égarés retrouvent l'accueil) |
| Script et styles | `site/app.js` → `app.min.js`, `site/style.css` → `style.min.css` | interactions (filtres, recherche, favoris, partage) | 20/11/2026 | voir rapport |
| Index de recherche | `site/recherche.json` | « autres résultats » | 20/11/2026 | corrigé (introuvable hors du français jusqu'au 20/11) |
| Formulaires | « Propose ton avantage », « Signaler une adresse », contact pro | préparent un message Instagram (ig.me) ou e-mail : **aucun serveur, aucune donnée stockée par Teufy** | 20/11/2026 | UNKNOWN pour la réception réelle (ouvre l'application du visiteur, non testable sans envoi réel) |
| Hébergement | GitHub Pages (workflow `teufy-pages.yml`), domaine `CNAME` = teufyparty.com | mise en ligne | non vérifié | UNKNOWN (date d'expiration du domaine et du certificat : à relever chez le registrar) |
| Service worker | `sw.js` | cache hors ligne | 20/11/2026 | à surveiller (peut montrer une ancienne version quelques minutes) |

## 2. Robots (GitHub Actions)

| Robot | Fichier | Déclenchement | Rôle | IA | Vérifié le | État |
|---|---|---|---|---|---|---|
| Instagram automatique | `.github/workflows/teufy-instagram.yml` | chaque heure de 15 h à 22 h UTC (déclencheur externe + horaire) | posts, reels, stories, auto-contrôle | Groq (Gemini en pause jusqu'au 01/12) | 23/11/2026 | 9 à 10 passages par jour du 16 au 22/11 ; 12 passages en échec du 16 au 21/11, 0 le 22/11 ; un test en échec ne bloque plus la publication (21/11) ; **planning sans post le dimanche corrigé le 23/11** |
| Veille et publication réactive | `teufy-veille.yml` | toutes les 30 min (déclencheur externe), pause 2 h-8 h | actus, reconstruction du site, API billetteries | Groq + Tavily | 23/11/2026 | SUCCESS_VERIFIED (24 passages réussis sur 25 en 20 h, 1 en cours) |
| Lieux (images, carte, transports) | `teufy-site.yml` | 4 h 37, 12 h 37, 16 h 37 UTC | photos, carte, OpenStreetMap | aucune | 20/11/2026 | SUCCESS_VERIFIED (passage complet de 15 h 27, enregistré) |
| Veille technique | `teufy-veille-technique.yml` | 5 h 17 UTC | versions, modèles, billetteries, infos manquantes | aucune (liste des modèles seulement) | 23/11/2026 | SUCCESS_VERIFIED le 23/11 à 8 h 41 (relancé par la veille) après un échec à 7 h 11 (fichier absent, corrigé) ; Drive, agendas, visites, sauvegarde du jour |
| Mise en ligne | `teufy-pages.yml` | après les robots | GitHub Pages | aucune | 23/11/2026 | SUCCESS_VERIFIED (58 mises en ligne réussies sur 58 en 20 h) |
| Contrôle qualité du site | `teufy-qualite.yml` | à la main / à chaque modification | Playwright 3 navigateurs | aucune | non vérifié cette semaine | UNKNOWN |
| Prospection | `teufy-prospection.yml` | 8 h 20 UTC du lundi au vendredi | partenaires | Groq | non vérifié | UNKNOWN |
| Paiements | `teufy-paiements.yml` | toutes les heures | suivi des paiements | Groq | 23/11/2026 | SUCCESS_VERIFIED (3 passages réussis sur 3 en 20 h) |
| Studio, test IA | `teufy-studio.yml`, `teufy-test-ia.yml` | à la main | décors, essais | selon exception | — | — |

## 3. Tâches programmées de Claude

Contrôle quotidien des publications (19 h 52), veille quotidienne (7 h 47), chiffres et concurrents (mardi et vendredi
11 h 13), veille hebdomadaire et audit en alternance (lundi 10 h 41), tirage du concours Frigo 16 (25/11 à 18 h 05).

## 4. Connecteurs et API tiers

| Service | Usage | Secret (nom seulement) | Limites connues | État |
|---|---|---|---|---|
| Meta Graph API (Instagram) | publication, lecture, Business Discovery | `IG_ACCESS_TOKEN`, `IG_USER_ID` (et alias) | 200 appels / heure ; version utilisée v21.0 (retirée le 21/01/2027, Meta en v27.0) | jeton : date d'expiration **non relevée** (UNKNOWN) ; migration de version prévue le 24/11 |
| Groq | IA gratuite (textes, JSON, lecture d'affiches) | `GROQ_API_KEY` | limites par minute (429 fréquents) ; Llama 4 retirés, lecture d'images par `qwen/qwen3.8-27b` (branché le 23/11) ; plus de recherche web (remplacée par Tavily) | actif |
| Tavily | recherche web gratuite | `TAVILY_API_KEY` | 1 000 recherches / mois, plafond Teufy 30 / jour | SUCCESS_VERIFIED (30 recherches le 23/11, 67 ce mois) |
| Eventbrite (API officielle, 22/11) | soirées des organisateurs | `EVENTBRITE_TOKEN` | jeton privé | SUCCESS_VERIFIED (28 soirées le 23/11) |
| Ticketmaster Discovery (22/11) | concerts et soirées | `TICKETMASTER_KEY` | 5 000 appels / jour | BLOCKED (secret à ajouter par le directeur) |
| DATAtourisme (data.gouv, 22/11) | agendas des offices de tourisme | aucun | export quotidien compressé | PARTIAL_SUCCESS (69 771 événements lus, 0 gardé ; lecture des dates corrigée le 23/11, à revérifier le 24/11) |
| OpenAgenda (22/11) | agendas officiels des villes | `OPENAGENDA_KEY` | clé gratuite | BLOCKED (secret à ajouter) |
| GoatCounter (22/11) | visites du site, sans cookie | `GOATCOUNTER_TOKEN` (lecture des chiffres) | gratuit | PARTIAL_SUCCESS (mesure en place, lecture bloquée sans secret) |
| Google Drive (dossiers publics du directeur, 22/11) | vidéos de soirée et musiques des montages TikTok | aucun | dossiers publics | SUCCESS_VERIFIED (40 vidéos analysées le 23/11) ; sauvegarde privée des vidéos : espace à choisir par le directeur |
| Google Gemini | IA (en pause) | `GEMINI_API_KEY` | pause jusqu'au 01/12/2026 | BLOCKED volontaire |
| Anthropic (Claude) | IA payante (désactivée pour les tâches fréquentes) | `ANTHROPIC_API_KEY` | budget en euros | — |
| ElevenLabs | voix des vidéos | `ELEVENLABS_API_KEY` (et alias) | abonnement Riviera | non vérifié |
| Brevo | e-mails de prospection | `BREVO_API_KEY` | — | non vérifié |
| Stripe | paiements | `STRIPE_*` | — | non vérifié |
| Pexels, Pixabay | photos de secours | `PEXELS_API_KEY`, `PIXABAY_API_KEY` | — | secrets vides dans les journaux |
| OpenStreetMap, Overpass, Nominatim, Geofabrik | carte, horaires, lieux | aucun | Geofabrik injoignable une fois le 20/11 | réessai ajouté |
| Billetteries | Eventbrite, DICE, Allevents, Xceed, Shotgun, Bizouk | aucun | anti-robots (Shotgun 429) | relevé quotidien par la veille technique |

## 5. Domaine, comptes, sauvegardes

- Domaine teufyparty.com, DNS, certificat : géré hors du dépôt — dates d'expiration **à fournir par le directeur** (UNKNOWN ; le certificat n'est pas lisible depuis l'environnement de la veille le 23/11).
- Comptes critiques (GitHub, Meta, registrar, e-mail) et double authentification : **non vérifiable d'ici** (UNKNOWN).
- Sauvegarde : historique Git complet + sauvegarde quotidienne `sauvegarde-AAAA-MM-JJ` (gardée 90 jours, créée par le robot
  « Veille technique ») ; remise en ligne d'une sauvegarde : `outils/RESTAURER.md` (workflow « Mise en ligne du site », champ
  « sauvegarde », ou gel par `contenus/gel-site.txt`). Test de restauration : à faire une fois par mois (veille hebdomadaire). Au 23/11 : tags `sauvegarde-2026-11-22` et `sauvegarde-2026-11-23` présents ; aucun test de restauration réel fait (à faire avant le 20/12).
- Surveillance : auto-contrôle horaire des publications, contrôle quotidien et veille quotidienne par Claude, veille technique.
