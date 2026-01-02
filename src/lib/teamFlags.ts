// Mapping of team names to country codes (ISO 3166-1 alpha-2)
// Used for displaying flag emojis
const teamToCountryCode: Record<string, string> = {
  // EHF Euro teams (common team names)
  "Ísland": "IS",
  "Iceland": "IS",
  "Danmörk": "DK",
  "Denmark": "DK",
  "Svíþjóð": "SE",
  "Sweden": "SE",
  "Noregur": "NO",
  "Norway": "NO",
  "Frakkland": "FR",
  "France": "FR",
  "Spánn": "ES",
  "Spain": "ES",
  "Þýskaland": "DE",
  "Germany": "DE",
  "Portúgal": "PT",
  "Portugal": "PT",
  "Ítalía": "IT",
  "Italy": "IT",
  "Holland": "NL",
  "Netherlands": "NL",
  "Belgía": "BE",
  "Belgium": "BE",
  "Austurríki": "AT",
  "Austria": "AT",
  "Sviss": "CH",
  "Switzerland": "CH",
  "Pólland": "PL",
  "Poland": "PL",
  "Tékkland": "CZ",
  "Czech Republic": "CZ",
  "Slóvakía": "SK",
  "Slovakia": "SK",
  "Ungverjaland": "HU",
  "Hungary": "HU",
  "Rúmenía": "RO",
  "Romania": "RO",
  "Króatía": "HR",
  "Croatia": "HR",
  "Slóvenía": "SI",
  "Slovenia": "SI",
  "Serbía": "RS",
  "Serbia": "RS",
  "Búlgaría": "BG",
  "Bulgaria": "BG",
  "Makedónía": "MK",
  "North Macedonia": "MK",
  "Grikkland": "GR",
  "Greece": "GR",
  "Tyrkland": "TR",
  "Turkey": "TR",
  "Ísrael": "IL",
  "Israel": "IL",
  "Rússland": "RU",
  "Russia": "RU",
  "Hvíta-Rússland": "BY",
  "Belarus": "BY",
  "Úkraína": "UA",
  "Ukraine": "UA",
  "Litháen": "LT",
  "Lithuania": "LT",
  "Lettland": "LV",
  "Latvia": "LV",
  "Eistland": "EE",
  "Estonia": "EE",
  "Finnland": "FI",
  "Finland": "FI",
};

// Convert country code to flag emoji
function countryCodeToFlag(code: string): string {
  const codePoints = code
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Get flag emoji for a team name
export function getTeamFlag(teamName: string): string {
  const normalized = teamName.trim();
  const countryCode = teamToCountryCode[normalized];
  
  if (countryCode) {
    return countryCodeToFlag(countryCode);
  }
  
  // Fallback: try to find partial match (e.g., "Ísland A" -> "IS")
  for (const [team, code] of Object.entries(teamToCountryCode)) {
    if (normalized.includes(team) || team.includes(normalized)) {
      return countryCodeToFlag(code);
    }
  }
  
  // No flag found
  return "";
}

// Check if team has a flag
export function hasTeamFlag(teamName: string): boolean {
  return getTeamFlag(teamName) !== "";
}
