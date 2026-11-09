// Contenus éditoriaux du site (en français). Les autres langues sont traduites par l'IA au moment de générer le site
// (cache contenus/traductions.json) : on n'écrit qu'une fois, on corrige ici.
// Règle : rien d'inventé. Pas de chiffre, de prix ou de promesse qu'on ne peut pas tenir.

// --- Styles musicaux : filtres de l'agenda + pages « Soirées techno / shatta / … » (référencement) -------------
export const STYLES = [
  { cle: 'techno', re: /techno|hard ?(groove|techno|core)|acid|trance|rave|indus|minimal|tekno|schranz/i, nom: 'Techno',
    intro: "Hard groove, acid, minimal ou techno industrielle : toutes les soirées techno de Nice, Cannes, Monaco et de la Côte d'Azur, des caves du Vieux-Nice aux open airs, vérifiées chaque jour." },
  { cle: 'house', re: /house|disco|deep|garage|french touch|electro|nu.?disco|balearic/i, nom: 'House',
    intro: "Deep house, tech house, disco et french touch : les soirées house de la Côte d'Azur, rooftops, beach clubs et clubs, avec horaires, prix et billetterie." },
  { cle: 'afro', re: /afro|amapiano|afrobeat|afro.?house|ndombolo|coup[ée].?d[ée]cal[ée]/i, nom: 'Afro',
    intro: "Afrobeats, amapiano, afro house : toutes les soirées afro de Nice, Cannes, Antibes et Monaco, mises à jour chaque jour." },
  { cle: 'shatta', re: /shatta|dancehall|bouyon|kompa|kompas|zouk|soca|kizomba|konpa|antillais|carib/i, nom: 'Shatta · Dancehall',
    intro: "Shatta, dancehall, bouyon, kompa et zouk : les soirées caribéennes et shatta de la Côte d'Azur, avec horaires, prix et billetterie." },
  { cle: 'latino', re: /reggaeton|latin|latino|salsa|bachata|perreo|cumbia|baile|dembow/i, nom: 'Latino · Reggaeton',
    intro: "Reggaeton, perreo, salsa et bachata : toutes les soirées latino de Nice, Cannes, Antibes et Monaco, vérifiées chaque jour." },
  { cle: 'rap', re: /\brap\b|hip.?hop|\brnb\b|r&b|r'n'b|trap|drill|urban|urbain/i, nom: 'Rap · RnB',
    intro: "Rap, hip-hop, RnB, trap et drill : les soirées urbaines de la Côte d'Azur et les concerts rap de Nice à Monaco." },
  { cle: 'commercial', re: /commercial|ann[ée]es ?(80|90|2000)|\b(80|90|2000)s?\b|pop|g[ée]n[ée]raliste|open format|hits|tubes|disco ?fever/i, nom: 'Commercial',
    intro: "Hits, années 2000, généraliste et open format : les soirées commerciales de la Côte d'Azur." },
  { cle: 'live', re: /concert|live|jazz|rock|band|groupe|acoustique|showcase/i, nom: 'Concerts · Live',
    intro: "Concerts, showcases et lives : la musique en vrai sur la Côte d'Azur." },
];
export const PAGES_STYLES = ['techno', 'house', 'afro', 'shatta', 'latino', 'rap'];

