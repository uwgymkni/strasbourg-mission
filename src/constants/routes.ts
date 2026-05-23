// Team configuration for the Strasbourg Mission.
// routeOffset determines which station each team visits first (0-based index into
// the stations array sorted by order). With 6 stations and 6 offsets, no two teams
// with different offsets start at the same location — spreading 100 students evenly.
export interface TeamConfig {
  teamCode: string;
  teamName: string;
  routeOffset: number; // 0–5; wraps around the 6-station cycle
}

export const TEAM_CONFIGS: TeamConfig[] = [
  { teamCode: "ALPHA-1", teamName: "Équipe Alpha", routeOffset: 0 },
  { teamCode: "BRAVO-2", teamName: "Équipe Bravo", routeOffset: 1 },
  { teamCode: "CHARLIE-3", teamName: "Équipe Charlie", routeOffset: 2 },
  { teamCode: "DELTA-4", teamName: "Équipe Delta", routeOffset: 3 },
  { teamCode: "ECHO-5", teamName: "Équipe Echo", routeOffset: 4 },
  { teamCode: "FOXTROT-6", teamName: "Équipe Foxtrot", routeOffset: 5 },
  { teamCode: "GOLF-7", teamName: "Équipe Golf", routeOffset: 0 },
  { teamCode: "HOTEL-8", teamName: "Équipe Hotel", routeOffset: 1 },
];
