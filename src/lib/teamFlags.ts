// Mapping of team names to country codes (ISO 3166-1 alpha-2)
// Used for displaying flag emojis
// All European countries + common variations
const teamToCountryCode: Record<string, string> = {
  // EHF Euro 2026 teams
  "Austurríki": "AT",
  "Austria": "AT",
  "Danmörk": "DK",
  "Denmark": "DK",
  "Frakkland": "FR",
  "France": "FR",
  "Færeyjar": "FO",
  "Faroe Islands": "FO",
  "Georgía": "GE",
  "Georgia": "GE",
  "Holland": "NL",
  "Netherlands": "NL",
  "Ungverjaland": "HU",
  "Hungary": "HU",
  "Ísland": "IS",
  "Iceland": "IS",
  "Ítalía": "IT",
  "Italy": "IT",
  "Króatía": "HR",
  "Croatia": "HR",
  "Noregur": "NO",
  "Norway": "NO",
  "Norður-Makedónía": "MK",
  "North Macedonia": "MK",
  "Makedónía": "MK",
  "Pólland": "PL",
  "Poland": "PL",
  "Portúgal": "PT",
  "Portugal": "PT",
  "Rúmenía": "RO",
  "Romania": "RO",
  "Serbía": "RS",
  "Serbia": "RS",
  "Slóvenía": "SI",
  "Slovenia": "SI",
  "Spánn": "ES",
  "Spain": "ES",
  "Svartfjallaland": "ME",
  "Montenegro": "ME",
  "Sviss": "CH",
  "Switzerland": "CH",
  "Svíþjóð": "SE",
  "Sweden": "SE",
  "Tékkland": "CZ",
  "Czech Republic": "CZ",
  "Úkraína": "UA",
  "Ukraine": "UA",
  "Þýskaland": "DE",
  "Germany": "DE",
  
  // Additional European countries
  "Albanía": "AL",
  "Albania": "AL",
  "Andorra": "AD",
  "Armenía": "AM",
  "Armenia": "AM",
  "Aserbaídsjan": "AZ",
  "Azerbaijan": "AZ",
  "Belgía": "BE",
  "Belgium": "BE",
  "Bósnía og Hersegóvína": "BA",
  "Bosnia and Herzegovina": "BA",
  "Búlgaría": "BG",
  "Bulgaria": "BG",
  "Eistland": "EE",
  "Estonia": "EE",
  "Finnland": "FI",
  "Finland": "FI",
  "Grikkland": "GR",
  "Greece": "GR",
  "Írland": "IE",
  "Ireland": "IE",
  "Ísrael": "IL",
  "Israel": "IL",
  "Kosóvó": "XK",
  "Kosovo": "XK",
  "Lettland": "LV",
  "Latvia": "LV",
  "Liechtenstein": "LI",
  "Litháen": "LT",
  "Lithuania": "LT",
  "Lúxemborg": "LU",
  "Luxembourg": "LU",
  "Malta": "MT",
  "Moldóva": "MD",
  "Moldova": "MD",
  "Mónakó": "MC",
  "Monaco": "MC",
  "Rússland": "RU",
  "Russia": "RU",
  "San Marínó": "SM",
  "San Marino": "SM",
  "Slóvakía": "SK",
  "Slovakia": "SK",
  "Tyrkland": "TR",
  "Turkey": "TR",
  "Vatíkanið": "VA",
  "Vatican City": "VA",
  "Hvíta-Rússland": "BY",
  "Belarus": "BY",
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
