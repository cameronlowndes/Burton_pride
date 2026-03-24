// app/(site)/layout.tsx

import ConditionalNavbar from "./components/Rooting/ConditionalNavbar";
import ConditionalFooter from "./components/Rooting/ConditionalFooter";
import Watermark from "./components/Rooting/Watermark";
import HiddenPageGate from "./components/Rooting/HiddenPageGate";
import { enforceCurrentSitePage } from "@/lib/sitePage";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await enforceCurrentSitePage();

  if (result.mode === "hidden") {
    return (
      <div className="flex min-h-screen flex-col bg-transparent text-white">
        <ConditionalNavbar />

        <div className="flex-grow bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 pb-24">
          <main className="mx-auto flex min-h-[70vh] w-full max-w-5xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
            <HiddenPageGate
              route={result.route}
              title={result.title || "This page has been hidden"}
              message={
                result.message ||
                "This page has been hidden by the admin portal and is not currently available."
              }
              requiresPassword={result.requiresPassword}
            />
          </main>
        </div>

        <ConditionalFooter />
        <Watermark />
      </div>
    );
  }

  if (result.mode === "coming_soon") {
    return (
      <div className="flex min-h-screen flex-col bg-transparent text-white">
        <ConditionalNavbar />

        <div className="flex-grow bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 pb-24">
          <main className="mx-auto flex min-h-[70vh] w-full max-w-5xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
            <div className="w-full max-w-3xl rounded-[32px] border border-white/20 bg-white/10 p-8 text-center shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-12">
              <div className="mx-auto inline-flex rounded-full border border-amber-300/40 bg-amber-400/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-amber-100">
                Coming soon
              </div>

              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                {result.title || "This page is coming soon"}
              </h1>

              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
                {result.message ||
                  "We are updating this page right now. Please check back soon for the latest Burton Pride information."}
              </p>
            </div>
          </main>
        </div>

        <ConditionalFooter />
        <Watermark />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-transparent text-white">
      <ConditionalNavbar />

      <div className="flex-grow bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 pb-24">
        <main>{children}</main>
      </div>

      <ConditionalFooter />
      <Watermark />
    </div>
  );
}