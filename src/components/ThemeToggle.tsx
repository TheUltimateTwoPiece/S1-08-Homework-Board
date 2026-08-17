"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyPreset,
  applyTheme,
  isDarkMode,
  loadTheme,
  THEME_CHANGE_EVENT,
} from "@/lib/theme-engine";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const prefs = loadTheme();
    // Re-apply on mount so the DOM matches the persisted preference even if the
    // FOUC script already did (and to sync the icon state).
    applyTheme(prefs);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(isDarkMode(prefs));
    setMounted(true);
  }, []);

  // Keep the icon in sync with theme changes made elsewhere (e.g. the
  // Appearance & Themes page, or another open tab).
  useEffect(() => {
    const sync = () => setDark(isDarkMode(loadTheme()));
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = dark ? "light" : "dark";
    applyPreset(next);
    setDark(next === "dark");
  }, [dark]);

  if (!mounted) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-lg">
        <div className="h-4 w-4" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="hb-section-title flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-slate-100 dark:hover:bg-stone-700/50"
    >
      {dark ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
