/**
 * API-Football integration service
 * Documentation: https://www.api-football.com/documentation-v3
 */

const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";

export type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string; // ISO date string
    status: {
      short: string; // "FT", "NS", "LIVE", etc.
      long: string;
    };
  };
  teams: {
    home: {
      id: number;
      name: string;
    };
    away: {
      id: number;
      name: string;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  league: {
    id: number;
    name: string;
    round: string;
  };
};

export type ApiFootballResponse = {
  get: string;
  parameters: Record<string, any>;
  errors: any[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: ApiFootballFixture[];
};

/**
 * Fetch fixtures from API-Football
 */
export async function fetchApiFootballFixtures(
  leagueId: number,
  season: number,
  apiKey: string,
  options?: {
    round?: string;
    date?: string; // YYYY-MM-DD
  }
): Promise<ApiFootballFixture[]> {
  let url = `${API_FOOTBALL_BASE_URL}/fixtures?league=${leagueId}&season=${season}`;
  
  if (options?.round) {
    url += `&round=${encodeURIComponent(options.round)}`;
  }
  if (options?.date) {
    url += `&date=${options.date}`;
  }

  const response = await fetch(url, {
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "v3.football.api-sports.io",
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`API-Football error: ${response.status} ${response.statusText}. ${errorText}`);
  }

  const data = (await response.json()) as ApiFootballResponse;

  if (data.errors && data.errors.length > 0) {
    throw new Error(`API-Football errors: ${JSON.stringify(data.errors)}`);
  }

  return data.response || [];
}

/**
 * Convert API-Football result to our format ("1", "X", "2", or null)
 */
export function convertApiFootballResult(fixture: ApiFootballFixture): "1" | "X" | "2" | null {
  // Ef leikur er ekki búinn, skila null
  if (fixture.fixture.status.short !== "FT") {
    return null;
  }

  const homeScore = fixture.goals.home;
  const awayScore = fixture.goals.away;

  // Ef skor er null, skila null
  if (homeScore === null || awayScore === null) {
    return null;
  }

  if (homeScore > awayScore) return "1";
  if (homeScore < awayScore) return "2";
  if (homeScore === awayScore) return "X";
  return null;
}

/**
 * Get common league IDs for reference
 */
export const API_FOOTBALL_LEAGUES = {
  PREMIER_LEAGUE: 39,
  LA_LIGA: 140,
  SERIE_A: 135,
  BUNDESLIGA: 78,
  LIGUE_1: 61,
  CHAMPIONS_LEAGUE: 2,
  EUROPA_LEAGUE: 3,
} as const;

