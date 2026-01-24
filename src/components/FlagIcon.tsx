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
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const flagEmoji = getTeamFlag(teamName);
  
  // Detect if we're in Chrome on Windows (flag emojis don't work there)
  // Do this synchronously to avoid showing emoji first
  const isChromeOnWindows = typeof window !== 'undefined' && 
    /Chrome/.test(navigator.userAgent) && 
    /Google Inc/.test(navigator.vendor) &&
    /Windows/.test(navigator.platform);
  
  // Always use SVG/PNG if we have country code (works in all browsers)
  if (countryCode) {
    // Try multiple CDN options
    const flagUrls = [
      `https://flagcdn.com/w${size}/${countryCode.toLowerCase()}.svg`,
      `https://flagcdn.com/w${size}/${countryCode.toLowerCase()}.png`,
      `https://flagicons.lipis.dev/flags/4x3/${countryCode.toLowerCase()}.svg`,
      `https://purecatamphetamine.github.io/country-flag-icons/3x2/${countryCode.toUpperCase()}.svg`
    ];
    
    return (
      <img
        src={flagUrls[currentUrlIndex]}
        alt={`${countryCode} flag`}
        className={`inline-block align-middle ${className}`}
        style={{ 
          width: `${size}px`, 
          height: `${size * 0.75}px`, 
          objectFit: "cover", 
          display: "inline-block",
          flexShrink: 0,
          verticalAlign: "middle"
        }}
        loading="eager"
        onError={(e) => {
          const target = e.currentTarget;
          const nextIndex = currentUrlIndex + 1;
          if (nextIndex < flagUrls.length) {
            // Try next URL
            setCurrentUrlIndex(nextIndex);
            target.src = flagUrls[nextIndex];
          } else {
            // All URLs failed
            setImageError(true);
            target.style.display = "none";
          }
        }}
        onLoad={() => {
          // Image loaded successfully
          setImageError(false);
        }}
      />
    );
  }
  
  // Fallback to emoji only if no country code found AND not in Chrome on Windows
  if (flagEmoji && !isChromeOnWindows && !countryCode) {
    return (
      <span 
        className={`inline-block align-middle flag-emoji ${className}`} 
        style={{ fontSize: `${size}px`, lineHeight: 1 }}
      >
        {flagEmoji}
      </span>
    );
  }
  
  // In Chrome on Windows, don't show emoji fallback (it shows as "IS" text)
  return null;
}
