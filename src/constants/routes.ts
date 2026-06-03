// Team configuration for the Strasbourg Mission.
// routeOffset determines which station each team visits first (0-based index into
// the stations array sorted by order). With 8 stations and 8 unique offsets, every
// team starts at a different station — no two teams clash at the same starting point,
// spreading 100 students evenly across the route on day-1.
//
// resetTeamProgress uses Array.slice() with the offset; no explicit modulo is needed
// as long as offset < stationsCount. Keep offsets in [0, stationsCount-1].
export interface TeamConfig {
  teamCode: string;
  teamName: string;
  routeOffset: number; // 0–7; one per team, no duplicates
}

export const TEAM_CONFIGS: TeamConfig[] = [
  { teamCode: "ALPHA-1",   teamName: "Équipe Alpha",   routeOffset: 0 },
  { teamCode: "BRAVO-2",   teamName: "Équipe Bravo",   routeOffset: 1 },
  { teamCode: "CHARLIE-3", teamName: "Équipe Charlie", routeOffset: 2 },
  { teamCode: "DELTA-4",   teamName: "Équipe Delta",   routeOffset: 3 },
  { teamCode: "ECHO-5",    teamName: "Équipe Echo",    routeOffset: 4 },
  { teamCode: "FOXTROT-6", teamName: "Équipe Foxtrot", routeOffset: 5 },
  { teamCode: "GOLF-7",    teamName: "Équipe Golf",    routeOffset: 6 },
  { teamCode: "HOTEL-8",   teamName: "Équipe Hotel",   routeOffset: 7 },
];
