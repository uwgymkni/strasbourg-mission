// Strasbourg Mission — quiz questions and tuning constants.
//
// Single source of truth for the real-time quiz. Questions are fixed content
// (one mission, never edited by teachers) so they live here, not in Firestore.
// correctIndex + explanation are included; see the anti-cheat note in the
// architecture doc — the realistic protection is single-submission, server
// timestamps, and teacher supervision, not bundle secrecy.

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

// ── Tuning ─────────────────────────────────────────────────────────────────
export const QUIZ_COUNTDOWN_MS = 30_000;          // lobby countdown
export const QUIZ_REVEAL_MS = 8_000;              // fixed reveal window
export const QUIZ_DURATION_OPTIONS_MS = [10_000, 15_000, 20_000] as const;
export const QUIZ_DEFAULT_DURATION_MS = 15_000;
export const QUIZ_MAX_POINTS_PER_QUESTION = 100;  // → 1500 max over 15 questions

/** Question 1 always gets a longer window so teams settle in; later questions
 *  use the duration configured at quiz start (10/15/20 s). */
export const QUIZ_FIRST_QUESTION_MS = 25_000;

/** Effective time limit for a question: 25 s for index 0, else the configured base. */
export function effectiveQuestionMs(index: number, baseMs: number): number {
  return index === 0 ? QUIZ_FIRST_QUESTION_MS : baseMs;
}

// ── Questions (15) — abgeleitet aus den Wissenstexten der 8 Stationen,
//    ohne Wiederholung der Stationsfragen. Schwierigkeit ausgewogen.
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // — Station 1: Place Gutenberg —
  {
    question: "In welchem Zeitraum hielt sich Gutenberg in Straßburg auf?",
    options: ["1434–1444", "1380–1390", "1500–1510", "1600–1610"],
    correctIndex: 0,
    explanation: "Gutenberg lebte rund zehn Jahre (1434–1444) in Straßburg und experimentierte hier mit dem Druck, bevor er nach Mainz ging.",
  },
  {
    question: "Wer schuf die berühmte Gutenberg-Statue von 1840?",
    options: ["Auguste Rodin", "David d'Angers", "Gustave Eiffel", "Claude Monet"],
    correctIndex: 1,
    explanation: "Der Bildhauer David d'Angers schuf die 1840 eingeweihte Bronzestatue, die Gutenberg mit einer gedruckten Seite zeigt.",
  },
  // — Station 2: Place Kléber —
  {
    question: "In welchem Land wurde General Kléber ermordet?",
    options: ["Österreich", "Russland", "Ägypten", "Italien"],
    correctIndex: 2,
    explanation: "Kléber übernahm in Ägypten das Kommando der französischen Armee und wurde dort im Jahr 1800 ermordet.",
  },
  {
    question: "Was geschah 1838 mit Klébers sterblichen Überresten?",
    options: ["Sie wurden nach Paris überführt", "Sie ruhen unter seiner Statue auf dem Place Kléber", "Sie blieben in Ägypten", "Sie wurden im Münster bestattet"],
    correctIndex: 1,
    explanation: "Seit 1838 ruhen Klébers Überreste unter der Bodenplatte seiner eigenen Statue — er ist buchstäblich auf dem Hauptplatz begraben.",
  },
  // — Station 3: Petite France —
  {
    question: "Welche Berufsgruppen bewohnten die Häuser der Petite France früher vor allem?",
    options: ["Goldschmiede", "Buchdrucker", "Gerber und Müller", "Winzer"],
    correctIndex: 2,
    explanation: "Gerber und Müller nutzten die Strömung der Ill für ihre Mühlen und zum Bearbeiten der Tierhäute.",
  },
  {
    question: "Wozu dienten die offenen obersten Stockwerke der alten Gerberhäuser?",
    options: ["Zum Trocknen der Häute", "Als Wohnräume der Reichen", "Als Aussichtstürme", "Zur Lagerung von Wein"],
    correctIndex: 0,
    explanation: "Die offenen Dachgeschosse waren Speicher, in denen die gegerbten Häute an der Luft trocknen konnten.",
  },
  // — Station 4: Ponts Couverts —
  {
    question: "Aus welchem Jahrhundert stammen die Ponts Couverts?",
    options: ["10. Jahrhundert", "13. Jahrhundert", "17. Jahrhundert", "19. Jahrhundert"],
    correctIndex: 1,
    explanation: "Die im 13. Jahrhundert errichteten Brücken bildeten einst die erste Verteidigungslinie der Stadt.",
  },
  {
    question: "Wonach sind die Türme der Ponts Couverts benannt?",
    options: ["Nach Heiligen", "Nach Königen", "Nach alten Zünften", "Nach Flüssen"],
    correctIndex: 2,
    explanation: "Jeder erhaltene Turm trägt den Namen einer alten Straßburger Zunft.",
  },
  // — Station 5: Barrage Vauban —
  {
    question: "In wessen Auftrag wurde der Barrage Vauban gebaut?",
    options: ["Napoleon", "Ludwig XIV.", "Karl dem Großen", "Friedrich dem Großen"],
    correctIndex: 1,
    explanation: "Der Damm entstand 1686–1690 im Auftrag des französischen Königs Ludwig XIV.",
  },
  {
    question: "Was befindet sich heute im Barrage Vauban?",
    options: ["Ein Schwimmbad", "Eine Galerie mittelalterlicher Skulpturen", "Ein Bahnhof", "Ein Weinkeller"],
    correctIndex: 1,
    explanation: "Heute beherbergt das Bauwerk eine Galerie mit mittelalterlichen Skulpturen aus dem Straßburger Münster.",
  },
  // — Station 6: Haus Kammerzell —
  {
    question: "Aus welchem Jahr stammt das steinerne Erdgeschoss des Hauses Kammerzell?",
    options: ["1200", "1467", "1589", "1700"],
    correctIndex: 1,
    explanation: "Das Erdgeschoss aus Vogesensandstein stammt von 1467; die geschnitzten Holzetagen kamen erst 1589 hinzu.",
  },
  {
    question: "Was stellen die 36 Schnitzereien am Haus Kammerzell dar?",
    options: ["Die zwölf Apostel", "Szenen aus der Bibel", "Die fünf Sinne, sieben Planeten und antike Helden", "Die Wappen elsässischer Städte"],
    correctIndex: 2,
    explanation: "Das ikonografische Programm zeigt die fünf Sinne, die sieben damals bekannten Planeten und Helden der Antike.",
  },
  // — Station 7: Palais Rohan —
  {
    question: "Für wen wurde der Palais Rohan erbaut?",
    options: ["Für einen König", "Für einen General", "Für einen Kardinal", "Für einen Kaufmann"],
    correctIndex: 2,
    explanation: "Der Palast entstand 1731–1742 für Kardinal Armand-Gaston de Rohan-Soubise, einen mächtigen Fürstbischof.",
  },
  {
    question: "Wie viele Museen beherbergt der Palais Rohan heute?",
    options: ["Eins", "Zwei", "Drei", "Fünf"],
    correctIndex: 2,
    explanation: "Im Palais Rohan befinden sich drei Museen: Archäologie, Dekorative Kunst und Schöne Künste.",
  },
  // — Station 8: Straßburger Münster —
  {
    question: "Wie viele Türme waren ursprünglich für das Straßburger Münster geplant?",
    options: ["Einer", "Zwei", "Drei", "Vier"],
    correctIndex: 1,
    explanation: "Geplant waren zwei Türme — vollendet wurde aber nur der nördliche, weshalb das Münster heute asymmetrisch wirkt.",
  },
];
