"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  isDarkMode: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  mounted: boolean;
};

const STORAGE_KEY = "burton-pride-theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getBrowserTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const savedTheme = window.localStorage.getItem(STORAGE_KEY);

    if (savedTheme === "dark" || savedTheme === "light") {
      return savedTheme;
    }
  } catch (error) {
    console.error("Unable to read the Burton Pride theme:", error);
  }

  const prefersDarkMode = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;

  return prefersDarkMode ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const body = document.body;

  const isDarkMode = theme === "dark";

  /*
   * Tailwind dark mode class.
   */
  root.classList.toggle("dark", isDarkMode);

  /*
   * Burton Pride theme classes.
   *
   * Light mode:
   * theme-pride
   *
   * Dark mode:
   * theme-dark
   */
  root.classList.toggle("theme-pride", !isDarkMode);
  root.classList.toggle("theme-dark", isDarkMode);

  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  /*
   * These body classes provide a safe global fallback.
   * Individual page sections can still add their own styling.
   */
  if (body) {
    body.classList.toggle("burton-pride-light", !isDarkMode);
    body.classList.toggle("burton-pride-dark", isDarkMode);
  }
}

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initialTheme = getBrowserTheme();

    setThemeState(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);

    try {
      window.localStorage.setItem(STORAGE_KEY, newTheme);
    } catch (error) {
      console.error("Unable to save the Burton Pride theme:", error);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDarkMode: theme === "dark",
      setTheme,
      toggleTheme,
      mounted,
    }),
    [mounted, setTheme, theme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return context;
}