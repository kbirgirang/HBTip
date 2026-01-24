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
  
  const useEmoji = !isChromeOnWindows;
  
  // Always prefer SVG if we have country code (works in all browsers)
  if (countryCode && !imageError) {
    const flagUrls = [
      `https://flagcdn.com/w${size}/${countryCode.toLowerCase()}.svg`,
      `https://flagicons.lipis.dev/flags/4x3/${countryCode.toLowerCase()}.svg`,
      `https://purecatamphetamine.github.io/country-flag-icons/3x2/${countryCode.toUpperCase()}.svg`
    ];
    
    return (
      <img
        src={flagUrls[currentUrlIndex]}
        alt={`${countryCode} flag`}
        className={`inline-block align-middle ${className}`}
        style={{ width: `${size}px`, height: `${size * 0.75}px`, objectFit: "cover", display: "inline-block" }}
        loading="lazy"
        onError={() => {
          if (currentUrlIndex < flagUrls.length - 1) {
            setCurrentUrlIndex(currentUrlIndex + 1);
          } else {
            // All SVG URLs failed, try emoji only if not in Chrome on Windows
            setImageError(true);
          }
        }}
      />
    );
  }
  
  // Fallback to emoji only if SVG failed and we're not in Chrome on Windows
  if (flagEmoji && useEmoji && imageError) {
    return (
      <span 
        className={`inline-block align-middle flag-emoji ${className}`} 
        style={{ fontSize: `${size}px`, lineHeight: 1 }}
      >
        {flagEmoji}
      </span>
    );
  }
  
  // If no country code, try emoji
  if (flagEmoji && useEmoji && !countryCode) {
    return (
      <span 
        className={`inline-block align-middle flag-emoji ${className}`} 
        style={{ fontSize: `${size}px`, lineHeight: 1 }}
      >
        {flagEmoji}
      </span>
    );
  }
  
  return null;
}
