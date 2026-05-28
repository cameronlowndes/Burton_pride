"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import SponsorCard from "./app/(site)/components/Card/SponsorCard";
import SponsorStoryModal from "./app/(site)/components/Client/Sponsors/SponsorStoryModal";
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
              story: String(sponsor.story || sponsor.message || "").trim() || null,
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
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-4 pt-28 pb-16 text-white sm:px-6 md:px-10 md:pt-32"
      >
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold sm:text-5xl md:text-6xl">
              Our Sponsors
            </h1>

            <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-white/20 bg-white/10 px-6 py-4 shadow-lg backdrop-blur-md">
              <p className="text-base leading-8 text-white/95 sm:text-lg">
                A huge thank you to our sponsors for making{" "}
                <span className="font-extrabold text-yellow-300">
                  Burton Pride
                </span>{" "}
                possible! Your support helps us celebrate diversity, inclusion,
                and love.
              </p>
            </div>
          </div>

          <section className="mt-16 rounded-[32px] border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl md:p-10">
            <h2 className="text-center text-3xl font-extrabold sm:text-4xl">
              Proudly Supported By
            </h2>

            {loading ? (
              <div className="py-16 text-center text-white/80">
                Loading sponsors...
              </div>
            ) : sponsors.length === 0 ? (
              <div className="py-16 text-center text-white/80">
                No sponsors to show yet.
              </div>
            ) : (
              <>
                {mainSponsors.length > 0 && (
                  <div className="mt-12">
                    <div className="relative overflow-hidden rounded-[42px] border-4 border-yellow-300 bg-gradient-to-br from-yellow-300 via-orange-200 to-pink-200 p-2 shadow-[0_0_80px_rgba(250,204,21,0.65)]">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.45),transparent_40%)]" />

                      <div className="relative rounded-[36px] bg-white/90 p-6 text-purple-950 backdrop-blur-md md:p-10">
                        <div className="text-center">
                          <div className="inline-flex items-center gap-2 rounded-full bg-purple-950 px-6 py-3 text-sm font-black uppercase tracking-[0.25em] text-yellow-300 shadow-xl">
                            ⭐ Main Sponsor ⭐
                          </div>

                          <h3 className="mt-6 text-5xl font-black leading-tight text-purple-950 sm:text-6xl">
                            Main Sponsor
                          </h3>

                          <p className="mx-auto mt-4 max-w-3xl text-base font-semibold leading-8 text-purple-900/80 sm:text-lg">
                            A special thank you to our main sponsor for their
                            outstanding support in helping make Burton Pride
                            possible.
                          </p>
                        </div>

                        <div
                          className={`mt-10 grid gap-8 ${
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
                                whileHover={{ scale: 1.025, y: -6 }}
                                className="group relative overflow-hidden rounded-[40px] border-4 border-yellow-300 bg-white p-6 text-left shadow-[0_0_55px_rgba(250,204,21,0.55)] transition"
                              >
                                <div className="absolute inset-0 bg-gradient-to-br from-yellow-100 via-white to-pink-100 opacity-95" />
                                <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-yellow-300/40 blur-3xl" />
                                <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-pink-400/30 blur-3xl" />

                                <div className="relative">
                                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                                    <span className="rounded-full bg-yellow-400 px-5 py-2 text-xs font-black uppercase tracking-[0.2em] text-purple-950 shadow-lg ring-4 ring-yellow-200">
                                      Featured Main Sponsor
                                    </span>

                                    <span className="rounded-full bg-pink-600 px-5 py-2 text-xs font-bold text-white shadow-lg">
                                      Proud Supporter
                                    </span>
                                  </div>

                                  <div
                                    className={`flex flex-col items-center gap-8 ${
                                      mainSponsors.length === 1
                                        ? "lg:flex-row lg:text-left"
                                        : "text-center"
                                    }`}
                                  >
                                    <div className="relative flex h-72 w-full max-w-[520px] shrink-0 items-center justify-center overflow-hidden rounded-[32px] border-4 border-yellow-300 bg-white p-8 shadow-2xl shadow-yellow-500/40">
                                      {sponsor.logo_link ? (
                                        <Image
                                          src={sponsor.logo_link}
                                          alt={
                                            sponsor.sponsor_name ||
                                            "Main sponsor logo"
                                          }
                                          fill
                                          className="object-contain p-8"
                                          unoptimized
                                        />
                                      ) : (
                                        <div className="text-sm font-semibold text-purple-400">
                                          No logo
                                        </div>
                                      )}
                                    </div>

                                    <div className="min-w-0 flex-1 text-center lg:text-left">
                                      <h4 className="text-4xl font-black leading-tight text-purple-950 sm:text-6xl">
                                        {sponsor.sponsor_name || "Main Sponsor"}
                                      </h4>

                                      <div className="mt-4 flex justify-center lg:justify-start">
                                        <span className="inline-flex rounded-full bg-yellow-400 px-7 py-3 text-sm font-black uppercase tracking-[0.22em] text-purple-950 shadow-xl ring-4 ring-yellow-200">
                                          Main Sponsor
                                        </span>
                                      </div>

                                      {canOpenStory && (
                                        <button
                                          type="button"
                                          onClick={() => openSponsorStory(sponsor)}
                                          className="mt-7 inline-flex rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-7 py-4 text-sm font-black text-white shadow-xl transition hover:scale-[1.03]"
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
                  <div className={mainSponsors.length > 0 ? "mt-16" : "mt-10"}>
                    <div className="mb-8 text-center">
                      <h3 className="text-2xl font-extrabold text-white sm:text-3xl">
                        {mainSponsors.length > 0
                          ? "More Amazing Sponsors"
                          : "Sponsors"}
                      </h3>

                      {mainSponsors.length > 0 && (
                        <p className="mt-2 text-white/80">
                          Thank you to every sponsor helping support Burton
                          Pride.
                        </p>
                      )}
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

          <section className="mx-auto mt-20 max-w-3xl text-center">
            <h3 className="text-3xl font-extrabold sm:text-4xl">
              Want to Sponsor Us?
            </h3>

            <p className="mt-5 text-lg leading-8 text-white/95 sm:text-xl">
              Join our amazing sponsors in making a difference! Support{" "}
              <span className="font-extrabold text-yellow-300">
                Burton Pride
              </span>{" "}
              and help create an unforgettable event.
            </p>

            <a
              href="/Collaborate"
              className="mt-8 inline-flex rounded-full bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 px-8 py-4 text-lg font-bold text-black shadow-xl transition hover:scale-[1.03]"
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