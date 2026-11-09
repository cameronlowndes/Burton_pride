import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
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
  description: "Burton Pride — created by the community, for the community.",
  icons: {
    icon: "/image/Logo.png",
    shortcut: "/image/Logo.png",
    apple: "/image/Logo.png",
  },
};

const siteThemeScript = `
(function () {
  var root = document.documentElement;
  var theme = "light";

  try {
    var savedTheme = window.localStorage.getItem("burton-pride-site-theme");

    if (savedTheme === "dark" || savedTheme === "light") {
      theme = savedTheme;
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      theme = "dark";
    }
  } catch {
    theme = "light";
  }

  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
})();
`;

const bodyClassName = [
  geistSans.variable,
  geistMono.variable,
  "m-0 min-h-screen bg-white text-slate-950 antialiased",
  "transition-colors duration-300",
  "dark:bg-[linear-gradient(180deg,#0c1119_0%,#0d111a_45%,#13182d_100%)]",
  "dark:text-[#f5f5f5]",
].join(" ");

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className="h-full bg-white dark:bg-[#0c1119]"
      suppressHydrationWarning
    >
      <head>
        <script
          id="burton-pride-theme-script"
          dangerouslySetInnerHTML={{ __html: siteThemeScript }}
        />
      </head>

      <body className={bodyClassName}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}