import { getTeamCountryCode } from "@/lib/teamFlags";

interface FlagIconProps {
  teamName: string;
  className?: string;
  size?: number;
}

export default function FlagIcon({ teamName, className = "", size = 20 }: FlagIconProps) {
  const countryCode = getTeamCountryCode(teamName);
  
  if (!countryCode) {
    return null;
  }
  
  // Use flagcdn.com for flag SVG images (works in all browsers including Chrome on Windows)
  // Format: https://flagcdn.com/w20/is.svg (w20 = width 20px)
  const flagUrl = `https://flagcdn.com/w${size}/${countryCode.toLowerCase()}.svg`;
  
  return (
    <img
      src={flagUrl}
      alt={`${countryCode} flag`}
      className={`inline-block align-middle ${className}`}
      style={{ width: `${size}px`, height: `${size * 0.75}px`, objectFit: "cover" }}
      loading="lazy"
    />
  );
}
