// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../styles/globals.css";

import ConditionalNavbar from "./components/Rooting/ConditionalNavbar";
import ConditionalFooter from "./components/Rooting/ConditionalFooter";
import Watermark from "./components/Rooting/Watermark";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Burton Pride",
  description: "Celebrating diversity, inclusion, and love in Burton",
  icons: {
    icon: "/image/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen bg-transparent text-white m-0`}
      >
        <ConditionalNavbar />

        {/* Main gradient background */}
        <div className="flex-grow bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 pb-24">
          <main>{children}</main>
        </div>

        <ConditionalFooter />
       <Watermark />
      </body>
    </html>
  );
}
