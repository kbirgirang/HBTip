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
      applyTheme("dark");
    }
  }, []);

  function applyTheme(newTheme: "light" | "dark") {
    const html = document.documentElement;
    const body = document.body;
    
    // Fjarlægja báðar classes
    html.classList.remove("light");
    html.classList.remove("dark");
    
    // Bæta við nýju class
    html.classList.add(newTheme);
    
    // Force immediate style update
    if (newTheme === "light") {
      body.style.backgroundColor = "#ffffff";
      body.style.color = "#171717";
    } else {
      body.style.backgroundColor = "#0a0a0a";
      body.style.color = "#ededed";
    }
    
    // Force reflow
    void html.offsetHeight;
    console.log("Theme applied:", newTheme, "HTML classes:", html.className);
  }

  const handleClick = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    
    try {
      localStorage.setItem("theme", newTheme);
    } catch (e) {
      // Ignore
    }
    
    applyTheme(newTheme);
  };

  if (!mounted) {
    return (
      <div className="fixed right-4 top-4 z-50">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-neutral-300 bg-white shadow-lg transition hover:scale-105 dark:border-neutral-700 dark:bg-neutral-900"
          aria-label="Toggle theme"
        >
          <div className="h-5 w-5 rounded-full bg-neutral-400 dark:bg-neutral-600" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed right-4 top-4 z-40">
      <button
        type="button"
        onClick={handleClick}
        className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-neutral-300 bg-white shadow-lg transition hover:scale-105 active:scale-95 dark:border-neutral-700 dark:bg-neutral-900"
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? (
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
    </div>
  );
}
