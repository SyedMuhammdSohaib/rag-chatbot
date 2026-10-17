"use client";

import { useEffect, useState } from "react";

export type Language = "en" | "ur" | "roman_ur";

export const LANGUAGES: { value: Language; label: string; speech: string }[] = [
  { value: "en", label: "English", speech: "en-US" },
  { value: "ur", label: "اردو", speech: "ur-PK" },
  // Roman Urdu is spoken Urdu, so the mic listens for Urdu; reading it aloud
  // works best with an Indian/Pakistani English voice.
  { value: "roman_ur", label: "Roman Urdu", speech: "en-IN" },
];

export function speechLangFor(language: Language) {
  return LANGUAGES.find((l) => l.value === language)?.speech ?? "en-US";
}

export function micLangFor(language: Language) {
  return language === "en" ? "en-US" : "ur-PK";
}

const STORAGE_KEY = "reading-room-language";

/** The chosen answer language, remembered in this browser. */
export function useLanguage(): [Language, (value: Language) => void] {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (saved && LANGUAGES.some((l) => l.value === saved)) setLanguage(saved);
    } catch {
      // storage blocked: keep the default
    }
  }, []);

  function update(value: Language) {
    setLanguage(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // storage blocked: the choice just won't be remembered
    }
  }

  return [language, update];
}
