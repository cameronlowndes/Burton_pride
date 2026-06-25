"use client";

import { useEffect, useState } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { Analytics } from "@vercel/analytics/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function WeatherWarningPopup() {
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const hideAfter = new Date("2026-06-28T00:00:00");
    const today = new Date();

    if (today < hideAfter) {
      setShowPopup(true);
    }
  }, []);

  if (!showPopup) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4">
      <div className="relative max-w-lg rounded-2xl bg-white p-6 text-center text-black shadow-2xl">
        <button
          type="button"
          onClick={() => setShowPopup(false)}
          className="absolute right-4 top-3 rounded-full px-2 text-3xl font-bold text-gray-500 hover:bg-gray-100 hover:text-black"
          aria-label="Close weather warning"
        >
          ×
        </button>

        <h2 className="mb-3 pr-8 text-2xl font-bold text-red-600">
          Weather Warning for Burton Pride
        </h2>

        <p className="mb-4 text-base">
          Due to the extreme weather expected this week, Burton Pride has updated
          its policy to allow outside drinks into the event.
        </p>

        <p className="mb-4 text-base">
          This includes water and soft drinks only. Alcoholic drinks are still
          not allowed to be brought in from outside.
        </p>

        <p className="mb-4 text-base font-semibold">
          Please make sure drinks are in plastic bottles only — no glass bottles
          are allowed.
        </p>

        <p className="mb-5 text-base">
          Please also wear plenty of sun cream, stay hydrated, and read the full
          updated policy before attending.
        </p>

        <a
          href="/BurtonPride2026/Terms"
          className="inline-block rounded-full bg-pink-600 px-6 py-3 font-bold text-white hover:bg-pink-700"
        >
          Read Full Policy
        </a>
      </div>
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen m-0 antialiased`}
      >
        <WeatherWarningPopup />
        {children}
        <Analytics />
      </body>
    </html>
  );
}