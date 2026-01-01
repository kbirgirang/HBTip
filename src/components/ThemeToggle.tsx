"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

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

  function applyTheme(newTheme: "light" | "dark") {
    const html = document.documentElement;
    if (newTheme === "light") {
      html.classList.remove("dark");
      html.classList.add("light");
    } else {
      html.classList.remove("light");
      html.classList.add("dark");
    }
  }

  const toggleTheme = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const newTheme = theme === "dark" ? "light" : "dark";
    console.log("Toggling theme from", theme, "to", newTheme);
    
    setTheme(newTheme);
    
    try {
      localStorage.setItem("theme", newTheme);
    } catch (e) {
      console.error("localStorage error:", e);
    }
    
    applyTheme(newTheme);
    console.log("Applied theme:", newTheme, "HTML classes:", document.documentElement.className);
  };

  if (!mounted) {
    return (
      <button
        type="button"
        className="fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white/90 backdrop-blur-sm shadow-md transition hover:bg-white dark:border-neutral-700 dark:bg-neutral-900/90 dark:hover:bg-neutral-800"
        aria-label="Toggle theme"
      >
        <div className="h-5 w-5 rounded-full bg-neutral-400 dark:bg-neutral-600" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        console.log("Button clicked!");
        toggleTheme(e);
      }}
      onMouseDown={(e) => e.preventDefault()}
      className="fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white/90 backdrop-blur-sm shadow-md transition hover:bg-white dark:border-neutral-700 dark:bg-neutral-900/90 dark:hover:bg-neutral-800 cursor-pointer"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
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
          className="h-5 w-5 text-amber-500"
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
          className="h-5 w-5 text-slate-600"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  );
}

