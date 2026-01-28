"use client";

import { getTeamFlag } from "@/lib/teamFlags";

type Match = {
  id: string;
  stage: string | null;
  home_team: string;
  away_team: string;
  starts_at: string;
  result: "1" | "X" | "2" | null;
  home_score?: number | null;
  away_score?: number | null;
  myPick?: "1" | "X" | "2" | null;
};

type TournamentBracketProps = {
  matches: Match[];
};

// Helper function to get winner of a match
function getWinner(match: Match): string | null {
  if (!match.result) return null;
  if (match.result === "1") return match.home_team;
  if (match.result === "2") return match.away_team;
  return null; // Draw doesn't have a winner in knockout
}

// Helper function to get loser of a match
function getLoser(match: Match): string | null {
  if (!match.result) return null;
  if (match.result === "1") return match.away_team;
  if (match.result === "2") return match.home_team;
  return null; // Draw doesn't have a loser in knockout
}

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString('is-IS', { month: 'short' });
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day} ${month} ${hours}:${minutes}`;
}

// Team card component
function TeamCard({ 
  team, 
  isPlaceholder, 
  placeholderText,
  isWinner,
  score 
}: { 
  team: string | null; 
  isPlaceholder?: boolean;
  placeholderText?: string;
  isWinner?: boolean;
  score?: number | null;
}) {
  if (isPlaceholder) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800/50">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-300 text-xs font-semibold text-slate-600 dark:bg-neutral-700 dark:text-neutral-400">
          {placeholderText?.substring(0, 2).toUpperCase() || "?"}
        </div>
        <span className="text-sm font-medium text-slate-600 dark:text-neutral-400">
          {placeholderText || "TBD"}
        </span>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800/50">
        <span className="text-sm font-medium text-slate-600 dark:text-neutral-400">TBD</span>
      </div>
    );
  }

  const flag = getTeamFlag(team);
  
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
      isWinner 
        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30" 
        : "border-slate-200 bg-white dark:border-neutral-700 dark:bg-neutral-900/40"
    }`}>
      {flag && <span className="text-lg">{flag}</span>}
      <span className={`text-sm font-medium ${
        isWinner 
          ? "text-emerald-900 dark:text-emerald-100" 
          : "text-slate-900 dark:text-neutral-100"
      }`}>
        {team}
      </span>
      {score !== null && score !== undefined && (
        <span className={`ml-auto text-sm font-semibold ${
          isWinner 
            ? "text-emerald-700 dark:text-emerald-300" 
            : "text-slate-600 dark:text-neutral-400"
        }`}>
          {score}
        </span>
      )}
    </div>
  );
}

// Match card component
function MatchCard({ 
  match, 
  dateTime, 
  label,
  isThirdPlace = false
}: { 
  match: Match | null; 
  dateTime: string;
  label?: string;
  isThirdPlace?: boolean;
}) {
  if (!match) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/40">
        {label && (
          <div className={`mb-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
            isThirdPlace
              ? "bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300"
              : "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
          }`}>
            {label}
          </div>
        )}
        <div className="space-y-2">
          <TeamCard team={null} isPlaceholder />
          <TeamCard team={null} isPlaceholder />
        </div>
        <div className="mt-3 flex items-center justify-end text-xs text-slate-500 dark:text-neutral-400">
          {dateTime}
        </div>
      </div>
    );
  }

  const winner = getWinner(match);
  const homeIsWinner = winner === match.home_team;
  const awayIsWinner = winner === match.away_team;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/40">
      {label && (
        <div className={`mb-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
          isThirdPlace
            ? "bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300"
            : "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
        }`}>
          {label}
        </div>
      )}
      <div className="space-y-2">
        <TeamCard 
          team={match.home_team} 
          isWinner={homeIsWinner}
          score={match.home_score}
        />
        <TeamCard 
          team={match.away_team} 
          isWinner={awayIsWinner}
          score={match.away_score}
        />
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-500 dark:text-neutral-400">
        <span>{dateTime}</span>
        {match.result && (
          <span className="font-mono font-semibold text-slate-700 dark:text-neutral-300">
            {match.result}
          </span>
        )}
      </div>
    </div>
  );
}

