// app/(site)/layout.tsx

import ConditionalNavbar from "./components/Rooting/ConditionalNavbar";
import ConditionalFooter from "./components/Rooting/ConditionalFooter";
import Watermark from "./components/Rooting/Watermark";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-transparent text-white">
      <ConditionalNavbar />

      {/* Main gradient background */}
      <div className="flex-grow bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 pb-24">
        <main>{children}</main>
      </div>

      <ConditionalFooter />
      <Watermark />
    </div>
  );
}
