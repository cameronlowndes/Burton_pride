import { Geist, Geist_Mono } from "next/font/google";
import "../../styles/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Getting Here | Burton Pride 2025",
  description:
    "Plan your journey to Burton Pride 2025. Discover the best travel options including train, bus, taxi, and local directions to the Shobnall Leisure Complex.",
};

export default function PlanYourVisitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen bg-black text-white`}
      >
        {/* NO Navbar and NO Footer here */}
        <main className="flex-grow">{children}</main>
      </body>
    </html>
  );
}
