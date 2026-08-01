// app/(site)/layout.tsx

import type { ReactNode } from "react";

import ConditionalNavbar from "./components/Rooting/ConditionalNavbar";
import ConditionalFooter from "./components/Rooting/ConditionalFooter";
import Watermark from "./components/Rooting/Watermark";
import HiddenPageGate from "./components/Rooting/HiddenPageGate";
import GlobalRelockPageButton from "./components/Client/GlobalRelockPageButton";
import SiteThemeToggle from "./components/Client/SiteThemeToggle";

import { enforceCurrentSitePage } from "@/lib/sitePage";

type SiteLayoutProps = {
  children: ReactNode;
};

type SiteShellProps = {
  children: ReactNode;
  showRelockButton?: boolean;
};

type SiteBackgroundProps = {
  children: ReactNode;
};

function SiteThemeButton() {
  return (
    <div
      className="
        fixed
        left-3
        top-[60px]
        z-[99999]

        sm:left-5
        sm:top-[68px]
      "
    >
      <SiteThemeToggle />
    </div>
  );
}

function SiteShell({
  children,
  showRelockButton = false,
}: SiteShellProps) {
  return (
    <div
      className="
        flex
        min-h-screen
        w-full
        flex-col
        bg-white
        text-white
        transition-colors
        duration-300

        dark:bg-black
        dark:text-white
      "
    >
      <ConditionalNavbar />

      <SiteThemeButton />

      {children}

      <ConditionalFooter />

      <Watermark />

      {showRelockButton ? <GlobalRelockPageButton /> : null}
    </div>
  );
}

function SiteBackground({
  children,
}: SiteBackgroundProps) {
  return (
    <div
      className="
        relative
        isolate
        flex
        min-h-[calc(100vh-68px)]
        w-full
        flex-grow
        flex-col
        overflow-hidden

        bg-gradient-to-r
        from-pink-500
        via-purple-500
        to-blue-500

        pb-24
        text-white
        transition-colors
        duration-300

        dark:bg-black
        dark:bg-none
      "
    >
      {children}
    </div>
  );
}

function RestrictedPageMain({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main
      className="
        mx-auto
        flex
        min-h-[70vh]
        w-full
        max-w-5xl
        items-center
        justify-center
        bg-transparent
        px-4
        py-16

        sm:px-6
        lg:px-8
      "
    >
      {children}
    </main>
  );
}

export default async function SiteLayout({
  children,
}: SiteLayoutProps) {
  const result = await enforceCurrentSitePage();

  if (result.mode === "hidden") {
    return (
      <SiteShell>
        <SiteBackground>
          <RestrictedPageMain>
            <HiddenPageGate
              route={result.route}
              title={result.title || "This page has been hidden"}
              message={
                result.message ||
                "This page has been hidden by the admin portal and is not currently available."
              }
              requiresPassword={result.requiresPassword}
            />
          </RestrictedPageMain>
        </SiteBackground>
      </SiteShell>
    );
  }

  if (result.mode === "coming_soon") {
    return (
      <SiteShell>
        <SiteBackground>
          <RestrictedPageMain>
            <div
              className="
                w-full
                max-w-3xl
                rounded-[32px]
                border
                border-white/20
                bg-white/10
                p-8
                text-center
                text-white
                shadow-[0_20px_80px_rgba(0,0,0,0.35)]
                backdrop-blur-xl
                transition-colors
                duration-300

                sm:p-12

                dark:border-white/10
                dark:bg-zinc-950/90
                dark:shadow-[0_20px_80px_rgba(0,0,0,0.75)]
              "
            >
              <div
                className="
                  mx-auto
                  inline-flex
                  rounded-full
                  border
                  border-amber-300/40
                  bg-amber-400/15
                  px-4
                  py-1.5
                  text-xs
                  font-semibold
                  uppercase
                  tracking-[0.22em]
                  text-amber-100
                  transition-colors
                  duration-300

                  dark:border-amber-300/30
                  dark:bg-amber-400/10
                  dark:text-amber-200
                "
              >
                Coming soon
              </div>

              <h1
                className="
                  mt-5
                  text-3xl
                  font-semibold
                  tracking-tight
                  text-white

                  sm:text-5xl
                "
              >
                {result.title || "This page is coming soon"}
              </h1>

              <p
                className="
                  mx-auto
                  mt-4
                  max-w-2xl
                  text-sm
                  leading-7
                  text-white/85

                  sm:text-base
                "
              >
                {result.message ||
                  "We are updating this page right now. Please check back soon for the latest Burton Pride information."}
              </p>
            </div>
          </RestrictedPageMain>
        </SiteBackground>
      </SiteShell>
    );
  }

  return (
    <SiteShell showRelockButton>
      <SiteBackground>
        <main className="flex-grow bg-transparent">
          {children}
        </main>
      </SiteBackground>
    </SiteShell>
  );
}