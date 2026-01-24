"use client";

import { getTeamCountryCode, getTeamFlag } from "@/lib/teamFlags";
import { useState } from "react";

interface FlagIconProps {
  teamName: string;
  className?: string;
  size?: number;
}

export default function FlagIcon({ teamName, className = "", size = 20 }: FlagIconProps) {
  const countryCode = getTeamCountryCode(teamName);
  const [imageError, setImageError] = useState(false);
  const flagEmoji = getTeamFlag(teamName);
  
  // Always show emoji as primary option for now (works in Firefox)
  // SVG images can be added later if needed
  if (flagEmoji) {
    return (
      <span 
        className={`inline-block align-middle flag-emoji ${className}`} 
        style={{ fontSize: `${size}px`, lineHeight: 1 }}
      >
        {flagEmoji}
      </span>
    );
  }
  
  // If no emoji and we have country code, try SVG
  if (countryCode && !imageError) {
    const flagUrl = `https://flagcdn.com/w${size}/${countryCode.toLowerCase()}.svg`;
    
    return (
      <img
        src={flagUrl}
        alt={`${countryCode} flag`}
        className={`inline-block align-middle ${className}`}
        style={{ width: `${size}px`, height: `${size * 0.75}px`, objectFit: "cover" }}
        loading="lazy"
        onError={() => setImageError(true)}
      />
    );
  }
  
  return null;
}
