import type { Station } from "@/types/game";

// 6 stations in Strasbourg; reward letters spell A-L-S-A-C-E in rewardNumber order.
export const STATIONS: Station[] = [
  {
    id: "station-1",
    order: 1,
    title: "Place Gutenberg",
    locationHint:
      "Trefft euch am Place Gutenberg, im Herzen der Großen Insel. Stellt euch der Bronzestatue gegenüber.",
    challengeType: "text",
    observationQuestion:
      "Welche Jahreszahl ist auf dem Sockel der Gutenberg-Statue eingraviert?",
    acceptedAnswers: ["1840"],
    photoChallenge:
      "Fotografiert eure Gruppe, wie ihr die Pose von Gutenberg nachahmt — eine Hand ausgestreckt, als würde er eine gedruckte Seite präsentieren.",
    knowledgeText:
      "Johannes Gutenberg hielt sich zwischen 1434 und 1444 in Straßburg auf, wo er erste Druckexperimente durchführte, bevor er die Druckerpresse mit beweglichen Lettern in Mainz erfand. Die 1840 eingeweihte Bronzestatue zeigt ihn, wie er die erste gedruckte Seite der Geschichte in den Händen hält.",
    rewardLetter: "A",
    rewardNumber: 1,
  },
  {
    id: "station-2",
    order: 2,
    title: "Place Kléber",
    locationHint:
      "Geht zum Place Kléber, dem größten Platz Straßburgs. Nähert euch der zentralen Statue des Generals.",
    challengeType: "text",
    observationQuestion:
      "Laut der Inschrift auf dem Sockel: In welcher Stadt wurde General Kléber geboren?",
    acceptedAnswers: ["Strasbourg", "strasbourg", "STRASBOURG", "Straßburg"],
    photoChallenge:
      "Macht ein Gruppenfoto mit der Statue von General Kléber im Hintergrund — und grüßt militärisch!",
    knowledgeText:
      "Jean-Baptiste Kléber (1753–1800) ist der bekannteste General aus Straßburg. Als gebürtiger Straßburger befehligte er die Armeen der Französischen Republik und wurde in Kairo ermordet. Seine Asche ruht seit 1838 unter der Bodenplatte seiner eigenen Statue — er ist buchstäblich auf dem Hauptplatz seiner Heimatstadt begraben.",
    rewardLetter: "L",
    rewardNumber: 2,
  },
  {
    id: "station-3",
    order: 3,
    title: "Petite France",
    locationHint:
      "Geht in die Petite France. Haltet am Gerberviertel (Rue du Bain-aux-Plantes) vor den bunten Häusern mit typischen Fachwerk-Fassaden an.",
    challengeType: "text",
    observationQuestion:
      "Wie nennt man diese Bauweise mit sichtbarem Holzgerüst? (Ein Wort, Deutsch oder Französisch)",
    acceptedAnswers: [
      "Fachwerk",
      "fachwerk",
      "FACHWERK",
      "colombages",
      "Colombages",
      "COLOMBAGES",
      "pan de bois",
      "à colombages",
    ],
    photoChallenge:
      "Fotografiert die bunteste Hausfassade, die von eurer Position aus sichtbar ist — achtet dabei auf die Spiegelungen im Kanal.",
    knowledgeText:
      "Das Viertel 'Petite France' verdankt seinen Namen paradoxerweise einem Behandlungshaus für erkrankte Soldaten im 16. Jahrhundert. Die Fachwerkhäuser entlang der Kanäle wurden früher von Gerbern und Müllern bewohnt, die die Strömung der Ill für ihre Mühlen nutzten.",
    rewardLetter: "S",
    rewardNumber: 3,
  },
  {
    id: "station-4",
    order: 4,
    title: "Ponts Couverts",
    locationHint:
      "Geht zu den Ponts Couverts. Stellt euch auf die erste Brücke und schaut in Richtung der mittelalterlichen Türme.",
    challengeType: "text",
    observationQuestion:
      "Wie viele mittelalterliche Türme könnt ihr von dieser Brücke aus zählen?",
    acceptedAnswers: ["3", "drei", "Drei", "DREI"],
    photoChallenge:
      "Macht ein Panoramafoto, das die Türme und die Flussarme der Ill von der Brücke aus zeigt.",
    knowledgeText:
      "Die im 13. Jahrhundert erbauten Ponts Couverts bildeten die erste Verteidigungslinie Straßburgs. Ursprünglich waren sie mit einem Holzdach bedeckt — dieses verschwand nach der Französischen Revolution, weshalb ihr Name heute paradox klingt. Es gab ursprünglich vier Türme; der vierte wurde im 19. Jahrhundert abgerissen. Jeder Turm trägt den Namen einer alten Straßburger Zunft.",
    rewardLetter: "A",
    rewardNumber: 4,
  },
  {
    id: "station-5",
    order: 5,
    title: "Barrage Vauban",
    locationHint:
      "Geht auf die Aussichtsterrasse des Barrage Vauban, erreichbar über die Treppe vom Kai aus. Der Blick über die Straßburger Dächer lohnt sich!",
    challengeType: "text",
    observationQuestion:
      "Welcher Militäringenieur Ludwigs XIV. hat diesen Damm entworfen, der seinen Namen trägt? (Nur Nachname)",
    acceptedAnswers: [
      "Vauban",
      "vauban",
      "VAUBAN",
      "Le Prestre de Vauban",
      "Sébastien Vauban",
    ],
    photoChallenge:
      "Fotografiert von der Terrasse aus das Panorama über die Straßburger Dächer mit dem Münsterturm im Hintergrund.",
    knowledgeText:
      "Der Barrage Vauban wurde zwischen 1686 und 1690 im Auftrag von Ludwig XIV. gebaut. Im Falle eines feindlichen Angriffs konnten die Schleusen angehoben werden, um die südlichen Vororte zu überfluten und den Truppenvormarsch zu bremsen. Das Gebäude beherbergt heute eine Galerie mit mittelalterlichen Skulpturen aus dem Straßburger Münster.",
    rewardLetter: "C",
    rewardNumber: 5,
  },
  {
    id: "station-6",
    order: 6,
    title: "Haus Kammerzell",
    locationHint:
      "Geht zurück zum Straßburger Münster. Vor dem Eingangsportal sucht ihr links das Haus Kammerzell — erkennbar an seinen drei Stockwerken aus geschnitztem Holz.",
    challengeType: "text",
    observationQuestion:
      "In welchem Jahr wurde das steinerne Erdgeschoss des Hauses Kammerzell errichtet? (Jahreszahl an der Fassade suchen)",
    acceptedAnswers: ["1467", "XVe siècle", "15e siècle", "xve siècle"],
    photoChallenge:
      "Fotografiert eine der geschnitzten Tafeln an der Holzfassade aus der Nähe — jede Tafel stellt ein anderes Thema dar: Sinne, Planeten oder Helden der Antike.",
    knowledgeText:
      "Das Haus Kammerzell gilt als eines der schönsten mittelalterlichen Häuser im Elsass. Es wurde in zwei Phasen erbaut — Erdgeschoss aus rosa Sandstein im Jahr 1467, Holzetagen mit Schnitzereien im Jahr 1589. Es verdankt seinen Namen einem elsässischen Käsehändler des 18. Jahrhunderts. Die 36 Schnitzereien stellen die fünf Sinne, die sieben damals bekannten Planeten und Helden der Antike dar.",
    rewardLetter: "E",
    rewardNumber: 6,
  },
];
