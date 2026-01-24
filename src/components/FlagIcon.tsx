"use client";

import { getTeamCountryCode, getTeamFlag } from "@/lib/teamFlags";
import { useState, useEffect } from "react";

interface FlagIconProps {
  teamName: string;
  className?: string;
  size?: number;
}

export default function FlagIcon({ teamName, className = "", size = 20 }: FlagIconProps) {
  const countryCode = getTeamCountryCode(teamName);
  const [imageError, setImageError] = useState(false);
  const [useEmoji, setUseEmoji] = useState(true);
  const flagEmoji = getTeamFlag(teamName);
  
  // Detect if we're in Chrome (flag emojis don't work in Chrome on Windows)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
      const isWindows = /Windows/.test(navigator.platform);
      // Use SVG in Chrome on Windows, emoji otherwise
      setUseEmoji(!(isChrome && isWindows));
    }
  }, []);
  
  // If we have country code and should use SVG (or emoji failed), use SVG
  if (countryCode && (!useEmoji || imageError)) {
    // Use multiple CDN options to avoid CORB issues
    const flagUrls = [
      `https://flagcdn.com/w${size}/${countryCode.toLowerCase()}.svg`,
      `https://flagicons.lipis.dev/flags/4x3/${countryCode.toLowerCase()}.svg`,
      `https://purecatamphetamine.github.io/country-flag-icons/3x2/${countryCode.toUpperCase()}.svg`
    ];
    const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
    
    return (
      <img
        src={flagUrls[currentUrlIndex]}
        alt={`${countryCode} flag`}
        className={`inline-block align-middle ${className}`}
        style={{ width: `${size}px`, height: `${size * 0.75}px`, objectFit: "cover" }}
        loading="lazy"
        onError={() => {
          if (currentUrlIndex < flagUrls.length - 1) {
            setCurrentUrlIndex(currentUrlIndex + 1);
          } else {
            setImageError(true);
            // Fallback to emoji if all SVG URLs fail
            if (flagEmoji) {
              setUseEmoji(true);
            }
          }
        }}
      />
    );
  }
  
  // Use emoji as primary option (works in Firefox and other browsers)
  if (flagEmoji && useEmoji) {
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