// --- Festivals : guide (sans dates inventées : « généralement ») ----------------------------------------------
export const FESTIVALS = [
  { nom: 'Nice Jazz Festival', ville: 'Nice', quand: 'Généralement en juillet', style: 'Jazz, soul, rap, électro', texte: "Le grand festival de l'été à Nice, dans les jardins au bord de la Promenade. Malgré son nom, la programmation va bien au-delà du jazz : soul, funk, rap, pop et électro." },
  { nom: 'Jazz à Juan', ville: 'Juan-les-Pins', quand: 'Généralement en juillet', style: 'Jazz, soul, blues', texte: "L'un des plus vieux festivals de jazz d'Europe, sous les pins face à la mer. Ambiance plus posée, cadre unique, et des soirées qui continuent dans les bars de Juan." },
  { nom: 'Les Nuits du Sud', ville: 'Vence', quand: "Généralement de juillet à début août", style: 'Musiques du monde, latino, afro, reggae', texte: "Le festival des musiques du monde sur la place du Grand Jardin à Vence : on y danse sur du latino, de l'afro, du reggae et de la cumbia." },
  { nom: 'Monte-Carlo Sporting Summer Festival', ville: 'Monaco', quand: "Généralement de juillet à août", style: 'Têtes d\'affiche internationales', texte: "La série de concerts de l'été à la Salle des Étoiles du Sporting Monte-Carlo, avec de très grosses têtes d'affiche internationales. Plus chic, plus cher." },
  { nom: 'Les Plages Électroniques', ville: 'Cannes', quand: "Généralement en été", style: 'Électro, house, techno', texte: "Le rendez-vous électro de l'été à Cannes, sur la plage, les pieds dans le sable, avec des DJ internationaux." },
  { nom: 'Les Nuits Carrées', ville: 'Antibes', quand: "Généralement en début d'été", style: 'Électro, pop, indé', texte: "Un festival à taille humaine au pied du Fort Carré d'Antibes, entre électro, pop et découvertes." },
  { nom: 'Fête de la musique', ville: 'Partout', quand: 'Le 21 juin', style: 'Tous les styles', texte: "Gratuit, partout, toute la nuit : scènes dans les rues de Nice, Cannes, Antibes et Monaco, et soirées spéciales dans les clubs." },
];
export const RENDEZ_VOUS = [
  { nom: 'Carnaval de Nice', quand: 'Généralement en février', texte: "Défilés, batailles de fleurs et soirées : deux semaines de fête dans les rues de Nice." },
  { nom: 'Fête du Citron', ville: 'Menton', quand: 'Généralement en février', texte: "Le grand rendez-vous de Menton, avec ses sculptures géantes d'agrumes et ses corsos." },
  { nom: 'Festival de Cannes', quand: 'Généralement en mai', texte: "Douze jours où Cannes ne dort plus : plages privées, soirées de films et clubs pleins. Beaucoup de soirées sont privées, l'agenda Teufy montre celles qui sont ouvertes." },
  { nom: 'Grand Prix de Monaco', quand: 'Généralement fin mai ou début juin', texte: "Le week-end le plus fou de Monaco : soirées sur le port, sur les yachts et dans les clubs de Monte-Carlo." },
  { nom: '14 juillet', quand: 'Le 14 juillet', texte: "Feux d'artifice sur toute la Côte (Nice, Cannes, Antibes, Monaco) et soirées en plein air." },
];