export default function TournamentBracket({ matches }: TournamentBracketProps) {
  // Filter matches by stage
  const semifinals = matches.filter(m => 
    m.stage && (m.stage.toLowerCase().includes("semifinal") || m.stage.toLowerCase().includes("undanúrslit"))
  );
  const final = matches.filter(m => 
    m.stage && (m.stage.toLowerCase().includes("final") || m.stage.toLowerCase().includes("úrslit"))
  );
  const thirdPlace = matches.filter(m => 
    m.stage && (m.stage.toLowerCase().includes("3rd") || m.stage.toLowerCase().includes("3.") || m.stage.toLowerCase().includes("þriðja"))
  );

  // Get semifinal matches
  const sf1 = semifinals[0] || null;
  const sf2 = semifinals[1] || null;

  // Get final match
  const finalMatch = final[0] || null;

  // Get 3rd place match
  const thirdPlaceMatch = thirdPlace[0] || null;

  // Determine winners for final (from semifinals)
  let finalHomeTeam: string | null = null;
  let finalAwayTeam: string | null = null;
  
  if (sf1) {
    const winner = getWinner(sf1);
    if (winner) {
      finalHomeTeam = winner;
    } else {
      finalHomeTeam = null; // Will show placeholder
    }
  }
  
  if (sf2) {
    const winner = getWinner(sf2);
    if (winner) {
      finalAwayTeam = winner;
    } else {
      finalAwayTeam = null; // Will show placeholder
    }
  }

  // If final match exists, use its teams instead
  if (finalMatch) {
    finalHomeTeam = finalMatch.home_team;
    finalAwayTeam = finalMatch.away_team;
  }

  // Determine teams for 3rd place match
  let thirdHomeTeam: string | null = null;
  let thirdAwayTeam: string | null = null;
  
  if (sf1) {
    const loser = getLoser(sf1);
    if (loser) {
      thirdHomeTeam = loser;
    }
  }
  
  if (sf2) {
    const loser = getLoser(sf2);
    if (loser) {
      thirdAwayTeam = loser;
    }
  }

  // If 3rd place match exists, use its teams instead
  if (thirdPlaceMatch) {
    thirdHomeTeam = thirdPlaceMatch.home_team;
    thirdAwayTeam = thirdPlaceMatch.away_team;
  }

  // Create final match object with correct teams
  const finalMatchDisplay: Match | null = finalMatch ? finalMatch : (finalHomeTeam || finalAwayTeam ? {
    id: "final-placeholder",
    stage: "Final",
    home_team: finalHomeTeam || "",
    away_team: finalAwayTeam || "",
    starts_at: "",
    result: null,
  } : null);

  // Create 3rd place match object
  const thirdPlaceMatchDisplay: Match | null = thirdPlaceMatch ? thirdPlaceMatch : (thirdHomeTeam || thirdAwayTeam ? {
    id: "third-placeholder",
    stage: "3rd place",
    home_team: thirdHomeTeam || "",
    away_team: thirdAwayTeam || "",
    starts_at: "",
    result: null,
  } : null);

  // Check if we have any knockout matches
  const hasKnockoutMatches = semifinals.length > 0 || final.length > 0 || thirdPlace.length > 0;

  if (!hasKnockoutMatches) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-neutral-700 dark:bg-neutral-800/50">
        <p className="text-slate-600 dark:text-neutral-400">
          Engir útsláttarleikir tiltækir ennþá.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Main Bracket Section */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-neutral-100">
            Útsláttur
          </h2>
        </div>

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          {/* Semifinals Column */}
          <div className="flex-1">
            <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-neutral-400">
              Undanúrslit
            </div>
            <div className="space-y-6">
              {sf1 ? (
                <div className="relative">
                  <MatchCard 
                    match={sf1} 
                    dateTime={formatDate(sf1.starts_at)}
                  />
                  {/* Connecting line to final */}
                  <div className="absolute right-0 top-1/2 hidden h-0.5 w-8 -translate-y-1/2 bg-slate-300 dark:bg-neutral-700 lg:block"></div>
                  <div className="absolute right-8 top-1/2 hidden h-8 w-0.5 -translate-y-1/2 bg-slate-300 dark:bg-neutral-700 lg:block"></div>
                </div>
              ) : (
                <div className="relative">
                  <MatchCard 
                    match={null} 
                    dateTime="TBD"
                  />
                  <div className="absolute right-0 top-1/2 hidden h-0.5 w-8 -translate-y-1/2 bg-slate-300 dark:bg-neutral-700 lg:block"></div>
                  <div className="absolute right-8 top-1/2 hidden h-8 w-0.5 -translate-y-1/2 bg-slate-300 dark:bg-neutral-700 lg:block"></div>
                </div>
              )}
              {sf2 ? (
                <div className="relative">
                  <MatchCard 
                    match={sf2} 
                    dateTime={formatDate(sf2.starts_at)}
                  />
                  {/* Connecting line to final */}
                  <div className="absolute right-0 top-1/2 hidden h-0.5 w-8 -translate-y-1/2 bg-slate-300 dark:bg-neutral-700 lg:block"></div>
                  <div className="absolute right-8 top-1/2 hidden h-8 w-0.5 translate-y-1/2 bg-slate-300 dark:bg-neutral-700 lg:block"></div>
                </div>
              ) : (
                <div className="relative">
                  <MatchCard 
                    match={null} 
                    dateTime="TBD"
                  />
                  <div className="absolute right-0 top-1/2 hidden h-0.5 w-8 -translate-y-1/2 bg-slate-300 dark:bg-neutral-700 lg:block"></div>
                  <div className="absolute right-8 top-1/2 hidden h-8 w-0.5 translate-y-1/2 bg-slate-300 dark:bg-neutral-700 lg:block"></div>
                </div>
              )}
            </div>
          </div>

          {/* Final Column */}
          <div className="flex-1 lg:px-12">
            <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-neutral-400">
              Úrslit
            </div>
            {finalMatchDisplay ? (
              <div className="relative">
                <MatchCard 
                  match={finalMatchDisplay} 
                  dateTime={finalMatchDisplay.starts_at ? formatDate(finalMatchDisplay.starts_at) : "TBD"}
                  label="Úrslit"
                />
                {/* Trophy icon */}
                <div className="absolute -right-12 top-1/2 hidden -translate-y-1/2 lg:block">
                  <div className="text-4xl">🏆</div>
                </div>
              </div>
            ) : (
              <div className="relative">
                <MatchCard 
                  match={null} 
                  dateTime="TBD"
                  label="Úrslit"
                />
                <div className="absolute -right-12 top-1/2 hidden -translate-y-1/2 lg:block">
                  <div className="text-4xl">🏆</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3rd Place Match Section */}
      {(thirdPlaceMatchDisplay || thirdPlace.length > 0) && (
        <div className="border-t border-slate-200 pt-8 dark:border-neutral-700">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-neutral-100">
              Staða
            </h2>
          </div>
          <div className="max-w-md">
            {thirdPlaceMatchDisplay ? (
              <MatchCard 
                match={thirdPlaceMatchDisplay} 
                dateTime={thirdPlaceMatchDisplay.starts_at ? formatDate(thirdPlaceMatchDisplay.starts_at) : "TBD"}
                label="3. sæti"
                isThirdPlace={true}
              />
            ) : (
              <MatchCard 
                match={null} 
                dateTime="TBD"
                label="3. sæti"
                isThirdPlace={true}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
