"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type SiteTheme = "light" | "dark";

const STORAGE_KEY = "burton-pride-site-theme";

function getInitialTheme(): SiteTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const savedTheme = window.localStorage.getItem(STORAGE_KEY);

    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }
  } catch (error) {
    console.error(
      "Burton Pride could not read the saved website theme.",
      error,
    );
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: SiteTheme) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const body = document.body;

  const isDarkMode = theme === "dark";

  /*
   * Tailwind dark mode.
   */
  root.classList.toggle("dark", isDarkMode);

  /*
   * Burton Pride theme classes.
   */
  root.classList.toggle("theme-pride", !isDarkMode);
  root.classList.toggle("theme-dark", isDarkMode);

  /*
   * Store current theme on the HTML element.
   */
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  /*
   * Match the website background immediately.
   *
   * Dark mode uses the new Admin Portal-style
   * deep navy colour.
   */
  if (isDarkMode) {
    root.style.backgroundColor = "#0c1119";
  } else {
    root.style.backgroundColor = "#ffffff";
  }

  if (body) {
    body.classList.toggle("burton-pride-light", !isDarkMode);
    body.classList.toggle("burton-pride-dark", isDarkMode);

    /*
     * Remove any inline background previously applied
     * before setting the current theme.
     */
    body.style.background = "";

    if (isDarkMode) {
      body.style.background =
        "linear-gradient(180deg, #0c1119 0%, #0d111a 45%, #13182d 100%)";
      body.style.color = "#f5f5f5";
    } else {
      body.style.background = "#ffffff";
      body.style.color = "#0f172a";
    }
  }
}

export default function SiteThemeToggle() {
  const [theme, setTheme] = useState<SiteTheme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initialTheme = getInitialTheme();

    setTheme(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);

    /*
     * Keep multiple tabs/windows in sync.
     */
    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      if (event.newValue !== "light" && event.newValue !== "dark") {
        return;
      }

      const nextTheme = event.newValue as SiteTheme;

      setTheme(nextTheme);
      applyTheme(nextTheme);
    }

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  function toggleTheme() {
    const nextTheme: SiteTheme =
      theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    applyTheme(nextTheme);

    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch (error) {
      console.error(
        "Burton Pride could not save the selected website theme.",
        error,
      );
    }
  }

  const isDarkMode = theme === "dark";

  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className="
          h-11
          w-11
          rounded-full
          border
          border-slate-200
          bg-white/90
          shadow-lg
          backdrop-blur-md

          dark:border-white/15
          dark:bg-[#0d111a]/90
        "
      />
    );
  }

  const buttonLabel = isDarkMode
    ? "Switch Burton Pride website to light mode"
    : "Switch Burton Pride website to dark mode";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={buttonLabel}
      aria-pressed={isDarkMode}
      title={buttonLabel}
      className="
        group
        flex
        h-11
        w-11
        items-center
        justify-center
        rounded-full
        border
        border-slate-200
        bg-white/90
        text-slate-950
        shadow-[0_8px_30px_rgba(0,0,0,0.20)]
        backdrop-blur-md
        transition
        duration-200

        hover:scale-105
        hover:bg-white

        focus-visible:outline-none
        focus-visible:ring-4
        focus-visible:ring-pink-300/70

        dark:border-white/15
        dark:bg-[#0d111a]/95
        dark:text-white
        dark:shadow-[0_8px_30px_rgba(0,0,0,0.65)]

        dark:hover:bg-[#13182d]
      "
    >
      {isDarkMode ? (
        <Sun
          aria-hidden="true"
          className="
            h-5
            w-5
            text-yellow-400
            transition-transform
            duration-200
            group-hover:rotate-12
          "
        />
      ) : (
        <Moon
          aria-hidden="true"
          className="
            h-5
            w-5
            text-purple-700
            transition-transform
            duration-200
            group-hover:-rotate-12
          "
        />
      )}

      <span className="sr-only">{buttonLabel}</span>
    </button>
  );
}