// --- Pages « pros » ----------------------------------------------------------------------------------------
export const PARTENAIRE = {
  titre: 'Devenir partenaire Teufy · Clubs, organisateurs, BDE, marques',
  desc: "Clubs, bars, beach clubs, organisateurs, festivals, artistes : rejoins les partenaires de Teufy, le guide des soirées de la Côte d'Azur. Agenda vérifié, posts en collaboration, stories et reels.",
  etiquette: 'Partenaires', h1: 'Remplis ta soirée avec <em>Teufy</em>',
  chapo: "Teufy, c'est l'agenda des soirées de la Côte d'Azur et le média Instagram des 17-30 ans qui sortent. On met ta soirée devant les gens qui cherchent où sortir ce soir.",
  pourquoiH2: 'Pourquoi <em>Teufy</em>',
  pourquoi: [
    ["Un public qui sort vraiment", "Les 17-30 ans de Nice, Cannes, Antibes et Monaco qui cherchent leur prochaine soirée, au moment où ils la cherchent."],
    ['Un agenda vérifié chaque jour', "Chaque soirée est vérifiée sur sa page officielle : date, heure, lieu, prix et lien de billetterie. Ce sérieux fait revenir les gens."],
    ['Six langues, Google compris', "Le site est traduit en anglais, italien, espagnol, chinois et arabe, et chaque soirée a sa page optimisée pour Google : les touristes et les étudiants étrangers te trouvent aussi."],
    ['Le lien direct vers ta billetterie', "Pas d'intermédiaire, pas de commission : le bouton « Billets » envoie directement sur ta page Shotgun, DICE, Weezevent ou ton site."],
  ],
  offreH2: 'Ce que Teufy fait pour <em>toi</em>',
  offre: [
    ["Ta soirée dans l'agenda", "Gratuit. Elle apparaît sur le site (dans 6 langues), sur la carte, dans la page de ta ville et de ton style, avec ton affiche officielle."],
    ['Le carrousel du lundi', "Chaque lundi, Teufy publie la sélection des meilleures soirées de la semaine. Les plus attendues sont publiées en collaboration avec l'organisateur."],
    ['Posts en collaboration et stories', "Ta soirée relayée sur le compte Teufy, ton compte identifié sur ton affiche pour que l'audience arrive chez toi."],
    ['Reels et contenus sur mesure', "Annonce de line-up, ouverture de billetterie, aftermovie, présentation de ton lieu : on en parle ensemble."],
    ["Annonces urgentes", "Line-up dévoilé, date ajoutée, billetterie qui ouvre : la veille Teufy repère les grosses annonces et peut les publier dans l'heure."],
  ],
  pourQuiH2: 'Pour <em>qui</em> ?',
  pourQui: ['Clubs et discothèques', 'Bars et rooftops', 'Beach clubs et plages privées', 'Organisateurs et collectifs', 'Festivals', 'DJ et artistes', 'BDE et associations', 'Marques et lieux'],
  etapesH2: 'Comment ça <em>marche</em>',
  etapes: [
    ['Écris-nous sur Instagram', 'Présente ton lieu ou ton projet, ton compte Instagram et tes prochaines dates.'],
    ['On en parle', "On te propose ce qui colle à ta soirée : agenda, carrousel, collaboration, reel."],
    ['Ta soirée est en ligne', "Elle apparaît sur le site et sur Instagram. Envoie-nous tes nouvelles dates au fil de l'eau."],
  ],
  faq: [
    ["Est-ce que c'est payant ?", "L'ajout de ta soirée dans l'agenda est gratuit. Pour les contenus dédiés (reel, post sponsorisé, campagne), on te fait une proposition adaptée."],
    ['Comment ajouter ma soirée ?', "Envoie l'affiche, la date, l'heure, le lieu et le lien de billetterie en message à @teufy_official. On vérifie et on l'ajoute."],
    ['Ma soirée est déjà sur Shotgun ou DICE, est-ce utile ?', "Oui : Teufy la montre à des gens qui ne te suivent pas encore, sur Instagram, sur Google et dans six langues, et renvoie directement vers ta billetterie."],
    ['Une information est fausse ou mon affiche a changé', "Écris-nous : on corrige dans la journée."],
  ],
  cta: 'Devenir partenaire',
};

export const AMBASSADEUR = {
  titre: 'Programme ambassadeur Teufy · Représente la nuit de ta ville',
  desc: "Deviens ambassadeur Teufy à Nice, Cannes, Antibes, Monaco ou dans ton école : repère les soirées, crée du contenu et fais partie de l'équipe du guide des soirées de la Côte d'Azur.",
  etiquette: 'Ambassadeurs', h1: 'Deviens <em>ambassadeur</em> Teufy',
  chapo: "Tu connais toutes les soirées avant tout le monde ? Tu es la personne à qui tes potes demandent « on sort où ce soir ? » Représente Teufy dans ta ville ou ton école.",
  roleH2: 'Le <em>rôle</em>',
  role: [
    ['Repérer', "Tu nous signales les soirées, les nouveaux lieux et les annonces de ta ville ou de ton école avant tout le monde."],
    ['Partager', "Tu relaies les sélections Teufy dans tes groupes, ta promo, ton association."],
    ['Créer', "Si tu aimes ça : photos, vidéos et stories en soirée pour le compte Teufy, avec l'accord des organisateurs."],
    ['Connecter', "Tu nous mets en relation avec les BDE, organisateurs et artistes que tu connais."],
  ],
  avantagesH2: 'Ce que tu y <em>gagnes</em>',
  avantages: [
    ["Faire partie de l'équipe", "Tu rejoins l'équipe Teufy et tu vois comment fonctionne un média de l'événementiel de l'intérieur."],
    ['Une vraie expérience à valoriser', "Repérage, réseaux sociaux, relation avec les organisateurs : de quoi enrichir ton CV, ton portfolio ou ton stage."],
    ['Le réseau', "Tu rencontres les organisateurs, les clubs, les DJ et les 200+ partenaires de Teufy."],
    ['Des avantages en soirée', "Quand nos partenaires en proposent : invitations, entrées en liste et réductions, réservées aux ambassadeurs."],
  ],
  profilH2: 'Le <em>profil</em>',
  profil: ['Avoir 18 ans ou plus', "Vivre ou étudier sur la Côte d'Azur (Nice, Cannes, Antibes, Monaco, Menton, Sophia…)", 'Sortir régulièrement et aimer partager les bons plans', 'Être actif sur Instagram', 'Être fiable : on ne relaie que des informations vérifiées'],
  candidatureH2: 'Comment <em>postuler</em>',
  candidature: "Envoie-nous un message sur Instagram avec : ton prénom, ton âge, ta ville, ton école ou ton travail, ton compte Instagram et en deux phrases pourquoi tu veux représenter Teufy.",
  cta: 'Postuler sur Instagram',
};

