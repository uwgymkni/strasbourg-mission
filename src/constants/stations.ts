import type { Station } from "@/types/game";

// ---------------------------------------------------------------------------
// Helper — builds a Google Maps deep-link from coordinates.
// On iOS/Android this opens the native Maps app; on desktop it opens the browser.
// We use the /search/ endpoint with an explicit query parameter so the pin lands
// at the exact location rather than returning a list of nearby results.
// ---------------------------------------------------------------------------
function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

// 8 stations in Strasbourg; reward letters spell A-L-S-A-C-I-E-N in rewardNumber order.
export const STATIONS: Station[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // STATION 1 — Place Gutenberg
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "station-1",
    order: 1,
    title: "Place Gutenberg",
    locationHint:
      "Trefft euch am Place Gutenberg, im Herzen der Großen Insel. Stellt euch der Bronzestatue gegenüber und sucht die Inschrift am Sockel.",
    challengeType: "text",
    observationQuestion:
      "Welcher kurze Satz steht in der Inschrift am Sockel der Gutenberg-Statue?",
    acceptedAnswers: [
      // Vollform mit „Et"
      "Et la lumière fut",
      "et la lumière fut",
      "Et la lumière fût",
      "et la lumière fût",
      "ET LA LUMIÈRE FUT",
      "ET LA LUMIÈRE FÛT",
      "Et la lumiere fut",
      "et la lumiere fut",
      "Et la lumiere fût",
      "et la lumiere fût",
      // Kurzform ohne „Et"
      "La lumière fut",
      "la lumière fut",
      "La lumière fût",
      "la lumière fût",
      "LA LUMIÈRE FUT",
      "LA LUMIÈRE FÛT",
      "La lumiere fut",
      "la lumiere fut",
      "La lumiere fût",
      "la lumiere fût",
      // Minimal ohne Artikel
      "lumière fut",
      "lumière fût",
      "lumiere fut",
      "lumiere fût",
    ],
    photoChallenge:
      "Fotografiert eure Gruppe, wie ihr die Pose von Gutenberg nachahmt — eine Hand ausgestreckt, als würdet ihr eine gedruckte Seite präsentieren.",
    knowledgeText:
      "'Et la lumière fut' — 'Und es ward Licht'. Das Zitat aus dem Buch Genesis steht hier symbolisch für die Erfindung des Buchdrucks: Wissen wird verbreitet, das Zeitalter der Aufklärung beginnt. Johannes Gutenberg hielt sich zwischen 1434 und 1444 in Straßburg auf und führte hier erste Druckexperimente durch, bevor er die Druckerpresse mit beweglichen Lettern in Mainz fertigstellte. Die 1840 von David d'Angers geschaffene Bronzestatue zeigt ihn, wie er die erste gedruckte Seite der Geschichte in den Händen hält.",
    rewardLetter: "A",
    rewardNumber: 1,
    latitude: 48.5818,
    longitude: 7.7487,
    mapsUrl: mapsLink(48.5818, 7.7487),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // STATION 2 — Place Kléber
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "station-2",
    order: 2,
    title: "Place Kléber",
    locationHint:
      "Geht zum Place Kléber, dem größten Platz Straßburgs. Sucht am Sockel der Statue die Bronzetafeln, die Klébers Schlachten zeigen.",
    challengeType: "text",
    observationQuestion:
      "Auf einer der Tafeln am Sockel ist die Schlacht von Altenkirchen abgebildet. In welchem Jahr fand diese Schlacht statt?",
    acceptedAnswers: ["1796"],
    photoChallenge:
      "Macht EIN Gruppenfoto mit der GESAMTEN Gruppe vor der Statue. Kein militärischer Gruß! Stattdessen eine kreative Pose: Pyramide bilden, alle gleichzeitig springen, alle Richtung Münster zeigen — oder etwas Eigenes. Hauptsache: alle drauf und lustig.",
    knowledgeText:
      "Die Schlacht von Altenkirchen am 4. Juni 1796 war einer der frühen Siege Klébers im Ersten Koalitionskrieg im Westerwald — verewigt auf einer der Bronzetafeln am Sockel. Jean-Baptiste Kléber (1753–1800), gebürtiger Straßburger, befehligte später die Armeen der Französischen Republik in Ägypten und wurde 1800 in Kairo ermordet. Seine sterblichen Überreste ruhen seit 1838 unter der Bodenplatte seiner eigenen Statue — er ist buchstäblich auf dem Hauptplatz seiner Heimatstadt begraben.",
    rewardLetter: "L",
    rewardNumber: 2,
    latitude: 48.5840,
    longitude: 7.7471,
    mapsUrl: mapsLink(48.5840, 7.7471),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // STATION 3 — Petite France
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "station-3",
    order: 3,
    title: "Petite France",
    locationHint:
      "Geht in die Petite France. Haltet in der Rue du Bain-aux-Plantes vor den bunten alten Häusern am Kanal an.",
    challengeType: "text",
    observationQuestion:
      "Wie nennt man die Bauweise dieser Häuser, bei der das Holzgerüst von außen sichtbar bleibt? (Ein Wort, Deutsch oder Französisch)",
    acceptedAnswers: [
      "Fachwerk",
      "fachwerk",
      "FACHWERK",
      "Fachwerkhaus",
      "Fachwerkhäuser",
      "colombages",
      "Colombages",
      "COLOMBAGES",
      "colombage",
      "Colombage",
      "pan de bois",
      "à colombages",
    ],
    photoChallenge:
      "Fotografiert die bunteste Hausfassade, die von eurer Position aus sichtbar ist — achtet auf die Spiegelungen im Kanal.",
    knowledgeText:
      "Das Viertel 'Petite France' verdankt seinen Namen paradoxerweise einem Hospital aus dem 16. Jahrhundert, in dem Soldaten mit Syphilis behandelt wurden — die Krankheit nannten die Franzosen damals 'mal français'. Die typischen Fachwerkhäuser entlang der Kanäle wurden früher von Gerbern und Müllern bewohnt, die die Strömung der Ill für ihre Mühlen und das Färben von Häuten nutzten. Die obersten, offenen Stockwerke waren Speicher, in denen die Häute trocknen konnten — daran erkennt man die alten Gerberhäuser noch heute.",
    rewardLetter: "S",
    rewardNumber: 3,
    latitude: 48.5793,
    longitude: 7.7398,
    mapsUrl: mapsLink(48.5793, 7.7398),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // STATION 4 — Ponts Couverts
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "station-4",
    order: 4,
    title: "Ponts Couverts",
    locationHint:
      "Geht zu den Ponts Couverts. Stellt euch auf die erste Brücke und schaut in Richtung der mittelalterlichen Türme.",
    challengeType: "text",
    observationQuestion:
      "Wie viele mittelalterliche Türme könnt ihr von dieser Brücke aus zählen?",
    acceptedAnswers: [
      "3", "drei", "Drei", "DREI",
      "4", "vier", "Vier", "VIER",
    ],
    photoChallenge:
      "Macht ein Panoramafoto, das die Türme und die Flussarme der Ill von der Brücke aus zeigt.",
    knowledgeText:
      "Die im 13. Jahrhundert erbauten Ponts Couverts bildeten die erste Verteidigungslinie Straßburgs. Ursprünglich waren sie mit einem Holzdach bedeckt — dieses verschwand nach der Französischen Revolution, weshalb ihr Name heute paradox klingt. Es gab ursprünglich vier Türme; je nach Blickwinkel sind drei oder alle vier davon noch erkennbar. Jeder Turm trägt den Namen einer alten Straßburger Zunft.",
    rewardLetter: "A",
    rewardNumber: 4,
    latitude: 48.5784,
    longitude: 7.7376,
    mapsUrl: mapsLink(48.5784, 7.7376),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // STATION 5 — Barrage Vauban  (unverändert)
  // ─────────────────────────────────────────────────────────────────────────
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
    latitude: 48.5781,
    longitude: 7.7361,
    mapsUrl: mapsLink(48.5781, 7.7361),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // STATION 6 — Haus Kammerzell / Hôtel Cathédrale gegenüber
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "station-6",
    order: 6,
    title: "Haus Kammerzell",
    locationHint:
      "Geht zurück zum Straßburger Münster. Links vom Eingangsportal seht ihr das Haus Kammerzell mit seinen drei geschnitzten Holzetagen. Schaut nun auf die andere Straßenseite.",
    challengeType: "text",
    observationQuestion:
      "Wie heißt das Hotel, das gegenüber dem Haus Kammerzell auf der anderen Straßenseite liegt?",
    acceptedAnswers: [
      "Hotel Cathedrale",
      "hotel cathedrale",
      "HOTEL CATHEDRALE",
      "Hotel Cathédrale",
      "hotel cathédrale",
      "Hôtel Cathédrale",
      "hôtel cathédrale",
      "HÔTEL CATHÉDRALE",
      "Hôtel Cathedrale",
      "hôtel cathedrale",
      "Hotel de la Cathédrale",
      "Hôtel de la Cathédrale",
      "hôtel de la cathédrale",
      "hotel de la cathedrale",
    ],
    photoChallenge:
      "Fotografiert eine der geschnitzten Tafeln an der Holzfassade des Hauses Kammerzell aus der Nähe — jede Tafel zeigt ein anderes Thema: Sinne, Planeten oder Helden der Antike.",
    knowledgeText:
      "Das Haus Kammerzell gilt als eines der schönsten mittelalterlichen Häuser im Elsass — Erdgeschoss aus rosa Sandstein (1467), Holzetagen mit Schnitzereien (1589). Es verdankt seinen Namen einem elsässischen Käsehändler des 18. Jahrhunderts. Die 36 Schnitzereien stellen die fünf Sinne, die sieben damals bekannten Planeten und Helden der Antike dar. Direkt gegenüber liegt das Hôtel Cathédrale — eines der traditionsreichsten Häuser der Straßburger Altstadt mit Zimmern, die direkt auf das Münsterportal blicken.",
    rewardLetter: "I",
    rewardNumber: 6,
    latitude: 48.5818,
    longitude: 7.7511,
    mapsUrl: mapsLink(48.5818, 7.7511),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // STATION 7 — NEU: Palais Rohan / Pont Sainte-Madeleine
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "station-7",
    order: 7,
    title: "Palais Rohan",
    locationHint:
      "Geht um das Münster herum zum Palais Rohan (2 Place du Château). Von der Rückseite des Palais blickt ihr direkt auf die angrenzende Brücke Pont Sainte-Madeleine, die über die Ill führt.",
    challengeType: "text",
    observationQuestion:
      "Wie viele Pfeiler (Steher) stehen im Wasser der angrenzenden Brücke Pont Sainte-Madeleine?",
    acceptedAnswers: [
      "3", "drei", "Drei", "DREI",
    ],
    photoChallenge:
      "Fotografiert die Pont Sainte-Madeleine von der Palais-Rohan-Seite aus — oder macht ein Gruppenfoto vor dem prachtvollen Hauptportal des Palais.",
    knowledgeText:
      "Der Palais Rohan wurde zwischen 1731 und 1742 für Kardinal Armand-Gaston de Rohan-Soubise erbaut, einen der mächtigsten Fürstbischöfe Frankreichs. Heute beherbergt der Palast drei Museen: das Archäologische Museum (im Keller), das Museum für Dekorative Kunst (mit den Privaträumen der Kardinäle im Erdgeschoss) und das Museum der Schönen Künste (im Obergeschoss). Die Pont Sainte-Madeleine daneben verbindet das Münsterviertel mit dem Stadtteil Krutenau.",
    rewardLetter: "E",
    rewardNumber: 7,
    latitude: 48.5808,
    longitude: 7.7522,
    mapsUrl: mapsLink(48.5808, 7.7522),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // STATION 8 — NEU: Straßburger Münster (Blick vom Place du Château)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "station-8",
    order: 8,
    title: "Straßburger Münster",
    locationHint:
      "Bleibt auf dem Place du Château und dreht euch zum Straßburger Münster — der mächtigen Kathedrale, die euch hier von der Südseite überragt.",
    challengeType: "text",
    observationQuestion:
      "Welche Farbe hat das Straßburger Münster?",
    acceptedAnswers: [
      "rosa", "Rosa", "ROSA",
      "rose", "Rose",
      "rosé", "Rosé",
      "rot", "Rot", "ROT",
      "rouge", "Rouge",
      "rötlich", "Rötlich",
      "rotbraun", "Rotbraun",
      "pink", "Pink",
      "rosenrot", "Rosenrot",
      "rosarot", "Rosarot",
      "rosafarben", "Rosafarben",
    ],
    photoChallenge:
      "Macht ein Gruppenfoto mit dem Münster im Hintergrund — versucht, möglichst viel vom Bauwerk aufs Bild zu bekommen.",
    knowledgeText:
      "Das Straßburger Münster (Notre-Dame de Strasbourg) wurde zwischen 1015 und 1439 aus rosafarbenem Vogesensandstein erbaut. Mit 142 Metern Höhe war es vom 17. bis 19. Jahrhundert das höchste Bauwerk der Welt. Ursprünglich waren zwei Türme geplant — gebaut wurde nur einer. Goethe schwärmte während seines Straßburger Studiums hier von der gotischen Baukunst und nannte sie eine 'erhabene weite Empfindung'. Die rosa Farbe stammt vom Eisenoxid im Sandstein der Vogesen — derselbe Stein, aus dem auch das Erdgeschoss des Hauses Kammerzell besteht.",
    rewardLetter: "N",
    rewardNumber: 8,
    latitude: 48.5813,
    longitude: 7.7516,
    mapsUrl: mapsLink(48.5813, 7.7516),
  },
];
