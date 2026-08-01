"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type SiteTheme = "light" | "dark";

const STORAGE_KEY = "burton-pride-theme";

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
   * Burton Pride global theme classes.
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

  if (body) {
    body.classList.toggle("burton-pride-light", !isDarkMode);
    body.classList.toggle("burton-pride-dark", isDarkMode);
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
          h-11 w-11
          rounded-full
          border border-white/30
          bg-white/90
          shadow-lg
          backdrop-blur-md
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
        border-white/30
        bg-white/90
        text-slate-950
        shadow-[0_8px_30px_rgba(0,0,0,0.25)]
        backdrop-blur-md
        transition
        duration-200

        hover:scale-105
        hover:bg-white

        focus-visible:outline-none
        focus-visible:ring-4
        focus-visible:ring-pink-300/70

        dark:border-white/15
        dark:bg-black/90
        dark:text-white
        dark:shadow-[0_8px_30px_rgba(0,0,0,0.65)]

        dark:hover:bg-zinc-900
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