export const BDE = {
  titre: 'BDE et associations étudiantes · Partenariat Teufy',
  desc: "BDE, BDS, associations étudiantes de Nice, Sophia Antipolis, Cannes et Monaco : faites connaître vos soirées gratuitement sur Teufy et organisez vos événements avec nos 200+ partenaires.",
  etiquette: 'BDE · Associations', h1: 'Vos soirées étudiantes, <em>en grand</em>',
  chapo: "BDE, BDS, BDA, associations d'Université Côte d'Azur, de Sophia Antipolis, des écoles de Nice, Cannes et Monaco : Teufy vous aide à remplir vos soirées et à les organiser.",
  offreH2: 'Ce que Teufy vous <em>propose</em>',
  offre: [
    ['Vos soirées dans l\'agenda, gratuitement', "Votre soirée apparaît sur le site, sur la carte, dans la page de votre ville et sur Google, avec le lien vers votre billetterie (HelloAsso, Shotgun, Weezevent…)."],
    ['Une mise en avant sur Instagram', "Les soirées étudiantes qui se démarquent entrent dans les sélections Teufy, en collaboration avec votre compte."],
    ['Le bon lieu pour votre soirée', "Teufy travaille avec plus de 200 clubs, bars, beach clubs et salles de la Côte : on vous met en relation avec ceux qui accueillent des soirées étudiantes."],
    ["Des conditions négociées", "Quand c'est possible, on vous aide à obtenir de meilleures conditions auprès de nos partenaires pour vos événements (privatisation, tarifs de groupe)."],
    ['Un ambassadeur dans votre école', "Un membre du bureau peut devenir ambassadeur Teufy et relayer vos événements en priorité."],
  ],
  etapesH2: 'Comment ça <em>marche</em>',
  etapes: [
    ['Écrivez-nous', "Nom de l'association, école, compte Instagram et vos prochaines dates."],
    ['On construit ensemble', "Agenda, mise en avant, recherche de lieu : on voit ce dont vous avez besoin."],
    ['Vos soirées sont en ligne', "Envoyez-nous chaque nouvelle date : on l'ajoute et on la relaie."],
  ],
  soireesH2: 'Les soirées <em>étudiantes</em> à venir',
  cta: 'Écrire à Teufy',
};
export const RE_ETUDIANT = /[ée]tudiant|student|\bbde\b|\bbds\b|erasmus|\besn\b|integ|campus|universit|[ée]cole|skema|edhec|iae|polytech|kedge|ipag|sup de co/i;
export const RE_FESTIVAL = /festival|open ?air|fest\b|plages [ée]lectroniques|nuits (du sud|carr[ée]es)|jazz [àa] juan/i;

