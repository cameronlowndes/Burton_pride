import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";

import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Burton Pride",
    template: "%s | Burton Pride",
  },
  description:
    "Burton Pride — created by the community, for the community.",
  icons: {
    icon: "/image/Logo.png",
    shortcut: "/image/Logo.png",
    apple: "/image/Logo.png",
  },
};

const siteThemeScript = `
(function () {
  try {
    var storageKey = "burton-pride-site-theme";
    var savedTheme = window.localStorage.getItem(storageKey);
    var theme;

    if (savedTheme === "dark" || savedTheme === "light") {
      theme = savedTheme;
    } else {
      var prefersDarkMode = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;

      theme = prefersDarkMode ? "dark" : "light";
    }

    var root = document.documentElement;

    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch {
    var root = document.documentElement;

    root.classList.remove("dark");
    root.dataset.theme = "light";
    root.style.colorScheme = "light";
  }
})();
`;

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html
      lang="en"
      className="
        h-full
        bg-white
        dark:bg-[#2b2b2b]
      "
      suppressHydrationWarning
    >
      <head>
        <script
          id="burton-pride-theme-script"
          dangerouslySetInnerHTML={{
            __html: siteThemeScript,
          }}
        />
      </head>

      <body
        className={`
          ${geistSans.variable}
          ${geistMono.variable}
          m-0
          min-h-screen
          bg-white
          text-slate-950
          antialiased
          transition-colors
          duration-300
          dark:bg-[#2b2b2b]
          dark:text-[#f1f1f1]
        `}
      >
        {children}

        <Analytics />
      </body>
    </html>
  );
}