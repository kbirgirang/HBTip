"use client";

import { useEffect, useState, useRef } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    // Sækja theme úr localStorage eða nota dark sem default
    try {
      const saved = localStorage.getItem("theme") as "light" | "dark" | null;
      const initial = saved || "dark";
      setTheme(initial);
      applyTheme(initial);
    } catch (e) {
      // Ef localStorage er ekki tiltækt, nota dark
      applyTheme("dark");
    }
  }, []);

  useEffect(() => {
    if (!buttonRef.current) return;

    const button = buttonRef.current;
    
    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("Direct DOM click event fired!");
      
      const newTheme = theme === "dark" ? "light" : "dark";
      console.log("Changing theme from", theme, "to", newTheme);
      
      setTheme(newTheme);
      
      try {
        localStorage.setItem("theme", newTheme);
      } catch (e) {
        console.error("localStorage error:", e);
      }
      
      applyTheme(newTheme);
    };

    button.addEventListener("click", handleClick);
    
    return () => {
      button.removeEventListener("click", handleClick);
    };
  }, [theme]);

  function applyTheme(newTheme: "light" | "dark") {
    const html = document.documentElement;
    html.classList.remove("light", "dark");
    html.classList.add(newTheme);
    console.log("Theme applied:", newTheme, "HTML classes:", html.className);
  }

  if (!mounted) {
    return (
      <div className="fixed right-4 top-4 z-[9999]">
        <button
          type="button"
          ref={buttonRef}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-neutral-300 bg-white shadow-lg transition hover:scale-105 dark:border-neutral-700 dark:bg-neutral-900"
          aria-label="Toggle theme"
        >
          <div className="h-5 w-5 rounded-full bg-neutral-400 dark:bg-neutral-600" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed right-4 top-4 z-[9999] pointer-events-auto">
      <button
        type="button"
        ref={buttonRef}
        className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-neutral-300 bg-white shadow-lg transition hover:scale-105 active:scale-95 dark:border-neutral-700 dark:bg-neutral-900 pointer-events-auto"
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        style={{ pointerEvents: "auto" }}
      >
        {theme === "dark" ? (
          // Sun icon for dark mode (click to go light)
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-amber-500 pointer-events-none"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>
        ) : (
          // Moon icon for light mode (click to go dark)
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-slate-600 pointer-events-none"
          >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        )}
      </button>
    </div>
  );
}
