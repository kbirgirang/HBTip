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
  
  // Add extra margin-right in Chrome to prevent cropping
  const isChrome = typeof window !== 'undefined' && /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  
  // Always try SVG/PNG first if we have country code
  if (countryCode && !imageError) {
    // Try multiple CDN options
    const flagUrls = [
      `https://flagcdn.com/w${size}/${countryCode.toLowerCase()}.svg`,
      `https://flagcdn.com/w${size}/${countryCode.toLowerCase()}.png`,
      `https://flagicons.lipis.dev/flags/4x3/${countryCode.toLowerCase()}.svg`,
      `https://purecatamphetamine.github.io/country-flag-icons/3x2/${countryCode.toUpperCase()}.svg`
    ];
    
    return (
      <span 
        className={`inline-block align-middle ${className}`} 
        style={{ 
          overflow: "visible", 
          lineHeight: 0,
          marginRight: isChrome ? "8px" : undefined,
          paddingRight: isChrome ? "4px" : undefined,
          display: "inline-block",
          minWidth: isChrome ? `${size + 8}px` : undefined
        }}
      >
        <img
          src={flagUrls[currentUrlIndex]}
          alt={`${countryCode} flag`}
          className="inline-block align-middle"
          style={{ 
            width: `${size}px`, 
            height: `${size * 0.75}px`, 
            objectFit: "contain", 
            display: "inline-block",
            flexShrink: 0,
            verticalAlign: "middle",
            maxWidth: `${size}px`,
            maxHeight: `${size * 0.75}px`,
            marginRight: isChrome ? "2px" : undefined,
            transform: isChrome ? "translateX(2px)" : undefined
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
              // All URLs failed - fallback to emoji
              setImageError(true);
            }
          }}
          onLoad={() => {
            // Image loaded successfully
            setImageError(false);
          }}
        />
      </span>
    );
  }
  
  // Fallback to emoji if:
  // 1. No country code found, OR
  // 2. All image URLs failed, OR  
  // 3. Not Chrome on Windows (where emojis show as "IS" text)
  if (flagEmoji && (!countryCode || imageError || !isChromeOnWindows)) {
    return (
      <span 
        className={`inline-block align-middle flag-emoji ${className}`} 
        style={{ fontSize: `${size}px`, lineHeight: 1 }}
      >
        {flagEmoji}
      </span>
    );
  }
  
  // In Chrome on Windows with no emoji fallback, show nothing
  return null;
}
