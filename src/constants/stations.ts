import type { Station } from "@/types/game";

// 6 stations in Strasbourg; reward letters spell A-L-S-A-C-E in rewardNumber order.
export const STATIONS: Station[] = [
  {
    id: "station-1",
    order: 1,
    title: "Place Gutenberg",
    locationHint:
      "Rendez-vous Place Gutenberg, au cœur de la Grande Île. Positionnez-vous face à la statue en bronze.",
    challengeType: "text",
    observationQuestion:
      "Quelle année est inscrite sur le socle de la statue de Gutenberg ?",
    acceptedAnswers: ["1840"],
    photoChallenge:
      "Photographiez votre groupe en mimant la pose de Gutenberg — une main tendue comme s'il présentait une page imprimée.",
    knowledgeText:
      "Johannes Gutenberg a séjourné à Strasbourg entre 1434 et 1444, où il développa ses premières expériences d'impression avant d'inventer la presse à caractères mobiles à Mayence. La statue de bronze inaugurée en 1840 le représente tenant la première page imprimée de l'histoire.",
    rewardLetter: "A",
    rewardNumber: 1,
  },
  {
    id: "station-2",
    order: 2,
    title: "Place Kléber",
    locationHint:
      "Rejoignez la Place Kléber, la plus grande place de Strasbourg. Approchez-vous de la statue centrale du général.",
    challengeType: "text",
    observationQuestion:
      "D'après l'inscription sur le socle, dans quelle ville le général Kléber est-il né ?",
    acceptedAnswers: ["Strasbourg", "strasbourg", "STRASBOURG"],
    photoChallenge:
      "Prenez une photo de groupe avec la statue du général Kléber en arrière-plan, en saluant militairement.",
    knowledgeText:
      "Jean-Baptiste Kléber (1753–1800) est le plus célèbre des généraux strasbourgeois. Né dans la ville, il commanda les armées de la République française et fut assassiné au Caire. Ses cendres reposent sous la dalle de sa propre statue depuis 1838 — il est littéralement enterré sur la place principale de sa ville natale.",
    rewardLetter: "L",
    rewardNumber: 2,
  },
  {
    id: "station-3",
    order: 3,
    title: "Petite France",
    locationHint:
      "Dirigez-vous vers la Petite France. Arrêtez-vous rue du Bain-aux-Plantes face aux maisons de tanneurs aux façades colorées.",
    challengeType: "text",
    observationQuestion:
      "Comment appelle-t-on le style architectural de ces maisons avec des structures en bois apparent croisé ? (Un mot)",
    acceptedAnswers: [
      "colombages",
      "Colombages",
      "COLOMBAGES",
      "à colombages",
      "pan de bois",
      "Fachwerk",
      "fachwerk",
    ],
    photoChallenge:
      "Photographiez la façade la plus colorée visible depuis votre position en cadrant les reflets dans le canal.",
    knowledgeText:
      "La Petite France doit paradoxalement son nom à une maison de soins pour soldats atteints de syphilis au XVIe siècle — les Alsaciens appelaient alors cette maladie « mal français ». Les maisons à colombages qui bordent les canaux étaient autrefois habitées par des tanneurs et des meuniers qui utilisaient le courant de l'Ill pour faire tourner leurs moulins.",
    rewardLetter: "S",
    rewardNumber: 3,
  },
  {
    id: "station-4",
    order: 4,
    title: "Ponts Couverts",
    locationHint:
      "Rejoignez les Ponts Couverts. Placez-vous sur le premier pont et regardez en direction des tours médiévales.",
    challengeType: "text",
    observationQuestion:
      "Combien de tours médiévales pouvez-vous compter depuis ce pont ?",
    acceptedAnswers: ["3", "trois", "Trois", "TROIS"],
    photoChallenge:
      "Réalisez un panoramique en photo montrant les tours et les bras de l'Ill depuis le pont.",
    knowledgeText:
      "Les Ponts Couverts, construits au XIIIe siècle, formaient la première ligne de défense de Strasbourg. Ils étaient à l'origine couverts d'un toit en bois — celui-ci a disparu après la Révolution française, d'où leur nom devenu paradoxal. Il y avait initialement quatre tours ; la quatrième fut démolie au XIXe siècle pour élargir la circulation. Chaque tour porte le nom d'une ancienne corporation de la ville.",
    rewardLetter: "A",
    rewardNumber: 4,
  },
  {
    id: "station-5",
    order: 5,
    title: "Barrage Vauban",
    locationHint:
      "Montez sur la terrasse panoramique du Barrage Vauban, accessible par l'escalier depuis le quai. La vue sur les toits de Strasbourg vaut le détour.",
    challengeType: "text",
    observationQuestion:
      "Quel ingénieur militaire de Louis XIV a conçu ce barrage qui porte son nom ? (Nom de famille uniquement)",
    acceptedAnswers: [
      "Vauban",
      "vauban",
      "VAUBAN",
      "Le Prestre de Vauban",
      "Sébastien Vauban",
    ],
    photoChallenge:
      "Depuis la terrasse, photographiez le panorama sur les toits de Strasbourg avec la flèche de la cathédrale en arrière-plan.",
    knowledgeText:
      "Le Barrage Vauban fut construit entre 1686 et 1690 sur ordre de Louis XIV. En cas d'attaque ennemie, on soulevait ses vannes pour inonder les faubourgs sud et freiner l'avancée des troupes adverses. Le bâtiment abrite aujourd'hui une galerie de sculptures médiévales provenant de la cathédrale Notre-Dame, protégées de l'usure des intempéries.",
    rewardLetter: "C",
    rewardNumber: 5,
  },
  {
    id: "station-6",
    order: 6,
    title: "Maison Kammerzell",
    locationHint:
      "Revenez vers la Cathédrale Notre-Dame. Face au parvis, cherchez la Maison Kammerzell sur votre gauche — reconnaissable à ses trois étages de bois sculpté.",
    challengeType: "text",
    observationQuestion:
      "En quelle année la partie en pierre du rez-de-chaussée de la Maison Kammerzell a-t-elle été construite ? (Cherchez la date sur la façade)",
    acceptedAnswers: ["1467", "XVe siècle", "15e siècle", "xve siècle"],
    photoChallenge:
      "Photographiez en gros plan l'un des panneaux sculptés de la façade en bois — chaque panneau représente un thème différent : les sens, les planètes ou les héros de l'Antiquité.",
    knowledgeText:
      "La Maison Kammerzell est considérée comme l'une des plus belles maisons médiévales d'Alsace. Construite en deux phases — rez-de-chaussée en grès rose en 1467, étages en bois sculpté en 1589 — elle doit son nom à un fromager alsacien qui la posséda au XVIIIe siècle. Ses 36 panneaux sculptés représentent les cinq sens, les sept planètes connues à l'époque et des héros de l'Antiquité.",
    rewardLetter: "E",
    rewardNumber: 6,
  },
];
