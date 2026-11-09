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

const EDITEUR = (T) => `${T.raison_sociale || 'Teufy'}${T.forme ? `, ${T.forme}` : ''}${T.siren ? `, SIREN ${T.siren}` : T.siret ? `, SIRET ${T.siret}` : ''}${T.adresse ? `, ${T.adresse}` : ''}`;
const MAJ = (T) => `Dernière mise à jour : ${T.maj_legales || '2026'}.`;

export const LEGAL = (T, compte) => ({
  titre: 'Mentions légales · Teufy', h1: 'Mentions <em>légales</em>',
  blocs: [
    ['Éditeur du site', [
      `Le site Teufy est édité par ${EDITEUR(T)}.`,
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
    ['Conditions et données personnelles', [
      "L'utilisation du site est régie par les conditions générales d'utilisation (CGU) ; les billets, codes promo et partenariats par les conditions générales de vente et de partenariat (CGV). La façon dont Teufy traite les données et l'absence de cookies sont expliquées dans la politique de confidentialité.",
    ]],
  ],
});

export const CGU = (T, compte) => ({
  titre: "Conditions générales d'utilisation · Teufy", h1: "Conditions générales d'<em>utilisation</em>",
  blocs: [
    ['1. Objet', [MAJ(T), `Les présentes conditions générales d'utilisation (CGU) encadrent l'accès et l'utilisation du site Teufy, guide des soirées de la Côte d'Azur et du Var, édité par ${EDITEUR(T)}. Utiliser le site vaut acceptation de ces CGU.`]],
    ['2. Accès au site', ["Le site est gratuit, sans inscription et accessible à tous. Les soirées présentées sont destinées à un public majeur : l'accès aux événements est fixé par chaque organisateur (âge minimum, tenue, pièce d'identité).", "Teufy fait le maximum pour que le site soit disponible et à jour, sans pouvoir le garantir en permanence (maintenance, panne de l'hébergeur, mise à jour)."]],
    ['3. Les informations publiées', ["L'agenda, les fiches des lieux, les festivals et les actus sont établis à partir des sources officielles (sites, billetteries et comptes Instagram des organisateurs) et vérifiés chaque jour. Ils peuvent néanmoins changer sans préavis : seule la billetterie ou l'organisateur fait foi.", "Les tendances, compteurs et mentions « Très demandée » reflètent des données mesurées (intérêt, engagement Instagram) et ne sont jamais achetées. Une mise en avant payée est toujours signalée comme partenariat."]],
    ['4. Billets et liens externes', ["Teufy ne vend aucun billet. Les boutons « Billets » mènent vers les billetteries des organisateurs ou leurs revendeurs, dont les conditions de vente s'appliquent. Teufy n'est pas responsable du contenu, des prix ni du fonctionnement des sites tiers (billetteries, Instagram, Google Maps, OpenStreetMap)."]],
    ['5. Propriété intellectuelle', ["La marque Teufy, son logo, ses textes, visuels, bases de données et l'ensemble du site sont protégés. Toute reproduction ou réutilisation sans autorisation écrite est interdite.", "Les affiches, logos et noms des soirées et des établissements restent la propriété de leurs titulaires et ne sont montrés que pour présenter leurs événements."]],
    ['6. Signaler un contenu', [`Conformément à la loi pour la confiance dans l'économie numérique (LCEN), tout contenu inexact, illicite ou portant atteinte à tes droits peut nous être signalé par e-mail (${T.email || 'teufy.app@gmail.com'}) ou en message privé Instagram ${compte}. Il est vérifié et, si besoin, retiré rapidement.`]],
    ['7. Bon comportement et sécurité', ["Teufy promeut une fête responsable : ne sors jamais seul, garde un œil sur ton verre, ne prends pas le volant après avoir bu, respecte le consentement et les autres. L'abus d'alcool est dangereux pour la santé, à consommer avec modération. En cas d'urgence : 112."]],
    ['8. Responsabilité', ["Teufy ne peut être tenu responsable de l'annulation, du report ou du déroulement d'une soirée, ni des dommages indirects liés à l'utilisation du site. La responsabilité de chaque événement incombe à son organisateur."]],
    ['9. Modification des CGU', ["Les CGU peuvent évoluer ; la version applicable est celle publiée sur cette page au moment de ta visite."]],
    ['10. Droit applicable et litiges', ["Les CGU sont soumises au droit français. En cas de litige, une solution amiable est recherchée en priorité ; un consommateur peut aussi recourir gratuitement à un médiateur de la consommation (articles L612-1 et suivants du Code de la consommation), dont les coordonnées sont communiquées sur simple demande. À défaut, les tribunaux du ressort de Nice sont compétents, sauf disposition impérative contraire."]],
  ],
});

export const CGV = (T, compte) => ({
  titre: 'Conditions générales de vente et de partenariat · Teufy', h1: 'Conditions de <em>vente</em> et de partenariat',
  blocs: [
    ['1. Objet', [MAJ(T), `Ces conditions générales de vente et de partenariat (CGV) s'appliquent aux offres présentées sur le site Teufy et aux prestations proposées par ${EDITEUR(T)} aux professionnels (organisateurs, établissements, marques).`]],
    ['2. Billets', ["Teufy ne vend pas de billets et n'encaisse aucun paiement pour une soirée. L'achat se fait directement auprès de l'organisateur ou de sa billetterie (Shotgun, Weezevent, Dice, etc.), selon leurs propres conditions de vente : prix, frais, remboursement, annulation, revente.", "En cas d'annulation, de report ou de litige sur un billet, la demande se fait auprès de l'organisateur ou de la billetterie qui a vendu le billet."]],
    ['3. Comparateur de prix', ["Quand une même soirée est en vente sur plusieurs billetteries, Teufy affiche les prix relevés sur chacune pour t'aider à choisir. Ces prix sont indicatifs et peuvent évoluer : seul le prix affiché sur la billetterie au moment de l'achat compte."]],
    ['4. Codes promo', ["Les codes promo affichés sont offerts par les partenaires de Teufy. Leurs conditions (remise, soirées concernées, date limite, nombre d'utilisations) sont fixées par le partenaire et rappelées à côté du code. Teufy ne peut garantir qu'un code reste disponible ou cumulable."]],
    ['5. Prestations pour les professionnels', ["Mise en avant d'une soirée ou d'un lieu, publication sur Instagram, partenariat, programme ambassadeurs : chaque prestation fait l'objet d'un devis ou d'un accord écrit préalable précisant son contenu, son prix, sa durée et ses conditions de paiement. Rien n'est facturé sans accord écrit.", "Les contenus réalisés dans le cadre d'un partenariat rémunéré sont signalés comme tels (« partenariat », « collaboration commerciale »), conformément à la loi du 9 juin 2023 sur l'influence commerciale.", "Teufy garde sa liberté éditoriale : il peut refuser une soirée ou un contenu contraire à la loi, à la sécurité du public ou à sa ligne. Aucune prestation ne garantit un nombre de vues, de ventes ou d'abonnés."]],
    ['6. Concours', ["Les concours et tirages au sort organisés avec des partenaires font l'objet d'un règlement communiqué avec le concours (conditions de participation, désignation des gagnants, lots)."]],
    ['7. Réclamations et litiges', [`Pour toute réclamation : ${T.email || 'teufy.app@gmail.com'} ou message privé Instagram ${compte}. Les CGV sont soumises au droit français ; à défaut d'accord amiable, et après une éventuelle médiation, les tribunaux du ressort de Nice sont compétents, sauf disposition impérative contraire.`]],
  ],
});

export const CONFIDENTIALITE = (T, compte) => ({
  titre: 'Confidentialité et cookies · Teufy', h1: 'Confidentialité et <em>cookies</em>',
  blocs: [
    ['En bref', [MAJ(T), "Le site Teufy ne demande pas de compte, ne dépose aucun cookie, ne mesure pas ton audience et n'affiche pas de publicité. Tes favoris restent sur ton téléphone ou ton ordinateur."]],
    ['Responsable du traitement', [`${EDITEUR(T)}. Contact : ${T.email || 'teufy.app@gmail.com'}.`]],
    ['Ce qui reste sur ton appareil', ["Favoris : les soirées que tu ajoutes en favori sont enregistrées dans le stockage local de ton navigateur. Elles ne nous sont jamais envoyées ; tu peux les effacer en vidant les données du site.", "Cache : pour que le site s'ouvre plus vite, ton navigateur garde une copie des images, polices et pages déjà vues (service worker). Rien n'est envoyé à Teufy.", "Position : le bouton « Près de moi » demande l'accord de ton navigateur ; la distance est calculée sur ton appareil, ta position n'est jamais transmise ni enregistrée."]],
    ['Ce qui passe par des services tiers', ["Hébergement : le site est hébergé par GitHub Pages (GitHub, Inc.), qui peut enregistrer l'adresse IP des visiteurs dans ses journaux techniques pour la sécurité du service.", "Cartes : quand une carte s'affiche, les fonds de carte sont chargés depuis les serveurs d'OpenStreetMap, qui reçoivent alors ton adresse IP, comme pour toute page web.", "Liens externes : billetteries, Instagram, LinkedIn et Google Maps ne sont contactés que si tu cliques sur un lien ; leurs propres politiques de confidentialité s'appliquent alors."]],
    ['Quand tu nous écris', ["Si tu nous contactes (e-mail ou Instagram), ton message et tes coordonnées servent uniquement à te répondre et à traiter ta demande (partenariat, signalement, ambassadeur). Ils sont conservés au maximum 3 ans après notre dernier échange, puis supprimés. Ils ne sont jamais vendus."]],
    ['Cookies', ["Teufy ne dépose aucun cookie et n'utilise aucun traceur publicitaire ou de mesure d'audience. C'est pour ça qu'aucun bandeau de consentement ne s'affiche : il n'y a rien à accepter. Si un outil soumis à ton accord était un jour ajouté, un bandeau te demanderait ton choix avant tout dépôt, avec la possibilité de refuser aussi facilement que d'accepter."]],
    ['Tes droits', [`Conformément au RGPD et à la loi Informatique et Libertés, tu peux demander l'accès, la rectification, l'effacement, la limitation ou la portabilité de tes données, et t'opposer à leur traitement, en écrivant à ${T.email || 'teufy.app@gmail.com'}. Réponse sous 30 jours au plus.`, "Tu peux aussi adresser une réclamation à la CNIL : www.cnil.fr, ou 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07."]],
  ],
});

export const PAGES_LEGALES = { 'mentions-legales': LEGAL, cgu: CGU, cgv: CGV, confidentialite: CONFIDENTIALITE };

// Rubriques « sorties » : uniquement des partenaires de Teufy (identifiés automatiquement, voir src/site.mjs).
export const SORTIES = {
  dates: {
    filtre: (p) => p.date && ['restaurant', 'bar', 'rooftop', 'beach-club', 'activite'].includes(p.categorie) && !/[ée]cole|school|cours|formation|academy|acad[ée]mie|vtc|s[ée]curit/i.test(`${p.nom} ${p.description || ''}`),
    titre: "Les meilleurs endroits pour un date sur la Côte d'Azur · Teufy", desc: "Mont Boron, colline du Château, Parc Phoenix, musées, îles de Lérins, sentiers du littoral et bonnes adresses : où aller en date à Nice, Cannes, Antibes et Monaco.",
    etiquette: 'Pour un date', h1: 'Les meilleurs spots pour un <em>date</em>', p: "Couchers de soleil, balades au bord de l'eau, jardins, musées, escapades : les endroits de la Côte d'Azur qui marchent à tous les coups, et les bonnes adresses de nos partenaires.", photo: 'rooftop',
  },
  restaurants: {
    filtre: (p) => p.categorie === 'restaurant' || (p.categorie === 'beach-club' && /restaurant|cuisine|d[îi]ner|d[ée]jeuner/i.test(p.description || '')),
    titre: "Restaurants partenaires de Teufy sur la Côte d'Azur · Nice, Cannes, Monaco", desc: "Les restaurants partenaires de Teufy à Nice, Cannes, Antibes et Monaco : où dîner avant de sortir.",
    etiquette: 'Restos', h1: 'Où dîner avant de <em>sortir</em>', p: "Les restaurants partenaires de Teufy : pour dîner avant la soirée, entre potes ou en date.", photo: 'terrasse',
  },
  activites: {
    filtre: (p) => p.categorie === 'activite' && !/vtc|s[ée]curit|photograph/i.test(`${p.nom} ${p.description || ''}`),
    titre: "Activités sur la Côte d'Azur : idées de sorties avec les partenaires Teufy", desc: "Activités et sorties entre amis ou en date sur la Côte d'Azur, proposées par les partenaires de Teufy.",
    etiquette: 'Activités', h1: 'Des <em>activités</em> pour changer', p: "Quand tu veux faire autre chose que danser : les activités des partenaires Teufy, entre potes ou en date.", photo: 'rire',
  },
  vide: "La sélection arrive : Teufy identifie ses partenaires un par un. Tu es un restaurant, un bar ou une activité de la Côte ? Rejoins les partenaires Teufy.",
  categories: { restaurant: 'Restaurant', bar: 'Bar', rooftop: 'Rooftop', club: 'Club', 'beach-club': 'Plage · Beach club', activite: 'Activité', hotel: 'Hôtel', organisateur: 'Organisateur', festival: 'Festival', artiste: 'Artiste', media: 'Média', marque: 'Marque', autre: 'Partenaire' },
};

// Spots pour un date : de vrais lieux (pas que des partenaires), choisis à la main. Pas d'horaires ni de prix : ils changent.
export const SPOTS_DATE = [
  { titre: 'Couchers de soleil et vues', lieux: [
    ['Colline du Château', 'Nice', "La vue sur la Baie des Anges, le port et le Vieux-Nice, à quelques minutes à pied de la Promenade. Parfait au coucher du soleil."],
    ['Mont Boron', 'Nice', "Les sentiers boisés au-dessus du port, les points de vue sur la rade de Villefranche et la mer : calme, vue folle, idéal pour une balade à deux."],
    ['Le Suquet', 'Cannes', "La vieille ville de Cannes, en haut de ses ruelles : vue sur la baie, le port et les îles de Lérins."],
    ['Mont Faron', 'Toulon', "On monte en téléphérique au-dessus de la rade de Toulon : panorama sur la mer et la ville."],
  ] },
  { titre: 'Balades au bord de la mer', lieux: [
    ['Sentier du littoral de Saint-Jean-Cap-Ferrat', 'Saint-Jean-Cap-Ferrat', "Une balade entre pins et criques à l'eau turquoise, avec des coins pour se poser et se baigner."],
    ['Sentier de Tire-Poil, Cap d\'Antibes', 'Antibes', "Le chemin taillé dans la roche face à la mer, au bout du Cap d'Antibes : spectaculaire en fin de journée."],
    ['Promenade des Anglais', 'Nice', "Le grand classique : la promenade au bord de l'eau, une glace, les chaises bleues et le coucher de soleil."],
    ['Rade de Villefranche-sur-Mer', 'Villefranche-sur-Mer', "Une des plus belles rades de la Méditerranée, ses maisons colorées et ses petits restaurants sur le port."],
  ] },
  { titre: 'Parcs et jardins', lieux: [
    ['Parc Phoenix', 'Nice', "Le parc floral de Nice, avec sa grande serre tropicale et ses animaux : une sortie originale et posée."],
    ['Jardin exotique d\'Èze', 'Èze', "Des cactus, la mer à perte de vue et le village perché d'Èze autour : romantique à souhait."],
    ['Jardins de la Villa Ephrussi de Rothschild', 'Saint-Jean-Cap-Ferrat', "Neuf jardins à thème au-dessus de la mer et une villa Belle Époque."],
  ] },
  { titre: 'Musées et culture', lieux: [
    ['MAMAC', 'Nice', "Le Musée d'Art Moderne et d'Art Contemporain de Nice, et sa terrasse sur le toit avec vue sur la ville."],
    ['Musée Matisse', 'Nice', "Dans une villa rouge au milieu des oliviers de Cimiez : l'œuvre de Matisse et un parc parfait pour flâner après."],
    ['Musée Picasso, château Grimaldi', 'Antibes', "Les œuvres de Picasso dans un château au bord de la mer, avec une terrasse sur les remparts."],
    ['Musée océanographique', 'Monaco', "Le musée sur le Rocher, ses aquariums et sa terrasse avec vue sur la mer."],
    ['Fondation Maeght', 'Saint-Paul-de-Vence', "Art moderne dans les pins, puis balade dans le village de Saint-Paul-de-Vence."],
  ] },
  { titre: 'Escapades', lieux: [
    ['Île Sainte-Marguerite, îles de Lérins', 'Cannes', "Quinze minutes de bateau depuis Cannes : pinèdes, criques et pique-nique les pieds dans l'eau."],
    ['Village d\'Èze', 'Èze', "Le village médiéval perché au-dessus de la mer, ses ruelles en pierre et ses terrasses."],
    ['Saint-Paul-de-Vence', 'Saint-Paul-de-Vence', "Le village fortifié des artistes : galeries, remparts et vue sur les collines jusqu'à la mer."],
  ] },
];
