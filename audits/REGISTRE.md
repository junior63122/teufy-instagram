# Registre maître du projet Teufy

> Tenu par la veille hebdomadaire (`outils/PROMPT-VEILLE-HEBDO.md`). Jamais de valeur de secret ici : seulement leur nom
> et leur emplacement. « Vérifié le » = date du dernier contrôle réel ; « non vérifié » si le contrôle n'a pas pu être fait.
> Créé le 20/11/2026.

## 1. Site teufyparty.com

| Élément | Emplacement | Rôle | Vérifié le | État |
|---|---|---|---|---|
| Générateur du site | `src/site.mjs`, `src/site-contenus.mjs`, `src/site-langues.mjs` | pages statiques en 6 langues (fr, en, it, es, zh, ar) | 20/11/2026 | SUCCESS_VERIFIED (construction locale : 3 228 pages) |
| Pages publiques | racine du dépôt (environ 3 240 `index.html`) : accueil, `ce-soir/`, `soiree/<id>/`, `soirees-<ville\|style>/`, `clubs-bars/<lieu>/`, `actus/`, `festivals/`, `manger-tard/`, `after/`, `dates/`, `restaurants/`, `activites/`, `artistes/`, `avantages/`, `bien-sortir/`, `mises-a-jour/`, `partenaires/`, `ambassadeurs/`, `bde/`, `faq/`, `a-propos/`, `occitanie/`, `france/`, pages légales | agenda et guide | 20/11/2026 | voir rapport du jour |
| Page cachée | `tiktok/` (chiffrée, code `TIKTOK_CODE`) | planning TikTok du directeur | 20/11/2026 | SUCCESS_VERIFIED (code exigé) |
| Page d'erreur | `404.html` | page introuvable | 20/11/2026 | SUCCESS_VERIFIED (21 clients simulés égarés retrouvent l'accueil) |
| Script et styles | `site/app.js` → `app.min.js`, `site/style.css` → `style.min.css` | interactions (filtres, recherche, favoris, partage) | 20/11/2026 | voir rapport |
| Index de recherche | `site/recherche.json` | « autres résultats » | 20/11/2026 | corrigé (introuvable hors du français jusqu'au 20/11) |
| Formulaires | « Propose ton avantage », « Signaler une adresse », contact pro | préparent un message Instagram (ig.me) ou e-mail : **aucun serveur, aucune donnée stockée par Teufy** | 20/11/2026 | UNKNOWN pour la réception réelle (ouvre l'application du visiteur, non testable sans envoi réel) |
| Hébergement | GitHub Pages (workflow `teufy-pages.yml`), domaine `CNAME` = teufyparty.com | mise en ligne | non vérifié | UNKNOWN (date d'expiration du domaine et du certificat : à relever chez le registrar) |
| Service worker | `sw.js` | cache hors ligne | 20/11/2026 | à surveiller (peut montrer une ancienne version quelques minutes) |

## 2. Robots (GitHub Actions)

| Robot | Fichier | Déclenchement | Rôle | IA | Vérifié le | État |
|---|---|---|---|---|---|---|
| Instagram automatique | `.github/workflows/teufy-instagram.yml` | chaque heure de 15 h à 22 h UTC (déclencheur externe + horaire) | posts, reels, stories, auto-contrôle | Groq (Gemini en pause jusqu'au 01/12) | 20/11/2026 | publications du jour vérifiées en ligne ; les tests en échec bloquent encore la publication (voir rapport) |
| Veille et publication réactive | `teufy-veille.yml` | toutes les 30 min (déclencheur externe), pause 2 h-8 h | actus, reconstruction du site | Groq + Tavily (clé à ajouter) | 20/11/2026 | tourne |
| Lieux (images, carte, transports) | `teufy-site.yml` | 4 h 37, 12 h 37, 16 h 37 UTC | photos, carte, OpenStreetMap | aucune | 20/11/2026 | SUCCESS_VERIFIED (passage complet de 15 h 27, enregistré) |
| Veille technique | `teufy-veille-technique.yml` | 5 h 17 UTC | versions, modèles, billetteries, infos manquantes | aucune (liste des modèles seulement) | créé le 20/11/2026 | PENDING_VERIFICATION (premier passage le 21/11) |
| Mise en ligne | `teufy-pages.yml` | après les robots | GitHub Pages | aucune | non vérifié | UNKNOWN |
| Contrôle qualité du site | `teufy-qualite.yml` | à la main / à chaque modification | Playwright 3 navigateurs | aucune | non vérifié cette semaine | UNKNOWN |
| Prospection | `teufy-prospection.yml` | 8 h 20 UTC du lundi au vendredi | partenaires | Groq | non vérifié | UNKNOWN |
| Paiements | `teufy-paiements.yml` | toutes les heures | suivi des paiements | Groq | non vérifié | UNKNOWN |
| Studio, test IA | `teufy-studio.yml`, `teufy-test-ia.yml` | à la main | décors, essais | selon exception | — | — |

## 3. Tâches programmées de Claude

Contrôle quotidien des publications (19 h 52), veille quotidienne (7 h 47), chiffres et concurrents (mardi et vendredi
11 h 13), veille hebdomadaire et audit en alternance (lundi 10 h 41), tirage du concours Frigo 16 (25/11 à 18 h 05).

## 4. Connecteurs et API tiers

| Service | Usage | Secret (nom seulement) | Limites connues | État |
|---|---|---|---|---|
| Meta Graph API (Instagram) | publication, lecture, Business Discovery | `IG_ACCESS_TOKEN`, `IG_USER_ID` (et alias) | 200 appels / heure ; version utilisée v21.0 | jeton : date d'expiration **non relevée** (UNKNOWN) |
| Groq | IA gratuite (textes, JSON) | `GROQ_API_KEY` | limites par minute ; pas de modèle de lecture d'image sur le compte | actif |
| Tavily | recherche web gratuite | `TAVILY_API_KEY` | 1 000 recherches / mois | **clé pas encore ajoutée** (BLOCKED) |
| Google Gemini | IA (en pause) | `GEMINI_API_KEY` | pause jusqu'au 01/12/2026 | BLOCKED volontaire |
| Anthropic (Claude) | IA payante (désactivée pour les tâches fréquentes) | `ANTHROPIC_API_KEY` | budget en euros | — |
| ElevenLabs | voix des vidéos | `ELEVENLABS_API_KEY` (et alias) | abonnement Riviera | non vérifié |
| Brevo | e-mails de prospection | `BREVO_API_KEY` | — | non vérifié |
| Stripe | paiements | `STRIPE_*` | — | non vérifié |
| Pexels, Pixabay | photos de secours | `PEXELS_API_KEY`, `PIXABAY_API_KEY` | — | secrets vides dans les journaux |
| OpenStreetMap, Overpass, Nominatim, Geofabrik | carte, horaires, lieux | aucun | Geofabrik injoignable une fois le 20/11 | réessai ajouté |
| Billetteries | Eventbrite, DICE, Allevents, Xceed, Shotgun, Bizouk | aucun | anti-robots (Shotgun 429) | relevé quotidien par la veille technique |

## 5. Domaine, comptes, sauvegardes

- Domaine teufyparty.com, DNS, certificat : géré hors du dépôt — dates d'expiration **à fournir par le directeur** (UNKNOWN).
- Comptes critiques (GitHub, Meta, registrar, e-mail) et double authentification : **non vérifiable d'ici** (UNKNOWN).
- Sauvegarde : le dépôt GitHub contient le code, les données et les médias (historique complet) ; aucune autre sauvegarde
  connue ; test de restauration : jamais fait (à faire une fois par mois, par un clone neuf et une reconstruction du site).
- Surveillance : auto-contrôle horaire des publications, contrôle quotidien et veille quotidienne par Claude, veille technique.
