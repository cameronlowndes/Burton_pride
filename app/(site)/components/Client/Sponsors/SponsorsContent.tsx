"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import SponsorCard from "../../Card/SponsorCard";
import SponsorStoryModal from "./SponsorStoryModal";
import type { Sponsor } from "@/types/sponsor";

type SponsorWithMain = Sponsor & {
  is_main_sponsor?: boolean | null;
  logo_link?: string | null;
  sponsor_name?: string | null;
  sponsorship_type?: string | null;
  sponsor_display_type?: string | null;
  story?: string | null;
  message?: string | null;
  website?: string | null;
  slug?: string | null;
};

type ApiResponse = {
  ok: boolean;
  sponsors?: SponsorWithMain[];
  error?: string;
};

function isMainSponsor(sponsor: SponsorWithMain) {
  return Boolean(sponsor.is_main_sponsor);
}

function hasSponsorStory(sponsor: SponsorWithMain) {
  return String(sponsor.story || sponsor.message || "").trim().length > 0;
}

export default function SponsorsContent() {
  const [sponsors, setSponsors] = useState<SponsorWithMain[]>([]);
  const [selectedSponsor, setSelectedSponsor] = useState<SponsorWithMain | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSponsors() {
      try {
        const res = await fetch("/api/sponsors/approved", {
          cache: "no-store",
        });

        const text = await res.text();
        const data: ApiResponse = text ? JSON.parse(text) : { ok: false };

        if (!res.ok) {
          console.error("Sponsors API error:", data?.error);
          setSponsors([]);
          return;
        }

        if (data.ok && Array.isArray(data.sponsors)) {
          setSponsors(
            data.sponsors.map((sponsor) => ({
              ...sponsor,
              is_main_sponsor: Boolean(sponsor.is_main_sponsor),
              story:
                String(sponsor.story || sponsor.message || "").trim() || null,
            }))
          );
        } else {
          setSponsors([]);
        }
      } catch (error) {
        console.error("Failed to load sponsors:", error);
        setSponsors([]);
      } finally {
        setLoading(false);
      }
    }

    loadSponsors();
  }, []);

  const mainSponsors = useMemo(
    () => sponsors.filter((sponsor) => isMainSponsor(sponsor)),
    [sponsors]
  );

  const normalSponsors = useMemo(
    () => sponsors.filter((sponsor) => !isMainSponsor(sponsor)),
    [sponsors]
  );

  function openSponsorStory(sponsor: SponsorWithMain) {
    const story = String(sponsor.story || sponsor.message || "").trim();

    if (!story) return;

    setSelectedSponsor({
      ...sponsor,
      story,
    });
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="min-h-screen overflow-hidden bg-gradient-to-r  px-3 pb-12 pt-24 text-white sm:px-6 sm:pb-16 sm:pt-28 md:px-10 md:pt-32"
      >
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl md:text-6xl">
              Our Sponsors
            </h1>

            <div className="mx-auto mt-5 max-w-3xl rounded-2xl border border-white/20 bg-white/10 px-4 py-4 shadow-lg backdrop-blur-md sm:mt-8 sm:px-6">
              <p className="text-sm leading-6 text-white/95 sm:text-lg sm:leading-8">
                A huge thank you to our sponsors for making{" "}
                <span className="font-extrabold text-yellow-300">
                  Burton Pride
                </span>{" "}
                possible! Your support helps us celebrate diversity, inclusion,
                and love.
              </p>
            </div>
          </div>

          <section className="mt-9 rounded-[24px] border border-white/20 bg-white/10 p-3 shadow-2xl backdrop-blur-xl sm:mt-16 sm:rounded-[32px] sm:p-6 md:p-10">
            <h2 className="px-2 text-center text-2xl font-extrabold leading-tight sm:text-4xl">
              Proudly Supported By
            </h2>

            {loading ? (
              <div className="py-12 text-center text-sm text-white/80 sm:py-16 sm:text-base">
                Loading sponsors...
              </div>
            ) : sponsors.length === 0 ? (
              <div className="py-12 text-center text-sm text-white/80 sm:py-16 sm:text-base">
                No sponsors to show yet.
              </div>
            ) : (
              <>
                {mainSponsors.length > 0 && (
                  <div className="mt-7 sm:mt-12">
                    <div className="relative overflow-hidden rounded-[28px] border-2 border-yellow-300 bg-gradient-to-br from-yellow-300 via-orange-200 to-pink-200 p-1 shadow-[0_0_38px_rgba(250,204,21,0.52)] sm:rounded-[42px] sm:border-4 sm:p-2 sm:shadow-[0_0_80px_rgba(250,204,21,0.65)]">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.45),transparent_40%)]" />

                      <div className="relative rounded-[24px] bg-white/90 p-3 text-purple-950 backdrop-blur-md sm:rounded-[36px] sm:p-6 md:p-10">
                        <div className="text-center">
                          <div className="inline-flex max-w-full items-center justify-center gap-1.5 rounded-full bg-purple-950 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-yellow-300 shadow-xl sm:gap-2 sm:px-6 sm:py-3 sm:text-sm sm:tracking-[0.25em]">
                            <span aria-hidden="true">⭐</span>
                            <span>Main Sponsor</span>
                            <span aria-hidden="true">⭐</span>
                          </div>

                          <h3 className="mt-4 text-3xl font-black leading-tight text-purple-950 sm:mt-6 sm:text-6xl">
                            Main Sponsor
                          </h3>

                          <p className="mx-auto mt-3 max-w-3xl text-sm font-semibold leading-6 text-purple-900/80 sm:mt-4 sm:text-lg sm:leading-8">
                            A special thank you to our main sponsor for their
                            outstanding support in helping make Burton Pride
                            possible.
                          </p>
                        </div>

                        <div
                          className={`mt-6 grid gap-5 sm:mt-10 sm:gap-8 ${
                            mainSponsors.length === 1
                              ? "grid-cols-1"
                              : "lg:grid-cols-2"
                          }`}
                        >
                          {mainSponsors.map((sponsor) => {
                            const canOpenStory = hasSponsorStory(sponsor);

                            return (
                              <motion.div
                                key={sponsor.id}
                                whileHover={{ scale: 1.02, y: -4 }}
                                className="group relative overflow-hidden rounded-[22px] border-2 border-yellow-300 bg-white p-3 text-left shadow-[0_0_28px_rgba(250,204,21,0.48)] transition sm:rounded-[40px] sm:border-4 sm:p-6 sm:shadow-[0_0_55px_rgba(250,204,21,0.55)]"
                              >
                                <div className="absolute inset-0 bg-gradient-to-br from-yellow-100 via-white to-pink-100 opacity-95" />
                                <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-yellow-300/40 blur-3xl sm:h-48 sm:w-48" />
                                <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-pink-400/30 blur-3xl sm:h-48 sm:w-48" />

                                <div className="relative">
                                  <div className="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
                                    <span className="inline-flex w-full justify-center rounded-full bg-yellow-400 px-3 py-2 text-center text-[9px] font-black uppercase tracking-[0.12em] text-purple-950 shadow-lg ring-2 ring-yellow-200 sm:w-auto sm:px-5 sm:text-xs sm:tracking-[0.2em] sm:ring-4">
                                      Featured Main Sponsor
                                    </span>

                                    <span className="inline-flex w-full justify-center rounded-full bg-pink-600 px-3 py-2 text-center text-[10px] font-bold text-white shadow-lg sm:w-auto sm:px-5 sm:text-xs">
                                      Proud Supporter
                                    </span>
                                  </div>

                                  <div
                                    className={`flex flex-col items-center gap-5 sm:gap-8 ${
                                      mainSponsors.length === 1
                                        ? "lg:flex-row lg:text-left"
                                        : "text-center"
                                    }`}
                                  >
                                    <div className="relative flex h-44 w-full max-w-[520px] shrink-0 items-center justify-center overflow-hidden rounded-[18px] border-2 border-yellow-300 bg-white p-4 shadow-xl shadow-yellow-500/30 sm:h-60 sm:rounded-[32px] sm:border-4 sm:p-8 sm:shadow-2xl sm:shadow-yellow-500/40 lg:h-72">
                                      {sponsor.logo_link ? (
                                        <Image
                                          src={sponsor.logo_link}
                                          alt={
                                            sponsor.sponsor_name ||
                                            "Main sponsor logo"
                                          }
                                          fill
                                          className="object-contain p-4 sm:p-8"
                                          unoptimized
                                        />
                                      ) : (
                                        <div className="text-sm font-semibold text-purple-400">
                                          No logo
                                        </div>
                                      )}
                                    </div>

                                    <div className="min-w-0 flex-1 text-center lg:text-left">
                                      <h4 className="break-words text-2xl font-black leading-tight text-purple-950 [overflow-wrap:anywhere] sm:text-4xl lg:text-6xl">
                                        {sponsor.sponsor_name || "Main Sponsor"}
                                      </h4>

                                      <div className="mt-4 flex justify-center lg:justify-start">
                                        <span className="inline-flex rounded-full bg-yellow-400 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-purple-950 shadow-xl ring-2 ring-yellow-200 sm:px-7 sm:py-3 sm:text-sm sm:tracking-[0.22em] sm:ring-4">
                                          Main Sponsor
                                        </span>
                                      </div>

                                      {canOpenStory && (
                                        <button
                                          type="button"
                                          onClick={() => openSponsorStory(sponsor)}
                                          className="mt-5 inline-flex w-full justify-center rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-5 py-3 text-sm font-black text-white shadow-xl transition hover:scale-[1.03] sm:mt-7 sm:w-auto sm:px-7 sm:py-4"
                                        >
                                          View Sponsor Story
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {normalSponsors.length > 0 && (
                  <div className={mainSponsors.length > 0 ? "mt-10 sm:mt-16" : "mt-7 sm:mt-10"}>
                    <div className="mb-5 text-center sm:mb-8">
                      <h3 className="text-xl font-extrabold text-white sm:text-3xl">
                        {mainSponsors.length > 0
                          ? "More Amazing Sponsors"
                          : "Sponsors"}
                      </h3>

                      {mainSponsors.length > 0 && (
                        <p className="mt-2 px-2 text-sm leading-6 text-white/80 sm:text-base">
                          Thank you to every sponsor helping support Burton
                          Pride.
                        </p>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
                      {normalSponsors.map((sponsor) => (
                        <SponsorCard
                          key={sponsor.id}
                          sponsor={sponsor}
                          onDesktopOpen={setSelectedSponsor}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="mx-auto mt-12 max-w-3xl px-2 text-center sm:mt-20">
            <h3 className="text-2xl font-extrabold sm:text-4xl">
              Want to Sponsor Us?
            </h3>

            <p className="mt-4 text-base leading-7 text-white/95 sm:mt-5 sm:text-xl sm:leading-8">
              Join our amazing sponsors in making a difference! Support{" "}
              <span className="font-extrabold text-yellow-300">
                Burton Pride
              </span>{" "}
              and help create an unforgettable event.
            </p>

            <a
              href="/Collaborate"
              className="mt-6 inline-flex w-full justify-center rounded-full bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 px-6 py-3.5 text-base font-bold text-black shadow-xl transition hover:scale-[1.03] sm:mt-8 sm:w-auto sm:px-8 sm:py-4 sm:text-lg"
            >
              🤝 Become a Sponsor
            </a>
          </section>
        </div>
      </motion.div>

      <SponsorStoryModal
        sponsor={selectedSponsor}
        open={!!selectedSponsor}
        onClose={() => setSelectedSponsor(null)}
      />
    </>
  );
}
