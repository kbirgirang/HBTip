"use client";

import { useTheme } from "@/components/ThemeProvider";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-neutral-500 dark:text-neutral-400">Þema</span>

      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as any)}
        className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900
                   dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
      >
        <option value="system">Kerfi</option>
        <option value="light">Ljóst</option>
        <option value="dark">Dökkt</option>
      </select>
    </div>
  );
}