export const LEGAL = (T, compte) => ({
  titre: 'Mentions légales · Teufy', h1: 'Mentions <em>légales</em>',
  blocs: [
    ['Éditeur du site', [
      `Le site Teufy est édité par ${T.raison_sociale || 'Teufy'}${T.forme ? `, ${T.forme}` : ''}${T.siret ? `, SIRET ${T.siret}` : ''}${T.adresse ? `, ${T.adresse}` : ''}.`,
      `Directeur de la publication : ${T.directeur}.`,
      `Contact : ${T.email ? `${T.email} ou ` : ''}message privé Instagram ${compte}.`,
    ]],
    ['Hébergement', ['Le site est hébergé par GitHub Pages, service de GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.']],
    ['Informations sur les soirées', [
      "Les informations (dates, horaires, lieux, prix, liens de billetterie) proviennent des pages officielles des soirées et sont vérifiées chaque jour, mais elles peuvent changer à tout moment. Vérifie toujours sur la billetterie de l'organisateur avant de sortir.",
      "Les billets sont vendus par les organisateurs et leurs billetteries, pas par Teufy. Teufy ne perçoit pas de commission sur les billets.",
    ]],
    ['Affiches et marques', [
      "Les affiches, logos et noms des soirées appartiennent à leurs organisateurs et sont montrés uniquement pour présenter leurs événements. Pour faire retirer ou modifier un contenu, écris-nous : on le fait rapidement.",
    ]],
    ['Données personnelles et cookies', [
      "Le site ne demande pas de compte et n'utilise pas de cookies publicitaires ni de mesure d'audience.",
      "Tes soirées favorites sont enregistrées uniquement dans ton navigateur (stockage local) : elles ne nous sont jamais envoyées.",
      "La carte des soirées utilise des fonds de carte OpenStreetMap servis par CARTO : ils ne sont chargés que si tu ouvres la carte.",
    ]],
  ],
});

// Rubriques « sorties » : uniquement des partenaires de Teufy (identifiés automatiquement, voir src/site.mjs).
export const SORTIES = {
  dates: {
    filtre: (p) => p.date && !['club', 'organisateur', 'festival', 'artiste', 'media', 'marque'].includes(p.categorie),
    titre: "Les meilleurs endroits pour un date sur la Côte d'Azur · Teufy", desc: "Restaurants, rooftops, bars à cocktails, plages et activités pour un premier date à Nice, Cannes, Antibes ou Monaco : la sélection des partenaires Teufy.",
    etiquette: 'Pour un date', h1: 'Les meilleurs spots pour un <em>date</em>', p: "Un premier verre, un dîner, une activité pour briser la glace : les adresses des partenaires Teufy qui marchent à tous les coups.", photo: 'rooftop',
  },
  restaurants: {
    filtre: (p) => p.categorie === 'restaurant' || (p.categorie === 'beach-club' && /restaurant|cuisine|d[îi]ner|d[ée]jeuner/i.test(p.description || '')),
    titre: "Restaurants partenaires de Teufy sur la Côte d'Azur · Nice, Cannes, Monaco", desc: "Les restaurants partenaires de Teufy à Nice, Cannes, Antibes et Monaco : où dîner avant de sortir.",
    etiquette: 'Restos', h1: 'Où dîner avant de <em>sortir</em>', p: "Les restaurants partenaires de Teufy : pour dîner avant la soirée, entre potes ou en date.", photo: 'terrasse',
  },
  activites: {
    filtre: (p) => p.categorie === 'activite',
    titre: "Activités sur la Côte d'Azur : idées de sorties avec les partenaires Teufy", desc: "Activités et sorties entre amis ou en date sur la Côte d'Azur, proposées par les partenaires de Teufy.",
    etiquette: 'Activités', h1: 'Des <em>activités</em> pour changer', p: "Quand tu veux faire autre chose que danser : les activités des partenaires Teufy, entre potes ou en date.", photo: 'rire',
  },
  vide: "La sélection arrive : Teufy identifie ses partenaires un par un. Tu es un restaurant, un bar ou une activité de la Côte ? Rejoins les partenaires Teufy.",
  categories: { restaurant: 'Restaurant', bar: 'Bar', rooftop: 'Rooftop', club: 'Club', 'beach-club': 'Plage · Beach club', activite: 'Activité', hotel: 'Hôtel', organisateur: 'Organisateur', festival: 'Festival', artiste: 'Artiste', media: 'Média', marque: 'Marque', autre: 'Partenaire' },
};
