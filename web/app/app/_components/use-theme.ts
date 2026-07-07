"use client";
import { useEffect, useState } from "react";

// Dashboard light/dark theme. Dark is the app's native identity (glow + grain + lime), so it's the
// default; light is opt-in and persisted. Applied as `data-theme` on <html> so the CSS custom-prop
// palette in globals.css cascades to every child incl. the marketing surfaces. No system-pref auto
// switch — an explicit toggle keeps the branded dark look unless the user chooses otherwise.
// ponytail: localStorage + a data attribute, no theme-provider library.
export type Theme = "dark" | "light";
const KEY = "models-theme";

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>("dark");

  // read the stored choice once mounted (SSR can't touch localStorage)
  useEffect(() => {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(KEY, theme);
  }, [theme]);

  return [theme, () => setTheme((t) => (t === "dark" ? "light" : "dark"))];
}
