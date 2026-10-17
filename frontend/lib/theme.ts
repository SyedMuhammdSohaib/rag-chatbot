"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

export const THEME_KEY = "reading-room-theme";

/** Runs in <head> before the page paints, so a saved light theme doesn't
 * flash dark first. Kept as a string because it runs before React loads. */
export const THEME_BOOT_SCRIPT = `try{if(localStorage.getItem("${THEME_KEY}")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // storage blocked: the theme just won't be remembered
    }
  }

  return [theme, toggle];
}
